# Component 09: Secrets, Configuration, Database, and Migration Safety

## 1. Purpose

This component handles the most failure-prone and dangerous aspects of AI-driven software work: secrets, environment configuration, data shape, and schema changes.

## 2. Responsibilities

It shall:
- maintain an inventory of config variables and secret references,
- link variables to code and environments,
- detect missing or stale configuration,
- classify migration risk,
- preview database changes,
- protect against destructive data operations,
- require backups/checkpoints for dangerous actions.

## 3. Secrets and config inventory

For every configuration item, the system shall store:
- key name,
- category,
- description,
- environments required,
- default or optionality,
- code references,
- provider/source of truth,
- sensitivity level,
- rotation notes,
- approval rules for changes.

## 4. Missing config detection

Before verification or deploy, the system must answer:
- what variables are required?
- which are missing here?
- which changed since the last successful deploy?
- which code paths depend on them?

## 5. Database awareness

The system shall know:
- database engine,
- schema source files,
- migration history,
- tables/collections,
- relationships,
- protected entities,
- high-risk data domains,
- row-count scale where available.

## 6. Migration risk classes

Example classes:
- additive safe-ish migration,
- backfill migration,
- index/performance migration,
- destructive schema migration,
- data rewrite migration,
- auth/identity migration.

Each class must have required safeguards.

## 7. Migration workflow

1. detect proposed schema/data change,
2. classify migration,
3. show affected tables/entities and estimated blast radius,
4. determine forward/backward compatibility,
5. require checkpoint/backup if needed,
6. generate migration plan,
7. verify app-before-schema or schema-before-app ordering,
8. run migration preview/test where possible,
9. require approval,
10. log rollback constraints.

## 8. Forbidden behavior

The system must not:
- run destructive migrations silently,
- allow free-form production database mutation as a routine debug step,
- assume config equality across environments,
- leak raw secret values into model prompts unless explicitly allowed and redacted appropriately.

## 9. Acceptance criteria

This component is complete only when:
- secrets/config inventory exists,
- missing config is surfaced before deploy,
- migration risk is classified,
- destructive data operations require stronger safeguards,
- database-affecting work is no longer treated like ordinary code editing.
