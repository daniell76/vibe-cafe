# Deploying Vibe Café

This app deploys to **Cloud Run** in any Google Cloud project. Infra is managed by **Terraform** with state in a GCS bucket. Two scripts wrap the flow:

| Script | When | What it does |
| --- | --- | --- |
| `scripts/setup.sh <project-id>` | Once per project | Enables APIs, creates Firestore (default) DB, Artifact Registry repo, Terraform state bucket, configures docker auth, writes `terraform/backends/<project-id>.hcl` |
| `scripts/deploy.sh` | Every deploy | Auto-discovers backend by gcloud project; builds container; pushes to Artifact Registry; runs `terraform apply`; prunes old Cloud Run revisions |

## Prerequisites

- `gcloud`, `terraform`, `docker`, `node` (≥ 20) installed locally
- You're authenticated: `gcloud auth login` and `gcloud auth print-access-token` work
- Your account has **Owner** (or equivalent) on the target project for the one-time setup. Per-deploy you need Cloud Run Admin, Storage Admin, Artifact Registry Writer, and Vertex AI User
- Docker daemon running

## Quick start (single env)

```bash
./scripts/setup.sh YOUR_PROJECT_ID   # one-time, idempotent
./scripts/deploy.sh                  # every deploy
```

Default region is `europe-west4`; override with `REGION=us-central1 ./scripts/setup.sh ...`. The deploy script prints the Cloud Run URL when done.

## Multi-environment workflow (dev / staging / prod / demo / …)

Each environment is just a different GCP project. Use **gcloud configurations** as the env switcher — `scripts/deploy.sh` auto-discovers the matching Terraform backend by inspecting the active project. No env-file swapping or tfvars juggling required.

### One-time per environment

```bash
# Create + select a gcloud profile for this env
gcloud config configurations create dev
gcloud config configurations activate dev
gcloud auth login your-dev-account@example.com
gcloud config set project dev-project-id
gcloud config set compute/region us-central1   # optional, if you want non-default

# Provision GCP resources + write the per-env backend file
./scripts/setup.sh dev-project-id

# Repeat for prod / staging / etc.
gcloud config configurations create prod
gcloud config configurations activate prod
gcloud auth login your-prod-account@example.com
gcloud config set project prod-project-id
./scripts/setup.sh prod-project-id
```

After this you'll have:
- `terraform/backends/dev-project-id.hcl`
- `terraform/backends/prod-project-id.hcl`

…both **gitignored**. Each points at its own `<project>_tfstate` bucket so the two environments' Terraform state never collides.

### Switching envs at deploy time

```bash
gcloud config configurations activate dev    # or prod, staging, …
./scripts/deploy.sh
```

That's it. The deploy script:
1. Reads the active project from `gcloud config`
2. Sources `.env.<project-id>` if it exists (optional per-env overrides)
3. Picks `terraform/backends/<project-id>.hcl` automatically
4. Runs `terraform init -reconfigure` so the backend switch is clean (no state migration attempt)
5. Builds + pushes + applies + prunes

### Per-environment overrides (optional)

If a particular env needs different region/service/etc., drop a file named `.env.<project-id>` in the repo root (gitignored):

```bash
# .env.dev-project-id
export REGION=us-central1
export SERVICE=vibe-cafe-dev
export PRUNE=0    # don't auto-prune in dev
```

`scripts/deploy.sh` sources it before computing defaults, so anything you set there wins over the built-in fallbacks but still loses to shell vars you export at the prompt.

## App runtime env vars

| Var | Default | Used where |
| --- | --- | --- |
| `GOOGLE_CLOUD_PROJECT` | none — **required at runtime** | App reads this for Vertex AI + Firestore + GCS clients |
| `GOOGLE_CLOUD_LOCATION` | set by terraform | Informational; Vertex AI image calls use the `global` endpoint regardless |
| `VIBE_CAFE_BUCKET` | set by terraform | GCS bucket name for foam art + vibe images |
| `VIBE_CAFE_COLLECTION` | `orders` | Firestore collection for order documents |

## Deploy-time shell vars

| Var | Default | Notes |
| --- | --- | --- |
| `PROJECT` | from `gcloud config get-value project` | The whole multi-env scheme keys off this |
| `REGION` | `europe-west4` | |
| `SERVICE` | `vibe-cafe` | Cloud Run service name (used in URL slugs) |
| `AR_REPO` | `cloud-run-source-deploy` | Artifact Registry repo |
| `BUCKET_NAME` | `<SERVICE>-images-<PROJECT>` | GCS bucket for images |
| `PRUNE` | `1` | Set to `0` to skip post-deploy revision pruning |
| `KEEP`, `DRY_RUN` | `3` / `0` | Direct overrides for `scripts/prune-revisions.mjs` |
| `TF_STATE_BUCKET` | `<PROJECT>_tfstate` | Setup-time only — names the state bucket |

## Why a backend image proxy instead of public GCS

Many GCP org policies enforce **Public Access Prevention** on storage buckets. Rather than rely on `allUsers:objectViewer` (which would fail under those policies), the app proxies image bytes through `/api/image/[...filename]`. The Cloud Run service account fetches from GCS using its IAM identity. No bucket-level public access needed.

## Why `cpu_idle = false` on Cloud Run

`/api/order/preview` kicks off a 4K vibe-image generation as fire-and-forget background work using Next.js `after()`. With CPU throttled between requests (the default), that background work stalls. `cpu_idle = false` in `terraform/main.tf` keeps CPU allocated so the background generation completes reliably. Costs a few extra cents per day for a small instance.

## Why `next build --webpack`

`next build` in Next 16 defaults to Turbopack, which silently drops styled-jsx output from the production bundle — most per-component styles never reach the browser. `--webpack` restores correct styled-jsx behaviour. See `package.json` `scripts.build`.

## Tearing down a single env

```bash
gcloud config configurations activate dev
cd terraform
terraform init -reconfigure -backend-config="backends/$(gcloud config get-value project).hcl"
terraform destroy \
  -var="project_id=$(gcloud config get-value project)" \
  -var="region=europe-west4" \
  -var="bucket_name=vibe-cafe-images-$(gcloud config get-value project)" \
  -var="container_image=ignored"
```

This removes the Cloud Run service and the image bucket (with `force_destroy = true`). Firestore data persists — delete the collection separately if you want a clean slate. The Terraform state bucket and Artifact Registry repo are NOT destroyed by terraform; remove them manually if you want.
