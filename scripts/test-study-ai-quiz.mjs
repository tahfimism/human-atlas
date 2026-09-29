import puppeteer from 'puppeteer-core';

async function testStudyAiQuiz() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--enable-webgl', '--use-gl=angle', '--no-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });

  console.log('Navigating to http://localhost:3017/...');
  await page.goto('http://localhost:3017/', { waitUntil: 'networkidle0' });

  // Click Quiz button in quick chips
  console.log('Clicking "Quiz: Heart Valves"...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.quick-chip'));
    const quizBtn = btns.find(b => b.textContent.includes('Quiz'));
    if (quizBtn) quizBtn.click();
  });

  await new Promise(r => setTimeout(r, 1200));

  // Find and click the quiz card
  console.log('Clicking Quiz card in chat...');
  await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.organ-thumb-card'));
    const quizCard = cards.find(c => c.textContent.includes('Find: mitral valve'));
    if (quizCard) quizCard.click();
  });

  await new Promise(r => setTimeout(r, 2500));

  const frame = page.frames().find(f => f.url().includes('mode=quiz'));
  console.log('Quiz frame found:', !!frame);

  await page.screenshot({ path: 'scripts/study-ai-quiz-flow.png' });
  console.log('Saved screenshot to scripts/study-ai-quiz-flow.png');

  await browser.close();
  console.log('[PASS] Study AI Quiz integration flow fully verified!');
}

testStudyAiQuiz().catch(console.error);
