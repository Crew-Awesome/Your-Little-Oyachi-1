# Systems Guide

## Continuity Requirement
AI agents must keep AGENTS.md files continuously updated whenever they change code, move files, rename folders, adjust systems, or change build/deploy behavior. After any modification, verify the relevant AGENTS.md file(s) accurately reflect the new state of the repository.

## Purpose
- Shared runtime systems used across the game
- Currently contains only audio system
- Centralized logic for complex subsystems
- Exported as singleton instances

## Key Files

### `audio-system.js`
**Purpose:** Complete Web Audio API wrapper for game audio

**Architecture:**
- Single `AudioContext` created on first user gesture
- Three gain nodes: `masterGain` → `sfxGain`, `musicGain`
- Buffer caching system to avoid reloading
- Token-based loop management to prevent stale loops

**Exported Singleton:**
```javascript
export const audioSystem = createAudioSystem();
```

**Key Methods:**

**Audio Control:**
- `unlock()`: Initialize audio context on user gesture
- `startMusic()`: Begin background music playback
- `pauseAll({ stopLoops })`: Pause all audio
- `resumeAll()`: Resume all audio

**Volume/Enabled:**
- `setMusicVolume(value)`, `getMusicVolume()`
- `setSfxVolume(value)`, `getSfxVolume()`
- `setMusicEnabled(enabled)`, `getMusicEnabled()`
- `setSfxEnabled(enabled)`, `getSfxEnabled()`
- `loadStoredVolumes()`: Load from localStorage

**One-Shot SFX:**
```javascript
playSfx({
  id,              // SFX identifier (e.g., "petSoft")
  cooldownMs,      // Minimum time between plays
  allowPitch=true, // Apply pitch variation
})
```
- Returns: Promise<{ source, gain }> or null

**Looping SFX:**
- `startLoop({ id, allowPitch, fadeIn })`: Start loop
- `stopLoop(id, { fadeOutSeconds, immediate })`: Stop loop
- `isLoopPlaying(id)`: Check if loop active
- `stopAllLoops(options)`: Stop all loops

**Music:**
- `preloadCritical(onProgress)`: Load essential SFX
- `preloadInitialMusic(onProgress)`: Load first music track
- `loadMusicBuffers(onProgress)`: Load remaining tracks
- `setNowPlayingHandler(handler)`: Callback for track title

**Audio Files Structure** (internal):
```javascript
const sfxFiles = {
  walkHop: ["assets/audio/sfx/walk_hop_1.wav", "walk_hop_2.wav"],
  petSoft: ["pet_soft_1.wav", "pet_soft_2.wav"],
  petFast: ["pet_fast_1.wav", "pet_fast_2.wav"],
  petHoldMagic: ["pet_hold_magic_loop.wav"],
  petOh: ["pet_oh_soft.wav"],
  sneeze: ["sneeze.wav"],
};

const musicTracks = [
  { title: "Acoustic Meditation 2", src: "assets/audio/music/..." },
  // ...
];
```

**Audio Unlock Flow:**
1. Browser starts with suspended AudioContext
2. User clicks start overlay
3. `unlockAudio()` called (in index.js)
4. `audioSystem.unlock()` initializes context
5. Context resumes if suspended

## Conventions

### Non-Blocking Audio
- Missing audio files log errors but don't crash
- Game continues without audio if files fail
- Use `catch()` on audio promises

### No Auto-Start
- Audio never starts without user gesture
- Unlock flow must be triggered by interaction
- Music starts only after `startMusic()` call

### Loop Safety
- Token-based system prevents stale loops
- Always check `isLoopPlaying()` before starting
- Provide fadeOut to avoid audio clicks

### Pitch Variation
- Base pitch: 1.08
- Variation: ±0.05 (from `audioPitchConfig`)
- Can be disabled per-sound with `allowPitch: false`

## Safe Modification Guidelines

### Very Safe
- Adding new SFX entries to `sfxFiles`
- Adding new music tracks to `musicTracks`
- Adjusting volume defaults in `audioDefaults`
- Modifying pitch variation in `audioPitchConfig`

### Safe with Testing
- Changing audio file paths
- Adjusting fadeIn/fadeOut durations
- Modifying cooldown values

### Unsafe
- Removing existing SFX or music
- Changing core audio architecture
- Modifying the unlock flow

## Pattern Examples

### Adding New SFX
```javascript
// 1. Add file to assets/audio/sfx/my_sound.wav

// 2. Register in audio-system.js
const sfxFiles = {
  // ... existing
  mySound: ["assets/audio/sfx/my_sound.wav"],
};

// 3. Play in game code
void audioSystem.playSfx({
  id: "mySound",
  cooldownMs: 200,
});
```

### Starting/Stopping Loop
```javascript
// Start (check first!)
if (!audioSystem.isLoopPlaying("myLoop")) {
  void audioSystem.startLoop({
    id: "myLoop",
    allowPitch: false,
    fadeIn: 0.35,
  });
}

// Stop with fade
audioSystem.stopLoop("myLoop", { fadeOutSeconds: 0.25 });
```

### Handling Context Loss
- Audio system automatically pauses on context loss
- `pauseAll({ stopLoops: true })` called on blur
- `resumeAll()` called when context restores
