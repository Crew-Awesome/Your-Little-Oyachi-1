import { GAME_HEIGHT, GAME_WIDTH } from "../config/constants.js";

const layoutState = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  containerWidth: GAME_WIDTH,
  containerHeight: GAME_HEIGHT,
};

const layoutSubscribers = new Set();
let appRef = null;
let gameRoot = null;
const rootStyle = document.documentElement.style;

const getViewportHeight = () => {
  if (window.visualViewport?.height) {
    return window.visualViewport.height;
  }
  return document.documentElement.clientHeight;
};

export const setLayoutRoot = (root) => {
  gameRoot = root;
};

export const setLayoutApp = (app) => {
  appRef = app;
};

export const updateViewportMetrics = () => {
  const viewportHeight = getViewportHeight();
  rootStyle.setProperty("--viewport-height", `${viewportHeight}px`);
};

export const registerLayoutSubscriber = (handler) => {
  layoutSubscribers.add(handler);
  return () => {
    layoutSubscribers.delete(handler);
  };
};

export const getLayoutBounds = () => {
  const width = Math.max(1, appRef?.renderer?.screen?.width ?? GAME_WIDTH);
  const height = Math.max(1, appRef?.renderer?.screen?.height ?? GAME_HEIGHT);
  return {
    width,
    height,
    left: 0,
    top: 0,
    right: width,
    bottom: height,
    centerX: width / 2,
    centerY: height / 2,
    scale: layoutState.scale,
    containerWidth: layoutState.containerWidth,
    containerHeight: layoutState.containerHeight,
  };
};

export const applyLayoutMode = () => {
  updateViewportMetrics();
  if (!appRef || !gameRoot) {
    return;
  }
  const containerWidth = Math.max(1, gameRoot.clientWidth || GAME_WIDTH);
  const containerHeight = Math.max(1, gameRoot.clientHeight || GAME_HEIGHT);
  const scale = Math.max(
    0.1,
    Math.min(containerWidth / GAME_WIDTH, containerHeight / GAME_HEIGHT),
  );
  const scaledWidth = GAME_WIDTH * scale;
  const scaledHeight = GAME_HEIGHT * scale;
  const offsetX = (containerWidth - scaledWidth) / 2;
  const offsetY = (containerHeight - scaledHeight) / 2;
  layoutState.scale = scale;
  layoutState.offsetX = offsetX;
  layoutState.offsetY = offsetY;
  layoutState.containerWidth = containerWidth;
  layoutState.containerHeight = containerHeight;
  appRef.renderer.resize(GAME_WIDTH, GAME_HEIGHT);
  appRef.view.style.position = "absolute";
  appRef.view.style.left = "0";
  appRef.view.style.top = "0";
  appRef.view.style.width = `${GAME_WIDTH}px`;
  appRef.view.style.height = `${GAME_HEIGHT}px`;
  appRef.view.style.transformOrigin = "top left";
  appRef.view.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
  const layout = getLayoutBounds();
  layoutSubscribers.forEach((handler) => handler(layout));
};
