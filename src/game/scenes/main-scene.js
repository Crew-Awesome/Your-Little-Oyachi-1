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
  hintOverlay.roundPixels = true;
  const hintBackground = new PIXI.Graphics();
  const hintText = createPixelText("", {
    fontSize: 12,
    fill: 0x111111,
    align: "left",
  });
  hintText.anchor.set(0, 0.5);
  hintText.roundPixels = true;
  hintText.eventMode = "none";

  const hintClose = new PIXI.Container();
  hintClose.eventMode = "static";
  hintClose.cursor = "pointer";
  hintClose.roundPixels = true;
  const hintCloseBg = new PIXI.Graphics();
  const hintCloseIcon = new PIXI.Graphics();
  hintClose.addChild(hintCloseBg, hintCloseIcon);

  hintOverlay.addChild(hintBackground, hintText, hintClose);
  uiLayer.addChild(hintOverlay);

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
    fadeIn: 0.2,
    hold: 2.4,
    fadeOut: 0.3,
    gap: 1.4,
  };
  const hintAlpha = 1;

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
    test: { text: "Hint test: Oyachi is listening.", cooldownMs: 0, chance: 1 },
  };

  const hintState = {
    phase: "hidden",
    timer: 0,
    queue: [],
    lastShown: new Map(),
    nextAllowedAt: 0,
    activeId: null,
  };
  let hintToggleRow = null;

  const setHintsEnabled = (enabled, { persist = true } = {}) => {
    hintsEnabled = Boolean(enabled);
    if (persist) {
      localStorage.setItem(hintStorageKeys.enabled, String(hintsEnabled));
    }
    if (hintToggleRow) {
      hintToggleRow.setEnabled(hintsEnabled);
      if (hintToggleRow.applyLayout && hintToggleRow.lastLayout) {
        hintToggleRow.applyLayout(hintToggleRow.lastLayout, hintToggleRow.lastPosition);
      }
    }
    if (!hintsEnabled) {
      hintState.phase = "hidden";
      hintState.timer = 0;
      hintState.queue = [];
      hintState.activeId = null;
      hintOverlay.alpha = 0;
      hintOverlay.visible = false;
    } else {
      hintOverlay.visible = false;
      hintState.phase = "hidden";
      hintState.timer = 0;
      hintState.activeId = null;
      hintState.nextAllowedAt = performance.now() + 400;
    }
  };

  const markHintsSeen = () => {
    if (hintsSeen) {
      return;
    }
    hintsSeen = true;
    localStorage.setItem(hintStorageKeys.seen, "true");
  };

  const showHintNow = (id, { force = false } = {}) => {
    if (!hintsEnabled) {
      return false;
    }
    const config = hintConfig[id];
    if (!config) {
      return false;
    }
    const now = performance.now();
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
    updateHintLayout(getLayoutBounds());
    hintState.phase = "fadein";
    hintState.timer = 0;
    hintState.activeId = id;
    hintState.lastShown.set(id, now);
    hintState.nextAllowedAt = now + hintTiming.gap * 1000;
    return true;
  };

  const tryShowNextHint = (now) => {
    if (!hintsEnabled) {
      return;
    }
    if (hintState.phase !== "hidden") {
      return;
    }
    if (now < hintState.nextAllowedAt) {
      return;
    }
    const nextIndex = hintState.queue.findIndex((entry) => entry.availableAt <= now);
    if (nextIndex === -1) {
      return;
    }
    const [entry] = hintState.queue.splice(nextIndex, 1);
    if (entry) {
      showHintNow(entry.id, { force: entry.force });
    }
  };

  const showHint = (id, { priority = false, delayMs = 0, force = false } = {}) => {
    if (!hintsEnabled) {
      return false;
    }
    if (!hintConfig[id]) {
      return false;
    }
    if (hintState.activeId === id || hintState.queue.some((entry) => entry.id === id)) {
      return false;
    }
    const availableAt = performance.now() + Math.max(0, delayMs);
    const entry = { id, availableAt, force: Boolean(force) };
    if (priority) {
      hintState.queue.unshift(entry);
    } else {
      hintState.queue.push(entry);
    }
    tryShowNextHint(performance.now());
    return true;
  };

  const dismissHint = () => {
    if (hintState.phase === "hidden") {
      return;
    }
    hintState.phase = "hidden";
    hintState.timer = 0;
    hintState.activeId = null;
    hintOverlay.alpha = 0;
    hintOverlay.visible = false;
    hintState.nextAllowedAt = performance.now() + hintTiming.gap * 1000;
  };

  const updateHint = (deltaSeconds) => {
    if (!hintsEnabled) {
      if (hintOverlay.visible) {
        hintOverlay.alpha = 0;
        hintOverlay.visible = false;
      }
      return;
    }
    if (hintState.phase !== "hidden") {
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
          hintState.activeId = null;
          hintOverlay.alpha = 0;
          hintOverlay.visible = false;
        }
      }
      return;
    }
    tryShowNextHint(performance.now());
  };

  const seedHints = () => {
    showHint("pet", { priority: true, delayMs: 1200 });
    showHint("toys");
    showHint("fullscreen");
    showHint("settings");
    showHint("costumes");
  };

  hintClose.on("pointerdown", (event) => {
    event.stopPropagation();
    dismissHint();
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

  const settingsLayout = {
    width: 248,
    height: 176,
    radius: 6,
    padding: 12,
    tabHeight: 22,
    tabWidth: 64,
    tabGap: 6,
    contentGap: 10,
    rowHeight: 28,
    rowGap: 8,
    labelWidth: 64,
    sliderWidth: 90,
    sliderHeight: 6,
    knobSize: 10,
    sliderGap: 8,
    buttonWidth: 26,
    buttonHeight: 16,
    buttonGap: 4,
    toggleWidth: 30,
    toggleHeight: 16,
  };

  const settingsColors = {
    panel: 0xf3e9db,
    panelBorder: 0xd6c6b2,
    tabActive: 0xffffff,
    tabIdle: 0xe2d5c4,
    tabHover: 0xe9dece,
    tabPressed: 0xd9cbb8,
    text: 0x111111,
    textMuted: 0x6b5f52,
    track: 0xd8ccb9,
    trackHover: 0xd0c2b0,
    trackActive: 0xc6b7a5,
    fill: 0x8a7c69,
    knob: 0x111111,
    knobActive: 0x2b2218,
    buttonIdle: 0xe2d5c4,
    buttonHover: 0xd7c9b6,
    buttonPressed: 0xc9b9a2,
    buttonActive: 0x8a7c69,
    buttonActiveText: 0xffffff,
    toggleOff: 0xe2d5c4,
    toggleOn: 0x8a7c69,
    tileIdle: 0xe6d8c7,
    tileActive: 0xc8b89f,
    tileHover: 0xddcfbe,
  };

  const settingsTabs = [
    { id: "audio", label: "Audio" },
    { id: "hints", label: "Hints" },
    { id: "other", label: "Other" },
  ];

  const menuBackground = new PIXI.Graphics();
  optionsMenu.addChild(menuBackground);

  const tabsRow = new PIXI.Container();
  optionsMenu.addChild(tabsRow);

  const settingsContent = new PIXI.Container();
  optionsMenu.addChild(settingsContent);

  const audioTab = new PIXI.Container();
  const hintsTab = new PIXI.Container();
  const otherTab = new PIXI.Container();
  settingsContent.addChild(audioTab, hintsTab, otherTab);

  const settingsState = {
    hovering: false,
    activeTab: "audio",
  };

  const createTabButton = (tab) => {
    const container = new PIXI.Container();
    container.eventMode = "static";
    container.cursor = "pointer";
    const bg = new PIXI.Graphics();
    const text = createPixelText(tab.label, {
      fontSize: 12,
      fill: settingsColors.text,
      align: "center",
    });
    text.anchor.set(0.5);
    container.addChild(bg, text);
    const state = {
      hovered: false,
      pressed: false,
      width: 0,
      height: 0,
    };
    const update = () => {
      let fill = settingsColors.tabIdle;
      if (settingsState.activeTab === tab.id) {
        fill = settingsColors.tabActive;
      } else if (state.pressed) {
        fill = settingsColors.tabPressed;
      } else if (state.hovered) {
        fill = settingsColors.tabHover;
      }
      bg.clear();
      bg.beginFill(fill, 1);
      bg.drawRect(0, 0, state.width, state.height);
      bg.endFill();
      text.x = Math.round(state.width / 2);
      text.y = Math.round(state.height / 2);
    };
    const applyLayout = ({ width, height, x, y }) => {
      state.width = width;
      state.height = height;
      container.x = x;
      container.y = y;
      container.hitArea = new PIXI.Rectangle(0, 0, width, height);
      update();
    };
    container.on("pointerenter", () => {
      state.hovered = true;
      update();
    });
    container.on("pointerleave", () => {
      state.hovered = false;
      state.pressed = false;
      update();
    });
    container.on("pointerdown", (event) => {
      state.pressed = true;
      update();
      setActiveTab(tab.id);
      event.stopPropagation();
    });
    container.on("pointerup", () => {
      state.pressed = false;
      update();
    });
    container.on("pointerupoutside", () => {
      state.pressed = false;
      update();
    });
    return { container, applyLayout, update };
  };

  const tabButtons = settingsTabs.map((tab) => createTabButton(tab));
  tabButtons.forEach((button) => tabsRow.addChild(button.container));

  const setActiveTab = (id) => {
    settingsState.activeTab = id;
    audioTab.visible = id === "audio";
    hintsTab.visible = id === "hints";
    otherTab.visible = id === "other";
    tabButtons.forEach((button) => button.update());
  };

  setActiveTab(settingsState.activeTab);

  const sliderState = {
    active: null,
    pointerId: null,
  };

  const createTextButton = (label) => {
    const container = new PIXI.Container();
    container.eventMode = "static";
    container.cursor = "pointer";
    const bg = new PIXI.Graphics();
    const text = createPixelText(label, {
      fontSize: 10,
      fill: settingsColors.text,
      align: "center",
    });
    text.anchor.set(0.5);
    container.addChild(bg, text);
    const state = {
      active: false,
      hovered: false,
      pressed: false,
      width: 0,
      height: 0,
    };
    const update = () => {
      let fill = settingsColors.buttonIdle;
      let textColor = settingsColors.text;
      if (state.active) {
        fill = settingsColors.buttonActive;
        textColor = settingsColors.buttonActiveText;
      } else if (state.pressed) {
        fill = settingsColors.buttonPressed;
      } else if (state.hovered) {
        fill = settingsColors.buttonHover;
      }
      bg.clear();
      bg.beginFill(fill, 1);
      bg.drawRect(0, 0, state.width, state.height);
      bg.endFill();
      text.style.fill = textColor;
      text.x = Math.round(state.width / 2);
      text.y = Math.round(state.height / 2);
    };
    const setLayout = (width, height) => {
      state.width = width;
      state.height = height;
      container.hitArea = new PIXI.Rectangle(0, 0, width, height);
      update();
    };
    const setActive = (active) => {
      state.active = active;
      update();
    };
    container.on("pointerenter", () => {
      state.hovered = true;
      update();
    });
    container.on("pointerleave", () => {
      state.hovered = false;
      state.pressed = false;
      update();
    });
    container.on("pointerdown", () => {
      state.pressed = true;
      update();
    });
    container.on("pointerup", () => {
      state.pressed = false;
      update();
    });
    container.on("pointerupoutside", () => {
      state.pressed = false;
      update();
    });
    return { container, setLayout, setActive, update };
  };

  const createSliderRow = ({ label, value, enabled, onChange, onToggle }) => {
    const container = new PIXI.Container();
    container.eventMode = "static";
    const labelText = createPixelText(label, {
      fontSize: 12,
      fill: settingsColors.text,
      align: "left",
    });
    labelText.anchor.set(0, 0.5);
    const trackBg = new PIXI.Graphics();
    const trackFill = new PIXI.Graphics();
    const knob = new PIXI.Graphics();
    const onButton = createTextButton("On");
    const offButton = createTextButton("Off");
    container.addChild(labelText, trackBg, trackFill, knob, onButton.container, offButton.container);
    const sliderData = {
      container,
      labelText,
      trackBg,
      trackFill,
      knob,
      onButton,
      offButton,
      value,
      enabled,
      onChange,
      onToggle,
      trackX: 0,
      trackY: 0,
      trackWidth: 0,
      trackHeight: 0,
      knobSize: 0,
      hover: false,
      active: false,
      lastLayout: null,
      lastPosition: null,
      updateFromGlobal: null,
      applyLayout: null,
      setActive: null,
      setEnabled: null,
      refresh: null,
    };

    const drawTrack = () => {
      const displayValue = sliderData.enabled ? sliderData.value : 0;
      const fillWidth = Math.round(sliderData.trackWidth * displayValue);
      let trackColor = settingsColors.track;
      let knobColor = settingsColors.knob;
      if (sliderData.active) {
        trackColor = settingsColors.trackActive;
        knobColor = settingsColors.knobActive;
      } else if (sliderData.hover) {
        trackColor = settingsColors.trackHover;
      }
      trackBg.clear();
      trackBg.beginFill(trackColor, 1);
      trackBg.drawRect(sliderData.trackX, sliderData.trackY, sliderData.trackWidth, sliderData.trackHeight);
      trackBg.endFill();
      trackFill.clear();
      trackFill.beginFill(settingsColors.fill, 1);
      trackFill.drawRect(sliderData.trackX, sliderData.trackY, fillWidth, sliderData.trackHeight);
      trackFill.endFill();
      knob.clear();
      knob.beginFill(knobColor, 1);
      knob.drawRect(0, 0, sliderData.knobSize, sliderData.knobSize);
      knob.endFill();
      knob.x = Math.round(sliderData.trackX + sliderData.trackWidth * displayValue - sliderData.knobSize / 2);
      knob.y = Math.round(sliderData.trackY - (sliderData.knobSize - sliderData.trackHeight) / 2);
      labelText.alpha = sliderData.enabled ? 1 : 0.6;
    };

    const setValue = (newValue, { notify = false } = {}) => {
      sliderData.value = clamp(newValue, 0, 1);
      drawTrack();
      if (notify && typeof sliderData.onChange === "function") {
        sliderData.onChange(sliderData.value);
      }
    };

    const updateFromGlobal = (global) => {
      if (!sliderData.enabled) {
        return;
      }
      const local = container.toLocal(global);
      const raw = (local.x - sliderData.trackX) / sliderData.trackWidth;
      setValue(raw, { notify: true });
    };

    sliderData.updateFromGlobal = updateFromGlobal;

    const setActive = (active) => {
      sliderData.active = active;
      drawTrack();
    };

    sliderData.setActive = setActive;

    const setEnabled = (enabledState) => {
      sliderData.enabled = Boolean(enabledState);
      drawTrack();
      onButton.setActive(sliderData.enabled);
      offButton.setActive(!sliderData.enabled);
    };

    sliderData.setEnabled = setEnabled;

    sliderData.refresh = drawTrack;

    const applyLayout = (layout, position) => {
      sliderData.lastLayout = layout;
      sliderData.lastPosition = position;
      container.x = position.x;
      container.y = position.y;
      labelText.style.fontSize = layout.labelFontSize;
      labelText.x = 0;
      labelText.y = Math.round(layout.rowHeight / 2);
      sliderData.trackX = layout.labelWidth + layout.sliderGap;
      sliderData.trackY = Math.round((layout.rowHeight - layout.sliderHeight) / 2);
      sliderData.trackWidth = layout.sliderWidth;
      sliderData.trackHeight = layout.sliderHeight;
      sliderData.knobSize = layout.knobSize;
      onButton.setLayout(layout.buttonWidth, layout.buttonHeight);
      offButton.setLayout(layout.buttonWidth, layout.buttonHeight);
      const buttonsX =
        sliderData.trackX + layout.sliderWidth + layout.buttonGap;
      const buttonsY = Math.round((layout.rowHeight - layout.buttonHeight) / 2);
      onButton.container.x = Math.round(buttonsX);
      onButton.container.y = buttonsY;
      offButton.container.x = Math.round(buttonsX + layout.buttonWidth + layout.buttonGap);
      offButton.container.y = buttonsY;
      container.hitArea = new PIXI.Rectangle(0, 0, layout.rowWidth, layout.rowHeight);
      drawTrack();
      onButton.setActive(sliderData.enabled);
      offButton.setActive(!sliderData.enabled);
    };

    sliderData.applyLayout = applyLayout;

    container.on("pointerenter", () => {
      sliderData.hover = true;
      drawTrack();
    });
    container.on("pointerleave", () => {
      sliderData.hover = false;
      if (sliderState.active !== sliderData) {
        sliderData.active = false;
      }
      drawTrack();
    });

    container.on("pointerdown", (event) => {
      if (!sliderData.enabled) {
        event.stopPropagation();
        return;
      }
      sliderState.active = sliderData;
      sliderState.pointerId = getPointerId(event);
      sliderData.setActive(true);
      updateFromGlobal(event.data.global);
      event.stopPropagation();
    });

    onButton.container.on("pointerdown", (event) => {
      if (!sliderData.enabled) {
        sliderData.enabled = true;
        if (typeof sliderData.onToggle === "function") {
          sliderData.onToggle(true);
        }
      }
      if (typeof sliderData.syncWithAudio === "function") {
        sliderData.syncWithAudio();
      }
      setEnabled(true);
      event.stopPropagation();
    });

    offButton.container.on("pointerdown", (event) => {
      if (sliderData.enabled) {
        sliderData.enabled = false;
        if (typeof sliderData.onToggle === "function") {
          sliderData.onToggle(false);
        }
      }
      if (typeof sliderData.syncWithAudio === "function") {
        sliderData.syncWithAudio();
      }
      setEnabled(false);
      event.stopPropagation();
    });

    setValue(value);
    return sliderData;
  };

  const createToggleRow = ({ label, enabled, onToggle }) => {
    const container = new PIXI.Container();
    container.eventMode = "static";
    const labelText = createPixelText(label, {
      fontSize: 12,
      fill: settingsColors.text,
      align: "left",
    });
    labelText.anchor.set(0, 0.5);
    const toggle = new PIXI.Container();
    toggle.eventMode = "static";
    toggle.cursor = "pointer";
    const toggleBg = new PIXI.Graphics();
    const toggleKnob = new PIXI.Graphics();
    toggle.addChild(toggleBg, toggleKnob);
    container.addChild(labelText, toggle);
    const rowData = {
      container,
      labelText,
      toggle,
      toggleBg,
      toggleKnob,
      enabled,
      onToggle,
      hover: false,
      lastLayout: null,
      lastPosition: null,
      applyLayout: null,
      setEnabled: null,
    };

    const drawToggle = () => {
      const layout = rowData.lastLayout;
      if (!layout) {
        return;
      }
      const baseFill = rowData.enabled ? settingsColors.toggleOn : settingsColors.toggleOff;
      const hoverFill = rowData.enabled ? settingsColors.toggleOn : settingsColors.tabHover;
      const fill = rowData.hover ? hoverFill : baseFill;
      toggleBg.clear();
      toggleBg.beginFill(fill, 1);
      toggleBg.drawRect(0, 0, layout.toggleWidth, layout.toggleHeight);
      toggleBg.endFill();
      const knobSize = layout.toggleHeight - 4;
      const knobX = rowData.enabled
        ? layout.toggleWidth - knobSize - 2
        : 2;
      toggleKnob.clear();
      toggleKnob.beginFill(0x111111, 1);
      toggleKnob.drawRect(0, 0, knobSize, knobSize);
      toggleKnob.endFill();
      toggleKnob.x = Math.round(knobX);
      toggleKnob.y = 2;
    };

    const setEnabled = (enabledState) => {
      rowData.enabled = Boolean(enabledState);
      drawToggle();
    };

    rowData.setEnabled = setEnabled;

    const applyLayout = (layout, position) => {
      rowData.lastLayout = layout;
      rowData.lastPosition = position;
      container.x = position.x;
      container.y = position.y;
      labelText.style.fontSize = layout.labelFontSize;
      labelText.x = 0;
      labelText.y = Math.round(layout.rowHeight / 2);
      toggle.x = layout.rowWidth - layout.toggleWidth;
      toggle.y = Math.round(layout.rowHeight / 2 - layout.toggleHeight / 2);
      toggle.hitArea = new PIXI.Rectangle(0, 0, layout.toggleWidth, layout.toggleHeight);
      container.hitArea = new PIXI.Rectangle(0, 0, layout.rowWidth, layout.rowHeight);
      drawToggle();
    };

    rowData.applyLayout = applyLayout;

    toggle.on("pointerenter", () => {
      rowData.hover = true;
      drawToggle();
    });
    toggle.on("pointerleave", () => {
      rowData.hover = false;
      drawToggle();
    });
    toggle.on("pointerdown", (event) => {
      rowData.enabled = !rowData.enabled;
      if (typeof rowData.onToggle === "function") {
        rowData.onToggle(rowData.enabled);
      }
      drawToggle();
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
    slider.value = getVolume();
    slider.setEnabled(getEnabled());
    slider.refresh();
  };

  const musicSlider = createSliderRow({
    label: "Music",
    value: audioSystem.getMusicEnabled() ? audioSystem.getMusicVolume() : 0,
    enabled: audioSystem.getMusicEnabled(),
    onChange: saveMusicVolume,
    onToggle: saveMusicEnabled,
  });
  musicSlider.syncWithAudio = () => {
    syncSliderToAudio(musicSlider, audioSystem.getMusicVolume, audioSystem.getMusicEnabled);
  };
  const sfxSlider = createSliderRow({
    label: "SFX",
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
    enabled: hintsEnabled,
    onToggle: saveHintsEnabled,
  });
  audioTab.addChild(musicSlider.container, sfxSlider.container);
  hintsTab.addChild(hintToggleRow.container);

  const sliders = [musicSlider, sfxSlider];

  const toysButton = createIconButton({
    texture: textures.ui_toys,
    defaultAlpha: 0.22,
  });
  const clothesButton = createIconButton({
    texture: textures.ui_costumes,
    defaultAlpha: 0.22,
  });
  uiLayer.addChild(toysButton.container, clothesButton.container);

  const toyPanelLayout = {
    width: 200,
    height: 112,
    radius: 6,
    padding: 10,
    titleHeight: 16,
    titleGap: 8,
    columns: 2,
    tileWidth: 74,
    tileHeight: 48,
    tileGap: 8,
    iconSize: 18,
  };

  const toysPanel = new PIXI.Container();
  toysPanel.visible = false;
  toysPanel.eventMode = "static";
  uiLayer.addChild(toysPanel);

  const toysPanelBackground = new PIXI.Graphics();
  const toysPanelTitle = createPixelText("Toys", {
    fontSize: 12,
    fill: settingsColors.text,
    align: "left",
  });
  toysPanelTitle.anchor.set(0, 0.5);
  const toysGrid = new PIXI.Container();
  toysPanel.addChild(toysPanelBackground, toysPanelTitle, toysGrid);

  const toysList = [
    { id: "ball", label: "Ball", texture: textures.ball },
  ];
  const toyTiles = new Map();
  const activeToys = new Set();

  const updateToyTiles = () => {
    toyTiles.forEach((tile, id) => {
      tile.setActive(activeToys.has(id));
    });
  };

  const toggleToy = (id) => {
    if (activeToys.has(id)) {
      activeToys.delete(id);
      if (id === "ball") {
        disableBall();
      }
    } else {
      activeToys.add(id);
      if (id === "ball") {
        spawnBallAt(oyachi.x);
      }
    }
    updateToyTiles();
  };

  const createToyTile = (toy) => {
    const container = new PIXI.Container();
    container.eventMode = "static";
    container.cursor = "pointer";
    const bg = new PIXI.Graphics();
    const icon = new PIXI.Sprite(toy.texture);
    icon.anchor.set(0.5);
    icon.roundPixels = true;
    const label = createPixelText(toy.label, {
      fontSize: 10,
      fill: settingsColors.text,
      align: "center",
    });
    label.anchor.set(0.5);
    container.addChild(bg, icon, label);
    const tileState = {
      active: false,
      hover: false,
    };
    const updateVisuals = () => {
      let fill = settingsColors.tileIdle;
      if (tileState.active) {
        fill = settingsColors.tileActive;
      } else if (tileState.hover) {
        fill = settingsColors.tileHover;
      }
      bg.clear();
      bg.beginFill(fill, 1);
      bg.drawRect(0, 0, toyPanelLayout.tileWidth, toyPanelLayout.tileHeight);
      bg.endFill();
      icon.alpha = tileState.active ? 1 : 0.55;
      label.style.fill = tileState.active ? settingsColors.text : settingsColors.textMuted;
    };
    const setActive = (active) => {
      tileState.active = active;
      updateVisuals();
    };
    const setHover = (hover) => {
      tileState.hover = hover;
      updateVisuals();
    };
    container.on("pointerenter", () => {
      setHover(true);
    });
    container.on("pointerleave", () => {
      setHover(false);
    });
    container.on("pointerdown", (event) => {
      toggleToy(toy.id);
      event.stopPropagation();
    });
    updateVisuals();
    return { container, bg, icon, label, setActive, setHover };
  };

  toysList.forEach((toy) => {
    const tile = createToyTile(toy);
    toyTiles.set(toy.id, tile);
    toysGrid.addChild(tile.container);
  });

  updateToyTiles();

  const uiScaleState = {
    compact: false,
    scale: 1,
    iconScale: 1,
    bottomIconScale: 1,
    bottomIconSpacing: 0,
    menuBoost: 1,
    menuWidth: settingsLayout.width,
    menuHeight: settingsLayout.height,
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

    const panelWidth = Math.round(settingsLayout.width * uiScaleState.menuBoost);
    const panelHeight = Math.round(settingsLayout.height * uiScaleState.menuBoost);
    const panelRadius = Math.round(settingsLayout.radius * uiScaleState.menuBoost);
    const padding = Math.round(settingsLayout.padding * uiScaleState.menuBoost);
    const tabHeight = Math.round(settingsLayout.tabHeight * uiScaleState.menuBoost);
    const tabWidth = Math.round(settingsLayout.tabWidth * uiScaleState.menuBoost);
    const tabGap = Math.round(settingsLayout.tabGap * uiScaleState.menuBoost);
    const contentGap = Math.round(settingsLayout.contentGap * uiScaleState.menuBoost);
    const rowHeight = Math.round(settingsLayout.rowHeight * uiScaleState.menuBoost);
    const rowGap = Math.round(settingsLayout.rowGap * uiScaleState.menuBoost);
    const labelWidth = Math.round(settingsLayout.labelWidth * uiScaleState.menuBoost);
    const sliderWidth = Math.round(settingsLayout.sliderWidth * uiScaleState.menuBoost);
    const sliderHeight = Math.round(settingsLayout.sliderHeight * uiScaleState.menuBoost);
    const knobSize = Math.round(settingsLayout.knobSize * uiScaleState.menuBoost);
    const sliderGap = Math.round(settingsLayout.sliderGap * uiScaleState.menuBoost);
    const buttonWidth = Math.round(settingsLayout.buttonWidth * uiScaleState.menuBoost);
    const buttonHeight = Math.round(settingsLayout.buttonHeight * uiScaleState.menuBoost);
    const buttonGap = Math.round(settingsLayout.buttonGap * uiScaleState.menuBoost);
    const toggleWidth = Math.round(settingsLayout.toggleWidth * uiScaleState.menuBoost);
    const toggleHeight = Math.round(settingsLayout.toggleHeight * uiScaleState.menuBoost);
    const contentWidth = Math.max(1, panelWidth - padding * 2);

    menuBackground.clear();
    menuBackground.beginFill(settingsColors.panel, 1);
    menuBackground.lineStyle(1, settingsColors.panelBorder, 1);
    menuBackground.drawRoundedRect(0, 0, panelWidth, panelHeight, panelRadius);
    menuBackground.endFill();

    uiScaleState.menuWidth = panelWidth;
    uiScaleState.menuHeight = panelHeight;

    tabsRow.x = padding;
    tabsRow.y = padding;
    tabButtons.forEach((button, index) => {
      button.applyLayout({
        width: tabWidth,
        height: tabHeight,
        x: Math.round(index * (tabWidth + tabGap)),
        y: 0,
      });
    });

    const contentX = padding;
    const contentY = padding + tabHeight + contentGap;
    audioTab.x = contentX;
    audioTab.y = contentY;
    hintsTab.x = contentX;
    hintsTab.y = contentY;
    otherTab.x = contentX;
    otherTab.y = contentY;

    const sliderLayout = {
      rowWidth: contentWidth,
      rowHeight,
      rowGap,
      labelWidth,
      sliderWidth,
      sliderHeight,
      knobSize,
      sliderGap,
      buttonWidth,
      buttonHeight,
      buttonGap,
      labelFontSize: Math.round(12 * uiScaleState.menuBoost),
    };

    sliders.forEach((slider, index) => {
      slider.applyLayout(sliderLayout, {
        x: 0,
        y: Math.round(index * (rowHeight + rowGap)),
      });
    });

    if (hintToggleRow) {
      const toggleLayout = {
        rowWidth: contentWidth,
        rowHeight,
        toggleWidth,
        toggleHeight,
        labelFontSize: Math.round(12 * uiScaleState.menuBoost),
      };
      hintToggleRow.applyLayout(toggleLayout, { x: 0, y: 0 });
    }

    const toyPanelScale = uiScaleState.menuBoost;
    toysPanel.scale.set(toyPanelScale);
    toysPanelBackground.clear();
    toysPanelBackground.beginFill(settingsColors.panel, 1);
    toysPanelBackground.lineStyle(1, settingsColors.panelBorder, 1);
    toysPanelBackground.drawRoundedRect(
      0,
      0,
      toyPanelLayout.width,
      toyPanelLayout.height,
      toyPanelLayout.radius,
    );
    toysPanelBackground.endFill();
    toysPanelTitle.x = toyPanelLayout.padding;
    toysPanelTitle.y = Math.round(toyPanelLayout.padding + toyPanelLayout.titleHeight / 2);
    const gridX = toyPanelLayout.padding;
    const gridY = toyPanelLayout.padding + toyPanelLayout.titleHeight + toyPanelLayout.titleGap;
    toysList.forEach((toy, index) => {
      const tile = toyTiles.get(toy.id);
      if (!tile) {
        return;
      }
      const col = index % toyPanelLayout.columns;
      const row = Math.floor(index / toyPanelLayout.columns);
      tile.container.x = Math.round(
        gridX + col * (toyPanelLayout.tileWidth + toyPanelLayout.tileGap),
      );
      tile.container.y = Math.round(
        gridY + row * (toyPanelLayout.tileHeight + toyPanelLayout.tileGap),
      );
      tile.container.hitArea = new PIXI.Rectangle(
        0,
        0,
        toyPanelLayout.tileWidth,
        toyPanelLayout.tileHeight,
      );
      const iconScale =
        toyPanelLayout.iconSize /
        getTextureDimension(tile.icon.texture, "width", toyPanelLayout.iconSize);
      tile.icon.scale.set(iconScale);
      tile.icon.x = Math.round(toyPanelLayout.tileWidth / 2);
      tile.icon.y = Math.round(toyPanelLayout.tileHeight / 2 - 6);
      tile.label.style.fontSize = 10;
      tile.label.x = Math.round(toyPanelLayout.tileWidth / 2);
      tile.label.y = Math.round(toyPanelLayout.tileHeight - 10);
    });
    uiScaleState.toyPanelWidth = toyPanelLayout.width * toyPanelScale;
    uiScaleState.toyPanelHeight = toyPanelLayout.height * toyPanelScale;
    updateToyTiles();
  };

  const updateHintLayout = (layout) => {
    if (!hintOverlay.visible) {
      return;
    }
    const scale = uiScaleState.scale;
    const maxWidth = Math.min(layout.width - 24, 460);
    hintText.style.fontSize = Math.round(12 * scale);
    hintText.scale.set(1);
    const paddingX = Math.round(10 * scale);
    const paddingY = Math.round(6 * scale);
    const closeSize = Math.round(12 * scale);
    const closeGap = Math.round(8 * scale);
    const textMaxWidth = Math.max(1, maxWidth - paddingX * 2 - closeSize - closeGap);
    const textScale = Math.min(1, textMaxWidth / Math.max(1, hintText.width));
    hintText.scale.set(textScale);

    const rawWidth = hintText.width + paddingX * 2 + closeSize + closeGap;
    const panelWidth = Math.min(rawWidth, maxWidth);
    const panelHeight = Math.max(Math.round(hintText.height + paddingY * 2), Math.round(22 * scale));

    hintOverlay.x = Math.round(layout.centerX);
    hintOverlay.y = Math.round(layout.top + 14 * scale);

    hintBackground.clear();
    hintBackground.lineStyle(1, 0x111111, 1);
    hintBackground.beginFill(0xf4eee6, 1);
    hintBackground.drawRect(-panelWidth / 2, 0, panelWidth, panelHeight);
    hintBackground.endFill();

    hintText.x = Math.round(-panelWidth / 2 + paddingX);
    hintText.y = Math.round(panelHeight / 2);

    hintClose.x = Math.round(panelWidth / 2 - paddingX - closeSize);
    hintClose.y = Math.round((panelHeight - closeSize) / 2);
    hintCloseBg.clear();
    hintCloseBg.lineStyle(1, 0x111111, 1);
    hintCloseBg.beginFill(0xf4eee6, 1);
    hintCloseBg.drawRect(0, 0, closeSize, closeSize);
    hintCloseBg.endFill();
    hintClose.hitArea = new PIXI.Rectangle(0, 0, closeSize, closeSize);
    hintCloseIcon.clear();
    hintCloseIcon.lineStyle(Math.max(1, Math.round(scale)), 0x111111, 1);
    const iconPadding = Math.max(2, Math.round(3 * scale));
    hintCloseIcon.moveTo(iconPadding, iconPadding);
    hintCloseIcon.lineTo(closeSize - iconPadding, closeSize - iconPadding);
    hintCloseIcon.moveTo(closeSize - iconPadding, iconPadding);
    hintCloseIcon.lineTo(iconPadding, closeSize - iconPadding);
  };

  const setMenuVisible = (visible) => {
    optionsMenu.visible = visible;
    if (!settingsState.hovering) {
      settingsButton.container.alpha = visible ? 0.32 : 0.18;
    }
    if (visible) {
      showHint("settings", { priority: true, delayMs: 300 });
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
      showHint("toys", { priority: true, delayMs: 300 });
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
      showHint("costumes", { priority: true, delayMs: 300 });
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
  let lastHappyJumpAt = 0;
  let petSpamCount = 0;
  let petHoldActive = false;
  let holdLoopStarted = false;
  let holdLoopTimeout = null;
  let petHoldTimeMs = 0;
  const idleBobState = {
    phase: Math.random() * Math.PI * 2,
    offset: 0,
  };
  const idleSwayState = {
    phase: Math.random() * Math.PI * 2,
    offsetX: 0,
    rotation: 0,
  };
  const jumpMicroState = {
    phase: Math.random() * Math.PI * 2,
    offset: 0,
    squash: 0,
  };
  const bopState = {
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
    const menuHeight = uiScaleState.menuHeight * menuScale;
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

  handleLayout(getLayoutBounds());
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
    startHoldLoop();
  };

  const startHoldLoop = () => {
    if (audioSystem.isLoopPlaying("petHoldMagic")) {
      return;
    }
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
    showHint("pet");
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
      showHint("spam", { priority: true });
      if (now - lastHappyJumpAt >= 3200 && state.current !== "happy_jump_sequence") {
        lastHappyJumpAt = now;
        startHappyJumpSequence();
        void audioSystem.playSfx({
          id: "happyJump",
          cooldownMs: 2400,
          allowPitch: false,
        });
      }
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
        sliderState.active.setActive(false);
        sliderState.active = null;
        sliderState.pointerId = null;
      }
    }
    if (activePetPointerId !== null && pointerId !== activePetPointerId) {
      return;
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
      sliderState.active.setActive(false);
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
    updateHint(deltaSeconds);
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
        showHint("hold", { priority: true });
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

    const swayActive = bobActive;
    if (swayActive) {
      idleSwayState.phase += ((Math.PI * 2) / 7.5) * deltaSeconds;
    }
    const swayTargetX = swayActive ? Math.sin(idleSwayState.phase) * 2.2 : 0;
    const swayTargetRotation = swayActive
      ? Math.sin(idleSwayState.phase + Math.PI / 2) * 0.025
      : 0;
    idleSwayState.offsetX += (swayTargetX - idleSwayState.offsetX) * 0.08;
    idleSwayState.rotation += (swayTargetRotation - idleSwayState.rotation) * 0.08;

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

    const bopActive =
      state.current === "move" ||
      state.current === "wake" ||
      state.current === "happy_jump_sequence";
    const bopStrength = bopActive ? clamp(Math.abs(hopHeight) / 16, 0, 1) : 0;
    const bopOffsetTarget = -bopStrength * 2;
    const bopSquashTarget = bopStrength * 0.03;
    bopState.offset += (bopOffsetTarget - bopState.offset) * 0.18;
    bopState.squash += (bopSquashTarget - bopState.squash) * 0.18;

    const visualOffsetY = idleBobState.offset + jumpMicroState.offset + bopState.offset;
    const visualScaleX = 1 + jumpMicroState.squash + bopState.squash;
    const visualScaleY = 1 - jumpMicroState.squash - bopState.squash;
    oyachiVisual.x = idleSwayState.offsetX;
    oyachiVisual.y = visualOffsetY;
    oyachiVisual.rotation = idleSwayState.rotation;
    oyachiVisual.scale.set(visualScaleX, visualScaleY);


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

  registerAppListener(app, window, "keydown", (event) => {
    if (event.repeat) {
      return;
    }
    if (event.key === "g" || event.key === "G") {
      showHint("test", { force: true });
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
        hintState.nextAllowedAt = now + 1800;
        seedHints();
      }
    },
  };
};

export const createMainScene = ({ textures, gameRoot }) =>
  initGame({ textures, gameRoot });
