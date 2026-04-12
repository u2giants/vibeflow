/**
 * Build metadata — version, commit SHA, date, release channel.
 * Falls back to dev values if generated.ts does not exist.
 */

import { BUILD_METADATA as GENERATED_METADATA } from './generated';

interface BuildMetadata {
  version: string;
  commitSha: string;
  commitDate: string;
  releaseChannel: string;
}

const DEV_METADATA: BuildMetadata = {
  version: '0.1.0-dev',
  commitSha: 'dev',
  commitDate: new Date().toISOString(),
  releaseChannel: 'dev',
};

// Use generated metadata if available, otherwise fall back to dev values
const BUILD_METADATA: BuildMetadata = GENERATED_METADATA ?? DEV_METADATA;

export { BUILD_METADATA };
export type { BuildMetadata };
