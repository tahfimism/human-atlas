import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ORGANS = ['heart', 'trachea', 'brain', 'stomach', 'femur', 'liver'];

async function run() {
  console.log('Launching Chrome to capture high-res organ WebP snapshots...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--enable-webgl', '--use-gl=angle', '--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 284, height: 184, deviceScaleFactor: 2 });

  fs.mkdirSync('public/thumbnails', { recursive: true });
  fs.mkdirSync('test-study-ai/thumbnails', { recursive: true });

  for (const organ of ORGANS) {
    process.stdout.write(`Rendering 3D model: ${organ}... `);
    const url = `http://localhost:3016/?organ=${organ}&isolate=true&embed=true&mini=true&transparent=true`;
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

    // Wait for the WebGL canvas to finish rendering the organ
    await page.waitForFunction(() => {
      const c = document.querySelector('canvas');
      return c && c.width > 0;
    }, { timeout: 15000 });

    // Allow frames to settle
    await new Promise(r => setTimeout(r, 800));

    // Extract canvas as high-quality transparent WebP
    const dataUrl = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      return canvas ? canvas.toDataURL('image/webp', 0.92) : null;
    });

    if (dataUrl && dataUrl.startsWith('data:image/webp')) {
      const base64 = dataUrl.replace(/^data:image\/webp;base64,/, '');
      const buffer = Buffer.from(base64, 'base64');
      fs.writeFileSync(`public/thumbnails/${organ}.webp`, buffer);
      fs.writeFileSync(`test-study-ai/thumbnails/${organ}.webp`, buffer);
      console.log(`✓ Saved ${organ}.webp (${(buffer.length / 1024).toFixed(1)} KB)`);
    } else {
      console.log(`⚠ Canvas capture failed, falling back to page screenshot.`);
      const pngBuffer = await page.screenshot({ type: 'png', omitBackground: true });
      fs.writeFileSync(`public/thumbnails/${organ}.png`, pngBuffer);
      fs.writeFileSync(`test-study-ai/thumbnails/${organ}.png`, pngBuffer);
    }
  }

  await browser.close();
  console.log('\n✓ All organ thumbnails captured successfully in public/thumbnails and test-study-ai/thumbnails!');
}

run().catch(err => {
  console.error('Snapshot generator error:', err);
  process.exit(1);
});
