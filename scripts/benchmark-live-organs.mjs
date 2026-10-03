import https from 'node:https';
import { performance } from 'node:perf_hooks';

function fetchResource(url) {
  return new Promise((resolve) => {
    const start = performance.now();
    let firstByte = 0;
    const req = https.get(url, (res) => {
      res.once('data', () => {
        firstByte = performance.now() - start;
      });
      let bytes = 0;
      res.on('data', (c) => bytes += c.length);
      res.on('end', () => {
        const total = performance.now() - start;
        resolve({
          url,
          status: res.statusCode,
          bytes,
          ttfb: Math.round(firstByte || total),
          total: Math.round(total),
          cache: res.headers['x-vercel-cache'] || 'MISS/NONE',
          contentType: res.headers['content-type']
        });
      });
    });
    req.on('error', (err) => resolve({ url, error: err.message }));
  });
}

const ORGANS = [
  { name: 'Heart', id: 'heart', chunks: [8, 9], glb: 'heart.glb' },
  { name: 'Brain', id: 'brain', chunks: [5, 6, 7], glb: 'brain.glb' },
  { name: 'Liver', id: 'liver', chunks: [7, 8, 11], glb: 'liver.glb' },
  { name: 'Stomach', id: 'stomach', chunks: [9], glb: 'stomach.glb' },
  { name: 'Trachea', id: 'trachea', chunks: [9], glb: 'trachea.glb' },
  { name: 'Kidney', id: 'kidney', chunks: [11], glb: 'kidney.glb' },
  { name: 'Femur', id: 'femur', chunks: [12, 13], glb: 'femur.glb' },
  { name: 'Lungs', id: 'lungs', chunks: [8, 9], glb: 'lungs.glb' },
  { name: 'Skull', id: 'skull', chunks: [0, 10, 12, 13], glb: 'skull.glb' },
  { name: 'Spine', id: 'spine', chunks: [11, 12, 13], glb: 'spine.glb' }
];

async function main() {
  const BASE = 'https://human-atlas-sage.vercel.app';
  console.log('========================================================================================');
  console.log('  PRODUCTION BENCHMARK: SINGLE ORGAN STREAMING & MICRO-GLB LATENCY');
  console.log('  Host: ' + BASE);
  console.log('========================================================================================\n');

  console.log('--- 1. Testing Standalone Micro-GLB Performance (PRD-04) ---');
  console.log('Organ        | GLB File    | Size (KB) | TTFB (ms) | Total (ms) | Edge Cache | Status');
  console.log('-------------|-------------|-----------|-----------|------------|------------|-------');

  for (const org of ORGANS) {
    const res = await fetchResource(`${BASE}/models/organs/${org.glb}`);
    const sizeKb = (res.bytes / 1024).toFixed(1).padStart(9);
    const ttfb = res.ttfb.toString().padStart(9);
    const total = res.total.toString().padStart(10);
    const cache = res.cache.padEnd(10);
    console.log(`${org.name.padEnd(12)} | ${org.glb.padEnd(11)} | ${sizeKb} | ${ttfb} | ${total} | ${cache} | HTTP ${res.status}`);
  }

  console.log('\n--- 2. Testing Selective Chunk Streaming for Organs (PRD-01 Engine) ---');
  console.log('Testing selective chunk endpoints needed to assemble each organ in the universal engine:');

  const chunkCache = new Map();
  for (const org of ORGANS) {
    const chunkPromises = org.chunks.map(async (ci) => {
      const url = `${BASE}/models/body-${ci}.chunk`;
      if (!chunkCache.has(ci)) {
        chunkCache.set(ci, await fetchResource(url));
      }
      return chunkCache.get(ci);
    });
    const results = await Promise.all(chunkPromises);
    const totalBytes = results.reduce((acc, r) => acc + r.bytes, 0);
    const maxTtfb = Math.max(...results.map(r => r.ttfb));
    const maxTotal = Math.max(...results.map(r => r.total));
    const allHits = results.every(r => r.cache === 'HIT');

    console.log(`- ${org.name.padEnd(8)}: Chunks [${org.chunks.join(', ')}] | ${(totalBytes / (1024 * 1024)).toFixed(2)} MB total | Parallel Latency: ${maxTotal}ms (TTFB: ${maxTtfb}ms) | Edge CDN: ${allHits ? 'HIT (100%)' : 'WARMING'}`);
  }

  console.log('\n--- 3. Testing Single Organ Embed URL Query Routing ---');
  for (const org of ['heart', 'brain', 'femur', 'skull']) {
    const url = `${BASE}/?organ=${org}&isolate=true&embed=true`;
    const r = await fetchResource(url);
    console.log(`[URL Route] /?organ=${org} -> HTTP ${r.status} | TTFB: ${r.ttfb}ms | ${r.total}ms total | CDN: ${r.cache}`);
  }

  console.log('\n========================================================================================');
  console.log('  ALL LIVE ORGAN BENCHMARKS COMPLETED SUCCESSFULLY');
  console.log('========================================================================================\n');
}

main();
