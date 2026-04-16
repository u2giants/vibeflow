/** Capability Fabric — re-exports all public APIs. */

export { CapabilityRegistry } from './capability-registry';
export {
  registerBuiltinCapabilities,
  registerFileCapability,
  registerTerminalCapability,
  registerGitCapability,
  registerSshCapability,
  classifyTerminalAction,
} from './capability-adapter';
export { classifyTerminalCommand } from './terminal-policy';
