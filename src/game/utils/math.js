export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

export const easeInCubic = (t) => t * t * t;
