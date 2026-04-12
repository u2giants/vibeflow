/**
 * Build metadata — version, commit SHA, date, release channel.
 * The generated.ts file is created by scripts/inject-build-metadata.js at build/dev time.
 * Run: node scripts/inject-build-metadata.js before starting the app.
 */

// Static import — Vite bundles this at build time.
// generated.ts is gitignored and must be created by the injection script.
import { BUILD_METADATA } from './generated';

export { BUILD_METADATA };
export type BuildMetadata = typeof BUILD_METADATA;
