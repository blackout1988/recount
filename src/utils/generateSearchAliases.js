// ═══════════════════════════════════════════════════════════════
// RECOUNT.GE — src/utils/generateSearchAliases.js
//
// Generates a search_aliases string[] for a product document.
// Called at INDEX TIME (via enrichAliases.js), not at query time.
//
// The output is stored in MeiliSearch as a searchable field, so
// a single idx.search(query) finds products through their aliases.
// This removes the need for complex multi-pass retrieval.
//
// Usage:
//   import { generateSearchAliases } from "./utils/generateSearchAliases";
//   const aliases = generateSearchAliases(normalizedProduct);
//   // → store as product.search_aliases in MeiliSearch
//
// To add a new product type, add ONE entry to TYPE_ALIASES below.
// Everything else is generated automatically from product data.
// ═══════════════════════════════════════════════════════════════

import { normalizeProduct } from "./normalizeProduct.js";

// ─────────────────────────────────────────────────────────────
// TYPE ALIASES — the only manual part
// Key = canonical product_type (from normalizeProduct)
// Value = all search terms that should find this type
//
// Keep this small: one entry per product TYPE, not per product.
// The data-driven logic handles everything else automatically.
// ─────────────────────────────────────────────────────────────
export const TYPE_ALIASES = {
  "წებო-ცემენტი": [
    "წებოცემენტი", "წებო ცემენტი",
    "ფილის წებო", "კერამოგრანიტის წებო", "კერამიკული ფილის წებო",
    "tile adhesive", "tile cement", "adhesive",
    "tsebocementi", "cebocementi", "webocementi",
  ],
  "ფუგა": [
    "grout", "joint filler", "tile grout", "fuga", "fugi",
  ],
  "გრუნტი": [
    "primer", "priming", "grunt", "grundi",
  ],
  "შტუკატური": [
    "plaster", "rendering", "shtukatura", "shtukaturi",
  ],
  "შპაკლი": [
    "filler", "putty", "spackling", "shpakli",
  ],
  "თაბაშირი": [
    "gypsum", "plasterboard", "tabashiri",
  ],
  "ცემენტი": [
    "cement", "cementi", "tsementi",
  ],
  "საღებავი": [
    "paint", "coating", "emulsion", "saghebavi", "lacquer",
  ],
  "სილიკონი": [
    "silicone", "sealant", "silikoni",
  ],
  "ქაფი": [
    "foam", "mounting foam", "pur foam", "qafi",
  ],
  "ჰიდროიზოლაცია": [
    "waterproof", "waterproofing", "hidroizolatsia",
  ],
  "იზოლაცია": [
    "insulation", "thermal insulation", "izolatsia",
  ],
  "ბეტონი": [
    "concrete", "betoni",
  ],
  "მასტიკა": [
    "mastic", "mastika",
  ],
  "პრაიმერი": [
    "primer", "priming", "praimeri",
  ],
};

// ─────────────────────────────────────────────────────────────
// Georgian → Latin phonetic for common construction words
// Used to generate Latin aliases for Georgian product names.
// One entry per distinct Georgian word/phrase.
// ─────────────────────────────────────────────────────────────
const GEO_TO_LAT_PHRASE = {
  "წებოცემენტი":    "tsebocementi",
  "ცემენტი":        "tsementi",
  "ფუგა":           "fuga",
  "გრუნტი":         "grundi",
  "შპაკლი":         "shpakli",
  "შტუკატური":      "shtukatura",
  "თაბაშირი":       "tabashiri",
  "საღებავი":       "saghebavi",
  "სილიკონი":       "silikoni",
  "ქაფი":           "qafi",
  "ბლოკი":          "bloki",
  "აგური":          "aguri",
  "მილი":           "mili",
  "კაბელი":         "kabeli",
  "მუყაო":          "muyao",
  "საკეტი":         "saketi",
  "საყრდენი":       "sayrdeni",
};

// ─────────────────────────────────────────────────────────────
// Georgian single-char → Latin (for model codes typed in Georgian)
// "ცმ14" → "cm14"
// ─────────────────────────────────────────────────────────────
const GEO_CHAR_MAP = {
  "ა":"a","ბ":"b","გ":"g","დ":"d","ე":"e","ვ":"v","ზ":"z",
  "თ":"t","ი":"i","კ":"k","ლ":"l","მ":"m","ნ":"n","ო":"o",
  "პ":"p","ჟ":"j","რ":"r","ს":"s","ტ":"t","უ":"u","ფ":"f",
  "ქ":"k","ღ":"g","ყ":"q","შ":"sh","ჩ":"ch","ც":"c","ძ":"dz",
  "წ":"ts","ჭ":"ch","ხ":"kh","ჯ":"j","ჰ":"h",
};
function geoToLat(str = "") {
  return str.split("").map(ch => GEO_CHAR_MAP[ch] ?? ch).join("");
}

// ─────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────

/** Normalize a string for alias: lowercase + trim */
function n(str = "") {
  return str.toLowerCase().trim();
}

/**
 * Add all meaningful string variants to a Set:
 * - original
 * - no-dash joined ("წებო-ცემენტი" → "წებოცემენტი")
 * - space variant  ("წებო-ცემენტი" → "წებო ცემენტი")
 * - model joined   ("cm 14" → "cm14")
 * - model spaced   ("cm14" → "cm 14")
 */
function addVariants(set, str) {
  if (!str || !str.trim()) return;
  const low = n(str);
  set.add(low);

  // dash/space variants
  const joined = low.replace(/[-–—\s]+/g, "");
  const spaced = low.replace(/[-–—]+/g, " ").replace(/\s+/g, " ").trim();
  const dashed = low.replace(/\s+/g, "-");
  if (joined !== low && joined.length > 1) set.add(joined);
  if (spaced !== low) set.add(spaced);
  if (dashed !== low) set.add(dashed);

  // model code: join short-lat + digit ("cm 14" → "cm14")
  const modelJoined = low.replace(/\b([a-z]{1,4})\s+(\d{1,5})\b/g, "$1$2");
  if (modelJoined !== low) set.add(modelJoined);

  // model code: split letter+digit ("cm14" → "cm 14")
  const modelSpaced = low.replace(/\b([a-z]{1,4})(\d{1,5})\b/g, "$1 $2");
  if (modelSpaced !== low) set.add(modelSpaced);
}

/**
 * Add Latin transliteration alias if a Georgian phrase is recognized.
 */
function addGeoAlias(set, geo) {
  if (!geo) return;
  const normGeo = geo.toLowerCase().replace(/[\s-]+/g, "");
  const lat = GEO_TO_LAT_PHRASE[normGeo] ?? GEO_TO_LAT_PHRASE[geo.toLowerCase()];
  if (lat) set.add(lat);
}

// ─────────────────────────────────────────────────────────────
// MAIN EXPORT — generateSearchAliases()
// ─────────────────────────────────────────────────────────────

/**
 * Generate all search aliases for a normalized product.
 * Call this at index time. Store result as product.search_aliases.
 *
 * @param {Object} normalizedProduct - output of normalizeProduct()
 * @returns {string[]} - deduplicated alias array
 */
export function generateSearchAliases(normalizedProduct) {
  const {
    name,
    normalized_name,
    canonical_name,
    brand,
    model,
    product_type,
    category,
    sub_category,
    code,
  } = normalizedProduct;

  const aliases = new Set();

  // ── 1. Name variants ────────────────────────────────────
  addVariants(aliases, name);
  addVariants(aliases, normalized_name);
  addVariants(aliases, canonical_name);

  // ── 2. Brand ─────────────────────────────────────────────
  if (brand) {
    aliases.add(n(brand));
  }

  // ── 3. Model code and all variants ──────────────────────
  if (model) {
    addVariants(aliases, model);
    // Also try Georgian keyboard version ("ცმ14" → "cm14")
    const latModel = geoToLat(model).toLowerCase();
    if (latModel !== n(model)) addVariants(aliases, latModel);
  }

  // ── 4. Brand + model combinations ───────────────────────
  if (brand && model) {
    const bm = `${n(brand)} ${n(model)}`;
    addVariants(aliases, bm);                    // "ceresit cm14", "ceresit cm 14"
    addVariants(aliases, `${n(model)} ${n(brand)}`); // "cm14 ceresit"
  }

  // ── 5. Product type: data-driven variants + type aliases ─
  if (product_type) {
    addVariants(aliases, product_type);
    addGeoAlias(aliases, product_type);

    // Manual type aliases (the only manual part — per TYPE, not per product)
    const typeKey = Object.keys(TYPE_ALIASES).find(k =>
      k === product_type ||
      n(k) === n(product_type) ||
      k.replace(/[\s-]/g, "") === product_type.replace(/[\s-]/g, "")
    );
    if (typeKey) {
      TYPE_ALIASES[typeKey].forEach(alias => addVariants(aliases, alias));
    }
  }

  // ── 6. Category and sub-category ────────────────────────
  if (category)    { aliases.add(n(category));    addGeoAlias(aliases, category); }
  if (sub_category){ aliases.add(n(sub_category)); addGeoAlias(aliases, sub_category); }

  // ── 7. Product code (SKU) ────────────────────────────────
  if (code) aliases.add(n(code));

  // ── 8. Full searchable phrase: brand + model + type ─────
  // e.g. "ceresit cm14 წებო-ცემენტი" — high-signal composite
  const composite = [brand, model, product_type].filter(Boolean).map(n).join(" ");
  if (composite.trim()) addVariants(aliases, composite);

  // ── 9. Georgian model code variants ─────────────────────
  // If model contains Latin chars that map from Georgian keyboard,
  // add the Georgian-typed version so "ცმ14" finds "cm14" products
  if (model && /[a-z]/i.test(model)) {
    // e.g. "CM14" → also add "ცმ14" to help cross-script matching
    // (MeiliSearch will then find it when user types "ცმ14")
    const geoModel = model
      .toLowerCase()
      .replace(/cm/g, "ცმ")
      .replace(/vs/g, "ვს")
      .replace(/ct/g, "ცტ");
    if (geoModel !== n(model)) aliases.add(geoModel);
  }

  // Clean up: remove empty, single-char, and pure-noise entries
  return [...aliases].filter(a => a && a.trim().length > 1);
}

/**
 * Generate aliases for a raw (un-normalized) product hit from MeiliSearch.
 * Convenience wrapper: normalizes first, then generates aliases.
 *
 * @param {Object} rawHit - raw product from MeiliSearch
 * @returns {string[]}
 */
export function generateAliasesFromRaw(rawHit) {
  const normalized = normalizeProduct(rawHit);
  return generateSearchAliases(normalized);
}
