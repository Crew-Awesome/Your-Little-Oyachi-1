# Config Guide

## Continuity Requirement
AI agents must keep AGENTS.md files continuously updated whenever they change code, move files, rename folders, adjust systems, or change build/deploy behavior. After any modification, verify the relevant AGENTS.md file(s) accurately reflect the new state of the repository.

## Purpose
- Centralized configuration for all game constants, assets, timings, and persistence keys
- Single source of truth for tunable values
- No business logic, only data exports

## Key Files

### `assets.js`
**Purpose:** Asset manifest declarations

**Structure:**
```javascript
export const uiAssets = [/* UI icon textures */];
export const gameAssets = [/* Character, ball textures */];
export const fontAssets = [/* Custom fonts (WOFF2) */];
export const coverArtAsset = {/* Start screen cover image */};
```

**Usage:** Imported in `index.js` and passed to `PIXI.Assets.load()`

**Safe to Modify:**
- Add new assets to appropriate arrays
- Change asset paths
- Add new asset categories

**Unsafe:**
- Removing existing assets (breaks game)

**Example Addition:**
```javascript
{ alias: "my_new_sprite", src: "assets/images/characters/oyachi/my_new_sprite.png" }
```

### `constants.js`
**Purpose:** Game dimension constants

**Current Values:**
```javascript
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const GAME_W = GAME_WIDTH;
export const GAME_H = GAME_HEIGHT;
```

**Usage:** Referenced throughout game for layout, positioning, and renderer setup

**Safe to Modify:**
- Can adjust dimensions if needed for new aspect ratios

**Unsafe:**
- Changing these affects entire layout system
- Test thoroughly on multiple screen sizes

### `audio.js`
**Purpose:** Audio defaults and pitch configuration

**Structure:**
```javascript
export const audioDefaults = {
  musicVolume: 0.22,
  sfxVolume: 0.7,
  musicEnabled: true,
  sfxEnabled: true,
};

export const audioPitchConfig = {
  basePitch: 1.08,
  variation: 0.05, // ±5% pitch variation
};
```

**Usage:** Imported in `audio-system.js` for initialization

**Safe to Modify:**
- Volume levels (0-1 range)
- Pitch variation amount

### `timings.js`
**Purpose:** All timing constants for behaviors (55 lines)

**Categories:**

**Idle Behavior:**
- `tiredDelay`: 14s before tired state
- `sleepDelay`: 6s in tired before sleep
- `sneezeChance`: 0.12 (12% probability)
- `sneezeDuration`: 0.55s animation

**Sleep Timing:**
- `frameDuration`: 0.7s between sleep frames (alternates sleep_1/sleep_2)

**Wake Timing:**
- `duration`: 0.6s wake animation

**Pet Hold:**
- `gentleDelayMs`: 350ms before cute hearts start
- `ayoDelayMs`: 4200ms before react_ayo state
- `ayoDuration`: 0.9s for ayo reaction
- `cuteHeartInterval`: 0.6s between hearts
- `cuteSquishSpeed`: 1.1 squish animation speed
- `ayoSquishSpeed`: 2.1 faster squish for ayo

**Pet Spam Detection:**
- `quickWindowMs`: 260ms window for quick pets
- `resetWindowMs`: 420ms reset threshold
- `requiredCount`: 6 pets to trigger happy jump

**Idle Bob:**
- `period`: 3.4s cycle time
- `amplitude`: 3px movement
- `ease`: 0.08 interpolation factor

**Jump Micro:**
- `period`: 0.7s oscillation
- `amplitude`: 1.6px
- `squash`: 0.012 scale factor
- `ease`: 0.18 interpolation

**Happy Jump Sequence:**
- `minJumps`: 2, `maxJumps`: 4
- `baseHeight`: 34px jump height
- `launchDuration`: 0.46s
- `apexDuration`: 0.18s
- `fallDuration`: 0.5s
- `landingDuration`: 0.14s
- `interJumpDelay`: 0.12s
- `minHeight`: 18px floor

**Hint Timing:**
- `fadeIn`: 0.5s
- `hold`: 2.4s
- `fadeOut`: 0.6s
- `gapMin`: 3.5s minimum between hints
- `gapMax`: 6.5s maximum between hints

**Safe to Modify:**
- All timing values are safe to adjust
- Changes affect game feel but not stability
- Test for balance issues

### `storage.js`
**Purpose:** localStorage key definitions

**Structure:**
```javascript
export const audioStorageKeys = {
  musicVolume: "oyachi_music_volume",
  sfxVolume: "oyachi_sfx_volume",
  musicEnabled: "oyachi_music_enabled",
  sfxEnabled: "oyachi_sfx_enabled",
};

export const hintStorageKeys = {
  seen: "oyachi_hints_seen",
  enabled: "oyachi_hints_enabled",
};
```

**Usage:** Imported where persistence is needed

**Safe to Modify:**
- Can add new storage keys
- Should not remove or rename existing keys (loses user data)

**Best Practice for New Keys:**
```javascript
export const myFeatureStorageKeys = {
  enabled: "oyachi_my_feature_enabled",
};
```

## Conventions

### File Structure
- Each config file exports a single object or set of objects
- No runtime logic, only static data
- All values are primitives or simple objects

### Naming Conventions
- `*Keys` suffix for localStorage key objects
- `*Config` suffix for configuration objects
- `*Timing` suffix for timing-related exports
- camelCase for all properties

### Values Range
- Volumes: 0-1 (float)
- Chances: 0-1 (probability)
- Durations: seconds (float)
- Milliseconds: explicit `*Ms` suffix
- Colors: 0x hex format

## Safe Modification Guidelines

### Very Safe
- Adding new asset entries
- Adding new storage keys
- Adjusting timing values

### Safe with Testing
- Changing dimension constants (affects layout)
- Adjusting volume levels
- Modifying probability values

### Unsafe
- Removing existing asset entries
- Renaming/removing storage keys
- Changing key structures
