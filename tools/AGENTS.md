# Tools Folder Guide

## Continuity Requirement
AI agents must keep AGENTS.md files continuously updated whenever they change code, move files, rename folders, adjust systems, or change build/deploy behavior. After any modification, verify the relevant AGENTS.md file(s) accurately reflect the new state of the repository.

## Purpose
- Local development helper scripts and utilities
- Non-essential to core game functionality
- Optional convenience for developers

## Key Files

### `run-local.bat`
**Purpose:** Batch script to launch local HTTP server

**Usage:**
```batch
cd path\to\repo\tools
run-local.bat
```

**Behavior:**
- Launches local HTTP server (typically Python)
- Opens browser to game URL
- Enables hot reload during development

### `README.md`
**Purpose:** Documentation for tooling

**Contents:**
- Setup instructions
- Common commands
- Troubleshooting tips

## Typical Tools Structure

```
tools/
├── run-local.bat        # Windows launch script
├── run-local.sh         # Linux/Mac launch script (optional)
├── README.md            # Tooling documentation
├── AGENTS.md            # This file
└── (other helper scripts)
```

## Safe Modification Guidelines

### Very Safe
- Updating documentation
- Adding new helper scripts
- Improving existing scripts

### Safe with Testing
- Modifying script behavior
- Adding new command-line options

### Unsafe
- Modifying game code from tools
- Adding automated deployments
- Changing production workflow

## Development Workflow

### Without Tools (Manual)
1. Open HTML file directly, or
2. Run HTTP server: `python -m http.server 8000`
3. Navigate to `http://localhost:8000`

### With Tools
1. Run `tools/run-local.bat` (or equivalent)
2. Script starts server and opens browser
3. Make code changes
4. Refresh browser to see changes

## Best Practices

### Script Simplicity
- Keep scripts short and focused
- No complex logic
- Easy to understand and modify

### Non-Destructive
- Scripts should never modify source files
- No automatic commits or deployments
- Read-only operations preferred

### Cross-Platform
- Scripts should work on major OSes
- Provide both .bat and .sh versions if possible
- Graceful error handling
