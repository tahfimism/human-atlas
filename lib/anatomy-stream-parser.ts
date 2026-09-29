/**
 * PRD-02: AI Tutor Syntax, Streaming Token Parser & Concept Resolver
 *
 * Implements real-time token streaming state machine, permissive YAML/JSON DSL parser,
 * and three-tier FMA concept reconciliation pipeline for the Human Atlas 3D engine.
 */

// ---------------------------------------------------------------------------
// 1. TypeScript Types & Interfaces
// ---------------------------------------------------------------------------

export interface AnatomyItemPayload {
  /** Target organ name or FMA identifier (e.g. 'heart', 'femur', 'FMA7088') */
  organ: string;
  /** Sub-structures or elements to highlight */
  highlight?: string[];
  /** Educational subtitle displayed on the card footer */
  caption?: string;
  /** Estimated piece count or custom badge */
  partsCount?: number;
}

export interface AnatomyDSLPayload {
  /** Single organ shortcut (Pattern A) */
  organ?: string;
  /** Multi-organ carousel items (Pattern B) */
  items?: AnatomyItemPayload[];
  /** Whether to isolate the organ or show it with surrounding anatomy (default: true) */
  isolate?: boolean;
  /** Initial camera angle preset: default strictly 'front' */
  view?: 'front' | 'back' | 'side' | 'three-quarter';
  /** Sub-structures or elements to highlight (single organ) */
  highlight?: string[];
  /** Continuous gentle rotation (default: false) */
  autoRotate?: boolean;
  /** Educational subtitle displayed on the card footer */
  caption?: string;
  /** Exploded view intensity (0.0 to 1.0) */
  explode?: number;
  /** Cross-sectional clipping plane (Feature 1 in PRD-05) */
  slice?: 'coronal' | 'axial' | 'sagittal';
  /** Cross-sectional clipping plane offset distance */
  sliceOffset?: number;
  /** Interactive viewer mode (Feature 2 in PRD-05) */
  mode?: 'normal' | 'quiz';
  /** Target anatomical structure for active recall quiz challenge */
  quizTarget?: string;
  /** Quiz instructions or hint displayed to the student */
  quizPrompt?: string;
  /** 3D spatial callout pins / annotations (Feature 4 in PRD-05) */
  annotations?: Array<{ target: string; text: string }>;
}

export type StreamingParserState =
  | { status: 'idle' }
  | { status: 'streaming'; partialBuffer: string; skeleton: boolean }
  | { status: 'ready'; payload: AnatomyDSLPayload; rawContent: string }
  | { status: 'error'; rawContent: string; message: string };

export interface ConceptResolutionResult {
  matched: boolean;
  canonical: string;
  fmaId?: string;
  score: number;
  originalQuery: string;
}

// ---------------------------------------------------------------------------
// 2. FMA Concept Map & Aliases
// ---------------------------------------------------------------------------

export const CANONICAL_FMA_MAP: Record<string, { canonical: string; fmaId: string }> = {
  'fma7088': { canonical: 'heart', fmaId: 'FMA7088' },
  'fma50801': { canonical: 'brain', fmaId: 'FMA50801' },
  'fma7197': { canonical: 'liver', fmaId: 'FMA7197' },
  'fma7394': { canonical: 'trachea', fmaId: 'FMA7394' },
  'fma9611': { canonical: 'femur', fmaId: 'FMA9611' },
  'fma7148': { canonical: 'stomach', fmaId: 'FMA7148' },
  'fma7203': { canonical: 'kidney', fmaId: 'FMA7203' },
  'fma7195': { canonical: 'lungs', fmaId: 'FMA7195' },
  'fma7196': { canonical: 'right lung', fmaId: 'FMA7196' },
  'fma7198': { canonical: 'left lung', fmaId: 'FMA7198' },
  'fma5018': { canonical: 'skull', fmaId: 'FMA5018' },
  'fma7166': { canonical: 'left ventricle', fmaId: 'FMA7166' },
  'fma7174': { canonical: 'left ventricle', fmaId: 'FMA7174' },
  'fma7167': { canonical: 'right ventricle', fmaId: 'FMA7167' },
  'fma7298': { canonical: 'mitral valve', fmaId: 'FMA7298' },
  'fma7299': { canonical: 'aortic valve', fmaId: 'FMA7299' },
  'fma13328': { canonical: 'patella', fmaId: 'FMA13328' },
  'fma24474': { canonical: 'tibia', fmaId: 'FMA24474' },
  'fma13321': { canonical: 'clavicle', fmaId: 'FMA13321' },
  'fma55097': { canonical: 'larynx', fmaId: 'FMA55097' },
  'fma54827': { canonical: 'pharynx', fmaId: 'FMA54827' },
  'fma66657': { canonical: 'aorta', fmaId: 'FMA66657' },
  'fma4989': { canonical: 'vertebral column', fmaId: 'FMA4989' },
  'fma7475': { canonical: 'ribs', fmaId: 'FMA7475' },
  'fma7562': { canonical: 'pancreas', fmaId: 'FMA7562' },
  'fma7206': { canonical: 'spleen', fmaId: 'FMA7206' },
  'fma52748': { canonical: 'mandible', fmaId: 'FMA52748' },
  'fma13394': { canonical: 'scapula', fmaId: 'FMA13394' },
  'fma7131': { canonical: 'esophagus', fmaId: 'FMA7131' },
  'fma15900': { canonical: 'urinary bladder', fmaId: 'FMA15900' },
  'fma15902': { canonical: 'ureter', fmaId: 'FMA15902' },
  'fma275020': { canonical: 'hippocampus', fmaId: 'FMA275020' },
  'fma4720': { canonical: 'superior vena cava', fmaId: 'FMA4720' },
  'fma66654': { canonical: 'pulmonary trunk', fmaId: 'FMA66654' },
};

export const COMMON_ANATOMICAL_ALIASES: Record<string, { canonical: string; fmaId?: string }> = {
  'heart': { canonical: 'heart', fmaId: 'FMA7088' },
  'brain': { canonical: 'brain', fmaId: 'FMA50801' },
  'voicebox': { canonical: 'larynx', fmaId: 'FMA55097' },
  'voice box': { canonical: 'larynx', fmaId: 'FMA55097' },
  'windpipe': { canonical: 'trachea', fmaId: 'FMA7394' },
  'airway': { canonical: 'trachea', fmaId: 'FMA7394' },
  'throat': { canonical: 'pharynx', fmaId: 'FMA54827' },
  'collarbone': { canonical: 'clavicle', fmaId: 'FMA13321' },
  'collar bone': { canonical: 'clavicle', fmaId: 'FMA13321' },
  'thigh bone': { canonical: 'femur', fmaId: 'FMA9611' },
  'thighbone': { canonical: 'femur', fmaId: 'FMA9611' },
  'kneecap': { canonical: 'patella', fmaId: 'FMA13328' },
  'knee cap': { canonical: 'patella', fmaId: 'FMA13328' },
  'shinbone': { canonical: 'tibia', fmaId: 'FMA24474' },
  'shin bone': { canonical: 'tibia', fmaId: 'FMA24474' },
  'skull': { canonical: 'skull', fmaId: 'FMA5018' },
  'cranium': { canonical: 'skull', fmaId: 'FMA5018' },
  'head bone': { canonical: 'skull', fmaId: 'FMA5018' },
  'left ventricle': { canonical: 'left ventricle', fmaId: 'FMA7174' },
  'right ventricle': { canonical: 'right ventricle', fmaId: 'FMA7167' },
  'mitral valve': { canonical: 'mitral valve', fmaId: 'FMA7298' },
  'bicuspid valve': { canonical: 'mitral valve', fmaId: 'FMA7298' },
  'aortic valve': { canonical: 'aortic valve', fmaId: 'FMA7299' },
  'belly': { canonical: 'stomach', fmaId: 'FMA7148' },
  'tummy': { canonical: 'stomach', fmaId: 'FMA7148' },
  'stomach': { canonical: 'stomach', fmaId: 'FMA7148' },
  'liver': { canonical: 'liver', fmaId: 'FMA7197' },
  'kidney': { canonical: 'kidney', fmaId: 'FMA7203' },
  'kidneys': { canonical: 'kidney', fmaId: 'FMA7203' },
  'lungs': { canonical: 'lungs', fmaId: 'FMA7195' },
  'lung': { canonical: 'lungs', fmaId: 'FMA7195' },
  'trachea': { canonical: 'trachea', fmaId: 'FMA7394' },
  'femur': { canonical: 'femur', fmaId: 'FMA9611' },
  'clavicle': { canonical: 'clavicle', fmaId: 'FMA13321' },
  'patella': { canonical: 'patella', fmaId: 'FMA13328' },
  'tibia': { canonical: 'tibia', fmaId: 'FMA24474' },
  'larynx': { canonical: 'larynx', fmaId: 'FMA55097' },
  'pharynx': { canonical: 'pharynx', fmaId: 'FMA54827' },
  'aorta': { canonical: 'aorta', fmaId: 'FMA66657' },
  'spine': { canonical: 'vertebral column', fmaId: 'FMA4989' },
  'backbone': { canonical: 'vertebral column', fmaId: 'FMA4989' },
  'vertebral column': { canonical: 'vertebral column', fmaId: 'FMA4989' },
  'ribs': { canonical: 'ribs', fmaId: 'FMA7475' },
  'rib cage': { canonical: 'ribs', fmaId: 'FMA7475' },
  'jaw': { canonical: 'mandible', fmaId: 'FMA52748' },
  'jawbone': { canonical: 'mandible', fmaId: 'FMA52748' },
  'mandible': { canonical: 'mandible', fmaId: 'FMA52748' },
  'shoulder blade': { canonical: 'scapula', fmaId: 'FMA13394' },
  'scapula': { canonical: 'scapula', fmaId: 'FMA13394' },
  'pancreas': { canonical: 'pancreas', fmaId: 'FMA7562' },
  'spleen': { canonical: 'spleen', fmaId: 'FMA7206' },
  'esophagus': { canonical: 'esophagus', fmaId: 'FMA7131' },
  'gullet': { canonical: 'esophagus', fmaId: 'FMA7131' },
  'bladder': { canonical: 'urinary bladder', fmaId: 'FMA15900' },
  'urinary bladder': { canonical: 'urinary bladder', fmaId: 'FMA15900' },
  'ureter': { canonical: 'ureter', fmaId: 'FMA15902' },
  'left kidney tube': { canonical: 'ureter', fmaId: 'FMA15902' },
  'kidney tube': { canonical: 'ureter', fmaId: 'FMA15902' },
  'hippocampus': { canonical: 'hippocampus', fmaId: 'FMA275020' },
  'superior vena cava': { canonical: 'superior vena cava', fmaId: 'FMA4720' },
  'pulmonary trunk': { canonical: 'pulmonary trunk', fmaId: 'FMA66654' },
};

// ---------------------------------------------------------------------------
// 3. String & Fuzzy Matching Utilities
// ---------------------------------------------------------------------------

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[-_]+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
}

function damerauLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost // substitution
      );

      // Transposition (e.g. 'haert' -> 'heart')
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
      }
    }
  }

  return dp[a.length][b.length];
}

function getBigrams(str: string): Set<string> {
  const bigrams = new Set<string>();
  for (let i = 0; i < str.length - 1; i++) {
    bigrams.add(str.slice(i, i + 2));
  }
  return bigrams;
}

function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1.0;
  if (a.length < 2 || b.length < 2) return 0;
  const aBigrams = getBigrams(a);
  const bBigrams = getBigrams(b);
  let intersection = 0;
  aBigrams.forEach((bg) => {
    if (bBigrams.has(bg)) intersection++;
  });
  return (2 * intersection) / (aBigrams.size + bBigrams.size);
}

function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  const dist = damerauLevenshtein(a, b);
  const editSim = Math.max(0, 1.0 - dist / maxLen);
  const diceSim = diceCoefficient(a, b);
  return Math.max(editSim, diceSim);
}

// ---------------------------------------------------------------------------
// 4. FMAConceptResolver Implementation
// ---------------------------------------------------------------------------

export class FMAConceptResolver {
  private static instance: FMAConceptResolver | null = null;

  public static getInstance(): FMAConceptResolver {
    if (!this.instance) {
      this.instance = new FMAConceptResolver();
    }
    return this.instance;
  }

  /**
   * Resolves an anatomical term or FMA identifier into a canonical concept.
   * Performs exact matching, FMA ID lookup, alias normalization, and fuzzy string similarity.
   */
  public static resolve(term: string): ConceptResolutionResult {
    if (!term || typeof term !== 'string') {
      return {
        matched: false,
        canonical: '',
        score: 0,
        originalQuery: term ?? '',
      };
    }

    const trimmed = term.trim();
    const normalized = normalizeString(trimmed);

    // 1. Direct FMA ID lookup (e.g. 'FMA7088', 'fma_7088', 'fma 7088')
    const fmaMatch = trimmed.match(/^fma[\s_-]?(\d+)$/i);
    if (fmaMatch) {
      const key = `fma${fmaMatch[1]}`;
      const found = CANONICAL_FMA_MAP[key];
      if (found) {
        const res: ConceptResolutionResult = {
          matched: true,
          canonical: found.canonical,
          fmaId: found.fmaId,
          score: 1.0,
          originalQuery: term,
        };
        Object.defineProperty(res, 'toString', { value: () => res.canonical, enumerable: false });
        return res;
      }
      const unmappedRes: ConceptResolutionResult = {
        matched: false,
        canonical: trimmed,
        fmaId: `FMA${fmaMatch[1]}`,
        score: 0,
        originalQuery: term,
      };
      Object.defineProperty(unmappedRes, 'toString', { value: () => unmappedRes.canonical, enumerable: false });
      return unmappedRes;
    }

    // 2. Exact match in alias / canonical map
    if (COMMON_ANATOMICAL_ALIASES[normalized]) {
      const entry = COMMON_ANATOMICAL_ALIASES[normalized];
      const res: ConceptResolutionResult = {
        matched: true,
        canonical: entry.canonical,
        fmaId: entry.fmaId,
        score: 1.0,
        originalQuery: term,
      };
      Object.defineProperty(res, 'toString', { value: () => res.canonical, enumerable: false });
      return res;
    }

    // Also check direct match in FMA map values
    for (const entry of Object.values(CANONICAL_FMA_MAP)) {
      if (normalizeString(entry.canonical) === normalized) {
        const res: ConceptResolutionResult = {
          matched: true,
          canonical: entry.canonical,
          fmaId: entry.fmaId,
          score: 1.0,
          originalQuery: term,
        };
        Object.defineProperty(res, 'toString', { value: () => res.canonical, enumerable: false });
        return res;
      }
    }

    // 3. Substring containment check (e.g., "human heart" -> "heart", "the trachea" -> "trachea")
    for (const [alias, entry] of Object.entries(COMMON_ANATOMICAL_ALIASES)) {
      const normAlias = normalizeString(alias);
      if (
        (normalized.length > 3 && normalized.includes(normAlias)) ||
        (normAlias.length > 3 && normAlias.includes(normalized))
      ) {
        const res: ConceptResolutionResult = {
          matched: true,
          canonical: entry.canonical,
          fmaId: entry.fmaId,
          score: 0.9,
          originalQuery: term,
        };
        Object.defineProperty(res, 'toString', { value: () => res.canonical, enumerable: false });
        return res;
      }
    }

    // 4. Fuzzy Matching across alias dictionary
    let bestMatch: { canonical: string; fmaId?: string } | null = null;
    let bestScore = 0;

    for (const [alias, entry] of Object.entries(COMMON_ANATOMICAL_ALIASES)) {
      const sim = calculateSimilarity(normalized, normalizeString(alias));
      if (sim > bestScore) {
        bestScore = sim;
        bestMatch = entry;
      }
    }

    // Threshold for accepting fuzzy similarity (70% match)
    if (bestMatch && bestScore >= 0.7) {
      const res: ConceptResolutionResult = {
        matched: true,
        canonical: bestMatch.canonical,
        fmaId: bestMatch.fmaId,
        score: Number(bestScore.toFixed(3)),
        originalQuery: term,
      };
      Object.defineProperty(res, 'toString', { value: () => res.canonical, enumerable: false });
      return res;
    }

    // 5. Fallback un-matched
    const fallbackRes: ConceptResolutionResult = {
      matched: false,
      canonical: trimmed.toLowerCase(),
      score: Number(bestScore.toFixed(3)),
      originalQuery: term,
    };
    Object.defineProperty(fallbackRes, 'toString', { value: () => fallbackRes.canonical, enumerable: false });
    return fallbackRes;
  }

  /**
   * Helper that resolves directly to the canonical string name.
   */
  public static resolveCanonical(term: string): string {
    return this.resolve(term).canonical;
  }

  /**
   * Resolves an FMA ID string directly to the canonical organ name (or null).
   */
  public static resolveFma(fmaId: string): string | null {
    const match = fmaId.trim().match(/^fma[\s_-]?(\d+)$/i);
    if (!match) return null;
    const entry = CANONICAL_FMA_MAP[`fma${match[1]}`];
    return entry ? entry.canonical : null;
  }

  // Instance method delegates
  public resolve(term: string): ConceptResolutionResult {
    return FMAConceptResolver.resolve(term);
  }

  public resolveCanonical(term: string): string {
    return FMAConceptResolver.resolveCanonical(term);
  }

  public resolveFma(fmaId: string): string | null {
    return FMAConceptResolver.resolveFma(fmaId);
  }
}

// ---------------------------------------------------------------------------
// 5. DSL Parsing & Validation Helpers
// ---------------------------------------------------------------------------

function parseArrayValue(raw: string): string[] {
  const trimmed = raw.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return [];

    // Attempt clean JSON array parse
    try {
      const parsed = JSON.parse(`[${inner.replace(/,\s*$/, '')}]`);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim());
      }
    } catch {
      // Lenient regex-based comma splitting for unquoted / single-quoted arrays
    }

    const items: string[] = [];
    const regex = /(?:'([^']*)'|"([^"]*)"|([^,]+))/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(inner)) !== null) {
      const item = (match[1] ?? match[2] ?? match[3] ?? '').trim();
      if (item) {
        items.push(item);
      }
    }
    return items;
  }

  // Fallback single value or comma-separated
  if (trimmed.includes(',')) {
    return trimmed
      .split(',')
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
  }

  return [trimmed.replace(/^['"]|['"]$/g, '')];
}

function parseScalarValue(raw: string): any {
  const trimmed = raw.trim();

  // Boolean
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;

  // Numeric (int or float)
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return parseFloat(trimmed);
  }

  // Array format
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    // Check if it's an array of objects
    try {
      const cleaned = cleanJsonString(trimmed);
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // String array
      return parseArrayValue(trimmed);
    }
  }

  // Quoted string
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function cleanJsonString(raw: string): string {
  return raw
    .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '') // remove comments
    .replace(/,(\s*[}\]])/g, '$1') // remove trailing commas
    .replace(/([{,]\s*)([a-zA-Z0-9_$]+)\s*:/g, '$1"$2":'); // quote unquoted keys
}

function parseYamlLike(raw: string): Record<string, any> {
  const lines = raw.split(/\r?\n/);
  const result: Record<string, any> = {};

  type ListContext = 'items' | 'annotations' | 'highlight' | null;
  let currentListKey: ListContext = null;
  let currentListItem: Record<string, any> | null = null;

  for (let line of lines) {
    // Strip comments
    const commentIdx = line.indexOf('#');
    if (commentIdx !== -1) {
      line = line.slice(0, commentIdx);
    }

    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect list item line (starts with '- ')
    const listMatch = line.match(/^(\s*)-\s+(.*)$/);
    if (listMatch) {
      const rest = listMatch[2].trim();

      if (currentListKey === 'items') {
        currentListItem = {};
        if (!result.items) result.items = [];
        result.items.push(currentListItem);

        if (rest) {
          const colonIdx = rest.indexOf(':');
          if (colonIdx !== -1) {
            const k = rest.slice(0, colonIdx).trim();
            const v = rest.slice(colonIdx + 1).trim();
            currentListItem[k] = parseScalarValue(v);
          }
        }
        continue;
      }

      if (currentListKey === 'annotations') {
        currentListItem = {};
        if (!result.annotations) result.annotations = [];
        result.annotations.push(currentListItem);

        if (rest) {
          const colonIdx = rest.indexOf(':');
          if (colonIdx !== -1) {
            const k = rest.slice(0, colonIdx).trim();
            const v = rest.slice(colonIdx + 1).trim();
            currentListItem[k] = parseScalarValue(v);
          }
        }
        continue;
      }

      if (currentListKey === 'highlight') {
        if (!result.highlight) result.highlight = [];
        const cleanVal = rest.replace(/^['"]|['"]$/g, '').trim();
        if (cleanVal) result.highlight.push(cleanVal);
        continue;
      }
    }

    // Detect indented property under active list item
    const indentMatch = line.match(/^(\s{2,}|\t+)([a-zA-Z0-9_$]+)\s*:\s*(.*)$/);
    if (indentMatch && currentListItem) {
      const k = indentMatch[2].trim();
      const v = indentMatch[3].trim();
      currentListItem[k] = parseScalarValue(v);
      continue;
    }

    // Root key-value line
    const rootColonIdx = line.indexOf(':');
    if (rootColonIdx !== -1) {
      const key = line.slice(0, rootColonIdx).trim();
      const rawVal = line.slice(rootColonIdx + 1).trim();

      if (key === 'items') {
        currentListKey = 'items';
        currentListItem = null;
        if (!result.items) result.items = [];
        if (rawVal) {
          result.items = parseScalarValue(rawVal);
          currentListKey = null;
        }
        continue;
      }

      if (key === 'annotations') {
        currentListKey = 'annotations';
        currentListItem = null;
        if (!result.annotations) result.annotations = [];
        if (rawVal) {
          result.annotations = parseScalarValue(rawVal);
          currentListKey = null;
        }
        continue;
      }

      if (key === 'highlight') {
        if (!rawVal) {
          currentListKey = 'highlight';
          currentListItem = null;
          if (!result.highlight) result.highlight = [];
        } else {
          result.highlight = parseArrayValue(rawVal);
          currentListKey = null;
        }
        continue;
      }

      // Any other root key resets list mode
      currentListKey = null;
      currentListItem = null;
      result[key] = parseScalarValue(rawVal);
    }
  }

  return result;
}

function normalizeView(view: any): 'front' | 'back' | 'side' | 'three-quarter' {
  if (typeof view !== 'string') return 'front';
  const v = view.toLowerCase().trim().replace(/[-_]/g, '');
  if (v.includes('front')) return 'front';
  if (v.includes('back') || v.includes('rear') || v.includes('posterior')) return 'back';
  if (v.includes('side') || v.includes('lateral')) return 'side';
  if (v.includes('three') || v.includes('34') || v.includes('quarter') || v.includes('perspective')) return 'three-quarter';
  return 'front';
}

function normalizeSlice(slice: any): 'coronal' | 'axial' | 'sagittal' {
  if (typeof slice !== 'string') {
    throw new Error("Invalid 'slice': must be one of 'coronal', 'axial', 'sagittal'");
  }
  const s = slice.toLowerCase().trim();
  if (s === 'coronal' || s === 'axial' || s === 'sagittal') {
    return s;
  }
  throw new Error(`Invalid 'slice': '${slice}'. Must be one of 'coronal', 'axial', 'sagittal'`);
}

function normalizeMode(mode: any): 'normal' | 'quiz' {
  if (typeof mode !== 'string') return 'normal';
  const m = mode.toLowerCase().trim();
  if (m === 'quiz') return 'quiz';
  if (m === 'normal') return 'normal';
  throw new Error(`Invalid 'mode': '${mode}'. Must be 'normal' or 'quiz'`);
}

function validateAndFormatPayload(rawObj: any): AnatomyDSLPayload {
  if (!rawObj || typeof rawObj !== 'object') {
    throw new Error('Anatomy payload must be a non-empty object or dictionary');
  }

  const payload: AnatomyDSLPayload = {};

  // Pattern A: Single Organ
  if (rawObj.organ !== undefined) {
    if (typeof rawObj.organ !== 'string' || !rawObj.organ.trim()) {
      throw new Error("Invalid 'organ': must be a non-empty string");
    }
    payload.organ = rawObj.organ.trim();
  }

  // Pattern B: Multi-Organ Slider Items
  if (rawObj.items !== undefined) {
    if (!Array.isArray(rawObj.items) || rawObj.items.length === 0) {
      throw new Error("Invalid 'items': must be a non-empty array of organ items");
    }

    payload.items = rawObj.items.map((item: any, idx: number) => {
      if (!item || typeof item !== 'object') {
        throw new Error(`Item at index ${idx} must be an object with an 'organ' field`);
      }
      if (typeof item.organ !== 'string' || !item.organ.trim()) {
        throw new Error(`Item at index ${idx} is missing required 'organ' string`);
      }

      const itemPayload: AnatomyItemPayload = {
        organ: item.organ.trim(),
      };

      if (item.highlight) {
        itemPayload.highlight = Array.isArray(item.highlight)
          ? item.highlight.map(String)
          : parseArrayValue(String(item.highlight));
      }
      if (item.caption) {
        itemPayload.caption = String(item.caption).trim();
      }
      if (item.partsCount !== undefined) {
        const count = Number(item.partsCount);
        if (!isNaN(count)) itemPayload.partsCount = count;
      }

      return itemPayload;
    });
  }

  // Must have either organ or items
  if (!payload.organ && (!payload.items || payload.items.length === 0)) {
    throw new Error("Payload must specify either 'organ' (single organ) or 'items' (multi-organ slider)");
  }

  // Isolate boolean
  if (rawObj.isolate !== undefined) {
    payload.isolate = Boolean(rawObj.isolate);
  }

  // View preset
  if (rawObj.view !== undefined) {
    payload.view = normalizeView(rawObj.view);
  }

  // Highlights
  if (rawObj.highlight !== undefined) {
    payload.highlight = Array.isArray(rawObj.highlight)
      ? rawObj.highlight.map(String)
      : parseArrayValue(String(rawObj.highlight));
  }

  // Auto-rotate
  if (rawObj.autoRotate !== undefined) {
    payload.autoRotate = Boolean(rawObj.autoRotate);
  }

  // Caption
  if (rawObj.caption !== undefined) {
    payload.caption = String(rawObj.caption).trim();
  }

  // Explode (0.0 to 1.0)
  if (rawObj.explode !== undefined) {
    const exp = Number(rawObj.explode);
    if (!isNaN(exp)) payload.explode = exp;
  }

  // Slicing
  if (rawObj.slice !== undefined) {
    payload.slice = normalizeSlice(rawObj.slice);
  }
  if (rawObj.sliceOffset !== undefined) {
    const off = Number(rawObj.sliceOffset);
    if (!isNaN(off)) payload.sliceOffset = off;
  }

  // Mode & Quiz
  if (rawObj.mode !== undefined) {
    payload.mode = normalizeMode(rawObj.mode);
  }
  if (rawObj.quizTarget !== undefined) {
    payload.quizTarget = String(rawObj.quizTarget).trim();
  }
  if (rawObj.quizPrompt !== undefined) {
    payload.quizPrompt = String(rawObj.quizPrompt).trim();
  }

  // Annotations
  if (rawObj.annotations !== undefined) {
    if (Array.isArray(rawObj.annotations)) {
      payload.annotations = rawObj.annotations.map((ann: any) => ({
        target: String(ann.target ?? '').trim(),
        text: String(ann.text ?? '').trim(),
      }));
    }
  }

  return payload;
}

// ---------------------------------------------------------------------------
// 6. AnatomyStreamParser State Machine
// ---------------------------------------------------------------------------

export interface AnatomyStreamParserOptions {
  /**
   * Automatically resolve organ names to canonical concepts using FMAConceptResolver.
   * Default is false (preserves exact payload input).
   */
  resolveConcepts?: boolean;
}

export class AnatomyStreamParser {
  private buffer = '';
  private options: AnatomyStreamParserOptions;
  private cachedRawContent: string | null = null;
  private cachedState: StreamingParserState | null = null;

  constructor(options: AnatomyStreamParserOptions = {}) {
    this.options = options;
  }

  /**
   * Resets the streaming buffer and internal cache back to idle state.
   */
  public reset(): void {
    this.buffer = '';
    this.cachedRawContent = null;
    this.cachedState = null;
  }

  /**
   * Returns the current raw token buffer accumulated so far.
   */
  public getBuffer(): string {
    return this.buffer;
  }

  /**
   * Processes an incoming streaming token and advances the state machine.
   */
  public processToken(token: string): StreamingParserState {
    this.buffer += token;

    // Scan for anatomy block delimiter: ```anatomy
    const anatomyTagRegex = /```\s*anatomy/i;
    let searchIndex = 0;
    let lastClosedState: StreamingParserState | null = null;

    while (searchIndex < this.buffer.length) {
      const slice = this.buffer.slice(searchIndex);
      const tagMatch = slice.match(anatomyTagRegex);

      if (!tagMatch || tagMatch.index === undefined) {
        break;
      }

      const blockStart = searchIndex + tagMatch.index;
      let contentStart = blockStart + tagMatch[0].length;

      // Skip optional newline immediately after opening tag line
      if (this.buffer[contentStart] === '\r') contentStart++;
      if (this.buffer[contentStart] === '\n') contentStart++;

      // Look for closing ``` fence
      const blockEnd = this.buffer.indexOf('```', contentStart);

      if (blockEnd === -1) {
        // Code block is actively streaming!
        const partialBuffer = this.buffer.slice(contentStart);
        return {
          status: 'streaming',
          partialBuffer,
          skeleton: true,
        };
      }

      // Code block has arrived and is closed!
      const rawContent = this.buffer.slice(contentStart, blockEnd).trim();

      // Return cached state if this exact block was already parsed
      if (this.cachedRawContent === rawContent && this.cachedState) {
        lastClosedState = this.cachedState;
      } else {
        try {
          let payload = this.parsePayload(rawContent);
          if (this.options.resolveConcepts) {
            payload = this.resolvePayload(payload);
          }
          lastClosedState = {
            status: 'ready',
            payload,
            rawContent,
          };
        } catch (err: any) {
          lastClosedState = {
            status: 'error',
            rawContent,
            message: err?.message || 'Failed to parse anatomy payload',
          };
        }
        this.cachedRawContent = rawContent;
        this.cachedState = lastClosedState;
      }

      // Continue searching for any subsequent blocks that may have started later
      searchIndex = blockEnd + 3;
    }

    if (lastClosedState) {
      return lastClosedState;
    }

    return { status: 'idle' };
  }

  /**
   * Alias for processToken for compatibility with PRD-02 reference implementation.
   */
  public processChunk(textToken: string): StreamingParserState {
    return this.processToken(textToken);
  }

  /**
   * Parses and validates raw code block content (JSON or YAML).
   */
  public parsePayload(raw: string): AnatomyDSLPayload {
    const trimmed = raw.trim();
    if (!trimmed) {
      throw new Error("Empty anatomy code block: missing 'organ' or 'items'");
    }

    let parsedObj: any = null;

    // 1. Try parsing as JSON first if it starts with {
    if (trimmed.startsWith('{')) {
      try {
        parsedObj = JSON.parse(trimmed);
      } catch {
        try {
          const cleaned = cleanJsonString(trimmed);
          parsedObj = JSON.parse(cleaned);
        } catch {
          // Fall back to YAML parser below
        }
      }
    }

    // 2. Parse as YAML-like key-values if not parsed as JSON
    if (!parsedObj) {
      parsedObj = parseYamlLike(trimmed);
    }

    // 3. Validate and enforce schema constraints
    return validateAndFormatPayload(parsedObj);
  }

  /**
   * Normalizes organ concepts in payload using FMAConceptResolver.
   */
  public resolvePayload(payload: AnatomyDSLPayload): AnatomyDSLPayload {
    const resolved: AnatomyDSLPayload = { ...payload };

    if (resolved.organ) {
      resolved.organ = FMAConceptResolver.resolveCanonical(resolved.organ);
    }

    if (resolved.items && Array.isArray(resolved.items)) {
      resolved.items = resolved.items.map((item) => ({
        ...item,
        organ: FMAConceptResolver.resolveCanonical(item.organ),
      }));
    }

    return resolved;
  }
}
