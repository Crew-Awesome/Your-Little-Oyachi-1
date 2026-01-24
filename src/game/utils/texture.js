export const getSafeDimension = (value, fallback = 1) => {
  if (Number.isFinite(value) && value > 0) {
    return value;
  }
  return fallback;
};

export const getTextureDimension = (texture, axis, fallback = 1) =>
  getSafeDimension(texture?.[axis], fallback);
