/**
 * Test Suite for AnatomyStreamParser and FMAConceptResolver
 * Run with: node scripts/test-parser.mjs
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

// Handle direct Node execution without --experimental-strip-types
let parserModule;
try {
  parserModule = await import('../lib/anatomy-stream-parser.ts');
} catch (err) {
  if (err.code === 'ERR_UNKNOWN_FILE_EXTENSION' && !process.env.TEST_PARSER_REEXEC) {
    const scriptPath = fileURLToPath(import.meta.url);
    const result = spawnSync(
      process.execPath,
      ['--experimental-strip-types', scriptPath, ...process.argv.slice(2)],
      {
        stdio: 'inherit',
        env: { ...process.env, TEST_PARSER_REEXEC: '1' },
      }
    );
    process.exit(result.status ?? 0);
  }
  throw err;
}

const { AnatomyStreamParser, FMAConceptResolver } = parserModule;

let passedTests = 0;
let totalTests = 0;

function runTest(testName, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  \x1b[32m✔\x1b[0m ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  \x1b[31m✖\x1b[0m ${testName}`);
    console.error(`    \x1b[31m${err.message}\x1b[0m`);
    if (err.stack) {
      const relevantStack = err.stack.split('\n').slice(1, 4).join('\n');
      console.error(`    \x1b[90m${relevantStack}\x1b[0m`);
    }
  }
}

console.log('\n\x1b[1m=== Human Atlas PRD-02 Streaming Parser & Concept Resolver Tests ===\x1b[0m\n');

// ===========================================================================
// Test Group 1: Single Organ Parsing (Pattern A)
// ===========================================================================
console.log('\x1b[36m--- Group 1: Single Organ Parsing (Pattern A) ---\x1b[0m');

runTest('Parses standard YAML Pattern A single organ block', () => {
  const parser = new AnatomyStreamParser();
  const input = `
Here is the cardiac anatomy:
\`\`\`anatomy
organ: heart
isolate: true
view: front
highlight: ["mitral valve", "left ventricle"]
autoRotate: false
caption: "Anterior view of the heart isolating left-side flow structures."
explode: 0.25
\`\`\`
Hope this helps!
`;
  const state = parser.processToken(input);
  assert.equal(state.status, 'ready');
  assert.equal(state.payload.organ, 'heart');
  assert.equal(state.payload.isolate, true);
  assert.equal(state.payload.view, 'front');
  assert.deepEqual(state.payload.highlight, ['mitral valve', 'left ventricle']);
  assert.equal(state.payload.autoRotate, false);
  assert.equal(
    state.payload.caption,
    'Anterior view of the heart isolating left-side flow structures.'
  );
  assert.equal(state.payload.explode, 0.25);
  assert.ok(state.rawContent.includes('organ: heart'));
});

runTest('Parses JSON single organ block', () => {
  const parser = new AnatomyStreamParser();
  const input = `
\`\`\`anatomy
{
  "organ": "brain",
  "isolate": true,
  "view": "three-quarter",
  "highlight": ["hippocampus"],
  "caption": "Brain parenchyma with medial temporal lobe"
}
\`\`\`
`;
  const state = parser.processToken(input);
  assert.equal(state.status, 'ready');
  assert.equal(state.payload.organ, 'brain');
  assert.equal(state.payload.view, 'three-quarter');
  assert.deepEqual(state.payload.highlight, ['hippocampus']);
});

runTest('Handles loosely-typed YAML (unquoted arrays, colons in caption)', () => {
  const parser = new AnatomyStreamParser();
  const input = `
\`\`\`anatomy
organ: femur
view: side
highlight: [femoral head, greater trochanter]
caption: Lateral view: showing proximal articulatory surface
\`\`\`
`;
  const state = parser.processToken(input);
  assert.equal(state.status, 'ready');
  assert.equal(state.payload.organ, 'femur');
  assert.equal(state.payload.view, 'side');
  assert.deepEqual(state.payload.highlight, ['femoral head', 'greater trochanter']);
  assert.equal(
    state.payload.caption,
    'Lateral view: showing proximal articulatory surface'
  );
});

// ===========================================================================
// Test Group 2: Multi-Organ Slider Parsing (Pattern B)
// ===========================================================================
console.log('\n\x1b[36m--- Group 2: Multi-Organ Slider Parsing (Pattern B) ---\x1b[0m');

runTest('Parses YAML Pattern B multi-organ slider with list items', () => {
  const parser = new AnatomyStreamParser();
  const input = `
\`\`\`anatomy
view: front
items:
  - organ: heart
    caption: "Muscular pump (83 pieces)"
    highlight: ["mitral valve"]
    partsCount: 83
  - organ: trachea
    caption: "Cartilaginous airway (32 pieces)"
    partsCount: 32
  - organ: lungs
    caption: "Gas exchange parenchyma"
\`\`\`
`;
  const state = parser.processToken(input);
  assert.equal(state.status, 'ready');
  assert.equal(state.payload.view, 'front');
  assert.ok(Array.isArray(state.payload.items));
  assert.equal(state.payload.items.length, 3);

  const [item1, item2, item3] = state.payload.items;
  assert.equal(item1.organ, 'heart');
  assert.equal(item1.caption, 'Muscular pump (83 pieces)');
  assert.deepEqual(item1.highlight, ['mitral valve']);
  assert.equal(item1.partsCount, 83);

  assert.equal(item2.organ, 'trachea');
  assert.equal(item2.caption, 'Cartilaginous airway (32 pieces)');
  assert.equal(item2.partsCount, 32);

  assert.equal(item3.organ, 'lungs');
  assert.equal(item3.caption, 'Gas exchange parenchyma');
});

runTest('Parses JSON multi-organ slider items', () => {
  const parser = new AnatomyStreamParser();
  const input = `
\`\`\`anatomy
{
  "view": "front",
  "items": [
    { "organ": "heart", "caption": "Pump" },
    { "organ": "liver", "caption": "Metabolic organ" }
  ]
}
\`\`\`
`;
  const state = parser.processToken(input);
  assert.equal(state.status, 'ready');
  assert.equal(state.payload.items.length, 2);
  assert.equal(state.payload.items[0].organ, 'heart');
  assert.equal(state.payload.items[1].organ, 'liver');
});

// ===========================================================================
// Test Group 3: Token-by-Token Streaming Simulation
// ===========================================================================
console.log('\n\x1b[36m--- Group 3: Token-by-Token Streaming Simulation ---\x1b[0m');

runTest('Simulates 1-2 char token streaming across block boundaries', () => {
  const parser = new AnatomyStreamParser();
  const fullText =
    'Introductory text...\n\n```anatomy\norgan: trachea\nisolate: true\nview: front\n```\n\nFollow-up text.';

  // Break text into fine-grained 1-2 char chunks
  const chunks = [];
  let i = 0;
  while (i < fullText.length) {
    const chunkSize = (i % 2 === 0) ? 2 : 1;
    chunks.push(fullText.slice(i, i + chunkSize));
    i += chunkSize;
  }

  let sawStreaming = false;
  let sawSkeleton = false;
  let readyState = null;
  let postBlockCount = 0;

  for (const chunk of chunks) {
    const state = parser.processToken(chunk);

    if (state.status === 'streaming') {
      sawStreaming = true;
      if (state.skeleton) sawSkeleton = true;
      assert.ok(typeof state.partialBuffer === 'string');
    } else if (state.status === 'ready') {
      readyState = state;
      postBlockCount++;
    }
  }

  assert.ok(sawStreaming, 'Should have entered streaming state during generation');
  assert.ok(sawSkeleton, 'Should have flagged skeleton: true while streaming');
  assert.ok(readyState, 'Should have finalized to ready state');
  assert.equal(readyState.status, 'ready');
  assert.equal(readyState.payload.organ, 'trachea');
  assert.equal(readyState.payload.isolate, true);
  assert.equal(readyState.payload.view, 'front');
  assert.ok(postBlockCount > 5, 'Should persist ready state for subsequent tokens');
});

// ===========================================================================
// Test Group 4: Slicing, Quiz, and Annotations Attributes
// ===========================================================================
console.log('\n\x1b[36m--- Group 4: Slicing, Quiz, and Annotations Attributes ---\x1b[0m');

runTest('Parses cross-sectional slicing attributes (coronal, axial, sagittal)', () => {
  const parser = new AnatomyStreamParser();
  const input = `
\`\`\`anatomy
organ: heart
slice: coronal
sliceOffset: 0.05
highlight: ["mitral valve", "interventricular septum"]
caption: "Coronal cross-section revealing internal cardiac chambers"
\`\`\`
`;
  const state = parser.processToken(input);
  assert.equal(state.status, 'ready');
  assert.equal(state.payload.organ, 'heart');
  assert.equal(state.payload.slice, 'coronal');
  assert.equal(state.payload.sliceOffset, 0.05);
  assert.deepEqual(state.payload.highlight, ['mitral valve', 'interventricular septum']);
});

runTest('Parses interactive quiz mode attributes', () => {
  const parser = new AnatomyStreamParser();
  const input = `
\`\`\`anatomy
organ: heart
mode: quiz
quizTarget: Superior vena cava
quizPrompt: Tap the vein that returns blood from the upper body to the right atrium.
\`\`\`
`;
  const state = parser.processToken(input);
  assert.equal(state.status, 'ready');
  assert.equal(state.payload.organ, 'heart');
  assert.equal(state.payload.mode, 'quiz');
  assert.equal(state.payload.quizTarget, 'Superior vena cava');
  assert.equal(
    state.payload.quizPrompt,
    'Tap the vein that returns blood from the upper body to the right atrium.'
  );
});

runTest('Parses 3D callout annotations list', () => {
  const parser = new AnatomyStreamParser();
  const input = `
\`\`\`anatomy
organ: heart
annotations:
  - target: "aorta"
    text: "Carries oxygenated blood to systemic circulation"
  - target: "pulmonary trunk"
    text: "Routes deoxygenated blood to lungs"
\`\`\`
`;
  const state = parser.processToken(input);
  assert.equal(state.status, 'ready');
  assert.equal(state.payload.organ, 'heart');
  assert.ok(Array.isArray(state.payload.annotations));
  assert.equal(state.payload.annotations.length, 2);
  assert.equal(state.payload.annotations[0].target, 'aorta');
  assert.equal(
    state.payload.annotations[0].text,
    'Carries oxygenated blood to systemic circulation'
  );
  assert.equal(state.payload.annotations[1].target, 'pulmonary trunk');
  assert.equal(
    state.payload.annotations[1].text,
    'Routes deoxygenated blood to lungs'
  );
});

// ===========================================================================
// Test Group 5: Fuzzy Concept Resolver (FMAConceptResolver)
// ===========================================================================
console.log('\n\x1b[36m--- Group 5: Fuzzy Concept Resolver (FMAConceptResolver) ---\x1b[0m');

runTest('Resolves common anatomical aliases to canonical names', () => {
  const cases = [
    { input: 'windpipe', expected: 'trachea' },
    { input: 'heart', expected: 'heart' },
    { input: 'thigh bone', expected: 'femur' },
    { input: 'skull', expected: 'skull' },
    { input: 'left ventricle', expected: 'left ventricle' },
    { input: 'collarbone', expected: 'clavicle' },
    { input: 'kneecap', expected: 'patella' },
    { input: 'shinbone', expected: 'tibia' },
    { input: 'voicebox', expected: 'larynx' },
    { input: 'belly', expected: 'stomach' },
  ];

  for (const { input, expected } of cases) {
    const res = FMAConceptResolver.resolve(input);
    assert.equal(res.canonical, expected, `Failed resolving '${input}' -> '${expected}'`);
    assert.equal(res.matched, true);
    assert.ok(res.score >= 0.7);

    // Test resolveCanonical helper
    const canonicalStr = FMAConceptResolver.resolveCanonical(input);
    assert.equal(canonicalStr, expected);
  }
});

runTest('Resolves FMA IDs correctly', () => {
  const cases = [
    { id: 'FMA7088', expected: 'heart' },
    { id: 'fma7088', expected: 'heart' },
    { id: 'FMA_7088', expected: 'heart' },
    { id: 'FMA50801', expected: 'brain' },
    { id: 'FMA7394', expected: 'trachea' },
    { id: 'FMA9611', expected: 'femur' },
    { id: 'FMA7148', expected: 'stomach' },
    { id: 'FMA5018', expected: 'skull' },
  ];

  for (const { id, expected } of cases) {
    const res = FMAConceptResolver.resolve(id);
    assert.equal(res.canonical, expected, `Failed resolving FMA ID '${id}'`);
    assert.equal(res.matched, true);

    const fmaDirect = FMAConceptResolver.resolveFma(id);
    assert.equal(fmaDirect, expected);
  }
});

runTest('Performs fuzzy typo matching with high similarity', () => {
  const typoCases = [
    { input: 'wind-pipe', expected: 'trachea' },
    { input: 'thighbone', expected: 'femur' },
    { input: 'skul', expected: 'skull' },
    { input: 'left ventricl', expected: 'left ventricle' },
    { input: 'haert', expected: 'heart' },
  ];

  for (const { input, expected } of typoCases) {
    const res = FMAConceptResolver.resolve(input);
    assert.equal(
      res.canonical,
      expected,
      `Fuzzy match failed for '${input}' (got '${res.canonical}', expected '${expected}')`
    );
    assert.equal(res.matched, true);
  }
});

runTest('Integrates concept resolution in AnatomyStreamParser when enabled', () => {
  const parser = new AnatomyStreamParser({ resolveConcepts: true });
  const input = `
\`\`\`anatomy
organ: windpipe
items:
  - organ: thigh bone
  - organ: FMA7088
\`\`\`
`;
  const state = parser.processToken(input);
  assert.equal(state.status, 'ready');
  assert.equal(state.payload.organ, 'trachea');
  assert.equal(state.payload.items[0].organ, 'femur');
  assert.equal(state.payload.items[1].organ, 'heart');
});

// ===========================================================================
// Test Group 6: Malformed Block Recovery & Syntax Tolerance
// ===========================================================================
console.log('\n\x1b[36m--- Group 6: Malformed Block Recovery & Syntax Tolerance ---\x1b[0m');

runTest('Returns status error on block missing organ and items', () => {
  const parser = new AnatomyStreamParser();
  const input = `
\`\`\`anatomy
isolate: true
view: front
caption: Missing organ completely
\`\`\`
`;
  const state = parser.processToken(input);
  assert.equal(state.status, 'error');
  assert.ok(state.message.includes('organ') || state.message.includes('items'));
  assert.ok(typeof state.rawContent === 'string');
});

runTest('Recovers cleanly after parser.reset()', () => {
  const parser = new AnatomyStreamParser();

  // 1. Send malformed block
  const badInput = '```anatomy\ninvalid corrupted text without fields\n```';
  const badState = parser.processToken(badInput);
  assert.equal(badState.status, 'error');

  // 2. Reset parser state
  parser.reset();
  assert.equal(parser.getBuffer(), '');

  // 3. Send valid block
  const goodInput = '```anatomy\norgan: liver\nisolate: true\n```';
  const goodState = parser.processToken(goodInput);
  assert.equal(goodState.status, 'ready');
  assert.equal(goodState.payload.organ, 'liver');
  assert.equal(goodState.payload.isolate, true);
});

runTest('Tolerates trailing commas and messy formatting in JSON and YAML', () => {
  const parser = new AnatomyStreamParser();
  const input = `
\`\`\`anatomy
{
  "organ": "heart",
  "highlight": ["mitral valve", "left ventricle",],
  "view": "front",
}
\`\`\`
`;
  const state = parser.processToken(input);
  assert.equal(state.status, 'ready');
  assert.equal(state.payload.organ, 'heart');
  assert.deepEqual(state.payload.highlight, ['mitral valve', 'left ventricle']);
  assert.equal(state.payload.view, 'front');
});

// ===========================================================================
// Test Summary
// ===========================================================================
console.log('\n-------------------------------------------------------------');
if (passedTests === totalTests) {
  console.log(`\x1b[32m\x1b[1mSUCCESS: All ${totalTests}/${totalTests} tests passed (0 failures)!\x1b[0m\n`);
  process.exit(0);
} else {
  console.error(`\x1b[31m\x1b[1mFAILURE: ${totalTests - passedTests}/${totalTests} tests failed!\x1b[0m\n`);
  process.exit(1);
}
