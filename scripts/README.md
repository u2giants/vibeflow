# VibeFlow Scripts

This directory contains development, build, and release scripts.

## Scripts (to be created in Milestone 1 and Milestone 9)

| Script | Purpose |
|---|---|
| `dev.cmd` | Start the app in development mode on Windows |
| `build.cmd` | Build the packaged Windows installer |
| `release.cmd` | Tag and publish a new release |
| `inject-build-metadata.ts` | Inject version/commit/date into the build (runs automatically) |

## Notes

- Scripts are Windows-first (`.cmd` files for Windows, `.sh` equivalents may be added later)
- `inject-build-metadata.ts` is a TypeScript script run by `ts-node` or `tsx` at build time
- See `/docs/build-metadata.md` for how the metadata injection works
- See `/docs/release-process.md` for the full release process
