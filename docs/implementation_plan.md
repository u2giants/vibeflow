# Implementation Plan: Fix pnpm workspace + electron-vite on exFAT

## Problem

The D: drive is formatted **exFAT**, which does not support symlinks. pnpm workspaces rely on symlinks to link `workspace:*` packages into each consumer's `node_modules`. Every `pnpm install` that includes a `workspace:*` dependency fails with `EISDIR`.

The Builder tried several workarounds (npm workspaces, `file:` references, TypeScript `paths`, inlining types) — each introduced new breakage. The current state is:

1. `pnpm install` succeeds **only because** no `package.json` currently declares a `workspace:*` dependency (the Builder removed them all).
2. `pnpm dev` (→ `electron-vite dev`) fails because Vite/Rollup cannot resolve `@vibeflow/storage`, `@vibeflow/shared-types`, or `@vibeflow/build-metadata` at runtime — the aliases in `vite.config.ts` are not being applied before electron-vite's SSR resolution.

## Root Cause (Updated 2026-04-11)

`electron-vite`'s internal plugin `electronMainVitePlugin` (in `lib-CMs-qhOt.cjs` line 317) sets:
```js
config.ssr = { ...config.ssr, ...{ noExternal: true } };
config.build.ssr = true;
```

This puts the main/preload builds into Vite's SSR mode. In SSR mode, Vite's module resolution tries to resolve bare specifiers (like `@vibeflow/storage`) through Node's module resolution **before** applying `resolve.alias`. Since there is no `node_modules/@vibeflow/storage` (no symlinks on exFAT), the resolution fails with "Rollup failed to resolve import".

The `resolve.alias` config approach does NOT work for electron-vite's SSR builds because:
1. electron-vite merges configs via `vite.mergeConfig(defaultConfig, userConfig)` 
2. The SSR resolver checks node_modules before aliases get a chance to intercept
3. The error fires as a Rollup "unresolved import" warning promoted to error

## Solution

### Strategy: Vite plugin with `resolveId` hook + TypeScript `paths`

A Vite plugin's `resolveId` hook runs at the **earliest stage** of module resolution, before Rollup's built-in resolution and before any node_modules lookup. This guarantees interception of `@vibeflow/*` imports regardless of SSR mode.

Since exFAT cannot symlink, we **cannot** use `workspace:*` in any `package.json`. Instead:

1. **No `workspace:*` in any `package.json`** — packages that need types from other packages will resolve them via a Vite plugin (at bundle time) or TypeScript `paths` (at typecheck time).
2. **Vite plugin with `resolveId`** in `vite.config.ts` intercepts `@vibeflow/*` imports and redirects to source `.ts` files.
3. **TypeScript `paths`** in `apps/desktop/tsconfig.json` resolve `@vibeflow/*` imports at typecheck time.
4. **`packages/storage`** inlines its own minimal `Project` type (already done) so it has zero cross-package deps and can `tsc` independently.

### Step-by-step tasks for the Builder

#### Task 1: Fix `package.json` (root) ✅ DONE

The root `package.json` must use `pnpm --filter` syntax, not `cd apps/desktop && npm run dev`.

```json
{
  "scripts": {
    "dev": "pnpm --filter @vibeflow/desktop dev",
    "build": "pnpm --filter @vibeflow/desktop build",
    "build:metadata": "node scripts/inject-build-metadata.js",
    "typecheck": "pnpm -r typecheck"
  }
}
```

#### Task 2: Fix `apps/desktop/vite.config.ts` (UPDATED)

**Why `resolve.alias` failed**: electron-vite's SSR mode resolves bare specifiers through Node before aliases. A Vite plugin's `resolveId` hook runs first.

The config must:
1. Define a custom Vite plugin `vibeflowAliasPlugin()` with a `resolveId` hook that maps `@vibeflow/*` bare imports to their source `index.ts` files
2. Include this plugin in `main.plugins`, `preload.plugins`, and `renderer.plugins`
3. Keep `better-sqlite3` as external in main build
4. Set `renderer.root` and `renderer.build.rollupOptions.input` correctly

```ts
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Map @vibeflow/* bare imports to source directories
const packageAliases: Record<string, string> = {
  '@vibeflow/shared-types': resolve(__dirname, '../../packages/shared-types/src/index.ts'),
  '@vibeflow/build-metadata': resolve(__dirname, '../../packages/build-metadata/src/index.ts'),
  '@vibeflow/storage': resolve(__dirname, '../../packages/storage/src/index.ts'),
};

/**
 * Vite plugin that intercepts @vibeflow/* imports at the resolveId stage,
 * BEFORE Rollup/SSR tries node_modules resolution.
 * Required because electron-vite's SSR mode skips resolve.alias for bare specifiers.
 */
function vibeflowAliasPlugin() {
  return {
    name: 'vibeflow-alias',
    enforce: 'pre' as const,
    resolveId(source: string) {
      if (packageAliases[source]) {
        return packageAliases[source];
      }
      // Handle sub-path imports like @vibeflow/shared-types/entities
      for (const [prefix, target] of Object.entries(packageAliases)) {
        if (source.startsWith(prefix + '/')) {
          const subPath = source.slice(prefix.length + 1);
          const dir = dirname(target);
          return resolve(dir, subPath);
        }
      }
      return null; // Let other resolvers handle it
    },
  };
}

export default defineConfig({
  main: {
    build: {
      outDir: 'dist/main',
      rollupOptions: {
        external: ['better-sqlite3'],
      },
    },
    plugins: [vibeflowAliasPlugin()],
  },
  preload: {
    build: {
      outDir: 'dist/preload',
    },
    plugins: [vibeflowAliasPlugin()],
  },
  renderer: {
    root: 'src/renderer',
    build: {
      outDir: '../../dist/renderer',
      rollupOptions: {
        input: 'src/renderer/index.html',
      },
    },
    plugins: [react(), vibeflowAliasPlugin()],
  },
});
```

**Key insight**: The `resolveId` hook with `enforce: 'pre'` runs before ALL other resolution, including electron-vite's SSR node_modules lookup. This is the only reliable way to alias packages in electron-vite's SSR builds without symlinks.

#### Task 3: Fix `apps/desktop/tsconfig.json` ✅ DONE

Add `paths` so TypeScript can resolve `@vibeflow/*` without symlinks:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["vite/client"],
    "paths": {
      "@vibeflow/shared-types": ["../../packages/shared-types/src/index.ts"],
      "@vibeflow/shared-types/*": ["../../packages/shared-types/src/*"],
      "@vibeflow/build-metadata": ["../../packages/build-metadata/src/index.ts"],
      "@vibeflow/build-metadata/*": ["../../packages/build-metadata/src/*"],
      "@vibeflow/storage": ["../../packages/storage/src/index.ts"],
      "@vibeflow/storage/*": ["../../packages/storage/src/*"]
    }
  },
  "include": ["src"]
}
```

Remove the `references` array — project references also use symlinks under the hood and won't work on exFAT.

#### Task 4: Fix `.npmrc` ✅ DONE

The `onlyBuiltDependencies` syntax in `.npmrc` is wrong (YAML-style in an INI file). Use the correct pnpm format:

```ini
node-linker=hoisted
onlyBuiltDependencies[]=better-sqlite3
onlyBuiltDependencies[]=electron
onlyBuiltDependencies[]=esbuild
onlyBuiltDependencies[]=keytar
```

#### Task 5: Fix `apps/desktop/src/renderer/index.html` ✅ DONE (no change needed)

Already correct.

#### Task 6: Verify `packages/storage/src/supabase-client.ts` ✅ DONE

Simplified to remove unnecessary try/catch.

#### Task 7: Run and verify

```bash
pnpm install          # should succeed (no workspace:* deps)
pnpm dev              # should launch electron-vite, build main/preload/renderer, open window
```

## Validation Approach

1. `pnpm install` exits 0
2. `pnpm dev` opens an Electron window showing the sign-in screen
3. Sign in with Supabase credentials → see project list
4. Create a project → it appears in the list
5. Close and reopen → session persists
6. Top bar shows version, commit SHA, sync status, email

## Rollback Plan

If the plugin approach fails, the nuclear option is to **flatten everything into `apps/desktop`** — move all shared-types, storage, and build-metadata source files directly into `apps/desktop/src/lib/`. This eliminates all cross-package resolution. It's ugly but guaranteed to work. We can refactor back to proper packages once the repo moves to an NTFS drive.

## Key Decision

**DECISION**: On exFAT, pnpm `workspace:*` dependencies are impossible. `resolve.alias` also fails because electron-vite's SSR mode resolves bare specifiers through Node before aliases. We use a **Vite plugin with `resolveId` hook** (enforce: 'pre') + TypeScript `paths` to resolve `@vibeflow/*` imports to source files without symlinks. This is documented in `docs/idiosyncrasies.md`.
