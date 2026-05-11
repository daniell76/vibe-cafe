terraform {
  backend "gcs" {
    bucket = "cs-poc-r09bfysmbhuoftvjja2mxk2_tfstate"
    prefix = "vibe-cafe"
  }
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

# 2. Cloud Storage Bucket for Images
resource "google_storage_bucket" "vibe_cafe_images" {
  name          = var.bucket_name
  location      = var.region
  force_destroy = true

  uniform_bucket_level_access = true
  # public_access_prevention is enforced by org policy, so we'll proxy images via backend
}

# 3. Firestore Database (Using existing (default) database)
# Removed from TF because (default) already exists in this project.
