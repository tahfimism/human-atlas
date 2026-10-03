import https from 'node:https';
import { performance } from 'node:perf_hooks';

function measure(url) {
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
          headers: res.headers,
          bytes,
          ttfb: Math.round(firstByte || total),
          total: Math.round(total)
        });
      });
    });
    req.on('error', (err) => resolve({ url, error: err.message }));
  });
}

async function run() {
  const tests = [
    'https://human-atlas-sage.vercel.app/',
    'https://human-atlas-sage.vercel.app/?organ=heart&isolate=true',
    'https://human-atlas-sage.vercel.app/?organ=brain&isolate=true',
    'https://human-atlas-sage.vercel.app/?organ=femur&isolate=true',
    'https://human-atlas-sage.vercel.app/models/atlas.json',
    'https://human-atlas-sage.vercel.app/models/body-8.chunk',
    'https://human-atlas-sage.vercel.app/models/body-9.chunk',
    'https://human-atlas-sage.vercel.app/models/organs/heart.glb',
    'https://human-atlas-sage.vercel.app/models/organs/brain.glb',
    'https://human-atlas-sage.vercel.app/models/organs/liver.glb',
    'https://human-atlas-sage.vercel.app/models/organs/spine.glb',
    'https://human-atlas-sage.vercel.app/models/organs/skull.glb',
    'https://human-atlas-sage.vercel.app/thumbnails/heart.webp',
    'https://human-atlas-sage.vercel.app/thumbnails/brain.webp'
  ];

  console.log('======================================================================');
  console.log('  TESTING LIVE VERCEL PRODUCTION DEPLOYMENT');
  console.log('  URL: https://human-atlas-sage.vercel.app/');
  console.log('======================================================================\n');

  console.log('--- ROUND 1 (Initial / Cold Request) ---');
  for (const t of tests) {
    const r = await measure(t);
    if (r.error) {
      console.log(`[ERR] ${t}: ${r.error}`);
    } else {
      const cache = r.headers['x-vercel-cache'] || 'MISS/NONE';
      const cors = r.headers['access-control-allow-origin'] || 'NONE';
      const csp = r.headers['content-security-policy'] ? 'frame-ancestors *' : 'NONE';
      const sizeKb = (r.bytes / 1024).toFixed(1);
      console.log(`HTTP ${r.status} | TTFB: ${r.ttfb.toString().padStart(4)}ms | Total: ${r.total.toString().padStart(4)}ms | ${sizeKb.padStart(7)} KB | Vercel Cache: ${cache.padEnd(4)} | CORS: ${cors} | ${t}`);
    }
  }

  console.log('\n--- ROUND 2 (Edge CDN Cache Warm Hit Test) ---');
  for (const t of [
    'https://human-atlas-sage.vercel.app/',
    'https://human-atlas-sage.vercel.app/models/atlas.json',
    'https://human-atlas-sage.vercel.app/models/body-8.chunk',
    'https://human-atlas-sage.vercel.app/models/organs/heart.glb',
    'https://human-atlas-sage.vercel.app/thumbnails/heart.webp'
  ]) {
    const r = await measure(t);
    const cache = r.headers['x-vercel-cache'] || 'MISS/NONE';
    const sizeKb = (r.bytes / 1024).toFixed(1);
    console.log(`HTTP ${r.status} | TTFB: ${r.ttfb.toString().padStart(4)}ms | Total: ${r.total.toString().padStart(4)}ms | ${sizeKb.padStart(7)} KB | Vercel Cache: ${cache.padEnd(4)} | ${t}`);
  }
}

run();
