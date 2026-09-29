import puppeteer from 'puppeteer-core';

async function benchmark() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--enable-webgl', '--use-gl=angle', '--no-sandbox']
  });

  const page = await browser.newPage();
  
  // Track all custom marks and console logs
  const marks = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.startsWith('[BENCHMARK]')) {
      console.log(text);
      marks.push(text);
    }
  });

  // Inject performance instrumentation directly into the page before scripts execute
  await page.evaluateOnNewDocument(() => {
    const origFetch = window.fetch;
    window.fetch = async function(...args) {
      const url = typeof args[0] === 'string' ? args[0] : args[0].url;
      const t0 = performance.now();
      console.log(`[BENCHMARK] FETCH_START: ${url}`);
      const res = await origFetch.apply(this, args);
      const clone = res.clone();
      const ab = await clone.arrayBuffer();
      const t1 = performance.now();
      console.log(`[BENCHMARK] FETCH_DONE: ${url} in ${(t1 - t0).toFixed(1)}ms (${ab.byteLength} bytes)`);
      return res;
    };

    // Track DecompressionStream
    if (typeof DecompressionStream !== 'undefined') {
      const OrigDecompressionStream = window.DecompressionStream;
      window.DecompressionStream = function(format) {
        console.log(`[BENCHMARK] DECOMPRESSION_STREAM_CREATED: ${format}`);
        return new OrigDecompressionStream(format);
      };
    }
  });

  console.log('=== BENCHMARK 1: First Run (Warm Vite Server) ===');
  const tStart = Date.now();
  await page.goto('http://localhost:3016/?organ=heart&isolate=true&embed=true&view=front', { waitUntil: 'networkidle0' });
  const tEnd = Date.now();

  const clientTimings = await page.evaluate(async () => {
    // Collect paint and frame times
    const paintEntries = performance.getEntriesByType('paint');
    const nav = performance.getEntriesByType('navigation')[0];
    return {
      navDuration: nav.duration.toFixed(1),
      domInteractive: nav.domInteractive.toFixed(1),
      domContentLoaded: nav.domContentLoadedEventEnd.toFixed(1),
      firstContentfulPaint: paintEntries.find(p => p.name === 'first-contentful-paint')?.startTime.toFixed(1),
      now: performance.now().toFixed(1)
    };
  });

  console.log('Client performance metrics:', clientTimings);
  console.log('Total wall-clock time:', tEnd - tStart, 'ms');

  console.log('\n=== BENCHMARK 2: Second Run (In-Memory Browser Cache) ===');
  const tStart2 = Date.now();
  await page.reload({ waitUntil: 'networkidle0' });
  const tEnd2 = Date.now();

  const clientTimings2 = await page.evaluate(async () => {
    const paintEntries = performance.getEntriesByType('paint');
    const nav = performance.getEntriesByType('navigation')[0];
    return {
      navDuration: nav.duration.toFixed(1),
      domInteractive: nav.domInteractive.toFixed(1),
      domContentLoaded: nav.domContentLoadedEventEnd.toFixed(1),
      firstContentfulPaint: paintEntries.find(p => p.name === 'first-contentful-paint')?.startTime.toFixed(1),
      now: performance.now().toFixed(1)
    };
  });
  console.log('Client performance metrics (reload):', clientTimings2);
  console.log('Total wall-clock time (reload):', tEnd2 - tStart2, 'ms');

  await browser.close();
}

benchmark().catch(console.error);
