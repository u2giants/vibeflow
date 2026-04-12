/** DevOps template definitions for VibeFlow projects. */

export interface DevOpsTemplate {
  id: string;
  name: string;
  description: string;
  branchStrategy: 'push-to-main' | 'feature-branch-pr';
  buildTool: 'docker';
  registry: 'ghcr.io';
  imageName: string;
  imageTags: string[];
  deployTargetType: 'coolify' | 'manual';
  triggerMethod: 'api-webhook' | 'manual';
  requiredSecrets: string[];
  environmentVariables: string[];
  plainEnglishExplanation: string;
  isBuiltIn: boolean;
}

export const STANDARD_TEMPLATE: DevOpsTemplate = {
  id: 'template-standard',
  name: 'Standard',
  description: 'Feature branch workflow with pull requests and automated testing.',
  branchStrategy: 'feature-branch-pr',
  buildTool: 'docker',
  registry: 'ghcr.io',
  imageName: '',
  imageTags: [':main', ':sha-{commit}'],
  deployTargetType: 'coolify',
  triggerMethod: 'api-webhook',
  requiredSecrets: ['GHCR_TOKEN', 'COOLIFY_API_KEY', 'COOLIFY_APP_ID'],
  environmentVariables: [],
  plainEnglishExplanation: 'When you merge a pull request into main, GitHub automatically builds your app into a Docker image, uploads it to GitHub\'s container registry, then tells Coolify to pull the new image and go live. You don\'t need to do anything manually.',
  isBuiltIn: true,
};

export const ALBERT_TEMPLATE: DevOpsTemplate = {
  id: 'template-albert',
  name: 'Albert',
  description: 'Push directly to main — no branches, no pull requests. GitHub Actions builds and deploys automatically.',
  branchStrategy: 'push-to-main',
  buildTool: 'docker',
  registry: 'ghcr.io',
  imageName: '',
  imageTags: [':main', ':sha-{commit}'],
  deployTargetType: 'coolify',
  triggerMethod: 'api-webhook',
  requiredSecrets: ['GHCR_TOKEN', 'COOLIFY_API_KEY', 'COOLIFY_APP_ID'],
  environmentVariables: [],
  plainEnglishExplanation: 'When you push to main, GitHub automatically builds your app into a Docker image, uploads it to GitHub\'s container registry with two labels (one that always says "latest main" and one with the exact commit ID), then tells Coolify to pull the new image and go live. You don\'t need to do anything else. Your app\'s settings and secrets are stored in Coolify, not in GitHub.',
  isBuiltIn: true,
};

export const BUILT_IN_TEMPLATES: DevOpsTemplate[] = [STANDARD_TEMPLATE, ALBERT_TEMPLATE];
