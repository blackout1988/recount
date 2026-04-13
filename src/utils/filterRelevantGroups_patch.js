// ═══════════════════════════════════════════════════════════════
// REPLACE the filterRelevantGroups function in RecountApp.jsx
// (lines ~116-163 in the original file)
//
// Changes from v1:
//   • Checks group.brand + group.model directly for latin queries
//     (fixes: solo products with brand-only key were disappearing)
//   • Checks group.search_tokens (all names from all group members)
//     (fixes: "some products disappear from search after grouping")
//   • Logic order preserved; new checks added as extra pass
// ═══════════════════════════════════════════════════════════════

function filterRelevantGroups(groups, query, strict = true) {
  if (!query || !query.trim()) return groups;

  const expanded = expandQuery(query);
  const latinQ   = [...new Set(expanded.flatMap(t => extractLatinTokens(t)))];
  const geoQ     = [...new Set(expanded.flatMap(t => extractGeoTokens(t)))];
  const rawGeoQ  = extractGeoTokens(query);
  const allGeoQ  = [...new Set([...geoQ, ...rawGeoQ])];

  if (latinQ.length === 0 && allGeoQ.length === 0) return groups;

  const isTranslit = isTransliterationQuery(query);

  // Helper: check if a query token matches a candidate token
  const tokenMatch = (qt, candidate) =>
    strict
      ? candidate === qt
      : candidate === qt || candidate.startsWith(qt) || qt.startsWith(candidate);

  return groups.filter(group => {
    // ── Latin query matching ────────────────────────────────
    if (latinQ.length > 0 && !isTranslit) {
      const keyParts = (group.group_key ?? "").toLowerCase().split("|");

      const latinMatch = latinQ.some(qt => {
        // 1. Check group_key segments (fast, most common case)
        if (keyParts.some(kp => tokenMatch(qt, kp))) return true;

        // 2. Check brand and model directly
        //    (solo products with __solo__ key still have these fields)
        const brand = (group.brand || "").toLowerCase();
        const model = (group.model || "").toLowerCase();
        if (brand && tokenMatch(qt, brand)) return true;
        if (model && tokenMatch(qt, model)) return true;

        // 3. Check all search_tokens (covers all member product names)
        //    This guarantees no grouped product disappears from search.
        if (group.search_tokens) {
          if (group.search_tokens.some(tok => tokenMatch(qt, tok))) return true;
        }

        return false;
      });

      if (latinMatch) return true;
      if (allGeoQ.length === 0) return false;
    }

    // ── Georgian query matching ─────────────────────────────
    if (allGeoQ.length > 0) {
      const norm = s => (s || "").toLowerCase().replace(/[-–—\s]+/g, "");

      const nameParts = [
        group.canonical_name ?? "",
        group.product_type   ?? "",
        group.category       ?? "",
        group.sub_category   ?? "",
      ].map(norm);

      const geoMatch = allGeoQ.some(gt => {
        const gtNorm = norm(gt);
        // Check standard fields
        if (nameParts.some(p => p.includes(gtNorm) || gtNorm.includes(p))) return true;
        // Check all member names (handles Georgian brand/type words in any name)
        if (group.search_tokens) {
          return group.search_tokens.some(tok => {
            const tn = norm(tok);
            return tn.includes(gtNorm) || gtNorm.includes(tn);
          });
        }
        return false;
      });

      if (geoMatch) return true;
    }

    if (isTranslit) return true;
    return false;
  });
}
