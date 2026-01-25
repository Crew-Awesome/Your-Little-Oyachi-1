import { GAME_H, GAME_W } from "../config/constants.js";
import { getLayoutBounds, registerLayoutSubscriber } from "../core/layout.js";
import { getApp } from "../core/app.js";
import { clamp } from "../utils/math.js";
import { createPixelText } from "../utils/text.js";

export const createLoadingScreen = () => {
  const app = getApp();
  if (!app) {
    throw new Error("Pixi app not initialized.");
  }
  const container = new PIXI.Container();
  container.zIndex = 1000000;
  container.alpha = 0;

  const shade = new PIXI.Graphics();
  shade.beginFill(0xf4f4f4, 1);
  shade.drawRect(0, 0, GAME_W, GAME_H);
  shade.endFill();
  container.addChild(shade);

  const loadingText = createPixelText("Loading.", {
    fontSize: 14,
    fill: 0x111111,
  });
  loadingText.anchor.set(0.5);
  container.addChild(loadingText);

  const secondaryMessages = [
    "Preparing the room",
    "Loading sounds",
    "Getting cozy",
    "Almost ready",
  ];
  let secondaryIndex = 0;
  const secondaryText = createPixelText(secondaryMessages[secondaryIndex], {
    fontSize: 11,
    fill: 0x4a4a4a,
  });
  secondaryText.anchor.set(0.5);
  container.addChild(secondaryText);

  const detailText = createPixelText("", {
    fontSize: 10,
    fill: 0x6a6a6a,
  });
  detailText.anchor.set(0.5);
  container.addChild(detailText);

  const barBounds = {
    width: 160,
    height: 6,
    x: GAME_W / 2 - 80,
    y: GAME_H / 2 + 22,
  };

  const barBackground = new PIXI.Graphics();
  barBackground.beginFill(0xd9d9d9, 1);
  barBackground.drawRect(barBounds.x, barBounds.y, barBounds.width, barBounds.height);
  barBackground.endFill();
  container.addChild(barBackground);

  const barFill = new PIXI.Graphics();
  container.addChild(barFill);

  const skipText = createPixelText("Skip", {
    fontSize: 11,
    fill: 0x111111,
  });
  skipText.anchor.set(1, 1);
  skipText.alpha = 0.35;
  skipText.visible = false;
  skipText.eventMode = "static";
  skipText.cursor = "pointer";
  container.addChild(skipText);

  app.stage.addChild(container);

  const fadeInDuration = 0.35;
  const fadeOutDuration = 0.25;
  let fadeInTime = 0;
  let fadeOutTime = 0;
  let fadingOut = false;
  let resolveFadeOut = null;

  let assetProgress = 0;
  let audioProgress = 0;
  let targetProgress = 0;
  let currentProgress = 0;

  let dotsTimer = 0;
  let dotsCount = 1;

  let secondaryTimer = 0;
  let skipTimer = 0;
  let skipVisible = false;
  let skipRequested = false;
  let onSkip = null;

  const updateTargetProgress = () => {
    const weighted = assetProgress * 0.75 + audioProgress * 0.25;
    targetProgress = clamp(weighted, 0, 1);
  };

  const updateBar = () => {
    barFill.clear();
    barFill.beginFill(0xb3b3b3, 1);
    barFill.drawRect(
      barBounds.x,
      barBounds.y,
      barBounds.width * currentProgress,
      barBounds.height,
    );
    barFill.endFill();
  };

  const updateLayout = (layout) => {
    const { width, height, centerX, centerY, right, bottom } = layout;
    shade.clear();
    shade.beginFill(0xf4f4f4, 1);
    shade.drawRect(0, 0, width, height);
    shade.endFill();
    loadingText.x = centerX;
    loadingText.y = centerY - 16;
    secondaryText.x = centerX;
    secondaryText.y = centerY + 2;
    detailText.x = centerX;
    detailText.y = centerY + 38;
    barBounds.width = Math.min(160, width * 0.6);
    barBounds.height = 6;
    barBounds.x = centerX - barBounds.width / 2;
    barBounds.y = centerY + 22;
    barBackground.clear();
    barBackground.beginFill(0xd9d9d9, 1);
    barBackground.drawRect(barBounds.x, barBounds.y, barBounds.width, barBounds.height);
    barBackground.endFill();
    skipText.x = right - 16;
    skipText.y = bottom - 12;
    updateBar();
  };

  updateTargetProgress();
  updateLayout(getLayoutBounds());
  const unsubscribeLayout = registerLayoutSubscriber(updateLayout);

  const tickerUpdate = () => {
    const deltaSeconds = app.ticker.deltaMS / 1000;
    if (!fadingOut) {
      fadeInTime += deltaSeconds;
      container.alpha = clamp(fadeInTime / fadeInDuration, 0, 1);
    } else {
      fadeOutTime += deltaSeconds;
      container.alpha = clamp(1 - fadeOutTime / fadeOutDuration, 0, 1);
      if (fadeOutTime >= fadeOutDuration && resolveFadeOut) {
        const resolve = resolveFadeOut;
        resolveFadeOut = null;
        app.ticker.remove(tickerUpdate);
        container.removeFromParent();
        unsubscribeLayout();
        container.destroy({ children: true });
        resolve();
        return;
      }
    }

    dotsTimer += deltaSeconds;
    if (dotsTimer >= 0.45) {
      dotsTimer = 0;
      dotsCount = (dotsCount % 3) + 1;
      loadingText.text = `Loading${".".repeat(dotsCount)}`;
    }

    secondaryTimer += deltaSeconds;
    if (secondaryTimer >= 3.2) {
      secondaryTimer = 0;
      secondaryIndex = (secondaryIndex + 1) % secondaryMessages.length;
      secondaryText.text = secondaryMessages[secondaryIndex];
    }

    if (!skipVisible) {
      skipTimer += deltaSeconds;
      if (skipTimer >= 4) {
        skipVisible = true;
        skipText.visible = true;
      }
    }

    currentProgress += (targetProgress - currentProgress) * 0.12;
    currentProgress = clamp(currentProgress, 0, 1);
    updateBar();
  };

  app.ticker.add(tickerUpdate);

  const handleSkip = () => {
    if (skipRequested || !skipVisible) {
      return;
    }
    skipRequested = true;
    if (typeof onSkip === "function") {
      onSkip();
    }
  };

  skipText.on("pointerdown", handleSkip);

  return {
    setAssetProgress: (progress) => {
      assetProgress = clamp(progress, 0, 1);
      updateTargetProgress();
    },
    setAudioProgress: (progress) => {
      audioProgress = clamp(progress, 0, 1);
      updateTargetProgress();
    },
    setSecondaryIndex: (index) => {
      secondaryIndex = clamp(index, 0, secondaryMessages.length - 1);
      secondaryText.text = secondaryMessages[secondaryIndex];
      secondaryTimer = 0;
    },
    setDetailText: (text) => {
      detailText.text = text ? String(text) : "";
    },
    setSkipHandler: (handler) => {
      onSkip = handler;
    },
    fadeOut: () => {
      if (fadingOut) {
        return Promise.resolve();
      }
      fadingOut = true;
      fadeOutTime = 0;
      return new Promise((resolve) => {
        resolveFadeOut = resolve;
      });
    },
  };
};
