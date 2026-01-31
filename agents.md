# Your Little Oyachi - Agent Guide

## Continuity Requirement
AI agents must keep AGENTS.md files continuously updated whenever they change code, move files, rename folders, adjust systems, or change build/deploy behavior. After any modification, verify the relevant AGENTS.md file(s) accurately reflect the new state of the repository.

## Project Overview

Your Little Oyachi is a cozy, static web-based pet simulation game featuring a character named Oyachi. The game is built with PixiJS v7.3.2 (loaded via CDN) and runs directly in the browser without a build step. Players interact with Oyachi through petting, toys, and various states (idle, sleeping, reactions). The game emphasizes relaxation, subtle animations, and a warm aesthetic.

**Core Features:**
- Interactive pet simulation with Oyachi character
- Multiple interaction types: quick pets, hold-to-pet, ball toy
- Animated states: idle, blinking, tired, sneezing, sleeping, reactions
- Audio system with music tracks and SFX (cozy, non-intrusive)
- Settings menu with volume controls and hints toggle
- Closet costume system (currently minimal)
- Responsive layout adapting to different screen sizes
- Hint system for player guidance

## How to Run Locally

### Method 1: Direct File Open (Simplest)
1. Open `index.html` or `game.html` directly in a web browser
2. The game loads PixiJS from CDN and runs immediately
3. Note: Some browsers may restrict module loading from file:// protocol

### Method 2: Local HTTP Server (Recommended)
1. Run a local HTTP server in the repository root:
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Node.js with npx
   npx serve .
   
   # PHP
   php -S localhost:8000
   ```
2. Open `http://localhost:8000` or `http://localhost:8000/game.html`
3. This method ensures proper module loading and CORS handling

### Method 3: VS Code Live Server
1. Install the "Live Server" extension in VS Code
2. Right-click `index.html` or `game.html` and select "Open with Live Server"

**No build step is required.** The game uses ES modules loaded directly from `src/game/index.js`.

## How Build/Deploy Works

### Deployment Pipeline
This project uses a simple FTP-based deployment pipeline through GitHub Actions.

**Workflow File:** `.github/workflows/deploy.yml`

**Deployment Process:**
1. Push to `main` branch triggers automatic deployment
2. GitHub Action validates FTP configuration
3. FTP-Deploy-Action uploads all files (except excluded patterns) to the hosting server
4. Server directory: `oyachigame.nichesite.org/htdocs/`

**Excluded from Deploy:**
- `.git/` directory
- `.github/` workflows directory
- `node_modules/` (if present)
- `.env*` files
- System files (`.DS_Store`, `Thumbs.db`)

**To Deploy Manually:**
1. Push changes to `main` branch, or
2. Go to GitHub Actions tab and manually trigger the workflow

**No local build process is required.** The repository contains the source files directly.

## Architecture Overview

### Entry Points

**Site Entry Points:**
- `index.html`: Home page with game embed, logo, and navigation
- `game.html`: Dedicated game-only page (full-screen experience)
- `about.html`: Static about page (referenced but content not visible in current repo)

**Game Entry Point:**
- `src/game/index.js`: Main module loaded via `<script type="module">`
  - Bootstraps PixiJS Application
  - Loads all assets (textures, audio, fonts)
  - Creates main scene and overlays
  - Handles audio unlock on user interaction

### Initialization Flow

```
index.html/game.html
    ↓
src/game/index.js (ES module)
    ↓
createApp() → PIXI.Application
    ↓
Load assets (PIXI.Assets.load)
Load critical SFX (audioSystem.preloadCritical)
Load initial music (audioSystem.preloadInitialMusic)
    ↓
createMainScene() → initGame()
    ↓
setupStartOverlay() → waits for user click
    ↓
User clicks "play" → setGameStarted() → game loop activates
```

### PixiJS Usage

**Version:** 7.3.2 (via CDN: `https://cdn.jsdelivr.net/npm/pixi.js@7.3.2/dist/pixi.min.js`)

**Key PixiJS Features Used:**
- `PIXI.Application`: Main game container and renderer
- `PIXI.Container`: Scene organization with zIndex for layering
- `PIXI.Sprite`: Character, ball, UI elements, hearts
- `PIXI.Graphics`: Room geometry, UI backgrounds, shadows
- `PIXI.Text`: All in-game text (Tiny5 pixel font)
- `PIXI.Ticker`: Main game loop (delta-based updates)
- `PIXI.Assets.load()`: Async asset loading with progress
- `PIXI.BaseTexture.scaleMode = NEAREST`: Pixel-perfect rendering for pixel art

**Scale Mode:**
- `PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST`: Ensures crisp pixel art
- Applied at bootstrap and to all loaded textures

**Anti-aliasing:** Disabled (`antialias: false`) for pixel-perfect rendering

### Main Loop/Ticker

**Location:** `src/game/scenes/main-scene.js` - `app.ticker.add()` callback (lines ~2463-3047)

**Ticker Update Frequency:** PixiJS default (typically 60 FPS, varies by display)

**Ticker Responsibilities:**
1. **State Management:**
   - Update state timers (idle, move, pet, sleep, reactions)
   - Handle state transitions
   - Process idle behavior (tired, sneezing, blinking)

2. **Animation Updates:**
   - Hop/bob animations for Oyachi
   - Happy jump sequence with hearts
   - Heart particle system
   - Shadow scaling and positioning

3. **Physics Updates:**
   - Ball physics (gravity, bouncing, friction)
   - Depth-based positioning (pseudo-3D)

4. **UI Updates:**
   - Now-playing text fade in/out
   - Hint system phase updates (fadein/hold/fadeout)
   - Closet spotlight animation

5. **Input Handling:**
   - Pet pointer tracking
   - Ball drag physics
   - Slider interaction

**Delta Handling:**
- `deltaMs`: milliseconds since last frame (used for physics)
- `deltaSeconds`: seconds since last frame (used for timers)
- `delta`: frame-based units (used for timer countdown)

### State Flow

**Oyachi States** (`state.current`):
```
idle → move → blink → idle
     ↓
     → tired → sleep → wake → idle
     ↓
     pet → idle
     ↓
     react_cute (hold pet) → idle
     ↓
     react_ayo (long hold) → move_away → idle
     ↓
     happy_jump_sequence (spam pet) → idle
     ↓
     sneeze → idle
```

**Toy Interaction States** (`toyInteraction.phase`):
```
idle → approach → hold → cooldown → idle
```

**Hint System States** (`hintState.phase`):
```
hidden → fadein → hold → fadeout → hidden
```

## Folder Map

### Root Level
- `index.html`: Home page entry point
- `game.html`: Dedicated game page
- `about.html`: About page (placeholder)
- `styles.css`: Shared CSS styles for site and game
- `AGENTS.md`: This documentation file

### `src/game/`
Main game code directory. See `src/game/AGENTS.md` for details.

### `src/game/config/`
Configuration files for the game.
- `assets.js`: Asset manifests (textures, UI icons, fonts)
- `constants.js`: Game dimensions (1280x720)
- `audio.js`: Audio defaults and pitch configuration
- `timings.js`: All timing constants for behaviors
- `storage.js`: localStorage key definitions

### `src/game/core/`
Core application infrastructure.
- `app.js`: PixiJS application lifecycle, context-loss handling
- `layout.js`: Responsive layout system, scale calculation
- `events.js`: Event listener registration with cleanup

### `src/game/scenes/`
Scene implementations.
- `main-scene.js`: Complete game logic, Oyachi behavior, ball physics

### `src/game/systems/`
Shared runtime systems.
- `audio-system.js`: Web Audio API wrapper, SFX/music playback

### `src/game/ui/`
UI overlays and components.
- `loading-screen.js`: Asset loading progress display
- `start-overlay.js`: Click-to-start screen, audio unlock

### `src/game/utils/`
Helper functions.
- `math.js`: Easing functions, clamping utilities
- `pointer.js`: Pointer ID tracking for multi-touch
- `texture.js`: Safe dimension extraction from textures

### `assets/`
All art and audio assets. See `assets/AGENTS.md` for details.

### `.github/workflows/`
CI/CD configuration.
- `deploy.yml`: FTP deployment workflow

## Core Systems Overview

### Asset Loading

**Location:** `src/game/index.js` lines 52-58

**Process:**
1. `PIXI.Assets.load()` loads all assets in parallel
2. Progress callback updates loading screen
3. Fonts loaded via `fontAssets` array in `assets.js`
4. Audio buffers loaded separately via `audio-system.js`

**Asset Manifests** (`src/game/config/assets.js`):
- `gameAssets`: Character sprites, ball texture
- `uiAssets`: UI icons (settings, fullscreen, toys, costumes, etc.)
- `fontAssets`: Custom fonts (Tiny5 pixel font via WOFF2 URL)
- `coverArtAsset`: Cover image for start screen

**Error Handling:**
- Missing assets log errors but don't block boot
- Audio loading failures are caught and logged
- Game continues with degraded functionality if assets fail

### Audio System

**Location:** `src/game/systems/audio-system.js`

**Web Audio API Architecture:**
- Single `AudioContext` created on first user interaction
- Three gain nodes: master, music, SFX
- Separate volume control for music and SFX

**One-Shot SFX:**
- `playSfx({ id, cooldownMs, allowPitch })`: Plays a sound once
- Cooldown system prevents sound spam
- Pitch variation adds variety (base 1.08, variation ±0.05)
- Supported SFX: `walkHop`, `petSoft`, `petFast`, `petOh`, `sneeze`

**Looping SFX:**
- `startLoop({ id, allowPitch, fadeIn })`: Starts a loop
- `stopLoop(id, { fadeOutSeconds, immediate })`: Stops a loop
- `isLoopPlaying(id)`: Checks if loop is active
- Current loops: `petHoldMagic` (hold pet loop)
- Token-based system prevents stale loop cleanup

**Music Playback:**
- Random track selection on start
- `startMusic()`: Starts background music
- `playNextTrack()`: Auto-plays next track when current ends
- `preloadInitialMusic()`: Loads one track during boot
- `loadMusicBuffers()`: Loads remaining tracks in background
- `setNowPlayingHandler()`: Callback for track title display

**Audio Unlock Rules:**
- Audio context starts suspended (browser policy)
- `unlockAudio()` called on first user interaction
- Attempts to resume all known audio contexts (Howler, PIXI.sound, native)
- `audioSystem.unlock()` called internally when needed

**Volume/Enabled Persistence:**
- Stored in localStorage via keys in `storage.js`
- Loaded on boot, applied to gain nodes
- Settings menu allows real-time adjustment

### Input Handling

**Petting System:**

**Quick Pet:**
- `handlePetPointerDown()`: Starts pet animation and SFX
- Duration: `petTiming.press + hold + release` (~0.34s)
- Triggers heart spawn based on pet type (gentle/normal/excited)
- Spam pet detection: 6+ quick pets triggers happy jump sequence

**Hold Pet:**
- `handlePetPointerDown()` + sustained pointer
- `beginHoldLoop()`: Starts after `petHoldTiming.gentleDelayMs` (350ms)
- Shows `react_cute` state with periodic hearts
- After `petHoldTiming.ayoDelayMs` (4.2s): Triggers `react_ayo` state
- Loop SFX: `petHoldMagic` plays during hold

**Multi-Touch Handling:**
- `getPointerId()`: Extracts pointer ID from events
- `activePetPointerId`: Tracks which pointer started the pet
- Only the initiating pointer can complete the pet action

**Ball Interaction:**
- `handleBallPointerDown()`: Starts drag
- `handleBallPointerMove()`: Updates ball position/depth
- `handleBallPointerUp()`: Releases with velocity based on drag
- Physics: gravity (1600), bounce damping (0.55), ground friction (0.95)

**Slider Interaction:**
- `sliderState.active`: Currently dragged slider
- `sliderState.pointerId`: Tracked for multi-touch safety
- Global position converted to local for slider logic

**Cancel Handling:**
- `cancelPointerInteractions()`: Called on blur/visibilitychange
- Stops all loops, resets hold state, clears drags
- Prevents stuck interactions when tab is hidden

### UI Overlays/Menus

**Loading Screen** (`src/game/ui/loading-screen.js`):
- Z-index: 1000000 (always on top)
- Shows loading progress, secondary messages
- "Skip" button appears after 4 seconds
- Fades out when game is ready

**Start Overlay** (`src/game/ui/start-overlay.js`):
- Displays cover art and play button
- Handles audio unlock on click
- Calls `onStart()` callback to begin game

**Settings Menu:**
- Toggled via gear icon button
- Contains: Music slider, SFX slider, Hints toggle
- Persists settings to localStorage

**Toys Panel:**
- Toggled via toys icon (bottom)
- Options: Ball, No toy
- Selecting "Ball" spawns ball at Oyachi's position
- Closes when option selected

**Closet Layer:**
- Toggled via costumes icon
- Shows Oyachi preview with spotlight effect
- Currently minimal implementation (only "Default" option)
- Hides game UI when open

**Hint Overlay:**
- Semi-transparent popup with tip text
- Fade in/hold/fade out animation
- Close button with confirmation dialog
- Can be disabled in settings

**Fullscreen Button:**
- Toggles browser fullscreen API
- Updates icon based on state

### Persistence/localStorage

**Storage Keys** (`src/game/config/storage.js`):

**Audio Settings:**
- `oyachi_music_volume`: Float 0-1
- `oyachi_sfx_volume`: Float 0-1
- `oyachi_music_enabled`: "true"/"false"
- `oyachi_sfx_enabled`: "true"/"false"

**Hint Settings:**
- `oyachi_hints_seen`: "true" if hints have been dismissed
- `oyachi_hints_enabled`: "true"/"false" (defaults to true if not seen)

**Persistence Flow:**
- Loaded on audio system initialization
- Applied immediately to gain nodes
- Updated when settings change
- No encryption or validation (trusted client)

### Timers/Cooldowns

**Pet Timings** (`src/game/config/timings.js`):
- `petTiming.press`: 0.14s - initial press animation
- `petTiming.hold`: 0.1s - hold before release
- `petTiming.release`: 0.2s - return to idle

**Hold Pet Timings:**
- `petHoldTiming.gentleDelayMs`: 350ms - before cute hearts start
- `petHoldTiming.ayoDelayMs`: 4200ms - before react_ayo
- `petHoldTiming.cuteHeartInterval`: 0.6s - heart spawn interval
- `petHoldTiming.cuteSquishSpeed`: 1.1 - squish animation speed
- `petHoldTiming.ayoSquishSpeed`: 2.1 - faster squish for ayo reaction

**Idle Behavior:**
- `idleBehavior.tiredDelay`: 14s inactivity before tired state
- `idleBehavior.sleepDelay`: 6s in tired state before sleep
- `idleBehavior.sneezeChance`: 0.12 (12% chance when idle)

**Sleep:**
- `sleepTiming.frameDuration`: 0.7s between sleep animation frames

**Happy Jump Sequence:**
- `happyJumpTiming.minJumps`: 2
- `happyJumpTiming.maxJumps`: 4
- `happyJumpTiming.baseHeight`: 34px jump height

**Pet Spam Detection:**
- `petSpamTiming.quickWindowMs`: 260ms - time window for quick pets
- `petSpamTiming.resetWindowMs`: 420ms - reset counter if too slow
- `petSpamTiming.requiredCount`: 6 pets to trigger happy jump

**Hint Timings:**
- `hintTiming.fadeIn`: 0.5s
- `hintTiming.hold`: 2.4s
- `hintTiming.fadeOut`: 0.6s
- `hintTiming.gapMin`: 3.5s minimum between hints
- `hintTiming.gapMax`: 6.5s maximum gap

## Conventions and Safe-Edit Rules

### General Principles
- **No redesigns**: Preserve visual style and game balance
- **Subtle changes only**: Small, safe improvements
- **No build step**: All code must run as-is in browser
- **Input resilient**: Handle drag outside canvas, pointer cancel
- **Audio non-blocking**: Missing audio files should log and continue
- **Context-loss handling**: WebGL context loss must be graceful

### Code Style
- ES6+ modules (import/export)
- No external dependencies beyond PixiJS via CDN
- PIXI global namespace used directly
- Consistent indentation (2 spaces typical)
- Minimal comments (per original code)

### Safe Modifications
- **Timing tweaks**: Adjust timings.js values (safe, low-risk)
- **Asset additions**: Add files to assets/, update assets.js (safe)
- **UI styling**: Minor adjustments to colors/sizes (safe)
- **New SFX**: Add to audio-system.js sfxFiles (safe)

### Unsafe Modifications
- **Architecture changes**: Don't restructure folders or imports
- **Build integration**: Don't add bundlers or build steps
- **Authentication**: Don't add login/personalization
- **Server components**: No backend or API calls
- **Breaking changes**: Don't remove features users depend on

### Testing Requirements
- Test on multiple screen sizes (compact vs. full)
- Test on mobile (touch interactions)
- Test audio unlock flow
- Test context-loss recovery
- Verify no console errors

## Debugging Guide

### Log Sources

**Browser Console:**
- `console.error()`: Fatal errors (missing root, bootstrap failure)
- `console.warn()`: Non-fatal issues (context loss, sprite mismatch)
- `console.log()`: Key state changes (HOLD_START, HOLD_END, LOOP_START, LOOP_STOP)
- Tagged logs: `HOLD_LOOP_LOAD`, `HOLD_START`, `HOLD_END`

**Key Log Messages:**
- `"pixi mounted"`: PixiJS app successfully created
- `"Renderer reset..."`: Context lost, waiting for restore
- `"WebGL context lost"`: Warning, rendering paused
- `"WebGL context restored"`: Recovery complete
- `"HOLD_START"`: Hold pet loop began
- `"HOLD_END", <reason>`: Hold pet loop ended (reason: sleep, react, etc.)
- `"LOOP_START"`: SFX loop started
- `"LOOP_STOP", <reason>`: SFX loop stopped

### Common Failure Points

**Audio Not Playing:**
- Browser auto-play policy blocks context until user gesture
- Solution: Click anywhere on page first
- Check `audioSystem.getMusicEnabled()` and `sfxEnabled`

**Game Not Loading:**
- Check browser console for `Game root element not found`
- Ensure `index.html` or `game.html` loaded correctly
- Verify PixiJS CDN loaded

**Sprites Not Displaying:**
- Check texture loading errors in console
- Verify `PIXI.Assets.load()` completed
- Check sprite visibility (`sprite.visible`)

**Interactions Not Working:**
- Ensure `gameStarted` is true (click play first)
- Check `closetOpen` state (blocks most interactions)
- Verify `eventMode` set correctly on interactive elements

**Layout Issues:**
- Check `applyLayoutMode()` called on resize
- Verify `getLayoutBounds()` returns valid values
- Test on different viewport sizes

**Memory Leaks:**
- Check `app.__oyachiCleanup` array is populated
- Verify `registerLayoutSubscriber()` returns cleanup function
- Ensure `destroyExistingApp()` called on re-initialization

### Debugging Tools
- Browser DevTools: Console, Network, Elements tabs
- `performance.now()`: High-precision timing
- localStorage inspection: Check saved settings
- PIXI Inspector browser extension (if available)

## Common Tasks Playbooks

### Adding a New One-Shot SFX

**Step 1: Add Audio File**
- Place WAV file in `assets/audio/sfx/`
- Use consistent naming: `action_name_1.wav`, `action_name_2.wav` for variants

**Step 2: Register in Audio System**
- Edit `src/game/systems/audio-system.js`
- Add to `sfxFiles` object:
  ```javascript
  const sfxFiles = {
    // ... existing sounds
    myNewSfx: [
      "assets/audio/sfx/my_new_sfx_1.wav",
      "assets/audio/sfx/my_new_sfx_2.wav", // Optional: add variants
    ],
  };
  ```

**Step 3: Play the Sound**
- Call in game code:
  ```javascript
  void audioSystem.playSfx({
    id: "myNewSfx",
    cooldownMs: 200, // Prevent spam
    allowPitch: true, // Add variety
  });
  ```

**Step 4: Test**
- Verify sound plays on trigger
- Check cooldown prevents spam
- Test with pitch variation enabled/disabled

### Adding a New Looping SFX Safely

**Step 1: Add Audio File**
- Place loop-compatible WAV in `assets/audio/sfx/`
- Ensure file loops cleanly (no click at end)

**Step 2: Register in Audio System**
- Edit `src/game/systems/audio-system.js`
- Add to `sfxFiles`:
  ```javascript
  myLoop: ["assets/audio/sfx/my_loop.wav"],
  ```

**Step 3: Start Loop on Trigger**
- Call in game code:
  ```javascript
  void audioSystem.startLoop({
    id: "myLoop",
    allowPitch: false, // Loops usually don't pitch-shift
    fadeIn: 0.35, // Smooth fade in
  });
  ```

**Step 4: Stop Loop on Trigger**
- Call when loop should end:
  ```javascript
  audioSystem.stopLoop("myLoop", { fadeOutSeconds: 0.25 });
  ```

**Step 5: Check Before Starting**
- Always check if already playing:
  ```javascript
  if (!audioSystem.isLoopPlaying("myLoop")) {
    // Start the loop
  }
  ```

**Step 6: Handle State Changes**
- Ensure loop stops on relevant events:
  ```javascript
  if (holdLoopStarted) {
    console.log("HOLD_END", reason);
  }
  resetHoldPetState({ loopOptions: { fadeOutSeconds: 0.2 }, reason });
  ```

**Safety Rules:**
- Never start loop without checking `isLoopPlaying()` first
- Always provide fadeOut to avoid clicks
- Log start/stop reasons for debugging
- Stop loops on blur/visibilitychange

### Adding a New Animation/State

**Step 1: Add Sprite Asset**
- Place sprite in `assets/characters/oyachi/`
- Maintain consistent dimensions (reference existing sprites)
- Add to `assets.js`:
  ```javascript
  { alias: "my_new_state", src: "assets/characters/oyachi/my_new_state.png" }
  ```

**Step 2: Create Sprite in Main Scene**
- In `src/game/scenes/main-scene.js`:
  ```javascript
  const myNewSprite = new PIXI.Sprite(textures.my_new_state);
  myNewSprite.anchor.set(0.5, 1);
  myNewSprite.scale.set(baseSpriteScale);
  myNewSprite.visible = false;
  oyachiVisual.addChild(myNewSprite);
  ```

**Step 3: Add to Sprite Registry**
- Add to `oyachiSprites` array:
  ```javascript
  const oyachiSprites = [
    // ... existing sprites
    { sprite: myNewSprite, name: "my_new_state" },
  ];
  ```

**Step 4: Update Visibility Function**
- Edit `setSpriteVisibility()`:
  ```javascript
  myNewSprite.visible = name === "my_new_state";
  ```

**Step 5: Add State Logic**
- Add state handling in ticker:
  ```javascript
  if (state.current === "my_new_state") {
    // State-specific logic
  }
  ```

**Step 6: Trigger the State**
- Add transition function:
  ```javascript
  const startMyNewState = () => {
    setState("my_new_state");
    showSprite("my_new_state");
    // Additional setup
  };
  ```

**Step 7: Add Transitions**
- Update state machine to transition to/from new state
- Add timing in `state.timer` countdown
- Add cleanup/return logic

### Adding a New UI Option/Toggle

**Step 1: Add Storage Key**
- Edit `src/game/config/storage.js`:
  ```javascript
  export const myFeatureStorageKeys = {
    enabled: "oyachi_my_feature_enabled",
  };
  ```

**Step 2: Create Toggle Row**
- In `src/game/scenes/main-scene.js`:
  ```javascript
  const myFeatureToggle = createToggleRow({
    label: "My Feature",
    y: menuLayout.paddingTop + menuLayout.sliderGap * 3,
    enabled: true,
    onToggle: (enabled) => {
      localStorage.setItem(myFeatureStorageKeys.enabled, String(enabled));
      // Apply feature state
    },
  });
  optionsMenu.addChild(myFeatureToggle.container);
  ```

**Step 3: Load Initial State**
- In `initGame()` or setup:
  ```javascript
  const storedEnabled = localStorage.getItem(myFeatureStorageKeys.enabled);
  const myFeatureEnabled = storedEnabled !== "false"; // Default true
  ```

**Step 4: Add to Layout Updates**
- Ensure toggle responds to `applyUiScale()` and layout changes

**Step 5: Persist Changes**
- `onToggle` callback handles localStorage update
- Load value on boot and apply

### Adding a New Room/Background

**Step 1: Understand Current Structure**
- Room drawn in `drawRoom()` function (lines ~1530-1567)
- Uses `wall`, `floor`, `floorMat`, `seam` PIXI.Graphics
- Colors: wall (0xefe3d1), floor (0xdac6ad), mat (0xd1bba1)

**Step 2: Create Graphics Functions**
- Add new drawing functions or extend `drawRoom()`:
  ```javascript
  const drawGreenRoom = () => {
    wall.clear();
    wall.beginFill(0xe8f5e8); // Light green
    wall.drawRect(0, 0, width, wallHeight);
    wall.endFill();
    
    floor.clear();
    floor.beginFill(0xc8e6c9); // Green floor
    floor.drawRect(0, wallHeight, width, height - wallHeight);
    floor.endFill();
    // ... etc
  };
  ```

**Step 3: Add Room State**
- Track current room: `let currentRoom = "main";`
- Add room switching logic

**Step 4: Update Positioning**
- Ensure Oyachi and ball reposition correctly
- Update `roomLeft`, `roomRight`, `floorTopY`, `floorBottomY`

**Step 5: Add Room Switching UI**
- Create left/right arrow buttons
- Add click handlers to switch rooms
- Handle Oyachi walking off-screen transitions

**Step 6: Test Thoroughly**
- Verify all interactions work in new room
- Test depth calculations
- Test ball physics boundaries

### Adding a New Interaction/Toy

**Step 1: Add Toy Asset**
- Place sprite in `assets/toys/`
- Add to `assets.js`:
  ```javascript
  { alias: "my_toy", src: "assets/toys/my_toy.png" }
  ```

**Step 2: Add Toy Option to Panel**
- In `src/game/scenes/main-scene.js`:
  ```javascript
  const toyOption = new PIXI.Container();
  const toyOptionIcon = new PIXI.Sprite(textures.my_toy);
  const toyOptionLabel = new PIXI.Text("My Toy", { fontFamily: "Tiny5", fontSize: 12 });
  toyOption.addChild(toyOptionIcon, toyOptionLabel);
  toysPanel.addChild(toyOption);
  ```

**Step 3: Add Selection Logic**
- Update `selectedToy` handling:
  ```javascript
  toyOption.on("pointerdown", () => {
    selectedToy = "my_toy";
    updateToySelection();
    spawnMyToyAt(oyachi.x);
    setToysPanelVisible(false);
  });
  ```

**Step 4: Create Toy State**
- Add toy state similar to `ballState`:
  ```javascript
  const toyState = {
    active: false,
    x: 0,
    y: 0,
    // ... physics properties
  };
  ```

**Step 5: Add Toy Logic to Ticker**
- Update toy interaction in ticker:
  ```javascript
  if (toyState.active) {
    // Handle toy physics, Oyachi interaction, etc.
  }
  ```

**Step 6: Handle Oyachi Interaction**
- When Oyachi reaches toy, trigger interaction:
  ```javascript
  if (toyInteraction.phase === "approach" && Math.abs(oyachi.x - toyState.x) < 14) {
    toyInteraction.phase = "interact";
    // Show Oyachi interacting with toy
  }
  ```

**Step 7: Test**
- Verify toy spawns correctly
- Test Oyachi approach and interaction
- Test any physics or animations
