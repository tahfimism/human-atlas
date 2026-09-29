import puppeteer from 'puppeteer-core';

async function breakdown() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--enable-webgl', '--use-gl=angle', '--no-sandbox']
  });

  const page = await browser.newPage();
  
  // Track console logs
  page.on('console', msg => {
    const text = msg.text();
    if (text.startsWith('[BENCH]')) {
      console.log(text);
    }
  });

  await page.evaluateOnNewDocument(() => {
    const origPerformance = window.performance;
    window.__BENCH__ = {};
    
    // Intercept DecompressionStream
    if (typeof DecompressionStream !== 'undefined') {
      const OrigDS = window.DecompressionStream;
      window.DecompressionStream = function(format) {
        console.log(`[BENCH] DecompressionStream started (${format})`);
        return new OrigDS(format);
      };
    }
  });

  console.log('Navigating to http://localhost:3016/?organ=heart&isolate=true&embed=true&view=front...');
  await page.goto('http://localhost:3016/?organ=heart&isolate=true&embed=true&view=front', { waitUntil: 'networkidle0' });

  // Now measure with precise in-page performance marks
  const inPageTimings = await page.evaluate(async () => {
    const t0 = performance.now();
    
    // 1. Measure DecompressionStream on chunk 8
    const rChunk8 = await fetch('/models/body-8.chunk');
    const blob8 = await rChunk8.blob();
    const tDec0 = performance.now();
    const decStream = new DecompressionStream('gzip');
    const decompressedBuf = await new Response(blob8.stream().pipeThrough(decStream)).arrayBuffer();
    const tDec1 = performance.now();
    const decompressMs = tDec1 - tDec0;

    // 2. Measure JSON.parse on atlas.json
    const rAtlas = await fetch('/models/atlas.json');
    const atlasText = await rAtlas.text();
    const tJson0 = performance.now();
    const atlas = JSON.parse(atlasText);
    const tJson1 = performance.now();
    const jsonParseMs = tJson1 - tJson0;

    return {
      atlasJsonSizeBytes: atlasText.length,
      jsonParseMs: jsonParseMs.toFixed(1),
      chunk8GzipBytes: blob8.size,
      chunk8RawBytes: decompressedBuf.byteLength,
      decompressMs: decompressMs.toFixed(1),
    };
  });

  console.log('Internal In-Page Benchmark Results:');
  console.log(inPageTimings);

  await browser.close();
}

breakdown().catch(console.error);
