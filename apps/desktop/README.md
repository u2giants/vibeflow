# VibeFlow Desktop App

This is the Electron desktop application. It is the main user-facing product.

## Structure

```
apps/desktop/
├── src/
│   ├── main/           ← Electron main process (Node.js, local machine access)
│   │   ├── index.ts    ← Entry point for the main process
│   │   ├── ipc/        ← IPC handlers (bridge between renderer and main)
│   │   └── services/   ← Main-process services (file, terminal, git, ssh, secrets)
│   ├── renderer/       ← React UI (runs in Chromium)
│   │   ├── App.tsx     ← Root React component
│   │   ├── panels/     ← The five panels (TopBar, LeftPanel, CenterPanel, RightPanel, BottomPanel)
│   │   ├── components/ ← Shared UI components
│   │   └── hooks/      ← React hooks
│   └── preload/        ← Electron preload scripts (safe IPC bridge)
├── electron-builder.yml ← Packaging configuration
├── vite.config.ts      ← Vite build configuration
└── package.json        ← App dependencies and scripts
```

## How to Run in Development Mode

*(Commands will be added in Milestone 1 when the app is initialized)*

Prerequisites:
- Node.js 18+
- pnpm
- Git

```
# From the repo root:
pnpm install
pnpm dev
```

## How to Build

```
# From the repo root:
pnpm build
```

Output: `apps/desktop/dist/VibeFlow-Setup-x.y.z.exe`

## Key Concepts

- The **main process** has full access to the local machine (files, terminal, git, ssh, secrets)
- The **renderer process** is the React UI — it cannot access the local machine directly
- The **preload script** provides a safe, typed bridge between renderer and main via IPC
- All local machine operations go through IPC handlers in `src/main/ipc/`

## Notes

- See `/docs/architecture.md` for the full architecture
- See `/docs/release-process.md` for the build and release process
- See `/docs/build-metadata.md` for how version/commit info gets into the top bar
