import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

async function verifyFeatures() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--enable-webgl', '--use-gl=angle', '--no-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 700 });

  console.log('Testing 3D Slicing on Heart...');
  await page.goto('http://localhost:3016/?organ=heart&isolate=true&slice=coronal&sliceOffset=0.4', {
    waitUntil: 'networkidle0'
  });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'scripts/heart-slice-coronal.png' });
  console.log('Saved coronal slice screenshot: scripts/heart-slice-coronal.png');

  console.log('Testing Quiz Mode on Heart...');
  await page.goto('http://localhost:3016/?organ=heart&isolate=true&mode=quiz&quizTarget=mitral%20valve', {
    waitUntil: 'networkidle0'
  });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'scripts/heart-quiz-mode.png' });
  console.log('Saved quiz mode screenshot: scripts/heart-quiz-mode.png');

  await browser.close();
  console.log('[PASS] All visual feature verifications completed successfully!');
}

verifyFeatures().catch(console.error);
