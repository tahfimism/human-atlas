# Study AI Chatbot & Human Atlas 3D Engine — Separation & Deployment Guide

This guide explains how to separate the **AI Chatbot (Study AI / Nova)** from the **Human Atlas 3D Engine**, how to deploy the 3D engine as an independent micro-service, and how to embed the multi-organ slider and 3D popup in your existing chatbot codebase.

---

## 1. High-Level Architecture (Independent Repositories)

```
┌────────────────────────────────────────┐       ┌────────────────────────────────────────┐
│  AI Chatbot Application (Study AI)     │       │  Human Atlas 3D Service (This Repo)   │
│  (Next.js, Vite, React, Python, etc.)  │       │  (Vite / Three.js Static Micro-App)    │
│                                        │       │                                        │
│  - Chat Feed UI                        │       │  Hosted on Cloudflare Pages / Vercel:  │
│  - Multi-Organ Slider Component        │       │  https://atlas.yourdomain.com          │
│  - Static WebP Posters (0ms)           │       │                                        │
│  - 3D Lightbox Modal                   │◄─────►│  Routes:                               │
│                                        │iframe │  - /?organ=heart&isolate=true&embed=1  │
│  postMessage RPC Event Bus:            │       │  - /thumbnails/heart.webp              │
│  EVT_PART_CLICKED, CMD_FOCUS_ORGAN     │       │  - /models/body-8.chunk (Binary Mesh)  │
└────────────────────────────────────────┘       └────────────────────────────────────────┘
```

---

## 2. Deploying the Human Atlas 3D Engine

The `human-atlas` repository compiles into a completely static, high-performance web asset bundle in `dist/`.

### Option A: Cloudflare Pages (Recommended — Fast Global Anycast & Unlimited Free Bandwidth)
1. In your Cloudflare dashboard: Create a new project under **Workers & Pages**.
2. Connect this repository or upload the `dist/` directory.
3. Build Settings:
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. The included [public/_headers](file:///g:/projects/human-atlas/public/_headers) will automatically configure:
   - `Cache-Control: public, max-age=31536000, immutable` for `/models/*` and `/thumbnails/*`
   - `Access-Control-Allow-Origin: *` so any external website or chatbot can load assets and embed iframes
   - `Content-Security-Policy: frame-ancestors *`

### Option B: Vercel
1. Install Vercel CLI or link your Git repository in the Vercel dashboard:
   ```bash
   npx vercel --prod
   ```
2. The included [vercel.json](file:///g:/projects/human-atlas/vercel.json) configures:
   - Framework preset: `vite`
   - Output directory: `dist`
   - Edge immutable caching headers for `/models/*` and `/thumbnails/*`
   - CORS headers (`Access-Control-Allow-Origin: *`)

---

## 3. Integrating the 3D Engine into Your AI Chatbot

### Step 1: Set Your Atlas Engine URL
In your chatbot application's configuration or `.env`:
```typescript
export const ATLAS_BASE_URL = process.env.NEXT_PUBLIC_ATLAS_URL || 'https://atlas.yourdomain.com';
```

### Step 2: Drop in the Multi-Organ Slider & Modal
In your chatbot chat bubble component:

```tsx
import React, { useState } from 'react';

const ATLAS_BASE_URL = 'https://atlas.yourdomain.com'; // or http://localhost:3016 for local dev

interface OrganItem {
  key: string;
  title: string;
  icon: string;
  parts: number;
}

export function AnatomySlider({ organs }: { organs: OrganItem[] }) {
  const [activeModal, setActiveModal] = useState<OrganItem | null>(null);

  return (
    <div className="anatomy-slider-container">
      {/* 1. Horizontal Scrollable Slider */}
      <div className="flex gap-3 overflow-x-auto py-2">
        {organs.map((org) => (
          <div
            key={org.key}
            onClick={() => setActiveModal(org)}
            className="flex-shrink-0 w-[142px] cursor-pointer rounded-xl border border-slate-200 bg-white p-2 shadow-sm hover:shadow-md transition-all"
          >
            <div className="relative h-[92px] w-full rounded-lg bg-slate-50 flex items-center justify-center overflow-hidden">
              {/* Instant 0ms Pre-rendered WebP Snapshot */}
              <img
                src={`${ATLAS_BASE_URL}/thumbnails/${org.key}.webp`}
                alt={org.title}
                loading="lazy"
                className="max-h-full max-w-full object-contain"
              />
              <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-white/90 text-sky-600 rounded">
                ⚡ 3D
              </span>
            </div>
            <div className="mt-2">
              <div className="font-semibold text-xs text-slate-800 truncate">
                {org.icon} {org.title}
              </div>
              <div className="text-[11px] text-slate-400">
                {org.parts} pieces ↗
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 2. On-Demand 3D Lightbox Modal Popup */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-4xl h-[85vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <span className="text-lg">{activeModal.icon}</span>
                <span className="font-semibold">{activeModal.title}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400">
                  {activeModal.parts} pieces · Front View
                </span>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-white text-xl px-2"
              >
                ✕
              </button>
            </div>

            {/* Interactive 3D Iframe */}
            <div className="flex-1 w-full h-full relative">
              <iframe
                src={`${ATLAS_BASE_URL}/?organ=${activeModal.key}&isolate=true&embed=true&view=front`}
                className="w-full h-full border-0"
                allow="accelerometer; gyroscope"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

### Step 3: Listen for Part Selection Events (`EVT_PART_CLICKED`)
To allow students to click any 3D structure and send a question back to the chatbot:

```typescript
useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    if (event.data?.type === 'EVT_PART_CLICKED') {
      const { name, partId, system } = event.data.payload;
      console.log(`Student tapped: ${name} (${partId}) in ${system}`);
      
      // Example: Show confirmation toast or auto-inject inquiry into chat input:
      setChatInput(`Explain the function of the ${name} in the ${activeOrgan}.`);
    }
  };

  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, [activeOrgan]);
```

---

## 4. Moving the AI Chat Prototype to a Separate Folder (If Desired)

The current `test-study-ai` folder in this repo is 100% self-contained:
- It runs with `node scripts/serve-test-study-ai.mjs` on port `3017`.
- It now reads `ATLAS_BASE_URL` dynamically.
- You can move `test-study-ai/` into any independent repository or folder at any time. It requires no build step—just plain HTML/CSS/JS that can be served by any static host or integrated into your Next.js/React app.
