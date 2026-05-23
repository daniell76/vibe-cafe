terraform {
  # Backend bucket + prefix are supplied via terraform/backends/<project>.hcl.
  # scripts/setup.sh writes that file; scripts/deploy.sh runs:
  #   terraform init -reconfigure -backend-config=backends/<project>.hcl
  # so switching environments doesn't require editing any tracked file.
  backend "gcs" {}
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# 1. Enable APIs
resource "google_project_service" "aiplatform" {
  service = "aiplatform.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "firestore" {
  service = "firestore.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "storage" {
  service = "storage.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "run" {
  service = "run.googleapis.com"
  disable_on_destroy = false
}

# 2. Cloud Storage Bucket for Images
resource "google_storage_bucket" "vibe_cafe_images" {
  name          = var.bucket_name
  location      = var.region
  force_destroy = true

  uniform_bucket_level_access = true
  # public_access_prevention is enforced by org policy, so we'll proxy images via backend
}

# 3. Dedicated runtime service account for Cloud Run.
# Defining one explicitly (instead of relying on the project's default compute SA)
# means the deploy is robust on projects where the default SA has had its broad
# permissions revoked — a default that newer GCP org policies are moving toward.
resource "google_service_account" "vibe_cafe_runtime" {
  project      = var.project_id
  account_id   = "vibe-cafe-runtime"
  display_name = "Vibe Café Cloud Run runtime"
  description  = "Runtime identity for the Vibe Café Cloud Run service"
}

# Least-privilege project-level roles the runtime needs.
resource "google_project_iam_member" "runtime_firestore" {
  project = var.project_id
  role    = "roles/datastore.user" # Firestore (orders, settings, counter)
  member  = "serviceAccount:${google_service_account.vibe_cafe_runtime.email}"
}

resource "google_project_iam_member" "runtime_aiplatform" {
  project = var.project_id
  role    = "roles/aiplatform.user" # Vertex AI Gemini calls
  member  = "serviceAccount:${google_service_account.vibe_cafe_runtime.email}"
}

# Bucket-scoped grant (not project-wide storage admin) — runtime only needs
# read/write on the image bucket, nothing else.
resource "google_storage_bucket_iam_member" "runtime_bucket" {
  bucket = google_storage_bucket.vibe_cafe_images.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.vibe_cafe_runtime.email}"
}

# 4. Cloud Run Service
resource "google_cloud_run_v2_service" "vibe_cafe" {
  name     = "vibe-cafe"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  # Allow `terraform destroy` to remove the service (e.g. for region migrations).
  # The google provider defaults this to true on newer versions, which blocks
  # destroy until an apply is done to flip it.
  deletion_protection = false

  template {
    service_account = google_service_account.vibe_cafe_runtime.email

    containers {
      image = var.container_image

      # Keep CPU allocated even between requests so fire-and-forget background
      # work (e.g. the 4K vibe-image generation kicked off after the preview
      # response) reliably runs to completion.
      resources {
        cpu_idle          = false
        startup_cpu_boost = true
      }

      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }
      env {
        name  = "GOOGLE_CLOUD_LOCATION"
        value = var.region
      }
      env {
        name  = "GOOGLE_CLOUD_LOCATION_IMAGE"
        value = var.region
      }
      env {
        name  = "VIBE_CAFE_BUCKET"
        value = var.bucket_name
      }
      env {
        name  = "VIBE_CAFE_COLLECTION"
        value = "orders"
      }
    }
  }

  # Disabling IAM check to allow unauthenticated access despite org policy
  invoker_iam_disabled = true

  depends_on = [google_project_service.run]
}

# 5. Firestore Database (Using existing (default) database)
# Created by scripts/setup.sh via `gcloud firestore databases create`; not
# managed here because the (default) DB can't be deleted/recreated cleanly
# and TF would fight existing state on every project.
