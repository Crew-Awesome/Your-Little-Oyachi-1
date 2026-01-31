# Scenes Guide

## Continuity Requirement
AI agents must keep AGENTS.md files continuously updated whenever they change code, move files, rename folders, adjust systems, or change build/deploy behavior. After any modification, verify the relevant AGENTS.md file(s) accurately reflect the new state of the repository.

## Purpose
- Contains all game scene implementations
- Currently single scene (`main-scene.js`) with complete game logic
- Manages Oyachi state machine, physics, input, and UI
- Central hub connecting all game systems

## Key Files

### `main-scene.js`
**Purpose:** Complete game implementation (3116 lines)

**Exported Function:**
```javascript
export const createMainScene = ({ textures, gameRoot }) => initGame({ textures, gameRoot });
```

**Returns:**
```javascript
{
  stage,              // PIXI.Container for the scene
  setGameStarted,     // () => void, enables game after start click
}
```

**Major Sections:**

1. **Initialization (`initGame`)**:
   - Creates all game objects (Oyachi, ball, room, UI)
   - Sets up event listeners
   - Registers layout subscribers
   - Initializes state

2. **State Management**:
   - `state` object tracks Oyachi's current state
   - States: `idle`, `move`, `blink`, `pet`, `sleep`, `wake`, `react_cute`, `react_ayo`, `happy_jump_sequence`, `sneeze`, `idle_tired`
   - Transitions via `setState(nextState, duration)`

3. **Sprite Management**:
   - Pre-created sprites: `idleSprite`, `blinkSprite`, `petSprite`, `holdBallSprite`, `tiredSprite`, `sneezeSprite`, `sleepSprite1`, `sleepSprite2`, `reactCuteSprite`, `reactAyoSprite`
   - Visibility toggled via `setSpriteVisibility(name)`
   - All sprites share `baseSpriteScale` (0.6)
   - `react_ayo` uses the blink texture for a quick surprised reaction

4. **Room Rendering**:
   - `drawRoom()`: Draws wall, floor, floorMat, seam
   - Updates `roomLeft`, `roomRight`, `floorTopY`, `floorBottomY`
   - Called on reposition/layout changes

5. **Physics**:
   - Ball physics: gravity (1600), bounce damping (0.55), ground friction (0.95)
   - Ball visuals: spin, idle wobble, and bounce squish derived from movement
   - Depth-based scaling: `getDepthScale(depth)` returns 0.84-1.1
   - Pseudo-3D positioning via depth parameter

6. **Input Handling**:
   - Petting: quick tap vs hold detection
   - Ball: drag to slide, tap to throw, Oyachi can return tosses
   - Floor tap: Oyachi walks toward the tap
   - Sliders: volume/settings controls
   - Multi-touch via `getPointerId()`

7. **UI Layers**:
   - `room`: zIndex 0
   - `shadow`, `ballShadow`: zIndex 1
   - `ballSprite`: zIndex 2.4
   - `oyachi`: zIndex 2
   - `heartLayer`: zIndex 20
   - `uiLayer`: zIndex 40
   - `optionsLayer`: zIndex 50
   - `closetLayer`: zIndex 60

8. **Main Ticker Loop**:
   - Updates every frame (~60fps)
   - Handles all animations, physics, state transitions
   - Updates UI (hints, now-playing, care bar, toast popups, spotlight)

9. **Care System**:
   - Single care meter (0-100) decays over time
   - Petting and ball play refill care
   - Low care accelerates tiredness and triggers attention hints
   - Session streak rewards when care stays high

10. **No-asset Fun Loops**:
   - Ball nudges when idle to invite play
   - Zoomies burst during happy idle moments
   - Gratitude hearts on long-hold reaction

## State Machine Details

### State Transitions
```
idle → move → idle
     → blink → idle
     → pet → idle
     → tired → sleep → wake → idle
     → sneeze → idle
     → react_cute (hold pet) → idle
     → react_ayo (long hold) → move_away → idle
     → happy_jump_sequence (spam pet) → idle
```

### Key State Variables
- `state.current`: Current state name
- `state.timer`: Countdown for state duration
- `state.depth`: 0-1 depth for pseudo-3D
- `state.moveDirection`: 1 (right) or -1 (left)

## Conventions

### Sprite Size Consistency
- All Oyachi sprites must match base dimensions
- `applySpriteAnchor()` checks for mismatches >2px
- Warns to console if mismatch found

### Animation Timing
- All timings in `config/timings.js`
- Ticker uses `delta` (frame units) and `deltaSeconds`
- Consistent easing via `utils/math.js` functions

### Input Resilience
- `cancelPointerInteractions()` on blur/visibilitychange
- Multi-touch safe via pointer ID tracking
- Drag outside canvas handled gracefully

### No Per-Frame Allocations
- Heart particle system uses object pool (12 pre-created)
- Reuse objects where possible
- Avoid `new` in ticker callback

## Safe Modification Guidelines

### Very Safe
- Adjusting timing values in config
- Adding new states that extend existing machine
- Adding new UI elements
- Modifying heart particle counts

### Safe with Testing
- Changing sprite scales
- Adjusting physics constants
- Modifying state machine transitions

### Unsafe
- Removing existing states
- Changing core interaction mechanics
- Adding build steps or dependencies

## Pattern Examples

### Adding New State
```javascript
// 1. Add sprite
const newStateSprite = new PIXI.Sprite(textures.new_state);
oyachiSprites.push({ sprite: newStateSprite, name: "new_state" });

// 2. Add state variable
if (state.current === "new_state") {
  // State-specific logic
}

// 3. Add transition
const startNewState = () => {
  setState("new_state", duration);
  showSprite("new_state");
};
```

### Modifying Ball Physics
```javascript
const ballConfig = {
  gravity: 1600,        // Pixels per second squared
  bounceDamping: 0.55,  // Energy retained after bounce
  groundFriction: 0.95, // Velocity multiplier on ground
  // ... other values
};
```
