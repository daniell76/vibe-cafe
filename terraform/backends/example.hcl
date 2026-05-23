# Per-environment backend config — written by scripts/setup.sh as
# terraform/backends/<PROJECT_ID>.hcl. Each environment has its own
# Terraform state bucket so envs are fully isolated.
#
# scripts/deploy.sh auto-discovers the file based on the active gcloud
# project — there's nothing manual to swap when switching envs.

bucket = "<PROJECT_ID>_tfstate"
prefix = "vibe-cafe"
