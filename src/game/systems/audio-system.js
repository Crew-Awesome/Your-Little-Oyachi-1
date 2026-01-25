import { audioDefaults, audioPitchConfig } from "../config/audio.js";
import { audioStorageKeys } from "../config/storage.js";
import { clamp } from "../utils/math.js";

const createAudioSystem = () => {
  const sfxFiles = {
    walkHop: [
      "assets/audio/sfx/walk_hop_1.wav",
      "assets/audio/sfx/walk_hop_2.wav",
    ],
    petSoft: [
      "assets/audio/sfx/pet_soft_1.wav",
      "assets/audio/sfx/pet_soft_2.wav",
    ],
    petFast: [
      "assets/audio/sfx/pet_fast_1.wav",
      "assets/audio/sfx/pet_fast_2.wav",
    ],
    petHoldMagic: ["assets/audio/sfx/pet_hold_magic_loop.wav"],
    petOh: ["assets/audio/sfx/pet_oh_soft.wav"],
    sneeze: ["assets/audio/sfx/sneeze.wav"],
  };
  const musicTracks = [
    {
      title: "Acoustic Meditation 2",
      src: "assets/audio/music/AcousticMeditation2.mp3",
    },
    { title: "Amazing Grace", src: "assets/audio/music/AmazingGrace.mp3" },
    { title: "Autumn Sunset", src: "assets/audio/music/AutumnSunset.mp3" },
    { title: "Noel", src: "assets/audio/music/Noel.mp3" },
    { title: "One Fine Day", src: "assets/audio/music/OneFineDay.mp3" },
    { title: "Paper Wings", src: "assets/audio/music/PaperWings.mp3" },
  ];
  const cooldowns = new Map();
  const buffers = new Map();
  const loops = new Map();
  const loopTokens = new Map();
  let context = null;
  let masterGain = null;
  let sfxGain = null;
  let musicGain = null;
  let unlocked = false;
  let musicReady = false;
  let sfxReady = false;
  let sfxLoadingPromise = null;
  let musicLoadingPromise = null;
  let currentMusicIndex = -1;
  let lastMusicIndex = -1;
  let currentMusicToken = 0;
  let currentMusicSource = null;
  let onNowPlaying = null;
  let initialMusicIndex = null;
  let initialMusicPromise = null;
  let initialMusicReady = false;
  let musicVolume = audioDefaults.musicVolume;
  let sfxVolume = audioDefaults.sfxVolume;
  let musicEnabled = audioDefaults.musicEnabled;
  let sfxEnabled = audioDefaults.sfxEnabled;
  let isPaused = false;

  const ensureContext = (allowCreate = unlocked) => {
    if (!context && allowCreate) {
      try {
        context = new (window.AudioContext || window.webkitAudioContext)();
      } catch (error) {
        console.error("Audio context creation failed.", error);
        return null;
      }
      masterGain = context.createGain();
      sfxGain = context.createGain();
      musicGain = context.createGain();
      masterGain.connect(context.destination);
      sfxGain.connect(masterGain);
      musicGain.connect(masterGain);
      setMusicVolume(musicVolume);
      setSfxVolume(sfxVolume);
    }
    return context;
  };

  const setMusicVolume = (value) => {
    musicVolume = clamp(value, 0, 1);
    if (musicGain && context) {
      const gainValue = musicEnabled ? musicVolume : 0;
      musicGain.gain.setValueAtTime(gainValue, context.currentTime);
    }
  };

  const setSfxVolume = (value) => {
    sfxVolume = clamp(value, 0, 1);
    if (sfxGain && context) {
      const gainValue = sfxEnabled ? sfxVolume : 0;
      sfxGain.gain.setValueAtTime(gainValue, context.currentTime);
    }
  };

  const setMusicEnabled = (enabled) => {
    musicEnabled = Boolean(enabled);
    if (musicGain && context) {
      const gainValue = musicEnabled ? musicVolume : 0;
      musicGain.gain.setValueAtTime(gainValue, context.currentTime);
    }
    if (!musicEnabled && currentMusicSource) {
      currentMusicToken += 1;
      currentMusicSource.stop();
      currentMusicSource = null;
      if (typeof onNowPlaying === "function") {
        onNowPlaying("");
      }
    } else if (musicEnabled && unlocked && !isPaused) {
      startMusic().catch((error) => {
        console.error("Music start failed.", error);
      });
    }
  };

  const setSfxEnabled = (enabled) => {
    sfxEnabled = Boolean(enabled);
    if (sfxGain && context) {
      const gainValue = sfxEnabled ? sfxVolume : 0;
      sfxGain.gain.setValueAtTime(gainValue, context.currentTime);
    }
    if (!sfxEnabled) {
      if (loops.has("petHoldMagic")) {
        console.log("LOOP_STOP", "sfx_disabled");
      }
      stopAllLoops({ immediate: true });
    }
  };

  const loadBuffer = async (key, src, { allowCreate = false } = {}) => {
    if (buffers.has(key)) {
      return buffers.get(key);
    }
    const audioContext = ensureContext(allowCreate || unlocked);
    if (!audioContext) {
      return null;
    }
    if (key.includes("petHoldMagic")) {
      console.log("HOLD_LOOP_LOAD", key);
    }
    try {
      const response = await fetch(src);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = await audioContext.decodeAudioData(arrayBuffer);
      buffers.set(key, buffer);
      return buffer;
    } catch (error) {
      console.error("Audio buffer load failed.", { key, src, error });
      return null;
    }
  };

  const pickRandom = (items) => items[Math.floor(Math.random() * items.length)];

  const shouldPlay = (key, cooldownMs) => {
    const now = performance.now();
    const nextAllowed = cooldowns.get(key) ?? 0;
    if (now < nextAllowed) {
      return false;
    }
    cooldowns.set(key, now + cooldownMs);
    return true;
  };

  const fadeGainTo = (gainNode, value, duration) => {
    const audioContext = ensureContext();
    if (!audioContext) {
      return null;
    }
    const now = audioContext.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(value, now + duration);
  };

  const playBuffer = async ({
    key,
    src,
    volume = 1,
    loop = false,
    pitch = 1,
    fadeIn = 0,
  }) => {
    if (!unlocked || isPaused || !sfxEnabled) {
      return null;
    }
    const audioContext = ensureContext();
    if (!audioContext || !sfxGain) {
      return null;
    }
    const buffer = await loadBuffer(key, src);
    if (!buffer) {
      return null;
    }
    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    source.buffer = buffer;
    source.loop = loop;
    source.playbackRate.setValueAtTime(pitch, audioContext.currentTime);
    gain.gain.setValueAtTime(loop && fadeIn > 0 ? 0 : volume, audioContext.currentTime);
    source.connect(gain);
    gain.connect(sfxGain);
    source.start();
    if (loop && fadeIn > 0) {
      fadeGainTo(gain, volume, fadeIn);
    }
    return { source, gain };
  };

  const registerLoop = (id, handle) => {
    const token = (loopTokens.get(id) ?? 0) + 1;
    loopTokens.set(id, token);
    const loopHandle = { ...handle, id, token };
    loops.set(id, loopHandle);
    handle.source.onended = () => {
      const current = loops.get(id);
      if (current && current.token === token) {
        loops.delete(id);
      }
    };
    return loopHandle;
  };

  const startLoop = async ({ id, allowPitch = false, fadeIn = 0.2 }) => {
    if (!unlocked || isPaused || !sfxEnabled) {
      return null;
    }
    const existing = loops.get(id);
    if (existing) {
      return existing;
    }
    const src = pickRandom(sfxFiles[id]);
    const pitch = allowPitch
      ? audioPitchConfig.basePitch +
        (Math.random() * 2 - 1) * audioPitchConfig.variation
      : 1;
    const handle = await playBuffer({
      key: `${id}:${src}`,
      src,
      volume: 1,
      loop: true,
      pitch,
      fadeIn,
    });
    if (handle) {
      return registerLoop(id, handle);
    }
    return null;
  };

  const playSfx = async ({
    id,
    cooldownMs,
    allowPitch = true,
    loop = false,
    fadeIn = 0,
  }) => {
    if (loop) {
      return startLoop({ id, allowPitch, fadeIn });
    }
    if (!unlocked || !sfxEnabled || isPaused) {
      return null;
    }
    if (cooldownMs && !shouldPlay(id, cooldownMs)) {
      return null;
    }
    const src = pickRandom(sfxFiles[id]);
    const pitch = allowPitch
      ? audioPitchConfig.basePitch +
        (Math.random() * 2 - 1) * audioPitchConfig.variation
      : 1;
    return playBuffer({
      key: `${id}:${src}`,
      src,
      volume: 1,
      loop: false,
      pitch,
      fadeIn,
    });
  };

  const stopLoop = (id, { fadeOutSeconds = 0.25, immediate = false } = {}) => {
    const handle = loops.get(id);
    if (!handle) {
      return;
    }
    loops.delete(id);
    if (!context) {
      return;
    }
    const now = context.currentTime;
    if (immediate || fadeOutSeconds <= 0) {
      handle.source.onended = null;
      handle.source.stop();
      return;
    }
    fadeGainTo(handle.gain, 0, fadeOutSeconds);
    handle.source.onended = null;
    handle.source.stop(now + fadeOutSeconds + 0.03);
  };

  const isLoopPlaying = (id) => loops.has(id);

  const stopAllLoops = (options) => {
    loops.forEach((_, id) => {
      stopLoop(id, options);
    });
  };

  const loadSfxBuffers = async (onProgress) => {
    if (sfxReady) {
      return;
    }
    const reportProgress = (progress, label, src) => {
      if (typeof onProgress === "function") {
        onProgress({ progress, label, src });
      }
    };
    if (!unlocked) {
      reportProgress(1, "Audio locked");
      return;
    }
    if (sfxLoadingPromise) {
      await sfxLoadingPromise;
      return;
    }
    const entries = Object.entries(sfxFiles).flatMap(([id, files]) =>
      files.map((src) => ({ key: `${id}:${src}`, src })),
    );
    const total = Math.max(entries.length, 1);
    let loaded = 0;
    reportProgress(0, "Loading sfx");
    sfxLoadingPromise = Promise.all(
      entries.map(async ({ key, src }) => {
        reportProgress(loaded / total, `Loading sfx: ${src}`, src);
        const buffer = await loadBuffer(key, src);
        if (!buffer) {
          return;
        }
        loaded += 1;
        reportProgress(loaded / total, `Loading sfx: ${src}`, src);
      }),
    ).then(() => {
      sfxReady = true;
    });
    await sfxLoadingPromise;
  };

  const loadMusicBuffers = async (onProgress) => {
    if (musicReady) {
      return;
    }
    const reportProgress = (progress, label, src) => {
      if (typeof onProgress === "function") {
        onProgress({ progress, label, src });
      }
    };
    if (!unlocked) {
      reportProgress(1, "Audio locked");
      return;
    }
    if (musicLoadingPromise) {
      await musicLoadingPromise;
      return;
    }
    const total = Math.max(musicTracks.length, 1);
    let loaded = 0;
    reportProgress(0, "Loading music");
    musicLoadingPromise = Promise.all(
      musicTracks.map(async (track) => {
        reportProgress(loaded / total, `Loading music: ${track.src}`, track.src);
        const buffer = await loadBuffer(`music:${track.src}`, track.src);
        if (!buffer) {
          return;
        }
        loaded += 1;
        reportProgress(loaded / total, `Loading music: ${track.src}`, track.src);
      }),
    ).then(() => {
      musicReady = true;
    });
    await musicLoadingPromise;
  };

  const selectInitialTrack = () => {
    if (initialMusicIndex !== null) {
      return initialMusicIndex;
    }
    if (musicTracks.length === 0) {
      initialMusicIndex = -1;
      return initialMusicIndex;
    }
    initialMusicIndex = Math.floor(Math.random() * musicTracks.length);
    return initialMusicIndex;
  };

  const preloadInitialMusic = async (onProgress) => {
    const reportProgress = (progress, label, src) => {
      if (typeof onProgress === "function") {
        onProgress({ progress, label, src });
      }
    };
    if (!unlocked) {
      reportProgress(1, "Audio locked");
      return;
    }
    if (initialMusicReady) {
      reportProgress(1, "Music ready");
      return;
    }
    if (initialMusicPromise) {
      await initialMusicPromise;
      reportProgress(1, "Music ready");
      return;
    }
    const index = selectInitialTrack();
    if (index < 0) {
      initialMusicReady = true;
      reportProgress(1, "No music tracks");
      return;
    }
    const track = musicTracks[index];
    reportProgress(0, `Loading music: ${track.src}`, track.src);
    initialMusicPromise = loadBuffer(`music:${track.src}`, track.src)
      .then((buffer) => {
        initialMusicReady = Boolean(buffer);
        reportProgress(1, `Loaded: ${track.src}`, track.src);
      })
      .catch((error) => {
        console.error("Initial music preload failed.", error);
        reportProgress(1, `Failed: ${track.src}`, track.src);
      });
    await initialMusicPromise;
  };

  const playMusicTrack = async (index) => {
    if (!unlocked || isPaused || !musicEnabled) {
      return;
    }
    const audioContext = ensureContext();
    if (!audioContext || !musicGain) {
      return;
    }
    const track = musicTracks[index];
    if (!track) {
      return;
    }
    const buffer = await loadBuffer(`music:${track.src}`, track.src);
    if (!buffer) {
      return;
    }
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = false;
    source.connect(musicGain);
    const token = ++currentMusicToken;
    currentMusicSource = source;
    source.onended = () => {
      if (token !== currentMusicToken) {
        return;
      }
      playNextTrack();
    };
    source.start();
    currentMusicIndex = index;
    lastMusicIndex = index;
    if (typeof onNowPlaying === "function") {
      onNowPlaying(track.title);
    }
  };

  const playNextTrack = () => {
    if (!musicEnabled) {
      return;
    }
    if (musicTracks.length === 0) {
      return;
    }
    let nextIndex =
      currentMusicIndex === -1
        ? selectInitialTrack()
        : Math.floor(Math.random() * musicTracks.length);
    if (musicTracks.length > 1 && nextIndex === lastMusicIndex) {
      nextIndex = (nextIndex + 1) % musicTracks.length;
    }
    playMusicTrack(nextIndex);
  };

  const startMusic = async () => {
    if (!unlocked || isPaused || !musicEnabled) {
      return;
    }
    if (currentMusicSource) {
      return;
    }
    await preloadInitialMusic();
    playNextTrack();
    loadMusicBuffers().catch((error) => {
      console.error("Music preload failed.", error);
    });
  };

  const preloadCritical = async (onProgress) => {
    await loadSfxBuffers(onProgress);
  };

  const preloadMusic = async (onProgress) => {
    await loadMusicBuffers(onProgress);
  };

  const unlock = () => {
    unlocked = true;
    if (isPaused) {
      return;
    }
    const audioContext = ensureContext();
    if (audioContext && audioContext.state === "suspended") {
      audioContext.resume().catch((error) => {
        console.error("Audio context resume failed.", error);
      });
    }
  };

  const pauseAll = ({ stopLoops = true } = {}) => {
    isPaused = true;
    if (stopLoops) {
      stopAllLoops({ immediate: true });
    }
    if (context && context.state === "running") {
      context.suspend().catch((error) => {
        console.error("Audio context suspend failed.", error);
      });
    }
  };

  const resumeAll = () => {
    isPaused = false;
    if (!unlocked) {
      return;
    }
    if (context && context.state === "suspended") {
      context.resume().catch((error) => {
        console.error("Audio context resume failed.", error);
      });
    }
  };

  const loadStoredVolumes = () => {
    const storedMusic = Number.parseFloat(localStorage.getItem(audioStorageKeys.musicVolume));
    const storedSfx = Number.parseFloat(localStorage.getItem(audioStorageKeys.sfxVolume));
    const storedMusicEnabled = localStorage.getItem(audioStorageKeys.musicEnabled);
    const storedSfxEnabled = localStorage.getItem(audioStorageKeys.sfxEnabled);
    if (Number.isFinite(storedMusic)) {
      musicVolume = clamp(storedMusic, 0, 1);
    }
    if (Number.isFinite(storedSfx)) {
      sfxVolume = clamp(storedSfx, 0, 1);
    }
    if (storedMusicEnabled !== null) {
      musicEnabled = storedMusicEnabled !== "false";
    }
    if (storedSfxEnabled !== null) {
      sfxEnabled = storedSfxEnabled !== "false";
    }
  };

  loadStoredVolumes();

  return {
    unlock,
    startMusic,
    preloadCritical,
    preloadInitialMusic,
    preloadMusic,
    playSfx,
    startLoop,
    stopLoop,
    stopAllLoops,
    isLoopPlaying,
    pauseAll,
    resumeAll,
    setMusicVolume,
    setSfxVolume,
    setMusicEnabled,
    setSfxEnabled,
    getMusicVolume: () => musicVolume,
    getSfxVolume: () => sfxVolume,
    getMusicEnabled: () => musicEnabled,
    getSfxEnabled: () => sfxEnabled,
    setNowPlayingHandler: (handler) => {
      onNowPlaying = handler;
    },
    sfxFiles,
    musicTracks,
  };
};

export const audioSystem = createAudioSystem();

let audioUnlocked = false;

export const unlockAudio = () => {
  if (audioUnlocked) {
    return;
  }
  audioUnlocked = true;
  const audioContexts = [
    window.Howler?.ctx,
    window.Howler?.context?.ctx,
    window.Howler?.context,
    window.PIXI?.sound?.context?.audioContext,
    window.audioContext,
  ].filter(Boolean);
  audioContexts.forEach((context) => {
    if (typeof context?.resume === "function") {
      Promise.resolve(context.resume()).catch((error) => {
        console.error("Audio resume failed.", error);
      });
    }
  });
  audioSystem.unlock();
};
