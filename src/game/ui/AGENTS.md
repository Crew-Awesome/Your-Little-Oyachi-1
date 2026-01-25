# UI Overlay Guide

## Continuity Requirement
AI agents must keep AGENTS.md files continuously updated whenever they change code, move files, rename folders, adjust systems, or change build/deploy behavior. After any modification, verify the relevant AGENTS.md file(s) accurately reflect the new state of the repository.

## Purpose
- Lightweight PixiJS overlays for game flow
- Loading screen during asset initialization
- Start overlay for audio unlock and game start
- No business logic, purely presentational

## Key Files

### `loading-screen.js`
**Purpose:** Asset loading progress display

**Exported Function:**
```javascript
export const createLoadingScreen = () => ({
  setAssetProgress(progress),     // 0-1
  setAudioProgress(progress),     // 0-1
  setSecondaryIndex(index),       // Loading message index
  setDetailText(text),            // Detail message
  setSkipHandler(handler),        // Skip callback
  fadeOut(),                      // Returns Promise
});
```

**Visual Elements:**
- Full-screen shade (0xf4f4f4)
- "Loading." text with animated dots
- Secondary message ("Preparing the room", "Loading sounds", etc.)
- Detail text (current action)
- Progress bar (gray background, fill)
- Skip button (appears after 4 seconds)

**Z-Index:** 1000000 (always on top)

**Timing:**
- Fade in: 0.35s
- Fade out: 0.25s
- Message cycle: 3.2s
- Skip visible after: 4s

**Usage in Bootstrap:**
```javascript
const loadingScreen = createLoadingScreen();
const texturesPromise = PIXI.Assets.load(assets, (progress) => {
  loadingScreen.setAssetProgress(progress);
});
await loadingScreen.fadeOut();
```

### `start-overlay.js`
**Purpose:** Click-to-start screen with audio unlock

**Exported Function:**
```javascript
export const setupStartOverlay = ({
  stage,           // PIXI stage to add overlay
  coverTexture,    // Cover art texture
  playTexture,     // Play button texture
  onStart,         // () => void callback
}) => void
```

**Visual Elements:**
- Cover art sprite (centered)
- Play button arrow sprite
- Hidden by default until `setupStartOverlay()` called
- Removed after user clicks play

**Key Behavior:**
1. Displays cover art and play button
2. Waits for user click on play button
3. Calls `audioSystem.unlock()` on click
4. Calls `onStart()` callback to begin game
5. Fades out after start

**Z-Index:** Above game layer, below loading

**Audio Unlock:**
- Calls `unlockAudio()` which triggers `audioSystem.unlock()`
- Also attempts to resume Howler and PIXI.sound contexts
- Required before audio can play (browser policy)

## Conventions

### Minimal Allocation
- No per-frame allocations in overlay tickers
- Pre-create all graphical elements
- Reuse objects where possible

### Visual Consistency
- Match existing color scheme (light grays, subtle borders)
- Use Tiny5 font for text
- Keep styling subtle and non-intrusive

### Lifecycle Management
- Loading screen destroys itself on fadeOut
- Start overlay removes from stage on click
- Both clean up properly for garbage collection

## Safe Modification Guidelines

### Very Safe
- Changing loading messages
- Adjusting timing values
- Modifying colors/alpha
- Changing text content

### Safe with Testing
- Adding new overlay elements
- Changing layout/positioning
- Modifying fade durations

### Unsafe
- Removing start/loading flow
- Changing audio unlock mechanism
- Adding business logic to overlays

## Pattern Examples

### Adding Loading Message
```javascript
const secondaryMessages = [
  "Preparing the room",
  "Loading sounds",
  "Getting cozy",
  "Almost ready",
  "Your new message here",  // Add here
];
```

### Customizing Start Overlay
```javascript
setupStartOverlay({
  stage: context.stage,
  coverTexture: textures.coverart,
  playTexture: textures.ui_play,
  onStart: context.setGameStarted,
});
```

### Handling Skip
```javascript
loadingScreen.setSkipHandler(() => {
  skipRequested = true;
  // Continue without waiting for audio
});
```

## Integration Points

### Loading Screen Flow
```
createLoadingScreen()
  ↓
Set asset/audio progress callbacks
  ↓
On complete: loadingScreen.fadeOut()
  ↓
Screen removes itself from stage
```

### Start Overlay Flow
```
setupStartOverlay()
  ↓
Display cover + play button
  ↓
User clicks play
  ↓
Unlock audio → onStart() → fade out
  ↓
Overlay removes from stage
```
