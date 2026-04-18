# VibeFlow GitHub Actions Workflows

This directory contains GitHub Actions workflow files. They are maintained by the DevOps agent.

## Actual Workflows

| File | Purpose |
|---|---|
| `ci.yml` | Runs on every push and PR: type-check, build check |
| `release.yml` | Runs when a version tag is pushed: builds Windows installer, creates GitHub Release, uploads artifacts |
| `build.yml` | Additional build verification workflow |

## Notes

- Workflow files are YAML and are maintained by the DevOps agent.
- The Builder does NOT edit workflow files.
- The default branch is `main`.
- See [`/docs/release-process.md`](../../docs/release-process.md) for the full release pipeline.
- See [`/docs/devops-templates.md`](../../docs/devops-templates.md) for the Albert and Standard DevOps templates.
