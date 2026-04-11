# VibeFlow GitHub Actions Workflows

This directory contains GitHub Actions workflow files. They are created and maintained by the DevOps agent.

## Planned Workflows (to be created in Milestone 9)

| File | Purpose |
|---|---|
| `ci.yml` | Runs on every push and PR: lint, type-check, test, build check |
| `release.yml` | Runs when a version tag is pushed: builds Windows installer, creates GitHub Release, uploads artifacts |

## Notes

- Workflow files are YAML and are maintained by the DevOps agent
- The Builder does NOT edit workflow files
- See `/docs/release-process.md` for the full release pipeline
- See `/docs/devops-templates.md` for the Albert and Standard DevOps templates that use GitHub Actions
