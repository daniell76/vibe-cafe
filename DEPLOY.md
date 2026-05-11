# Deployment Instructions: Google Cloud Run

To deploy the Vibe Cafe app to Cloud Run, follow these steps:

## 1. Prerequisites
- Google Cloud Project ID
- gcloud CLI installed and authenticated
- Cloud Run, Vertex AI, GCS, and Firestore APIs enabled

## 2. Environment Variables
Ensure you have the following environment variables set or passed during deployment:
- `GOOGLE_CLOUD_PROJECT`: Your Project ID
- `GOOGLE_CLOUD_LOCATION`: us-central1 (or your preferred region)
- `VIBE_CAFE_BUCKET`: Your GCS bucket name
- `VIBE_CAFE_COLLECTION`: `orders` (Firestore collection)

## 3. Build and Deploy Command
Run the following command from the project root:

```bash
gcloud run deploy vibe-cafe \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID,GOOGLE_CLOUD_LOCATION=us-central1,VIBE_CAFE_BUCKET=YOUR_BUCKET_NAME
```

## 4. GCS Bucket Setup
Make sure the bucket exists and has public read access for the generated images:

```bash
gsutil mb gs://YOUR_BUCKET_NAME
gsutil iam ch allUsers:objectViewer gs://YOUR_BUCKET_NAME
```
