// ═══════════════════════════════════════════════════════════════
// RECOUNT.GE — utils/normalizeProduct.js  v2.0
//
// Changes from v1:
//   + extractWeight()      — parses "25 კგ" / "25kg" etc. from name
//   + buildGroupingName()  — normalizes Georgian type-word variants
//                            for internal grouping only (NEVER displayed)
//   + buildGroupKeyV2()    — replaces buildGroupKeyFromExtracted()
//                            Now includes sub_category + weight so:
//                            • "25კგ" and "30კგ" get DIFFERENT keys ✓
//                            • Different sub_categories never share a key ✓
//                            • Conservative fallback to __solo__ ✓
//   + New output fields:   weight, grouping_name
//   + group_key            now uses V2 logic
// ═══════════════════════════════════════════════════════════════

// ── Known brands ──────────────────────────────────────────────
const KNOWN_BRANDS = [
  "ceresit", "knauf", "weber", "litokol", "mapei", "sika",
  "baumit", "henkel", "basf", "pagel", "hidrostop", "isomat",
  "akfix", "moment", "pci", "uzin", "sopro", "murexin",
  "perel", "unis", "volma", "bergauf", "ekofix", "ultrafix",
  "vetonit", "atlas", "schonox", "laticrete",
];

// ── Unit tokens — excluded from model extraction ──────────────
const UNIT_TOKENS = new Set([
  "kg", "gr", "ml", "lt", "l", "g", "m", "mm", "cm", "pc",
  "კგ", "გრ", "მლ", "ლ", "მ", "მმ", "სმ", "ც", "შტ",
  "x", "х",
]);

// ─────────────────────────────────────────────────────────────
// 1. STRING HELPERS
// ─────────────────────────────────────────────────────────────

function normStr(str = "") {
  return str
    .toLowerCase()
    .trim()
    .replace(/[-–—\/\\]+/g, " ")
    // join short latin prefix + space + digits: "CM 14" → "cm14"
    .replace(/(?<![a-z])([a-z]{2,3})\s+(\d{1,4})\b/g, "$1$2")
    .replace(/[^\wა-ჿ\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(str = "") {
  return normStr(str).split(" ").filter(Boolean);
}

// ─────────────────────────────────────────────────────────────
// 2. FIELD RESOLUTION
// Handles inconsistent field names across store scrapers.
// ─────────────────────────────────────────────────────────────

function resolveField(raw, ...keys) {
  for (const k of keys) {
    if (raw[k] != null && raw[k] !== "") return raw[k];
  }
  return null;
}

function resolvePrice(raw) {
  const val = resolveField(raw, "price", "price_gel", "price_value");
  return val != null ? Number(val) : null;
}

function resolveOldPrice(raw) {
  const val = resolveField(raw, "old_price", "old_price_gel", "oldprice", "original_price");
  return val != null ? Number(val) : null;
}

function resolveImage(raw) {
  return resolveField(raw, "image", "image_url", "img", "photo", "thumbnail");
}

function resolveUrl(raw) {
  return resolveField(raw, "url", "source_url", "link", "product_url");
}

function resolveSubCategory(raw) {
  return resolveField(raw, "sub_category", "sub", "subcategory", "sub_cat");
}

function resolveInStock(raw) {
  const v = resolveField(raw, "in_stock", "instock", "available", "is_available");
  if (v == null) return null;
  if (typeof v === "boolean") return v;
  if (typeof v === "number")  return v > 0;
  if (typeof v === "string")  return v === "true" || v === "1" || v === "yes";
  return null;
}

// ─────────────────────────────────────────────────────────────
// 3. WEIGHT EXTRACTION  ← NEW in v2
//
// Parses the weight/volume from a product name.
// Returns a normalized string like "25კგ", "5ლ", "500გრ", "1.5კგ"
// Returns null if no weight/volume token is found.
//
// Supported units: კგ/kg, გრ/gr, ლ/l/lt, მლ/ml
// Longer alternatives are listed first in the regex alternation
// to avoid partial matches (e.g. "lt" before "l").
// ─────────────────────────────────────────────────────────────

function extractWeight(name = "") {
  // (?!\w) prevents matching inside a word like "5label"
  const re = /(\d+(?:[.,]\d+)?)\s*(კგ|გრ|მლ|ml|lt|kg|gr|ლ|l)(?!\w)/i;
  const m = name.match(re);
  if (!m) return null;

  const num = parseFloat(m[1].replace(",", "."));
  if (isNaN(num) || num <= 0) return null;

  // Normalize latin units → Georgian equivalents
  const rawUnit = m[2].toLowerCase();
  const unitMap = { "kg": "კგ", "gr": "გრ", "lt": "ლ", "l": "ლ", "ml": "მლ" };
  const unit = unitMap[rawUnit] || rawUnit;

  // Format as integer when possible ("25.0" → "25"), keep decimals otherwise
  const display = Number.isInteger(num) ? String(Math.round(num)) : String(num);
  return `${display}${unit}`;
}

// ─────────────────────────────────────────────────────────────
// 4. BRAND EXTRACTION
// ─────────────────────────────────────────────────────────────

function extractBrand(name = "") {
  const tokens = tokenize(name);

  // 1. Check against known brands list (highest confidence)
  for (const t of tokens) {
    if (KNOWN_BRANDS.includes(t.toLowerCase())) {
      return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
    }
  }

  // 2. ALL-CAPS latin word ≥ 2 chars (likely unknown brand)
  const capsMatch = name.trim().match(/\b([A-Z]{2,})\b/);
  if (capsMatch) {
    const candidate = capsMatch[1].toLowerCase();
    if (!UNIT_TOKENS.has(candidate)) {
      return capsMatch[1].charAt(0) + capsMatch[1].slice(1).toLowerCase();
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// 5. MODEL EXTRACTION
// Model = latin+digit or digit+latin combo (e.g. cm14, b1, ct84)
// ─────────────────────────────────────────────────────────────

function extractModel(normalizedName = "") {
  const tokens = tokenize(normalizedName);

  const models = tokens.filter(t =>
    /^[a-z]+\d/.test(t) || /^\d+[a-z]/.test(t)
  ).filter(t =>
    !UNIT_TOKENS.has(t) &&
    t.length > 1
  );

  return models.length > 0 ? models[0].toUpperCase() : null;
}

// ─────────────────────────────────────────────────────────────
// 6. PRODUCT TYPE EXTRACTION
// Rules ordered: SPECIFIC first, GENERIC last (first match wins).
// ─────────────────────────────────────────────────────────────

const TYPE_RULES = [
  {
    type: "წებოცემენტი",
    phrases: [
      "წებოცემენტი", "წებო ცემენტი", "წებო-ცემენტი",
      "ფილის წებო", "კერამიკული ფილის წებო",
      "კერამოგრანიტის წებო", "კერამიკული წებო",
      "tile adhesive", "tile cement", "tileadhesive",
    ],
  },
  { type: "ფუგა",        phrases: ["ფუგა", "შეერთება", "grout", "joint filler"] },
  { type: "ჰიდროიზოლაცია", phrases: ["ჰიდროიზოლაცია", "waterproof", "waterproofing", "hydroisolation"] },
  { type: "იზოლაცია",   phrases: ["იზოლაცია", "insulation", "thermal", "acoustic"] },
  { type: "გრუნტი",     phrases: ["გრუნტი", "primer", "priming"] },
  { type: "შტუკატური",  phrases: ["შტუკატური", "plaster", "rendering"] },
  { type: "შპაკლი",     phrases: ["შპაკლი", "filler", "putty", "spackling"] },
  { type: "თაბაშირი",   phrases: ["თაბაშირი", "gypsum", "gyproc"] },
  { type: "ცემენტი",    phrases: ["ცემენტი", "cement"] },
  { type: "საღებავი",   phrases: ["საღებავი", "paint", "coating", "ლაქი", "lacquer", "varnish"] },
  { type: "სილიკონი",   phrases: ["სილიკონი", "silicone", "sealant"] },
  { type: "ქაფი",       phrases: ["ქაფი", "foam", "mounting foam"] },
  { type: "მასტიკა",    phrases: ["მასტიკა", "მასტიკი", "mastic"] },
  { type: "ბეტონი",     phrases: ["ბეტონი", "concrete"] },
  // generic adhesive — LAST so specific types win above
  { type: "წებო",       phrases: ["წებო", "adhesive", "glue"] },
];

function extractProductType(name = "") {
  const haystack = name
    .toLowerCase()
    .replace(/[-–—]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const rule of TYPE_RULES) {
    for (const phrase of rule.phrases) {
      if (haystack.includes(phrase.toLowerCase())) {
        return rule.type;
      }
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// 7. GROUPING NAME  ← NEW in v2
//
// A normalized, lowercase string used ONLY for internal grouping.
// NEVER displayed in the UI — use `name` for display.
//
// What it does:
//   • Normalizes Georgian adhesive/type-word variants to canonical
//     forms, so "ფილის წებო" and "წებო-ცემენტი" don't look different
//   • Compacts weight: "25 კგ" → "25კგ" (no space)
//   • Strips punctuation and collapses whitespace
//
// Example:
//   "Ekofix წებო-ცემენტი 25 კგ"  →  "ekofix წებოცემენტი 25კგ"
//   "წებო ფილის Ultrafix Standard 25 კგ" → "წებო ფილის ultrafix standard 25კგ"
//     (the type word gets normalized when group_key is compared)
// ─────────────────────────────────────────────────────────────

// Patterns ordered specific → generic (first match wins per position)
const ADHESIVE_PATTERNS = [
  // Multi-word specific phrases first
  [/კერამოგრანიტ[ა-ჿ]*\s+წებო/g,              "წებოცემენტი"],
  [/კერამიკულ[ა-ჿ]*\s+ფილ[ა-ჿ]*\s+წებო/g,    "წებოცემენტი"],
  [/კერამიკულ[ა-ჿ]*\s+წებო/g,                  "წებოცემენტი"],
  [/ფილ[ა-ჿ]*\s+წებო/g,                        "წებოცემენტი"],
  [/tile\s*adhesive/gi,                         "წებოცემენტი"],
  [/tile\s*cement/gi,                           "წებოცემენტი"],
  // Hyphenated / spaced compound
  [/წებო\s*[-–—]\s*ცემენტ[ა-ჿ]*/g,             "წებოცემენტი"],
  [/წებო\s+ცემენტ[ა-ჿ]*/g,                     "წებოცემენტი"],
  // Standalone "წებო" surrounded by whitespace/boundaries
  [/(^|\s)წებო(\s|$)/g,                        "$1წებოცემენტი$2"],
];

function buildGroupingName(name = "") {
  let s = name.toLowerCase().trim();

  // Apply adhesive normalizations
  for (const [pattern, replacement] of ADHESIVE_PATTERNS) {
    s = s.replace(pattern, replacement);
  }

  // Compact weight tokens: "25 კგ" → "25კგ", "25 kg" → "25კგ"
  s = s.replace(
    /(\d+(?:[.,]\d+)?)\s*(კგ|გრ|მლ|ml|lt|kg|gr|ლ|l)(?!\w)/gi,
    (_, num, unit) => {
      const u = unit.toLowerCase();
      const unitMap = { "kg": "კგ", "gr": "გრ", "lt": "ლ", "l": "ლ", "ml": "მლ" };
      return `${num}${unitMap[u] || u}`;
    }
  );

  // Final cleanup
  return s
    .replace(/[-–—\/\\]+/g, " ")
    .replace(/[^\wა-ჿ\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ─────────────────────────────────────────────────────────────
// 8. NORMALIZED NAME (v1 compat — light display cleanup only)
// ─────────────────────────────────────────────────────────────

function buildNormalizedName(name = "") {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[-–—]{2,}/g, "—")
    .replace(/\s*[-–]\s*/g, "-")
    .trim();
}

// ─────────────────────────────────────────────────────────────
// 9. CANONICAL NAME
// Format: "Brand MODEL product_type"
// ─────────────────────────────────────────────────────────────

function buildCanonicalName(name = "", brand = null, model = null, productType = null) {
  const parts = [];
  if (brand)       parts.push(brand);
  if (model)       parts.push(model);
  if (productType) parts.push(productType);
  if (parts.length >= 2) return parts.join(" ");
  return buildNormalizedName(name);
}

// ─────────────────────────────────────────────────────────────
// 10. GROUP KEY v2  ← Replaces buildGroupKeyFromExtracted
//
// Design: conservative tiered scheme.
// sub_category is ALWAYS the first segment (namespace prefix).
// This guarantees products from different sub_categories NEVER
// share a key — the #1 cause of incorrect grouping in v1.
//
// Weight in the key ensures "25კგ" and "30კგ" get separate keys —
// the #2 cause of incorrect grouping in v1.
//
// Tier hierarchy (most → least confident):
//   T1: {sub}|{brand}|{model}|{weight}   — all identifiers present
//   T2: {sub}|{brand}|{model}            — no weight in name
//   T3: {sub}|{brand}|{weight}[|{extra}] — no model code
//   T4: {sub}|{model}|{weight}           — no brand detected
//   Solo: __solo__{name}|{sub}           — insufficient data; never merged
//
// "Prefer false negatives over false positives":
//   A product staying solo is always safer than being wrongly merged.
// ─────────────────────────────────────────────────────────────

// Sub-category aliases: some stores use short names that mean the same
// category as the canonical name used by other stores.
// "წებო" as a SUB-CATEGORY label from Domino = tile adhesive = "წებოცემენტი"
// This ONLY affects the group key prefix — display is unchanged.
const SUB_CAT_ALIASES = {
  "წებო":         "წებოცემენტი",
  "ფილის წებო":   "წებოცემენტი",
  "ფილისწებო":    "წებოცემენტი",
  "წებო ცემენტი": "წებოცემენტი",
  "წებო-ცემენტი": "წებოცემენტი",
  "ფუგა":         "ფუგა",  // already canonical — listed for clarity
};

/**
 * Normalize a sub_category string into the canonical form used
 * as the group key prefix.
 * Strips dashes/spaces and resolves known aliases.
 */
function canonicalizeSubForKey(sub = "") {
  if (!sub) return null;
  const trimmed = sub.trim();
  const lower   = trimmed.toLowerCase().replace(/[-–—]+/g, " ").replace(/\s+/g, " ").trim();

  // Check alias map (exact match on lowercased+collapsed string)
  if (SUB_CAT_ALIASES[lower]) return SUB_CAT_ALIASES[lower].replace(/[\s\-–—]+/g, "");
  if (SUB_CAT_ALIASES[trimmed]) return SUB_CAT_ALIASES[trimmed].replace(/[\s\-–—]+/g, "");

  // Default: compact (remove spaces and dashes) — same as before
  return trimmed.replace(/[\s\-–—]+/g, "");
}

function buildGroupKeyV2(name, brand, model, subCategory, weight) {
  // Normalize sub_category through alias map for consistent key prefix
  const sub = canonicalizeSubForKey(subCategory);
  const b = brand  ? brand.toLowerCase()  : null;
  const m = model  ? model.toLowerCase()  : null;
  const w = weight || null;

  // T1: brand + model + weight  — most reliable
  if (b && m && w) {
    return sub ? `${sub}|${b}|${m}|${w}` : `${b}|${m}|${w}`;
  }

  // T2: brand + model  — reliable (weight absent from product name)
  if (b && m) {
    return sub ? `${sub}|${b}|${m}` : `${b}|${m}`;
  }

  // T3: brand + weight  — moderate confidence
  // Add first distinctive non-brand latin token for extra context
  if (b && w) {
    const norm = normStr(name);
    const extraLatin = norm.split(" ")
      .filter(t =>
        /^[a-z][a-z0-9]*$/.test(t) &&
        t !== b &&
        !UNIT_TOKENS.has(t) &&
        t.length > 2
      )
      .slice(0, 1);
    const extra = extraLatin.length ? `|${extraLatin[0]}` : "";
    return sub ? `${sub}|${b}|${w}${extra}` : `${b}|${w}${extra}`;
  }

  // T4: model + weight  — moderate (brand unknown but model is specific)
  if (m && w) {
    return sub ? `${sub}|${m}|${w}` : `${m}|${w}`;
  }

  // Solo: not enough reliable information to group safely.
  // Each product gets a unique key → shown as-is, never merged.
  // name slice keeps the key human-readable in logs.
  const nameSlug = name.replace(/[|]/g, "_").slice(0, 60);
  return `__solo__${nameSlug}|${sub || "nosub"}`;
}

// Legacy export — kept for any external callers that used buildGroupKey directly
export function buildGroupKey(name = "") {
  return buildGroupKeyV2(name, null, null, null, null);
}

// ─────────────────────────────────────────────────────────────
// 11. MAIN EXPORT — normalizeProduct()
// ─────────────────────────────────────────────────────────────

/**
 * Normalize a raw product hit from MeiliSearch (or Firebase)
 * into a consistent structure regardless of source store.
 *
 * Field contract:
 *   name            — original product name, NEVER modified
 *   normalized_name — light punctuation/spacing cleanup; safe to display
 *   grouping_name   — Georgian type-word normalized; INTERNAL ONLY
 *   canonical_name  — "Brand MODEL type"; compact display name
 *   group_key       — grouping key (v2); includes sub_category + weight
 *   weight          — extracted weight e.g. "25კგ"; null if none found
 *
 * @param {Object} raw - raw product object from any store scraper
 * @returns {Object} normalized product
 */
export function normalizeProduct(raw = {}) {
  const name        = (resolveField(raw, "name", "title", "product_name") || "").trim();
  const subCategory = resolveSubCategory(raw) ?? null;
  const brand       = extractBrand(name);
  const normN       = normStr(name);
  const model       = extractModel(normN);
  const productType = extractProductType(name);
  const weight      = extractWeight(name);       // ← NEW v2
  const canonicalN  = buildCanonicalName(name, brand, model, productType);
  const groupingN   = buildGroupingName(name);   // ← NEW v2

  return {
    // ── Identity ──────────────────────────────────────────────
    id:    resolveField(raw, "uid", "id", "product_id") ?? null,
    store: resolveField(raw, "store", "store_id", "shop") ?? null,

    // ── Name fields ───────────────────────────────────────────
    name,                                          // original — NEVER overwritten
    normalized_name: buildNormalizedName(name),    // light cleanup; safe to display
    canonical_name:  canonicalN,                   // Brand MODEL type; compact display
    grouping_name:   groupingN,                    // ← NEW v2; INTERNAL ONLY, never display

    // ── Group key (v2) ────────────────────────────────────────
    group_key: buildGroupKeyV2(name, brand, model, subCategory, weight),

    // ── Extracted metadata ────────────────────────────────────
    brand,
    model,
    product_type: productType,
    weight,                                        // ← NEW v2; e.g. "25კგ" | null

    // ── Pricing ───────────────────────────────────────────────
    price:     resolvePrice(raw),
    old_price: resolveOldPrice(raw),

    // ── Media / links ─────────────────────────────────────────
    image:      resolveImage(raw),
    url:        resolveUrl(raw),
    image_hash: resolveField(raw, "image_hash") ?? null,  // phash hex from scraper

    // ── Classification ────────────────────────────────────────
    category:          resolveField(raw, "category") ?? null,
    sub_category:      subCategory,           // original — preserved for display
    sub_category_key:  canonicalizeSubForKey(subCategory), // normalized — used for grouping/comparing

    // ── Details ───────────────────────────────────────────────
    description:  resolveField(raw, "description", "desc") ?? null,
    specs:        resolveField(raw, "specs", "specifications", "attributes") ?? null,
    in_stock:     resolveInStock(raw),
    brand_raw:    resolveField(raw, "brand") ?? null,
    code:         resolveField(raw, "code", "sku", "article") ?? null,
    last_updated: resolveField(raw, "last_updated", "updated_at") ?? null,
  };
}

/**
 * Normalize an array of raw products. Convenience wrapper.
 */
export function normalizeProducts(rawList = []) {
  return rawList.map(normalizeProduct);
}

// ─────────────────────────────────────────────────────────────
// 12. MANUAL OVERRIDE MERGE  ← NEW (Admin Edit System)
//
// Merges a normalized product with its manual_override record
// from Firebase (/manual_overrides/{uid}).
//
// Priority: manual field > auto field
// group_key override:
//   • if manual_group_id is set, it REPLACES the auto group_key so
//     groupProducts() routes it into the manual bucket
//   • if manual_force_solo === true, force a unique solo group key so
//     auto grouping and post-merge logic cannot merge it back
//
// NEVER call this before normalizeProduct() — it must receive
// an already-normalized product.
// ─────────────────────────────────────────────────────────────

/**
 * Apply a per-product manual override to an already-normalized product.
 *
 * @param {Object} product  — output of normalizeProduct()
 * @param {Object} override — record from /manual_overrides/{uid}, or null
 * @returns {Object} merged product (override fields win)
 */
export function applyManualOverride(product, override) {
  if (!override) return product;

  const o = override;

  // Unmerge safety: once a product is manually removed from a group,
  // keep it in its own unique bucket until an admin explicitly merges it again.
  const forcedSoloKey = `__manual_solo__${product.id || product.name || Math.random()}`;

  // Grouping priority:
  // 1. force solo
  // 2. manual group
  // 3. auto group key
  const nextGroupKey = o.manual_force_solo
    ? forcedSoloKey
    : (o.manual_group_id || product.group_key);

  return {
    ...product,

    // Name: manual_name overrides display; also update canonical_name
    name:           o.manual_name || product.name,
    canonical_name: o.manual_name || o.manual_group_name || product.canonical_name,

    // Image
    image:          o.manual_image_url || product.image,

    // Description
    description:    o.manual_description || product.description,

    // Classification
    category:       o.manual_category || product.category,
    sub_category:   o.manual_sub_category || product.sub_category,
    // Recompute sub_category_key if sub_category was overridden
    sub_category_key: o.manual_sub_category
      ? canonicalizeSubForKey(o.manual_sub_category)
      : product.sub_category_key,

    // Grouping
    group_key: nextGroupKey,

    // Admin flags
    manual_locked: o.manual_locked === true,
    manual_force_solo: o.manual_force_solo === true,

    // Carry raw override reference for UI (e.g. to show edit badge)
    _override: o,
  };
}

/**
 * Apply a group-level display override to a ProductGroup object
 * (output of groupProducts()). Called after groupProducts() returns.
 *
 * @param {Object} group        — ProductGroup from groupProducts()
 * @param {Object} groupOverride — record from /group_overrides/{key}, or null
 * @returns {Object} group with display fields overridden
 */
export function applyGroupOverride(group, groupOverride) {
  if (!groupOverride) return group;

  const go = groupOverride;

  return {
    ...group,
    canonical_name: go.display_name        || group.canonical_name,
    image:          go.display_image       || group.image,
    category:       go.display_category    || group.category,
    sub_category:   go.display_sub_category || group.sub_category,
    _group_override: go,
  };
}
