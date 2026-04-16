/** Terminal command classifier — analyzes commands before execution. */

import type { ApprovalTier } from '../approval/approval-engine';

export interface TerminalClassification {
  filesystemScope: boolean;
  networkAccess: boolean;
  packageInstallation: boolean;
  gitMutation: boolean;
  databaseTouch: boolean;
  serviceDeployTouch: boolean;
  destructiveFlags: boolean;
  riskLevel: 'safe' | 'caution' | 'dangerous';
  approvalTier: ApprovalTier;
  reason: string;
}

/** Dangerous command patterns that should always be flagged. */
const DANGEROUS_PATTERNS = [
  /\brm\s+(-rf?|--recursive)\s/i,       // rm -rf
  /\bdd\s+if=/i,                         // dd (disk destroyer)
  /\bmkfs/i,                             // format filesystem
  /\bchmod\s+777/i,                      // world-writable permissions
  /\bchown\s+root/i,                     // change ownership to root
  /\bsudo\s/i,                           // sudo escalation
  /\bshutdown\b/i,                       // shutdown
  /\breboot\b/i,                         // reboot
  /\bformat\b/i,                         // format (Windows)
  /\bdel\s+\/f\s+\/q/i,                  // force delete (Windows)
  /\bnet\s+user\b/i,                     // user management
  /\breg\s+delete/i,                     // registry delete (Windows)
];

/** Package installation patterns. */
const PACKAGE_PATTERNS = [
  /\bnpm\s+install\b/i,
  /\bnpm\s+i\b/,
  /\bpnpm\s+install\b/i,
  /\bpnpm\s+add\b/i,
  /\byarn\s+add\b/i,
  /\byarn\s+install\b/i,
  /\bpip\s+install\b/i,
  /\bapt-get\s+install\b/i,
  /\bbrew\s+install\b/i,
  /\bwinget\s+install\b/i,
];

/** Network access patterns. */
const NETWORK_PATTERNS = [
  /\bcurl\b/i,
  /\bwget\b/i,
  /\bfetch\b/i,
  /\bssh\b/i,
  /\bscp\b/i,
  /\bnc\b/i,
  /\bnetcat\b/i,
  /\bping\b/i,
  /\bnslookup\b/i,
  /\bdig\b/i,
];

/** Git mutation patterns. */
const GIT_MUTATION_PATTERNS = [
  /\bgit\s+commit\b/i,
  /\bgit\s+push\b/i,
  /\bgit\s+reset\b/i,
  /\bgit\s+rebase\b/i,
  /\bgit\s+amend\b/i,
  /\bgit\s+clean\b/i,
];

/** Database touch patterns. */
const DATABASE_PATTERNS = [
  /\bpsql\b/i,
  /\bmysql\b/i,
  /\bsqlite3\b/i,
  /\bmongo\b/i,
  /\bredis-cli\b/i,
  /\bpg_dump\b/i,
  /\bmysqldump\b/i,
];

/** Service/deploy touch patterns. */
const SERVICE_DEPLOY_PATTERNS = [
  /\bdocker\s+build\b/i,
  /\bdocker\s+push\b/i,
  /\bdocker\s+compose\s+up\b/i,
  /\bdeploy\b/i,
  /\bcoolify\b/i,
  /\bheroku\b/i,
  /\bvercel\b/i,
  /\bnetlify\b/i,
];

/**
 * Classify a terminal command before execution.
 * Returns a classification object with risk level and approval tier.
 */
export function classifyTerminalCommand(command: string): TerminalClassification {
  const classification: TerminalClassification = {
    filesystemScope: false,
    networkAccess: false,
    packageInstallation: false,
    gitMutation: false,
    databaseTouch: false,
    serviceDeployTouch: false,
    destructiveFlags: false,
    riskLevel: 'safe',
    approvalTier: 1,
    reason: '',
  };

  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      classification.destructiveFlags = true;
      classification.riskLevel = 'dangerous';
      classification.approvalTier = 3;
      classification.reason = `Command matches dangerous pattern: ${pattern.source}`;
      return classification;
    }
  }

  // Check for filesystem operations
  if (/\b(touch|mkdir|cp|copy|mv|move|write|echo\s*>>|tee)\b/i.test(command)) {
    classification.filesystemScope = true;
  }

  // Check for network access
  for (const pattern of NETWORK_PATTERNS) {
    if (pattern.test(command)) {
      classification.networkAccess = true;
      break;
    }
  }

  // Check for package installation
  for (const pattern of PACKAGE_PATTERNS) {
    if (pattern.test(command)) {
      classification.packageInstallation = true;
      break;
    }
  }

  // Check for git mutation
  for (const pattern of GIT_MUTATION_PATTERNS) {
    if (pattern.test(command)) {
      classification.gitMutation = true;
      break;
    }
  }

  // Check for database touch
  for (const pattern of DATABASE_PATTERNS) {
    if (pattern.test(command)) {
      classification.databaseTouch = true;
      break;
    }
  }

  // Check for service/deploy touch
  for (const pattern of SERVICE_DEPLOY_PATTERNS) {
    if (pattern.test(command)) {
      classification.serviceDeployTouch = true;
      break;
    }
  }

  // Determine risk level based on flags
  if (classification.destructiveFlags) {
    classification.riskLevel = 'dangerous';
    classification.approvalTier = 3;
    classification.reason = 'Command contains destructive or privileged operations';
  } else if (classification.serviceDeployTouch || classification.databaseTouch) {
    classification.riskLevel = 'dangerous';
    classification.approvalTier = 3;
    classification.reason = 'Command touches services, deployments, or databases';
  } else if (classification.packageInstallation || classification.gitMutation) {
    classification.riskLevel = 'caution';
    classification.approvalTier = 2;
    classification.reason = 'Command installs packages or mutates git state';
  } else if (classification.networkAccess || classification.filesystemScope) {
    classification.riskLevel = 'caution';
    classification.approvalTier = 2;
    classification.reason = 'Command accesses network or writes to filesystem';
  } else {
    classification.riskLevel = 'safe';
    classification.approvalTier = 1;
    classification.reason = 'Command appears to be read-only or low-risk';
  }

  return classification;
}
