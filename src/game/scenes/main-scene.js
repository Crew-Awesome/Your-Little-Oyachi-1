import { GAME_H, GAME_W, GAME_WIDTH } from "../config/constants.js";
import { audioStorageKeys, hintStorageKeys } from "../config/storage.js";
import {
  happyJumpTiming,
  idleBehavior,
  idleBobTiming,
  jumpMicroTiming,
  petHoldTiming,
  petSpamTiming,
  sleepTiming,
  wakeTiming,
} from "../config/timings.js";
import { registerAppListener } from "../core/events.js";
import { getApp } from "../core/app.js";
import { getLayoutBounds, registerLayoutSubscriber } from "../core/layout.js";
import { audioSystem } from "../systems/audio-system.js";
import { clamp, easeInCubic, easeOutCubic } from "../utils/math.js";
import { getPointerId } from "../utils/pointer.js";
import { createPixelText } from "../utils/text.js";
import { getSafeDimension, getTextureDimension } from "../utils/texture.js";

const safeLayoutCall = (handler, layout) => {
  try {
    handler(layout);
  } catch (error) {
    console.error("Layout update failed.", error);
  }
};

const loadHintPreferences = () => {
  const storedSeen = localStorage.getItem(hintStorageKeys.seen);
  const storedEnabled = localStorage.getItem(hintStorageKeys.enabled);
  const seen = storedSeen === "true";
  const enabled = storedEnabled !== null ? storedEnabled !== "false" : !seen;
  return { seen, enabled };
};

const state = {
  current: "idle",
  timer: 0,
  idleTimer: 0,
  blinkTimer: 0,
  moveTimer: 0,
  moveDirection: 1,
  petTimer: 0,
  petDuration: 0,
  inactiveTime: 0,
  tiredTimer: 0,
  sneezeTimer: 0,
  sleepFrame: 0,
  sleepFrameTimer: 0,
  wakeTimer: 0,
  reactTimer: 0,
  moveTargetX: null,
  cuteHeartTimer: 0,
  reactSquishTimer: 0,
  depth: 0.6,
  depthTarget: 0.6,
  depthTimer: 0,
  happyJumpSequence: null,
  happyJumpLandingSquish: 0,
};



const initGame = ({ textures, gameRoot }) => {
  const app = getApp();
  if (!app) {
    throw new Error("Pixi app not initialized.");
  }
  const rootElement = gameRoot;
  Object.values(textures).forEach((texture) => {
    if (texture?.baseTexture) {
      texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
    }
  });
  const stage = app.stage;
  stage.eventMode = "static";
  stage.sortableChildren = true;

  const room = new PIXI.Container();
  const wall = new PIXI.Graphics();
  const floor = new PIXI.Graphics();
  const floorMat = new PIXI.Graphics();
  const seam = new PIXI.Graphics();
  room.addChild(wall, floor, floorMat, seam);
  room.zIndex = 0;
  stage.addChild(room);

  const shadow = new PIXI.Graphics();
  shadow.alpha = 0.25;
  shadow.zIndex = 1;
  stage.addChild(shadow);

  const ballShadow = new PIXI.Graphics();
  ballShadow.alpha = 0.25;
  ballShadow.zIndex = 1.4;
  stage.addChild(ballShadow);

  const ballSprite = new PIXI.Sprite(textures.ball);
  ballSprite.anchor.set(0.5, 1);
  ballSprite.visible = false;
  ballSprite.eventMode = "static";
  ballSprite.cursor = "pointer";
  ballSprite.zIndex = 2.4;
  stage.addChild(ballSprite);

  const oyachi = new PIXI.Container();
  const oyachiVisual = new PIXI.Container();
  oyachi.zIndex = 2;
  const idleSprite = new PIXI.Sprite(textures.idle);
  const blinkSprite = new PIXI.Sprite(textures.blink);
  const petSprite = new PIXI.Sprite(textures.pet);
  const holdBallSprite = new PIXI.Sprite(textures.hold_ball);
  const tiredSprite = new PIXI.Sprite(textures.idle_tired);
  const sneezeSprite = new PIXI.Sprite(textures.idle_sneeze);
  const sleepSprite1 = new PIXI.Sprite(textures.sleep_1);
  const sleepSprite2 = new PIXI.Sprite(textures.sleep_2);
  const reactCuteSprite = new PIXI.Sprite(textures.react_cute);
  const reactAyoSprite = new PIXI.Sprite(textures.react_ayo);
  const baseSpriteScaleDefault = 0.6;
  let baseSpriteScale = baseSpriteScaleDefault;
  const baseSpriteSize = {
    width: idleSprite.texture.width,
    height: idleSprite.texture.height,
  };
  const oyachiHitArea = new PIXI.Rectangle(
    -baseSpriteSize.width * baseSpriteScale * 0.5,
    -baseSpriteSize.height * baseSpriteScale,
    baseSpriteSize.width * baseSpriteScale,
    baseSpriteSize.height * baseSpriteScale,
  );
  oyachi.hitArea = oyachiHitArea;
  oyachi.eventMode = "static";
  oyachi.cursor = "pointer";

  const oyachiSprites = [
    { sprite: idleSprite, name: "idle" },
    { sprite: blinkSprite, name: "blink" },
    { sprite: petSprite, name: "pet" },
    { sprite: holdBallSprite, name: "hold_ball" },
    { sprite: tiredSprite, name: "idle_tired" },
    { sprite: sneezeSprite, name: "idle_sneeze" },
    { sprite: sleepSprite1, name: "sleep_1" },
    { sprite: sleepSprite2, name: "sleep_2" },
    { sprite: reactCuteSprite, name: "react_cute" },
    { sprite: reactAyoSprite, name: "react_ayo" },
  ];

  const applySpriteAnchor = (sprite, name) => {
    sprite.anchor.set(0.5, 1);
    sprite.scale.set(baseSpriteScale);
    sprite.eventMode = "none";
    if (
      Math.abs(sprite.texture.width - baseSpriteSize.width) > 2 ||
      Math.abs(sprite.texture.height - baseSpriteSize.height) > 2
    ) {
      console.warn(
        `Oyachi sprite size mismatch for ${name}:`,
        sprite.texture.width,
        sprite.texture.height,
      );
    }
  };

  oyachiSprites.forEach(({ sprite, name }) => {
    applySpriteAnchor(sprite, name);
  });

  blinkSprite.visible = false;
  petSprite.visible = false;
  holdBallSprite.visible = false;
  tiredSprite.visible = false;
  sneezeSprite.visible = false;
  sleepSprite1.visible = false;
  sleepSprite2.visible = false;
  reactCuteSprite.visible = false;
  reactAyoSprite.visible = false;

  oyachiVisual.addChild(
    idleSprite,
    blinkSprite,
    petSprite,
    holdBallSprite,
    tiredSprite,
    sneezeSprite,
    sleepSprite1,
    sleepSprite2,
    reactCuteSprite,
    reactAyoSprite
  );
  oyachi.addChild(oyachiVisual);
  stage.addChild(oyachi);

  const heartLayer = new PIXI.Container();
  heartLayer.zIndex = 20;
  stage.addChild(heartLayer);

  const uiLayer = new PIXI.Container();
  uiLayer.zIndex = 40;
  stage.addChild(uiLayer);

  const nowPlayingText = createPixelText("", {
    fontSize: 12,
    fill: 0x111111,
    align: "left",
  });
  nowPlayingText.anchor.set(0, 1);
  nowPlayingText.x = 16;
  nowPlayingText.y = GAME_H - 14;
  nowPlayingText.alpha = 0;
  nowPlayingText.eventMode = "none";
  uiLayer.addChild(nowPlayingText);

  const hintPreferences = loadHintPreferences();
  let hintsSeen = hintPreferences.seen;
  let hintsEnabled = hintPreferences.enabled;

  const hintOverlay = new PIXI.Container();
  hintOverlay.zIndex = 45;
  hintOverlay.alpha = 0;
  hintOverlay.visible = false;
  hintOverlay.eventMode = "passive";
  const hintBackground = new PIXI.Graphics();
  const hintText = createPixelText("", {
    fontSize: 12,
    fill: 0x111111,
    align: "center",
  });
  hintText.anchor.set(0.5);
  hintText.roundPixels = true;
  hintText.eventMode = "none";

  const hintClose = new PIXI.Container();
  hintClose.eventMode = "static";
  hintClose.cursor = "pointer";
  const hintCloseBg = new PIXI.Graphics();
  const hintCloseIcon = new PIXI.Graphics();
  hintClose.addChild(hintCloseBg, hintCloseIcon);

  hintOverlay.addChild(hintBackground, hintText, hintClose);
  uiLayer.addChild(hintOverlay);

  const hintConfirm = new PIXI.Container();
  hintConfirm.visible = false;
  hintConfirm.eventMode = "passive";
  const hintConfirmBg = new PIXI.Graphics();
  const hintConfirmText = createPixelText("Hide hints?", {
    fontSize: 12,
    fill: 0x111111,
    align: "center",
  });
  hintConfirmText.anchor.set(0.5);

  const createConfirmButton = (label) => {
    const container = new PIXI.Container();
    container.eventMode = "static";
    container.cursor = "pointer";
    const bg = new PIXI.Graphics();
    const text = createPixelText(label, {
      fontSize: 11,
      fill: 0x111111,
      align: "center",
    });
    text.anchor.set(0.5);
    container.addChild(bg, text);
    return { container, bg, text };
  };

  const hintConfirmYes = createConfirmButton("Yes");
  const hintConfirmNo = createConfirmButton("No");
  hintConfirm.addChild(hintConfirmBg, hintConfirmText, hintConfirmYes.container, hintConfirmNo.container);
  uiLayer.addChild(hintConfirm);

  const nowPlayingState = {
    phase: "hidden",
    timer: 0,
  };
  const nowPlayingTiming = {
    fadeIn: 0.4,
    hold: 2.4,
    fadeOut: 0.6,
  };
  const hintTiming = {
    fadeIn: 0.5,
    hold: 2.4,
    fadeOut: 0.6,
    gapMin: 3.5,
    gapMax: 6.5,
  };
  const hintAlpha = 0.85;

  const showNowPlaying = (title) => {
    nowPlayingText.text = `Now playing: ${title}`;
    nowPlayingText.alpha = 0;
    nowPlayingState.phase = "fadein";
    nowPlayingState.timer = 0;
  };

  const hintConfig = {
    pet: { text: "Tap Oyachi to pet", cooldownMs: 20000, chance: 0.75 },
    hold: { text: "Keep holding to pet", cooldownMs: 24000, chance: 0.6 },
    spam: { text: "Quick pets make a tiny sparkle", cooldownMs: 26000, chance: 0.55 },
    toys: { text: "Tap toys to give Oyachi something to play with", cooldownMs: 26000, chance: 0.65 },
    costumes: { text: "Tap costumes to dress Oyachi", cooldownMs: 30000, chance: 0.6 },
    fullscreen: { text: "Tap fullscreen for a bigger view", cooldownMs: 32000, chance: 0.55 },
    settings: { text: "Settings are in the corner", cooldownMs: 32000, chance: 0.55 },
  };

  const hintState = {
    phase: "hidden",
    timer: 0,
    queue: [],
    lastShown: new Map(),
    nextAllowedAt: 0,
    pendingDelayUntil: 0,
  };
  let hintToggleRow = null;

  const setHintsEnabled = (enabled, { persist = true } = {}) => {
    hintsEnabled = Boolean(enabled);
    if (persist) {
      localStorage.setItem(hintStorageKeys.enabled, String(hintsEnabled));
    }
    if (hintToggleRow) {
      hintToggleRow.enabled = hintsEnabled;
      if (hintToggleRow.applyLayout && hintToggleRow.lastLayout) {
        hintToggleRow.applyLayout(hintToggleRow.lastLayout, {
          x: hintToggleRow.container.x,
          y: hintToggleRow.container.y,
        });
      }
    }
    if (!hintsEnabled) {
      hintState.phase = "hidden";
      hintState.timer = 0;
      hintState.queue = [];
      hintOverlay.alpha = 0;
      hintOverlay.visible = false;
      hintConfirm.visible = false;
    } else {
      hintOverlay.visible = true;
      hintState.phase = "hidden";
      hintState.timer = 0;
      hintState.pendingDelayUntil = performance.now() + 300;
      hintState.nextAllowedAt = performance.now() + 600;
    }
  };

  const markHintsSeen = () => {
    if (hintsSeen) {
      return;
    }
    hintsSeen = true;
    localStorage.setItem(hintStorageKeys.seen, "true");
  };

  const scheduleHintGap = (now) => {
    hintState.nextAllowedAt =
      now + (hintTiming.gapMin + Math.random() * (hintTiming.gapMax - hintTiming.gapMin)) * 1000;
  };

  const enqueueHint = (id, { priority = false, delayMs = 0 } = {}) => {
    if (!hintsEnabled) {
      return;
    }
    if (!hintConfig[id]) {
      return;
    }
    if (hintState.queue.includes(id)) {
      return;
    }
    if (priority) {
      hintState.queue.unshift(id);
    } else {
      hintState.queue.push(id);
    }
    if (delayMs > 0) {
      hintState.pendingDelayUntil = Math.max(
        hintState.pendingDelayUntil,
        performance.now() + delayMs,
      );
    }
  };

  const tryShowHint = (id, { force = false } = {}) => {
    if (!hintsEnabled) {
      return false;
    }
    const config = hintConfig[id];
    if (!config) {
      return false;
    }
    const now = performance.now();
    if (hintState.phase !== "hidden") {
      return false;
    }
    if (!force) {
      if (now < hintState.nextAllowedAt) {
        return false;
      }
      const lastShown = hintState.lastShown.get(id) ?? 0;
      if (now - lastShown < config.cooldownMs) {
        return false;
      }
      if (Math.random() > config.chance) {
        return false;
      }
    }
    hintText.text = config.text;
    hintOverlay.alpha = 0;
    hintOverlay.visible = true;
    hintState.phase = "fadein";
    hintState.timer = 0;
    hintState.lastShown.set(id, now);
    scheduleHintGap(now);
    return true;
  };

  const seedHints = () => {
    enqueueHint("pet", { priority: true, delayMs: 1200 });
    enqueueHint("toys");
    enqueueHint("fullscreen");
    enqueueHint("settings");
    enqueueHint("costumes");
  };

  const showHintConfirm = () => {
    if (!hintsEnabled) {
      return;
    }
    hintOverlay.alpha = hintAlpha;
    hintOverlay.visible = true;
    hintConfirm.visible = true;
  };

  const hideHintConfirm = () => {
    hintConfirm.visible = false;
  };

  hintClose.on("pointerdown", (event) => {
    event.stopPropagation();
    showHintConfirm();
  });

  hintConfirmYes.container.on("pointerdown", (event) => {
    event.stopPropagation();
    setHintsEnabled(false);
    hideHintConfirm();
  });

  hintConfirmNo.container.on("pointerdown", (event) => {
    event.stopPropagation();
    hideHintConfirm();
  });

  setHintsEnabled(hintsEnabled, { persist: false });

  audioSystem.setNowPlayingHandler(showNowPlaying);

  const optionsLayer = new PIXI.Container();
  optionsLayer.zIndex = 50;
  stage.addChild(optionsLayer);

  let gameStarted = false;
  let toysPanelOpen = false;
  let closetOpen = false;

  const createIconButton = ({ texture, defaultAlpha = 0.22 }) => {
    const container = new PIXI.Container();
    const icon = new PIXI.Sprite(texture);
    icon.anchor.set(0.5);
    icon.roundPixels = true;
    container.roundPixels = true;
    container.addChild(icon);
    container.eventMode = "static";
    container.cursor = "pointer";
    container.alpha = defaultAlpha;
    return { container, icon, defaultAlpha };
  };

  const getIconHalfSize = (icon) => {
    const width = getSafeDimension(icon?.width, 1);
    const height = getSafeDimension(icon?.height, 1);
    return { width: width / 2, height: height / 2 };
  };

  const updateIconHitArea = (button) => {
    if (!button?.icon || !button?.container) {
      return { width: 0, height: 0 };
    }
    const { width, height } = getIconHalfSize(button.icon);
    const fullWidth = width * 2;
    const fullHeight = height * 2;
    button.container.hitArea = new PIXI.Rectangle(
      -width,
      -height,
      fullWidth,
      fullHeight,
    );
    return { width: fullWidth, height: fullHeight };
  };

  const settingsButton = createIconButton({
    texture: textures.ui_settings,
    defaultAlpha: 0.18,
  });
  optionsLayer.addChild(settingsButton.container);

  const fullscreenButton = createIconButton({
    texture: textures.ui_fullscreen_enter,
    defaultAlpha: 0.22,
  });
  uiLayer.addChild(fullscreenButton.container);

  const fullscreenState = {
    active: false,
    hovering: false,
  };

  const updateFullscreenState = () => {
    fullscreenState.active = Boolean(document.fullscreenElement);
    fullscreenButton.icon.texture = fullscreenState.active
      ? textures.ui_fullscreen_exit
      : textures.ui_fullscreen_enter;
    if (!fullscreenState.hovering) {
      fullscreenButton.container.alpha = fullscreenState.active ? 0.3 : 0.22;
    }
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch((error) => {
        console.error("Exit fullscreen failed.", error);
      });
      return;
    }
    if (!rootElement?.requestFullscreen) {
      return;
    }
    rootElement.requestFullscreen?.().catch((error) => {
      console.error("Enter fullscreen failed.", error);
    });
  };

  updateFullscreenState();

  fullscreenButton.container.on("pointerdown", (event) => {
    toggleFullscreen();
    event.stopPropagation();
  });
  fullscreenButton.container.on("pointerenter", () => {
    fullscreenState.hovering = true;
    fullscreenButton.container.alpha = 0.32;
  });
  fullscreenButton.container.on("pointerleave", () => {
    fullscreenState.hovering = false;
    fullscreenButton.container.alpha = fullscreenState.active ? 0.3 : 0.22;
  });

  registerAppListener(app, document, "fullscreenchange", updateFullscreenState);

  const optionsMenu = new PIXI.Container();
  optionsMenu.visible = false;
  optionsMenu.eventMode = "static";
  optionsMenu.x = GAME_W - 194;
  optionsMenu.y = 46;
  optionsLayer.addChild(optionsMenu);

  const menuLayout = {
    width: 240,
    height: 160,
    radius: 8,
    paddingX: 18,
    paddingTop: 20,
    sliderGap: 44,
  };

  const menuBackground = new PIXI.Graphics();
  menuBackground.beginFill(0xf0f0f0, 0.9);
  menuBackground.drawRoundedRect(0, 0, menuLayout.width, menuLayout.height, menuLayout.radius);
  menuBackground.endFill();
  optionsMenu.addChild(menuBackground);

  const toyPanelLayout = {
    width: 156,
    height: 100,
    radius: 10,
    iconX: 22,
    labelX: 42,
    fontSize: 12,
    rowHeight: 34,
    rowGap: 8,
    paddingY: 12,
  };

  const sliderConfig = {
    width: 140,
    height: 6,
    knobRadius: 8,
    trackX: 80,
    trackY: 9,
    hitWidth: 260,
    hitHeight: 32,
    labelFontSize: 14,
    labelWidth: 60,
    toggleSize: 16,
    toggleGap: 14,
  };

  const sliderState = {
    active: null,
    pointerId: null,
  };

  const createSlider = ({ label, y, value, enabled, onChange, onToggle }) => {
    const container = new PIXI.Container();
    container.x = menuLayout.paddingX;
    container.y = y;
    container.eventMode = "static";
    container.hitArea = new PIXI.Rectangle(0, 0, sliderConfig.hitWidth, sliderConfig.hitHeight);

    const labelText = createPixelText(label, {
      fontSize: sliderConfig.labelFontSize,
      fill: 0x111111,
    });
    labelText.alpha = 0.55;
    labelText.x = 0;
    labelText.y = 0;
    labelText.width = sliderConfig.labelWidth;
    container.addChild(labelText);

    const track = new PIXI.Graphics();
    track.beginFill(0x111111, 0.2);
    track.drawRoundedRect(0, 0, sliderConfig.width, sliderConfig.height, 2);
    track.endFill();
    track.x = sliderConfig.trackX;
    track.y = sliderConfig.trackY;
    container.addChild(track);

    const knob = new PIXI.Graphics();
    knob.beginFill(0x111111, 0.7);
    knob.drawCircle(0, 0, sliderConfig.knobRadius);
    knob.endFill();
    knob.y = track.y + sliderConfig.height / 2;
    container.addChild(knob);

    const toggle = new PIXI.Container();
    toggle.eventMode = "static";
    toggle.cursor = "pointer";
    const toggleIcon = new PIXI.Sprite(textures.ui_check);
    toggleIcon.anchor.set(0.5);
    toggleIcon.roundPixels = true;
    toggle.addChild(toggleIcon);
    container.addChild(toggle);

    const sliderData = {
      container,
      labelText,
      track,
      knob,
      toggle,
      toggleIcon,
      trackX: track.x,
      trackWidth: sliderConfig.width,
      value,
      onChange,
      enabled,
      onToggle,
      lastLayout: null,
      updateFromGlobal: null,
      applyLayout: null,
    };

    const updateKnob = (newValue, { notify = false } = {}) => {
      sliderData.value = clamp(newValue, 0, 1);
      knob.x = sliderData.trackX + sliderData.trackWidth * sliderData.value;
      if (notify && typeof sliderData.onChange === "function") {
        sliderData.onChange(sliderData.value);
      }
    };

    const updateFromGlobal = (global) => {
      const local = container.toLocal(global);
      const raw = (local.x - sliderData.trackX) / sliderData.trackWidth;
      updateKnob(raw, { notify: true });
    };

    sliderData.updateFromGlobal = updateFromGlobal;

    const applyLayout = (layout, position) => {
      sliderData.lastLayout = layout;
      container.x = position.x;
      container.y = position.y;
      container.hitArea = new PIXI.Rectangle(0, 0, layout.hitWidth, layout.hitHeight);
      labelText.style.fontSize = layout.labelFontSize;
      labelText.width = layout.labelWidth;
      track.clear();
      track.beginFill(0x111111, 0.2);
      track.drawRoundedRect(0, 0, layout.width, layout.height, 2);
      track.endFill();
      track.x = layout.trackX;
      track.y = layout.trackY;
      knob.clear();
      knob.beginFill(0x111111, 0.7);
      knob.drawCircle(0, 0, layout.knobRadius);
      knob.endFill();
      knob.y = track.y + layout.height / 2;
      sliderData.trackX = track.x;
      sliderData.trackWidth = layout.width;
      toggle.x = layout.trackX + layout.width + layout.toggleGap;
      toggle.y = Math.round(layout.trackY - layout.toggleSize / 2 + layout.height / 2);
      toggle.hitArea = new PIXI.Rectangle(0, 0, layout.toggleSize, layout.toggleSize);
      toggleIcon.scale.set(
        layout.toggleSize /
          getTextureDimension(toggleIcon.texture, "width", layout.toggleSize),
      );
      toggleIcon.alpha = sliderData.enabled ? 0.75 : 0.18;
      toggleIcon.x = layout.toggleSize / 2;
      toggleIcon.y = layout.toggleSize / 2;
      updateKnob(sliderData.value);
    };

    sliderData.applyLayout = applyLayout;

    const handlePointerDown = (event) => {
      if (!sliderData.enabled) {
        event.stopPropagation();
        return;
      }
      sliderState.active = sliderData;
      sliderState.pointerId = getPointerId(event);
      updateFromGlobal(event.data.global);
      event.stopPropagation();
    };

    container.on("pointerdown", handlePointerDown);
    toggle.on("pointerdown", (event) => {
      sliderData.enabled = !sliderData.enabled;
      if (typeof sliderData.onToggle === "function") {
        sliderData.onToggle(sliderData.enabled);
      }
      if (typeof sliderData.syncWithAudio === "function") {
        sliderData.syncWithAudio();
      }
      if (sliderData.applyLayout && sliderData.lastLayout) {
        sliderData.applyLayout(sliderData.lastLayout, { x: container.x, y: container.y });
      }
      event.stopPropagation();
    });

    updateKnob(value);

    return sliderData;
  };

  const createToggleRow = ({ label, y, enabled, onToggle }) => {
    const container = new PIXI.Container();
    container.x = menuLayout.paddingX;
    container.y = y;
    container.eventMode = "static";
    container.hitArea = new PIXI.Rectangle(0, 0, sliderConfig.hitWidth, sliderConfig.hitHeight);

    const labelText = createPixelText(label, {
      fontSize: sliderConfig.labelFontSize,
      fill: 0x111111,
    });
    labelText.alpha = 0.55;
    labelText.x = 0;
    labelText.y = 0;
    container.addChild(labelText);

    const toggle = new PIXI.Container();
    toggle.eventMode = "static";
    toggle.cursor = "pointer";
    const toggleIcon = new PIXI.Sprite(textures.ui_check);
    toggleIcon.anchor.set(0.5);
    toggleIcon.roundPixels = true;
    toggle.addChild(toggleIcon);
    container.addChild(toggle);

    const rowData = {
      container,
      labelText,
      toggle,
      toggleIcon,
      enabled,
      onToggle,
      lastLayout: null,
      applyLayout: null,
    };

    const applyLayout = (layout, position) => {
      rowData.lastLayout = layout;
      container.x = position.x;
      container.y = position.y;
      container.hitArea = new PIXI.Rectangle(0, 0, layout.hitWidth, layout.hitHeight);
      labelText.style.fontSize = layout.labelFontSize;
      toggle.x = layout.rowWidth - layout.toggleSize;
      toggle.y = Math.round(layout.hitHeight / 2 - layout.toggleSize / 2);
      toggle.hitArea = new PIXI.Rectangle(0, 0, layout.toggleSize, layout.toggleSize);
      toggleIcon.scale.set(
        layout.toggleSize /
          getTextureDimension(toggleIcon.texture, "width", layout.toggleSize),
      );
      toggleIcon.alpha = rowData.enabled ? 0.75 : 0.18;
      toggleIcon.x = layout.toggleSize / 2;
      toggleIcon.y = layout.toggleSize / 2;
    };

    rowData.applyLayout = applyLayout;

    toggle.on("pointerdown", (event) => {
      rowData.enabled = !rowData.enabled;
      if (typeof rowData.onToggle === "function") {
        rowData.onToggle(rowData.enabled);
      }
      if (rowData.applyLayout && rowData.lastLayout) {
        rowData.applyLayout(rowData.lastLayout, { x: container.x, y: container.y });
      }
      event.stopPropagation();
    });

    return rowData;
  };

  const saveMusicVolume = (value) => {
    audioSystem.setMusicVolume(value);
    localStorage.setItem(audioStorageKeys.musicVolume, value.toFixed(3));
  };

  const saveSfxVolume = (value) => {
    audioSystem.setSfxVolume(value);
    localStorage.setItem(audioStorageKeys.sfxVolume, value.toFixed(3));
  };

  const saveMusicEnabled = (enabled) => {
    audioSystem.setMusicEnabled(enabled);
    localStorage.setItem(audioStorageKeys.musicEnabled, String(enabled));
  };

  const saveSfxEnabled = (enabled) => {
    audioSystem.setSfxEnabled(enabled);
    localStorage.setItem(audioStorageKeys.sfxEnabled, String(enabled));
  };

  const saveHintsEnabled = (enabled) => {
    setHintsEnabled(enabled);
    if (enabled) {
      seedHints();
    }
  };

  const syncSliderToAudio = (slider, getVolume, getEnabled) => {
    slider.enabled = getEnabled();
    slider.value = slider.enabled ? getVolume() : 0;
    slider.knob.x = slider.trackX + slider.trackWidth * slider.value;
    slider.toggleIcon.alpha = slider.enabled ? 0.75 : 0.18;
  };

  const musicSlider = createSlider({
    label: "Music",
    y: menuLayout.paddingTop,
    value: audioSystem.getMusicEnabled() ? audioSystem.getMusicVolume() : 0,
    enabled: audioSystem.getMusicEnabled(),
    onChange: saveMusicVolume,
    onToggle: saveMusicEnabled,
  });
  musicSlider.syncWithAudio = () => {
    syncSliderToAudio(musicSlider, audioSystem.getMusicVolume, audioSystem.getMusicEnabled);
  };
  const sfxSlider = createSlider({
    label: "SFX",
    y: menuLayout.paddingTop + menuLayout.sliderGap,
    value: audioSystem.getSfxEnabled() ? audioSystem.getSfxVolume() : 0,
    enabled: audioSystem.getSfxEnabled(),
    onChange: saveSfxVolume,
    onToggle: saveSfxEnabled,
  });
  sfxSlider.syncWithAudio = () => {
    syncSliderToAudio(sfxSlider, audioSystem.getSfxVolume, audioSystem.getSfxEnabled);
  };
  hintToggleRow = createToggleRow({
    label: "Show Hints",
    y: menuLayout.paddingTop + menuLayout.sliderGap * 2,
    enabled: hintsEnabled,
    onToggle: saveHintsEnabled,
  });
  optionsMenu.addChild(musicSlider.container, sfxSlider.container, hintToggleRow.container);

  const sliders = [musicSlider, sfxSlider];
  const settingsState = {
    hovering: false,
  };

  const toysButton = createIconButton({
    texture: textures.ui_toys,
    defaultAlpha: 0.22,
  });
  const clothesButton = createIconButton({
    texture: textures.ui_costumes,
    defaultAlpha: 0.22,
  });
  uiLayer.addChild(toysButton.container, clothesButton.container);

  const toysPanel = new PIXI.Container();
  toysPanel.visible = false;
  toysPanel.eventMode = "static";
  uiLayer.addChild(toysPanel);

  const toysPanelBackground = new PIXI.Graphics();
  toysPanel.addChild(toysPanelBackground);

  const ballOption = new PIXI.Container();
  ballOption.eventMode = "static";
  ballOption.cursor = "pointer";
  const ballOptionHighlight = new PIXI.Graphics();
  const ballOptionIcon = new PIXI.Sprite(textures.ball);
  ballOptionIcon.anchor.set(0.5);
  ballOptionIcon.roundPixels = true;
  const ballOptionLabel = createPixelText("Ball", {
    fontSize: 12,
    fill: 0x111111,
  });
  ballOptionLabel.anchor.set(0, 0.5);
  ballOption.addChild(ballOptionHighlight, ballOptionIcon, ballOptionLabel);
  toysPanel.addChild(ballOption);

  const noToyOption = new PIXI.Container();
  noToyOption.eventMode = "static";
  noToyOption.cursor = "pointer";
  const noToyOptionHighlight = new PIXI.Graphics();
  const noToyOptionIcon = new PIXI.Sprite(textures.ui_check);
  noToyOptionIcon.anchor.set(0.5);
  noToyOptionIcon.roundPixels = true;
  noToyOptionIcon.alpha = 0.35;
  const noToyOptionLabel = createPixelText("No toy", {
    fontSize: 12,
    fill: 0x111111,
  });
  noToyOptionLabel.anchor.set(0, 0.5);
  noToyOption.addChild(noToyOptionHighlight, noToyOptionIcon, noToyOptionLabel);
  toysPanel.addChild(noToyOption);

  let selectedToy = "ball";
  const updateToySelection = () => {
    ballOptionHighlight.clear();
    noToyOptionHighlight.clear();
    if (selectedToy === "ball") {
      ballOptionHighlight.beginFill(0x111111, 0.08);
      ballOptionHighlight.drawRoundedRect(
        0,
        0,
        toyPanelLayout.width,
        toyPanelLayout.rowHeight,
        toyPanelLayout.rowHeight / 2,
      );
      ballOptionHighlight.endFill();
    }
    if (selectedToy === "none") {
      noToyOptionHighlight.beginFill(0x111111, 0.08);
      noToyOptionHighlight.drawRoundedRect(
        0,
        0,
        toyPanelLayout.width,
        toyPanelLayout.rowHeight,
        toyPanelLayout.rowHeight / 2,
      );
      noToyOptionHighlight.endFill();
    }
  };
  updateToySelection();

  const uiScaleState = {
    compact: false,
    scale: 1,
    iconScale: 1,
    bottomIconScale: 1,
    bottomIconSpacing: 0,
    menuBoost: 1,
    menuWidth: menuLayout.width,
    toyPanelWidth: 0,
    toyPanelHeight: 0,
  };

  const getUiScale = (layout) => {
    const compact =
      layout.containerWidth <= 720 || layout.containerHeight <= 520;
    const baseScale = compact ? 0.92 : 1;
    const scale = clamp(baseScale, 0.85, 1);
    const menuBoost = compact ? 1.05 : 1.1;
    return { compact, scale, menuBoost };
  };

  const applyUiScale = (layout) => {
    const nextScale = getUiScale(layout);
    if (
      nextScale.compact === uiScaleState.compact &&
      nextScale.scale === uiScaleState.scale &&
      nextScale.menuBoost === uiScaleState.menuBoost
    ) {
      return;
    }
    uiScaleState.compact = nextScale.compact;
    uiScaleState.scale = nextScale.scale;
    uiScaleState.menuBoost = nextScale.menuBoost;

    const iconScale = clamp(uiScaleState.scale * 0.78, 0.55, 0.85);
    uiScaleState.iconScale = iconScale;
    settingsButton.icon.scale.set(iconScale);
    fullscreenButton.icon.scale.set(iconScale);

    const layoutWidth = getSafeDimension(layout.width, GAME_WIDTH);
    const marginScale = uiScaleState.compact ? 1.1 : 1;
    const spacingBase = 18 * marginScale;
    const minSpacing = 14 * marginScale;
    const maxSpacing = 26 * marginScale;
    const bottomSpacing = clamp(spacingBase, minSpacing, maxSpacing);
    const bottomBaseWidth =
      getTextureDimension(toysButton.icon.texture, "width") +
      getTextureDimension(clothesButton.icon.texture, "width");
    const availableWidth = Math.max(1, layoutWidth - 24 * marginScale);
    const maxFitScale = Math.max(
      0.35,
      (availableWidth - bottomSpacing) / Math.max(1, bottomBaseWidth),
    );
    const bottomScale = clamp(
      Math.min(uiScaleState.scale * 0.7, maxFitScale),
      0.4,
      0.78,
    );
    uiScaleState.bottomIconScale = bottomScale;
    uiScaleState.bottomIconSpacing = bottomSpacing;
    toysButton.icon.scale.set(bottomScale);
    clothesButton.icon.scale.set(bottomScale);

    updateIconHitArea(settingsButton);
    updateIconHitArea(fullscreenButton);
    updateIconHitArea(toysButton);
    updateIconHitArea(clothesButton);

    const panelWidth = menuLayout.width * uiScaleState.menuBoost;
    const panelHeight = menuLayout.height * uiScaleState.menuBoost;
    const panelRadius = menuLayout.radius * uiScaleState.menuBoost;
    const paddingX = menuLayout.paddingX * uiScaleState.menuBoost;
    const paddingTop = menuLayout.paddingTop * uiScaleState.menuBoost;
    const sliderGap = menuLayout.sliderGap * uiScaleState.menuBoost;
    const sliderAreaWidth = Math.max(1, panelWidth - paddingX * 2);
    const sliderTrackX = sliderConfig.trackX * uiScaleState.menuBoost;
    const sliderToggleGap = sliderConfig.toggleGap * uiScaleState.menuBoost;
    const sliderToggleSize = sliderConfig.toggleSize * uiScaleState.menuBoost;
    const sliderMaxWidth = Math.max(
      80 * uiScaleState.menuBoost,
      sliderAreaWidth - sliderTrackX - sliderToggleGap - sliderToggleSize - 4,
    );
    const sliderTrackWidth = clamp(
      sliderConfig.width * uiScaleState.menuBoost,
      60 * uiScaleState.menuBoost,
      sliderMaxWidth,
    );

    menuBackground.clear();
    menuBackground.beginFill(0xf0f0f0, 0.9);
    menuBackground.drawRoundedRect(0, 0, panelWidth, panelHeight, panelRadius);
    menuBackground.endFill();

    uiScaleState.menuWidth = panelWidth;

    const sliderLayout = {
      width: sliderTrackWidth,
      height: sliderConfig.height * uiScaleState.menuBoost,
      knobRadius: sliderConfig.knobRadius * uiScaleState.menuBoost,
      trackX: sliderTrackX,
      trackY: sliderConfig.trackY * uiScaleState.menuBoost,
      hitWidth: Math.min(sliderConfig.hitWidth * uiScaleState.menuBoost, sliderAreaWidth),
      hitHeight: sliderConfig.hitHeight * uiScaleState.menuBoost,
      toggleSize: sliderToggleSize,
      toggleGap: sliderToggleGap,
      labelFontSize: Math.round(
        sliderConfig.labelFontSize * uiScaleState.menuBoost,
      ),
      labelWidth: sliderConfig.labelWidth * uiScaleState.menuBoost,
    };

    sliders.forEach((slider, index) => {
      slider.applyLayout(sliderLayout, {
        x: paddingX,
        y: paddingTop + sliderGap * index,
      });
    });

    if (hintToggleRow) {
      const toggleLayout = {
        rowWidth: sliderAreaWidth,
        hitWidth: Math.min(sliderConfig.hitWidth * uiScaleState.menuBoost, sliderAreaWidth),
        hitHeight: sliderConfig.hitHeight * uiScaleState.menuBoost,
        toggleSize: sliderToggleSize,
        labelFontSize: Math.round(
          sliderConfig.labelFontSize * uiScaleState.menuBoost,
        ),
      };
      hintToggleRow.applyLayout(toggleLayout, {
        x: paddingX,
        y: paddingTop + sliderGap * sliders.length,
      });
    }

    const toyPanelScale = uiScaleState.menuBoost * 0.95;
    toysPanel.scale.set(toyPanelScale);
    toysPanelBackground.clear();
    toysPanelBackground.beginFill(0xf4eee6, 0.95);
    toysPanelBackground.drawRoundedRect(
      0,
      0,
      toyPanelLayout.width,
      toyPanelLayout.height,
      toyPanelLayout.radius,
    );
    toysPanelBackground.endFill();
    ballOptionIcon.scale.set(
      (18 / Math.max(1, ballOptionIcon.texture.width)) * 1,
    );
    noToyOptionIcon.scale.set(
      (14 / Math.max(1, noToyOptionIcon.texture.width)) * 1,
    );
    const optionRow1Y = Math.round(toyPanelLayout.paddingY);
    const optionRow2Y = Math.round(
      toyPanelLayout.paddingY + toyPanelLayout.rowHeight + toyPanelLayout.rowGap,
    );
    ballOption.y = optionRow1Y;
    noToyOption.y = optionRow2Y;
    ballOptionIcon.x = Math.round(toyPanelLayout.iconX);
    ballOptionIcon.y = Math.round(toyPanelLayout.rowHeight / 2);
    ballOptionLabel.style.fontSize = toyPanelLayout.fontSize;
    ballOptionLabel.x = Math.round(toyPanelLayout.labelX);
    ballOptionLabel.y = Math.round(toyPanelLayout.rowHeight / 2);
    ballOption.hitArea = new PIXI.Rectangle(0, 0, toyPanelLayout.width, toyPanelLayout.rowHeight);
    noToyOptionIcon.x = Math.round(toyPanelLayout.iconX);
    noToyOptionIcon.y = Math.round(toyPanelLayout.rowHeight / 2);
    noToyOptionLabel.style.fontSize = toyPanelLayout.fontSize;
    noToyOptionLabel.x = Math.round(toyPanelLayout.labelX);
    noToyOptionLabel.y = Math.round(toyPanelLayout.rowHeight / 2);
    noToyOption.hitArea = new PIXI.Rectangle(0, 0, toyPanelLayout.width, toyPanelLayout.rowHeight);
    uiScaleState.toyPanelWidth = toyPanelLayout.width * toyPanelScale;
    uiScaleState.toyPanelHeight = toyPanelLayout.height * toyPanelScale;
    updateToySelection();
  };

  const updateHintLayout = (layout) => {
    if (!hintOverlay.visible && !hintConfirm.visible) {
      return;
    }
    const scale = uiScaleState.scale;
    const maxWidth = Math.min(layout.width * 0.8, 520);
    hintText.style.fontSize = Math.round(12 * scale);
    hintText.scale.set(1);
    const textScale = Math.min(1, maxWidth / Math.max(1, hintText.width));
    hintText.scale.set(textScale);

    const paddingX = 14 * scale;
    const paddingY = 6 * scale;
    const closeSize = 14 * scale;
    const closeGap = 8 * scale;
    const rawWidth = hintText.width + paddingX * 2 + closeSize + closeGap;
    const panelWidth = Math.min(rawWidth, layout.width - 24);
    const panelHeight = Math.max(hintText.height + paddingY * 2, 24 * scale);
    const radius = 8 * scale;

    hintOverlay.x = Math.round(layout.centerX);
    hintOverlay.y = Math.round(layout.top + 16 * scale);

    hintBackground.clear();
    hintBackground.beginFill(0xf6f0e8, 0.92);
    hintBackground.lineStyle(1, 0xcdbca8, 0.35);
    hintBackground.drawRoundedRect(-panelWidth / 2, 0, panelWidth, panelHeight, radius);
    hintBackground.endFill();

    hintText.x = -panelWidth / 2 + paddingX + hintText.width / 2;
    hintText.y = panelHeight / 2;

    hintClose.x = panelWidth / 2 - closeGap - closeSize / 2;
    hintClose.y = panelHeight / 2 - closeSize / 2;
    hintCloseBg.clear();
    hintCloseBg.beginFill(0x111111, 0.08);
    hintCloseBg.drawRoundedRect(0, 0, closeSize, closeSize, 4 * scale);
    hintCloseBg.endFill();
    hintClose.hitArea = new PIXI.Rectangle(0, 0, closeSize, closeSize);
    hintCloseIcon.clear();
    hintCloseIcon.lineStyle(Math.max(1, Math.round(1.5 * scale)), 0x111111, 0.6);
    const iconPadding = 3 * scale;
    hintCloseIcon.moveTo(iconPadding, iconPadding);
    hintCloseIcon.lineTo(closeSize - iconPadding, closeSize - iconPadding);
    hintCloseIcon.moveTo(closeSize - iconPadding, iconPadding);
    hintCloseIcon.lineTo(iconPadding, closeSize - iconPadding);

    const confirmWidth = 150 * scale;
    const confirmHeight = 58 * scale;
    hintConfirm.x = Math.round(layout.centerX);
    hintConfirm.y = Math.round(hintOverlay.y + panelHeight + 10 * scale);
    hintConfirmBg.clear();
    hintConfirmBg.beginFill(0xf6f0e8, 0.96);
    hintConfirmBg.lineStyle(1, 0xcdbca8, 0.4);
    hintConfirmBg.drawRoundedRect(-confirmWidth / 2, 0, confirmWidth, confirmHeight, radius);
    hintConfirmBg.endFill();
    hintConfirmText.style.fontSize = Math.round(12 * scale);
    hintConfirmText.x = 0;
    hintConfirmText.y = 18 * scale;

    const buttonWidth = 52 * scale;
    const buttonHeight = 22 * scale;
    const buttonY = Math.round(confirmHeight - buttonHeight - 10 * scale);
    const updateConfirmButton = (button) => {
      button.bg.clear();
      button.bg.beginFill(0x111111, 0.08);
      button.bg.drawRoundedRect(0, 0, buttonWidth, buttonHeight, 6 * scale);
      button.bg.endFill();
      button.container.hitArea = new PIXI.Rectangle(0, 0, buttonWidth, buttonHeight);
      button.text.style.fontSize = Math.round(11 * scale);
      button.text.x = buttonWidth / 2;
      button.text.y = buttonHeight / 2;
    };

    hintConfirmYes.container.x = -buttonWidth - 8 * scale;
    hintConfirmYes.container.y = buttonY;
    hintConfirmNo.container.x = 8 * scale;
    hintConfirmNo.container.y = buttonY;
    updateConfirmButton(hintConfirmYes);
    updateConfirmButton(hintConfirmNo);
  };

  const setMenuVisible = (visible) => {
    optionsMenu.visible = visible;
    if (!settingsState.hovering) {
      settingsButton.container.alpha = visible ? 0.32 : 0.18;
    }
    if (visible) {
      enqueueHint("settings", { priority: true, delayMs: 300 });
    }
  };

  const toggleMenu = () => {
    setMenuVisible(!optionsMenu.visible);
  };

  settingsButton.container.on("pointerdown", (event) => {
    toggleMenu();
    settingsButton.container.alpha = 0.32;
    event.stopPropagation();
  });

  settingsButton.container.on("pointerenter", () => {
    settingsState.hovering = true;
    settingsButton.container.alpha = 0.32;
  });

  settingsButton.container.on("pointerleave", () => {
    settingsState.hovering = false;
    if (!optionsMenu.visible) {
      settingsButton.container.alpha = 0.18;
    }
  });

  optionsMenu.on("pointerdown", (event) => {
    event.stopPropagation();
  });

  const updateToyButtonAlpha = () => {
    toysButton.container.alpha = toysPanelOpen ? 0.32 : 0.22;
  };

  const updateClothesButtonAlpha = () => {
    clothesButton.container.alpha = closetOpen ? 0.32 : 0.22;
  };

  const setToysPanelVisible = (visible) => {
    toysPanelOpen = visible;
    toysPanel.visible = visible;
    updateToyButtonAlpha();
    if (visible) {
      enqueueHint("toys", { priority: true, delayMs: 300 });
    }
  };

  toysButton.container.on("pointerdown", (event) => {
    if (closetOpen) {
      return;
    }
    setToysPanelVisible(!toysPanelOpen);
    event.stopPropagation();
  });
  toysButton.container.on("pointerenter", () => {
    toysButton.container.alpha = 0.32;
  });
  toysButton.container.on("pointerleave", () => {
    updateToyButtonAlpha();
  });

  clothesButton.container.on("pointerdown", (event) => {
    setToysPanelVisible(false);
    setClosetOpen(true);
    event.stopPropagation();
  });
  clothesButton.container.on("pointerenter", () => {
    clothesButton.container.alpha = 0.32;
  });
  clothesButton.container.on("pointerleave", () => {
    updateClothesButtonAlpha();
  });

  const closetLayer = new PIXI.Container();
  closetLayer.zIndex = 60;
  closetLayer.visible = false;
  closetLayer.eventMode = "static";
  stage.addChild(closetLayer);

  const closetBackground = new PIXI.Graphics();
  const closetFloor = new PIXI.Graphics();
  const closetTrim = new PIXI.Graphics();
  const closetShelf = new PIXI.Graphics();
  const closetSpotlight = new PIXI.Graphics();
  const closetPreview = new PIXI.Sprite(textures.idle);
  applySpriteAnchor(closetPreview, "closet_preview");
  closetLayer.addChild(
    closetBackground,
    closetFloor,
    closetTrim,
    closetShelf,
    closetSpotlight,
    closetPreview,
  );

  const closetUiLayer = new PIXI.Container();
  closetLayer.addChild(closetUiLayer);

  const closetBackButton = createIconButton({
    texture: textures.ui_back,
    defaultAlpha: 0.22,
  });
  closetUiLayer.addChild(closetBackButton.container);

  const closetGrid = new PIXI.Container();
  closetUiLayer.addChild(closetGrid);

  const closetSlot = new PIXI.Graphics();
  closetSlot.eventMode = "static";
  closetSlot.cursor = "pointer";
  closetGrid.addChild(closetSlot);
  const closetSlotCheck = new PIXI.Sprite(textures.ui_check);
  closetSlotCheck.anchor.set(0.5);
  closetSlotCheck.roundPixels = true;
  closetSlotCheck.alpha = 0.75;
  closetGrid.addChild(closetSlotCheck);

  const closetSlotLabel = createPixelText("Default", {
    fontSize: 12,
    fill: 0x111111,
  });
  closetSlotLabel.anchor.set(0.5, 0.5);
  closetGrid.addChild(closetSlotLabel);

  const closetSpotlightState = {
    timer: 0,
  };

  let selectedCostume = "default";
  const updateCostumeSelection = () => {
    closetSlot.clear();
    closetSlot.lineStyle(1, 0x111111, 0.22);
    closetSlot.beginFill(0xf4eee6, 0.9);
    closetSlot.drawRoundedRect(0, 0, 82, 82, 10);
    closetSlot.endFill();
    closetSlotCheck.visible = selectedCostume === "default";
  };
  updateCostumeSelection();

  closetSlot.on("pointerdown", (event) => {
    selectedCostume = "default";
    updateCostumeSelection();
    event.stopPropagation();
  });

  const setClosetOpen = (open) => {
    closetOpen = open;
    closetLayer.visible = open;
    uiLayer.visible = !open;
    optionsLayer.visible = !open;
    setMenuVisible(false);
    if (open) {
      setToysPanelVisible(false);
      enqueueHint("costumes", { priority: true, delayMs: 300 });
    }
    updateClothesButtonAlpha();
  };

  closetBackButton.container.on("pointerdown", (event) => {
    setClosetOpen(false);
    event.stopPropagation();
  });
  closetBackButton.container.on("pointerenter", () => {
    closetBackButton.container.alpha = 0.32;
  });
  closetBackButton.container.on("pointerleave", () => {
    closetBackButton.container.alpha = 0.22;
  });

  closetLayer.on("pointerdown", (event) => {
    event.stopPropagation();
  });

  updateToyButtonAlpha();
  updateClothesButtonAlpha();

  let floorTopY = 0;
  let floorBottomY = 0;
  let roomLeft = 0;
  let roomRight = 0;
  let hasPositioned = false;

  const heartPool = [];
  const activeHearts = [];
  const heartBaseScale = 0.26;
  const heartPlans = {
    normal: { count: 2, size: 1.4, speed: 1, lifetime: [0.75, 1.05], wobble: 1.05 },
    gentle: { count: 3, size: 1.6, speed: 0.78, lifetime: [0.9, 1.15], wobble: 0.95 },
    excited: { count: 4, size: 1.3, speed: 1.05, lifetime: [0.75, 1.0], wobble: 1.3 },
  };
  let nextHeartAllowedAt = 0;
  let lastPetAt = 0;
  let lastSpamPetAt = 0;
  let petSpamCount = 0;
  let petHoldActive = false;
  let holdLoopStarted = false;
  let holdLoopTimeout = null;
  let petHoldTimeMs = 0;
  const idleBobState = {
    phase: Math.random() * Math.PI * 2,
    offset: 0,
  };
  const jumpMicroState = {
    phase: Math.random() * Math.PI * 2,
    offset: 0,
    squash: 0,
  };
  let holdHintTriggered = false;
  let activePetPointerId = null;
  let walkHopTimer = 0;

  const petTiming = {
    press: 0.14,
    hold: 0.1,
    release: 0.2,
  };

  const ballConfig = {
    gravity: 1600,
    bounceDamping: 0.55,
    groundFriction: 0.95,
    maxBounces: 4,
    minBounceSpeed: 120,
    baseScale: 0.5,
    tossSpeed: 620,
    tossLift: 26,
    tossPush: 180,
  };

  const ballState = {
    active: false,
    depth: 0.6,
    x: 0,
    y: 0,
    velocityX: 0,
    velocityY: 0,
    bounceCount: 0,
    isAirborne: false,
    dragging: false,
    dragPointerId: null,
    lastDragX: 0,
    lastDragTime: 0,
    dragStartX: 0,
    dragStartY: 0,
    dragMoved: false,
    isHidden: false,
  };

  const toyInteraction = {
    phase: "idle",
    timer: 4,
  };

  let ballInteractionLocked = false;
  const isBallHeld = () => toyInteraction.phase === "hold";
  const syncBallInteractivity = () => {
    const holding = isBallHeld();
    if (holding === ballInteractionLocked) {
      return;
    }
    ballInteractionLocked = holding;
    ballSprite.eventMode = holding ? "none" : "static";
    ballSprite.cursor = holding ? "default" : "pointer";
  };

  const createHeartGraphic = () => {
    const heart = new PIXI.Sprite(textures.ui_heart);
    heart.anchor.set(0.5, 0.5);
    heart.roundPixels = true;
    heart.visible = false;
    heartLayer.addChild(heart);
    return {
      sprite: heart,
      active: false,
      age: 0,
      lifetime: 0,
      speed: 0,
      wobbleTime: 0,
      wobblePhase: 0,
      wobbleAmplitude: 0,
      baseX: 0,
      baseAlpha: 0.9,
    };
  };

  for (let i = 0; i < 12; i += 1) {
    heartPool.push(createHeartGraphic());
  }

  const drawRoom = () => {
    const { width, height } = app.renderer;
    const wallHeight = Math.round(height * 0.68);
    floorTopY = wallHeight + 8;
    floorBottomY = Math.round(height * 0.92);
    roomLeft = Math.round(width * 0.18);
    roomRight = Math.round(width * 0.82);

    wall.clear();
    wall.beginFill(0xefe3d1);
    wall.drawRect(0, 0, width, wallHeight);
    wall.endFill();

    floor.clear();
    floor.beginFill(0xdac6ad);
    floor.drawRect(0, wallHeight, width, height - wallHeight);
    floor.endFill();
    floor.lineStyle(1, 0xd1bfa7, 0.08);
    const plankStartY = Math.round(wallHeight + 12);
    const plankGap = Math.max(26, Math.round(height * 0.06));
    for (let y = plankStartY; y < height - 6; y += plankGap) {
      const lineY = Math.round(y);
      floor.moveTo(0, lineY);
      floor.lineTo(width, lineY);
    }

    floorMat.clear();
    const matWidth = Math.round(Math.min(width, height) * 0.58);
    const matHeight = Math.round(Math.min(width, height) * 0.12);
    const matX = Math.round(width / 2);
    const matY = Math.round(floorBottomY - matHeight * 0.55);
    floorMat.beginFill(0xd1bba1);
    floorMat.drawEllipse(matX, matY, matWidth / 2, matHeight / 2);
    floorMat.endFill();

    seam.clear();
    seam.visible = false;
  };

  const getBaseY = (depth) => {
    const depthT = clamp(depth, 0, 1);
    return floorTopY + depthT * (floorBottomY - floorTopY);
  };

  const getDepthScale = (depth) => 0.84 + depth * 0.26;

  const getBallRadius = () =>
    (ballSprite.texture.width * ballConfig.baseScale * getDepthScale(ballState.depth)) / 2;

  const getDepthFromY = (value) =>
    clamp((value - floorTopY) / Math.max(1, floorBottomY - floorTopY), 0, 1);

  const clampBallX = (value) => {
    const radius = getBallRadius();
    return clamp(value, roomLeft + radius, roomRight - radius);
  };

  const clearBallHoldState = () => {
    if (toyInteraction.phase !== "idle") {
      toyInteraction.phase = "idle";
      toyInteraction.timer = 2 + Math.random() * 3;
    }
    setSpriteOverride(null);
  };

  const spawnBallAt = (xPosition) => {
    ballState.active = true;
    ballState.depth = 0.6;
    ballState.isAirborne = false;
    ballState.dragging = false;
    ballState.dragPointerId = null;
    ballState.velocityX = 0;
    ballState.velocityY = 0;
    ballState.bounceCount = 0;
    ballState.isHidden = false;
    ballState.x = clampBallX(xPosition ?? (roomLeft + roomRight) / 2);
    ballState.y = getBaseY(ballState.depth);
    ballSprite.visible = true;
    clearBallHoldState();
  };

  const disableBall = () => {
    ballState.active = false;
    ballState.dragging = false;
    ballState.dragPointerId = null;
    ballState.isHidden = true;
    ballState.isAirborne = false;
    ballState.velocityX = 0;
    ballState.velocityY = 0;
    ballSprite.visible = false;
    clearBallHoldState();
  };

  const hideBall = () => {
    ballState.isHidden = true;
    ballSprite.visible = false;
  };

  const tossBall = (direction = 1) => {
    ballState.isHidden = false;
    ballState.isAirborne = true;
    ballState.bounceCount = 0;
    ballState.velocityY = -ballConfig.tossSpeed;
    ballState.velocityX = ballConfig.tossPush * direction;
    ballState.x = clampBallX(ballState.x);
    ballState.y = getBaseY(ballState.depth) - ballConfig.tossLift * getDepthScale(ballState.depth);
    ballSprite.visible = true;
  };

  const updateBallSprite = () => {
    ballSprite.x = ballState.x;
    ballSprite.y = ballState.y;
    ballSprite.scale.set(ballConfig.baseScale * getDepthScale(ballState.depth));
    ballSprite.visible = ballState.active && !ballState.isHidden;
  };

  const reposition = () => {
    const { width } = app.renderer;
    drawRoom();
    stage.hitArea = app.screen;
    if (!hasPositioned) {
      oyachi.x = width / 2;
      hasPositioned = true;
    } else {
      oyachi.x = clamp(oyachi.x, roomLeft, roomRight);
    }
    oyachi.y = getBaseY(state.depth);

    if (ballState.active) {
      ballState.x = clampBallX(ballState.x);
      if (!ballState.isAirborne && !ballState.dragging) {
        ballState.y = getBaseY(ballState.depth);
      }
      updateBallSprite();
    }

  };

  const updateUiLayout = (layout) => {
    const { left, right, top, bottom, scale, centerX, width } = layout;
    applyUiScale(layout);
    nowPlayingText.x = left + 16;
    nowPlayingText.y = bottom - 14;
    const marginScale = uiScaleState.compact ? 1.1 : 1;
    const settingsHalf = getIconHalfSize(settingsButton.icon);
    const fullscreenHalf = getIconHalfSize(fullscreenButton.icon);
    const toysHalf = getIconHalfSize(toysButton.icon);
    const clothesHalf = getIconHalfSize(clothesButton.icon);
    const maxHalfWidth = Math.max(
      settingsHalf.width,
      fullscreenHalf.width,
      toysHalf.width,
      clothesHalf.width,
    );
    const maxHalfHeight = Math.max(
      settingsHalf.height,
      fullscreenHalf.height,
      toysHalf.height,
      clothesHalf.height,
    );
    const safeLeft = left + maxHalfWidth + 6;
    const safeRight = right - maxHalfWidth - 6;
    const safeTop = top + maxHalfHeight + 6;
    const safeBottom = bottom - maxHalfHeight - 6;
    const gearMargin = 24 * marginScale;
    settingsButton.container.x = Math.round(clamp(left + gearMargin, safeLeft, safeRight));
    settingsButton.container.y = Math.round(clamp(top + gearMargin, safeTop, safeBottom));
    const fullscreenMargin = 24 * marginScale;
    fullscreenButton.container.x = Math.round(clamp(right - fullscreenMargin, safeLeft, safeRight));
    fullscreenButton.container.y = Math.round(clamp(top + fullscreenMargin, safeTop, safeBottom));
    const baseMenuWidth = uiScaleState.menuWidth;
    const menuScale = clamp(0.9 / scale, 1, 1.35);
    optionsMenu.scale.set(menuScale);
    const menuMargin = 16;
    const menuWidth = baseMenuWidth * menuScale;
    const menuHeight = menuLayout.height * uiScaleState.menuBoost * menuScale;
    optionsMenu.x = Math.round(
      clamp(left + menuMargin, left + 8, right - menuWidth - 8),
    );
    optionsMenu.y = Math.round(
      clamp(settingsButton.container.y + 22 * uiScaleState.scale, top + 8, bottom - menuHeight - 8),
    );
    const bottomMargin = 26 * marginScale;
    updateHintLayout(layout);
    const iconGap = uiScaleState.bottomIconSpacing;
    const iconTotalWidth =
      getSafeDimension(toysButton.icon.width, 1) +
      getSafeDimension(clothesButton.icon.width, 1) +
      iconGap;
    const rowLeft = clamp(
      centerX - iconTotalWidth / 2,
      left + 12 * marginScale,
      right - 12 * marginScale - iconTotalWidth,
    );
    const buttonsY = clamp(bottom - bottomMargin, safeTop, safeBottom);
    toysButton.container.x = Math.round(rowLeft + toysButton.icon.width / 2);
    toysButton.container.y = Math.round(buttonsY);
    clothesButton.container.x = Math.round(
      rowLeft + toysButton.icon.width + iconGap + clothesButton.icon.width / 2,
    );
    clothesButton.container.y = Math.round(buttonsY);
    const panelX = clamp(
      centerX - uiScaleState.toyPanelWidth / 2,
      left + 8,
      right - uiScaleState.toyPanelWidth - 8,
    );
    const panelY = clamp(
      bottom - bottomMargin - uiScaleState.toyPanelHeight - 12 * marginScale,
      top + 8,
      bottom - uiScaleState.toyPanelHeight - 8,
    );
    toysPanel.x = Math.round(panelX);
    toysPanel.y = Math.round(panelY);
  };

  const updateClosetLayout = (layout) => {
    const { width, height } = layout;
    closetLayer.hitArea = new PIXI.Rectangle(0, 0, width, height);
    closetBackground.clear();
    const closetWallHeight = Math.round(height * 0.62);
    closetBackground.beginFill(0xe9d7c2);
    closetBackground.drawRect(0, 0, width, closetWallHeight);
    closetBackground.endFill();

    closetFloor.clear();
    closetFloor.beginFill(0xd6c2ab);
    closetFloor.drawRect(0, closetWallHeight, width, height - closetWallHeight);
    closetFloor.endFill();
    closetFloor.lineStyle(1, 0xcbb79f, 0.2);
    const floorLineY = closetWallHeight + 12;
    for (let y = floorLineY; y < height; y += 36) {
      closetFloor.moveTo(0, y);
      closetFloor.lineTo(width, y);
    }

    closetTrim.clear();
    closetTrim.lineStyle(2, 0xbfa991, 0.35);
    closetTrim.moveTo(0, closetWallHeight);
    closetTrim.lineTo(width, closetWallHeight);

    closetShelf.clear();
    const shelfWidth = width * 0.5;
    const shelfX = width * 0.25;
    const shelfY = height * 0.2;
    closetShelf.beginFill(0xdac5ad, 0.9);
    closetShelf.drawRoundedRect(shelfX, shelfY, shelfWidth, 8, 4);
    closetShelf.endFill();

    const previewX = width * 0.35;
    const previewY = height * 0.78;
    closetPreview.x = Math.round(previewX);
    closetPreview.y = Math.round(previewY);
    closetPreview.scale.set(baseSpriteScaleDefault * 0.9);

    const spotlightTopWidth = width * 0.38;
    const spotlightBottomWidth = width * 0.18;
    const spotlightHeight = height * 0.8;
    closetSpotlight.clear();
    closetSpotlight.beginFill(0xffffff, 0.08);
    closetSpotlight.moveTo(-spotlightTopWidth / 2, 0);
    closetSpotlight.lineTo(spotlightTopWidth / 2, 0);
    closetSpotlight.lineTo(spotlightBottomWidth / 2, spotlightHeight);
    closetSpotlight.lineTo(-spotlightBottomWidth / 2, spotlightHeight);
    closetSpotlight.closePath();
    closetSpotlight.endFill();
    closetSpotlight.x = Math.round(previewX);
    closetSpotlight.y = 0;

    const backMargin = 24;
    closetBackButton.icon.scale.set(uiScaleState.iconScale);
    const { width: backWidthHalf, height: backHeightHalf } = getIconHalfSize(
      closetBackButton.icon,
    );
    updateIconHitArea(closetBackButton);
    closetBackButton.container.x = Math.round(
      clamp(backMargin, backWidthHalf + 6, width - backWidthHalf - 6),
    );
    closetBackButton.container.y = Math.round(
      clamp(backMargin, backHeightHalf + 6, height - backHeightHalf - 6),
    );

    const slotSize = 82;
    closetGrid.x = Math.round(width * 0.62);
    closetGrid.y = Math.round(height * 0.36);
    closetSlot.hitArea = new PIXI.Rectangle(0, 0, slotSize, slotSize);
    closetSlotLabel.x = slotSize / 2;
    closetSlotLabel.y = slotSize + 16;
    closetSlotCheck.scale.set(
      (slotSize * 0.32) /
        getTextureDimension(closetSlotCheck.texture, "width", slotSize * 0.32),
    );
    closetSlotCheck.x = slotSize * 0.78;
    closetSlotCheck.y = slotSize * 0.22;
  };

  const handleLayout = (layout) => {
    reposition();
    updateUiLayout(layout);
    updateClosetLayout(layout);
  };

  safeLayoutCall(handleLayout, getLayoutBounds());
  const unsubscribeLayout = registerLayoutSubscriber(handleLayout);
  app.__oyachiCleanup.push(unsubscribeLayout);

  const setState = (nextState, duration = 0) => {
    state.current = nextState;
    state.timer = duration;
    if (nextState === "blink") {
      state.blinkTimer = duration;
    }
    if (nextState === "pet") {
      state.petTimer = duration;
    }
    if (nextState === "move") {
      state.moveTimer = duration;
    }
  };

  const stopHoldLoop = (reason, options = { fadeOutSeconds: 0.25 }) => {
    if (!audioSystem.isLoopPlaying("petHoldMagic")) {
      return;
    }
    console.log("LOOP_STOP", reason);
    audioSystem.stopLoop("petHoldMagic", options);
  };

  const clearHoldLoopTimeout = () => {
    if (holdLoopTimeout) {
      clearTimeout(holdLoopTimeout);
      holdLoopTimeout = null;
    }
  };

  const beginHoldLoop = () => {
    if (!petHoldActive || holdLoopStarted) {
      return;
    }
    holdLoopStarted = true;
    console.log("HOLD_START");
    startHoldLoop();
  };

  const startHoldLoop = () => {
    if (audioSystem.isLoopPlaying("petHoldMagic")) {
      return;
    }
    console.log("LOOP_START");
    void audioSystem.startLoop({
      id: "petHoldMagic",
      allowPitch: false,
      fadeIn: 0.35,
    });
  };

  const resetHoldPetState = (options = {}) => {
    const {
      stopLoop = true,
      loopOptions = { fadeOutSeconds: 0.2 },
      reason = "unknown",
    } = options;
    clearHoldLoopTimeout();
    petHoldActive = false;
    holdLoopStarted = false;
    petHoldTimeMs = 0;
    holdHintTriggered = false;
    activePetPointerId = null;
    if (stopLoop) {
      stopHoldLoop(reason, loopOptions);
    }
  };

  const registerActivity = () => {
    state.inactiveTime = 0;
    state.tiredTimer = 0;
    if (state.current === "idle_tired") {
      setState("idle");
      showSprite("idle");
      scheduleIdle();
    }
  };

  const startSleep = () => {
    setState("sleep");
    state.sleepFrame = 0;
    state.sleepFrameTimer = sleepTiming.frameDuration;
    showSprite("sleep_1");
    if (holdLoopStarted) {
      console.log("HOLD_END", "sleep");
    }
    resetHoldPetState({ loopOptions: { fadeOutSeconds: 0.2 }, reason: "sleep" });
  };

  const wakeFromSleep = () => {
    if (state.current !== "sleep") {
      return;
    }
    setState("wake");
    state.wakeTimer = wakeTiming.duration;
    showSprite("idle");
    registerActivity();
  };

  const scheduleMoveTo = (targetX, targetDepth = null) => {
    state.moveTimer = 200;
    state.moveDirection = targetX < oyachi.x ? -1 : 1;
    state.moveTargetX = clamp(targetX, roomLeft, roomRight);
    setState("move", state.moveTimer);
    if (typeof targetDepth === "number") {
      state.depthTarget = clamp(targetDepth, 0, 1);
      state.depthTimer = 120;
    } else {
      scheduleDepth();
    }
  };

  const visualState = {
    intent: "idle",
    override: null,
  };
  const setSpriteVisibility = (name) => {
    idleSprite.visible = name === "idle";
    blinkSprite.visible = name === "blink";
    petSprite.visible = name === "pet";
    holdBallSprite.visible = name === "hold_ball";
    tiredSprite.visible = name === "idle_tired";
    sneezeSprite.visible = name === "sneeze";
    sleepSprite1.visible = name === "sleep_1";
    sleepSprite2.visible = name === "sleep_2";
    reactCuteSprite.visible = name === "react_cute";
    reactAyoSprite.visible = name === "react_ayo";
  };
  const refreshSpriteVisibility = () => {
    setSpriteVisibility(visualState.override ?? visualState.intent);
  };
  const showSprite = (name) => {
    visualState.intent = name;
    refreshSpriteVisibility();
  };
  const setSpriteOverride = (name) => {
    visualState.override = name;
    refreshSpriteVisibility();
  };

  const startPet = () => {
    if (state.current === "happy_jump_sequence") {
      return;
    }
    const totalDuration = petTiming.press + petTiming.hold + petTiming.release;
    setState("pet", totalDuration);
    state.petDuration = totalDuration;
    showSprite("pet");
    registerActivity();
    enqueueHint("pet");
    const now = performance.now();
    const timeSinceLastPet = now - lastPetAt;
    lastPetAt = now;
    let petType = "normal";
    if (timeSinceLastPet < 220) {
      petType = "excited";
    } else if (timeSinceLastPet > 700) {
      petType = "gentle";
    }
    spawnHeart(petType, { force: true });
    if (activeHearts.length === 0) {
      const baseY = getBaseY(state.depth);
      forceSpawnHeartAt(oyachi.x, Math.min(baseY - 40, baseY - 1));
    }
    if (timeSinceLastPet <= petSpamTiming.quickWindowMs) {
      petSpamCount = now - lastSpamPetAt > petSpamTiming.resetWindowMs ? 1 : petSpamCount + 1;
      lastSpamPetAt = now;
    } else {
      petSpamCount = 0;
      lastSpamPetAt = now;
    }
    const isSpamPet = timeSinceLastPet <= petSpamTiming.quickWindowMs;
    void audioSystem.playSfx({
      id: isSpamPet ? "petFast" : "petSoft",
      cooldownMs: isSpamPet ? 120 : 180,
    });
    if (petSpamCount >= petSpamTiming.requiredCount) {
      petSpamCount = 0;
      enqueueHint("spam", { priority: true });
      startHappyJumpSequence();
    }
  };

  const handlePetPointerDown = (event) => {
    if (!gameStarted) {
      return;
    }
    if (closetOpen) {
      return;
    }
    if (isBallHeld()) {
      return;
    }
    if (state.current === "sleep") {
      wakeFromSleep();
      return;
    }
    if (state.current === "happy_jump_sequence") {
      return;
    }
    if (petHoldActive) {
      return;
    }
    if (event?.data?.originalEvent) {
      event.data.originalEvent.preventDefault();
    }
    activePetPointerId = getPointerId(event);
    petHoldActive = true;
    holdLoopStarted = false;
    clearHoldLoopTimeout();
    holdLoopTimeout = setTimeout(beginHoldLoop, petHoldTiming.gentleDelayMs);
    petHoldTimeMs = 0;
    state.cuteHeartTimer = petHoldTiming.cuteHeartInterval;
    startPet();
  };

  const handlePetPointerMove = (event) => {
    if (!gameStarted) {
      return;
    }
    if (closetOpen) {
      return;
    }
    if (isBallHeld()) {
      return;
    }
    if (sliderState.active) {
      const pointerId = getPointerId(event);
      if (sliderState.pointerId !== null && pointerId !== sliderState.pointerId) {
        return;
      }
      if (event?.data?.global) {
        sliderState.active.updateFromGlobal(event.data.global);
      }
      return;
    }
    if (!petHoldActive) {
      return;
    }
    const pointerId = getPointerId(event);
    if (activePetPointerId !== null && pointerId !== activePetPointerId) {
      return;
    }
    if (event?.data?.originalEvent) {
      event.data.originalEvent.preventDefault();
    }
    registerActivity();
  };

  const handlePetPointerUp = (event, reason = "pointerup") => {
    if (!gameStarted) {
      return;
    }
    if (closetOpen) {
      return;
    }
    const pointerId = getPointerId(event);
    if (sliderState.active) {
      if (sliderState.pointerId === null || sliderState.pointerId === pointerId) {
        sliderState.active = null;
        sliderState.pointerId = null;
      }
    }
    if (activePetPointerId !== null && pointerId !== activePetPointerId) {
      return;
    }
    if (holdLoopStarted) {
      console.log("HOLD_END", reason);
    }
    resetHoldPetState({ loopOptions: { fadeOutSeconds: 0.2 }, reason });
  };

  const handleBallPointerUp = (event) => {
    if (!ballState.dragging) {
      return;
    }
    const pointerId = getPointerId(event);
    if (ballState.dragPointerId !== null && pointerId !== ballState.dragPointerId) {
      return;
    }
    ballState.dragging = false;
    ballState.dragPointerId = null;
    const now = performance.now();
    const deltaMs = Math.max(16, now - ballState.lastDragTime);
    const deltaX = ballState.x - ballState.lastDragX;
    const speed = (deltaX / deltaMs) * 1000;
    if (!ballState.dragMoved) {
      const pointerGlobal =
        event?.data?.global ??
        (event?.clientX !== undefined ? mapPointerEventToGlobal(event) : null);
      const pointerX = pointerGlobal?.x ?? ballState.x;
      const direction = pointerX < ballState.x ? 1 : -1;
      ballState.velocityX = 80 * direction;
    } else {
      ballState.velocityX = clamp(speed, -240, 240);
    }
    ballState.velocityY = 0;
    ballState.isAirborne = false;
    ballState.y = getBaseY(ballState.depth);
  };

  const cancelPointerInteractions = ({
    loopOptions = { immediate: true },
    reason = "cancel",
  } = {}) => {
    if (sliderState.active) {
      sliderState.active = null;
      sliderState.pointerId = null;
    }
    if (ballState.dragging) {
      ballState.dragging = false;
      ballState.dragPointerId = null;
      ballState.dragMoved = false;
      ballState.velocityX = 0;
      ballState.velocityY = 0;
      ballState.isAirborne = false;
      ballState.y = getBaseY(ballState.depth);
    }
    if (holdLoopStarted) {
      console.log("HOLD_END", reason);
    }
    resetHoldPetState({ loopOptions, reason });
  };

  const handleBallPointerMove = (event) => {
    if (!ballState.dragging) {
      return false;
    }
    const pointerId = getPointerId(event);
    if (ballState.dragPointerId !== null && pointerId !== ballState.dragPointerId) {
      return false;
    }
    const global = event?.data?.global ?? event?.global;
    if (!global) {
      return false;
    }
    const deltaX = global.x - ballState.dragStartX;
    const deltaY = global.y - ballState.dragStartY;
    if (Math.hypot(deltaX, deltaY) > 6) {
      ballState.dragMoved = true;
    }
    ballState.depth = getDepthFromY(global.y);
    ballState.x = clampBallX(global.x);
    ballState.y = getBaseY(ballState.depth);
    ballState.lastDragX = ballState.x;
    ballState.lastDragTime = performance.now();
    return true;
  };

  const windowPointer = new PIXI.Point();

  const mapPointerEventToGlobal = (event) => {
    if (app.renderer?.events?.mapPositionToPoint) {
      app.renderer.events.mapPositionToPoint(windowPointer, event.clientX, event.clientY);
      return windowPointer;
    }
    const rect = app.view.getBoundingClientRect();
    const scaleX = rect.width > 0 ? app.renderer.width / rect.width : 1;
    const scaleY = rect.height > 0 ? app.renderer.height / rect.height : 1;
    windowPointer.x = (event.clientX - rect.left) * scaleX;
    windowPointer.y = (event.clientY - rect.top) * scaleY;
    return windowPointer;
  };

  const handleWindowPointerMove = (event) => {
    if (!ballState.dragging && !petHoldActive && !sliderState.active) {
      return;
    }
    const global = mapPointerEventToGlobal(event);
    const proxyEvent = {
      data: {
        global,
        originalEvent: event,
      },
      pointerId: event.pointerId,
    };
    if (handleBallPointerMove(proxyEvent)) {
      return;
    }
    handlePetPointerMove(proxyEvent);
  };

  oyachi.on("pointerdown", handlePetPointerDown);

  ballSprite.on("pointerdown", (event) => {
    if (!gameStarted || closetOpen || !ballState.active || isBallHeld()) {
      return;
    }
    if (event?.data?.originalEvent) {
      event.data.originalEvent.preventDefault();
    }
    if (event?.data?.global) {
      ballState.depth = getDepthFromY(event.data.global.y);
      ballState.y = getBaseY(ballState.depth);
    }
    ballState.dragging = true;
    ballState.dragPointerId = getPointerId(event);
    ballState.isAirborne = false;
    ballState.velocityX = 0;
    ballState.velocityY = 0;
    ballState.lastDragX = ballState.x;
    ballState.lastDragTime = performance.now();
    ballState.dragStartX = event?.data?.global?.x ?? ballState.x;
    ballState.dragStartY = event?.data?.global?.y ?? ballState.y;
    ballState.dragMoved = false;
    event.stopPropagation();
  });

  ballSprite.on("pointermove", (event) => {
    if (handleBallPointerMove(event)) {
      event.stopPropagation();
      return;
    }
    event.stopPropagation();
  });

  ballSprite.on("pointerup", handleBallPointerUp);
  ballSprite.on("pointerupoutside", handleBallPointerUp);

  ballOption.on("pointerdown", (event) => {
    selectedToy = "ball";
    updateToySelection();
    spawnBallAt(oyachi.x);
    setToysPanelVisible(false);
    event.stopPropagation();
  });

  noToyOption.on("pointerdown", (event) => {
    selectedToy = "none";
    updateToySelection();
    disableBall();
    setToysPanelVisible(false);
    event.stopPropagation();
  });

  const scheduleIdle = () => {
    state.idleTimer = 70 + Math.random() * 120;
  };

  const scheduleBlink = () => {
    state.blinkTimer = 10;
    setState("blink", state.blinkTimer);
    showSprite("blink");
  };

  const scheduleSneeze = () => {
    state.sneezeTimer = idleBehavior.sneezeDuration;
    setState("sneeze");
    showSprite("sneeze");
    void audioSystem.playSfx({ id: "sneeze", cooldownMs: 1200 });
  };

  const scheduleMove = () => {
    state.moveTimer = 120 + Math.random() * 120;
    state.moveDirection = Math.random() < 0.5 ? -1 : 1;
    state.moveTargetX = null;
    setState("move", state.moveTimer);
    scheduleDepth();
  };

  const scheduleDepth = () => {
    state.depthTimer = 220 + Math.random() * 240;
    state.depthTarget = 0.2 + Math.random() * 0.7;
  };

  scheduleIdle();

  const spawnHeart = (petType, options = {}) => {
    const { force = false, ignoreCooldown = false, yOffset = 0 } = options;
    const now = performance.now();
    if (!ignoreCooldown && !force && activeHearts.length > 0 && now < nextHeartAllowedAt) {
      return;
    }
    const plan = heartPlans[petType] || heartPlans.normal;
    const spawnCount = plan.count;
    let spawned = 0;
    if (!ignoreCooldown) {
      nextHeartAllowedAt = now + 120 + Math.random() * 60;
    }
    const spawnSingleHeart = () => {
      let heart = heartPool.find((item) => !item.active);
      if (!heart && activeHearts.length > 0) {
        heart = activeHearts.shift();
        if (heart) {
          heart.active = false;
        }
      }
      if (!heart) {
        return false;
      }
      heart.active = true;
      heart.age = 0;
      heart.lifetime = plan.lifetime[0] + Math.random() * (plan.lifetime[1] - plan.lifetime[0]);
      heart.speed = (14 + Math.random() * 6) * plan.speed;
      heart.wobbleTime = 0;
      heart.wobblePhase = Math.random() * Math.PI * 2;
      heart.wobbleAmplitude = (2 + Math.random() * 1.5) * plan.wobble;
      const depthScale = 0.86 + state.depth * 0.22;
      const heartScale =
        heartBaseScale * (0.75 + state.depth * 0.18) * plan.size;
      const headOffset = idleSprite.height * depthScale * 0.78;
      const baseY = getBaseY(state.depth) + yOffset;
      const horizontalSpread = 38 * depthScale;
      const verticalSpread = 22 * depthScale;
      heart.baseX = oyachi.x + (Math.random() * 2 - 1) * horizontalSpread;
      heart.sprite.x = heart.baseX;
      const heartY = baseY - headOffset + (Math.random() * 2 - 1) * verticalSpread;
      heart.sprite.y = Math.min(heartY, baseY - 1);
      heart.sprite.alpha = Math.max(heart.baseAlpha, 0.6);
      heart.sprite.scale.set(Math.max(heartScale, heartBaseScale * 0.85));
      heart.sprite.visible = true;
      activeHearts.push(heart);
      return true;
    };

    for (let i = 0; i < spawnCount; i += 1) {
      if (spawnSingleHeart()) {
        spawned += 1;
      }
    }

    if (spawned === 0 && force) {
      spawnSingleHeart();
    }
  };

  const forceSpawnHeartAt = (xPosition, yPosition) => {
    let heart = heartPool.find((item) => !item.active);
    if (!heart && activeHearts.length > 0) {
      heart = activeHearts.shift();
      if (heart) {
        heart.active = false;
      }
    }
    if (!heart) {
      return;
    }
    heart.active = true;
    heart.age = 0;
    heart.lifetime = 0.95;
    heart.speed = 18;
    heart.wobbleTime = 0;
    heart.wobblePhase = Math.random() * Math.PI * 2;
    heart.wobbleAmplitude = 3.2;
    heart.baseX = xPosition;
    heart.sprite.x = xPosition;
    heart.sprite.y = yPosition;
    heart.sprite.alpha = Math.max(heart.baseAlpha, 0.6);
    heart.sprite.scale.set(Math.max(heartBaseScale, heartBaseScale * 0.85));
    heart.sprite.visible = true;
    activeHearts.push(heart);
  };

  const spawnHappyJumpHearts = (jumpOffset) => {
    spawnHeart("excited", { force: true, ignoreCooldown: true, yOffset: jumpOffset });
  };

  const startReactAyo = () => {
    setState("react_ayo");
    state.reactTimer = petHoldTiming.ayoDuration;
    state.reactSquishTimer = 0;
    showSprite("react_ayo");
    if (holdLoopStarted) {
      console.log("HOLD_END", "react_ayo");
    }
    resetHoldPetState({ loopOptions: { immediate: true }, reason: "react_ayo" });
    void audioSystem.playSfx({ id: "petOh", cooldownMs: 1000, allowPitch: false });
  };

  const startHappyJumpSequence = () => {
    setState("happy_jump_sequence");
    const jumpCount =
      happyJumpTiming.minJumps +
      Math.floor(Math.random() * (happyJumpTiming.maxJumps - happyJumpTiming.minJumps + 1));
    const jumps = [];
    for (let i = 0; i < jumpCount; i += 1) {
      let heightScale = 1;
      let durationScale = 1;
      if (i > 0) {
        if (Math.random() < 0.5) {
          heightScale = 0.88 + Math.random() * 0.08;
        } else {
          durationScale = 0.9 + Math.random() * 0.07;
        }
      }
      jumps.push({
        height: happyJumpTiming.baseHeight * heightScale,
        launchDuration: happyJumpTiming.launchDuration * durationScale,
        apexDuration: happyJumpTiming.apexDuration * durationScale,
        fallDuration: happyJumpTiming.fallDuration * durationScale,
        landingDuration: happyJumpTiming.landingDuration,
        delayDuration: happyJumpTiming.interJumpDelay,
      });
    }
    state.happyJumpSequence = {
      jumps,
      index: 0,
      phase: "launch",
      phaseTimer: 0,
      apexHeartsSpawned: false,
      finalLandingHeartsSpawned: false,
    };
    state.happyJumpLandingSquish = 0;
    if (holdLoopStarted) {
      console.log("HOLD_END", "happy_jump");
    }
    resetHoldPetState({ loopOptions: { fadeOutSeconds: 0.2 }, reason: "happy_jump" });
    showSprite("react_cute");
  };

  const moveAwayAfterAyo = () => {
    const minDistance = Math.max((roomRight - roomLeft) * 0.35, 120);
    let targetX = oyachi.x;
    for (let i = 0; i < 8; i += 1) {
      const candidate = roomLeft + Math.random() * (roomRight - roomLeft);
      if (Math.abs(candidate - oyachi.x) >= minDistance) {
        targetX = candidate;
        break;
      }
    }
    if (Math.abs(targetX - oyachi.x) < minDistance) {
      targetX =
        oyachi.x < (roomLeft + roomRight) / 2
          ? roomRight - minDistance / 2
          : roomLeft + minDistance / 2;
    }
    scheduleMoveTo(targetX);
  };

  app.ticker.add((delta) => {
    const deltaMs = app.ticker.deltaMS;
    const deltaSeconds = deltaMs / 1000;

    if (!gameStarted) {
      return;
    }

    if (nowPlayingState.phase !== "hidden") {
      nowPlayingState.timer += deltaSeconds;
      if (nowPlayingState.phase === "fadein") {
        const t = clamp(nowPlayingState.timer / nowPlayingTiming.fadeIn, 0, 1);
        nowPlayingText.alpha = 0.4 * t;
        if (t >= 1) {
          nowPlayingState.phase = "hold";
          nowPlayingState.timer = 0;
        }
      } else if (nowPlayingState.phase === "hold") {
        nowPlayingText.alpha = 0.4;
        if (nowPlayingState.timer >= nowPlayingTiming.hold) {
          nowPlayingState.phase = "fadeout";
          nowPlayingState.timer = 0;
        }
      } else if (nowPlayingState.phase === "fadeout") {
        const t = clamp(nowPlayingState.timer / nowPlayingTiming.fadeOut, 0, 1);
        nowPlayingText.alpha = 0.4 * (1 - t);
        if (t >= 1) {
          nowPlayingState.phase = "hidden";
          nowPlayingText.alpha = 0;
        }
      }
    }
    if (!hintsEnabled) {
      if (hintOverlay.visible) {
        hintOverlay.alpha = 0;
        hintOverlay.visible = false;
      }
    } else if (hintState.phase !== "hidden") {
      hintState.timer += deltaSeconds;
      if (hintState.phase === "fadein") {
        const t = clamp(hintState.timer / hintTiming.fadeIn, 0, 1);
        hintOverlay.alpha = hintAlpha * t;
        if (t >= 1) {
          hintState.phase = "hold";
          hintState.timer = 0;
        }
      } else if (hintState.phase === "hold") {
        hintOverlay.alpha = hintAlpha;
        if (hintState.timer >= hintTiming.hold) {
          hintState.phase = "fadeout";
          hintState.timer = 0;
        }
      } else if (hintState.phase === "fadeout") {
        const t = clamp(hintState.timer / hintTiming.fadeOut, 0, 1);
        hintOverlay.alpha = hintAlpha * (1 - t);
        if (t >= 1) {
          hintState.phase = "hidden";
          hintOverlay.alpha = 0;
          if (!hintConfirm.visible) {
            hintOverlay.visible = false;
          }
        }
      }
    } else if (hintState.queue.length > 0) {
      const now = performance.now();
      if (now >= hintState.pendingDelayUntil) {
        const nextHint = hintState.queue.shift();
        if (nextHint && !tryShowHint(nextHint)) {
          hintState.queue.push(nextHint);
          scheduleHintGap(now);
        }
      }
    }
    if (closetOpen) {
      closetSpotlightState.timer += deltaSeconds;
      const pulse = Math.sin(closetSpotlightState.timer * 0.6);
      closetSpotlight.alpha = 0.05 + pulse * 0.015;
      closetSpotlight.scale.set(1 + pulse * 0.01);
    }
    state.timer = Math.max(state.timer - delta, 0);
    if (state.current !== "sleep") {
      state.inactiveTime += deltaSeconds;
    }

    if (petHoldActive && state.current !== "happy_jump_sequence") {
      petHoldTimeMs += deltaMs;
      state.inactiveTime = 0;
      if (!holdHintTriggered && petHoldTimeMs >= petHoldTiming.gentleDelayMs) {
        enqueueHint("hold", { priority: true });
        holdHintTriggered = true;
      }
      if (petHoldTimeMs >= petHoldTiming.ayoDelayMs && state.current !== "react_ayo") {
        startReactAyo();
      } else if (
        petHoldTimeMs >= petHoldTiming.gentleDelayMs &&
        state.current !== "react_ayo" &&
        state.current !== "pet"
      ) {
        if (state.current !== "react_cute") {
          setState("react_cute");
          showSprite("react_cute");
          state.cuteHeartTimer = petHoldTiming.cuteHeartInterval;
          state.reactSquishTimer = 0;
        }
      }
    }

    if (state.current === "move") {
      walkHopTimer -= deltaSeconds;
      if (walkHopTimer <= 0) {
        walkHopTimer = 0.38 + Math.random() * 0.14;
        void audioSystem.playSfx({ id: "walkHop", cooldownMs: 180 });
      }
    } else {
      walkHopTimer = 0;
    }

    if (audioSystem.isLoopPlaying("petHoldMagic") && !petHoldActive) {
      stopHoldLoop("hold_inactive", { fadeOutSeconds: 0.25 });
    }

    const idleChance = Math.random();
    if (state.current === "idle") {
      state.idleTimer -= delta;
      if (state.idleTimer <= 0) {
        if (state.inactiveTime >= idleBehavior.tiredDelay) {
          setState("idle_tired");
          state.tiredTimer = idleBehavior.sleepDelay;
          showSprite("idle_tired");
        } else if (idleChance < idleBehavior.sneezeChance) {
          scheduleSneeze();
        } else if (idleChance < 0.35) {
          scheduleBlink();
        } else {
          scheduleIdle();
        }
        if (state.current === "idle" && idleChance >= 0.5) {
          scheduleMove();
        }
      }
    }

    if (state.current === "idle_tired") {
      state.tiredTimer -= deltaSeconds;
      if (state.tiredTimer <= 0) {
        startSleep();
      }
    }

    if (state.current === "sneeze") {
      state.sneezeTimer -= deltaSeconds;
      if (state.sneezeTimer <= 0) {
        setState("idle");
        showSprite("idle");
        scheduleIdle();
      }
    }

    if (state.current === "move") {
      state.depthTimer -= delta;
      if (state.depthTimer <= 0) {
        scheduleDepth();
      }
    }

    if (state.current === "blink") {
      state.blinkTimer -= delta;
      if (state.blinkTimer <= 0) {
        setState("idle");
        showSprite("idle");
        scheduleIdle();
      }
    }

    if (state.current === "move") {
      state.moveTimer -= delta;
      if (state.moveTimer <= 0) {
        setState("idle");
        state.depthTarget = state.depth;
        state.moveTargetX = null;
        scheduleIdle();
      }
    }

    if (state.current === "pet") {
      state.petTimer -= deltaSeconds;
      if (state.petTimer <= 0) {
        setState("idle");
        showSprite("idle");
        scheduleIdle();
      }
    }

    if (state.current === "react_cute") {
      if (!petHoldActive) {
        stopHoldLoop("hold_end", { fadeOutSeconds: 0.2 });
        setState("idle");
        showSprite("idle");
        scheduleIdle();
      } else {
        state.cuteHeartTimer -= deltaSeconds;
        if (state.cuteHeartTimer <= 0) {
          spawnHeart("gentle");
          state.cuteHeartTimer = petHoldTiming.cuteHeartInterval;
        }
      }
    }

    if (state.current === "react_ayo") {
      state.reactTimer -= deltaSeconds;
      if (state.reactTimer <= 0) {
        resetHoldPetState({ stopLoop: false });
        showSprite("idle");
        moveAwayAfterAyo();
      }
    }

    if (state.current === "sleep") {
      state.sleepFrameTimer -= deltaSeconds;
      if (state.sleepFrameTimer <= 0) {
        state.sleepFrame = state.sleepFrame === 0 ? 1 : 0;
        state.sleepFrameTimer = sleepTiming.frameDuration;
        showSprite(state.sleepFrame === 0 ? "sleep_1" : "sleep_2");
      }
    }

    if (state.current === "wake") {
      state.wakeTimer -= deltaSeconds;
      if (state.wakeTimer <= 0) {
        setState("idle");
        showSprite("idle");
        scheduleIdle();
      }
    }

    if (ballState.active && !closetOpen) {
      if (toyInteraction.phase === "idle") {
        toyInteraction.timer -= deltaSeconds;
        if (toyInteraction.timer <= 0) {
          if (
            state.current === "idle" &&
            !ballState.isAirborne &&
            !ballState.dragging &&
            !ballState.isHidden
          ) {
            toyInteraction.phase = "approach";
            scheduleMoveTo(ballState.x);
          } else {
            toyInteraction.timer = 3 + Math.random() * 4;
          }
        }
      } else if (toyInteraction.phase === "approach") {
        if (
          state.current === "idle" &&
          !ballState.isAirborne &&
          !ballState.dragging &&
          !ballState.isHidden &&
          Math.abs(oyachi.x - ballState.x) < 14
        ) {
          toyInteraction.phase = "hold";
          toyInteraction.timer = 0.35 + Math.random() * 0.15;
          setSpriteOverride("hold_ball");
          hideBall();
        }
        if (ballState.dragging || ballState.isAirborne) {
          toyInteraction.phase = "idle";
          toyInteraction.timer = 3 + Math.random() * 4;
          setSpriteOverride(null);
        }
      } else if (toyInteraction.phase === "hold") {
        toyInteraction.timer -= deltaSeconds;
        if (toyInteraction.timer <= 0) {
          setSpriteOverride(null);
          ballState.x = clampBallX(oyachi.x);
          ballState.depth = state.depth;
          tossBall(state.moveDirection || 1);
          toyInteraction.phase = "cooldown";
          toyInteraction.timer = 3 + Math.random() * 4;
          if (Math.random() < 0.4) {
            scheduleMove();
          }
        }
      } else if (toyInteraction.phase === "cooldown") {
        toyInteraction.timer -= deltaSeconds;
        if (toyInteraction.timer <= 0) {
          toyInteraction.phase = "idle";
          toyInteraction.timer = 3 + Math.random() * 4;
        }
      }
    } else if (toyInteraction.phase !== "idle") {
      toyInteraction.phase = "idle";
      toyInteraction.timer = 4;
      setSpriteOverride(null);
    }
    syncBallInteractivity();

    if (state.current === "move") {
      const depthLerp = clamp(delta * 0.02, 0, 1);
      state.depth += (state.depthTarget - state.depth) * depthLerp;
    }

    let hopHeight = 0;

    if (state.current === "move") {
      const hopPhase = ((performance.now() / 1000) * 2) % 1;
      hopHeight = Math.sin(hopPhase * Math.PI) * 12;
      const speed = 0.6 * delta;
      oyachi.x += state.moveDirection * speed;
      if (oyachi.x < roomLeft || oyachi.x > roomRight) {
        state.moveDirection *= -1;
        oyachi.x = clamp(oyachi.x, roomLeft, roomRight);
      }
      if (state.moveTargetX !== null) {
        if (
          (state.moveDirection < 0 && oyachi.x <= state.moveTargetX) ||
          (state.moveDirection > 0 && oyachi.x >= state.moveTargetX)
        ) {
          setState("idle");
          state.moveTargetX = null;
          state.depthTarget = state.depth;
          scheduleIdle();
        }
      }
    }

    if (state.current === "wake") {
      const progress = clamp(1 - state.wakeTimer / wakeTiming.duration, 0, 1);
      hopHeight = Math.sin(progress * Math.PI) * 14;
    }

    if (ballState.active) {
      if (!ballState.dragging) {
        const baseBallY = getBaseY(ballState.depth);
        if (ballState.isAirborne) {
          ballState.velocityY += ballConfig.gravity * deltaSeconds;
          ballState.y += ballState.velocityY * deltaSeconds;
          if (ballState.y >= baseBallY) {
            ballState.y = baseBallY;
            if (
              ballState.bounceCount < ballConfig.maxBounces &&
              Math.abs(ballState.velocityY) > ballConfig.minBounceSpeed
            ) {
              ballState.velocityY = -ballState.velocityY * ballConfig.bounceDamping;
              ballState.bounceCount += 1;
            } else {
              ballState.velocityY = 0;
              ballState.isAirborne = false;
            }
          }
        } else {
          ballState.y = baseBallY;
        }

        if (ballState.velocityX !== 0) {
          ballState.x += ballState.velocityX * deltaSeconds;
          ballState.x = clampBallX(ballState.x);
          ballState.velocityX *= ballState.isAirborne ? 0.985 : ballConfig.groundFriction;
          if (Math.abs(ballState.velocityX) < 2) {
            ballState.velocityX = 0;
          }
        }
      }
      updateBallSprite();
      if (
        state.current === "sleep" &&
        !ballState.isHidden &&
        Math.abs(oyachi.x - ballState.x) < 28 &&
        (ballState.isAirborne || Math.abs(ballState.velocityX) > 8 || ballState.dragging)
      ) {
        wakeFromSleep();
        registerActivity();
      }
    }

    const depthScale = getDepthScale(state.depth);
    const baseY = getBaseY(state.depth);
    if (state.current === "happy_jump_sequence" && state.happyJumpSequence) {
      const sequence = state.happyJumpSequence;
      const currentJump = sequence.jumps[sequence.index];
      const maxJumpHeight = Math.max(happyJumpTiming.minHeight, baseY - floorTopY - 12);
      const jumpHeight = clamp(currentJump.height, happyJumpTiming.minHeight, maxJumpHeight);
      sequence.phaseTimer += deltaSeconds;

      if (sequence.phase === "launch") {
        const progress = clamp(sequence.phaseTimer / currentJump.launchDuration, 0, 1);
        hopHeight = easeOutCubic(progress) * jumpHeight;
        if (progress >= 1) {
          sequence.phase = "apex";
          sequence.phaseTimer = 0;
        }
      } else if (sequence.phase === "apex") {
        hopHeight = jumpHeight;
        if (!sequence.apexHeartsSpawned) {
          spawnHappyJumpHearts(-hopHeight);
          sequence.apexHeartsSpawned = true;
        }
        if (sequence.phaseTimer >= currentJump.apexDuration) {
          sequence.phase = "fall";
          sequence.phaseTimer = 0;
        }
      } else if (sequence.phase === "fall") {
        const progress = clamp(sequence.phaseTimer / currentJump.fallDuration, 0, 1);
        hopHeight = (1 - easeInCubic(progress)) * jumpHeight;
        if (progress >= 1) {
          sequence.phase = "landing";
          sequence.phaseTimer = 0;
        }
      } else if (sequence.phase === "landing") {
        hopHeight = 0;
        const landingProgress = clamp(
          sequence.phaseTimer / currentJump.landingDuration,
          0,
          1
        );
        state.happyJumpLandingSquish = Math.sin(landingProgress * Math.PI);
        if (landingProgress >= 1) {
          state.happyJumpLandingSquish = 0;
          if (sequence.index < sequence.jumps.length - 1) {
            sequence.phase = "delay";
            sequence.phaseTimer = 0;
          } else {
            if (!sequence.finalLandingHeartsSpawned) {
              spawnHappyJumpHearts(0);
              sequence.finalLandingHeartsSpawned = true;
            }
            state.happyJumpSequence = null;
            setState("idle");
            showSprite("idle");
            scheduleIdle();
            petSpamCount = 0;
          }
        }
      } else if (sequence.phase === "delay") {
        hopHeight = 0;
        if (sequence.phaseTimer >= currentJump.delayDuration) {
          sequence.index += 1;
          sequence.phase = "launch";
          sequence.phaseTimer = 0;
          sequence.apexHeartsSpawned = false;
        }
      }
    }
    const verticalOffset =
      state.current === "move" ||
      state.current === "wake" ||
      state.current === "happy_jump_sequence"
        ? -hopHeight
        : 0;
    const FOOT_OFFSET = 6 * depthScale;
    oyachi.y = baseY + verticalOffset + FOOT_OFFSET;

    const bobActive =
      (state.current === "idle" || state.current === "sleep") && !petHoldActive;
    if (bobActive) {
      idleBobState.phase += ((Math.PI * 2) / idleBobTiming.period) * deltaSeconds;
    }
    const bobTarget = bobActive
      ? Math.sin(idleBobState.phase) * idleBobTiming.amplitude
      : 0;
    idleBobState.offset += (bobTarget - idleBobState.offset) * idleBobTiming.ease;

    const jumpMicroActive = state.current === "happy_jump_sequence";
    if (jumpMicroActive) {
      jumpMicroState.phase += ((Math.PI * 2) / jumpMicroTiming.period) * deltaSeconds;
    }
    const jumpOffsetTarget = jumpMicroActive
      ? Math.sin(jumpMicroState.phase) * jumpMicroTiming.amplitude
      : 0;
    const jumpSquashTarget = jumpMicroActive
      ? Math.sin(jumpMicroState.phase) * jumpMicroTiming.squash
      : 0;
    jumpMicroState.offset +=
      (jumpOffsetTarget - jumpMicroState.offset) * jumpMicroTiming.ease;
    jumpMicroState.squash +=
      (jumpSquashTarget - jumpMicroState.squash) * jumpMicroTiming.ease;
    oyachiVisual.y = idleBobState.offset + jumpMicroState.offset;
    oyachiVisual.scale.set(1 + jumpMicroState.squash, 1 - jumpMicroState.squash);


    let scaleX = depthScale;
    let scaleY = depthScale;

    if (state.current === "pet") {
      const elapsed = state.petDuration - state.petTimer;
      const pressEnd = petTiming.press;
      const holdEnd = petTiming.press + petTiming.hold;
      let squish = 0;
      if (elapsed <= pressEnd) {
        const t = clamp(elapsed / petTiming.press, 0, 1);
        squish = 1 - Math.pow(1 - t, 2);
      } else if (elapsed <= holdEnd) {
        squish = 1;
      } else {
        const t2 = clamp((elapsed - holdEnd) / petTiming.release, 0, 1);
        squish = Math.cos(t2 * Math.PI) * 0.5 + 0.5;
      }
      const squishX = 1.05 + squish * 0.03;
      const squishY = 0.93 - squish * 0.03;
      scaleX *= squishX;
      scaleY *= squishY;
    }

    if (state.current === "react_cute" || state.current === "react_ayo") {
      const squishSpeed =
        state.current === "react_ayo" ? petHoldTiming.ayoSquishSpeed : petHoldTiming.cuteSquishSpeed;
      const squishStrength = state.current === "react_ayo" ? 0.055 : 0.035;
      state.reactSquishTimer += deltaSeconds * squishSpeed;
      const squish = (Math.sin(state.reactSquishTimer * Math.PI * 2) + 1) * 0.5;
      const squishX = 1.03 + squish * squishStrength;
      const squishY = 0.96 - squish * squishStrength;
      scaleX *= squishX;
      scaleY *= squishY;
    }

    if (state.current === "happy_jump_sequence" && state.happyJumpLandingSquish > 0) {
      const squish = state.happyJumpLandingSquish;
      const squishX = 1.02 + squish * 0.04;
      const squishY = 0.98 - squish * 0.05;
      scaleX *= squishX;
      scaleY *= squishY;
    }

    oyachi.scale.set(scaleX, scaleY);

    const facingScale = state.moveDirection < 0 ? -1 : 1;
    oyachiSprites.forEach(({ sprite }) => {
      sprite.scale.x = baseSpriteScale * facingScale;
    });

    shadow.clear();
    const shadowWidth = 92;
    const shadowHeight = 22;
    const heightFactor = clamp(1 - hopHeight / 40, 0.78, 1);
    const depthShadowScale = 0.75 + state.depth * 0.45;
    const baseShadowAlpha = 0.08 + state.depth * 0.08;
    shadow.beginFill(0x111111, baseShadowAlpha + (1 - heightFactor) * 0.04);
    shadow.drawEllipse(
      0,
      0,
      shadowWidth * heightFactor * depthShadowScale,
      shadowHeight * heightFactor * depthShadowScale
    );
    shadow.endFill();
    shadow.x = oyachi.x;
    shadow.y = baseY + FOOT_OFFSET;

    ballShadow.clear();
    if (ballState.active && !ballState.isHidden) {
      const baseBallY = getBaseY(ballState.depth);
      const depthBallScale = getDepthScale(ballState.depth);
      const heightOffset = Math.max(0, baseBallY - ballState.y);
      const heightFactor = clamp(1 - heightOffset / 120, 0.55, 1);
      const ballShadowWidth = 44 * depthBallScale;
      const ballShadowHeight = 14 * depthBallScale;
      const ballShadowAlpha = 0.08 + ballState.depth * 0.06 + (1 - heightFactor) * 0.05;
      ballShadow.beginFill(0x111111, ballShadowAlpha);
      ballShadow.drawEllipse(
        0,
        0,
        ballShadowWidth * heightFactor,
        ballShadowHeight * heightFactor,
      );
      ballShadow.endFill();
      ballShadow.x = ballState.x;
      ballShadow.y = baseBallY;
    }


    for (let i = activeHearts.length - 1; i >= 0; i -= 1) {
      const heart = activeHearts[i];
      heart.age += deltaSeconds;
      const progress = clamp(heart.age / heart.lifetime, 0, 1);
      heart.wobbleTime += deltaSeconds;
      heart.sprite.y -= heart.speed * deltaSeconds;
      heart.sprite.x =
        heart.baseX +
        Math.sin(heart.wobbleTime * 6 + heart.wobblePhase) * heart.wobbleAmplitude;
      heart.sprite.alpha = heart.baseAlpha * (1 - progress);
      if (heart.age >= heart.lifetime) {
        heart.active = false;
        heart.sprite.visible = false;
        activeHearts.splice(i, 1);
      }
    }
  });

  stage.on("pointerup", (event) => handlePetPointerUp(event, "pointerup"));
  stage.on("pointerupoutside", (event) => handlePetPointerUp(event, "pointerupoutside"));
  stage.on("pointerleave", (event) => handlePetPointerUp(event, "pointerleave"));
  stage.on("pointermove", (event) => {
    if (handleBallPointerMove(event)) {
      event.stopPropagation();
      return;
    }
    handlePetPointerMove(event);
  });
  stage.on("pointerdown", (event) => {
    if (!optionsMenu.visible) {
      return;
    }
    const global = event.data.global;
    const menuBounds = optionsMenu.getBounds();
    const settingsBounds = settingsButton.container.getBounds();
    if (!menuBounds.contains(global.x, global.y) && !settingsBounds.contains(global.x, global.y)) {
      setMenuVisible(false);
      settingsButton.container.alpha = 0.18;
    }
  });

  registerAppListener(app, window, "pointermove", handleWindowPointerMove);

  registerAppListener(app, window, "pointerup", (event) => {
    handlePetPointerUp(event, "window_pointerup");
    handleBallPointerUp(event);
  });

  registerAppListener(app, window, "pointercancel", (event) => {
    handlePetPointerUp(event, "pointercancel");
    handleBallPointerUp(event);
  });

  registerAppListener(app, window, "blur", () => {
    cancelPointerInteractions({ loopOptions: { immediate: true }, reason: "blur" });
    audioSystem.stopAllLoops({ immediate: true });
  });

  registerAppListener(app, document, "visibilitychange", () => {
    if (document.hidden) {
      cancelPointerInteractions({ loopOptions: { immediate: true }, reason: "hidden" });
      audioSystem.stopAllLoops({ immediate: true });
    }
  });

  return {
    stage,
    setGameStarted: () => {
      if (gameStarted) {
        return;
      }
      gameStarted = true;
      const now = performance.now();
      markHintsSeen();
      if (hintsEnabled) {
        hintState.pendingDelayUntil = now + 1800;
        hintState.nextAllowedAt = now + 2200;
        seedHints();
      }
    },
  };
};

export const createMainScene = ({ textures, gameRoot }) =>
  initGame({ textures, gameRoot });
