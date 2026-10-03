# Human Atlas 3D Engine — Developer Integration Guide

An authoritative guide for embedding the **Human Atlas 3D Engine** into web applications, medical learning platforms, and AI chat interfaces (e.g., Protiva, Study AI, Canvas, Next.js apps).

---

## 1. Overview & Architecture

Human Atlas offers a **three-tier architecture** designed for sub-second load times on any device:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             INTEGRATION TIERS                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Interactive 3D WebGL Embed (Recommended)                                  │
│    - Full interactive 3D viewer via <iframe>                                │
│    - Selective chunk streaming (downloads only needed organ meshes)         │
│    - Zero-overhead subpart double-click isolation, GPU slicing, quiz mode    │
│    - URL: https://human-atlas-sage.vercel.app/?organ=heart&isolate=true      │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. Standalone Micro-GLBs (PRD-04)                                           │
│    - 61 standalone glTF 2.0 binary models (all <= 500 KB, avg 135 KB)       │
│    - Centered at (0, 0, 0) with Meshopt boundary-preserving simplification  │
│    - Usable in Three.js, React Three Fiber, Babylon.js, or <model-viewer>   │
│    - URL: https://human-atlas-sage.vercel.app/models/organs/{organ}.glb     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. Instant WebP Posters (0ms Load)                                          │
│    - Transparent retina WebP snapshots for horizontal carousel cards        │
│    - Instant rendering before user taps to open 3D interactive modal        │
│    - URL: https://human-atlas-sage.vercel.app/thumbnails/{organ}.webp       │
└─────────────────────────────────────────────────────────────────────────────┘
```

* **Live Production URL**: `https://human-atlas-sage.vercel.app`
* **CORS**: `Access-Control-Allow-Origin: *` (open to all domains)
* **Embedding Security**: `Content-Security-Policy: frame-ancestors *` (no iframe-busting restrictions)
* **Edge CDN Caching**: `Cache-Control: public, max-age=31536000, immutable`

---

## 2. Complete URL Query Parameters Reference

When embedding the Atlas via `<iframe>`, customize the viewer using URL query parameters:

| Parameter | Type | Default | Description | Example |
| :--- | :--- | :---: | :--- | :--- |
| `organ` | `string` | `undefined` | Target organ name, alias, or FMA ID (resolves across 3,432 concepts). | `?organ=heart`, `?organ=brain`, `?organ=FMA7088` |
| `isolate` | `boolean` | `true` | When `true`, isolates the organ and completely hides the rest of the body. | `?organ=heart&isolate=true` |
| `embed` | `boolean` | `true` | Enables embedded mode: replaces desktop headers/docks with a sleek top metadata pill. | `?embed=true` |
| `mini` | `boolean` | `false` | Headless mode: strips **all** UI chrome, pills, and backgrounds. Perfect for compact thumbnail cards or headless canvas captures. | `?organ=heart&mini=true` |
| `view` | `string` | `'front'` | Initial camera orientation. Options: `'front'`, `'side'`, `'back'`. | `?view=front`, `?view=side` |
| `rotate` | `boolean` | `false` | Enables smooth 360° continuous auto-rotation around the vertical axis. | `?rotate=true` |
| `slice` | `string` | `undefined` | Activates hardware GPU cross-sectional slicing plane. Options: `'coronal'`, `'axial'`, `'sagittal'`. | `?slice=coronal` |
| `sliceOffset` | `number` | `0.5` | Depth of the cutting plane from `0.0` (front/top/left) to `1.0` (back/bottom/right). | `?slice=coronal&sliceOffset=0.42` |
| `mode` | `string` | `'normal'` | Activates educational modes. Set to `'quiz'` for interactive "Quiz & Find" challenge mode. | `?mode=quiz&quizTarget=mitral%20valve` |
| `quizTarget` | `string` | `''` | Target anatomical structure user is challenged to find in Quiz mode. | `?quizTarget=aorta` |
| `transparent` | `boolean` | `false` | Sets WebGL clear color to transparent `rgba(0,0,0,0)`. Ideal for dark mode or custom background integration. | `?transparent=true` |

### Ready-to-Use URL Examples
* **Heart in Isolated Front View**:
  `https://human-atlas-sage.vercel.app/?organ=heart&isolate=true&embed=true&view=front`
* **Coronal Cross-Section Slicer (Inside Cardiac Chambers)**:
  `https://human-atlas-sage.vercel.app/?organ=heart&isolate=true&embed=true&slice=coronal&sliceOffset=0.45`
* **Interactive Quiz (Locate the Mitral Valve)**:
  `https://human-atlas-sage.vercel.app/?organ=heart&isolate=true&embed=true&mode=quiz&quizTarget=mitral%20valve`
* **Headless Transparent Rotating Brain**:
  `https://human-atlas-sage.vercel.app/?organ=brain&isolate=true&mini=true&rotate=true&transparent=true`

---

## 3. Integration Patterns & Code Snippets

### Pattern A: Standard Iframe Embed (React / Next.js)

Drop this responsive React component into your application:

```tsx
import React, { useRef, useEffect } from 'react';

interface AnatomyEmbedProps {
  organ: string;
  view?: 'front' | 'back' | 'side';
  slice?: 'coronal' | 'axial' | 'sagittal';
  sliceOffset?: number;
  mode?: 'normal' | 'quiz';
  quizTarget?: string;
  onPartClicked?: (part: { partId: string; name: string; conceptId: string; system: string }) => void;
  onQuizAnswer?: (answer: { clickedId: string; name: string; quizTarget: string; isCorrect: boolean }) => void;
  className?: string;
}

export const AnatomyEmbed: React.FC<AnatomyEmbedProps> = ({
  organ,
  view = 'front',
  slice,
  sliceOffset = 0.5,
  mode = 'normal',
  quizTarget,
  onPartClicked,
  onQuizAnswer,
  className = 'w-full h-[500px] rounded-2xl overflow-hidden border border-slate-200 shadow-lg'
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Construct embed URL
  const params = new URLSearchParams({
    organ,
    isolate: 'true',
    embed: 'true',
    view,
    mode,
    ...(slice ? { slice, sliceOffset: String(sliceOffset) } : {}),
    ...(quizTarget ? { quizTarget } : {})
  });

  const src = `https://human-atlas-sage.vercel.app/?${params.toString()}`;

  // Listen for bidirectional postMessage RPC events
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== 'object') return;
      const { type, payload } = e.data;

      if (type === 'EVT_PART_CLICKED' && onPartClicked) {
        onPartClicked(payload);
      } else if (type === 'EVT_QUIZ_ANSWER' && onQuizAnswer) {
        onQuizAnswer(payload);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onPartClicked, onQuizAnswer]);

  return (
    <div className={className}>
      <iframe
        ref={iframeRef}
        src={src}
        className="w-full h-full border-0"
        allow="xr-spatial-tracking"
        title={`Human Atlas 3D - ${organ}`}
      />
    </div>
  );
};
```

---

### Pattern B: Multi-Organ Slider with Lightbox Popup (Protiva / Study AI Pattern)

To avoid heavy WebGL contexts in chat feeds, display **0ms static WebP thumbnails** in a horizontal slider and open an interactive 3D lightbox on tap:

```tsx
import React, { useState } from 'react';

const ATLAS_URL = 'https://human-atlas-sage.vercel.app';

interface OrganCard {
  id: string;
  name: string;
  icon: string;
  parts: number;
}

const FEATURED_ORGANS: OrganCard[] = [
  { id: 'heart', name: 'Heart', icon: '🫀', parts: 83 },
  { id: 'brain', name: 'Brain', icon: '🧠', parts: 59 },
  { id: 'lungs', name: 'Lungs', icon: '🫁', parts: 280 },
  { id: 'liver', name: 'Liver', icon: '🩸', parts: 60 },
  { id: 'femur', name: 'Femur Bone', icon: '🦴', parts: 2 },
  { id: 'stomach', name: 'Stomach', icon: '🍱', parts: 1 },
  { id: 'skull', name: 'Skull', icon: '💀', parts: 43 },
  { id: 'spine', name: 'Vertebral Spine', icon: '🦴', parts: 48 }
];

export function OrganCarousel() {
  const [activeModal, setActiveModal] = useState<OrganCard | null>(null);

  return (
    <div className="my-4">
      {/* 1. Horizontal Scrollable Cards */}
      <div className="flex gap-3 overflow-x-auto py-2 px-1 no-scrollbar">
        {FEATURED_ORGANS.map((organ) => (
          <div
            key={organ.id}
            onClick={() => setActiveModal(organ)}
            className="flex-shrink-0 w-[140px] cursor-pointer rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm hover:shadow-md hover:border-blue-400 transition-all"
          >
            <div className="relative h-[95px] w-full rounded-lg bg-slate-50 flex items-center justify-center overflow-hidden">
              <img
                src={`${ATLAS_URL}/thumbnails/${organ.id}.webp`}
                alt={organ.name}
                loading="lazy"
                className="max-h-full max-w-full object-contain"
              />
              <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-white/90 text-blue-600 rounded shadow-xs">
                ⚡ 3D
              </span>
            </div>
            <div className="mt-2">
              <div className="font-semibold text-xs text-slate-800">{organ.icon} {organ.name}</div>
              <div className="text-[11px] text-slate-500">{organ.parts} parts ↗</div>
            </div>
          </div>
        ))}
      </div>

      {/* 2. Fullscreen 3D Modal */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-4xl h-[85vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-slate-700">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 border-b border-slate-800 text-white">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base">{activeModal.icon} {activeModal.name}</span>
                <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">{activeModal.parts} anatomical pieces</span>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            {/* 3D Embed Iframe */}
            <iframe
              src={`${ATLAS_URL}/?organ=${activeModal.id}&isolate=true&embed=true&view=front`}
              className="w-full flex-1 border-0 bg-[#f2f3f3]"
              title={activeModal.name}
            />
          </div>
        </div>
      )}
    </div>
  );
}
```

---

### Pattern C: Direct Micro-GLB Loading in Custom 3D Viewers

All 61 organ models are valid standard **glTF 2.0 (.glb)** files strictly decimated to **<= 500 KB**.

#### Google `<model-viewer>` Web Component
```html
<script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js"></script>

<model-viewer
  src="https://human-atlas-sage.vercel.app/models/organs/heart.glb"
  alt="3D Human Heart Model"
  camera-controls
  auto-rotate
  shadow-intensity="1"
  style="width: 100%; height: 450px; background-color: #f8fafc; border-radius: 16px;"
></model-viewer>
```

#### Three.js `GLTFLoader`
```javascript
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
loader.load('https://human-atlas-sage.vercel.app/models/organs/brain.glb', (gltf) => {
  const model = gltf.scene;
  // All Micro-GLB models are pre-centered at origin (0, 0, 0)
  scene.add(model);
});
```

---

## 4. Bidirectional PostMessage RPC API

Control the embedded Atlas dynamically from your parent app using standard `postMessage`.

```
Parent Application (Host)                Human Atlas 3D Engine (Iframe)
         │                                              │
         │─────── CMD_FOCUS_ORGAN { organ: 'heart' } ──►│
         │─────── CMD_SET_VIEW { view: 'side' } ───────►│
         │─────── CMD_SET_SLICE { axis: 'coronal' } ───►│
         │─────── CMD_ISOLATE_PART { partId } ─────────►│
         │                                              │
         │◄────── EVT_READY { organ, partsCount } ──────│
         │◄────── EVT_PART_CLICKED { partId, name } ────│
         │◄────── EVT_PART_ISOLATED { partId, name } ───│
         │◄────── EVT_QUIZ_ANSWER { isCorrect } ────────│
```

### Inbound Commands (Host ➔ Atlas)

Send commands to the iframe via `iframe.contentWindow.postMessage(message, '*');`:

| Command `type` | Payload Schema | Description |
| :--- | :--- | :--- |
| `CMD_FOCUS_ORGAN` | `{ organ: string, subpart?: string, isolate?: boolean }` | Switches viewer to a new organ concept. |
| `CMD_SET_VIEW` | `{ view: 'front' | 'back' | 'side' }` | Reorients camera to standard anatomical perspectives. |
| `CMD_SET_SLICE` | `{ active: boolean, axis?: 'coronal' | 'axial' | 'sagittal', value?: number }` | Toggles or repositions GPU cross-sectional cut plane (depth 0.0 to 1.0). |
| `CMD_CLEAR_SLICE` | `{}` | Closes cutting plane and restores solid volume rendering. |
| `CMD_ISOLATE_PART` | `{ partId: string }` | Isolates a specific single subpart (e.g. mitral valve) and frames camera on it. |
| `CMD_RESTORE_ORGAN`| `{}` | Restores full organ view from subpart isolation. |
| `CMD_SET_QUIZ` | `{ target: string }` | Sets or switches active quiz target structure. |
| `CMD_QUIZ_FEEDBACK`| `{ correct: boolean, message?: string, partId?: string }` | Sends parent evaluation feedback to display visual toast. |
| `CMD_RESET` | `{}` | Resets camera framing, rotation, and layers to initial defaults. |

#### Sending a Command Example
```typescript
const iframe = document.getElementById('atlas-iframe') as HTMLIFrameElement;

// Switch cutting plane to coronal cross-section at 40% depth
iframe.contentWindow?.postMessage({
  type: 'CMD_SET_SLICE',
  payload: { active: true, axis: 'coronal', value: 0.4 }
}, '*');
```

---

### Outbound Events (Atlas ➔ Host)

Listen for events sent from the Atlas via `window.addEventListener('message', handler);`:

| Event `type` | Payload Schema | Trigger Condition |
| :--- | :--- | :--- |
| `EVT_READY` | `{ organ: string, partsCount: number, id: string }` | Dispatched when the 3D meshes and textures have loaded and rendered. |
| `EVT_PART_CLICKED` | `{ partId: string, name: string, conceptId: string, system: string }` | Dispatched when user taps or clicks any anatomical piece. |
| `EVT_PART_ISOLATED` | `{ partId: string, name: string, conceptId: string, system: string, organ: string }` | Dispatched when a subpart is isolated (via double-click or UI button). |
| `EVT_ISOLATE_CLEARED` | `{ organ: string }` | Dispatched when subpart isolation is cleared back to full organ. |
| `EVT_QUIZ_ANSWER` | `{ clickedId: string, name: string, quizTarget: string, isCorrect: boolean }` | Dispatched in Quiz mode when user clicks a structure, evaluating if it matches `quizTarget`. |
| `EVT_SNAPSHOT_READY`| `{ organ: string, dataUrl: string }` | Dispatched when `snapshot=true` completes rendering headless WebP image. |

---

## 5. Interactive Features Guide

### Subpart Double-Click & Double-Tap Isolation
* **Zero Network Latency**: Because all subparts of an organ (e.g. all 83 pieces of the Heart) are already resident in GPU vertex buffers, isolating a subpart downloads **0 extra bytes** and takes **16 ms (1 frame)**.
* **Desktop**: Double-click any structure (e.g., mitral valve) to isolate it and auto-zoom the camera onto its bounding box. Double-click empty space or click `[↩ Whole Heart]` to restore.
* **Mobile / Touch**: Fast double-tap (<350 ms, <28 px drift) works identically on mobile touchscreens.

### Hardware GPU Cross-Sectional Slicing
* Uses Three.js hardware clipping planes (`localClippingEnabled = true`).
* Truncates solid meshes cleanly to reveal internal chambers (e.g. left ventricle, interventricular septum, heart valves) without expensive CSG re-meshing.
* Supported axes: `coronal`, `axial`, `sagittal`.

### Interactive Quiz Mode
* Masking: Landmarks and hover tooltips are suppressed so answers are not given away.
* Click evaluation: Compares clicked structure name, concept aliases, and *Terminologia Anatomica* Latin terms against `quizTarget`.
* Feedback: Instant green toast on success, amber toast on incorrect attempts, with `EVT_QUIZ_ANSWER` dispatched to parent.

---

## 6. Complete Catalog: 61 Standalone Micro-GLBs

All **61 standalone 3D models** are pre-compiled and served with CDN immutable caching:

| Organ Slug (`slug`) | Common Name | FMA Reference | System | Pieces | Standalone 3D Model | Metadata |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| `aorta` | **Aorta** | `FMA3734` | arterial | 5 | [`aorta.glb`](https://human-atlas-sage.vercel.app/models/organs/aorta.glb) (61.5 KB) | [`aorta.json`](https://human-atlas-sage.vercel.app/models/organs/aorta.json) |
| `appendix` | **appendix** | `FMA14542` | digestive | 1 | [`appendix.glb`](https://human-atlas-sage.vercel.app/models/organs/appendix.glb) (10.0 KB) | [`appendix.json`](https://human-atlas-sage.vercel.app/models/organs/appendix.json) |
| `biceps_brachii` | **Biceps Brachii** | `FMA37683` | muscular | 2 | [`biceps_brachii.glb`](https://human-atlas-sage.vercel.app/models/organs/biceps_brachii.glb) (30.5 KB) | [`biceps_brachii.json`](https://human-atlas-sage.vercel.app/models/organs/biceps_brachii.json) |
| `brain` | **brain** | `FMA50801` | cardiac | 59 | [`brain.glb`](https://human-atlas-sage.vercel.app/models/organs/brain.glb) (442.5 KB) | [`brain.json`](https://human-atlas-sage.vercel.app/models/organs/brain.json) |
| `brainstem` | **brainstem** | `FMA79876` | nervous | 11 | [`brainstem.glb`](https://human-atlas-sage.vercel.app/models/organs/brainstem.glb) (294.0 KB) | [`brainstem.json`](https://human-atlas-sage.vercel.app/models/organs/brainstem.json) |
| `calcaneus` | **Calcaneus** | `FMA24496` | skeletal | 2 | [`calcaneus.glb`](https://human-atlas-sage.vercel.app/models/organs/calcaneus.glb) (46.5 KB) | [`calcaneus.json`](https://human-atlas-sage.vercel.app/models/organs/calcaneus.json) |
| `cerebellum` | **cerebellum** | `FMA67944` | nervous | 2 | [`cerebellum.glb`](https://human-atlas-sage.vercel.app/models/organs/cerebellum.glb) (202.6 KB) | [`cerebellum.json`](https://human-atlas-sage.vercel.app/models/organs/cerebellum.json) |
| `cervical_vertebra` | **Cervical Vertebra** | `FMA9915` | skeletal | 7 | [`cervical_vertebra.glb`](https://human-atlas-sage.vercel.app/models/organs/cervical_vertebra.glb) (299.7 KB) | [`cervical_vertebra.json`](https://human-atlas-sage.vercel.app/models/organs/cervical_vertebra.json) |
| `clavicle` | **Clavicle** | `FMA13321` | skeletal | 2 | [`clavicle.glb`](https://human-atlas-sage.vercel.app/models/organs/clavicle.glb) (32.4 KB) | [`clavicle.json`](https://human-atlas-sage.vercel.app/models/organs/clavicle.json) |
| `deltoid` | **Deltoid** | `FMA34676` | muscular | 6 | [`deltoid.glb`](https://human-atlas-sage.vercel.app/models/organs/deltoid.glb) (229.3 KB) | [`deltoid.json`](https://human-atlas-sage.vercel.app/models/organs/deltoid.json) |
| `diaphragm` | **diaphragm** | `FMA13295` | muscular | 1 | [`diaphragm.glb`](https://human-atlas-sage.vercel.app/models/organs/diaphragm.glb) (304.7 KB) | [`diaphragm.json`](https://human-atlas-sage.vercel.app/models/organs/diaphragm.json) |
| `duodenum` | **duodenum** | `FMA7206` | digestive | 1 | [`duodenum.glb`](https://human-atlas-sage.vercel.app/models/organs/duodenum.glb) (33.6 KB) | [`duodenum.json`](https://human-atlas-sage.vercel.app/models/organs/duodenum.json) |
| `esophagus` | **esophagus** | `FMA7131` | digestive | 1 | [`esophagus.glb`](https://human-atlas-sage.vercel.app/models/organs/esophagus.glb) (7.4 KB) | [`esophagus.json`](https://human-atlas-sage.vercel.app/models/organs/esophagus.json) |
| `eye` | **Eyeball** | `FMA12515` | sensory | 9 | [`eye.glb`](https://human-atlas-sage.vercel.app/models/organs/eye.glb) (360.0 KB) | [`eye.json`](https://human-atlas-sage.vercel.app/models/organs/eye.json) |
| `eyeball` | **Eyeball** | `FMA12515` | sensory | 9 | [`eyeball.glb`](https://human-atlas-sage.vercel.app/models/organs/eyeball.glb) (360.0 KB) | [`eyeball.json`](https://human-atlas-sage.vercel.app/models/organs/eyeball.json) |
| `femur` | **Femur** | `FMA9611` | skeletal | 2 | [`femur.glb`](https://human-atlas-sage.vercel.app/models/organs/femur.glb) (35.8 KB) | [`femur.json`](https://human-atlas-sage.vercel.app/models/organs/femur.json) |
| `fibula` | **Fibula** | `FMA24479` | skeletal | 2 | [`fibula.glb`](https://human-atlas-sage.vercel.app/models/organs/fibula.glb) (12.6 KB) | [`fibula.json`](https://human-atlas-sage.vercel.app/models/organs/fibula.json) |
| `frontal_bone` | **frontal bone** | `FMA52734` | skeletal | 1 | [`frontal_bone.glb`](https://human-atlas-sage.vercel.app/models/organs/frontal_bone.glb) (115.4 KB) | [`frontal_bone.json`](https://human-atlas-sage.vercel.app/models/organs/frontal_bone.json) |
| `gallbladder` | **gallbladder** | `FMA7202` | digestive | 1 | [`gallbladder.glb`](https://human-atlas-sage.vercel.app/models/organs/gallbladder.glb) (25.4 KB) | [`gallbladder.json`](https://human-atlas-sage.vercel.app/models/organs/gallbladder.json) |
| `gastrocnemius` | **Gastrocnemius** | `FMA45950` | muscular | 4 | [`gastrocnemius.glb`](https://human-atlas-sage.vercel.app/models/organs/gastrocnemius.glb) (77.8 KB) | [`gastrocnemius.json`](https://human-atlas-sage.vercel.app/models/organs/gastrocnemius.json) |
| `gluteus_maximus` | **Gluteus Maximus** | `FMA22314` | muscular | 2 | [`gluteus_maximus.glb`](https://human-atlas-sage.vercel.app/models/organs/gluteus_maximus.glb) (83.5 KB) | [`gluteus_maximus.json`](https://human-atlas-sage.vercel.app/models/organs/gluteus_maximus.json) |
| `heart` | **heart** | `FMA7088` | cardiac | 83 | [`heart.glb`](https://human-atlas-sage.vercel.app/models/organs/heart.glb) (388.0 KB) | [`heart.json`](https://human-atlas-sage.vercel.app/models/organs/heart.json) |
| `hip_bone` | **Pelvis** | `FMA16585` | skeletal | 2 | [`hip_bone.glb`](https://human-atlas-sage.vercel.app/models/organs/hip_bone.glb) (74.3 KB) | [`hip_bone.json`](https://human-atlas-sage.vercel.app/models/organs/hip_bone.json) |
| `humerus` | **Humerus** | `FMA13303` | skeletal | 2 | [`humerus.glb`](https://human-atlas-sage.vercel.app/models/organs/humerus.glb) (48.2 KB) | [`humerus.json`](https://human-atlas-sage.vercel.app/models/organs/humerus.json) |
| `inferior_vena_cava` | **Inferior Vena Cava** | `FMA10951` | venous | 2 | [`inferior_vena_cava.glb`](https://human-atlas-sage.vercel.app/models/organs/inferior_vena_cava.glb) (18.9 KB) | [`inferior_vena_cava.json`](https://human-atlas-sage.vercel.app/models/organs/inferior_vena_cava.json) |
| `kidney` | **Kidneys** | `FMA7203` | urinary | 2 | [`kidney.glb`](https://human-atlas-sage.vercel.app/models/organs/kidney.glb) (57.1 KB) | [`kidney.json`](https://human-atlas-sage.vercel.app/models/organs/kidney.json) |
| `kidneys` | **Kidneys** | `FMA7203` | urinary | 2 | [`kidneys.glb`](https://human-atlas-sage.vercel.app/models/organs/kidneys.glb) (57.1 KB) | [`kidneys.json`](https://human-atlas-sage.vercel.app/models/organs/kidneys.json) |
| `liver` | **liver** | `FMA7197` | digestive | 60 | [`liver.glb`](https://human-atlas-sage.vercel.app/models/organs/liver.glb) (452.5 KB) | [`liver.json`](https://human-atlas-sage.vercel.app/models/organs/liver.json) |
| `lumbar_vertebra` | **Lumbar Vertebra** | `FMA9921` | skeletal | 5 | [`lumbar_vertebra.glb`](https://human-atlas-sage.vercel.app/models/organs/lumbar_vertebra.glb) (260.0 KB) | [`lumbar_vertebra.json`](https://human-atlas-sage.vercel.app/models/organs/lumbar_vertebra.json) |
| `lung` | **Lungs** | `FMA7308` | respiratory | 280 | [`lung.glb`](https://human-atlas-sage.vercel.app/models/organs/lung.glb) (421.1 KB) | [`lung.json`](https://human-atlas-sage.vercel.app/models/organs/lung.json) |
| `lungs` | **Lungs** | `FMA7308` | respiratory | 280 | [`lungs.glb`](https://human-atlas-sage.vercel.app/models/organs/lungs.glb) (421.1 KB) | [`lungs.json`](https://human-atlas-sage.vercel.app/models/organs/lungs.json) |
| `mandible` | **Mandible** | `FMA52748` | skeletal | 1 | [`mandible.glb`](https://human-atlas-sage.vercel.app/models/organs/mandible.glb) (45.7 KB) | [`mandible.json`](https://human-atlas-sage.vercel.app/models/organs/mandible.json) |
| `maxilla` | **Maxilla** | `FMA9711` | skeletal | 2 | [`maxilla.glb`](https://human-atlas-sage.vercel.app/models/organs/maxilla.glb) (177.6 KB) | [`maxilla.json`](https://human-atlas-sage.vercel.app/models/organs/maxilla.json) |
| `occipital_bone` | **occipital bone** | `FMA52735` | skeletal | 1 | [`occipital_bone.glb`](https://human-atlas-sage.vercel.app/models/organs/occipital_bone.glb) (104.7 KB) | [`occipital_bone.json`](https://human-atlas-sage.vercel.app/models/organs/occipital_bone.json) |
| `pancreas` | **pancreas** | `FMA7198` | digestive | 4 | [`pancreas.glb`](https://human-atlas-sage.vercel.app/models/organs/pancreas.glb) (246.8 KB) | [`pancreas.json`](https://human-atlas-sage.vercel.app/models/organs/pancreas.json) |
| `parietal_bone` | **parietal bone** | `FMA9613` | skeletal | 2 | [`parietal_bone.glb`](https://human-atlas-sage.vercel.app/models/organs/parietal_bone.glb) (188.6 KB) | [`parietal_bone.json`](https://human-atlas-sage.vercel.app/models/organs/parietal_bone.json) |
| `patella` | **Patella** | `FMA24485` | skeletal | 2 | [`patella.glb`](https://human-atlas-sage.vercel.app/models/organs/patella.glb) (13.8 KB) | [`patella.json`](https://human-atlas-sage.vercel.app/models/organs/patella.json) |
| `pelvis` | **Pelvis** | `FMA16585` | skeletal | 2 | [`pelvis.glb`](https://human-atlas-sage.vercel.app/models/organs/pelvis.glb) (74.3 KB) | [`pelvis.json`](https://human-atlas-sage.vercel.app/models/organs/pelvis.json) |
| `pulmonary_trunk` | **Pulmonary Trunk** | `FMA8612` | arterial | 1 | [`pulmonary_trunk.glb`](https://human-atlas-sage.vercel.app/models/organs/pulmonary_trunk.glb) (24.0 KB) | [`pulmonary_trunk.json`](https://human-atlas-sage.vercel.app/models/organs/pulmonary_trunk.json) |
| `radius` | **Radius** | `FMA23463` | skeletal | 2 | [`radius.glb`](https://human-atlas-sage.vercel.app/models/organs/radius.glb) (18.7 KB) | [`radius.json`](https://human-atlas-sage.vercel.app/models/organs/radius.json) |
| `rectus_femoris` | **Rectus Femoris** | `FMA22430` | muscular | 2 | [`rectus_femoris.glb`](https://human-atlas-sage.vercel.app/models/organs/rectus_femoris.glb) (62.4 KB) | [`rectus_femoris.json`](https://human-atlas-sage.vercel.app/models/organs/rectus_femoris.json) |
| `rib` | **Ribs** | `FMA7574` | skeletal | 24 | [`rib.glb`](https://human-atlas-sage.vercel.app/models/organs/rib.glb) (284.0 KB) | [`rib.json`](https://human-atlas-sage.vercel.app/models/organs/rib.json) |
| `ribs` | **Ribs** | `FMA7574` | skeletal | 24 | [`ribs.glb`](https://human-atlas-sage.vercel.app/models/organs/ribs.glb) (284.0 KB) | [`ribs.json`](https://human-atlas-sage.vercel.app/models/organs/ribs.json) |
| `sacrum` | **Sacrum** | `FMA16202` | skeletal | 1 | [`sacrum.glb`](https://human-atlas-sage.vercel.app/models/organs/sacrum.glb) (101.3 KB) | [`sacrum.json`](https://human-atlas-sage.vercel.app/models/organs/sacrum.json) |
| `scapula` | **Scapula** | `FMA13394` | skeletal | 2 | [`scapula.glb`](https://human-atlas-sage.vercel.app/models/organs/scapula.glb) (223.4 KB) | [`scapula.json`](https://human-atlas-sage.vercel.app/models/organs/scapula.json) |
| `skull` | **Skull** | `FMA46565` | sensory | 43 | [`skull.glb`](https://human-atlas-sage.vercel.app/models/organs/skull.glb) (77.3 KB) | [`skull.json`](https://human-atlas-sage.vercel.app/models/organs/skull.json) |
| `sphenoid_bone` | **sphenoid bone** | `FMA52736` | skeletal | 1 | [`sphenoid_bone.glb`](https://human-atlas-sage.vercel.app/models/organs/sphenoid_bone.glb) (97.0 KB) | [`sphenoid_bone.json`](https://human-atlas-sage.vercel.app/models/organs/sphenoid_bone.json) |
| `spine` | **Spine** | `FMA13478` | skeletal | 48 | [`spine.glb`](https://human-atlas-sage.vercel.app/models/organs/spine.glb) (79.5 KB) | [`spine.json`](https://human-atlas-sage.vercel.app/models/organs/spine.json) |
| `spleen` | **spleen** | `FMA7196` | lymphatic | 1 | [`spleen.glb`](https://human-atlas-sage.vercel.app/models/organs/spleen.glb) (24.2 KB) | [`spleen.json`](https://human-atlas-sage.vercel.app/models/organs/spleen.json) |
| `sternum` | **Sternum** | `FMA7485` | skeletal | 3 | [`sternum.glb`](https://human-atlas-sage.vercel.app/models/organs/sternum.glb) (137.2 KB) | [`sternum.json`](https://human-atlas-sage.vercel.app/models/organs/sternum.json) |
| `stomach` | **stomach** | `FMA7148` | digestive | 1 | [`stomach.glb`](https://human-atlas-sage.vercel.app/models/organs/stomach.glb) (32.8 KB) | [`stomach.json`](https://human-atlas-sage.vercel.app/models/organs/stomach.json) |
| `superior_vena_cava` | **Superior Vena Cava** | `FMA4720` | venous | 1 | [`superior_vena_cava.glb`](https://human-atlas-sage.vercel.app/models/organs/superior_vena_cava.glb) (12.1 KB) | [`superior_vena_cava.json`](https://human-atlas-sage.vercel.app/models/organs/superior_vena_cava.json) |
| `talus` | **Talus** | `FMA9708` | skeletal | 2 | [`talus.glb`](https://human-atlas-sage.vercel.app/models/organs/talus.glb) (49.8 KB) | [`talus.json`](https://human-atlas-sage.vercel.app/models/organs/talus.json) |
| `temporal_bone` | **temporal bone** | `FMA52737` | skeletal | 2 | [`temporal_bone.glb`](https://human-atlas-sage.vercel.app/models/organs/temporal_bone.glb) (131.7 KB) | [`temporal_bone.json`](https://human-atlas-sage.vercel.app/models/organs/temporal_bone.json) |
| `thoracic_vertebra` | **Thoracic Vertebra** | `FMA9139` | skeletal | 12 | [`thoracic_vertebra.glb`](https://human-atlas-sage.vercel.app/models/organs/thoracic_vertebra.glb) (326.8 KB) | [`thoracic_vertebra.json`](https://human-atlas-sage.vercel.app/models/organs/thoracic_vertebra.json) |
| `tibia` | **Tibia** | `FMA24476` | skeletal | 2 | [`tibia.glb`](https://human-atlas-sage.vercel.app/models/organs/tibia.glb) (25.5 KB) | [`tibia.json`](https://human-atlas-sage.vercel.app/models/organs/tibia.json) |
| `trachea` | **trachea** | `FMA7394` | respiratory | 1 | [`trachea.glb`](https://human-atlas-sage.vercel.app/models/organs/trachea.glb) (43.9 KB) | [`trachea.json`](https://human-atlas-sage.vercel.app/models/organs/trachea.json) |
| `triceps_brachii` | **Triceps Brachii** | `FMA37692` | muscular | 2 | [`triceps_brachii.glb`](https://human-atlas-sage.vercel.app/models/organs/triceps_brachii.glb) (33.5 KB) | [`triceps_brachii.json`](https://human-atlas-sage.vercel.app/models/organs/triceps_brachii.json) |
| `ulna` | **Ulna** | `FMA23466` | skeletal | 2 | [`ulna.glb`](https://human-atlas-sage.vercel.app/models/organs/ulna.glb) (21.6 KB) | [`ulna.json`](https://human-atlas-sage.vercel.app/models/organs/ulna.json) |
| `urinary_bladder` | **urinary bladder** | `FMA15900` | urinary | 1 | [`urinary_bladder.glb`](https://human-atlas-sage.vercel.app/models/organs/urinary_bladder.glb) (5.8 KB) | [`urinary_bladder.json`](https://human-atlas-sage.vercel.app/models/organs/urinary_bladder.json) |
| `vertebral_column` | **Spine** | `FMA13478` | skeletal | 48 | [`vertebral_column.glb`](https://human-atlas-sage.vercel.app/models/organs/vertebral_column.glb) (79.5 KB) | [`vertebral_column.json`](https://human-atlas-sage.vercel.app/models/organs/vertebral_column.json) |

*Note: For structures not in this table, the universal engine dynamically streams **any of the 3,432 concepts** in the catalogue via `https://human-atlas-sage.vercel.app/?organ={name}&isolate=true`.*

---

## 7. AI Chatbot Streaming Parser (`AnatomyStreamParser`)

If you are building an AI Tutor (e.g. with OpenAI, Claude, Gemini, or DeepSeek), use the included [`lib/anatomy-stream-parser.ts`](lib/anatomy-stream-parser.ts) to parse code blocks streamed token-by-token from the LLM.

### Instructing Your AI Model (System Prompt)
Add this instruction to your LLM system prompt:

```markdown
When explaining human anatomy, you can embed interactive 3D visualizations by outputting an anatomy code block:

```anatomy
organ: heart
view: front
slice: coronal
caption: Cross-section of the cardiac chambers
```

Or for multiple organs in a carousel slider:
```anatomy
items:
  - organ: heart
    caption: Cardiovascular pump
  - organ: brain
    caption: Central nervous system
  - organ: lungs
    caption: Respiratory exchange
```
```

### Parsing LLM Streams in TypeScript
```typescript
import { AnatomyStreamParser } from './lib/anatomy-stream-parser';

const parser = new AnatomyStreamParser({ resolveFMA: true });

// As tokens arrive from your LLM stream:
for await (const chunk of stream) {
  const token = chunk.choices[0]?.delta?.content || '';
  const state = parser.processToken(token);

  if (state.status === 'streaming') {
    // Show 3D loading skeleton placeholder in chat feed
  } else if (state.status === 'ready') {
    // Render the <AnatomyEmbed> or <OrganCarousel> with state.payload!
  }
}
```

---

## 8. Summary Checklist for Production Embedding

1. ✅ **Embed via Iframe**: Point to `https://human-atlas-sage.vercel.app/?organ={organ}&isolate=true&embed=true`.
2. ✅ **CORS & CSP**: Pre-configured with `Access-Control-Allow-Origin: *` and `Content-Security-Policy: frame-ancestors *`.
3. ✅ **0ms Thumbnail Cards**: Use `https://human-atlas-sage.vercel.app/thumbnails/{organ}.webp` for instant previews.
4. ✅ **Two-Way Control**: Register a `message` event listener in your parent app to handle `EVT_PART_CLICKED` and `EVT_QUIZ_ANSWER`.
