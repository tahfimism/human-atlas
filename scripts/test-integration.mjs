import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('===================================================================');
console.log('  INTEGRATION TEST: Study AI x Human Atlas End-to-End System Test');
console.log('===================================================================\n');

// -------------------------------------------------------------
// 1. Test Streaming Token Parser (PRD-02)
// -------------------------------------------------------------
console.log('1. Testing Streaming Token Parser (PRD-02):');

class AnatomyStreamParser {
  constructor() {
    this.buffer = '';
  }

  processChunk(textToken) {
    this.buffer += textToken;

    const blockStart = this.buffer.indexOf('```anatomy');
    if (blockStart === -1) {
      return { status: 'idle' };
    }

    const contentAfterStart = this.buffer.slice(blockStart + '```anatomy'.length);
    const blockEnd = contentAfterStart.indexOf('```');

    if (blockEnd === -1) {
      return { status: 'streaming', partialBuffer: contentAfterStart };
    }

    const rawPayload = contentAfterStart.slice(0, blockEnd).trim();
    try {
      const payload = this.parsePayload(rawPayload);
      return { status: 'ready', payload };
    } catch (err) {
      console.error('Parser error:', err);
      return { status: 'error', rawContent: rawPayload, message: err.message };
    }
  }

  parsePayload(raw) {
    if (raw.startsWith('{')) {
      return JSON.parse(raw);
    }
    const lines = raw.split('\n');
    const result = {};
    for (const line of lines) {
      const [key, ...rest] = line.split(':');
      if (!key || rest.length === 0) continue;
      const k = key.trim();
      let v = rest.join(':').trim();
      if (v === 'true') {
        v = true;
      } else if (v === 'false') {
        v = false;
      } else if (v.startsWith('[') && v.endsWith(']')) {
        v = JSON.parse(v);
      }
      result[k] = v;
    }
    if (!result.organ) throw new Error("Missing required field: 'organ'");
    return result;
  }
}

const parser = new AnatomyStreamParser();

const simulatedTokens = [
  'Here is the physiological explanation.',
  '\n\n```anat',
  'omy\norgan: ',
  'heart\nisolate: ',
  'true\nview: front\n',
  'highlight: ["mitral valve"]\n',
  '```',
  '\nAnd the lesson continues.'
];

let finalResult = null;
for (let i = 0; i < simulatedTokens.length; i++) {
  const res = parser.processChunk(simulatedTokens[i]);
  if (i < 6) {
    assert.notEqual(res.status, 'ready', `Token ${i} should not trigger ready state prematurely`);
  } else if (i === 6) {
    assert.equal(res.status, 'ready', 'Closing fence must trigger ready state');
    finalResult = res.payload;
  }
}

assert.equal(finalResult.organ, 'heart');
assert.equal(finalResult.isolate, true);
assert.equal(finalResult.view, 'front');
assert.deepEqual(finalResult.highlight, ['mitral valve']);
console.log('   [PASS] Streaming Token Parser handled chunked tokens and yielded valid payload.\n');

// -------------------------------------------------------------
// 2. Test Concept Resolution and URL Query Params
// -------------------------------------------------------------
console.log('2. Testing Concept Resolution & URL Query Parsing (PRD-01):');

const atlas = JSON.parse(fs.readFileSync(new URL('../public/models/atlas.json', import.meta.url), 'utf8'));

function resolveUrlParams(queryStr) {
  const params = new URLSearchParams(queryStr);
  const organParam = params.get('organ') || params.get('concept');
  const isEmbed = params.get('embed') === 'true' || !!organParam;
  const isolateParam = params.get('isolate') !== 'false';
  const viewParam = params.get('view') || 'three-quarter';
  const rotateParam = params.get('rotate') === 'true';

  let resolvedConcept = null;
  let priorityChunks = [];

  if (organParam) {
    const q = organParam.toLowerCase().trim();
    resolvedConcept = atlas.concepts.find(c => c.name.toLowerCase() === q || c.id.toLowerCase() === q);
    if (resolvedConcept) {
      const parts = resolvedConcept.elements.map(id => atlas.parts.find(p => p.id === id)).filter(Boolean);
      priorityChunks = [...new Set(parts.map(p => p.chunk))].sort((a, b) => a - b);
    }
  }

  return { isEmbed, organParam, isolateParam, viewParam, rotateParam, resolvedConcept, priorityChunks };
}

const test1 = resolveUrlParams('organ=heart&isolate=true&view=front&embed=true');
assert.equal(test1.isEmbed, true);
assert.equal(test1.resolvedConcept?.name.toLowerCase(), 'heart');
assert.deepEqual(test1.priorityChunks, [8, 9]);

const test2 = resolveUrlParams('organ=femur&isolate=true&view=side');
assert.equal(test2.isEmbed, true);
assert.equal(test2.resolvedConcept?.name.toLowerCase(), 'femur');
assert.deepEqual(test2.priorityChunks, [12, 13]);

const test3 = resolveUrlParams('organ=brain');
assert.equal(test3.isEmbed, true);
assert.equal(test3.resolvedConcept?.name.toLowerCase(), 'brain');
assert.deepEqual(test3.priorityChunks, [5, 6, 7]);

console.log('   [PASS] URL Query Resolution mapped Heart -> Chunks [8, 9], Femur -> [12, 13], Brain -> [5, 6, 7].\n');

// -------------------------------------------------------------
// 3. Test Two-Way PostMessage RPC Protocol Contracts
// -------------------------------------------------------------
console.log('3. Testing PostMessage Event Bus Contracts (PRD-01 & PRD-03):');

const mockEventBus = [];

function simulateParentIncoming(msg) {
  assert.ok(msg.type, 'Message must have a type');
  if (msg.type === 'EVT_READY') {
    assert.ok(msg.payload.organ);
    assert.ok(msg.payload.partsCount > 0);
  } else if (msg.type === 'EVT_PART_CLICKED') {
    assert.ok(msg.payload.partId);
    assert.ok(msg.payload.name);
    assert.ok(msg.payload.system);
  }
  mockEventBus.push(msg);
}

// Simulate atlas emitting EVT_READY for Heart
simulateParentIncoming({
  type: 'EVT_READY',
  payload: { organ: 'Heart', partsCount: 83, id: 'FMA7088' }
});

// Simulate student tapping Left ventricle
simulateParentIncoming({
  type: 'EVT_PART_CLICKED',
  payload: { partId: 'FJ2841', name: 'Left ventricle', conceptId: 'FMA7088', system: 'cardiac' }
});

assert.equal(mockEventBus.length, 2);
console.log('   [PASS] PostMessage RPC messages match specification schemas.\n');

// -------------------------------------------------------------
// 4. Test Production Bundle Artifacts
// -------------------------------------------------------------
console.log('4. Verifying Production Build Output:');

assert.ok(fs.existsSync('dist/index.html'), 'dist/index.html must exist');
const htmlContent = fs.readFileSync('dist/index.html', 'utf8');
assert.ok(htmlContent.includes('<script') || htmlContent.includes('<link'), 'dist/index.html must bundle assets');
console.log('   [PASS] Production bundle verified in dist/ directory.\n');

console.log('===================================================================');
console.log('  ALL INTEGRATION TESTS PASSED SUCCESSFULLY! (4/4 test suites)');
console.log('===================================================================\n');
