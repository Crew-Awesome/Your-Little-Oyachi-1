export const createPixelText = (text, style = {}) => {
  const node = new PIXI.Text(text, {
    fontFamily: "DePixel",
    ...style,
  });
  node.roundPixels = true;
  node.resolution = 1;
  if (node.texture?.baseTexture) {
    node.texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
  }
  return node;
};
