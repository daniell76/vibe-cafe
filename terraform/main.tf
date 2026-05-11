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
}

# 3. Make Bucket Publicly Readable
resource "google_storage_bucket_iam_member" "public_rule" {
  bucket = google_storage_bucket.vibe_cafe_images.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

# 4. Firestore Database (Native Mode)
resource "google_firestore_database" "database" {
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"

  depends_on = [google_project_service.firestore]
}
