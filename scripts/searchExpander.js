// ═══════════════════════════════════════════════════════════════
// RECOUNT.GE — src/utils/searchExpander.js  (v3 — fuzzy typos)
//
// Handles query-time normalization and typo correction.
// Index-time aliases (search_aliases field) handle synonym expansion.
//
// New in v3:
//   - Levenshtein fuzzy correction for latin transliteration typos
//   - "cebocemnti" → "cebocementi" → "წებოცემენტი"
//   - exporteded isTransliterationQuery() for filter logic
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// 1. KNOWN CANONICAL TERMS
// These are the "correct" forms that user typos should map to.
// Grouped by type for clarity.
// ─────────────────────────────────────────────────────────────

// Known latin transliterations → Georgian canonical
const TRANSLITERATION_TO_GEO = {
  "tsebocementi":  "წებოცემენტი",
  "cebocementi":   "წებოცემენტი",
  "webocementi":   "წებოცემენტი",
  "tsecement":     "წებოცემენტი",
  "webacement":    "წებოცემენტი",
  "zebocementi":   "წებოცემენტი",
  "jebocementi":   "წებოცემენტი",
  "fuga":          "ფუგა",
  "fugi":          "ფუგა",
  "grunt":         "გრუნტი",
  "grundi":        "გრუნტი",
  "shpakli":       "შპაკლი",
  "shtukatura":    "შტუკატური",
  "tabashiri":     "თაბაშირი",
  "cementi":       "ცემენტი",
  "tsementi":      "ცემენტი",
  "saghebavi":     "საღებავი",
  "silikoni":      "სილიკონი",
  "bloki":         "ბლოკი",
  "aguri":         "აგური",
  "kabeli":        "კაბელი",
  "mili":          "მილი",
  "qafi":          "ქაფი",
  "hidroizolatsia":"ჰიდროიზოლაცია",
};

// Known brand names (correct spellings)
const KNOWN_BRANDS = [
  "ceresit", "knauf", "weber", "litokol", "mapei", "sika",
  "baumit", "henkel", "basf", "pagel", "isomat", "akfix",
  "perel", "unis", "volma", "bergauf", "moment", "pci",
];

// All known latin terms for fuzzy matching
// (transliterations + brands — these are the "targets" we correct toward)
const ALL_KNOWN_LATIN = [
  ...Object.keys(TRANSLITERATION_TO_GEO),
  ...KNOWN_BRANDS,
];

// ─────────────────────────────────────────────────────────────
// 2. EXACT TYPO MAP (keyboard layout + severe misspellings)
// Fast lookup before fuzzy matching.
// ─────────────────────────────────────────────────────────────
const QUERY_TYPOS = {
  // Georgian keyboard model codes → latin
  "ცმ14":  "cm14",  "ცმ 14": "cm14",
  "ცმ11":  "cm11",  "ცმ 11": "cm11",
  "ცმ16":  "cm16",  "ცმ 16": "cm16",
  "ცმ17":  "cm17",  "ცმ 17": "cm17",
  "ვს500": "vs500", "ვს 500":"vs500",
  "ცტ84":  "ct84",  "ცტ 84": "ct84",
  // Brand misspellings
  "cerecit":   "ceresit",
  "ceresite":  "ceresit",
  "cerresit":  "ceresit",
  "seresit":   "ceresit",
  "ceresid":   "ceresit",
  "knaf":      "knauf",
  "nauf":      "knauf",
  "veber":     "weber",
  "lytokol":   "litokol",
  "litocol":   "litokol",
  // Georgian keyboard typos → canonical Georgian
  "ტცებოცემენტ":  "წებოცემენტი",
  "ტცებოცემენტი": "წებოცემენტი",
  "წბოცემენტი":   "წებოცემენტი",
  "ცებოცემენტი":  "წებოცემენტი",
  "წებოცემენტ":   "წებოცემენტი",
};

// ─────────────────────────────────────────────────────────────
// 3. LEVENSHTEIN FUZZY CORRECTION
// For typos not in the exact map. Matches against ALL_KNOWN_LATIN.
// ─────────────────────────────────────────────────────────────
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, row[j], row[j - 1]);
      prev = tmp;
    }
  }
  return row[b.length];
}

/**
 * Try to fuzzy-correct a latin query toward a known canonical term.
 *
 * Threshold: allow 1 edit per 5 chars (20% error rate), minimum 1.
 * "cebocemnti"  (10 chars) → threshold 2 → "cebocementi" (dist 2) ✓
 * "tsebocemeti" (11 chars) → threshold 2 → "tsebocementi" (dist 1) ✓
 * "cerecit"     (7 chars)  → threshold 1 → "ceresit" (dist 1) ✓
 *
 * Returns null if no close match found.
 */
function fuzzyCorrectLatin(query) {
  const q = query.toLowerCase().replace(/\s+/g, "");

  // Only apply to latin-only strings of meaningful length
  if (q.length < 4 || /[ა-ჿ]/.test(q)) return null;
  if (ALL_KNOWN_LATIN.includes(q)) return null; // already correct

  const threshold = Math.max(1, Math.floor(q.length / 5));

  let best = null;
  let bestDist = Infinity;

  for (const known of ALL_KNOWN_LATIN) {
    // Skip candidates much shorter or longer than query (quick reject)
    if (Math.abs(known.length - q.length) > threshold + 1) continue;
    const dist = levenshtein(q, known);
    if (dist < bestDist && dist <= threshold) {
      bestDist = dist;
      best = known;
    }
  }

  return best; // null = no match close enough
}

// ─────────────────────────────────────────────────────────────
// 4. GEO CHAR MAP (for Georgian keyboard model codes)
// ─────────────────────────────────────────────────────────────
const GEO_CHAR_MAP = {
  "ც":"c","მ":"m","ვ":"v","ს":"s","ბ":"b","პ":"p","ტ":"t",
  "დ":"d","ფ":"f","გ":"g","ჰ":"h","ი":"i","ლ":"l","ნ":"n",
  "ო":"o","რ":"r","უ":"u","კ":"k","ა":"a","ე":"e",
};
function geoToLat(s) {
  return s.split("").map(c => GEO_CHAR_MAP[c] ?? c).join("");
}

// ─────────────────────────────────────────────────────────────
// 5. QUERY NORMALIZATION
// ─────────────────────────────────────────────────────────────
export function normalizeQuery(raw = "") {
  if (!raw) return "";
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[-–—]+/g, " ")
    .trim()
    .toLowerCase();
}

// ─────────────────────────────────────────────────────────────
// 6. EXPAND QUERY
// Returns ordered list of search terms to try.
// First term = highest confidence (used for primary search).
// ─────────────────────────────────────────────────────────────
export function expandQuery(raw = "") {
  if (!raw || !raw.trim()) return [];

  const norm    = normalizeQuery(raw);
  const normKey = norm.replace(/\s+/g, "");
  const terms   = new Set([norm]);

  // Step 1: exact typo map
  const exactFixed = QUERY_TYPOS[norm] ?? QUERY_TYPOS[normKey];
  if (exactFixed) {
    terms.add(exactFixed.toLowerCase());
  }

  // Step 2: fuzzy correction (for latin transliteration typos)
  // "cebocemnti" → "cebocementi" → "წებოცემენტი"
  const fuzzyFixed = fuzzyCorrectLatin(normKey);
  if (fuzzyFixed && fuzzyFixed !== normKey) {
    terms.add(fuzzyFixed);
    // If the fuzzy match is a known transliteration, add its Georgian canonical
    const geoCanon = TRANSLITERATION_TO_GEO[fuzzyFixed];
    if (geoCanon) {
      terms.add(geoCanon.toLowerCase());
      // Also add dash/space/joined variants of Georgian canonical
      terms.add(geoCanon.replace(/[-–—]+/g, " ").toLowerCase());
      terms.add(geoCanon.replace(/[\s-]+/g, "").toLowerCase());
    }
  }

  // Step 3: direct transliteration lookup (if norm/normKey is a known term)
  const directGeo = TRANSLITERATION_TO_GEO[norm] ?? TRANSLITERATION_TO_GEO[normKey];
  if (directGeo) {
    terms.add(directGeo.toLowerCase());
    terms.add(directGeo.replace(/[-–—]+/g, " ").toLowerCase());
    terms.add(directGeo.replace(/[\s-]+/g, "").toLowerCase());
  }

  // Step 4: Georgian model code → Latin ("ცმ14" → "cm14")
  if (/[ა-ჿ]/.test(norm) && /\d/.test(norm)) {
    const lat = geoToLat(normKey);
    if (lat !== normKey) terms.add(lat);
  }

  // Step 5: model code space ↔ joined
  const joined = norm.replace(/\b([a-z]{1,4})\s+(\d{1,5})\b/g, "$1$2");
  if (joined !== norm) terms.add(joined);
  const spaced = norm.replace(/\b([a-z]{1,4})(\d{1,5})\b/g, "$1 $2");
  if (spaced !== norm) terms.add(spaced);

  // Step 6: Georgian dash/joined variants
  const noDash = norm.replace(/[-–—\s]+/g, "");
  if (noDash !== normKey && noDash.length > 2) terms.add(noDash);

  return [...terms].filter(t => t && t.trim().length > 1);
}

// ─────────────────────────────────────────────────────────────
// 7. HELPER — exported for use in filterRelevantGroups
// Detect if a query is a latin transliteration/typo that
// expanded to a Georgian canonical.
// ─────────────────────────────────────────────────────────────
export function isTransliterationQuery(raw = "") {
  if (!raw) return false;
  const norm    = normalizeQuery(raw);
  const normKey = norm.replace(/\s+/g, "");

  // If original query has Georgian chars → not a transliteration query
  if (/[ა-ჿ]/.test(norm)) return false;

  // If query expands to Georgian terms → it IS a transliteration query
  const expanded = expandQuery(norm);
  return expanded.some(t => /[ა-ჿ]/.test(t));
}
