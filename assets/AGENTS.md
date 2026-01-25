# Assets Folder Guide

## Continuity Requirement
AI agents must keep AGENTS.md files continuously updated whenever they change code, move files, rename folders, adjust systems, or change build/deploy behavior. After any modification, verify the relevant AGENTS.md file(s) accurately reflect the new state of the repository.

## Purpose
- Stores all art, audio, font, and icon assets for the site and game
- Referenced by `src/game/config/assets.js` for loading
- No runtime processing or transforms
- Deployed as-is to hosting server

## Folder Structure

### `audio/`
**Subfolders:**
- `music/`: Background music tracks (MP3)
- `sfx/`: Sound effects and loops (WAV)

**Music Files:**
- `AcousticMeditation2.mp3`
- `AmazingGrace.mp3`
- `AutumnSunset.mp3`
- `Noel.mp3`
- `OneFineDay.mp3`
- `PaperWings.mp3`

**SFX Files:**
- `ball_bounce_1.wav`, `ball_bounce_2.wav`
- `ball_toss.wav`
- `pet_fast_1.wav`, `pet_fast_2.wav`
- `pet_soft_1.wav`, `pet_soft_2.wav`
- `pet_hold_magic_loop.wav`
- `pet_oh_soft.wav`
- `sleep_snooze_loop.wav`
- `sneeze.wav`
- `walk_hop_1.wav`, `walk_hop_2.wav`

**Format Requirements:**
- Music: MP3, any sample rate
- SFX: WAV (PCM), preferably 44.1kHz
- Loops must be gapless (no click at end)

### `fonts/`
**Current Font:**
- `Tiny5-Regular.ttf`: Tiny5 pixel font (WOFF2 URL in assets.js)

**Format:** TTF or WOFF2 recommended
**Usage:** In-game text (Tiny5 fontFamily)

### `images/`
**Subfolders:**

#### `characters/oyachi/`
**Purpose:** Oyachi character sprites

**Files:**
- `base/idle_neutral.png`: Default idle pose
- `base/idle_blink.png`: Blinking animation
- `base/pet_squish.png`: Pet reaction
- `base/hold_ball.png`: Holding ball pose
- `base/idle_tired.png`: Tired before sleep
- `base/idle_sneeze.png`: Sneeze animation
- `base/sleep_idle_1.png`: Sleep frame 1
- `base/sleep_idle_2.png`: Sleep frame 2
- `base/react_excited_cute.png`: Hold pet cute reaction
- `base/react_excited_ayo.png`: Long hold ayo reaction

**Format:** PNG with transparency
**Dimensions:** All sprites should share consistent base dimensions
**Style:** Pixel art, same scale (0.6 in game)

#### `site/`
**Purpose:** Site-only static assets

**Files:**
- `logo.png`: Site logo
- `coverart.png`: Open graph cover image
- `bggradient.png`: Background gradient

**Format:** PNG for images with transparency

#### `toys/`
**Purpose:** Interactive toy sprites

**Files:**
- `ball.png`: Ball toy sprite

**Format:** PNG with transparency

#### `ui/`
**Purpose:** In-game UI icons

**Files:**
- `gear.png`: Settings button
- `fullscreenenter.png`: Enter fullscreen
- `fullscreenexit.png`: Exit fullscreen
- `toys.png`: Toys panel button
- `costumes.png`: Closet/costumes button
- `arrowleftcartoon.png`: Back button
- `arrowrightcartoon.png`: Play button
- `check.png`: Toggle checkmark
- `heart.png`: Heart particle

**Format:** PNG with transparency
**Style:** Consistent with game aesthetic

#### `icons/`
**Purpose:** Browser metadata icons (favicon, etc.)

**Files:**
- `faviconbig.png`

**Format:** PNG

## Naming Conventions

### General Rules
- Lowercase filenames
- No spaces (use underscores or hyphens)
- Descriptive names
- Consistent separators (use one style)

### Character Sprites
- `{state}.png` format
- States: `idle`, `idle_blink`, `pet`, `hold_ball`, `idle_tired`, `idle_sneeze`, `sleep_1`, `sleep_2`, `react_cute`, `react_ayo`

### SFX Files
- `{action}_{variant}.wav` format
- Variants: numbered (1, 2) or descriptive (soft, fast)

### UI Icons
- `{function}.png` format
- Functions: `settings`, `fullscreen_enter`, `fullscreen_exit`, `toys`, `costumes`, `back`, `play`, `check`, `heart`

## Asset Loading

### Manifest in `src/game/config/assets.js`
```javascript
export const uiAssets = [
  { alias: "ui_settings", src: "assets/images/ui/gear.png" },
  // ...
];

export const gameAssets = [
  { alias: "idle", src: "assets/images/characters/oyachi/base/idle_neutral.png" },
  // ...
];

export const fontAssets = [
  { alias: "Tiny5", src: "https://db.onlinewebfonts.com/t/.../Tiny5.woff2" },
];
```

### Loading Process
1. `index.js` imports asset arrays
2. `PIXI.Assets.load([...assets], onProgress)` loads all
3. Textures available in `textures` object by alias
4. Audio loaded separately via `audio-system.js`

## Safe Modification Guidelines

### Very Safe
- Adding new assets (add path to assets.js)
- Creating new folders for organization
- Adding new subcategories

### Safe with Testing
- Renaming assets (update all references)
- Moving assets between folders (update paths)
- Replacing assets with same dimensions

### Unsafe
- Removing existing assets (breaks game)
- Changing sprite dimensions (causes size mismatch warnings)
- Modifying asset loading code

## Sprite Size Requirements

### Oyachi Sprites
- All must share base dimensions
- `applySpriteAnchor()` warns if mismatch >2px
- Check sprite dimensions before adding

### UI Icons
- Can vary in size
- Scaled dynamically in UI code
- Use `getTextureDimension()` for safe sizing

## Best Practices

### Before Adding Assets
1. Create asset in correct folder
2. Match existing naming convention
3. Add to `src/game/config/assets.js`
4. Test in game

### Pixel Art
- Use NEAREST scale mode (already set in index.js)
- No anti-aliasing
- Crisp edges preferred

### Audio
- Use consistent sample rate (44.1kHz)
- Normalize volume levels
- Gapless loops for looping SFX
