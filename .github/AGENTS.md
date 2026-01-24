# GitHub Workflows Guide

## Continuity Requirement
AI agents must keep AGENTS.md files continuously updated whenever they change code, move files, rename folders, adjust systems, or change build/deploy behavior. After any modification, verify the relevant AGENTS.md file(s) accurately reflect the new state of the repository.

## Purpose
- CI/CD configuration for automatic deployment
- FTP-based deployment to hosting server
- Triggered on push to main branch

## Key Files

### `workflows/deploy.yml`
**Purpose:** Automated FTP deployment workflow

**Triggers:**
- Push to `main` branch
- Manual dispatch via GitHub Actions tab

**Jobs:**
```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 1  # Shallow clone

      - name: Validate FTP config
        env:
          FTP_HOST: ftpupload.net
          FTP_USERNAME: b15_40908595
          FTP_PASSWORD: losleones2018
          FTP_TARGET_DIR: oyachigame.nichesite.org/htdocs/
        run: |
          # Validates all required env vars exist
          for var in FTP_HOST FTP_USERNAME FTP_PASSWORD FTP_TARGET_DIR; do
            if [ -z "${!var}" ]; then
              echo "Missing required value: $var"
              exit 1
            fi
          done

      - name: Deploy
        uses: SamKirkland/FTP-Deploy-Action@v4.3.5
        with:
          server: ftpupload.net
          username: b15_40908595
          password: losleones2018
          server-dir: oyachigame.nichesite.org/htdocs/
          protocol: ftp
          dangerous-clean-slate: false
          exclude: |
            **/.git/**
            **/.git*
            **/.github/**
            **/node_modules/**
            **/.env*
            **/.DS_Store
            **/Thumbs.db
```

**Deployment Target:**
- Server: ftpupload.net
- Protocol: FTP (not SFTP)
- Directory: `oyachigame.nichesite.org/htdocs/`
- Username: b15_40908595

**Excluded Patterns:**
- `.git/` directory and files
- `.github/` workflows directory
- `node_modules/` (if present)
- `.env*` files (secrets)
- System files: `.DS_Store`, `Thumbs.db`

## Conventions

### Credentials
- FTP credentials stored as GitHub repository secrets
- **NEVER modify or expose credentials in code**
- Referenced via `env` section in workflow

### Deployment Safety
- `dangerous-clean-slate: false` prevents accidental deletion
- Only uploads files, never deletes remote files
- Excludes prevent sensitive files from being uploaded

### Trigger Discipline
- Only deploys on `main` branch
- Feature branches can be tested locally
- Manual dispatch available for re-deployment

## Safe Modification Guidelines

### Very Safe
- Changing exclude patterns
- Updating action versions (e.g., @v4.3.5 → @v4.3.6)
- Adjusting fetch-depth

### Safe with Testing
- Adding new exclude patterns
- Modifying deployment directory

### Unsafe
- Changing FTP credentials
- Changing deployment protocol
- Modifying trigger conditions
- Adding new deployment steps

## Deployment Process

### Automatic (Push to Main)
1. Developer pushes changes to `main`
2. GitHub Actions triggers workflow
3. Validates FTP configuration
4. Uploads all files (except excluded patterns)
5. Files appear at `https://oyachigame.nichesite.org/`

### Manual
1. Go to GitHub → Actions → Deploy via FTP
2. Click "Run workflow"
3. Select branch (usually main)
4. Workflow executes

### Local Testing
1. Run local HTTP server (e.g., `python -m http.server 8000`)
2. Test at `http://localhost:8000`
3. Push to main when ready
4. Automatic deployment follows

## Common Issues

### Deployment Failures
- Check GitHub Actions logs for error messages
- Verify FTP credentials haven't expired
- Check file size limits

### Missing Files
- Verify files aren't in exclude patterns
- Check .gitignore patterns
- Ensure files are committed

### Credential Errors
- Credentials managed in GitHub repository settings
- Only repository admins can update
- Contact maintainer if credentials need updating

## No Build Step
- This project has no build/compilation step
- Source files deploy directly
- No webpack, no bundler, no transpilation
