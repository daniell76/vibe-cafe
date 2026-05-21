#!/usr/bin/env bash
# Build, push and deploy the Vibe Café app to Cloud Run via Terraform.
#
# Prereq: run `./scripts/setup.sh <PROJECT_ID>` once per project first.
#
# Usage:
#   ./scripts/deploy.sh                # uses current gcloud project + defaults
#   PROJECT=other-project ./scripts/deploy.sh
#
# Env overrides:
#   PROJECT          default: current gcloud project
#   REGION           default: europe-west4
#   SERVICE          default: vibe-cafe
#   AR_REPO          default: cloud-run-source-deploy
#   BUCKET_NAME      default: <service>-images-<project>
#   PRUNE            "1" (default) runs prune-revisions.mjs after deploy; "0" skips

set -euo pipefail

PROJECT="${PROJECT:-${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project 2>/dev/null || true)}}"
if [ -z "$PROJECT" ]; then
  echo "PROJECT not set. Either export PROJECT=<id> or run ./scripts/setup.sh first."
  exit 1
fi

REGION="${REGION:-europe-west4}"
SERVICE="${SERVICE:-vibe-cafe}"
AR_REPO="${AR_REPO:-cloud-run-source-deploy}"
BUCKET_NAME="${BUCKET_NAME:-${SERVICE}-images-${PROJECT}}"
PRUNE="${PRUNE:-1}"

cyan()  { printf "\033[36m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }

TAG="$(date -u +%Y%m%d-%H%M%S)"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/${AR_REPO}/${SERVICE}:${TAG}"

cyan "› project    $PROJECT"
cyan "› region     $REGION       (override: REGION=...)"
cyan "› service    $SERVICE           (override: SERVICE=...)"
cyan "› bucket     $BUCKET_NAME"
cyan "› image tag  $TAG"
echo "  All defaults pulled from gcloud config + sensible fallbacks. See .env.example."
echo

cyan "Building container image…"
docker build -t "$IMAGE" .
green "  ✓ built"
echo

cyan "Pushing to Artifact Registry…"
docker push "$IMAGE"
green "  ✓ pushed"
echo

cyan "Running terraform apply…"
if [ ! -f terraform/backend.hcl ]; then
  echo "terraform/backend.hcl is missing. Run ./scripts/setup.sh first."
  exit 1
fi
# Feed terraform the same OAuth token gcloud is using so it never silently
# falls back to ADC (which may point at a different account on dev machines).
export GOOGLE_OAUTH_ACCESS_TOKEN
GOOGLE_OAUTH_ACCESS_TOKEN="$(gcloud auth print-access-token 2>/dev/null)"
if [ -z "$GOOGLE_OAUTH_ACCESS_TOKEN" ]; then
  echo "Could not obtain an access token. Run: gcloud auth login"
  exit 1
fi
pushd terraform >/dev/null
terraform init -input=false -backend-config=backend.hcl >/dev/null
terraform apply -input=false -auto-approve \
  -var="project_id=$PROJECT" \
  -var="region=$REGION" \
  -var="bucket_name=$BUCKET_NAME" \
  -var="container_image=$IMAGE"
popd >/dev/null
green "  ✓ apply complete"
echo

URL="$(gcloud run services describe "$SERVICE" --region="$REGION" --project="$PROJECT" --format='value(status.url)' 2>/dev/null || true)"
if [ -n "$URL" ]; then
  green "Deployed: $URL"
else
  green "Deployed. (Run 'gcloud run services describe $SERVICE --region=$REGION' to fetch the URL.)"
fi

if [ "$PRUNE" = "1" ]; then
  echo
  cyan "Pruning old revisions (keep latest 3; set PRUNE=0 to skip)…"
  PROJECT="$PROJECT" REGION="$REGION" SERVICE="$SERVICE" node scripts/prune-revisions.mjs || true
fi
