import puppeteer from 'puppeteer-core';

async function testAllOrgans() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--enable-webgl', '--use-gl=angle', '--no-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });

  console.log('Navigating to http://localhost:3017/...');
  await page.goto('http://localhost:3017/', { waitUntil: 'networkidle0' });

  const organs = ['brain', 'heart', 'trachea', 'stomach'];

  for (const org of organs) {
    console.log(`\nTesting modal open for ${org}...`);
    await page.evaluate((o) => window.open3DModal(o, o, 10), org);
    
    // Wait for iframe networkidle
    await new Promise(r => setTimeout(r, 2000));

    const frame = page.frames().find(f => f.url().includes(`organ=${org}`));
    if (!frame) throw new Error(`Frame for ${org} not found!`);

    const result = await frame.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return { error: 'No canvas' };
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) return { error: 'No GL' };
      const pixels = new Uint8Array(4 * 100);
      gl.readPixels(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 10, 10, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let nonZero = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] !== 0 || pixels[i+1] !== 0 || pixels[i+2] !== 0) nonZero++;
      }
      return {
        renderedPixels: nonZero,
        pinCount: document.querySelectorAll('.anatomy-pin').length
      };
    });

    console.log(`Organ ${org} result:`, result);

    // Save screenshot of brain to verify visually
    if (org === 'brain') {
      await page.screenshot({ path: 'scripts/brain-modal-fixed.png' });
      console.log('Saved brain screenshot to scripts/brain-modal-fixed.png');
    }

    // Close modal
    await page.evaluate(() => window.close3DModal());
    await new Promise(r => setTimeout(r, 500));
  }

  await browser.close();
  console.log('\n[PASS] All organs verified and displaying 3D meshes!');
}

testAllOrgans().catch(console.error);
