import puppeteer from 'puppeteer-core';

async function diagnose() {
  console.log('Launching headless Chrome to diagnose test-study-ai on port 3017...');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  page.on('console', msg => console.log(`[Browser Console ${msg.type()}]:`, msg.text()));
  page.on('pageerror', err => console.log('[Browser Uncaught Error]:', err.message));
  page.on('requestfailed', req => {
    console.log('[Network FAIL]:', req.url(), req.failure()?.errorText);
  });
  page.on('response', res => {
    if (res.status() >= 400) {
      console.log(`[Network HTTP ${res.status()}]:`, res.url());
    }
  });

  console.log('Navigating to http://localhost:3017 ...');
  await page.goto('http://localhost:3017', { waitUntil: 'networkidle2' });

  console.log('Clicking on the first organ card (Heart)...');
  await page.evaluate(() => {
    const card = document.querySelector('.organ-thumb-card');
    if (card) card.click();
    else console.log('Card not found!');
  });

  await new Promise(r => setTimeout(r, 4000));

  const modalState = await page.evaluate(() => {
    const iframe = document.getElementById('modal-iframe');
    const backdrop = document.getElementById('modal-backdrop');
    return {
      iframeSrc: iframe?.src,
      modalOpen: backdrop?.classList.contains('open')
    };
  });

  console.log('Modal State:', modalState);

  await page.screenshot({ path: 'scripts/browser-diagnosis.png' });
  console.log('Saved screenshot to scripts/browser-diagnosis.png');

  await browser.close();
}

diagnose().catch(err => {
  console.error('Diagnostic error:', err);
  process.exit(1);
});
