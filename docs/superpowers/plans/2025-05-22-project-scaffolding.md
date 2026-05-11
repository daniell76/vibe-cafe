# Project Scaffolding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Initialize a Next.js project with the specified structure and dependencies for the Vibe Cafe demo system.

**Architecture:** Next.js (App Router) project without `src` directory, using TypeScript and ESLint.

**Tech Stack:** Next.js, React, TypeScript, Vertex AI, Google Cloud Storage, Cloud Firestore.

---

### Task 1: Clean and Initialize Next.js

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `.gitignore`
- Delete: Existing `src/` and other root files to ensure clean slate.

- [ ] **Step 1: Write verification script**
Create `scripts/verify-step-1.sh`:
```bash
#!/bin/bash
if [ -f "package.json" ] && [ -d "app" ] && [ ! -d "src" ]; then
  echo "Verification passed"
  exit 0
else
  echo "Verification failed"
  exit 1
fi
```

- [ ] **Step 2: Run verification script to verify it fails**
Run: `bash scripts/verify-step-1.sh`
Expected: FAIL (because current project is in `src/`)

- [ ] **Step 3: Clean directory and run create-next-app**
Run:
```bash
# Keep .git and scripts
find . -maxdepth 1 ! -name '.git' ! -name 'scripts' ! -name '.' ! -name '..' -exec rm -rf {} +
npx create-next-app@latest . --typescript --eslint --app --src-dir false --import-alias "@/*" --no-tailwind --yes
```

- [ ] **Step 4: Run verification script to verify it passes**
Run: `bash scripts/verify-step-1.sh`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add .
git commit -m "chore: scaffold Next.js project"
```

### Task 2: Add Google Cloud Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Write dependency check script**
Create `scripts/verify-step-2.sh`:
```bash
#!/bin/bash
dependencies=("@google-cloud/vertexai" "@google-cloud/storage" "@google-cloud/firestore")
for dep in "${dependencies[@]}"; do
  if ! npm list "$dep" > /dev/null 2>&1; then
    echo "Missing dependency: $dep"
    exit 1
  fi
done
echo "All dependencies present"
exit 0
```

- [ ] **Step 2: Run verification script to verify it fails**
Run: `bash scripts/verify-step-2.sh`
Expected: FAIL

- [ ] **Step 3: Install dependencies**
Run: `npm install @google-cloud/vertexai @google-cloud/storage @google-cloud/firestore`

- [ ] **Step 4: Run verification script to verify it passes**
Run: `bash scripts/verify-step-2.sh`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add package.json package-lock.json
git commit -m "chore: add Google Cloud dependencies"
```

### Task 3: Setup Basic Layout and Global CSS

**Files:**
- Modify: `app/globals.css`, `app/layout.tsx`

- [ ] **Step 1: Write CSS check script**
Create `scripts/verify-step-3.sh`:
```bash
#!/bin/bash
if grep -q "Cloud in your Coffee" app/layout.tsx; then
  echo "Verification passed"
  exit 0
else
  echo "Verification failed"
  exit 1
fi
```

- [ ] **Step 2: Run verification script to verify it fails**
Run: `bash scripts/verify-step-3.sh`
Expected: FAIL

- [ ] **Step 3: Update layout and CSS**
Update `app/globals.css` with a clean base and `app/layout.tsx` with project title.

- [ ] **Step 4: Run verification script to verify it passes**
Run: `bash scripts/verify-step-3.sh`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add app/globals.css app/layout.tsx
git commit -m "feat: setup basic layout and styles"
```

### Task 4: Final Verification

- [ ] **Step 1: Run build**
Run: `npm run build`
Expected: PASS

- [ ] **Step 2: Commit final scaffolding state**
```bash
git add .
git commit -m "feat: complete project scaffolding"
```
