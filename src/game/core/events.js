export const registerEvent = (target, type, handler, options, cleanup) => {
  target.addEventListener(type, handler, options);
  if (cleanup) {
    cleanup.push(() => target.removeEventListener(type, handler, options));
  }
};

export const registerAppListener = (app, target, type, handler, options) => {
  if (!app?.__oyachiCleanup) {
    target.addEventListener(type, handler, options);
    return;
  }
  registerEvent(target, type, handler, options, app.__oyachiCleanup);
};
