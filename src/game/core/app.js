import { GAME_HEIGHT, GAME_WIDTH } from "../config/constants.js";
import { registerEvent } from "./events.js";

let app = null;
let rendererFallback = null;
let gameRoot = null;
const contextHandlers = {
  onLost: null,
  onRestored: null,
};

export const getApp = () => app;

export const setContextHandlers = ({ onLost, onRestored } = {}) => {
  if (onLost) {
    contextHandlers.onLost = onLost;
  }
  if (onRestored) {
    contextHandlers.onRestored = onRestored;
  }
};

const ensureRendererFallback = () => {
  if (!gameRoot) {
    return null;
  }
  let fallback = document.getElementById("renderer-fallback");
  if (!fallback) {
    fallback = document.createElement("div");
    fallback.id = "renderer-fallback";
    fallback.textContent = "Renderer reset...";
    fallback.style.position = "absolute";
    fallback.style.inset = "0";
    fallback.style.display = "flex";
    fallback.style.alignItems = "center";
    fallback.style.justifyContent = "center";
    fallback.style.fontFamily = "DePixel, monospace";
    fallback.style.fontSize = "16px";
    fallback.style.color = "#ffffff";
    fallback.style.pointerEvents = "none";
  }
  if (!fallback.parentElement) {
    gameRoot.appendChild(fallback);
  }
  return fallback;
};

export const setRendererFallback = (visible, message = "Renderer reset...") => {
  rendererFallback = rendererFallback ?? ensureRendererFallback();
  if (!rendererFallback) {
    return;
  }
  rendererFallback.textContent = message;
  rendererFallback.hidden = !visible;
};

export const destroyExistingApp = ({ audioSystem } = {}) => {
  const oldApp = window.__OYACHI_APP__;
  if (oldApp) {
    audioSystem?.stopAllLoops?.({ immediate: true });
    if (Array.isArray(oldApp.__oyachiCleanup)) {
      oldApp.__oyachiCleanup.forEach((cleanup) => cleanup());
      oldApp.__oyachiCleanup = [];
    }
    oldApp.destroy(true, { children: true, texture: true, baseTexture: true });
  }
  window.__OYACHI_APP__ = null;
  app = null;
};

export const createApp = ({ root, audioSystem } = {}) => {
  gameRoot = root ?? gameRoot;
  if (!gameRoot) {
    throw new Error("Game root not found.");
  }
  destroyExistingApp({ audioSystem });
  gameRoot.innerHTML = "";
  rendererFallback = ensureRendererFallback();
  setRendererFallback(false);
  app = new PIXI.Application({
    backgroundAlpha: 0,
    antialias: false,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  });
  window.__OYACHI_APP__ = app;
  app.__oyachiCleanup = [];
  gameRoot.appendChild(app.view);
  app.view.setAttribute("aria-label", "Your little Oyachi canvas");
  app.stage.sortableChildren = true;

  const contextLossState = {
    lost: false,
    tickerWasRunning: false,
  };

  const handleContextLost = (event) => {
    event.preventDefault();
    if (contextLossState.lost) {
      return;
    }
    contextLossState.lost = true;
    contextLossState.tickerWasRunning = app.ticker.started;
    app.ticker.stop();
    audioSystem?.pauseAll?.();
    console.warn("WebGL context lost. Rendering paused until reset.");
    setRendererFallback(true);
    if (typeof contextHandlers.onLost === "function") {
      contextHandlers.onLost();
    }
  };

  const handleContextRestored = () => {
    if (!contextLossState.lost) {
      return;
    }
    contextLossState.lost = false;
    console.warn("WebGL context restored. Rendering resumed.");
    setRendererFallback(false);
    if (contextLossState.tickerWasRunning) {
      app.ticker.start();
    }
    audioSystem?.resumeAll?.();
    if (typeof contextHandlers.onRestored === "function") {
      contextHandlers.onRestored();
    }
    app.renderer.render(app.stage);
  };

  registerEvent(
    app.view,
    "webglcontextlost",
    handleContextLost,
    { passive: false },
    app.__oyachiCleanup,
  );
  registerEvent(
    app.view,
    "webglcontextrestored",
    handleContextRestored,
    undefined,
    app.__oyachiCleanup,
  );

  return app;
};
