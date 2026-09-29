import puppeteer from 'puppeteer-core';

async function breakdownThree() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--enable-webgl', '--use-gl=angle', '--no-sandbox']
  });

  const page = await browser.newPage();
  
  await page.goto('http://localhost:3016/?organ=heart&isolate=true&embed=true&view=front', { waitUntil: 'networkidle0' });

  // Measure Three.js operations directly in the browser context
  const threeTimings = await page.evaluate(async () => {
    const THREE = window.__THREE__ || (await import('/node_modules/.vite/deps/three.js?v=test').catch(() => null));
    // Let's test the Three.js operations:
    const t0 = performance.now();
    
    // Test PMREMGenerator
    const canvas = document.createElement('canvas');
    canvas.width = 400; canvas.height = 400;
    const gl = canvas.getContext('webgl2');
    
    return {
      glVendor: gl ? gl.getParameter(gl.RENDERER) : 'unknown',
      glVersion: gl ? gl.getParameter(gl.VERSION) : 'unknown'
    };
  });

  console.log('WebGL Info:', threeTimings);
  await browser.close();
}

breakdownThree().catch(console.error);
