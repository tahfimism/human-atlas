import puppeteer from 'puppeteer-core';

async function profile() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--enable-webgl', '--use-gl=angle', '--no-sandbox']
  });

  const page = await browser.newPage();
  
  // Track console logs and timing
  const logs = [];
  page.on('console', msg => logs.push(msg.text()));

  // Inject performance marks in the page
  await page.evaluateOnNewDocument(() => {
    window.__TIMINGS__ = {};
    const origFetch = window.fetch;
    window.fetch = async function(...args) {
      const url = typeof args[0] === 'string' ? args[0] : args[0].url;
      const t0 = performance.now();
      const res = await origFetch.apply(this, args);
      const clone = res.clone();
      const blob = await clone.blob();
      const t1 = performance.now();
      window.__TIMINGS__['fetch_' + url.split('/').pop()] = {
        durationMs: (t1 - t0).toFixed(1),
        bytes: blob.size,
        fromCache: t1 - t0 < 5
      };
      return res;
    };
  });

  console.log('--- TEST 1: Cold Load (http://localhost:3016/?organ=heart&isolate=true&embed=true&view=front) ---');
  const t0_nav = Date.now();
  await page.goto('http://localhost:3016/?organ=heart&isolate=true&embed=true&view=front', { waitUntil: 'networkidle0' });
  const t1_nav = Date.now();

  const perfMetrics1 = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    return {
      fetchTimings: window.__TIMINGS__,
      navTiming: {
        dnsMs: (nav.domainLookupEnd - nav.domainLookupStart).toFixed(1),
        connectMs: (nav.connectEnd - nav.connectStart).toFixed(1),
        ttfbMs: (nav.responseStart - nav.requestStart).toFixed(1),
        domInteractiveMs: (nav.domInteractive - nav.startTime).toFixed(1),
        domContentLoadedMs: (nav.domContentLoadedEventEnd - nav.startTime).toFixed(1),
        loadEventEndMs: (nav.loadEventEnd - nav.startTime).toFixed(1),
      }
    };
  });

  console.log('Total navigation to networkidle0:', t1_nav - t0_nav, 'ms');
  console.log('Navigation metrics:', perfMetrics1.navTiming);
  console.log('Resource fetch timings:', perfMetrics1.fetchTimings);

  console.log('\n--- TEST 2: Warm Reload (Same Page, Browser Cache Active) ---');
  const t0_reload = Date.now();
  await page.reload({ waitUntil: 'networkidle0' });
  const t1_reload = Date.now();

  const perfMetrics2 = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    return {
      fetchTimings: window.__TIMINGS__,
      navTiming: {
        ttfbMs: (nav.responseStart - nav.requestStart).toFixed(1),
        domInteractiveMs: (nav.domInteractive - nav.startTime).toFixed(1),
        domContentLoadedMs: (nav.domContentLoadedEventEnd - nav.startTime).toFixed(1),
        loadEventEndMs: (nav.loadEventEnd - nav.startTime).toFixed(1),
      }
    };
  });
  console.log('Total warm reload to networkidle0:', t1_reload - t0_reload, 'ms');
  console.log('Navigation metrics:', perfMetrics2.navTiming);
  console.log('Resource fetch timings:', perfMetrics2.fetchTimings);

  console.log('\n--- TEST 3: Inside Study AI (Port 3017) Modal Open Timing ---');
  await page.goto('http://localhost:3017/', { waitUntil: 'networkidle0' });
  
  // Measure open3DModal
  const modalTiming = await page.evaluate(async () => {
    const t0 = performance.now();
    window.open3DModal('heart', 'Human Heart', 83);
    
    // Wait until iframe posts EVT_SCENE_READY
    const readyPromise = new Promise(resolve => {
      const handler = (e) => {
        if (e.data?.type === 'EVT_SCENE_READY' || e.data?.type === 'READY') {
          window.removeEventListener('message', handler);
          resolve(performance.now());
        }
      };
      window.addEventListener('message', handler);
      // Fallback timeout
      setTimeout(() => resolve(performance.now()), 3000);
    });

    const tReady = await readyPromise;
    return {
      openToReadyMs: (tReady - t0).toFixed(1)
    };
  });

  console.log('Modal trigger to 3D scene ready:', modalTiming);

  await browser.close();
}

profile().catch(console.error);
