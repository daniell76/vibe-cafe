# Vibe Cafe "Cloud in your Coffee" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a functional demo of the "Cloud in your Coffee" app where Brand Ambassadors can generate AI coffee art based on user "happy places" using Gemini 3.1 Flash, and deploy it to Cloud Run.

**Architecture:** Next.js (App Router) with API routes orchestrating Vertex AI (Gemini 3.1 Flash) for image generation, and Google Cloud services (GCS, Firestore) for persistence.

**Tech Stack:** Next.js, TypeScript, Vanilla CSS, Vertex AI SDK, Cloud Storage, Firestore, Docker.

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`
- Create: `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- Create: `.gitignore`

- [ ] **Step 1: Initialize Next.js project**
Run: `npx create-next-app@latest . --typescript --eslint --app --src-dir false --import-alias "@/*" --no-tailwind` (Wait, instructions say prefer Vanilla CSS and avoid Tailwind unless requested. The prompt used `--no-tailwind`)
- [ ] **Step 2: Add dependencies**
Run: `npm install @google-cloud/vertexai @google-cloud/storage @google-cloud/firestore`
- [ ] **Step 3: Setup basic layout and global CSS**
Create `app/globals.css` with a clean, modern base.
- [ ] **Step 4: Verify development server starts**
Run: `npm run dev`
- [ ] **Step 5: Commit scaffolding**

---

### Task 2: AI Service Integration (Vertex AI)

**Files:**
- Create: `lib/vertex-ai.ts`
- Test: `tests/lib/vertex-ai.test.ts`

- [ ] **Step 1: Write failing test for prompt optimization**
```typescript
import { optimizePrompt } from '../lib/vertex-ai';
test('optimizes user happy place into a coffee art prompt', async () => {
  const result = await optimizePrompt('a sunny beach');
  expect(result).toContain('coffee foam art');
});
```
- [ ] **Step 2: Implement Vertex AI client and prompt optimizer**
Use Gemini 3.1 Flash to rewrite the prompt.
- [ ] **Step 3: Write failing test for image generation**
```typescript
import { generateFoamArt } from '../lib/vertex-ai';
test('generates an image buffer from a prompt', async () => {
  const buffer = await generateFoamArt('sunny beach coffee art');
  expect(buffer).toBeInstanceOf(Buffer);
});
```
- [ ] **Step 4: Implement image generation using Gemini 3.1 Flash (nanobanana2)**
- [ ] **Step 5: Commit AI integration**

---

### Task 3: Storage Integration (GCS & Firestore)

**Files:**
- Create: `lib/storage.ts`, `lib/firestore.ts`
- Test: `tests/lib/storage.test.ts`, `tests/lib/firestore.test.ts`

- [ ] **Step 1: Write test for image upload to GCS**
- [ ] **Step 2: Implement `uploadToGCS` in `lib/storage.ts`**
- [ ] **Step 3: Write test for order metadata save to Firestore**
- [ ] **Step 4: Implement `saveOrder` in `lib/firestore.ts`**
- [ ] **Step 5: Commit storage integration**

---

### Task 4: API Route & Orchestration

**Files:**
- Create: `app/api/order/route.ts`
- Test: `tests/api/order.test.ts`

- [ ] **Step 1: Write failing test for the order API**
Should accept name, order, happyPlace and return the image URL.
- [ ] **Step 2: Implement the POST handler in `app/api/order/route.ts`**
Orchestrate: Optimize Prompt -> Generate Image -> Upload to GCS -> Save to Firestore.
- [ ] **Step 3: Verify the full backend flow with a mock**
- [ ] **Step 4: Commit API orchestration**

---

### Task 5: Frontend - Order Form & Vibe Screen

**Files:**
- Create: `components/OrderForm.tsx`, `components/VibeLoader.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create `OrderForm` with Vanilla CSS**
Include Name, Coffee Order (dropdown), and Happy Place.
- [ ] **Step 2: Create `VibeLoader` with fun AI-themed messages**
- [ ] **Step 3: Connect Form to API and handle state transitions**
- [ ] **Step 4: Commit UI components**

---

### Task 6: Frontend - Foam Preview & Order History

**Files:**
- Create: `components/FoamPreview.tsx`, `components/OrderHistory.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Implement `FoamPreview` showing image on a coffee mockup**
- [ ] **Step 2: Implement `OrderHistory` to list recent entries from Firestore**
- [ ] **Step 3: Final styling and polish with Vanilla CSS**
- [ ] **Step 4: Commit final UI**

---

### Task 7: Deployment Configuration

**Files:**
- Create: `Dockerfile`, `.dockerignore`

- [ ] **Step 1: Create a multi-stage Dockerfile for Next.js**
- [ ] **Step 2: Build and run the container locally to verify**
Run: `docker build -t vibe-cafe . && docker run -p 3000:3000 vibe-cafe`
- [ ] **Step 3: Add instructions for GCloud deployment** (Cloud Run)
- [ ] **Step 4: Commit deployment config**
