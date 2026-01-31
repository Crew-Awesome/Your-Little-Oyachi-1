# Game Module Guide

## Continuity Requirement
AI agents must keep AGENTS.md files continuously updated whenever they change code, move files, rename folders, adjust systems, or change build/deploy behavior. After any modification, verify the relevant AGENTS.md file(s) accurately reflect the new state of the repository.

## Purpose
- Houses the complete PixiJS game runtime, configuration, scene logic, and all game-related code
- Single entry point (`index.js`) that bootstraps the entire game
- All game behavior is contained within this directory

## Key Files

### Entry Point
- **`index.js`**: Main game bootstrap
  - Loads PixiJS from CDN
  - Creates PIXI.Application
  - Loads all assets (textures, fonts) via PIXI.Assets
  - Preloads audio (SFX, initial music track)
  - Creates main scene via `createMainScene()`
  - Sets up start overlay for audio unlock
  - Returns context with `stage` and `setGameStarted()` callback

### Main Scene
- **`scenes/main-scene.js`**: Complete game logic (3116 lines)
  - All Oyachi states and behaviors
  - Ball physics and interaction
  - Care system (single meter, prompts, streak)
  - Toast popups (care streak, catch milestones)
  - Affection/throw rhythm tweaks for returning play
  - Daily greeting ritual (stored in localStorage)
  - Input handling (petting, dragging)
  - UI overlay management (hints, settings, toys, closet)
  - Main game loop via `app.ticker.add()`
  - Responsive layout system
  - Returns `{ stage, setGameStarted }` for bootstrap

## Subfolders

### `config/`
Configuration and constants. See `src/game/config/AGENTS.md` for details.
- `assets.js`: Asset manifests for textures, UI, fonts
- `constants.js`: Game dimensions (1280x720)
- `audio.js`: Audio defaults and pitch configuration
- `timings.js`: All timing constants for behaviors
- `storage.js`: localStorage key definitions

### `core/`
Application infrastructure. See `src/game/core/AGENTS.md` for details.
- `app.js`: PIXI.Application lifecycle, context-loss handling
- `layout.js`: Responsive layout calculation and subscribers
- `events.js`: Safe event listener registration with cleanup

### `systems/`
Runtime systems. See `src/game/systems/AGENTS.md` for details.
- `audio-system.js`: Complete Web Audio API wrapper (SFX, music, loops, volume)

### `ui/`
UI components and overlays. See `src/game/ui/AGENTS.md` for details.
- `loading-screen.js`: Asset loading progress with skip option
- `start-overlay.js`: Click-to-start with cover art

### `utils/`
Helper utilities
- `math.js`: Easing functions, clamp utility
- `pointer.js`: Multi-touch pointer ID tracking
- `texture.js`: Safe dimension extraction from textures

## Conventions

### State Management
- Global `state` object in main-scene.js tracks Oyachi's current state
- States: `idle`, `move`, `blink`, `pet`, `sleep`, `wake`, `react_cute`, `react_ayo`, `happy_jump_sequence`, `sneeze`, `idle_tired`
- State transitions via `setState()` with optional duration

### Sprite Management
- All Oyachi sprites pre-created and toggled via `setSpriteVisibility()`
- Sprite registry: `oyachiSprites` array with name-to-sprite mapping
- Base sprite scale (0.6) applied uniformly

### Timing System
- All timings centralized in `config/timings.js`
- Tick-based updates with `delta` (frame units) and `deltaSeconds`
- Timers countdown in ticker loop

### Input Resilience
- `cancelPointerInteractions()` handles blur/visibilitychange
- Multi-touch safe via `getPointerId()` utility
- Drag outside canvas handled gracefully

### No Redesign Rule
- Do not change core gameplay mechanics
- Preserve visual style and balance
- Only add, never remove or fundamentally alter existing features

## Safe Modification Guidelines

### Safe Changes
- Adjust timing values in `timings.js`
- Add new assets to `config/assets.js`
- Create new SFX entries in `audio-system.js`
- Minor UI tweaks (colors, sizes, positions)
- New states that extend existing state machine

### Unsafe Changes
- Removing or renaming existing states
- Changing core interaction mechanics
- Adding build steps or bundlers
- Modifying folder structure or imports

### Performance Notes
- Main scene ticker runs every frame (~60fps)
- Avoid heavy allocations in ticker callback
- Use object pooling for particles (hearts use pool of 12)
- Batch similar operations where possible
