import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { MeshoptSimplifier } from 'meshoptimizer';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Wait for WebAssembly / meshoptimizer simplifier to initialize
await MeshoptSimplifier.ready;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const atlasPath = path.join(rootDir, 'public', 'models', 'atlas.json');
const modelsDir = path.join(rootDir, 'public', 'models');
const outputDir = path.join(rootDir, 'public', 'models', 'organs');

// Ensure output directory exists
fs.mkdirSync(outputDir, { recursive: true });

// Load atlas manifest
const atlas = JSON.parse(fs.readFileSync(atlasPath, 'utf8'));

// System colors mapping from app/anatomy.ts
const SYSTEM_COLORS = {
  cardiac: '#b96760',
  sensory: '#b0c8ce',
  skeletal: '#e2d9ba',
  muscular: '#a85b50',
  arterial: '#c05245',
  venous: '#527c9f',
  nervous: '#d8b565',
  respiratory: '#b98991',
  digestive: '#b8916b',
  urinary: '#b47961',
  lymphatic: '#879f7c',
  endocrine: '#c5a09a',
  reproductive: '#bda098',
  integumentary: '#ba9b7d',
  connective: '#aec3bb'
};

// Target top 50 core educational landmarks to export (organs, bones, vessels, muscles)
export const TOP_EDUCATIONAL_ORGANS = [
  // Visceral & Thoracic Organs
  'heart',
  'lungs',
  'liver',
  'stomach',
  'kidneys',
  'pancreas',
  'spleen',
  'gallbladder',
  'urinary bladder',
  'trachea',
  'esophagus',
  'duodenum',
  'appendix',
  'diaphragm',

  // Brain, Nervous & Sensory
  'brain',
  'cerebellum',
  'brainstem',
  'eyeball',

  // Major Cardiovascular Landmarks
  'aorta',
  'superior vena cava',
  'inferior vena cava',
  'pulmonary trunk',

  // Axial Skeleton (Head, Spine, Ribs & Thorax)
  'skull',
  'mandible',
  'maxilla',
  'frontal bone',
  'parietal bone',
  'occipital bone',
  'temporal bone',
  'sphenoid bone',
  'spine',
  'cervical vertebra',
  'thoracic vertebra',
  'lumbar vertebra',
  'sacrum',
  'ribs',
  'sternum',

  // Appendicular Skeleton (Upper & Lower Limbs & Pelvis)
  'clavicle',
  'scapula',
  'humerus',
  'radius',
  'ulna',
  'pelvis',
  'femur',
  'patella',
  'tibia',
  'fibula',
  'talus',
  'calcaneus',

  // Major Landmark Muscles
  'deltoid',
  'gluteus maximus',
  'biceps brachii',
  'triceps brachii',
  'rectus femoris',
  'gastrocnemius'
];

// Chunk memory cache
const chunkCache = new Map();

/**
 * Reads and decompresses a model chunk if necessary
 */
export function getChunkBuffer(chunkIndex) {
  if (chunkCache.has(chunkIndex)) {
    return chunkCache.get(chunkIndex);
  }

  const chunkPath = path.join(modelsDir, `body-${chunkIndex}.chunk`);
  if (!fs.existsSync(chunkPath)) {
    throw new Error(`Chunk file body-${chunkIndex}.chunk does not exist at ${chunkPath}`);
  }

  const raw = fs.readFileSync(chunkPath);
  let decompressed = raw;
  // Check gzip magic bytes 0x1F, 0x8B
  if (raw.length >= 2 && raw[0] === 0x1f && raw[1] === 0x8b) {
    decompressed = zlib.gunzipSync(raw);
  }

  chunkCache.set(chunkIndex, decompressed);
  return decompressed;
}

/**
 * Converts hex color string (e.g. #b96760) to linear RGBA array [0..1]
 */
function hexToLinearRgb(hex) {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  const toLinear = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return [toLinear(r), toLinear(g), toLinear(b), 1.0];
}

/**
 * Pads a buffer to 4-byte alignment
 */
function padTo4Bytes(buffer, padByte = 0x00) {
  const remainder = buffer.length % 4;
  if (remainder === 0) return buffer;
  const padding = 4 - remainder;
  return Buffer.concat([buffer, Buffer.alloc(padding, padByte)]);
}

/**
 * Resolves a concept query to an entity with ID, name, elements list, and system
 */
export function resolveOrganConcept(query, fmaId) {
  const q = (query || '').toLowerCase().trim();
  const partMap = new Map(atlas.parts.map(p => [p.id, p]));

  // Handle composite organs (lungs = right lung + left lung)
  if (q === 'lungs' || q === 'lung') {
    const rl = atlas.concepts.find(c => c.id === 'FMA7309' || c.name.toLowerCase() === 'right lung');
    const ll = atlas.concepts.find(c => c.id === 'FMA7310' || c.name.toLowerCase() === 'left lung');
    const allElements = [...new Set([...(rl?.elements || []), ...(ll?.elements || [])])];
    const parts = allElements.map(id => partMap.get(id)).filter(Boolean);
    return {
      id: fmaId || 'FMA7308',
      name: 'Lungs',
      slug: 'lungs',
      elements: allElements,
      parts,
      system: 'respiratory'
    };
  }

  // Handle kidney / kidneys
  if (q === 'kidneys') {
    const concept = atlas.concepts.find(c => c.name.toLowerCase() === 'kidney' || c.id === 'FMA7203');
    if (concept) {
      const parts = concept.elements.map(id => partMap.get(id)).filter(Boolean);
      return {
        id: concept.id,
        name: 'Kidneys',
        slug: 'kidney',
        elements: concept.elements,
        parts,
        system: parts[0]?.system || 'urinary'
      };
    }
  }

  // Exact alias map for top landmarks, bones, vessels, and muscles
  const EXACT_ALIASES = {
    ribs: { fma: 'FMA7574', slug: 'ribs', name: 'Ribs' },
    rib: { fma: 'FMA7574', slug: 'rib', name: 'Ribs' },
    spine: { fma: 'FMA13478', slug: 'spine', name: 'Spine' },
    'vertebral column': { fma: 'FMA13478', slug: 'vertebral_column', name: 'Vertebral Column' },
    pelvis: { fma: 'FMA16585', slug: 'pelvis', name: 'Pelvis' },
    'hip bone': { fma: 'FMA16585', slug: 'hip_bone', name: 'Hip Bone' },
    skull: { fma: 'FMA46565', slug: 'skull', name: 'Skull' },
    scapula: { fma: 'FMA13394', slug: 'scapula', name: 'Scapula' },
    clavicle: { fma: 'FMA13321', slug: 'clavicle', name: 'Clavicle' },
    humerus: { fma: 'FMA13303', slug: 'humerus', name: 'Humerus' },
    radius: { fma: 'FMA23463', slug: 'radius', name: 'Radius' },
    ulna: { fma: 'FMA23466', slug: 'ulna', name: 'Ulna' },
    femur: { fma: 'FMA9611', slug: 'femur', name: 'Femur' },
    patella: { fma: 'FMA24485', slug: 'patella', name: 'Patella' },
    tibia: { fma: 'FMA24476', slug: 'tibia', name: 'Tibia' },
    fibula: { fma: 'FMA24479', slug: 'fibula', name: 'Fibula' },
    sternum: { fma: 'FMA7485', slug: 'sternum', name: 'Sternum' },
    sacrum: { fma: 'FMA16202', slug: 'sacrum', name: 'Sacrum' },
    mandible: { fma: 'FMA52748', slug: 'mandible', name: 'Mandible' },
    maxilla: { fma: 'FMA9711', slug: 'maxilla', name: 'Maxilla' },
    'cervical vertebra': { fma: 'FMA9915', slug: 'cervical_vertebra', name: 'Cervical Vertebra' },
    'thoracic vertebra': { fma: 'FMA9139', slug: 'thoracic_vertebra', name: 'Thoracic Vertebra' },
    'lumbar vertebra': { fma: 'FMA9921', slug: 'lumbar_vertebra', name: 'Lumbar Vertebra' },
    talus: { fma: 'FMA9708', slug: 'talus', name: 'Talus' },
    calcaneus: { fma: 'FMA24496', slug: 'calcaneus', name: 'Calcaneus' },
    eyeball: { fma: 'FMA12515', slug: 'eyeball', name: 'Eyeball' },
    eye: { fma: 'FMA12515', slug: 'eye', name: 'Eyeball' },
    aorta: { fma: 'FMA3734', slug: 'aorta', name: 'Aorta' },
    'superior vena cava': { fma: 'FMA4720', slug: 'superior_vena_cava', name: 'Superior Vena Cava' },
    'inferior vena cava': { fma: 'FMA10951', slug: 'inferior_vena_cava', name: 'Inferior Vena Cava' },
    'pulmonary trunk': { fma: 'FMA8612', slug: 'pulmonary_trunk', name: 'Pulmonary Trunk' },
    deltoid: { fma: 'FMA34676', slug: 'deltoid', name: 'Deltoid' },
    'gluteus maximus': { fma: 'FMA22314', slug: 'gluteus_maximus', name: 'Gluteus Maximus' },
    'biceps brachii': { fma: 'FMA37683', slug: 'biceps_brachii', name: 'Biceps Brachii' },
    'triceps brachii': { fma: 'FMA37692', slug: 'triceps_brachii', name: 'Triceps Brachii' },
    'rectus femoris': { fma: 'FMA22430', slug: 'rectus_femoris', name: 'Rectus Femoris' },
    gastrocnemius: { fma: 'FMA45950', slug: 'gastrocnemius', name: 'Gastrocnemius' }
  };

  const aliasInfo = EXACT_ALIASES[q];
  const targetFma = fmaId || aliasInfo?.fma;

  // Match concept by name or FMA ID
  let concept = atlas.concepts.find(
    c => (targetFma && c.id.toLowerCase() === targetFma.toLowerCase()) ||
         c.name.toLowerCase() === q ||
         c.id.toLowerCase() === q
  );

  // Partial match fallback
  if (!concept) {
    concept = atlas.concepts.find(c => c.name.toLowerCase().includes(q));
  }

  if (!concept) {
    throw new Error(`Concept '${query}' (FMA ID: ${fmaId || 'none'}) not found in atlas`);
  }

  const parts = concept.elements.map(id => partMap.get(id)).filter(Boolean);
  const slug = aliasInfo?.slug || concept.name.toLowerCase().replace(/\s+/g, '_');
  const name = aliasInfo?.name || concept.name;

  return {
    id: concept.id,
    name,
    slug,
    elements: concept.elements,
    parts,
    system: parts[0]?.system || 'other'
  };
}

/**
 * Packages mesh geometry buffers into binary glTF 2.0 (.glb)
 */
export function buildGLB({ positions, normals, partIndices, indices, system, name, bounds }) {
  const vertexCount = positions.length / 3;
  const indexCount = indices.length;
  const isU16 = vertexCount <= 65535;

  const posBytes = Buffer.from(positions.buffer, positions.byteOffset, positions.byteLength);
  const normBytes = Buffer.from(normals.buffer, normals.byteOffset, normals.byteLength);

  let partBytes = null;
  if (partIndices) {
    partBytes = Buffer.from(partIndices.buffer, partIndices.byteOffset, partIndices.byteLength);
  }

  let idxArray = indices;
  if (isU16 && !(indices instanceof Uint16Array)) {
    idxArray = new Uint16Array(indices);
  }
  const idxBytes = Buffer.from(idxArray.buffer, idxArray.byteOffset, idxArray.byteLength);

  // Pad bufferViews to 4-byte boundaries
  const paddedPos = padTo4Bytes(posBytes);
  const paddedNorm = padTo4Bytes(normBytes);
  const paddedPart = partBytes ? padTo4Bytes(partBytes) : Buffer.alloc(0);
  const paddedIdx = padTo4Bytes(idxBytes);

  let currentOffset = 0;
  const posOffset = currentOffset;
  currentOffset += paddedPos.length;

  const normOffset = currentOffset;
  currentOffset += paddedNorm.length;

  let partOffset = 0;
  if (partBytes) {
    partOffset = currentOffset;
    currentOffset += paddedPart.length;
  }

  const idxOffset = currentOffset;
  currentOffset += paddedIdx.length;

  const binBuffer = Buffer.concat(
    partBytes
      ? [paddedPos, paddedNorm, paddedPart, paddedIdx]
      : [paddedPos, paddedNorm, paddedIdx]
  );

  const systemColor = SYSTEM_COLORS[system] || '#b8916b';
  const baseColorFactor = hexToLinearRgb(systemColor);

  const attributes = {
    POSITION: 0,
    NORMAL: 1
  };

  const accessors = [
    // 0: POSITION
    {
      bufferView: 0,
      byteOffset: 0,
      componentType: 5126, // FLOAT
      count: vertexCount,
      type: 'VEC3',
      min: [bounds[0][0], bounds[0][1], bounds[0][2]],
      max: [bounds[1][0], bounds[1][1], bounds[1][2]]
    },
    // 1: NORMAL
    {
      bufferView: 1,
      byteOffset: 0,
      componentType: 5126, // FLOAT
      count: vertexCount,
      type: 'VEC3'
    }
  ];

  const bufferViews = [
    // 0: POSITION
    {
      buffer: 0,
      byteOffset: posOffset,
      byteLength: posBytes.length,
      target: 34962 // ARRAY_BUFFER
    },
    // 1: NORMAL
    {
      buffer: 0,
      byteOffset: normOffset,
      byteLength: normBytes.length,
      target: 34962 // ARRAY_BUFFER
    }
  ];

  let nextViewIndex = 2;
  let idxAccessorIndex = 2;

  if (partBytes) {
    attributes._PART_INDEX = nextViewIndex;
    accessors.push({
      bufferView: nextViewIndex,
      byteOffset: 0,
      componentType: 5123, // UNSIGNED_SHORT
      count: vertexCount,
      type: 'SCALAR'
    });
    bufferViews.push({
      buffer: 0,
      byteOffset: partOffset,
      byteLength: partBytes.length,
      target: 34962 // ARRAY_BUFFER
    });
    idxAccessorIndex = nextViewIndex + 1;
    nextViewIndex++;
  }

  // Indices accessor and bufferView
  accessors.push({
    bufferView: nextViewIndex,
    byteOffset: 0,
    componentType: isU16 ? 5123 : 5125, // UNSIGNED_SHORT or UNSIGNED_INT
    count: indexCount,
    type: 'SCALAR'
  });
  bufferViews.push({
    buffer: 0,
    byteOffset: idxOffset,
    byteLength: idxBytes.length,
    target: 34963 // ELEMENT_ARRAY_BUFFER
  });

  const gltf = {
    asset: {
      version: '2.0',
      generator: 'HumanAtlas Standalone Micro-GLB Pipeline (PRD-04)'
    },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name, mesh: 0 }],
    materials: [
      {
        name: `${system}_material`,
        pbrMetallicRoughness: {
          baseColorFactor,
          metallicFactor: 0.05,
          roughnessFactor: 0.65
        },
        doubleSided: true
      }
    ],
    meshes: [
      {
        name,
        primitives: [
          {
            attributes,
            indices: idxAccessorIndex,
            material: 0,
            mode: 4 // TRIANGLES
          }
        ]
      }
    ],
    accessors,
    bufferViews,
    buffers: [{ byteLength: binBuffer.length }]
  };

  // Prepare JSON chunk (padded to 4 bytes with space 0x20)
  let jsonBuffer = Buffer.from(JSON.stringify(gltf), 'utf8');
  jsonBuffer = padTo4Bytes(jsonBuffer, 0x20);

  // Total GLB length = Header (12) + JSON Chunk (8 + len) + BIN Chunk (8 + len)
  const totalLength = 12 + 8 + jsonBuffer.length + 8 + binBuffer.length;
  const glb = Buffer.alloc(totalLength);
  let offset = 0;

  // Header
  glb.writeUInt32LE(0x46546c67, offset); // 'glTF'
  offset += 4;
  glb.writeUInt32LE(2, offset); // version 2
  offset += 4;
  glb.writeUInt32LE(totalLength, offset);
  offset += 4;

  // JSON Chunk
  glb.writeUInt32LE(jsonBuffer.length, offset);
  offset += 4;
  glb.writeUInt32LE(0x4e4f534a, offset); // 'JSON'
  offset += 4;
  jsonBuffer.copy(glb, offset);
  offset += jsonBuffer.length;

  // BIN Chunk
  glb.writeUInt32LE(binBuffer.length, offset);
  offset += 4;
  glb.writeUInt32LE(0x004e4942, offset); // 'BIN\0'
  offset += 4;
  binBuffer.copy(glb, offset);

  return glb;
}

/**
 * Validates generated GLB with Three.js GLTFLoader
 */
export async function validateGLB(glbBuffer) {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    const arrayBuffer = glbBuffer.buffer.slice(
      glbBuffer.byteOffset,
      glbBuffer.byteOffset + glbBuffer.byteLength
    );
    loader.parse(
      arrayBuffer,
      '',
      gltf => resolve(gltf),
      error => reject(error)
    );
  });
}

/**
 * Extracts, centers, decimates, and exports a standalone micro-GLB organ
 */
export async function exportOrgan(conceptQuery, fmaId) {
  const organ = resolveOrganConcept(conceptQuery, fmaId);
  const parts = organ.parts;

  if (parts.length === 0) {
    throw new Error(`No parts found for organ '${organ.name}'`);
  }

  // Pre-load and cache all required chunks
  const chunkIndices = [...new Set(parts.map(p => p.chunk))].sort((a, b) => a - b);
  for (const ci of chunkIndices) {
    getChunkBuffer(ci);
  }

  let totalVerts = 0;
  let totalIndices = 0;
  for (const p of parts) {
    totalVerts += p.vertexCount;
    totalIndices += p.indexCount;
  }

  // Merge raw vertex buffers
  const rawPositions = new Float32Array(totalVerts * 3);
  const rawNormals = new Float32Array(totalVerts * 3);
  const rawPartIndices = new Uint16Array(totalVerts);
  const rawIndices = new Uint32Array(totalIndices);

  let vOffset = 0;
  let iOffset = 0;

  for (let partIdx = 0; partIdx < parts.length; partIdx++) {
    const p = parts[partIdx];
    const chunkBuf = getChunkBuffer(p.chunk);

    const pPositions = new Float32Array(
      chunkBuf.buffer,
      chunkBuf.byteOffset + p.positions,
      p.vertexCount * 3
    );
    const pNormals = new Int16Array(
      chunkBuf.buffer,
      chunkBuf.byteOffset + p.normals,
      p.vertexCount * 3
    );
    const pIndices = new Uint32Array(
      chunkBuf.buffer,
      chunkBuf.byteOffset + p.indices,
      p.indexCount
    );

    // Copy positions
    rawPositions.set(pPositions, vOffset * 3);

    // Convert Int16 normals to Float32 [-1, 1] & renormalize
    for (let i = 0; i < pNormals.length; i += 3) {
      let nx = pNormals[i] < 0 ? pNormals[i] / 32768 : pNormals[i] / 32767;
      let ny = pNormals[i + 1] < 0 ? pNormals[i + 1] / 32768 : pNormals[i + 1] / 32767;
      let nz = pNormals[i + 2] < 0 ? pNormals[i + 2] / 32768 : pNormals[i + 2] / 32767;
      const len = Math.hypot(nx, ny, nz);
      if (len > 1e-6) {
        nx /= len;
        ny /= len;
        nz /= len;
      }
      rawNormals[vOffset * 3 + i] = nx;
      rawNormals[vOffset * 3 + i + 1] = ny;
      rawNormals[vOffset * 3 + i + 2] = nz;
    }

    // Set part index
    for (let i = 0; i < p.vertexCount; i++) {
      rawPartIndices[vOffset + i] = partIdx;
    }

    // Offset indices
    for (let i = 0; i < pIndices.length; i++) {
      rawIndices[iOffset + i] = pIndices[i] + vOffset;
    }

    vOffset += p.vertexCount;
    iOffset += p.indexCount;
  }

  // Calculate bounding box and center
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < rawPositions.length; i += 3) {
    const x = rawPositions[i];
    const y = rawPositions[i + 1];
    const z = rawPositions[i + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;

  // Center positions around (0, 0, 0)
  for (let i = 0; i < rawPositions.length; i += 3) {
    rawPositions[i] -= centerX;
    rawPositions[i + 1] -= centerY;
    rawPositions[i + 2] -= centerZ;
  }

  const centeredBounds = [
    [minX - centerX, minY - centerY, minZ - centerZ],
    [maxX - centerX, maxY - centerY, maxZ - centerZ]
  ];
  const originalBounds = [
    [minX, minY, minZ],
    [maxX, maxY, maxZ]
  ];

  // Target size limit: <= 500 KB (512,000 bytes)
  const MAX_TARGET_BYTES = 500 * 1024;
  const SAFE_TARGET_BYTES = 460 * 1024; // Headroom for headers and metadata

  let finalPositions = rawPositions;
  let finalNormals = rawNormals;
  let finalPartIndices = rawPartIndices;
  let finalIndices = rawIndices;

  // Check uncompressed raw size estimate
  // 12 bytes pos + 12 bytes norm + 2 bytes partIndex + 2 bytes index (if < 65536)
  const isRawU16 = totalVerts <= 65535;
  const rawByteEst = totalVerts * 26 + totalIndices * (isRawU16 ? 2 : 4) + 2048;

  let decimated = false;
  let decimationError = 0;

  if (rawByteEst > SAFE_TARGET_BYTES) {
    decimated = true;

    // Estimate index count to hit ~380-420 KB
    // Vertices roughly indexCount / 3.5
    // Byte weight ~ 26 * (I / 3.5) + 2 * I ≈ 9.4 * I bytes
    // For 420 KB -> I ≈ 45,000 indices
    let targetIndexCount = Math.min(totalIndices, 45000);
    let targetError = 0.03;
    let simplificationFlags = ['LockBorder'];

    // Simplification loop with adaptive fallback
    let attempts = 0;
    while (attempts < 4) {
      attempts++;
      const [resIndices, err] = MeshoptSimplifier.simplify(
        rawIndices,
        rawPositions,
        3,
        targetIndexCount,
        targetError,
        simplificationFlags
      );
      decimationError = err;

      // Compact mesh to remove unreferenced vertices
      const [remap, uniqueCount] = MeshoptSimplifier.compactMesh(resIndices);

      const compPositions = new Float32Array(uniqueCount * 3);
      const compNormals = new Float32Array(uniqueCount * 3);
      const compPartIndices = new Uint16Array(uniqueCount);

      for (let oldIdx = 0; oldIdx < remap.length; oldIdx++) {
        const newIdx = remap[oldIdx];
        if (newIdx !== 0xffffffff && newIdx < uniqueCount) {
          compPositions[newIdx * 3] = rawPositions[oldIdx * 3];
          compPositions[newIdx * 3 + 1] = rawPositions[oldIdx * 3 + 1];
          compPositions[newIdx * 3 + 2] = rawPositions[oldIdx * 3 + 2];

          compNormals[newIdx * 3] = rawNormals[oldIdx * 3];
          compNormals[newIdx * 3 + 1] = rawNormals[oldIdx * 3 + 1];
          compNormals[newIdx * 3 + 2] = rawNormals[oldIdx * 3 + 2];

          compPartIndices[newIdx] = rawPartIndices[oldIdx];
        }
      }

      // Test packaging to measure exact GLB byte length
      const testGlb = buildGLB({
        positions: compPositions,
        normals: compNormals,
        partIndices: compPartIndices,
        indices: resIndices,
        system: organ.system,
        name: organ.name,
        bounds: centeredBounds
      });

      if (testGlb.length <= MAX_TARGET_BYTES) {
        finalPositions = compPositions;
        finalNormals = compNormals;
        finalPartIndices = compPartIndices;
        finalIndices = resIndices;
        break;
      }

      // If still exceeding, reduce target index count further and try sloppy for complex multi-bone assemblies
      targetIndexCount = Math.floor((targetIndexCount * 0.65) / 3) * 3;
      targetError += 0.04;
      simplificationFlags = []; // Relax boundary locking

      if (attempts >= 2) {
        const [slopIndices, slopErr] = MeshoptSimplifier.simplifySloppy(
          rawIndices,
          rawPositions,
          3,
          null,
          targetIndexCount,
          targetError
        );
        const [slopRemap, slopUnique] = MeshoptSimplifier.compactMesh(slopIndices);
        const sPositions = new Float32Array(slopUnique * 3);
        const sNormals = new Float32Array(slopUnique * 3);
        const sPartIndices = new Uint16Array(slopUnique);

        for (let oldIdx = 0; oldIdx < slopRemap.length; oldIdx++) {
          const newIdx = slopRemap[oldIdx];
          if (newIdx !== 0xffffffff && newIdx < slopUnique) {
            sPositions[newIdx * 3] = rawPositions[oldIdx * 3];
            sPositions[newIdx * 3 + 1] = rawPositions[oldIdx * 3 + 1];
            sPositions[newIdx * 3 + 2] = rawPositions[oldIdx * 3 + 2];
            sNormals[newIdx * 3] = rawNormals[oldIdx * 3];
            sNormals[newIdx * 3 + 1] = rawNormals[oldIdx * 3 + 1];
            sNormals[newIdx * 3 + 2] = rawNormals[oldIdx * 3 + 2];
            sPartIndices[newIdx] = rawPartIndices[oldIdx];
          }
        }

        finalPositions = sPositions;
        finalNormals = sNormals;
        finalPartIndices = sPartIndices;
        finalIndices = slopIndices;
        decimationError = slopErr;
        break;
      }
    }
  }

  // Build final GLB file
  const glbBuffer = buildGLB({
    positions: finalPositions,
    normals: finalNormals,
    partIndices: finalPartIndices,
    indices: finalIndices,
    system: organ.system,
    name: organ.name,
    bounds: centeredBounds
  });

  // Verify file size constraint
  if (glbBuffer.length > MAX_TARGET_BYTES) {
    console.warn(
      `[WARN] ${organ.name} GLB size ${(glbBuffer.length / 1024).toFixed(1)} KB exceeds 500 KB limit!`
    );
  }

  // Validate GLB binary with Three.js GLTFLoader
  await validateGLB(glbBuffer);

  const finalVertexCount = finalPositions.length / 3;
  const finalTriangles = finalIndices.length / 3;

  // Prepare companion metadata
  const meta = {
    id: organ.id,
    name: organ.name,
    slug: organ.slug,
    elementsCount: parts.length,
    triangles: finalTriangles,
    vertexCount: finalVertexCount,
    system: organ.system,
    bounds: centeredBounds,
    originalBounds,
    center: [centerX, centerY, centerZ],
    byteSize: glbBuffer.length,
    decimated,
    decimationError: decimated ? Number(decimationError.toFixed(6)) : 0,
    parts: parts.map((p, idx) => ({
      index: idx,
      id: p.id,
      name: p.name,
      conceptId: p.conceptId,
      system: p.system
    }))
  };

  // Write output files
  const glbPath = path.join(outputDir, `${organ.slug}.glb`);
  const jsonPath = path.join(outputDir, `${organ.slug}.json`);

  fs.writeFileSync(glbPath, glbBuffer);
  fs.writeFileSync(jsonPath, JSON.stringify(meta, null, 2));

  // Write aliases if applicable
  const aliasCopies = {
    lungs: 'lung',
    kidney: 'kidneys',
    ribs: 'rib',
    spine: 'vertebral_column',
    pelvis: 'hip_bone',
    eyeball: 'eye'
  };
  if (aliasCopies[organ.slug]) {
    const aliasSlug = aliasCopies[organ.slug];
    fs.copyFileSync(glbPath, path.join(outputDir, `${aliasSlug}.glb`));
    fs.copyFileSync(jsonPath, path.join(outputDir, `${aliasSlug}.json`));
  }

  return {
    ...meta,
    glbPath,
    jsonPath
  };
}

/**
 * Main export runner
 */
export async function runExportPipeline(targetOrgans = TOP_EDUCATIONAL_ORGANS) {
  console.log('=================================================================');
  console.log('  STANDALONE MICRO-GLB ORGAN EXTRACTION PIPELINE (PRD-04)');
  console.log('=================================================================\n');
  console.log(`Target Organs: ${targetOrgans.join(', ')}`);
  console.log(`Output Directory: ${outputDir}\n`);

  const results = [];
  const startTime = Date.now();

  for (const organQuery of targetOrgans) {
    try {
      const res = await exportOrgan(organQuery);
      const sizeKB = (res.byteSize / 1024).toFixed(1);
      const passed = res.byteSize <= 500 * 1024;
      results.push({
        Organ: res.name,
        Slug: res.slug,
        Parts: res.elementsCount,
        Vertices: res.vertexCount,
        Triangles: res.triangles,
        Decimated: res.decimated ? 'Yes' : 'No',
        Size: `${sizeKB} KB`,
        Status: passed ? 'PASS (<= 500 KB)' : 'FAIL (> 500 KB)'
      });
    } catch (err) {
      console.error(`Failed to export organ '${organQuery}':`, err.message);
      results.push({
        Organ: organQuery,
        Slug: 'error',
        Parts: 0,
        Vertices: 0,
        Triangles: 0,
        Decimated: 'No',
        Size: '0 KB',
        Status: `ERROR: ${err.message}`
      });
    }
  }

  console.table(results);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const allPassed = results.every(r => r.Status.startsWith('PASS'));

  console.log(`Pipeline completed in ${duration}s.`);
  if (allPassed) {
    console.log('[SUCCESS] All target organs exported successfully and meet <= 500 KB size ceiling!');
  } else {
    console.warn('[WARNING] Some organs failed or exceeded size budget.');
  }

  return { allPassed, results };
}

// Execute when run from CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const cliArgs = process.argv.slice(2);
  const targetOrgans = cliArgs.length > 0 ? cliArgs : TOP_EDUCATIONAL_ORGANS;
  runExportPipeline(targetOrgans).catch(err => {
    console.error('Pipeline crashed:', err);
    process.exit(1);
  });
}
