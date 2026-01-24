# Core Module Guide

## Continuity Requirement
AI agents must keep AGENTS.md files continuously updated whenever they change code, move files, rename folders, adjust systems, or change build/deploy behavior. After any modification, verify the relevant AGENTS.md file(s) accurately reflect the new state of the repository.

## Purpose
- Manages PixiJS application lifecycle
- Handles responsive layout scaling
- Provides safe DOM event registration with cleanup
- Manages WebGL context loss and recovery
- Centralizes app-level concerns separate from game logic

## Key Files

### `app.js`
**Purpose:** PIXI.Application lifecycle management

**Key Exports:**
- `createApp({ root, audioSystem })`: Creates new PIXI.Application
- `destroyExistingApp({ audioSystem })`: Cleans up previous app instance
- `getApp()`: Returns current app instance
- `setContextHandlers({ onLost, onRestored })`: Callbacks for context events
- `setRendererFallback(visible, message)`: Shows/hides fallback overlay

**Key Behavior:**
- Creates PIXI.Application with `backgroundAlpha: 0`, `antialias: false`
- Sets NEAREST scale mode for pixel-perfect rendering
- Attaches to DOM at `gameRoot` element
- Registers context loss/restored handlers on canvas
- On context loss: stops ticker, pauses audio, shows fallback
- On context restore: resumes ticker, resumes audio, hides fallback
- Populates `app.__oyachiCleanup` array for cleanup functions

**Cleanup Pattern:**
```javascript
app.__oyachiCleanup.push(() => {
  // Unsubscribe/remove listeners here
});
```

### `layout.js`
**Purpose:** Responsive layout calculation and distribution

**Key Exports:**
- `setLayoutRoot(root)`: Sets the DOM root element
- `setLayoutApp(app)`: Sets the PIXI app reference
- `applyLayoutMode()`: Calculates and applies scale/offset
- `getLayoutBounds()`: Returns current layout metrics
- `registerLayoutSubscriber(handler)`: Subscribe to layout changes

**Layout Calculation:**
- Base game size: 1280x720 (from constants)
- Scale to fit container while maintaining aspect ratio
- Centers game in container with `transform: translate() scale()`
- Updates `--viewport-height` CSS variable

**Layout Metrics Returned:**
```javascript
{
  width, height,         // Renderer dimensions
  left, top, right, bottom, // Bounds (0,0 to width,height)
  centerX, centerY,     // Center point
  scale,                // Applied scale factor
  containerWidth, containerHeight // DOM container size
}
```

**Subscriber Pattern:**
```javascript
const unsubscribe = registerLayoutSubscriber((layout) => {
  // Update UI positions based on layout
});
app.__oyachiCleanup.push(unsubscribe);
```

### `events.js`
**Purpose:** Safe event listener registration with automatic cleanup

**Key Exports:**
- `registerAppListener(app, target, eventType, handler, options, cleanupArray)`
- `registerEvent(target, eventType, handler, options, cleanupArray)`

**Usage:**
```javascript
registerAppListener(
  app,
  window,
  "resize",
  applyLayoutMode,
  { passive: true },
  app.__oyachiCleanup
);
```

**Benefits:**
- Automatically removes listeners on cleanup
- Prevents memory leaks
- Centralized cleanup tracking

## Conventions

### Layout Stability
- Always handle zero-size containers defensively
- Use `Math.max(1, value)` to prevent division by zero
- Calculate scale as `min(containerWidth/GAME_WIDTH, containerHeight/GAME_HEIGHT)`

### Cleanup Registration
- All temporary listeners must be registered with cleanup array
- Unsubscribe functions should be pushed to `app.__oyachiCleanup`
- Called on app destroy or page unload

### Context Loss Handling
- Never assume WebGL context is permanent
- Store important state for recovery
- Audio system must pause/resume properly

## Safe Modification Guidelines

### Safe
- Adjusting scale calculation logic
- Adding new layout subscribers
- Modifying fallback overlay styling

### Unsafe
- Removing cleanup registration
- Changing base game dimensions (affects everything)
- Modifying context loss handler logic

## Pattern Examples

### Creating a New Subscriber
```javascript
const handleLayoutChange = (layout) => {
  myElement.x = layout.centerX;
  myElement.y = layout.top + 50;
};

registerLayoutSubscriber(handleLayout);
app.__oyachiCleanup.push(() => {
  layoutSubscribers.delete(handleLayout);
});
```

### Registering Window Events
```javascript
registerAppListener(
  app,
  window,
  "orientationchange",
  applyLayoutMode,
  { passive: true },
  app.__oyachiCleanup
);
```
