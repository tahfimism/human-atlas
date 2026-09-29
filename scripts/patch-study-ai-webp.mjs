import fs from 'node:fs';

let c = fs.readFileSync('test-study-ai/index.html', 'utf8');

// 1. Add CSS for img
const cssTarget = '.thumb-preview-box iframe {';
const cssReplace = `.thumb-preview-box img {
      max-width: 86%;
      max-height: 86%;
      object-fit: contain;
      filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.5));
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      user-select: none;
      pointer-events: none;
    }
    .organ-thumb-card:hover .thumb-preview-box img {
      transform: scale(1.08);
    }
    .thumb-preview-box iframe {`;

if (!c.includes('.thumb-preview-box img')) {
  c = c.replace(cssTarget, cssReplace);
}

// 2. Add mode toggle button to header
if (!c.includes('toggle-mode-btn')) {
  c = c.replace(
    '<button class="nova-btn">Humanizer</button>',
    '<button class="nova-btn" id="toggle-mode-btn" onclick="toggleCardMode()" title="Switch between static WebP (0ms) and live 3D">⚡ WebP (0ms)</button>'
  );
}

// 3. Update welcome cards to use webp
['heart', 'trachea', 'brain', 'stomach', 'femur'].forEach(org => {
  const iframeStr = `<iframe src="http://localhost:3016/?organ=${org}&isolate=true&embed=true&mini=true&rotate=true"></iframe>`;
  c = c.replace(iframeStr, `<img src="/thumbnails/${org}.webp" alt="${org}" loading="lazy">`);
});
c = c.replace(/<span class="thumb-badge">3D<\/span>/g, '<span class="thumb-badge">⚡ 3D</span>');

// 4. Update JS for thumbnailMode and toggleCardMode
if (!c.includes('let thumbnailMode')) {
  const jsTarget = 'let sliderCounter = 0;';
  const jsReplace = `let sliderCounter = 0;
    let thumbnailMode = 'webp'; // 'webp' | '3d'
    const activeSliders = new Map();

    function renderCardHtml(orgKey) {
      const info = ORGAN_REGISTRY[orgKey] || { title: orgKey, icon: '🫀', count: 1, system: 'Anatomy' };
      const preview = thumbnailMode === 'webp'
        ? \`<img src="/thumbnails/\${orgKey}.webp" alt="\${info.title}" loading="lazy"><span class="thumb-badge">⚡ 3D</span>\`
        : \`<iframe src="http://localhost:3016/?organ=\${orgKey}&isolate=true&embed=true&mini=true&rotate=true"></iframe><span class="thumb-badge">3D</span>\`;
      return \`
        <div class="organ-thumb-card" onclick="open3DModal('\${orgKey}', '\${info.title}', \${info.count})">
          <div class="thumb-preview-box">\${preview}</div>
          <div class="thumb-card-body">
            <div class="thumb-card-title">\${info.icon} \${info.title}</div>
            <div class="thumb-card-meta">
              <span>\${info.count} \${info.count === 1 ? 'part' : 'parts'}</span>
              <span class="thumb-card-arrow">↗</span>
            </div>
          </div>
        </div>
      \`;
    }

    function toggleCardMode() {
      thumbnailMode = (thumbnailMode === 'webp') ? '3d' : 'webp';
      const btn = document.getElementById('toggle-mode-btn');
      if (btn) btn.textContent = (thumbnailMode === 'webp') ? '⚡ WebP (0ms)' : '🌐 Live 3D';
      
      const welcomeSlider = document.getElementById('slider-welcome');
      if (welcomeSlider) {
        welcomeSlider.innerHTML = ['heart', 'trachea', 'brain', 'stomach', 'femur'].map(renderCardHtml).join('');
      }
      activeSliders.forEach((organs, id) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = organs.map(renderCardHtml).join('');
      });
    }`;
  c = c.replace(jsTarget, jsReplace);
}

// 5. Update respondWithSlider to use renderCardHtml and record activeSliders
const respTarget = 'const cardsHtml = organsList.map(orgKey => {';
const respEnd = '}).join(\'\');';
const respIdx1 = c.indexOf(respTarget);
const respIdx2 = c.indexOf(respEnd, respIdx1);
if (respIdx1 !== -1 && respIdx2 !== -1) {
  c = c.substring(0, respIdx1) + 'activeSliders.set(sliderId, organsList);\n      const cardsHtml = organsList.map(renderCardHtml).join(\'\');' + c.substring(respIdx2 + respEnd.length);
}

fs.writeFileSync('test-study-ai/index.html', c, 'utf8');
console.log('Successfully updated test-study-ai/index.html with WebP integration!');
