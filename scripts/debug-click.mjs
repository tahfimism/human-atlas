import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function testClick() {
  console.log('Testing part click in headless Chrome...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--enable-webgl', '--use-gl=angle', '--no-sandbox']
  });

  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log(`[BROWSER ${msg.type().toUpperCase()}]:`, msg.text());
  });

  page.on('pageerror', err => {
    console.error('[BROWSER PAGE ERROR]:', err);
  });

  console.log('Loading heart in isolate embed mode...');
  await page.goto('http://localhost:3016/?organ=heart&isolate=true&embed=true', { waitUntil: 'networkidle0' });

  await new Promise(r => setTimeout(r, 1000));
  console.log('Clicking the center of the canvas...');
  
  // Click at the center of the 3D canvas (where the heart mesh is located)
  const canvas = await page.$('canvas');
  if (canvas) {
    const box = await canvas.boundingBox();
    console.log('Canvas bounding box:', box);
    // Click near center
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    console.log('Mouse clicked! Waiting 2 seconds to see if it freezes or throws error...');
    await new Promise(r => setTimeout(r, 2000));
  } else {
    console.log('Canvas not found!');
  }

  // Also test clicking in the modal inside Study AI on 3017
  console.log('\n--- Now testing inside Study AI on port 3017 ---');
  await page.goto('http://localhost:3017/', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));
  
  console.log('Opening 3D Modal for heart...');
  await page.evaluate(() => {
    window.open3DModal('heart', 'Human Heart', 83);
  });
  await new Promise(r => setTimeout(r, 2000));

  console.log('Clicking inside modal iframe...');
  const frames = page.frames();
  console.log('Total frames:', frames.length);
  for (const f of frames) {
    console.log('Frame URL:', f.url());
  }

  const modalFrame = frames.find(f => f.url().includes('organ=heart'));
  if (modalFrame) {
    console.log('Found modal frame, clicking canvas inside iframe...');
    const iframeCanvas = await modalFrame.$('canvas');
    if (iframeCanvas) {
      const ibox = await iframeCanvas.boundingBox();
      console.log('Iframe canvas box:', ibox);
      if (ibox) {
        await page.mouse.click(ibox.x + ibox.width / 2, ibox.y + ibox.height / 2);
        console.log('Clicked inside iframe canvas! Waiting 2 seconds...');
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  console.log('Done testing!');
  await browser.close();
}

testClick().catch(console.error);
