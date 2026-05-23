#!/usr/bin/env bash
# One-time per-project bootstrap.
#
# Idempotent: re-running is safe. Creates everything `scripts/deploy.sh` needs:
#   - enables required GCP APIs
#   - creates the Firestore (default) database
#   - creates the Artifact Registry repo
#   - creates the Terraform state bucket
#   - configures docker auth for AR
#   - writes terraform/backend.hcl pointing at this project's state bucket
#
# Usage:
#   ./scripts/setup.sh <PROJECT_ID>                   # uses defaults below
#   REGION=us-central1 ./scripts/setup.sh my-project  # override region
#
# Env overrides:
#   REGION            default: europe-west4
#   SERVICE           default: vibe-cafe
#   AR_REPO           default: cloud-run-source-deploy
#   TF_STATE_BUCKET   default: <project>_tfstate

set -euo pipefail

PROJECT="${1:-${GOOGLE_CLOUD_PROJECT:-}}"
if [ -z "$PROJECT" ]; then
  echo "Usage: $0 <project-id>"
  echo "   or: GOOGLE_CLOUD_PROJECT=<project-id> $0"
  exit 1
fi

REGION="${REGION:-europe-west4}"
SERVICE="${SERVICE:-vibe-cafe}"
AR_REPO="${AR_REPO:-cloud-run-source-deploy}"
TF_STATE_BUCKET="${TF_STATE_BUCKET:-${PROJECT}_tfstate}"

cyan()  { printf "\033[36m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }

cyan "› project          $PROJECT"
cyan "› region           $REGION         (override: REGION=...)"
cyan "› service          $SERVICE             (override: SERVICE=...)"
cyan "› artifact repo    $AR_REPO    (override: AR_REPO=...)"
cyan "› tf state bucket  gs://$TF_STATE_BUCKET    (override: TF_STATE_BUCKET=...)"
echo
echo "  All defaults work for a demo; only the project id is required."
echo "  Full env reference: see .env.example"
echo

gcloud config set project "$PROJECT" >/dev/null

cyan "Enabling required APIs (idempotent)…"
gcloud services enable \
  storage.googleapis.com \
  artifactregistry.googleapis.com \
  firestore.googleapis.com \
  run.googleapis.com \
  aiplatform.googleapis.com \
  --project="$PROJECT"
green "  ✓ APIs enabled"
echo

cyan "Firestore (default) database…"
if gcloud firestore databases describe --database='(default)' --project="$PROJECT" >/dev/null 2>&1; then
  green "  ✓ already exists"
else
  gcloud firestore databases create \
    --location="$REGION" \
    --type=firestore-native \
    --database='(default)' \
    --project="$PROJECT"
  green "  ✓ created in $REGION"
fi
echo

cyan "Artifact Registry repo $AR_REPO ($REGION)…"
if gcloud artifacts repositories describe "$AR_REPO" --location="$REGION" --project="$PROJECT" >/dev/null 2>&1; then
  green "  ✓ already exists"
else
  gcloud artifacts repositories create "$AR_REPO" \
    --location="$REGION" \
    --repository-format=docker \
    --description="Cloud Run source deployments" \
    --project="$PROJECT"
  green "  ✓ created"
fi
echo

cyan "Terraform state bucket gs://$TF_STATE_BUCKET…"
if gsutil ls -b "gs://$TF_STATE_BUCKET" >/dev/null 2>&1; then
  green "  ✓ already exists"
else
  gsutil mb -p "$PROJECT" -l "$REGION" "gs://$TF_STATE_BUCKET"
  gsutil versioning set on "gs://$TF_STATE_BUCKET"
  green "  ✓ created (versioning on)"
fi
echo

cyan "Configuring docker auth for ${REGION}-docker.pkg.dev…"
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet
green "  ✓ configured"
echo

BACKEND_FILE="terraform/backends/${PROJECT}.hcl"
cyan "Writing ${BACKEND_FILE}…"
mkdir -p terraform/backends
cat > "$BACKEND_FILE" <<EOF
bucket = "$TF_STATE_BUCKET"
prefix = "vibe-cafe"
EOF
green "  ✓ written (per-project file; deploy.sh auto-discovers by gcloud project)"
echo

green "Setup complete for project: $PROJECT"
echo
echo "  • To deploy to this project:  ./scripts/deploy.sh"
echo "  • To set up another project:  gcloud config configurations create <name>;"
echo "                                gcloud config configurations activate <name>;"
echo "                                ./scripts/setup.sh <OTHER_PROJECT_ID>"
echo "  • To switch envs later:       gcloud config configurations activate <name>;"
echo "                                ./scripts/deploy.sh"
