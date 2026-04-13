import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

/**
 * Custom plugin to force externalization of specific packages.
 * This is needed because electron-vite's externalizeDepsPlugin only
 * externalizes dependencies, not devDependencies like 'electron'.
 */
function forceExternalize(packages: string[]): Plugin {
  const pattern = new RegExp(`^(${packages.join('|')})(/.+)?$`);
  return {
    name: 'vite:force-externalize',
    enforce: 'pre',
    config() {
      return {
        build: {
          rollupOptions: {
            external: pattern,
          },
        },
      };
    },
  };
}

const externalPackages = [
  'electron',
  '@supabase/supabase-js',
  'better-sqlite3',
  'keytar',
  'dotenv',
];

export default defineConfig({
  main: {
    plugins: [
      forceExternalize(externalPackages),
      externalizeDepsPlugin(),
    ],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    root: 'src/renderer',
    build: {
      outDir: 'out/renderer',
      rollupOptions: {
        input: 'src/renderer/index.html',
      },
    },
    plugins: [react()],
  },
});
