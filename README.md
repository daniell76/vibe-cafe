# Google Cloud Vibe Cafe - "Cloud in your Coffee"

Welcome to the **Google Cloud Vibe Cafe** demo system! This application allows guests to customize their coffee foam with AI-generated art based on their "happy place," providing a seamless bridge between a physical coffee experience and the power of Google Cloud AI.

## 🚀 Key Features

-   **AI Foam Art Generation:** Uses **Gemini 3.1 Flash (Nano Banana)** to optimize user prompts and generate high-fidelity coffee art.
-   **Brand Ambassador Flow:** A streamlined multi-step form for capturing guest names, orders, and vibes.
-   **Management Dashboard:** A dedicated `/management` dashboard for cafe operators to track orders, preview art, and mark orders as fulfilled.
-   **Bulk Management:** Support for multi-select order fulfillment and bulk deletion (including automated cleanup of images in Cloud Storage).
-   **Secure Image Proxy:** Custom backend proxy to serve images from GCS while adhering to organizational Public Access Prevention (PAP) policies.
-   **Enterprise Infrastructure:** Fully managed via **Terraform** for reproducible and professional deployment.

## 🛠 Tech Stack

-   **Frontend/Backend:** [Next.js 15+ (App Router)](https://nextjs.org/) with TypeScript.
-   **AI Models:** [Google Gen AI SDK (`@google/genai`)](https://www.npmjs.com/package/@google/genai) using Gemini 3.1 Flash.
-   **Infrastructure-as-Code:** [Terraform](https://www.terraform.io/).
-   **Cloud Services:**
    -   **Cloud Run:** Serverless hosting for the application.
    -   **Cloud Storage:** Persistent storage for generated coffee art images.
    -   **Firestore:** Real-time database for order metadata and status tracking.
    -   **Vertex AI:** Managed platform for Gemini models.

## 📁 Project Structure

```
├── app/                  # Next.js App Router (Pages & API)
├── components/           # Reusable React components (OrderForm, VibeLoader, etc.)
├── lib/                  # Backend services (AI, Firestore, GCS)
├── terraform/            # Infrastructure-as-code definitions
├── docs/                 # Design specs, implementation plans, and test plans
├── public/               # Static assets
└── tests/                # Comprehensive unit and integration test suites
```

## 🏁 Getting Started

### 1. Prerequisites
-   Node.js 20+
-   Google Cloud SDK (gcloud)
-   Terraform

### 2. Environment Setup
Create a `.env.local` file in the root directory:
```env
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=europe-west4
GOOGLE_CLOUD_LOCATION_IMAGE=global
VIBE_CAFE_BUCKET=your-gcs-bucket-name
VIBE_CAFE_COLLECTION=orders
```

### 3. Local Development
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to see the guest interface.
Access [http://localhost:3000/management](http://localhost:3000/management) for the operator view.

## 🏗 Infrastructure (Terraform)

The cloud resources can be provisioned using the provided Terraform configuration:

```bash
cd terraform
terraform init
terraform apply -var="project_id=YOUR_PROJECT" -var="bucket_name=YOUR_BUCKET" -var="container_image=YOUR_IMAGE"
```

## 🚢 Deployment

The application is optimized for **Google Cloud Run**. You can deploy using the `gcloud` CLI:

```bash
gcloud run deploy vibe-cafe --source . --region europe-west4
```

See [DEPLOY.md](./DEPLOY.md) for detailed deployment instructions.

## 🧪 Testing

The project follows a **Test-Driven Development (TDD)** approach:

```bash
# Run all unit and integration tests
npm test

# Run linter
npm run lint

# Build for production
npm run build
```

---
Built with ❤️ for the Google Cloud Vibe Cafe.
