# Vibe Cafe "Cloud in your Coffee" - Test Plan

## 1. Unit Tests
- **Vertex AI Service (`lib/vertex-ai.ts`):** 
    - [ ] `optimizePrompt`: Verify it converts user input into a creative prompt.
    - [ ] `generateFoamArt`: Verify it returns an image buffer (or mock during tests).
- **Storage Service (`lib/storage.ts`):**
    - [ ] `uploadToGCS`: Verify it returns a local proxy URL (`/api/image/...`).
- **Firestore Service (`lib/firestore.ts`):**
    - [ ] `saveOrder`: Verify it returns a document ID.
    - [ ] `getOrders`: Verify it returns a list of orders.

## 2. Integration Tests
- **Order API (`app/api/order/route.ts`):**
    - [ ] POST success: Valid payload returns 201 with `orderId` and `imageUrl`.
    - [ ] POST failure: Missing fields return 400.
- **Orders API (`app/api/orders/route.ts`):**
    - [ ] GET success: Returns 200 with a list of orders.

## 3. End-to-End (E2E) Functional Validation
- **Local Server (`npm run dev`):**
    - [ ] Root page (`/`) loads without errors.
    - [ ] Order flow: Submit form -> VibeLoader shows -> FoamPreview shows image.
    - [ ] History: Recent orders appear in the grid.
- **Image Proxy:**
    - [ ] Verify generated image is reachable via `/api/image/[filename]`.

## 4. Infrastructure & Region Validation
- **Deployment Region:** Verify `europe-west4` configuration.
- **AI Models:** Verify Gemini 3.1 Flash models are called via the `global` location.
- **Public Access:** Verify images are proxied to avoid PAP restrictions.
