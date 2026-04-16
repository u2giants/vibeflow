/**
 * VerificationBundles — default verification bundle definitions.
 *
 * Each bundle specifies which verification layers are required for a given risk class.
 * These are seeded into the database on first run.
 */

import type { VerificationBundle } from '../shared-types';

export const DEFAULT_VERIFICATION_BUNDLES: VerificationBundle[] = [
  {
    id: 'bundle-low',
    name: 'Low-Risk Verification',
    riskClass: 'low',
    requiredLayers: ['instant-validity', 'acceptance-flow'],
    description: 'Syntax, lint, typecheck, and a basic acceptance flow (screenshot diff). Suitable for UI copy changes and minor tweaks.',
  },
  {
    id: 'bundle-medium',
    name: 'Medium-Risk Verification',
    riskClass: 'medium',
    requiredLayers: ['instant-validity', 'impacted-tests', 'acceptance-flow'],
    description: 'All low-risk checks plus impacted unit/integration tests and a browser acceptance flow. Suitable for behavior changes.',
  },
  {
    id: 'bundle-high',
    name: 'High-Risk Verification',
    riskClass: 'high',
    requiredLayers: ['instant-validity', 'impacted-tests', 'acceptance-flow', 'policy-safety'],
    description: 'All medium-risk checks plus policy and safety validation (risk policy, secrets completeness, migration safety, protected paths). Suitable for auth, data, and structural changes.',
  },
  {
    id: 'bundle-destructive',
    name: 'Destructive-Risk Verification',
    riskClass: 'destructive',
    requiredLayers: ['instant-validity', 'impacted-tests', 'acceptance-flow', 'policy-safety', 'deploy-specific'],
    description: 'Full verification including deploy-specific checks (health checks, rollback readiness, environment secret completeness). Suitable for destructive or production-affecting changes.',
  },
];

/** Select the appropriate bundle for a given risk class. */
export function selectBundleForRiskClass(riskClass: 'low' | 'medium' | 'high' | 'destructive'): VerificationBundle {
  const bundle = DEFAULT_VERIFICATION_BUNDLES.find((b) => b.riskClass === riskClass);
  if (!bundle) {
    // Fallback to medium if unknown risk class
    return DEFAULT_VERIFICATION_BUNDLES.find((b) => b.riskClass === 'medium')!;
  }
  return bundle;
}
