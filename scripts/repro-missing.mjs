import puppeteer from 'puppeteer-core';

async function repro() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--enable-webgl', '--use-gl=angle', '--no-sandbox']
  });

  const page = await browser.newPage();
  
  // Track console logs
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  console.log('Navigating to http://localhost:3017/...');
  await page.goto('http://localhost:3017/', { waitUntil: 'networkidle0' });

  await new Promise(r => setTimeout(r, 1000));

  console.log('Opening Brain modal...');
  await page.evaluate(() => window.open3DModal('brain', 'Brain', 59));

  await new Promise(r => setTimeout(r, 2000));

  // Check what iframe contains
  const frame = page.frames().find(f => f.url().includes('3016'));
  if (!frame) {
    console.log('No iframe found!');
  } else {
    const frameInfo = await frame.evaluate(() => {
      const meshes = [];
      window.__SCENE__?.traverse(obj => {
        if (obj.isMesh && obj.geometry) {
          meshes.push({
            name: obj.name,
            vertices: obj.geometry.attributes.position?.count
          });
        }
      });
      return {
        url: window.location.href,
        canvasVisible: !!document.querySelector('canvas'),
        pinCount: document.querySelectorAll('.anatomy-pin').length,
        text: document.body.innerText
      };
    });
    console.log('Iframe info:', frameInfo);
  }

  await browser.close();
}

repro().catch(console.error);
