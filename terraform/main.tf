terraform {
  # Backend bucket + prefix are supplied via backend.hcl (gitignored).
  # Initialise with:  terraform init -backend-config=backend.hcl
  # See backend.hcl.example for the template. Run scripts/setup.sh to generate
  # backend.hcl automatically.
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

# 3. Cloud Run Service
resource "google_cloud_run_v2_service" "vibe_cafe" {
  name     = "vibe-cafe"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
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

# 4. Firestore Database (Using existing (default) database)
# Removed from TF because (default) already exists in this project.
