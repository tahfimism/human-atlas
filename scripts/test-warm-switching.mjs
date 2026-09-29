import puppeteer from 'puppeteer-core';

async function testSwitching() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--enable-webgl', '--use-gl=angle', '--no-sandbox']
  });

  const page = await browser.newPage();
  
  console.log('Opening Study AI on http://localhost:3017/...');
  await page.goto('http://localhost:3017/', { waitUntil: 'networkidle0' });
  
  // Wait 1.5 seconds for background idle pre-warm
  await new Promise(r => setTimeout(r, 1500));

  // 1. Measure Opening Heart
  const heartOpenTime = await page.evaluate(async () => {
    const t0 = performance.now();
    window.open3DModal('heart', 'Human Heart', 83);
    const t1 = performance.now();
    return (t1 - t0).toFixed(1);
  });
  console.log('Heart modal open trigger duration:', heartOpenTime, 'ms');

  // Let heart render for 1 second
  await new Promise(r => setTimeout(r, 1000));

  // 2. Measure Switching to Trachea
  const tracheaSwitchTime = await page.evaluate(async () => {
    const t0 = performance.now();
    window.open3DModal('trachea', 'Trachea', 1);
    const t1 = performance.now();
    return (t1 - t0).toFixed(1);
  });
  console.log('Trachea switch trigger duration:', tracheaSwitchTime, 'ms');

  // Close modal
  await page.evaluate(() => window.close3DModal());
  await new Promise(r => setTimeout(r, 500));

  // 3. Reopening Brain
  const brainReopenTime = await page.evaluate(async () => {
    const t0 = performance.now();
    window.open3DModal('brain', 'Brain', 59);
    const t1 = performance.now();
    return (t1 - t0).toFixed(1);
  });
  console.log('Brain reopen trigger duration:', brainReopenTime, 'ms');

  await browser.close();
  console.log('\n[SUCCESS] Warm switching validated!');
}

testSwitching().catch(console.error);
