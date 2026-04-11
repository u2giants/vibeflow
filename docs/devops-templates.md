# VibeFlow — DevOps Templates

Last updated: 2026-04-11

---

## What Are DevOps Templates?

DevOps templates are saved configurations that describe how a project gets built, tested, and deployed. Instead of setting up deployment from scratch every time, you pick a template, fill in a few values, and the system handles the rest.

Templates are:
- Editable in the GUI
- Saveable and duplicable
- Assignable per project
- Updateable over time

---

## Template 1 — Standard

**Use this when:** You want a conventional branching workflow with pull requests and automated testing before deployment.

**Workflow:**
1. Developer (or AI) pushes to a feature branch
2. GitHub Actions runs: lint → test → build
3. Developer (or AI) opens a pull request to merge into main
4. On merge to main, GitHub Actions builds a Docker image
5. Docker image is pushed to GitHub Container Registry (GHCR) with tags: `:main` and `:sha-<commit>`
6. GitHub Actions triggers deployment to the configured deploy target (e.g., Coolify)
7. Deploy target pulls the new image and goes live

**Required secrets:**
- `GHCR_TOKEN` — GitHub token with package write permission
- `DEPLOY_API_KEY` — API key for the deploy target (e.g., Coolify)
- `DEPLOY_APP_ID` — App ID on the deploy target

**Plain-English explanation:**
"When you merge a pull request into main, GitHub automatically builds your app into a Docker image, uploads it to GitHub's container registry, then tells your deploy target to pull the new image and go live. You don't need to do anything manually."

---

## Template 2 — Albert

**Use this when:** You want to push directly to main without branches or pull requests, and have GitHub Actions handle everything automatically.

**This is Albert's primary workflow.**

**Workflow:**
1. Developer (or AI) pushes directly to `main` (no branches, no pull requests)
2. GitHub Actions triggers automatically on push to main
3. GitHub Actions builds a Docker image
4. Docker image is pushed to GitHub Container Registry (GHCR) with tags:
   - `:main` — always points to the latest main build
   - `:sha-<commit>` — permanent tag for this specific commit (e.g., `:sha-abc1234`)
5. GitHub Actions triggers Coolify via API webhook
6. Coolify pulls the pre-built image from GHCR and deploys it live
7. Coolify does NOT build the image — it only pulls and runs it

**Important:** Coolify is a consumer of pre-built images in this template. It does not build anything. All building happens in GitHub Actions.

**Required secrets (stored in GitHub Secrets):**
- `GHCR_TOKEN` — GitHub token with package write permission (to push images to GHCR)
- `COOLIFY_API_KEY` — Coolify API key (to trigger deployments)
- `COOLIFY_APP_ID` — The app ID in Coolify (to tell Coolify which app to deploy)

**Required configuration (stored in Coolify):**
- All `.env` values for the application (database URLs, API keys, etc.)
- These are managed through Coolify's environment variable settings, not through GitHub

**Plain-English explanation:**
"When you push to main, GitHub automatically builds your app into a Docker image, uploads it to GitHub's container registry with two labels (one that always says 'latest main' and one with the exact commit ID), then tells Coolify to pull the new image and go live. You don't need to do anything else. Your app's settings and secrets are stored in Coolify, not in GitHub."

**Why two image tags?**
- `:main` — easy to reference "the current live version"
- `:sha-<commit>` — lets you roll back to any specific commit by pulling that exact image

**Rollback procedure:**
1. In Coolify, change the image tag from `:main` to `:sha-<previous-commit>`
2. Redeploy
3. The previous version is live immediately

---

## How to Assign a Template to a Project

1. Open the project in VibeFlow
2. Go to the DevOps panel (bottom panel → DevOps tab)
3. Click "Assign Template"
4. Select the template
5. Fill in the required values (repo URL, deploy target URL, etc.)
6. Save

---

## How to Edit a Template

1. Go to Settings → DevOps Templates
2. Click the template you want to edit
3. Edit the fields in the GUI
4. Save

Changes to a template affect all projects that use it. If you want to customize for one project only, duplicate the template first.

---

## How to Create a Custom Template

1. Go to Settings → DevOps Templates
2. Click "New Template" or "Duplicate" an existing one
3. Fill in the fields
4. Save

Custom templates support the same fields as the built-in templates.

---

## Template Fields

| Field | Description |
|---|---|
| Name | Display name for the template |
| Description | Plain-English description of what this template does |
| Branch strategy | `push-to-main` or `feature-branch-pr` |
| Build tool | `docker` (others may be added later) |
| Registry | `ghcr.io` (others may be added later) |
| Image name | The Docker image name (e.g., `ghcr.io/username/my-app`) |
| Image tags | Which tags to apply (e.g., `:main`, `:sha-<commit>`) |
| Deploy target type | `coolify` (others may be added later) |
| Deploy target URL | The URL of the deploy target API |
| Trigger method | `api-webhook` or `manual` |
| Required secrets | List of secret names needed (stored in GitHub Secrets) |
| Environment variables | List of env var names needed (stored in deploy target) |

---

## Adding More Templates Later

The DevOps subsystem is designed to support additional templates and deploy targets without a rewrite. To add a new deploy target (e.g., Railway, Render, Fly.io), implement the `DeployTargetClient` interface in the `packages/devops` package.
