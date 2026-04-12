/// <reference types="vite/client" />

import type { VibeFlowAPI } from '../lib/shared-types';

declare global {
  interface Window {
    vibeflow: VibeFlowAPI;
  }
}
