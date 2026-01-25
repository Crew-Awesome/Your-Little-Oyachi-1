# Utils Guide

## Continuity Requirement
AI agents must keep AGENTS.md files continuously updated whenever they change code, move files, rename folders, adjust systems, or change build/deploy behavior. After any modification, verify the relevant AGENTS.md file(s) accurately reflect the new state of the repository.

## Purpose
- Reusable helper functions across the game
- Pure functions with no side effects
- Shared utilities for math, pointers, and textures

## Key Files

### `math.js`
**Purpose:** Math utilities for animations and clamping

**Exports:**
```javascript
export const clamp(value, min, max): // Clamps value between min and max
export const easeInCubic(t): // Ease in cubic: t³
export const easeOutCubic(t): // Ease out cubic: 1-(1-t)³
```

**Usage Examples:**
```javascript
// Clamping for safe values
const scaledValue = clamp(value, 0, 1);

// Easing for smooth animations
const easedProgress = easeOutCubic(progress);
```

**Safe to Modify:**
- Can adjust easing functions
- Add new math utilities

### `pointer.js`
**Purpose:** Multi-touch safe pointer ID extraction

**Exports:**
```javascript
export const getPointerId(event): // Returns pointer ID from event
```

**Details:**
- Extracts `event.data.originalEvent?.pointerId` or `event.pointerId`
- Handles various pointer event formats
- Returns number for comparison

**Usage:**
```javascript
const pointerId = getPointerId(event);
if (activePointerId !== null && pointerId !== activePointerId) {
  return; // Ignore other pointers
}
```

**Safe to Modify:**
- Add support for new event formats if needed

### `texture.js`
**Purpose:** Safe dimension extraction from textures

**Exports:**
```javascript
export const getSafeDimension(value, fallback): // Safe dimension with fallback
export const getTextureDimension(texture, dimension, fallback): // Get texture dimension
```

**Details:**
- `getSafeDimension`: Returns value or fallback if undefined/NaN
- `getTextureDimension`: Gets texture width/height with fallback

**Usage:**
```javascript
const width = getSafeDimension(icon?.width, 1);
const iconWidth = getTextureDimension(icon.texture, "width", defaultSize);
```

**Safe to Modify:**
- Add dimension utilities as needed

## Conventions

### Purity
- All functions should be pure (same input = same output)
- No modification of external state
- No side effects

### Defensive Coding
- Always provide fallbacks for undefined values
- Handle edge cases (NaN, Infinity, null)

### Naming
- Descriptive names explaining purpose
- camelCase for all functions and variables

## Safe Modification Guidelines

### Very Safe
- Adding new utility functions
- Adding fallbacks for edge cases
- Improving documentation

### Safe with Testing
- Modifying easing functions (affects animations)
- Changing fallback values

### Unsafe
- Making functions impure
- Removing existing utilities

## Pattern Examples

### Adding New Utility
```javascript
// In appropriate file (math.js, pointer.js, or texture.js)
export const myNewUtility = (param) => {
  // Pure function logic
  return result;
};
```

### Using Clamp
```javascript
// Before
let value = Math.random() * 100; // Could be 0-100

// After (safe)
let value = clamp(Math.random() * 100, 10, 90); // Always 10-90
```

### Multi-Touch Handling
```javascript
// Check if this is the active pointer
const pointerId = getPointerId(event);
if (sliderState.active && sliderState.pointerId !== null) {
  if (pointerId !== sliderState.pointerId) {
    return; // Ignore other pointers during drag
  }
}
```
