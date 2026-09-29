# Human Atlas & Study AI — Running Guide

This document contains all commands, configuration, and workflows used to run, test, build, and deploy the **Human Atlas 3D Engine** and the **Study AI (Protiva + Nova Chatbot)** integration harness.

---

## Architecture Overview

The system runs as two cooperating local servers:

| Service | Port | Directory / Tech | Purpose |
| :--- | :--- | :--- | :--- |
| **Human Atlas 3D Engine** | `3016` | `dist/` (Vite / Three.js) | Standalone interactive 3D anatomy viewer, hardware slicer, and chunk streaming engine |
| **Study AI Test Harness** | `3017` | `test-study-ai/` (Node.js) | Protiva PDF study workspace + Nova AI chatbot with multi-organ slider & 3D lightbox popup modal |

---

## 1. Quick Start (Running Both Servers)

### Prerequisites
- **Node.js**: v22.13.0 or newer
- **Google Chrome** or **Microsoft Edge** (for automated headless WebP snapshot generation)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Build the 3D Atlas Production Bundle
```bash
npm run build
```
*(Outputs the optimized client bundle to `dist/`, including binary mesh chunks, textures, and assets).*

### Step 3: Start the Servers

#### Terminal 1 — Start the Atlas 3D Viewer (Port 3016):
```bash
npx vite preview --host 0.0.0.0 --port 3016
```
*(Or for hot-reloading development mode: `npm run dev`)*

#### Terminal 2 — Start the Study AI Chatbot Harness (Port 3017):
```bash
node scripts/serve-test-study-ai.mjs
```

#### Windows PowerShell One-Liner (Run Both in Background):
```powershell
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npx vite preview --host 0.0.0.0 --port 3016"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "node scripts/serve-test-study-ai.mjs"
```

---

## 2. Browser URLs

Once running, access the services in your browser:

- **Study AI Chatbot + Organ Slider (Protiva UI)**:
  👉 **`http://localhost:3017/`**
  - Horizontal multi-organ slider inside Nova AI chat bubbles.
  - Tapping any card opens the **3D Lightbox Modal**.
  - Toggle button in chat header switches between **`⚡ WebP (0ms)`** and **`🌐 Live 3D`**.

- **Standalone 3D Atlas Viewer (Direct Organ Embed)**:
  👉 **`http://localhost:3016/?organ=heart&isolate=true&embed=true&view=front`**

- **Interactive WebP Thumbnail Batch Generator**:
  👉 **`http://localhost:3017/generator`**

---

## 3. Running Automated Tests

Run the full integration test suite:
```bash
npm test
```

### What `npm test` Validates:
1. **Atlas Catalogue Verification** (`scripts/validate-atlas.mjs`):
   - Verifies 2,234 individually indexed meshes, 3,432 named concepts, and binary buffer alignments.
2. **Selective Chunk Streaming & Bandwidth Savings** (`scripts/test-selective-loading.mjs`):
   - Verifies that isolated organs download only their required chunks (e.g. Heart loads only chunks 8 & 9, saving ~86% bandwidth vs. the full 31MB model).
3. **End-to-End System & postMessage RPC Test** (`scripts/test-integration.mjs`):
   - Validates postMessage schemas, URL query resolution, and build bundle integrity.

---

## 4. Generating Production WebP Thumbnails

To bypass the browser limit of 8–16 WebGL contexts per tab, the chatbot uses high-resolution pre-rendered `.webp` snapshots for chat cards.

To re-generate all organ thumbnails automatically:
```bash
node scripts/generate-thumbnails.mjs
```

### Output:
- Saved to `public/thumbnails/` and `test-study-ai/thumbnails/`:
  - `heart.webp` (~22 KB)
  - `trachea.webp` (~7 KB)
  - `brain.webp` (~21 KB)
  - `stomach.webp` (~6 KB)
  - `femur.webp` (~7 KB)
  - `liver.webp` (~9 KB)
- All images are rendered at **2x retina resolution (284×184)** with **transparent alpha backgrounds**.

---

## 5. 3D Viewer URL Query Parameters

When embedding the 3D viewer in an `<iframe>`, you can customize its behavior using query parameters:

| Parameter | Values | Description |
| :--- | :--- | :--- |
| `organ` | `heart`, `brain`, `femur`, `stomach`, `trachea`, etc. | Automatically isolates and focuses the requested organ structure |
| `isolate` | `true` *(default)*, `false` | When `true`, hides surrounding body and locks isolate mode |
| `embed` | `true`, `false` | Hides the full-screen studio chrome (layers panel, identity header, bottom dock) |
| `view` | `front` *(default)*, `side`, `back` | Sets initial camera orientation. Always default to `front` |
| `mini` | `true`, `false` | Ultra-clean mode: suppresses all UI overlays, labels, and slice pills (for clean card previews) |
| `rotate` | `true`, `false` | Enables subtle, gentle auto-rotation in isolate mode |
| `transparent`| `true`, `false` | Sets WebGL clearColor to transparent alpha (for clean PNG/WebP exports) |

### Example Embed URLs:
```html
<!-- Full Interactive Modal Embed -->
<iframe src="http://localhost:3016/?organ=heart&isolate=true&embed=true&view=front"></iframe>

<!-- Mini Rotating Thumbnail Embed -->
<iframe src="http://localhost:3016/?organ=heart&isolate=true&embed=true&mini=true&rotate=true"></iframe>
```

---

## 6. postMessage RPC API (Parent App ↔ 3D Viewer)

The parent application communicates with the 3D viewer `<iframe>` using window messaging:

### Commands (Parent → 3D Viewer Iframe):
```javascript
const iframe = document.getElementById('atlas-iframe').contentWindow;

// 1. Focus a specific organ
iframe.postMessage({
  type: 'CMD_FOCUS_ORGAN',
  payload: { organ: 'heart', isolate: true }
}, '*');

// 2. Set camera view ('front' | 'side' | 'back')
iframe.postMessage({
  type: 'CMD_SET_VIEW',
  payload: { view: 'front' }
}, '*');

// 3. Control hardware cross-section slicer
iframe.postMessage({
  type: 'CMD_SET_SLICE',
  payload: {
    active: true,       // Enable / disable clipping plane
    axis: 'coronal',    // 'coronal' (front), 'axial' (top), 'sagittal' (side)
    value: 0.5          // Cut depth from 0.0 to 1.0 (50%)
  }
}, '*');

// 4. Reset camera to organ front view
iframe.postMessage({ type: 'CMD_RESET' }, '*');
```

### Events (3D Viewer Iframe → Parent App):
```javascript
window.addEventListener('message', (event) => {
  if (!event.data || typeof event.data !== 'object') return;
  const { type, payload } = event.data;

  // Triggered when user clicks/taps an anatomical part inside the 3D scene
  if (type === 'EVT_PART_CLICKED') {
    console.log(`User clicked: ${payload.name} (${payload.system})`);
    // Example: { partId: "FMA7101", name: "Right ventricle", system: "cardiac" }
  }

  // Triggered when organ finishes loading and is ready for inspection
  if (type === 'EVT_READY') {
    console.log(`Organ ready: ${payload.organ} with ${payload.partsCount} pieces`);
  }
});
```

---

## 7. Production Deployment Commands

The output in `dist/` is 100% static assets (HTML, JS, CSS, binary `.chunk` files, and `.webp` images) with no Node.js runtime required.

### Deploy to Vercel (Configured in `vercel.json`):
```bash
# Install Vercel CLI (if not installed)
npm i -g vercel

# Deploy production
vercel --prod
```

### Deploy to Cloudflare Pages (Recommended for Unlimited Free 3D Bandwidth):
```bash
# Deploy dist folder directly to Cloudflare Pages
npx wrangler pages deploy dist --project-name=human-atlas
```
*(Or connect your GitHub repository in the Cloudflare Pages dashboard with build command `npm run build` and output directory `dist`)*.
