# Component 14: Capability Fabric, MCP, and Tool Connectors

## 1. Purpose

This component exposes the machine's usable powers. It makes internal and external capabilities discoverable, safe, inspectable, and routable.

In VibeFlow, capabilities are a core product concept, not hidden plumbing.

## 2. Capability classes

The system shall support at least the following capability classes:
- local filesystem operations,
- git operations,
- terminal execution,
- browser automation,
- MCP servers and their tools,
- direct provider APIs (for example deployment, DNS, database, storage, auth),
- SSH / remote command channels,
- secrets manager access,
- log and metrics query access,
- artifact build and package actions.

## 3. Capability registry

A central registry shall store for each capability:
- identifier,
- type,
- owner,
- description,
- scope,
- auth method,
- available actions,
- parameter schema,
- permission class,
- health status,
- last successful use,
- last failure,
- audit notes.

## 4. MCP-specific requirements

The MCP subsystem shall support:
- server registration,
- server purpose description,
- launch command and arguments,
- transport configuration,
- auth / environment requirements,
- scope and project binding,
- enable/disable,
- health checks,
- discovery of tools and schemas,
- caching of discovered capabilities,
- recent usage history.

The UI must explain what each server is for in plain English.

## 5. Capability health model

Every capability shall have a live status:
- healthy,
- degraded,
- unauthorized,
- misconfigured,
- offline,
- unknown.

The system shall not route important work to a degraded or unauthorized capability without surfacing that fact.

## 6. Invocation rules

Every invocation must include:
- initiating role,
- mission id,
- plan step id,
- capability id,
- operation name,
- parameters,
- dry-run or live flag,
- expected side effects,
- timestamp,
- result,
- latency,
- emitted artifacts.

## 7. Capability permissions

Permissions shall be classified by:
- read-only,
- local write,
- repository mutation,
- environment mutation,
- service mutation,
- deployment action,
- destructive action,
- privileged host action,
- secret-bearing action.

Permissions must integrate with the approval engine.

## 8. Terminal policy

Terminal access is not inherently safe. Commands must be classified before execution by:
- filesystem scope,
- network access,
- package installation,
- git mutation,
- database touch,
- service/deploy touch,
- destructive flags.

A blanket "terminal run is safe" policy is forbidden.

## 9. Direct connectors vs MCP

The system may support both:
- direct built-in connectors for high-value providers,
- MCP servers for extensibility and custom integrations.

The same UX model should apply: discoverability, permission visibility, health, and audit.

## 10. Tool discovery and explanation

The capabilities panel shall let the operator answer:
- what can the system talk to right now?
- what can it do with that thing?
- what permission level does that imply?
- did it work recently?
- is it safe to let the current mission use it?

## 11. Failure handling

If a capability fails, the system must record:
- failure type,
- likely cause,
- retry suitability,
- affected mission steps,
- fallback options.

## 12. Acceptance criteria

This component is complete only when:
- capabilities are explicit objects,
- MCP is first-class,
- health and permission state are visible,
- tool invocations are fully audited,
- dangerous commands are classified rather than blindly executed,
- the operator can inspect and manage external system connectivity without programmer guesswork.
