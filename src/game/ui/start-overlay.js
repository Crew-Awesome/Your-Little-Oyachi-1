import { getLayoutBounds, registerLayoutSubscriber } from "../core/layout.js";
import { audioSystem, unlockAudio } from "../systems/audio-system.js";
import { clamp } from "../utils/math.js";
import { getTextureDimension } from "../utils/texture.js";

export const setupStartOverlay = ({ stage, coverTexture, playTexture, onStart }) => {
  const startOverlay = new PIXI.Container();
  startOverlay.zIndex = 999999;
  startOverlay.eventMode = "static";
  startOverlay.cursor = "pointer";

  let coverSprite = null;
  if (coverTexture) {
    coverSprite = new PIXI.Sprite(coverTexture);
    coverSprite.anchor.set(0.5);
    startOverlay.addChild(coverSprite);
  }

  const coverShade = new PIXI.Graphics();

  const playIcon = new PIXI.Sprite(playTexture);
  playIcon.anchor.set(0.5);
  playIcon.roundPixels = true;
  startOverlay.addChild(coverShade, playIcon);
  stage.addChild(startOverlay);
  console.log("overlay shown");

  const updateLayout = (layout) => {
    const { width, height, centerX, centerY } = layout;
    startOverlay.hitArea = new PIXI.Rectangle(0, 0, width, height);
    if (coverSprite) {
      const coverScale = Math.max(
        width / getTextureDimension(coverSprite.texture, "width", width),
        height / getTextureDimension(coverSprite.texture, "height", height),
      );
      coverSprite.scale.set(coverScale);
      coverSprite.x = centerX;
      coverSprite.y = centerY;
    }
    coverShade.clear();
    coverShade.beginFill(0x000000, 0.45);
    coverShade.drawRect(0, 0, width, height);
    coverShade.endFill();
    playIcon.x = centerX;
    playIcon.y = centerY;
    const iconScale = clamp(Math.min(width, height) / 420, 0.55, 1);
    playIcon.scale.set(iconScale);
    playIcon.visible = true;
  };

  updateLayout(getLayoutBounds());
  const unsubscribeLayout = registerLayoutSubscriber(updateLayout);

  let overlayClicked = false;
  const handleOverlayPointerDown = (event) => {
    if (overlayClicked) {
      return;
    }
    overlayClicked = true;
    console.log("overlay clicked");
    if (event?.data?.originalEvent) {
      event.data.originalEvent.preventDefault();
    }
    unlockAudio();
    audioSystem.startMusic().catch((error) => {
      console.error("Music start failed.", error);
    });
    if (typeof onStart === "function") {
      onStart();
    }
    startOverlay.removeAllListeners();
    startOverlay.removeFromParent();
    unsubscribeLayout();
    startOverlay.destroy({ children: true });
  };

  startOverlay.on("pointerdown", handleOverlayPointerDown);
};
