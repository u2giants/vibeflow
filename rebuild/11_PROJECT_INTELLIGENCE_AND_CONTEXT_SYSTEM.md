# Component 11: Project Intelligence and Context System

## 1. Purpose

This component gives the system a machine-usable understanding of the project beyond the file tree. It is the basis for safe planning, targeted changes, correct verification, and meaningful explanations.

Without this component, the system is a blind text generator.

## 2. Responsibilities

The project intelligence system shall:
- index the codebase,
- identify frameworks and runtime shape,
- build symbol and dependency graphs,
- map routes, APIs, jobs, and services,
- identify environment variable usage,
- detect database schemas and migrations,
- build topology links between code and connected systems,
- assemble context packs for missions,
- surface context quality and omissions.

## 3. Required sub-models

### Repository model
Must know:
- repository root,
- branch/worktree state,
- package manager,
- build/test commands,
- lockfiles,
- monorepo shape,
- generated directories,
- protected paths.

### Symbol graph
Must know:
- files,
- modules,
- exports,
- imports,
- classes,
- functions,
- types,
- schemas,
- routes,
- handlers,
- jobs,
- key constants.

### Impact graph
Must answer:
- if this file changes, what else is affected?
- if this API contract changes, who consumes it?
- if this schema changes, what queries and UI flows may break?
- if this environment variable changes, which code paths and environments care?

### Service topology map
Must connect:
- app frontend,
- backend/API,
- background workers,
- database,
- storage,
- auth provider,
- CDN,
- email,
- queues,
- external APIs,
- deployment platform,
- runtime host.

### Configuration map
Must track:
- environment variables,
- config files,
- secret references,
- default values,
- required per environment,
- missing per environment.

## 4. Framework and stack detection

The system shall identify likely stack components such as:
- React / Next.js / Vue / Svelte,
- Node / Bun / Python / Go backends,
- TypeScript vs JavaScript,
- ORM and schema tools,
- test frameworks,
- browser automation framework,
- deployment descriptors,
- containerization setup.

Detection results must be exposed as evidence, not hidden guesses.

## 5. Context pack assembly

A context pack shall be created for each mission and revised during execution.

A context pack may include:
- relevant files,
- relevant symbols,
- recent related changes,
- architecture summary snippets,
- prior decisions,
- provider and environment state,
- service health snapshot,
- relevant memory packs,
- representative logs and incidents.

The context pack must explain:
- why each item was included,
- why likely-relevant items were omitted,
- what freshness guarantees exist,
- what stale assumptions remain.

## 6. Context selection rules

1. Prefer targeted, evidence-backed context over dumping large file sets.
2. Include contracts and callers, not just edited files.
3. Include environment and service context when the mission touches deployment, configuration, auth, networking, storage, or data.
4. Include prior incidents and prior fixes when the mission resembles known patterns.
5. Tag every context item by source and freshness.
6. Allow manual pinning and exclusion by the operator.

## 7. Context dashboard requirements

The dashboard shall show:
- total active context size,
- composition by category,
- most important missing context,
- stale context items,
- top-impact omitted items,
- token budget,
- retrieval source,
- memory pack usage.

The dashboard must support:
- pin item,
- unpin item,
- request more of category,
- swap stale item for fresh,
- save context preset.

## 8. Indexing pipeline

The indexing pipeline shall:
1. scan project files,
2. classify file types,
3. parse language-aware symbols where possible,
4. build import/export graph,
5. infer route and API surfaces,
6. link schema and migration files,
7. extract configuration and env usage,
8. attach service topology references,
9. persist index,
10. emit invalidation events when files change.

## 9. Incremental refresh rules

The index must support:
- file-level invalidation,
- symbol-level refresh,
- command-triggered full reindex,
- post-dependency-install refresh,
- post-branch-switch refresh.

The system must surface index staleness and never silently rely on an out-of-date index for risk analysis.

## 10. Integration with language tooling

This component should use language-server or parser-backed intelligence where practical. It must not rely solely on regex or file names for important conclusions when stronger analysis is available.

## 11. Data structures

Minimum required records:
- ProjectIndex
- FileRecord
- SymbolRecord
- ReferenceEdge
- RouteRecord
- ApiEndpointRecord
- JobRecord
- ServiceNode
- ServiceEdge
- ConfigVariableRecord
- ContextPack
- ContextItem
- ContextWarning

## 12. Failure modes to detect

- unresolved imports,
- duplicate helper logic,
- orphaned routes,
- stale generated files,
- config variables referenced but unset,
- public contract changes with broad blast radius,
- mismatch between code topology and service topology,
- indexing gaps caused by unsupported languages or generated code.

## 13. Acceptance criteria

This component is complete only when the system can:
- answer "what parts of the system does this request likely touch?",
- generate an impact graph for a proposed change,
- assemble and explain a context pack,
- show stale or missing context explicitly,
- support deliberate context management instead of dumping the repo into the model.
