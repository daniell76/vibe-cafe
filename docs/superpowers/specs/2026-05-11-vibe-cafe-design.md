# Design Doc: Google Cloud Vibe Cafe - "Cloud in your Coffee"

**Date:** 2026-05-11
**Status:** Draft
**Topic:** Vibe Cafe Demo System

## 1. Executive Summary
The "Cloud in your Coffee" app is a demo system for the Google Cloud Vibe Cafe. It allows Brand Ambassadors to capture user information (name, coffee order, and "happy place") and use Gemini 3.1 Flash to generate a custom coffee foam art image. The system stores these images and metadata for printing and future reference.

## 2. Architecture
- **Frontend:** Next.js (App Router) + TypeScript.
- **Backend:** Next.js API Routes (handling AI orchestration and storage logic).
- **AI Integration:** Vertex AI SDK (Gemini 3.1 Flash) for prompt rewriting and image generation.
- **Storage:** 
  - **Images:** Google Cloud Storage.
  - **Metadata:** Google Firestore (Stores name, order, happy place, and image URL).
- **Deployment:** Containerized with Docker and deployed to Google Cloud Run.

## 3. Data Flow
1. **Input:** Ambassador enters User Name, Coffee Order, and "Happy Place".
2. **AI Rewriter:** Gemini 3.1 Flash takes "Happy Place" and generates an optimized prompt for coffee foam art.
3. **Image Gen:** Gemini 3.1 Flash (or Imagen via Vertex AI) generates the image from the optimized prompt.
4. **Persistence:**
   - Image is uploaded to GCS.
   - Order metadata (Name, Order, Happy Place, GCS URL) is saved to Firestore.
5. **Output:** The frontend displays the image for the Ambassador.

## 4. Components & UI
- **`OrderForm`:** Multi-step input form with modern styling.
- **`VibeLoader`:** Interactive loading screen with AI-themed status messages.
- **`FoamPreview`:** Visual representation of the generated art on a coffee cup.
- **`OrderHistory`:** List of recent orders for easy access.

## 5. Technical Requirements
- Node.js 20+
- Google Cloud Project with Vertex AI, Firestore, and GCS enabled.
- Docker for containerization.

## 6. Testing Strategy
- **Unit Tests:** Component-level tests (React Testing Library).
- **Integration Tests:** API route testing with mocked Vertex AI responses.
- **Verification:** Manual E2E flow check on the deployed Cloud Run service.

## 7. Future Considerations
- Real-time updates via WebSockets for the Ambassador dashboard.
- Integration with actual coffee printing hardware APIs.
