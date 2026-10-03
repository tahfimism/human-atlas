# Human Atlas 3D Engine — Complete Developer Integration Guide

An authoritative, production-grade guide for embedding the **Human Atlas 3D Engine** into web applications, medical learning platforms, mobile apps, and AI chat interfaces (e.g., Protiva, Study AI, Canvas, Next.js, Vue, Svelte, React Native, and Flutter apps).

---

## Table of Contents
1. [Architecture & Integration Tiers](#1-architecture--integration-tiers)
2. [Live CDN Endpoints & Headers](#2-live-cdn-endpoints--headers)
3. [Complete URL Query Parameters Reference](#3-complete-url-query-parameters-reference)
4. [Framework Embedding Guides & Code Snippets](#4-framework-embedding-guides--code-snippets)
   - [React & Next.js (App Router)](#pattern-a-react--nextjs)
   - [Vue 3 / Nuxt](#pattern-b-vue-3--nuxt)
   - [Svelte / SvelteKit](#pattern-c-svelte--sveltekit)
   - [Vanilla HTML & JavaScript](#pattern-d-vanilla-html--javascript)
   - [Mobile WebViews (React Native & Flutter)](#pattern-e-mobile-webviews-react-native--flutter)
   - [Multi-Organ Carousel with Lightbox (Protiva Pattern)](#pattern-f-multi-organ-carousel-with-lightbox-popup)
   - [Direct Micro-GLB 3D Model Loading](#pattern-g-direct-micro-glb-loading-threejs--model-viewer)
5. [Bidirectional PostMessage RPC API](#5-bidirectional-postmessage-rpc-api)
   - [TypeScript Interfaces & Event Schemas](#typescript-interfaces--event-schemas)
   - [Inbound Commands (Host ➔ Atlas)](#inbound-commands-host--atlas)
   - [Outbound Events (Atlas ➔ Host)](#outbound-events-atlas--host)
6. [Interactive Educational Features](#6-interactive-educational-features)
   - [Subpart Double-Click & Double-Tap Isolation](#subpart-double-click--double-tap-isolation)
   - [Hardware GPU Cross-Sectional Slicing](#hardware-gpu-cross-sectional-slicing)
   - [Interactive Quiz & Find Mode](#interactive-quiz--find-mode)
   - [Terminologia Anatomica (Latin Badges)](#terminologia-anatomica-latin-badges)
7. [The 15 Anatomical Systems Reference](#7-the-15-anatomical-systems-reference)
8. [Complete Catalog: 61 Standalone Micro-GLBs](#8-complete-catalog-61-standalone-micro-glbs)
9. [Dynamic 3,432 Concepts Streaming](#9-dynamic-3432-concepts-streaming)
10. [AI Chatbot Streaming DSL Parser (AnatomyStreamParser)](#10-ai-chatbot-streaming-dsl-parser)
11. [Troubleshooting, Security & FAQ](#11-troubleshooting-security--faq)

---

## 1. Architecture & Integration Tiers

Human Atlas uses a **three-tier architecture** designed for sub-second load times on any device:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             INTEGRATION TIERS                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ Tier 1: Interactive 3D WebGL Embed (Recommended)                            │
│   - Full interactive Three.js 3D viewer rendered in an <iframe>             │
│   - Selective chunk streaming (downloads only the 1-3 binary chunks needed) │
│   - Zero-overhead subpart double-click isolation, GPU slicing, quiz mode    │
│   - URL: https://human-atlas-sage.vercel.app/?organ=heart&isolate=true      │
├─────────────────────────────────────────────────────────────────────────────┤
│ Tier 2: Standalone Micro-GLBs (PRD-04)                                      │
│   - 61 standalone glTF 2.0 binary models (all <= 500 KB, average 135 KB)    │
│   - Centered at (0, 0, 0) with Meshopt boundary-preserving simplification   │
│   - Usable in Three.js, React Three Fiber, Babylon.js, or <model-viewer>    │
│   - URL: https://human-atlas-sage.vercel.app/models/organs/{slug}.glb       │
├─────────────────────────────────────────────────────────────────────────────┤
│ Tier 3: Instant WebP Posters (0ms Load)                                     │
│   - Transparent retina WebP snapshots for horizontal carousel cards         │
│   - Instant rendering before user taps to open 3D interactive modal         │
│   - URL: https://human-atlas-sage.vercel.app/thumbnails/{slug}.webp        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Live CDN Endpoints & Headers

* **Live Base URL**: `https://human-atlas-sage.vercel.app`
* **CORS**: `Access-Control-Allow-Origin: *` (open to all domains)
* **Embedding Security**: `Content-Security-Policy: frame-ancestors *` (no iframe-busting restrictions)
* **Cache Headers**: `Cache-Control: public, max-age=31536000, immutable` across all 3D chunks, GLB models, and WebP thumbnails.

---

## 3. Complete URL Query Parameters Reference

When embedding the Atlas via `<iframe>`, customize the viewer using URL query parameters:

| Parameter | Type | Default | Description | Example |
| :--- | :--- | :---: | :--- | :--- |
| `organ` | `string` | `undefined` | Target organ name, alias, or FMA ID (resolves across 3,432 concepts). | `?organ=heart`, `?organ=brain`, `?organ=femur` |
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

## 4. Framework Embedding Guides & Code Snippets

### Pattern A: React & Next.js

```tsx
import React, { useRef, useEffect } from 'react';

interface AnatomyEmbedProps {
  organ: string;
  view?: 'front' | 'back' | 'side';
  slice?: 'coronal' | 'axial' | 'sagittal';
  sliceOffset?: number;
  mode?: 'normal' | 'quiz';
  quizTarget?: string;
  transparent?: boolean;
  onPartClicked?: (part: { partId: string; name: string; conceptId: string; system: string }) => void;
  onPartIsolated?: (part: { partId: string; name: string; organ?: string }) => void;
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
  transparent = false,
  onPartClicked,
  onPartIsolated,
  onQuizAnswer,
  className = 'w-full h-[520px] rounded-2xl overflow-hidden border border-slate-200 shadow-md'
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const params = new URLSearchParams({
    organ,
    isolate: 'true',
    embed: 'true',
    view,
    mode,
    ...(transparent ? { transparent: 'true' } : {}),
    ...(slice ? { slice, sliceOffset: String(sliceOffset) } : {}),
    ...(quizTarget ? { quizTarget } : {})
  });

  const src = `https://human-atlas-sage.vercel.app/?${params.toString()}`;

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== 'object') return;
      const { type, payload } = e.data;

      if (type === 'EVT_PART_CLICKED' && onPartClicked) onPartClicked(payload);
      if (type === 'EVT_PART_ISOLATED' && onPartIsolated) onPartIsolated(payload);
      if (type === 'EVT_QUIZ_ANSWER' && onQuizAnswer) onQuizAnswer(payload);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onPartClicked, onPartIsolated, onQuizAnswer]);

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

### Pattern B: Vue 3 / Nuxt

```vue
<template>
  <div class="anatomy-frame-container">
    <iframe
      ref="iframeRef"
      :src="embedUrl"
      class="anatomy-iframe"
      allow="xr-spatial-tracking"
      :title="'Human Atlas 3D - ' + organ"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';

const props = withDefaults(defineProps<{
  organ: string;
  view?: 'front' | 'back' | 'side';
  slice?: 'coronal' | 'axial' | 'sagittal';
  sliceOffset?: number;
  mode?: 'normal' | 'quiz';
  quizTarget?: string;
}>(), {
  view: 'front',
  sliceOffset: 0.5,
  mode: 'normal'
});

const emit = defineEmits(['partClicked', 'partIsolated', 'quizAnswer']);

const embedUrl = computed(() => {
  const p = new URLSearchParams({
    organ: props.organ,
    isolate: 'true',
    embed: 'true',
    view: props.view,
    mode: props.mode,
    ...(props.slice ? { slice: props.slice, sliceOffset: String(props.sliceOffset) } : {}),
    ...(props.quizTarget ? { quizTarget: props.quizTarget } : {})
  });
  return `https://human-atlas-sage.vercel.app/?${p.toString()}`;
});

function onMessage(e: MessageEvent) {
  if (!e.data || typeof e.data !== 'object') return;
  const { type, payload } = e.data;
  if (type === 'EVT_PART_CLICKED') emit('partClicked', payload);
  if (type === 'EVT_PART_ISOLATED') emit('partIsolated', payload);
  if (type === 'EVT_QUIZ_ANSWER') emit('quizAnswer', payload);
}

onMounted(() => window.addEventListener('message', onMessage));
onUnmounted(() => window.removeEventListener('message', onMessage));
</script>

<style scoped>
.anatomy-frame-container {
  width: 100%;
  height: 520px;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
}
.anatomy-iframe {
  width: 100%;
  height: 100%;
  border: 0;
}
</style>
```

---

### Pattern C: Svelte / SvelteKit

```svelte
<script lang="ts">
  import { onMount } from 'svelte';

  export let organ = 'heart';
  export let view: 'front' | 'back' | 'side' = 'front';
  export let slice: 'coronal' | 'axial' | 'sagittal' | undefined = undefined;
  export let sliceOffset = 0.5;
  export let mode: 'normal' | 'quiz' = 'normal';
  export let quizTarget = '';

  $: params = new URLSearchParams({
    organ,
    isolate: 'true',
    embed: 'true',
    view,
    mode,
    ...(slice ? { slice, sliceOffset: String(sliceOffset) } : {}),
    ...(quizTarget ? { quizTarget } : {})
  });

  $: src = `https://human-atlas-sage.vercel.app/?${params.toString()}`;

  onMount(() => {
    const handle = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== 'object') return;
      console.log('Atlas Event:', e.data.type, e.data.payload);
    };
    window.addEventListener('message', handle);
    return () => window.removeEventListener('message', handle);
  });
</script>

<div class="atlas-wrapper">
  <iframe {src} title="Human Atlas" allow="xr-spatial-tracking" />
</div>

<style>
  .atlas-wrapper {
    width: 100%;
    height: 500px;
    border-radius: 16px;
    overflow: hidden;
    border: 1px solid #e2e8f0;
  }
  iframe {
    width: 100%;
    height: 100%;
    border: none;
  }
</style>
```

---

### Pattern D: Vanilla HTML & JavaScript

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Anatomy Viewer</title>
  <style>
    .viewer-box {
      width: 100%;
      max-width: 900px;
      height: 550px;
      margin: 20px auto;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0,0,0,0.1);
    }
    iframe { width: 100%; height: 100%; border: 0; }
  </style>
</head>
<body>

  <div class="viewer-box">
    <iframe
      id="atlas-frame"
      src="https://human-atlas-sage.vercel.app/?organ=heart&isolate=true&embed=true&view=front"
      allow="xr-spatial-tracking"
    ></iframe>
  </div>

  <script>
    const frame = document.getElementById('atlas-frame');

    // Listen for structure clicks
    window.addEventListener('message', (e) => {
      if (!e.data || typeof e.data !== 'object') return;
      const { type, payload } = e.data;

      if (type === 'EVT_PART_CLICKED') {
        alert('Clicked structure: ' + payload.name + ' (' + payload.system + ')');
      }
    });

    // Programmatically trigger coronal cross-section after 3 seconds:
    setTimeout(() => {
      frame.contentWindow.postMessage({
        type: 'CMD_SET_SLICE',
        payload: { active: true, axis: 'coronal', value: 0.45 }
      }, '*');
    }, 3000);
  </script>
</body>
</html>
```

---

### Pattern E: Mobile WebViews (React Native & Flutter)

#### React Native (`react-native-webview`)
```tsx
import React, { useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

export function AnatomyScreen() {
  const webViewRef = useRef(null);

  const onMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('Atlas Event from WebView:', data.type, data.payload);
    } catch (err) {}
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: 'https://human-atlas-sage.vercel.app/?organ=heart&isolate=true&embed=true' }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onMessage={onMessage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  webview: { flex: 1, backgroundColor: 'transparent' }
});
```

#### Flutter (`webview_flutter`)
```dart
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

class AnatomyViewerScreen extends StatefulWidget {
  final String organ;
  const AnatomyViewerScreen({Key? key, this.organ = 'heart'}) : super(key: key);

  @override
  State<AnatomyViewerScreen> createState() => _AnatomyViewerScreenState();
}

class _AnatomyViewerScreenState extends State<AnatomyViewerScreen> {
  late final WebViewController _controller;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..loadRequest(Uri.parse(
        'https://human-atlas-sage.vercel.app/?organ=${widget.organ}&isolate=true&embed=true',
      ));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('3D Anatomy - ${widget.organ}')),
      body: WebViewWidget(controller: _controller),
    );
  }
}
```

---

### Pattern F: Multi-Organ Carousel with Lightbox Popup

The recommended pattern for AI chatbots (e.g. Protiva / Nova): displays **0ms static WebP thumbnails** in a horizontal slider and opens a modal on tap:

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

### Pattern G: Direct Micro-GLB Loading (Three.js & `<model-viewer>`)

If you want to render 3D models inside your own WebGL scene without an `<iframe>`, load any of the **61 pre-decimated Micro-GLBs** (all <= 500 KB):

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

## 5. Bidirectional PostMessage RPC API

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

### TypeScript Interfaces & Event Schemas

```typescript
export interface AtlasEventReady {
  type: 'EVT_READY';
  payload: {
    organ: string;
    partsCount: number;
    id: string; // e.g. FMA7088
  };
}

export interface AtlasEventPartClicked {
  type: 'EVT_PART_CLICKED';
  payload: {
    partId: string;
    name: string;
    conceptId: string;
    system: string; // e.g. 'cardiac', 'skeletal'
  };
}

export interface AtlasEventPartIsolated {
  type: 'EVT_PART_ISOLATED';
  payload: {
    partId: string;
    name: string;
    conceptId: string;
    system: string;
    organ?: string;
  };
}

export interface AtlasEventIsolateCleared {
  type: 'EVT_ISOLATE_CLEARED';
  payload: {
    organ?: string;
  };
}

export interface AtlasEventQuizAnswer {
  type: 'EVT_QUIZ_ANSWER';
  payload: {
    clickedId: string;
    name: string;
    quizTarget: string;
    isCorrect: boolean;
  };
}
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

---

## 6. Interactive Educational Features

### Subpart Double-Click & Double-Tap Isolation
* **Zero Network Latency**: Because all subparts of an organ (e.g. all 83 pieces of the Heart) are already resident in GPU vertex buffers, isolating a subpart downloads **0 extra bytes** and takes **16 ms (1 frame)**.
* **Desktop**: Double-click any structure (e.g., mitral valve) to isolate it and auto-zoom the camera onto its bounding box. Double-click empty space or click `[↩ Whole Heart]` to restore.
* **Mobile / Touch**: Fast double-tap (<350 ms, <28 px drift) works identically on mobile touchscreens.

### Hardware GPU Cross-Sectional Slicing
* Uses Three.js hardware clipping planes (`localClippingEnabled = true`).
* Truncates solid meshes cleanly to reveal internal chambers (e.g. left ventricle, interventricular septum, heart valves) without expensive CSG re-meshing.
* Supported axes: `coronal`, `axial`, `sagittal`.

### Interactive Quiz & Find Mode
* Masking: Landmarks and hover tooltips are suppressed so answers are not given away.
* Click evaluation: Compares clicked structure name, concept aliases, and *Terminologia Anatomica* Latin terms against `quizTarget`.
* Feedback: Instant green toast on success, amber toast on incorrect attempts, with `EVT_QUIZ_ANSWER` dispatched to parent.

### Terminologia Anatomica (Latin Badges)
Top structures display official Latin anatomical terms (*Terminologia Anatomica*, e.g., `TA: Cor` for Heart, `TA: Encephalon` for Brain, `TA: Hepar` for Liver).

---

## 7. The 15 Anatomical Systems Reference

The Atlas model categorizes meshes into 15 anatomical systems:

| System ID | System Name | Color Code | Color Hex | Examples |
| :--- | :--- | :---: | :---: | :--- |
| `cardiac` | Cardiovascular / Heart | Red | `#f43f5e` | Heart chambers, valves, myocardium |
| `arterial` | Arteries | Crimson | `#ef4444` | Aorta, coronary arteries, carotid arteries |
| `venous` | Veins | Blue | `#3b82f6` | Vena cava, jugular veins, pulmonary veins |
| `nervous` | Nervous System | Yellow | `#fde047` | Brain, cerebellum, brainstem, spinal cord |
| `respiratory` | Respiratory System | Cyan | `#38bdf8` | Trachea, lungs, bronchi |
| `digestive` | Digestive System | Orange | `#f97316` | Stomach, liver, pancreas, intestines |
| `skeletal` | Skeletal System | Ivory | `#e2e8f0` | Skull, spine, ribs, pelvis, femur |
| `muscular` | Muscular System | Purple | `#c084fc` | Diaphragm, deltoid, biceps, rectus femoris |
| `urinary` | Urinary System | Amber | `#fbbf24` | Kidneys, ureters, urinary bladder |
| `lymphatic` | Lymphatic System | Green | `#4ade80` | Spleen, lymph nodes |
| `endocrine` | Endocrine System | Violet | `#a855f7` | Thyroid, adrenal glands |
| `reproductive`| Reproductive System | Pink | `#ec4899` | Reproductive organs |
| `sensory` | Sensory Organs | Teal | `#2dd4bf` | Eyeballs, inner ear |
| `integumentary`| Skin / Surface | Peach | `#fdba74` | Outer skin surface (transparent by default) |

---

## 8. Complete Catalog: 61 Standalone Micro-GLBs

All **61 standalone 3D models** are pre-compiled and served with CDN immutable caching:

| Organ Slug (`slug`) | Common Name | FMA Reference | System | Pieces | Standalone 3D Model | Metadata |\n| :--- | :--- | :--- | :--- | :---: | :---: | :---: |\n| `aorta` | **Aorta** | `FMA3734` | arterial | 5 | [`aorta.glb`](https://human-atlas-sage.vercel.app/models/organs/aorta.glb) (61.5 KB) | [`aorta.json`](https://human-atlas-sage.vercel.app/models/organs/aorta.json) |\n| `appendix` | **appendix** | `FMA14542` | digestive | 1 | [`appendix.glb`](https://human-atlas-sage.vercel.app/models/organs/appendix.glb) (10.0 KB) | [`appendix.json`](https://human-atlas-sage.vercel.app/models/organs/appendix.json) |\n| `biceps_brachii` | **Biceps Brachii** | `FMA37683` | muscular | 2 | [`biceps_brachii.glb`](https://human-atlas-sage.vercel.app/models/organs/biceps_brachii.glb) (30.5 KB) | [`biceps_brachii.json`](https://human-atlas-sage.vercel.app/models/organs/biceps_brachii.json) |\n| `brain` | **brain** | `FMA50801` | cardiac | 59 | [`brain.glb`](https://human-atlas-sage.vercel.app/models/organs/brain.glb) (442.5 KB) | [`brain.json`](https://human-atlas-sage.vercel.app/models/organs/brain.json) |\n| `brainstem` | **brainstem** | `FMA79876` | nervous | 11 | [`brainstem.glb`](https://human-atlas-sage.vercel.app/models/organs/brainstem.glb) (294.0 KB) | [`brainstem.json`](https://human-atlas-sage.vercel.app/models/organs/brainstem.json) |\n| `calcaneus` | **Calcaneus** | `FMA24496` | skeletal | 2 | [`calcaneus.glb`](https://human-atlas-sage.vercel.app/models/organs/calcaneus.glb) (46.5 KB) | [`calcaneus.json`](https://human-atlas-sage.vercel.app/models/organs/calcaneus.json) |\n| `cerebellum` | **cerebellum** | `FMA67944` | nervous | 2 | [`cerebellum.glb`](https://human-atlas-sage.vercel.app/models/organs/cerebellum.glb) (202.6 KB) | [`cerebellum.json`](https://human-atlas-sage.vercel.app/models/organs/cerebellum.json) |\n| `cervical_vertebra` | **Cervical Vertebra** | `FMA9915` | skeletal | 7 | [`cervical_vertebra.glb`](https://human-atlas-sage.vercel.app/models/organs/cervical_vertebra.glb) (299.7 KB) | [`cervical_vertebra.json`](https://human-atlas-sage.vercel.app/models/organs/cervical_vertebra.json) |\n| `clavicle` | **Clavicle** | `FMA13321` | skeletal | 2 | [`clavicle.glb`](https://human-atlas-sage.vercel.app/models/organs/clavicle.glb) (32.4 KB) | [`clavicle.json`](https://human-atlas-sage.vercel.app/models/organs/clavicle.json) |\n| `deltoid` | **Deltoid** | `FMA34676` | muscular | 6 | [`deltoid.glb`](https://human-atlas-sage.vercel.app/models/organs/deltoid.glb) (229.3 KB) | [`deltoid.json`](https://human-atlas-sage.vercel.app/models/organs/deltoid.json) |\n| `diaphragm` | **diaphragm** | `FMA13295` | muscular | 1 | [`diaphragm.glb`](https://human-atlas-sage.vercel.app/models/organs/diaphragm.glb) (304.7 KB) | [`diaphragm.json`](https://human-atlas-sage.vercel.app/models/organs/diaphragm.json) |\n| `duodenum` | **duodenum** | `FMA7206` | digestive | 1 | [`duodenum.glb`](https://human-atlas-sage.vercel.app/models/organs/duodenum.glb) (33.6 KB) | [`duodenum.json`](https://human-atlas-sage.vercel.app/models/organs/duodenum.json) |\n| `esophagus` | **esophagus** | `FMA7131` | digestive | 1 | [`esophagus.glb`](https://human-atlas-sage.vercel.app/models/organs/esophagus.glb) (7.4 KB) | [`esophagus.json`](https://human-atlas-sage.vercel.app/models/organs/esophagus.json) |\n| `eye` | **Eyeball** | `FMA12515` | sensory | 9 | [`eye.glb`](https://human-atlas-sage.vercel.app/models/organs/eye.glb) (360.0 KB) | [`eye.json`](https://human-atlas-sage.vercel.app/models/organs/eye.json) |\n| `eyeball` | **Eyeball** | `FMA12515` | sensory | 9 | [`eyeball.glb`](https://human-atlas-sage.vercel.app/models/organs/eyeball.glb) (360.0 KB) | [`eyeball.json`](https://human-atlas-sage.vercel.app/models/organs/eyeball.json) |\n| `femur` | **Femur** | `FMA9611` | skeletal | 2 | [`femur.glb`](https://human-atlas-sage.vercel.app/models/organs/femur.glb) (35.8 KB) | [`femur.json`](https://human-atlas-sage.vercel.app/models/organs/femur.json) |\n| `fibula` | **Fibula** | `FMA24479` | skeletal | 2 | [`fibula.glb`](https://human-atlas-sage.vercel.app/models/organs/fibula.glb) (12.6 KB) | [`fibula.json`](https://human-atlas-sage.vercel.app/models/organs/fibula.json) |\n| `frontal_bone` | **frontal bone** | `FMA52734` | skeletal | 1 | [`frontal_bone.glb`](https://human-atlas-sage.vercel.app/models/organs/frontal_bone.glb) (115.4 KB) | [`frontal_bone.json`](https://human-atlas-sage.vercel.app/models/organs/frontal_bone.json) |\n| `gallbladder` | **gallbladder** | `FMA7202` | digestive | 1 | [`gallbladder.glb`](https://human-atlas-sage.vercel.app/models/organs/gallbladder.glb) (25.4 KB) | [`gallbladder.json`](https://human-atlas-sage.vercel.app/models/organs/gallbladder.json) |\n| `gastrocnemius` | **Gastrocnemius** | `FMA45950` | muscular | 4 | [`gastrocnemius.glb`](https://human-atlas-sage.vercel.app/models/organs/gastrocnemius.glb) (77.8 KB) | [`gastrocnemius.json`](https://human-atlas-sage.vercel.app/models/organs/gastrocnemius.json) |\n| `gluteus_maximus` | **Gluteus Maximus** | `FMA22314` | muscular | 2 | [`gluteus_maximus.glb`](https://human-atlas-sage.vercel.app/models/organs/gluteus_maximus.glb) (83.5 KB) | [`gluteus_maximus.json`](https://human-atlas-sage.vercel.app/models/organs/gluteus_maximus.json) |\n| `heart` | **heart** | `FMA7088` | cardiac | 83 | [`heart.glb`](https://human-atlas-sage.vercel.app/models/organs/heart.glb) (388.0 KB) | [`heart.json`](https://human-atlas-sage.vercel.app/models/organs/heart.json) |\n| `hip_bone` | **Pelvis** | `FMA16585` | skeletal | 2 | [`hip_bone.glb`](https://human-atlas-sage.vercel.app/models/organs/hip_bone.glb) (74.3 KB) | [`hip_bone.json`](https://human-atlas-sage.vercel.app/models/organs/hip_bone.json) |\n| `humerus` | **Humerus** | `FMA13303` | skeletal | 2 | [`humerus.glb`](https://human-atlas-sage.vercel.app/models/organs/humerus.glb) (48.2 KB) | [`humerus.json`](https://human-atlas-sage.vercel.app/models/organs/humerus.json) |\n| `inferior_vena_cava` | **Inferior Vena Cava** | `FMA10951` | venous | 2 | [`inferior_vena_cava.glb`](https://human-atlas-sage.vercel.app/models/organs/inferior_vena_cava.glb) (18.9 KB) | [`inferior_vena_cava.json`](https://human-atlas-sage.vercel.app/models/organs/inferior_vena_cava.json) |\n| `kidney` | **Kidneys** | `FMA7203` | urinary | 2 | [`kidney.glb`](https://human-atlas-sage.vercel.app/models/organs/kidney.glb) (57.1 KB) | [`kidney.json`](https://human-atlas-sage.vercel.app/models/organs/kidney.json) |\n| `kidneys` | **Kidneys** | `FMA7203` | urinary | 2 | [`kidneys.glb`](https://human-atlas-sage.vercel.app/models/organs/kidneys.glb) (57.1 KB) | [`kidneys.json`](https://human-atlas-sage.vercel.app/models/organs/kidneys.json) |\n| `liver` | **liver** | `FMA7197` | digestive | 60 | [`liver.glb`](https://human-atlas-sage.vercel.app/models/organs/liver.glb) (452.5 KB) | [`liver.json`](https://human-atlas-sage.vercel.app/models/organs/liver.json) |\n| `lumbar_vertebra` | **Lumbar Vertebra** | `FMA9921` | skeletal | 5 | [`lumbar_vertebra.glb`](https://human-atlas-sage.vercel.app/models/organs/lumbar_vertebra.glb) (260.0 KB) | [`lumbar_vertebra.json`](https://human-atlas-sage.vercel.app/models/organs/lumbar_vertebra.json) |\n| `lung` | **Lungs** | `FMA7308` | respiratory | 280 | [`lung.glb`](https://human-atlas-sage.vercel.app/models/organs/lung.glb) (421.1 KB) | [`lung.json`](https://human-atlas-sage.vercel.app/models/organs/lung.json) |\n| `lungs` | **Lungs** | `FMA7308` | respiratory | 280 | [`lungs.glb`](https://human-atlas-sage.vercel.app/models/organs/lungs.glb) (421.1 KB) | [`lungs.json`](https://human-atlas-sage.vercel.app/models/organs/lungs.json) |\n| `mandible` | **Mandible** | `FMA52748` | skeletal | 1 | [`mandible.glb`](https://human-atlas-sage.vercel.app/models/organs/mandible.glb) (45.7 KB) | [`mandible.json`](https://human-atlas-sage.vercel.app/models/organs/mandible.json) |\n| `maxilla` | **Maxilla** | `FMA9711` | skeletal | 2 | [`maxilla.glb`](https://human-atlas-sage.vercel.app/models/organs/maxilla.glb) (177.6 KB) | [`maxilla.json`](https://human-atlas-sage.vercel.app/models/organs/maxilla.json) |\n| `occipital_bone` | **occipital bone** | `FMA52735` | skeletal | 1 | [`occipital_bone.glb`](https://human-atlas-sage.vercel.app/models/organs/occipital_bone.glb) (104.7 KB) | [`occipital_bone.json`](https://human-atlas-sage.vercel.app/models/organs/occipital_bone.json) |\n| `pancreas` | **pancreas** | `FMA7198` | digestive | 4 | [`pancreas.glb`](https://human-atlas-sage.vercel.app/models/organs/pancreas.glb) (246.8 KB) | [`pancreas.json`](https://human-atlas-sage.vercel.app/models/organs/pancreas.json) |\n| `parietal_bone` | **parietal bone** | `FMA9613` | skeletal | 2 | [`parietal_bone.glb`](https://human-atlas-sage.vercel.app/models/organs/parietal_bone.glb) (188.6 KB) | [`parietal_bone.json`](https://human-atlas-sage.vercel.app/models/organs/parietal_bone.json) |\n| `patella` | **Patella** | `FMA24485` | skeletal | 2 | [`patella.glb`](https://human-atlas-sage.vercel.app/models/organs/patella.glb) (13.8 KB) | [`patella.json`](https://human-atlas-sage.vercel.app/models/organs/patella.json) |\n| `pelvis` | **Pelvis** | `FMA16585` | skeletal | 2 | [`pelvis.glb`](https://human-atlas-sage.vercel.app/models/organs/pelvis.glb) (74.3 KB) | [`pelvis.json`](https://human-atlas-sage.vercel.app/models/organs/pelvis.json) |\n| `pulmonary_trunk` | **Pulmonary Trunk** | `FMA8612` | arterial | 1 | [`pulmonary_trunk.glb`](https://human-atlas-sage.vercel.app/models/organs/pulmonary_trunk.glb) (24.0 KB) | [`pulmonary_trunk.json`](https://human-atlas-sage.vercel.app/models/organs/pulmonary_trunk.json) |\n| `radius` | **Radius** | `FMA23463` | skeletal | 2 | [`radius.glb`](https://human-atlas-sage.vercel.app/models/organs/radius.glb) (18.7 KB) | [`radius.json`](https://human-atlas-sage.vercel.app/models/organs/radius.json) |\n| `rectus_femoris` | **Rectus Femoris** | `FMA22430` | muscular | 2 | [`rectus_femoris.glb`](https://human-atlas-sage.vercel.app/models/organs/rectus_femoris.glb) (62.4 KB) | [`rectus_femoris.json`](https://human-atlas-sage.vercel.app/models/organs/rectus_femoris.json) |\n| `rib` | **Ribs** | `FMA7574` | skeletal | 24 | [`rib.glb`](https://human-atlas-sage.vercel.app/models/organs/rib.glb) (284.0 KB) | [`rib.json`](https://human-atlas-sage.vercel.app/models/organs/rib.json) |\n| `ribs` | **Ribs** | `FMA7574` | skeletal | 24 | [`ribs.glb`](https://human-atlas-sage.vercel.app/models/organs/ribs.glb) (284.0 KB) | [`ribs.json`](https://human-atlas-sage.vercel.app/models/organs/ribs.json) |\n| `sacrum` | **Sacrum** | `FMA16202` | skeletal | 1 | [`sacrum.glb`](https://human-atlas-sage.vercel.app/models/organs/sacrum.glb) (101.3 KB) | [`sacrum.json`](https://human-atlas-sage.vercel.app/models/organs/sacrum.json) |\n| `scapula` | **Scapula** | `FMA13394` | skeletal | 2 | [`scapula.glb`](https://human-atlas-sage.vercel.app/models/organs/scapula.glb) (223.4 KB) | [`scapula.json`](https://human-atlas-sage.vercel.app/models/organs/scapula.json) |\n| `skull` | **Skull** | `FMA46565` | sensory | 43 | [`skull.glb`](https://human-atlas-sage.vercel.app/models/organs/skull.glb) (77.3 KB) | [`skull.json`](https://human-atlas-sage.vercel.app/models/organs/skull.json) |\n| `sphenoid_bone` | **sphenoid bone** | `FMA52736` | skeletal | 1 | [`sphenoid_bone.glb`](https://human-atlas-sage.vercel.app/models/organs/sphenoid_bone.glb) (97.0 KB) | [`sphenoid_bone.json`](https://human-atlas-sage.vercel.app/models/organs/sphenoid_bone.json) |\n| `spine` | **Spine** | `FMA13478` | skeletal | 48 | [`spine.glb`](https://human-atlas-sage.vercel.app/models/organs/spine.glb) (79.5 KB) | [`spine.json`](https://human-atlas-sage.vercel.app/models/organs/spine.json) |\n| `spleen` | **spleen** | `FMA7196` | lymphatic | 1 | [`spleen.glb`](https://human-atlas-sage.vercel.app/models/organs/spleen.glb) (24.2 KB) | [`spleen.json`](https://human-atlas-sage.vercel.app/models/organs/spleen.json) |\n| `sternum` | **Sternum** | `FMA7485` | skeletal | 3 | [`sternum.glb`](https://human-atlas-sage.vercel.app/models/organs/sternum.glb) (137.2 KB) | [`sternum.json`](https://human-atlas-sage.vercel.app/models/organs/sternum.json) |\n| `stomach` | **stomach** | `FMA7148` | digestive | 1 | [`stomach.glb`](https://human-atlas-sage.vercel.app/models/organs/stomach.glb) (32.8 KB) | [`stomach.json`](https://human-atlas-sage.vercel.app/models/organs/stomach.json) |\n| `superior_vena_cava` | **Superior Vena Cava** | `FMA4720` | venous | 1 | [`superior_vena_cava.glb`](https://human-atlas-sage.vercel.app/models/organs/superior_vena_cava.glb) (12.1 KB) | [`superior_vena_cava.json`](https://human-atlas-sage.vercel.app/models/organs/superior_vena_cava.json) |\n| `talus` | **Talus** | `FMA9708` | skeletal | 2 | [`talus.glb`](https://human-atlas-sage.vercel.app/models/organs/talus.glb) (49.8 KB) | [`talus.json`](https://human-atlas-sage.vercel.app/models/organs/talus.json) |\n| `temporal_bone` | **temporal bone** | `FMA52737` | skeletal | 2 | [`temporal_bone.glb`](https://human-atlas-sage.vercel.app/models/organs/temporal_bone.glb) (131.7 KB) | [`temporal_bone.json`](https://human-atlas-sage.vercel.app/models/organs/temporal_bone.json) |\n| `thoracic_vertebra` | **Thoracic Vertebra** | `FMA9139` | skeletal | 12 | [`thoracic_vertebra.glb`](https://human-atlas-sage.vercel.app/models/organs/thoracic_vertebra.glb) (326.8 KB) | [`thoracic_vertebra.json`](https://human-atlas-sage.vercel.app/models/organs/thoracic_vertebra.json) |\n| `tibia` | **Tibia** | `FMA24476` | skeletal | 2 | [`tibia.glb`](https://human-atlas-sage.vercel.app/models/organs/tibia.glb) (25.5 KB) | [`tibia.json`](https://human-atlas-sage.vercel.app/models/organs/tibia.json) |\n| `trachea` | **trachea** | `FMA7394` | respiratory | 1 | [`trachea.glb`](https://human-atlas-sage.vercel.app/models/organs/trachea.glb) (43.9 KB) | [`trachea.json`](https://human-atlas-sage.vercel.app/models/organs/trachea.json) |\n| `triceps_brachii` | **Triceps Brachii** | `FMA37692` | muscular | 2 | [`triceps_brachii.glb`](https://human-atlas-sage.vercel.app/models/organs/triceps_brachii.glb) (33.5 KB) | [`triceps_brachii.json`](https://human-atlas-sage.vercel.app/models/organs/triceps_brachii.json) |\n| `ulna` | **Ulna** | `FMA23466` | skeletal | 2 | [`ulna.glb`](https://human-atlas-sage.vercel.app/models/organs/ulna.glb) (21.6 KB) | [`ulna.json`](https://human-atlas-sage.vercel.app/models/organs/ulna.json) |\n| `urinary_bladder` | **urinary bladder** | `FMA15900` | urinary | 1 | [`urinary_bladder.glb`](https://human-atlas-sage.vercel.app/models/organs/urinary_bladder.glb) (5.8 KB) | [`urinary_bladder.json`](https://human-atlas-sage.vercel.app/models/organs/urinary_bladder.json) |\n| `vertebral_column` | **Spine** | `FMA13478` | skeletal | 48 | [`vertebral_column.glb`](https://human-atlas-sage.vercel.app/models/organs/vertebral_column.glb) (79.5 KB) | [`vertebral_column.json`](https://human-atlas-sage.vercel.app/models/organs/vertebral_column.json) |\n

---

## 9. Dynamic 3,432 Concepts Streaming

For any structure not listed in the 61 standalone models above, the universal engine dynamically streams **any of the 3,432 concepts** in the catalogue via:

```
https://human-atlas-sage.vercel.app/?organ={name_or_fma}&isolate=true
```

Examples:
* `?organ=carotid%20artery`
* `?organ=cranial%20nerve`
* `?organ=FMA7233` (Mitral valve directly)
* `?organ=interventricular%20septum`

The engine fetches only the specific 1–3 binary chunks containing those elements, saving **~85% to 93% bandwidth** compared to loading the entire human body.

---

## 10. AI Chatbot Streaming DSL Parser

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

## 11. Troubleshooting, Security & FAQ

### Q1: Why does my browser show "refused to connect" inside an iframe?
* **Cause 1: Insecure HTTP protocol**: If your host application uses `https://`, embedding `http://human-atlas-sage.vercel.app` will be blocked by browsers due to mixed content. Always use `https://human-atlas-sage.vercel.app`.
* **Cause 2: Local `file://` protocol**: Chrome and Edge block cross-origin iframes when opening HTML directly from disk (`file:///path/to/file.html`). Run a local HTTP server instead (e.g. `npx serve` or `npm run dev`).

### Q2: Can I embed the 3D viewer in dark mode?
Yes! Append `&transparent=true` to the URL:
```
https://human-atlas-sage.vercel.app/?organ=brain&isolate=true&embed=true&transparent=true
```
Then set your wrapper `<div>` or container background to your dark theme color (e.g. `#0b0f19`).

### Q3: Does the viewer work on mobile touch devices?
Yes! The camera automatically adjusts OrbitControls for single-finger orbit, two-finger pinch zoom, and double-tap subpart isolation. The UI automatically scales down to compact mobile headers.

### Q4: Are there rate limits on the models or thumbnails?
No! All assets are hosted as static assets on Vercel's global Edge CDN with `Cache-Control: public, max-age=31536000, immutable`. Assets are cached at edge points of presence across the world.
