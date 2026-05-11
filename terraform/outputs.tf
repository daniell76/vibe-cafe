output "bucket_url" {
  value = google_storage_bucket.vibe_cafe_images.url
}

output "project_id" {
  value = var.project_id
}
