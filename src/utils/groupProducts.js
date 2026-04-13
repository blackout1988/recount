// ═══════════════════════════════════════════════════════════════
// RECOUNT.GE — utils/groupProducts.js  v2.0
//
// Changes from v1:
//   + all_names       — array of ALL original product names in group
//                       Used by filterRelevantGroups so no product
//                       "disappears" from search after grouping.
//   + search_tokens   — flat set of unique lowercase tokens from
//                       all member names; ready for search matching.
//   + price_discrepancy — flag when price diff > 20% within group
//   + sub_category safety check — if a bucket (unlikely with v2 keys)
//                       somehow has mixed sub_categories, it is split.
//
// NOTE: The core grouping correctness fix is in normalizeProduct.js v2:
//   • V2 group_key includes sub_category + weight, so the bucketing
//     logic here is already safe. The additions in this file are
//     "defence in depth" and searchability improvements.
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Pick the best canonical_name from a group.
 * Strategy: prefer the shortest non-empty string —
 * shorter usually means cleaner (brand + model + type, less noise).
 */
function pickCanonicalName(items) {
  const names = items
    .map(p => p.canonical_name)
    .filter(n => n && n.trim().length > 0);

  if (names.length === 0) return items[0]?.name || "";
  return names.reduce((best, n) => (n.length < best.length ? n : best));
}

/**
 * Pick the best image URL from a sorted (cheapest-first) group.
 * Prefers the cheapest in-stock item, then cheapest overall,
 * then any item that has an image.
 */
function pickImage(sortedItems) {
  const inStockWithImage = sortedItems.find(p => p.in_stock && p.image);
  if (inStockWithImage) return inStockWithImage.image;

  const anyWithImage = sortedItems.find(p => p.image);
  return anyWithImage?.image ?? null;
}

/**
 * Deduplicate within a group: keep only the cheapest product
 * per store. Tiebreak by in_stock status.
 */
function deduplicateByStore(items) {
  const byStore = new Map();

  for (const p of items) {
    const store = p.store || "__unknown__";
    const existing = byStore.get(store);

    if (!existing) {
      byStore.set(store, p);
      continue;
    }

    const newPrice = p.price ?? Infinity;
    const oldPrice = existing.price ?? Infinity;

    if (newPrice < oldPrice) {
      byStore.set(store, p);
    } else if (newPrice === oldPrice && p.in_stock && !existing.in_stock) {
      byStore.set(store, p);
    }
  }

  return [...byStore.values()];
}

/**
 * Sort products by price ascending (null prices go to end).
 */
function sortByPrice(items) {
  return [...items].sort((a, b) => {
    const pa = a.price ?? Infinity;
    const pb = b.price ?? Infinity;
    return pa - pb;
  });
}

/**
 * Calculate savings percentage: ((highest - cheapest) / highest) × 100
 */
function calcSavings(cheapest, highest) {
  if (cheapest == null || highest == null) return null;
  if (highest <= cheapest) return null;
  return Math.round(((highest - cheapest) / highest) * 100);
}

/**
 * Pick the most representative field value across group items.
 * Returns the most common non-null value.
 */
function pickField(items, field) {
  const counts = new Map();
  for (const p of items) {
    const v = p[field];
    if (v != null && v !== "") {
      counts.set(v, (counts.get(v) || 0) + 1);
    }
  }
  if (counts.size === 0) return null;
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Build a flat, deduplicated set of lowercase search tokens
 * from all product names in the group.
 *
 * This powers the "no grouped product disappears" guarantee:
 * filterRelevantGroups can check these tokens against the query
 * so even solo products with unusual name formats are found.
 *
 * @param {Object[]} items - normalized products
 * @returns {string[]}  unique lowercase tokens
 */
function buildSearchTokens(items) {
  const tokens = new Set();

  for (const p of items) {
    // Include original name, canonical_name, grouping_name, brand, model
    const sources = [
      p.name,
      p.canonical_name,
      p.grouping_name,
      p.brand,
      p.model,
    ].filter(Boolean);

    for (const src of sources) {
      src
        .toLowerCase()
        .replace(/[-–—\/\\]+/g, " ")
        .replace(/[^\wა-ჿ\s]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .split(" ")
        .filter(t => t.length > 1)
        .forEach(t => tokens.add(t));
    }
  }

  return [...tokens];
}

/**
 * Safety net: split a raw bucket by sub_category.
 *
 * With V2 group_keys this should rarely (never?) produce splits
 * because sub_category is the key's first segment. But if a raw
 * product lacks sub_category, multiple such products can land in
 * the same bucket. This prevents cross-category merges.
 *
 * @param {Object[]} items
 * @returns {Object[][]} one sub-array per distinct sub_category
 */
function splitBySubCategory(items) {
  const bySub = new Map();

  for (const p of items) {
    const sub = p.sub_category || "__nosub__";
    if (!bySub.has(sub)) bySub.set(sub, []);
    bySub.get(sub).push(p);
  }

  return [...bySub.values()];
}

/**
 * Convert a single normalized product into a minimal ProductGroup.
 * Used for flat/solo display (e.g. when activeStore is selected).
 */
function productToGroup(p) {
  const price = p.price ?? null;
  return {
    group_key:               p.group_key || `__solo__${p.id || p.name}`,
    canonical_name:          p.canonical_name || p.name || "",
    brand:                   p.brand,
    model:                   p.model,
    product_type:            p.product_type,
    category:                p.category,
    sub_category:            p.sub_category,
    sub_category_key:        p.sub_category_key || null,
    image:                   p.image,
    weight:                  p.weight,
    grouping_name:           p.grouping_name ?? null,
    image_hash:              p.image_hash ?? null,
    manual_force_solo:       p.manual_force_solo === true,
    items:                   [p],
    products_sorted_by_price:[p],
    cheapest_price:          price,
    highest_price:           price,
    savings_percent:         null,
    cheapest_store:          p.store,
    stores:                  p.store ? [p.store] : [],
    stores_count:            1,
    multi:                   false,
    // v2 additions
    all_names:               [p.name].filter(Boolean),
    search_tokens:           buildSearchTokens([p]),
    price_discrepancy:       false,
  };
}

// ─────────────────────────────────────────────────────────────
// POST-MERGE HELPERS
//
// A second, controlled pass that merges groups the main key-based
// bucketing kept separate, but which are clearly the same product
// with a minor model suffix variant (e.g. MC225 vs MC225X).
//
// ALL four conditions must be true for a merge to happen:
//   1. same sub_category  — never cross categories
//   2. same brand         — same manufacturer required
//   3. same weight        — "25კგ" ≠ "30კგ"
//   4. model suffix rule  — suffix is 1–2 alpha chars only, NO digits
//
// Safe:   MC225  → MC225X   suffix="X"   → 1 letter variant ✓
// Safe:   CT84   → CT84S    suffix="S"   → Standard/Special ✓
// Unsafe: K3     → K5       different digit → rejected ✗
// Unsafe: CM9    → CM11     cm9 not prefix of cm11 → rejected ✗
// Unsafe: CM9    → CM9Plus  suffix="plus" → 4 chars → rejected ✗
// ─────────────────────────────────────────────────────────────

/**
 * Check whether two model codes are safe suffix variants.
 * One model must be an exact prefix of the other, and the extra
 * suffix must be 1–2 alphabetic chars only (no digits).
 */
function isModelSuffixVariant(modelA, modelB) {
  if (!modelA || !modelB) return false;
  const a = modelA.toLowerCase();
  const b = modelB.toLowerCase();
  if (a === b) return true;

  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (!longer.startsWith(shorter)) return false;

  const suffix = longer.slice(shorter.length);
  // 1–2 alphabetic chars ONLY — digit in suffix = different product
  return /^[a-z]{1,2}$/.test(suffix);
}

/**
 * Returns true only when all four safety conditions pass.
 */
function canSoftMerge(g1, g2) {
  // Admin unmerge override: never auto-merge force-solo products/groups.
  if (g1.manual_force_solo || g2.manual_force_solo) return false;
  // Compare NORMALIZED sub_category keys — not raw display values.
  // Domino may label "წებო", Gorgia "წებოცემენტი": same category, different label.
  // sub_category_key is set by normalizeProduct → canonicalizeSubForKey.
  const sub1 = g1.sub_category_key || g1.sub_category;
  const sub2 = g2.sub_category_key || g2.sub_category;
  if (!sub1 || !sub2) return false;
  if (sub1 !== sub2) return false;

  if (!g1.brand || !g2.brand) return false;
  if (g1.brand.toLowerCase() !== g2.brand.toLowerCase()) return false;

  // Weight matching — three cases:
  //   Both present + different  → different sizes → REJECT
  //   Both present + identical  → same size → OK
  //   One null, one non-null    → store omitted weight from name → OK
  //     (e.g. Domino: "Ceresit CM14 წებო" vs Gorgia: "Ceresit CM14 25კგ")
  //   Both null                 → weight unknown for both → OK (model must match)
  if (g1.weight && g2.weight && g1.weight !== g2.weight) return false;

  if (!g1.model || !g2.model) return false;
  if (!isModelSuffixVariant(g1.model, g2.model)) return false;

  return true;
}

/**
 * Rebuild summary fields of a group after its items list changes.
 */
function rebuildGroupStats(group) {
  const sorted = sortByPrice(deduplicateByStore(group.items));

  const validPrices = sorted
    .map(p => p.price)
    .filter(v => v != null && isFinite(v));

  const cheapestPrice = validPrices.length > 0 ? Math.min(...validPrices) : null;
  const highestPrice  = validPrices.length > 0 ? Math.max(...validPrices) : null;

  group.items                    = sorted;
  group.products_sorted_by_price = sorted;
  group.cheapest_price           = cheapestPrice;
  group.highest_price            = highestPrice;
  group.savings_percent          = calcSavings(cheapestPrice, highestPrice);
  group.price_discrepancy        = cheapestPrice != null && highestPrice != null && highestPrice > 0
    ? (highestPrice - cheapestPrice) / highestPrice > 0.20
    : false;
  group.cheapest_store           = sorted[0]?.store ?? null;
  group.stores                   = sorted.map(p => p.store).filter(Boolean);
  group.stores_count             = sorted.length;
  group.multi                    = sorted.length > 1;
  group.image                    = pickImage(sorted);
  group.canonical_name           = pickCanonicalName(sorted);
  group.all_names                = [...new Set(group.items.map(p => p.name).filter(Boolean))];
  group.search_tokens            = buildSearchTokens(group.items);
  group.sub_category             = pickField(sorted, "sub_category");
  group.sub_category_key         = pickField(sorted, "sub_category_key");
  group.grouping_name             = pickField(sorted, "grouping_name");
  group.image_hash                = sorted[0]?.image_hash ?? null;
  group.manual_force_solo         = group.items.some(p => p.manual_force_solo === true);
  return group;
}

/**
 * Post-merge pass: scan all groups for safe suffix-variant pairs.
 * O(n²) — acceptable, n is typically < 500 groups per page.
 */

// ─────────────────────────────────────────────────────────────
// SCORE-BASED MERGE HELPERS  (image_hash + name similarity)
//
// Runs as a SECOND pass in postMergeGroups, after canSoftMerge.
// canSoftMerge handles the clean brand+model+suffix case.
// canScoreMerge handles fuzzier matches where enough signals agree.
//
// Hard gates (ALL required — non-negotiable):
//   1. same sub_category_key
//   2. weights compatible  (both null | one null | both identical)
//   3. price diff <= 20%   (or missing price data)
//
// Soft signals (scored — need total >= MERGE_THRESHOLD):
//   brand match             +2 pts
//   model match/suffix      +3 pts
//   grouping_name sim≥0.70  +3 pts  (sim≥0.50 → +1 pt)
//   image hash Hamming ≤ 8  +2 pts  (helper only)
//
// MERGE_THRESHOLD = 5 → requires at least 2 strong signals.
// Image alone (2 pts) never triggers a merge.
// Name alone (3 pts) never triggers a merge.
// ─────────────────────────────────────────────────────────────

const MERGE_THRESHOLD = 5;
const IMAGE_HAMMING_MAX = 8;   // pHash Hamming distance threshold

/**
 * Hamming distance between two hex pHash strings.
 * Returns Infinity if either hash is missing or lengths differ.
 */
function hammingDistance(h1, h2) {
  if (!h1 || !h2 || h1.length !== h2.length) return Infinity;
  let dist = 0;
  for (let i = 0; i < h1.length; i++) {
    let xor = parseInt(h1[i], 16) ^ parseInt(h2[i], 16);
    while (xor) { dist += xor & 1; xor >>= 1; }
  }
  return dist;
}

/**
 * Check if ANY product in group1 has an image similar to
 * ANY product in group2 (Hamming distance ≤ IMAGE_HAMMING_MAX).
 * Checks all combinations to handle missing hashes on some items.
 */
function anyImagesSimilar(group1, group2) {
  const h1 = group1.items.map(p => p.image_hash).filter(Boolean);
  const h2 = group2.items.map(p => p.image_hash).filter(Boolean);
  for (const a of h1) {
    for (const b of h2) {
      if (hammingDistance(a, b) <= IMAGE_HAMMING_MAX) return true;
    }
  }
  return false;
}

/**
 * Token Jaccard similarity between two strings.
 * Splits on whitespace, filters short tokens, returns 0–1.
 */
function tokenSimilarity(str1 = "", str2 = "") {
  const tok = s => new Set(
    s.toLowerCase()
      .replace(/[-–—/]+/g, " ")
      .replace(/[^\wა-ჿ\s]/g, "")
      .split(/\s+/)
      .filter(t => t.length > 1)
  );
  const a = tok(str1);
  const b = tok(str2);
  if (a.size === 0 || b.size === 0) return 0;
  const intersection = [...a].filter(t => b.has(t)).length;
  return intersection / Math.max(a.size, b.size);
}

/**
 * Check if price difference between two groups is within 20%.
 * Returns true (compatible) if either group has no valid price.
 */
function priceCompatible(g1, g2) {
  const p1 = g1.cheapest_price;
  const p2 = g2.cheapest_price;
  if (p1 == null || p2 == null || p1 <= 0 || p2 <= 0) return true;
  const higher = Math.max(p1, p2);
  return Math.abs(p1 - p2) / higher <= 0.20;
}

/**
 * Score how likely g1 and g2 are the same product.
 * Returns a numeric score; caller compares to MERGE_THRESHOLD.
 */
function mergeScore(g1, g2) {
  let score = 0;

  // Brand match (+2)
  if (g1.brand && g2.brand && g1.brand.toLowerCase() === g2.brand.toLowerCase()) {
    score += 2;
  }

  // Model match — exact or suffix variant (+3)
  if (g1.model && g2.model && isModelSuffixVariant(g1.model, g2.model)) {
    score += 3;
  }

  // grouping_name token similarity
  const nameSim = tokenSimilarity(
    g1.grouping_name || g1.canonical_name || "",
    g2.grouping_name || g2.canonical_name || ""
  );
  if (nameSim >= 0.70) score += 3;
  else if (nameSim >= 0.50) score += 1;

  // Image hash similarity (+2, helper only)
  if (anyImagesSimilar(g1, g2)) score += 2;

  return score;
}

/**
 * Gate checks + scoring merge decision.
 * canSoftMerge (brand+model+suffix) runs first; this is the fallback.
 */
function canScoreMerge(g1, g2) {
  // Admin unmerge override: never auto-merge force-solo products/groups.
  if (g1.manual_force_solo || g2.manual_force_solo) return false;
  // Gate 1: sub_category_key must match (same logic as canSoftMerge)
  const sub1 = g1.sub_category_key || g1.sub_category;
  const sub2 = g2.sub_category_key || g2.sub_category;
  if (!sub1 || !sub2 || sub1 !== sub2) return false;

  // Gate 2: weights — two different non-null weights = different sizes = reject
  if (g1.weight && g2.weight && g1.weight !== g2.weight) return false;

  // Gate 3: price difference must be ≤ 20%
  if (!priceCompatible(g1, g2)) return false;

  // Scoring: need enough signals
  return mergeScore(g1, g2) >= MERGE_THRESHOLD;
}

function postMergeGroups(groups) {
  const absorbed = new Set();

  for (let i = 0; i < groups.length; i++) {
    if (absorbed.has(i)) continue;

    for (let j = i + 1; j < groups.length; j++) {
      if (absorbed.has(j)) continue;

      // Tier 1: strict brand+model+suffix match (no image needed)
      // Tier 2: score-based fallback (needs enough signals incl. optional image)
      const shouldMerge = canSoftMerge(groups[i], groups[j])
                       || canScoreMerge(groups[i], groups[j]);

      if (shouldMerge) {
        groups[i].items = [...groups[i].items, ...groups[j].items];
        rebuildGroupStats(groups[i]);
        absorbed.add(j);
      }
    }
  }

  return groups.filter((_, idx) => !absorbed.has(idx));
}

// ─────────────────────────────────────────────────────────────
// MAIN EXPORT — groupProducts()
// ─────────────────────────────────────────────────────────────

/**
 * Group an array of normalized products into comparison-ready groups.
 *
 * Options:
 *   skipGrouping {boolean} — if true, each product becomes its own
 *     group (used when a single store filter is active; grouping
 *     adds no value and can hide products).
 *
 * @param {Object[]} normalizedProducts
 * @param {Object}   [options]
 * @param {boolean}  [options.skipGrouping=false]
 * @returns {Object[]} ProductGroup[]
 */
export function groupProducts(normalizedProducts = [], options = {}) {
  if (!normalizedProducts.length) return [];

  // ── Fast path: single-store or explicit skip ─────────────
  if (options.skipGrouping) {
    return normalizedProducts.map(productToGroup);
  }

  // ── Step 1: bucket by group_key ──────────────────────────
  const buckets = new Map();

  for (const p of normalizedProducts) {
    const key = (p.group_key && p.group_key.trim())
      ? p.group_key
      : `__solo__${p.id ?? p.name ?? Math.random()}`;

    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(p);
  }

  // ── Step 2: safety — split any bucket by sub_category ────
  // With V2 keys, sub_category is already the key prefix, so this
  // split should produce no change in practice. It guards against
  // edge cases where sub_category is null for some products.
  const safeBuckets = [];
  for (const [, items] of buckets) {
    const subBuckets = splitBySubCategory(items);
    for (const sub of subBuckets) safeBuckets.push(sub);
  }

  // ── Step 3: build ProductGroup for each bucket ──────────
  const groups = [];

  for (const rawItems of safeBuckets) {
    // Deduplicate: 1 item per store (cheapest)
    const deduped = deduplicateByStore(rawItems);

    // Sort within group: cheapest first
    const sorted = sortByPrice(deduped);

    // Price summary
    const validPrices = sorted
      .map(p => p.price)
      .filter(v => v != null && isFinite(v));

    const cheapestPrice = validPrices.length > 0 ? Math.min(...validPrices) : null;
    const highestPrice  = validPrices.length > 0 ? Math.max(...validPrices) : null;

    // Price discrepancy flag (> 20% spread across stores)
    // Useful signal for UI; does NOT force a split.
    // Reason: a 25% diff between Gorgia and Nova for the SAME product
    // is valuable information to show the user — not a data error.
    const priceDiscrepancy = (() => {
      if (cheapestPrice == null || highestPrice == null) return false;
      if (highestPrice <= 0) return false;
      return (highestPrice - cheapestPrice) / highestPrice > 0.20;
    })();

    // All original product names — enables full-text search matching
    // across all group members in filterRelevantGroups
    const allNames = [...new Set(
      rawItems.map(p => p.name).filter(Boolean)
    )];

    groups.push({
      // ── Identity ────────────────────────────────────────
      group_key:      sorted[0]?.group_key || "__unknown__",
      canonical_name: pickCanonicalName(sorted),
      brand:          pickField(sorted, "brand"),
      model:          pickField(sorted, "model"),
      product_type:   pickField(sorted, "product_type"),
      weight:         pickField(sorted, "weight"),
      grouping_name:  pickField(sorted, "grouping_name"),  // used for score-based merge
      image_hash:     sorted[0]?.image_hash ?? null,        // cheapest item's hash
      manual_force_solo: sorted.some(p => p.manual_force_solo === true),

      // ── Classification ──────────────────────────────────
      category:     pickField(sorted, "category"),
      sub_category:     pickField(sorted, "sub_category"),
      sub_category_key:  pickField(sorted, "sub_category_key"),

      // ── Media ───────────────────────────────────────────
      image: pickImage(sorted),

      // ── Items ───────────────────────────────────────────
      items:                    sorted,   // backwards compat alias
      products_sorted_by_price: sorted,  // explicit alias for UI

      // ── Price summary ───────────────────────────────────
      cheapest_price:    cheapestPrice,
      highest_price:     highestPrice,
      savings_percent:   calcSavings(cheapestPrice, highestPrice),
      price_discrepancy: priceDiscrepancy, // ← v2: true if spread > 20%

      // ── Store info ──────────────────────────────────────
      cheapest_store: sorted[0]?.store ?? null,
      stores:         sorted.map(p => p.store).filter(Boolean),
      stores_count:   sorted.length,
      multi:          sorted.length > 1,

      // ── Searchability (v2) ──────────────────────────────
      // all_names:    every original product name that was merged
      //               into this group. filterRelevantGroups uses
      //               this so no product disappears from search.
      // search_tokens: pre-tokenized version for fast matching.
      all_names:     allNames,
      search_tokens: buildSearchTokens(rawItems),
    });
  }

  // ── Step 4: sort groups cheapest-first ──────────────────
  groups.sort((a, b) => {
    const pa = a.cheapest_price ?? Infinity;
    const pb = b.cheapest_price ?? Infinity;
    return pa - pb;
  });

  // ── Step 5: controlled post-merge pass ───────────────────
  // Conservative base grouping stays intact.
  // Only merges pairs that pass ALL four safety conditions:
  //   same sub_category + same brand + same weight + model suffix variant
  // See canSoftMerge() and isModelSuffixVariant() above.
  if (options.skipGrouping) return groups;

  const postMerged = postMergeGroups(groups);

  // Re-sort after potential merges (cheapest prices may have changed)
  postMerged.sort((a, b) => {
    const pa = a.cheapest_price ?? Infinity;
    const pb = b.cheapest_price ?? Infinity;
    return pa - pb;
  });

  return postMerged;
}

/**
 * Returns only groups that have 2+ stores (comparison-ready).
 */
export function multiStoreGroups(normalizedProducts = [], options = {}) {
  return groupProducts(normalizedProducts, options).filter(g => g.multi);
}

/**
 * Flatten groups back to individual products.
 * Useful when switching to single-store view without re-fetching.
 */
export function flattenGroups(groups = []) {
  return groups.flatMap(g => g.items);
}

/**
 * Convenience: convert each product directly to a solo group.
 * Same as groupProducts(products, { skipGrouping: true }).
 */
export { productToGroup };
