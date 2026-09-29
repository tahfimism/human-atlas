import fs from 'node:fs';

const atlas = JSON.parse(fs.readFileSync('public/models/atlas.json', 'utf8'));
const partsMap = new Map(atlas.parts.map(p => [p.id, p]));

function findExact(q) {
  return atlas.concepts.find(c => c.name.toLowerCase() === q.toLowerCase());
}

function findBest(term, preferredSystem) {
  const matches = atlas.concepts.filter(c => {
    const p0 = partsMap.get(c.elements[0]);
    if (!c.name.toLowerCase().includes(term.toLowerCase())) return false;
    if (preferredSystem && p0?.system !== preferredSystem) return false;
    return true;
  });
  if (matches.length === 0) {
    const all = atlas.concepts.filter(c => c.name.toLowerCase().includes(term.toLowerCase()));
    all.sort((a,b) => a.name.length - b.name.length);
    return all[0];
  }
  matches.sort((a,b) => a.name.length - b.name.length);
  return matches[0];
}

const list = [
  // Visceral Organs
  { q: 'heart' },
  { q: 'liver' },
  { q: 'stomach' },
  { q: 'spleen' },
  { q: 'pancreas' },
  { q: 'gallbladder' },
  { q: 'urinary bladder' },
  { q: 'kidney' },
  { q: 'trachea' },
  { q: 'diaphragm' },
  { q: 'esophagus' },
  { q: 'duodenum' },
  { q: 'appendix', sys: 'digestive' },
  
  // Respiratory
  { q: 'larynx', sys: 'respiratory' },
  
  // Nervous System & Sensory
  { q: 'brain' },
  { q: 'cerebellum' },
  { q: 'brainstem' },
  { q: 'eyeball', sys: 'sensory' },
  
  // Cardiovascular Landmarks
  { q: 'aorta', sys: 'arterial' },
  { q: 'superior vena cava', sys: 'venous' },
  { q: 'inferior vena cava', sys: 'venous' },
  { q: 'pulmonary trunk', sys: 'arterial' },

  // Skeletal: Axial Skeleton (Head, Spine, Thorax)
  { q: 'skull', sys: 'skeletal' },
  { q: 'mandible', sys: 'skeletal' },
  { q: 'maxilla', sys: 'skeletal' },
  { q: 'frontal bone', sys: 'skeletal' },
  { q: 'parietal bone', sys: 'skeletal' },
  { q: 'occipital bone', sys: 'skeletal' },
  { q: 'temporal bone', sys: 'skeletal' },
  { q: 'sphenoid bone', sys: 'skeletal' },
  { q: 'ethmoid bone', sys: 'skeletal' },
  { q: 'vertebral column', sys: 'skeletal' },
  { q: 'cervical vertebra', sys: 'skeletal' },
  { q: 'thoracic vertebra', sys: 'skeletal' },
  { q: 'lumbar vertebra', sys: 'skeletal' },
  { q: 'sacrum', sys: 'skeletal' },
  { q: 'coccyx', sys: 'skeletal' },
  { q: 'rib', sys: 'skeletal' },
  { q: 'sternum', sys: 'skeletal' },

  // Skeletal: Upper Appendicular
  { q: 'clavicle', sys: 'skeletal' },
  { q: 'scapula', sys: 'skeletal' },
  { q: 'humerus', sys: 'skeletal' },
  { q: 'radius', sys: 'skeletal' },
  { q: 'ulna', sys: 'skeletal' },

  // Skeletal: Lower Appendicular
  { q: 'hip bone', sys: 'skeletal' },
  { q: 'femur', sys: 'skeletal' },
  { q: 'patella', sys: 'skeletal' },
  { q: 'tibia', sys: 'skeletal' },
  { q: 'fibula', sys: 'skeletal' },
  { q: 'talus', sys: 'skeletal' },
  { q: 'calcaneus', sys: 'skeletal' },

  // Major Muscles
  { q: 'pectoralis major', sys: 'muscular' },
  { q: 'latissimus dorsi', sys: 'muscular' },
  { q: 'deltoid', sys: 'muscular' },
  { q: 'biceps brachii', sys: 'muscular' },
  { q: 'triceps brachii', sys: 'muscular' },
  { q: 'rectus abdominis', sys: 'muscular' },
  { q: 'gluteus maximus', sys: 'muscular' },
  { q: 'biceps femoris', sys: 'muscular' },
  { q: 'rectus femoris', sys: 'muscular' },
  { q: 'gastrocnemius', sys: 'muscular' }
];

console.log('Total targets to verify:', list.length);
const foundList = [];
for (const item of list) {
  let res = findExact(item.q);
  if (!res || (item.sys && partsMap.get(res.elements[0])?.system !== item.sys)) {
    res = findBest(item.q, item.sys);
  }
  if (res) {
    const p0 = partsMap.get(res.elements[0]);
    foundList.push({ query: item.q, name: res.name, id: res.id, system: p0?.system, parts: res.elements.length });
    console.log(`[OK] ${item.q.padEnd(22)} -> ${res.name.padEnd(30)} (${res.id}) [${p0?.system}] ${res.elements.length} parts`);
  } else {
    console.log(`[MISSING] ${item.q}`);
  }
}
console.log(`\nFound ${foundList.length} of ${list.length} target landmarks!`);
