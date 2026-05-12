variable "project_id" {
  description = "The Google Cloud Project ID"
  type        = string
}

variable "region" {
  description = "The region to deploy resources"
  type        = string
  default     = "europe-west4"
}

variable "bucket_name" {
  description = "The name of the GCS bucket for coffee art"
  type        = string
}

variable "container_image" {
  description = "The container image to deploy to Cloud Run"
  type        = string
}
