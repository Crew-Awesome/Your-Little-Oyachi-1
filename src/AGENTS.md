# Src Folder Guide

## Continuity Requirement
AI agents must keep AGENTS.md files continuously updated whenever they change code, move files, rename folders, adjust systems, or change build/deploy behavior. After any modification, verify the relevant AGENTS.md file(s) accurately reflect the new state of the repository.

## Purpose
- Root container for all game source code
- Single subfolder `game/` containing entire PixiJS game
- No build tools or compilation steps
- ES modules loaded directly by browser

## Structure

```
src/
├── game/              # Main game code
│   ├── index.js       # Entry point (loaded by HTML)
│   ├── scenes/        # Scene implementations
│   ├── systems/       # Runtime systems (audio)
│   ├── ui/            # UI overlays
│   ├── core/          # App infrastructure
│   ├── config/        # Configuration
│   └── utils/         # Helper utilities
└── AGENTS.md          # This file
```

## Entry Point

### `game/index.js`
**Loaded by:** `<script type="module" src="src/game/index.js">` in HTML

**Responsibilities:**
1. Bootstrap PixiJS application
2. Load all assets (textures, fonts)
3. Preload critical audio
4. Create main scene
5. Set up start overlay
6. Handle loading screen

**Export:** None (runs bootstrap automatically)

## Import Conventions

### Module Format
- ES modules with `import`/`export`
- Relative imports: `./` for same folder, `../` for parent

### Example Imports
```javascript
// From game/index.js
import { createMainScene } from "./scenes/main-scene.js";
import { audioSystem } from "./systems/audio-system.js";

// From game/scenes/main-scene.js
import { GAME_H, GAME_W } from "../config/constants.js";
import { audioStorageKeys } from "../config/storage.js";
```

### No Barrel Exports
- Import from specific files, not folder indexes
- Explicit is better than implicit

## Code Organization Principles

### Separation of Concerns
- `config/`: Pure data, no logic
- `core/`: App lifecycle, layout, events
- `systems/`: Shared runtime services
- `scenes/`: Game behavior and state
- `ui/`: Presentation overlays
- `utils/`: Pure helper functions

### No Circular Dependencies
- Import flow should be one-directional
- Config → Core → Systems → Scenes → UI
- Utils can be imported anywhere

### No Build Step
- All code runs as-is in browser
- No transpilation, bundling, or minification
- ES modules natively supported by modern browsers

## Safe Modification Guidelines

### Very Safe
- Adding new utility functions to utils/
- Adding new config values
- Adding new UI overlays to ui/

### Safe with Testing
- Modifying core/ infrastructure
- Adding new scenes
- Extending existing systems

### Unsafe
- Restructuring folder hierarchy
- Changing import paths
- Adding build tools or bundlers
- Modifying entry point bootstrap flow

## File Extension
- All source files use `.js` extension
- No TypeScript, no JSX
- ES6+ syntax supported by target browsers
