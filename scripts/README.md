# VibeFlow Scripts

This directory contains build and development scripts.

## Actual Scripts

| Script | Purpose |
|---|---|
| `inject-build-metadata.js` | Reads version from `package.json`, git commit SHA and date from git, and `RELEASE_CHANNEL` from env; writes `apps/desktop/src/lib/build-metadata/generated.ts`. Runs automatically before `pnpm dev` and `pnpm build`. |

## Notes

- `inject-build-metadata.js` is a plain Node.js script (no `tsx` needed).
- It is referenced from the `dev` and `build` scripts in the root `package.json`.
- The generated file (`generated.ts`) is listed in `.gitignore` — do not commit it.
- See [`/docs/build-metadata.md`](../docs/build-metadata.md) for how metadata injection works.
- See [`/docs/release-process.md`](../docs/release-process.md) for the full release process.
