import { coverArtAsset, fontAssets, gameAssets, uiAssets } from "./config/assets.js";
import { t } from "./config/i18n.js";
import { createApp, setRendererFallback } from "./core/app.js";
import { registerAppListener } from "./core/events.js";
import { applyLayoutMode, setLayoutApp, setLayoutRoot } from "./core/layout.js";
import { audioSystem } from "./systems/audio-system.js";
import { createLoadingScreen } from "./ui/loading-screen.js";
import { setupStartOverlay } from "./ui/start-overlay.js";
import { createMainScene } from "./scenes/main-scene.js";

const discordRpcExtensionId = "com.oyachi.discordrpc";
const discordSessionStartedAt = Date.now();

const updateDiscordPresence = (data) => {
  const extensions = window.Neutralino?.extensions;
  if (!extensions?.dispatch) {
    return;
  }
  extensions.dispatch(discordRpcExtensionId, "setPresence", {
    ...data,
    startTimestamp: discordSessionStartedAt,
  }).catch((error) => {
    console.error("Could not update Discord Rich Presence.", error);
  });
};

const bootstrap = async () => {
  const gameRoot = document.getElementById("game");
  if (!gameRoot) {
    console.error("Game root element not found.");
    return;
  }

  // The desktop build loads neutralino.js. Initialize it before the fullscreen
  // button attempts to use native window APIs.
  window.Neutralino?.init?.();
  updateDiscordPresence({
    details: "Taking care of Oyachi",
    state: "In the room",
  });

  PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;
  PIXI.BaseTexture.defaultOptions.scaleMode = PIXI.SCALE_MODES.NEAREST;

  const app = createApp({ root: gameRoot, audioSystem });
  setLayoutRoot(gameRoot);
  setLayoutApp(app);
  applyLayoutMode();
  registerAppListener(app, window, "resize", applyLayoutMode);
  registerAppListener(app, window, "orientationchange", applyLayoutMode);
  registerAppListener(app, document, "fullscreenchange", applyLayoutMode);
  registerAppListener(app, gameRoot, "contextmenu", (event) => {
    event.preventDefault();
  });
  let backgroundTickHandle = null;
  const startBackgroundTick = () => {
    if (backgroundTickHandle) {
      return;
    }
    app.ticker.stop();
    backgroundTickHandle = window.setInterval(() => {
      if (document.visibilityState !== "hidden") {
        return;
      }
      app.ticker.update(performance.now());
    }, 1000 / 12);
  };
  const stopBackgroundTick = () => {
    if (backgroundTickHandle) {
      clearInterval(backgroundTickHandle);
      backgroundTickHandle = null;
    }
    if (!app.ticker.started) {
      app.ticker.start();
    }
  };
  const syncVisibilityTick = () => {
    if (document.visibilityState === "hidden") {
      startBackgroundTick();
    } else {
      stopBackgroundTick();
    }
  };
  registerAppListener(app, document, "visibilitychange", syncVisibilityTick);
  syncVisibilityTick();
  if (Array.isArray(app.__oyachiCleanup)) {
    app.__oyachiCleanup.push(() => {
      if (backgroundTickHandle) {
        clearInterval(backgroundTickHandle);
        backgroundTickHandle = null;
      }
    });
  }
  if (window.visualViewport) {
    registerAppListener(app, window.visualViewport, "resize", applyLayoutMode);
    registerAppListener(app, window.visualViewport, "scroll", applyLayoutMode);
  }

  const loadingScreen = createLoadingScreen();
  try {
    let skipRequested = false;
    loadingScreen.setSkipHandler(() => {
      skipRequested = true;
    });
    let sfxProgress = 0;
    let musicProgress = 0;
    const updateAudioProgress = () => {
      loadingScreen.setAudioProgress((sfxProgress + musicProgress) / 2);
    };
    const readAudioUpdate = (update) => {
      if (typeof update === "number") {
        return { progress: update };
      }
      return {
        progress: update?.progress ?? 0,
        label: update?.label,
      };
    };
    loadingScreen.setDetailText(t("loading.artwork"));
    const texturesPromise = PIXI.Assets.load(
      [...gameAssets, coverArtAsset, ...uiAssets, ...fontAssets],
      (progress) => {
        loadingScreen.setAssetProgress(progress);
      },
    );
    loadingScreen.setSecondaryIndex(1);
    const sfxPromise = audioSystem.preloadCritical((update) => {
      const { progress, label } = readAudioUpdate(update);
      sfxProgress = progress;
      updateAudioProgress();
      if (label) {
        loadingScreen.setDetailText(label);
      }
    });
    const musicPromise = audioSystem.preloadInitialMusic((update) => {
      const { progress, label } = readAudioUpdate(update);
      musicProgress = progress;
      updateAudioProgress();
      if (label) {
        loadingScreen.setDetailText(label);
      }
    });
    const textures = await texturesPromise;
    if (!skipRequested) {
      await Promise.all([sfxPromise, musicPromise]);
    } else {
      sfxPromise.catch((error) => {
        console.error("SFX preload failed.", error);
      });
      musicPromise.catch((error) => {
        console.error("Music preload failed.", error);
      });
    }
    loadingScreen.setAssetProgress(1);
    if (!skipRequested) {
      sfxProgress = 1;
      musicProgress = 1;
      updateAudioProgress();
    }
    loadingScreen.setDetailText(t("loading.finalizing"));
    loadingScreen.setSecondaryIndex(3);
    const context = createMainScene({ textures, gameRoot });
    setupStartOverlay({
      stage: context.stage,
      coverTexture: textures.coverart,
      playTexture: textures.ui_play,
      onStart: context.setGameStarted,
    });
  } catch (error) {
    console.error("Game bootstrap failed.", error);
  } finally {
    await loadingScreen.fadeOut();
    setRendererFallback(false);
  }
};

bootstrap();
