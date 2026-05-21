# Deploying Vibe Café

This app deploys to **Cloud Run** in any Google Cloud project. Infra is managed by **Terraform** with state in a GCS bucket. Two scripts wrap the flow:

| Script | When | What it does |
| --- | --- | --- |
| `scripts/setup.sh <project-id>` | Once per project | Enables APIs, creates Firestore (default) DB, Artifact Registry repo, Terraform state bucket, configures docker auth, writes `terraform/backend.hcl` |
| `scripts/deploy.sh` | Every deploy | Builds container, pushes to Artifact Registry, runs `terraform apply`, prunes old Cloud Run revisions |

## Prerequisites

- `gcloud`, `terraform`, `docker`, `node` (≥ 20) installed locally
- You're authenticated: `gcloud auth login` and `gcloud auth print-access-token` works
- Your account has **Owner** (or equivalent) on the target project for the one-time setup. Per-deploy you need Cloud Run Admin, Storage Admin, Artifact Registry Writer, and Vertex AI User
- Docker daemon running

## First-time setup

```bash
./scripts/setup.sh YOUR_PROJECT_ID
```

This is idempotent — safe to re-run. Default region is `europe-west4`; override with `REGION=us-central1 ./scripts/setup.sh ...`.

When it finishes you'll have:
- All required APIs enabled
- Firestore `(default)` database
- Artifact Registry repo `cloud-run-source-deploy`
- GCS bucket `<project>_tfstate` (versioned) for Terraform state
- Docker configured to push to `<region>-docker.pkg.dev`
- `terraform/backend.hcl` pointing Terraform at your state bucket

## Deploy

```bash
./scripts/deploy.sh
```

Picks up `PROJECT` from `gcloud config`, defaults `REGION=europe-west4`, builds with `next build --webpack`, tags the image with a UTC timestamp, runs `terraform apply`. At the end it prints the Cloud Run URL and prunes Cloud Run revisions older than the latest 3 (set `PRUNE=0` to skip).

Subsequent deploys re-use Terraform state in your project's GCS bucket.

## Env var summary

| Var | Default | Used where |
| --- | --- | --- |
| `GOOGLE_CLOUD_PROJECT` | none — **required at runtime** | App reads this for Vertex AI + Firestore + GCS clients |
| `GOOGLE_CLOUD_LOCATION` | set by terraform | Informational; Vertex AI image calls use the `global` endpoint regardless |
| `VIBE_CAFE_BUCKET` | set by terraform | GCS bucket name for foam art + vibe images |
| `VIBE_CAFE_COLLECTION` | `orders` | Firestore collection for order documents |
| `PROJECT`, `REGION`, `SERVICE`, `BUCKET_NAME`, `AR_REPO` | inferred from gcloud | Deploy script overrides |
| `KEEP`, `DRY_RUN` | `KEEP=3`, `DRY_RUN=0` | Revision pruner |

## Why a backend image proxy instead of public GCS

Many GCP org policies enforce **Public Access Prevention** on storage buckets. Rather than rely on `allUsers:objectViewer` (which would fail under those policies), the app proxies image bytes through `/api/image/[...filename]`. The Cloud Run service account fetches from GCS using its IAM identity. No bucket-level public access needed.

## Why `cpu_idle = false` on Cloud Run

The `/api/order/preview` endpoint kicks off a 4K vibe-image generation as fire-and-forget background work using Next.js `after()`. With CPU throttled between requests (the default), that background work stalls. Setting `cpu_idle = false` in `terraform/main.tf` keeps CPU allocated so the background generation completes reliably. Costs a few extra cents per day for a small instance.

## Why `next build --webpack`

`next build` in Next 16 defaults to Turbopack, which silently drops styled-jsx output from the production bundle — most per-component styles never reach the browser. `--webpack` restores correct styled-jsx behaviour. See `package.json` `scripts.build`.

## Tearing down

```bash
cd terraform
terraform destroy \
  -var="project_id=$PROJECT" \
  -var="region=$REGION" \
  -var="bucket_name=$BUCKET_NAME" \
  -var="container_image=ignored"
```

This removes the Cloud Run service and the image bucket (with `force_destroy = true`). Firestore data persists — delete the collection separately if you want a clean slate. The Terraform state bucket and Artifact Registry repo are NOT destroyed by terraform; remove them manually if you want.
