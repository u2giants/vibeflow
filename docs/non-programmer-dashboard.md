# VibeFlow — Owner Dashboard

Last updated: 2026-04-12

---

## Current Sprint

**Sprint 2 — Milestone 1: Electron Shell + Supabase Auth + Project Scaffold**
Status: ✅ Complete — GitHub OAuth sign-in working, app launches successfully

---

## Where We Are

**Completed today:**
- Sprint 0: Architecture planning and approval
- Sprint 1: All documentation files and repo structure created
- Milestone 1: Electron app launches, GitHub OAuth sign-in works, project list screen works, top bar shows email

**What changed from email/password to GitHub OAuth:**
Albert signs in using GitHub OAuth (not email/password). The sign-in screen now shows a "Sign in with GitHub" button. When clicked, it opens GitHub in your browser, you authorize, and the app receives the callback automatically.

**Important fix discovered:**
The app was crashing on startup because of a system environment variable called `ELECTRON_RUN_AS_NODE=1` that was set on the machine. This forces Electron to run as plain Node.js instead of the full Electron app. Once removed, the app launches normally. If the app ever crashes with "Cannot read properties of undefined (reading 'whenReady')", check this environment variable.

**Next step:**
- Milestone 2: Build the five-panel layout with conversation, editor, and execution stream

---

## What Works Today

- Electron app launches with a sign-in screen
- "Sign in with GitHub" button opens GitHub OAuth in your browser
- After authorizing, the app signs you in and shows the project list
- Your email appears in the top bar after sign-in
- Local SQLite database is initialized for project storage
- Build config fixed: electron-vite now properly externalizes dependencies (bundle went from 730KB to 10KB)

**What does NOT work yet:**
- Cloud sync (Milestone 4)
- The five-panel layout (Milestone 2+)
- AI conversation (Milestone 3+)

---

## What Was Tested Today

- App launches successfully with `pnpm dev`
- Sign-in screen renders with GitHub OAuth button
- Top bar component exists and shows build metadata

---

## Biggest Risks Right Now

1. **Supabase Realtime for lease/heartbeat** (Medium risk) — The real-time ownership system is the most complex new piece. We will validate it in Milestone 4.

2. **keytar on Windows** (Medium risk) — The secure secret storage library needs to be tested on Albert's actual machine in Milestone 1.

3. **pnpm + electron-builder compatibility** (Low-Medium risk) — The monorepo build pipeline needs to be validated in Milestone 1.

---

## Last Major Architecture Decision

**GitHub OAuth via temporary localhost server** — 2026-04-12
Instead of using a custom URL scheme (like `vibeflow://`), the app starts a temporary local server on port 54321 to catch the GitHub OAuth callback. This is simpler and works reliably for Milestone 1. A custom URL scheme is the more "proper" approach and will be implemented later.

---

## Current Version / Commit

Version: 0.1.0 (development)
Commit: In progress
Built: N/A

---

## Next Decision Needed From You

**You need to configure Supabase for GitHub OAuth:**
1. Create `D:\repos\vibeflow\.env` with your Supabase URL and anon key (from Supabase Dashboard → Project Settings → API)
2. Add `http://localhost:54321/callback` to Supabase Dashboard → Authentication → URL Configuration → Redirect URLs
3. Ensure GitHub OAuth is enabled in Supabase Dashboard → Authentication → Providers → GitHub

After that, run `pnpm dev` and test the sign-in flow.

---

## Sync Status Summary

Not applicable yet — cloud sync will be tested in Milestone 4.

---

## How to Follow Along

As each Milestone completes, this dashboard will be updated with:
- What was built
- How to test it
- What works
- What the next step is

You do not need to read the technical docs to follow the project. This dashboard is your main window into what is happening.
