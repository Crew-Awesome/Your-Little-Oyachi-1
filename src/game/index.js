import { coverArtAsset, fontAssets, gameAssets, uiAssets } from "./config/assets.js";
import { createApp, setRendererFallback } from "./core/app.js";
import { registerAppListener } from "./core/events.js";
import { applyLayoutMode, setLayoutApp, setLayoutRoot } from "./core/layout.js";
import { audioSystem } from "./systems/audio-system.js";
import { createLoadingScreen } from "./ui/loading-screen.js";
import { setupStartOverlay } from "./ui/start-overlay.js";
import { createMainScene } from "./scenes/main-scene.js";

const bootstrap = async () => {
  const gameRoot = document.getElementById("game");
  if (!gameRoot) {
    console.error("Game root element not found.");
    return;
  }

  PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;
  PIXI.BaseTexture.defaultOptions.scaleMode = PIXI.SCALE_MODES.NEAREST;

  const app = createApp({ root: gameRoot, audioSystem });
  setLayoutRoot(gameRoot);
  setLayoutApp(app);
  applyLayoutMode();
  registerAppListener(app, window, "resize", applyLayoutMode);
  registerAppListener(app, window, "orientationchange", applyLayoutMode);
  registerAppListener(app, document, "fullscreenchange", applyLayoutMode);
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
    loadingScreen.setDetailText("Loading artwork");
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
    loadingScreen.setDetailText("Finalizing");
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
