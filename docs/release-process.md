# VibeFlow — Release Process

Last updated: 2026-04-11

---

## Overview

VibeFlow has three modes of operation:
1. **Development mode** — for building and testing locally
2. **Production build** — a packaged Windows installer
3. **Auto-update** — the running app updates itself when a new release is published

---

## Development Mode

**How to start:**
```
pnpm dev
```
(Run from the repo root)

**What happens:**
- Vite starts the React dev server with hot reload
- Electron launches and loads the dev server URL
- Changes to React components update instantly without restarting Electron
- Changes to the Electron main process require restarting

**Logs:**
- Electron main process logs appear in the terminal
- Renderer logs appear in the Electron DevTools console (Ctrl+Shift+I)

**Build metadata in dev mode:**
- The inject-build-metadata script runs at startup
- Uses the current git state (your local uncommitted changes are reflected)
- Release channel shows as `dev`

---

## Production Build

**How to build:**
```
pnpm build
```
(Run from the repo root)

**What happens:**
1. `scripts/inject-build-metadata.ts` runs and generates `packages/build-metadata/src/generated.ts`
2. Vite builds the React renderer into static files
3. TypeScript compiles the Electron main process
4. `electron-builder` packages everything into a Windows installer (`.exe`)
5. The installer is output to `apps/desktop/dist/`

**Output:**
- `VibeFlow-Setup-1.2.0.exe` — NSIS installer for Windows
- `latest.yml` — update metadata file (used by electron-updater)

**Requirements:**
- Node.js 18+
- pnpm
- Git (for build metadata injection)
- Windows (for building the Windows installer)

---

## Release Publishing

**How releases are published:**
Releases are published automatically by GitHub Actions when a git tag is pushed.

**Steps to publish a release:**
1. Update the version in `apps/desktop/package.json` (e.g., `1.2.0`)
2. Commit the version bump: `git commit -m "chore: bump version to 1.2.0"`
3. Tag the commit: `git tag v1.2.0`
4. Push the tag: `git push origin v1.2.0`
5. GitHub Actions runs the release workflow automatically

**What the release workflow does:**
1. Checks out the code at the tagged commit
2. Runs `scripts/inject-build-metadata.ts` with `RELEASE_CHANNEL=stable`
3. Builds the Windows installer
4. Creates a GitHub Release with the tag name
5. Uploads the installer and `latest.yml` to the GitHub Release
6. The release is now available for auto-update

**GitHub Actions workflow file:** [`.github/workflows/release.yml`](../.github/workflows/release.yml)

---

## Auto-Update

**How it works:**
1. When VibeFlow starts, `electron-updater` checks the GitHub Releases page for a newer version
2. It compares the current version (from build metadata) against the latest release
3. If a newer version exists, a non-intrusive banner appears: *"Update available: v1.2.0 — Install now or later"*
4. The user clicks "Install now" — the installer downloads in the background
5. When ready, the app prompts: *"Restart to apply update"*
6. The app restarts into the new version

**No manual download or reinstall required.**

**Update check frequency:**
- On app startup
- Every 4 hours while the app is running

**Update channel:**
- The app checks for updates on the same release channel it was built with
- `stable` builds only update to `stable` releases
- `beta` builds update to `beta` releases

---

## Rollback

If a new release has a critical bug:

**Option 1: Download previous release manually**
1. Go to the GitHub Releases page
2. Download the previous version's installer
3. Run it — it will overwrite the current version

**Option 2: Publish a hotfix release**
1. Fix the bug on the main branch
2. Tag a new version (e.g., `v1.2.1`)
3. Push the tag — GitHub Actions publishes the new release
4. Running apps will auto-update to the hotfix

---

## Release Checklist

Before tagging a release:
- [ ] All Milestone acceptance criteria are met
- [ ] Manual test checklist completed (see `/docs/test-plan.md`)
- [ ] `/docs/non-programmer-dashboard.md` updated
- [ ] `/docs/owner-timeline.md` updated
- [ ] Version bumped in `apps/desktop/package.json`
- [ ] No known critical bugs
- [ ] Reviewer-Pusher has approved all changes

---

## NSIS vs. Squirrel

VibeFlow uses the NSIS installer format (not Squirrel) for Windows packaging. NSIS is more reliable on Windows enterprise configurations and handles UAC elevation more predictably. This is documented in `/docs/idiosyncrasies.md` if it causes any unexpected behavior.
