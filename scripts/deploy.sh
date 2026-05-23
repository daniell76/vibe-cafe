#!/usr/bin/env bash
# Build, push and deploy the Vibe Café app to Cloud Run via Terraform.
#
# Prereq: run `./scripts/setup.sh <PROJECT_ID>` once per project first.
#
# Usage:
#   ./scripts/deploy.sh                # uses current gcloud project + defaults
#   PROJECT=other-project ./scripts/deploy.sh
#
# Multi-environment workflow:
#   # one-time per env
#   gcloud config configurations create dev
#   gcloud config configurations activate dev
#   gcloud auth login
#   gcloud config set project dev-project-id
#   ./scripts/setup.sh dev-project-id
#
#   # switch envs:
#   gcloud config configurations activate dev    # or prod, staging, etc.
#   ./scripts/deploy.sh                          # auto-discovers backend by gcloud project
#
# Env overrides:
#   PROJECT          default: current gcloud project
#   REGION           default: europe-west4
#   SERVICE          default: vibe-cafe
#   AR_REPO          default: cloud-run-source-deploy
#   BUCKET_NAME      default: <service>-images-<project>
#   PRUNE            "1" (default) runs prune-revisions.mjs after deploy; "0" skips
#
# Per-project overrides:
#   If a file `.env.<PROJECT>` exists in the repo root, it is sourced before
#   the defaults are computed. Use it for region/service tweaks per env.

set -euo pipefail

cyan()   { printf "\033[36m%s\033[0m\n" "$*"; }
green()  { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }

PROJECT="${PROJECT:-${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project 2>/dev/null || true)}}"
if [ -z "$PROJECT" ]; then
  echo "PROJECT not set. Either export PROJECT=<id> or run \`gcloud config set project <id>\`."
  exit 1
fi

# Source per-project overrides (.env.<project>) BEFORE computing defaults so
# anything set there takes precedence over hard-coded defaults but still loses
# to explicit shell env vars (because shell vars are exported and `: ${X:=...}`
# won't overwrite them).
ENV_FILE=".env.${PROJECT}"
if [ -f "$ENV_FILE" ]; then
  cyan "Sourcing $ENV_FILE"
  # shellcheck disable=SC1090
  set -a; . "$ENV_FILE"; set +a
fi

REGION="${REGION:-europe-west4}"
SERVICE="${SERVICE:-vibe-cafe}"
AR_REPO="${AR_REPO:-cloud-run-source-deploy}"
BUCKET_NAME="${BUCKET_NAME:-${SERVICE}-images-${PROJECT}}"
PRUNE="${PRUNE:-1}"

# Per-project backend file — written by setup.sh. Lets you swap envs by
# switching the active gcloud configuration without editing any files.
BACKEND_FILE="backends/${PROJECT}.hcl"
if [ ! -f "terraform/${BACKEND_FILE}" ]; then
  echo
  yellow "Backend config terraform/${BACKEND_FILE} not found."
  echo "  Either:"
  echo "    1) Run ./scripts/setup.sh ${PROJECT}  (first-time setup), or"
  echo "    2) Activate the right gcloud config:  gcloud config configurations activate <name>"
  echo
  exit 1
fi

TAG="$(date -u +%Y%m%d-%H%M%S)"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/${AR_REPO}/${SERVICE}:${TAG}"

cyan "› project    $PROJECT"
cyan "› region     $REGION       (override: REGION=...)"
cyan "› service    $SERVICE           (override: SERVICE=...)"
cyan "› bucket     $BUCKET_NAME"
cyan "› backend    terraform/${BACKEND_FILE}"
cyan "› image tag  $TAG"
echo "  Defaults pulled from gcloud config + .env.${PROJECT} (if present) + sensible fallbacks."
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
# Feed terraform the same OAuth token gcloud is using so it never silently
# falls back to ADC (which may point at a different account on dev machines).
export GOOGLE_OAUTH_ACCESS_TOKEN
GOOGLE_OAUTH_ACCESS_TOKEN="$(gcloud auth print-access-token 2>/dev/null)"
if [ -z "$GOOGLE_OAUTH_ACCESS_TOKEN" ]; then
  echo "Could not obtain an access token. Run: gcloud auth login"
  exit 1
fi
pushd terraform >/dev/null
# -reconfigure: switch the backend without trying to migrate state (we use a
# different state bucket per env, so migration would be wrong anyway).
terraform init -input=false -reconfigure -backend-config="$BACKEND_FILE" >/dev/null
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
