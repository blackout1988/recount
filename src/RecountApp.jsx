// ═══════════════════════════════════════════════════════════════
// RECOUNT.GE — v5.0  |  Live Search + Price Comparison Engine
// Pipeline: MeiliSearch → normalizeProduct → groupProducts → UI
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from "react";
import MeiliSearch from "meilisearch";
import { normalizeProduct, applyManualOverride, applyGroupOverride } from "./utils/normalizeProduct";
import { groupProducts } from "./utils/groupProducts";
import { expandQuery, normalizeQuery, isTransliterationQuery } from "./utils/searchExpander";
import {
  loadAllOverrides,
  saveProductOverride,
  saveGroupOverride,
  mergeProductsIntoGroup,
  unmergeProduct,
  setGroupLocked,
  clearProductOverride,
  clearGroupOverride,
  sanitizeFirebaseKey,
} from "./utils/manualOverrideService";
import './RecountApp.css';

const client = new MeiliSearch({
  host:   "http://localhost:7700",
  apiKey: "uW_K4inBKuVQJj2jic06rr2DSV_Bc6p_sb6ST9sJt8g",
});
const idx = client.index("products");

// Known stores — label + color.
// ახალი მაღაზიის დამატება: ამ ორ ობიექტს დაამატე ახალი key, დანარჩენი ავტომატია.
const STORE_LABELS = {
  gorgia_ge:"Gorgia", domino_ge:"Domino", citadeli_ge:"Citadeli",
  nova_ge:"Nova",     modus_ge:"Modus",   mihouse_ge:"Mihouse",
};
const STORE_COLORS = {
  gorgia_ge:"#1B6B3A", domino_ge:"#D35400", citadeli_ge:"#C0392B",
  nova_ge:"#6B3DAA",   modus_ge:"#1A6DAF",  mihouse_ge:"#0E7F6E",
};
// Fallback color palette for unknown stores (auto-assigned on first encounter)
const _PALETTE = ["#0369A1","#7C3AED","#B45309","#0F766E","#BE185D","#4338CA","#15803D","#B91C1C"];
let _palIdx = 0; const _autoClr = {};
function storeColor(k){if(STORE_COLORS[k])return STORE_COLORS[k];if(!_autoClr[k])_autoClr[k]=_PALETTE[_palIdx++%_PALETTE.length];return _autoClr[k];}
function storeLabel(k){if(STORE_LABELS[k])return STORE_LABELS[k];return k.replace(/_ge$/,"").replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());}
// Static fallback list used before MeiliSearch data loads
const STORES_LIST_FALLBACK=Object.keys(STORE_LABELS).map(k=>({key:k,label:STORE_LABELS[k]}));
// ── Admin auth ──────────────────────────────────────────────────
// Toggle: Ctrl+Shift+A → password prompt. Stored in localStorage.
const ADMIN_PASSWORD = "recount2026admin"; // GoGa can change this
const ADMIN_LS_KEY   = "recount_admin_v1";
function checkAdminAuth() { return localStorage.getItem(ADMIN_LS_KEY) === "true"; }
function setAdminAuth(v)  { localStorage.setItem(ADMIN_LS_KEY, String(v)); }

const CAT_ICONS = {
  // ნათურა — ელექტრო/განათება
  "ელექტროობა და განათება": <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21h6M12 21v-4M8 14a4 4 0 1 1 8 0c0 1.5-.8 2.8-2 3.5V17H10v-.5C8.8 16.8 8 15.5 8 14z"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="19.78" y1="4.22" x2="18.36" y2="5.64"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/></svg>,
  // ტომარა — მშენებლობის ფხვნილები
  "სამშენებლო ფხვნილები":   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 3h12l1 4H5L6 3z"/><path d="M5 7l1 13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-13"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="10" y1="15" x2="14" y2="15"/></svg>,
  // აგური — კედელი
  "ბლოკი და აგური":         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="4" width="9" height="5" rx="0.5"/><rect x="13" y="4" width="9" height="5" rx="0.5"/><rect x="2" y="11" width="5" height="5" rx="0.5"/><rect x="9" y="11" width="6" height="5" rx="0.5"/><rect x="17" y="11" width="5" height="5" rx="0.5"/><rect x="2" y="18" width="9" height="3" rx="0.5"/><rect x="13" y="18" width="9" height="3" rx="0.5"/></svg>,
  // ფილა/პანელი — გვფური
  "თაბაშირ-მუყაო":          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="4" width="20" height="16" rx="1"/><line x1="2" y1="9" x2="22" y2="9"/><line x1="2" y1="15" x2="22" y2="15"/><line x1="12" y1="4" x2="12" y2="20"/></svg>,
  // კერამიკული ფილები
  "სამშენებლო ფილა":        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="2" width="9" height="9" rx="0.5"/><rect x="13" y="2" width="9" height="9" rx="0.5"/><rect x="2" y="13" width="9" height="9" rx="0.5"/><rect x="13" y="13" width="9" height="9" rx="0.5"/></svg>,
  // I-beam / C-პროფილი
  "სამშენებლო პროფილები":   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="4" y1="4" x2="20" y2="4"/><line x1="4" y1="20" x2="20" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="4" y1="12" x2="8" y2="12"/><line x1="16" y1="12" x2="20" y2="12"/></svg>,
  // ფენები — იზოლაცია
  "ხმის და თბოიზოლაცია":   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 6h20"/><path d="M2 10c4 0 4-3 8-3s4 3 8 3"/><path d="M2 14c4 0 4-3 8-3s4 3 8 3"/><path d="M2 18h20"/></svg>,
  // წვეთი — ჰიდრო
  "ჰიდროიზოლაცია":          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2C7 9 5 13 5 16a7 7 0 0 0 14 0c0-3-2-7-7-14z"/><path d="M9 17c.5 1.5 1.8 2 3 2"/></svg>,
  // სახლი + ჭერი
  "სახურავი და ფასადი":     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 12L12 3l9 9"/><rect x="5" y="12" width="14" height="9"/><path d="M9 21v-6h6v6"/><line x1="9" y1="12" x2="9" y2="12"/></svg>,
  // საღებავის როლიკო
  "საღებავები და ლაქები":   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="5" width="15" height="8" rx="2"/><path d="M17 9h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2"/><path d="M9 13v8"/><rect x="6" y="19" width="6" height="2" rx="1"/></svg>,
  // კუთხური პროფილი — მეტალი
  "ლითონის მასალა":         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4v16h16"/><path d="M4 4h5v5H4z"/><line x1="4" y1="20" x2="20" y2="4"/></svg>,
  // ჭანჭიკი — სახარჯი
  "სახარჯი მასალა":         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="12" y1="2" x2="12" y2="14"/><path d="M9 5h6"/><path d="M9 8h6"/><path d="M10 14l-1 6h6l-1-6"/></svg>,
  // მილი + ონკანი
  "სანტექნიკა კანალიზაცია": <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 3v10a4 4 0 0 0 8 0V9h4"/><path d="M18 6h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-2"/><line x1="10" y1="19" x2="10" y2="22"/><line x1="14" y1="19" x2="14" y2="22"/></svg>,
  // დაფა + ბეჭდები
  "ხის მასალა":              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="6" width="20" height="4" rx="0.5"/><rect x="2" y="12" width="20" height="4" rx="0.5"/><line x1="7" y1="6" x2="7" y2="10"/><line x1="12" y1="6" x2="12" y2="10"/><line x1="17" y1="6" x2="17" y2="10"/><line x1="6" y1="12" x2="6" y2="16"/><line x1="14" y1="12" x2="14" y2="16"/></svg>,
  // რადიატორი
  "გათბობის სისტემა":       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="5" width="20" height="14" rx="1"/><line x1="7" y1="5" x2="7" y2="19"/><line x1="12" y1="5" x2="12" y2="19"/><line x1="17" y1="5" x2="17" y2="19"/><line x1="2" y1="10" x2="22" y2="10"/><line x1="2" y1="14" x2="22" y2="14"/></svg>,
};
function CatIcon({name,size=16}){const p=CAT_ICONS[name];if(!p)return <span style={{width:size,height:size,display:'inline-block'}}>◈</span>;return <span className="cat-svg-ico" style={{width:size,height:size}}>{p}</span>;}

const fmt = v => v != null ? `${Number(v).toFixed(2)} ₾` : "—";

// ═══════════════════════════════════════════════════════════════
// RETRIEVAL HELPERS — query expansion + precision filter
// ═══════════════════════════════════════════════════════════════

const SKIP_SET = new Set([
  "kg","gr","ml","lt","l","g","m","mm","cm","pc",
  "კგ","გრ","მლ","ლ","მ","მმ","სმ","ც","შტ",
]);

function extractLatinTokens(q = "") {
  const norm = q
    .toLowerCase()
    .replace(/[-–—\/]+/g, " ")
    .replace(/([a-z])\s+(\d)/g, "$1$2")
    .replace(/[^\wა-ჿ\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return norm
    .split(" ")
    .filter(t => /^[a-z][a-z0-9]*$/.test(t))
    .flatMap(t => t.replace(/([0-9])([a-z]{2,})/g, "$1 $2").split(" "))
    .map(t => {
      const lp = t.match(/^([a-z]+)/)?.[1] ?? "";
      return (lp.length >= 3 && /[a-z]{3,}\d+$/.test(t)) ? t.replace(/\d+$/, "") : t;
    })
    .filter(t => !/^\d+$/.test(t))
    .filter(t => !SKIP_SET.has(t))
    .filter(t => t.length > 1);
}

function extractGeoTokens(q = "") {
  return q
    .toLowerCase()
    .replace(/[-–—]+/g, " ")
    .replace(/[^\wა-ჿ\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(t => /^[ა-ჿ]/.test(t))
    .filter(t => t.length > 2);
}

async function fetchCandidates(query, filterStr, sort) {
  const baseOpts = {
    sort,
    ...(filterStr && { filter: filterStr }),
  };

  if (!query || !query.trim()) {
    const res = await idx.search("", { ...baseOpts, limit: 300 });
    return res.hits;
  }

  const terms = expandQuery(query);

  const allSearches = terms.map((term, i) =>
    idx.search(term, { ...baseOpts, limit: i === 0 ? 300 : 80 })
      .catch(() => ({ hits: [] }))
  );

  const latinToks = extractLatinTokens(query).slice(0, 2);
  const tokenSearches = latinToks.map(t =>
    idx.search(t, { ...baseOpts, limit: 60 }).catch(() => ({ hits: [] }))
  );

  const results = await Promise.all([...allSearches, ...tokenSearches]);
  const allHits = results.flatMap(r => r.hits ?? []);

  const seen = new Set();
  return allHits.filter(h => {
    const key = h.uid ?? h.id ?? `${h.store ?? ""}|${h.url ?? h.source_url ?? ""}|${h.name ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function filterRelevantGroups(groups, query, strict = true) {
  if (!query || !query.trim()) return groups;

  const expanded = expandQuery(query);
  const latinQ   = [...new Set(expanded.flatMap(t => extractLatinTokens(t)))];
  const geoQ     = [...new Set(expanded.flatMap(t => extractGeoTokens(t)))];
  const rawGeoQ  = extractGeoTokens(query);
  const allGeoQ  = [...new Set([...geoQ, ...rawGeoQ])];

  if (latinQ.length === 0 && allGeoQ.length === 0) return groups;

  const isTranslit = isTransliterationQuery(query);

  // Check if a query token matches a candidate token
  const tokenMatch = (qt, candidate) =>
    strict
      ? candidate === qt
      : candidate === qt || candidate.startsWith(qt) || qt.startsWith(candidate);

  return groups.filter(group => {
    // ── Latin query matching ──────────────────────────────────
    if (latinQ.length > 0 && !isTranslit) {
      const keyParts = (group.group_key ?? "").toLowerCase().split("|");

      const latinMatch = latinQ.some(qt => {
        // 1. group_key segments (fast path — covers T1/T2/T3/T4 keys)
        if (keyParts.some(kp => tokenMatch(qt, kp))) return true;

        // 2. brand and model directly
        //    Solo products (__solo__ key) still have these fields populated —
        //    without this check they would vanish from search results.
        const brand = (group.brand || "").toLowerCase();
        const model = (group.model || "").toLowerCase();
        if (brand && tokenMatch(qt, brand)) return true;
        if (model && tokenMatch(qt, model)) return true;

        // 3. search_tokens — pre-tokenized pool of ALL member product names.
        //    Guarantees no grouped product disappears from search, even when
        //    its original name has different wording than the canonical_name.
        if (group.search_tokens?.length) {
          if (group.search_tokens.some(tok => tokenMatch(qt, tok))) return true;
        }

        return false;
      });

      if (latinMatch) return true;
      if (allGeoQ.length === 0) return false;
    }

    // ── Georgian query matching ───────────────────────────────
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
        // Standard fields
        if (nameParts.some(p => p.includes(gtNorm) || gtNorm.includes(p))) return true;
        // All member name tokens — covers Georgian brand/type words in any variant name
        if (group.search_tokens?.length) {
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


// ═══════════════════════════════════════════════════════════════
// GroupedCard — accepts a ProductGroup object from groupProducts.js
// ProductGroup fields used:
//   canonical_name, image, category, sub_category,
//   products_sorted_by_price, cheapest_price, savings_percent,
//   stores_count, multi, stores
// ═══════════════════════════════════════════════════════════════
function GroupedCard({ group, onOpen, isAdmin, mergeMode, isMergeSelected, onMergeToggle, onAdminEdit }) {
  const { canonical_name, image, category, sub_category,
          products_sorted_by_price: items, cheapest_price,
          savings_percent, stores_count, multi } = group;

  const hasOverride = !!(group._group_override || items?.some(p => p._override));
  const isLocked    = items?.some(p => p.manual_locked);

  const AdminOverlay = () => {
    if (!isAdmin) return null;
    return (
      <div className="card-adm-overlay" onClick={e => e.stopPropagation()}>
        {mergeMode ? (
          <button className={`adm-ico-btn ${isMergeSelected ? "sel" : ""}`}
            title={isMergeSelected ? "მოხსნა" : "მერჯი"}
            onClick={() => onMergeToggle(group)}>
            {isMergeSelected ? "✓" : "⊕"}
          </button>
        ) : (
          <button className="adm-ico-btn" title="რედაქტირება"
            onClick={() => onAdminEdit(group)}>✏️</button>
        )}
      </div>
    );
  };

  // single store → simpler card
  if (!multi) {
    const p = items[0];
    const sc = storeColor(p.store);
    const sl = storeLabel(p.store);
    const pr = p.price != null ? Number(p.price) : null;
    const op = p.old_price != null ? Number(p.old_price) : null;
    const dc = op && pr ? Math.round((1 - pr / op) * 100) : null;
    return (
      <div
        className={`pcard ${mergeMode && isMergeSelected ? "merge-selected" : ""}`}
        onClick={() => mergeMode ? onMergeToggle(group) : onOpen(group)}
      >
        <AdminOverlay />
        <div className="pc-img">
          {image
            ? <img src={image} alt={canonical_name} referrerPolicy="no-referrer"
                onError={e => { e.currentTarget.style.display = "none"; }}/>
            : <div className="pc-img-ph">{CAT_ICONS[category] || "📦"}</div>}
          <span className="pc-sbadge" style={{ color: sc, background: sc + "18" }}>{sl}</span>
          {dc > 0 && <span className="pc-disc">-{dc}%</span>}
        </div>
        <div className="pc-body">
          <div className="pc-name">{canonical_name}</div>
          <div className="pc-pr">
            <span className="pc-price">{pr != null ? fmt(pr) : "—"}</span>
            {op  ? <span className="pc-old">{fmt(op)}</span>
                 : p.in_stock
                   ? <span className="pc-stock ok">✓ მარაგი</span>
                   : <span className="pc-stock no">✕ არ არის</span>}
          </div>
        </div>
        <div className="pc-foot">
          <span className="pc-cat">{sub_category || category}</span>
          {isAdmin && (
            <div style={{display:"flex",alignItems:"center",gap:5,marginLeft:"auto",marginRight:6}}>
              {hasOverride && <span className="override-dot" title="ხელით შეცვლილი"/>}
              {isLocked && <span className="locked-dot" title="დაბლოკილია"/>}
            </div>
          )}
          <button className="pc-cmp" onClick={e => { e.stopPropagation(); onOpen(group); }}>
            შეადარე
          </button>
        </div>
      </div>
    );
  }

  // multi-store grouped card
  return (
    <div
      className={`gcard ${mergeMode && isMergeSelected ? "merge-selected" : ""}`}
      onClick={() => mergeMode ? onMergeToggle(group) : onOpen(group)}
    >
      <AdminOverlay />
      <div className="gcard-img">
        {image
          ? <img src={image} alt={canonical_name} referrerPolicy="no-referrer"
              onError={e => { e.currentTarget.style.display = "none"; }}/>
          : <div className="gcard-img-ph">{CAT_ICONS[category] || "📦"}</div>}
        <div className="gcard-stores-strip">
          {items.map(p => (
            <div key={p.store} className="gcard-strip-seg"
              style={{ background: storeColor(p.store) }}/>
          ))}
        </div>
      </div>

      <div className="gcard-body">
        <div className="gcard-name">{canonical_name}</div>
        <div className="gcard-price-block">
          <div className="gcard-from">{stores_count} მაღაზია — საუკეთესო ფასი</div>
          <div className="gcard-best-price">{cheapest_price != null ? fmt(cheapest_price) : "—"}</div>
          <div className="gcard-stores-list">
            {items.map((p, i) => {
              const sc = storeColor(p.store);
              const sl = storeLabel(p.store);
              return (
                <div key={p.store} className="gcard-store-row">
                  <span className="gcard-store-dot" style={{ background: sc }}/>
                  <span className="gcard-store-name" style={{ color: sc }}>{sl}</span>
                  <span className={`gcard-store-price ${i === 0 ? "best-p" : ""}`}>
                    {p.price != null ? fmt(p.price) : "—"}
                  </span>
                </div>
              );
            })}
          </div>
          {savings_percent > 0 && (
            <div className="gcard-savings">🏷 დაზოგავ ~{savings_percent}%</div>
          )}
        </div>
      </div>

      <div className="gcard-foot">
        <span className="gcard-cat">{sub_category || category}</span>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          {isAdmin && hasOverride && <span className="override-dot" title="ხელით შეცვლილი"/>}
          {isAdmin && isLocked    && <span className="locked-dot"   title="დაბლოკილია"/>}
          <span className="gcard-cnt-badge">{stores_count} მაღ.</span>
        </div>
      </div>
    </div>
  );
}

// ── ProductModal — accepts a ProductGroup object ──────────────
function ProductModal({ group, onClose }) {
  const { canonical_name, image, category, sub_category,
          products_sorted_by_price: items } = group;

  // cheapest in-stock price, fallback to cheapest overall
  const bestPrice = items.find(r => r.in_stock)?.price ?? items[0]?.price;

  const specs = (() => {
    const s = items[0]?.specs;
    return s && typeof s === "object" && !Array.isArray(s) ? Object.entries(s) : [];
  })();

  useEffect(() => {
    const h = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="mov" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="mhdr">
          <div className="m-imgbox">
            {image
              ? <img src={image} alt={canonical_name} referrerPolicy="no-referrer"
                     onError={e => { e.currentTarget.style.display = "none"; }}/>
              : <div className="m-imgph">{CAT_ICONS[category] || "📦"}</div>}
          </div>
          <div className="m-info">
            <div className="m-cat">
              {category}{sub_category ? ` · ${sub_category}` : ""}
            </div>
            <div className="m-name">{canonical_name}</div>
            {items[0]?.brand && <div className="m-meta">ბრენდი: {items[0].brand}</div>}
            {items[0]?.code  && <div className="m-meta">კოდი: {items[0].code}</div>}
          </div>
          <button className="m-close" onClick={onClose}>✕</button>
        </div>

        <div className="mbody">
          {/* Comparison table — data already available, no fetch needed */}
          <div>
            <div className="m-lbl">ფასების შედარება</div>
            <div className="cmp-wrap">
              {items.length === 0 ? (
                <div className="cmp-none">მონაცემი ვერ მოიძებნა</div>
              ) : (
                <table className="cmp-table">
                  <thead>
                    <tr>
                      <th>მაღაზია</th>
                      <th>ფასი</th>
                      <th>ძვ. ფასი</th>
                      <th>მარაგი</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((r, i) => {
                      const rsc    = storeColor(r.store);
                      const rsl    = storeLabel(r.store);
                      const rop    = r.old_price != null ? Number(r.old_price) : null;
                      const isBest = r.price === bestPrice;
                      return (
                        <tr key={r.store + i} className={isBest ? "best" : ""}>
                          <td>
                            <div className="ct-st">
                              <span className="ct-dot" style={{ background: rsc }}/>
                              {rsl}
                              {isBest && <span className="ct-best">საუკეთესო</span>}
                            </div>
                          </td>
                          <td><span className="ct-pr">{fmt(r.price)}</span></td>
                          <td>{rop ? <span className="ct-old">{fmt(rop)}</span> : "—"}</td>
                          <td>
                            {r.in_stock
                              ? <span className="ct-ok">✓ მარაგი</span>
                              : <span className="ct-no">✕ არ არის</span>}
                          </td>
                          <td>
                            {r.url && (
                              <a className="ct-link" href={r.url} target="_blank"
                                 rel="noreferrer" onClick={e => e.stopPropagation()}>
                                ნახვა →
                              </a>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Specs from cheapest item */}
          {specs.length > 0 && (
            <div>
              <div className="m-lbl">მახასიათებლები</div>
              <div className="m-specs">
                {specs.map(([k, v]) => (
                  <div key={k} className="spec-c">
                    <div className="spec-k">{k}</div>
                    <div className="spec-v">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description from cheapest item */}
          {items[0]?.description && (
            <div>
              <div className="m-lbl">აღწერა</div>
              <p className="m-desc">{items[0].description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ── AdminEditModal ────────────────────────────────────────────
function AdminEditModal({ group, productOverrides, groupOverrides, onClose, onSaved }) {
  const groupKey   = group.group_key;
  const gFbKey     = sanitizeFirebaseKey(groupKey);
  const existingGO = groupOverrides[gFbKey] || {};
  const repProduct = group.items?.[0];
  const repUid     = repProduct?.id;
  const repFbKey   = repUid ? sanitizeFirebaseKey(repUid) : null;
  const existingPO = repFbKey ? (productOverrides[repFbKey] || {}) : {};
  const allLocked  = group.items?.every(p => p.manual_locked) || false;

  const [displayName,  setDisplayName]  = useState(existingGO.display_name  || "");
  const [displayImage, setDisplayImage] = useState(existingGO.display_image || "");
  const [displayCat,   setDisplayCat]   = useState(existingGO.display_category || "");
  const [displaySub,   setDisplaySub]   = useState(existingGO.display_sub_category || "");
  // manual_sub_category — ნამდვილი subcategory ცვლილება (არა მხოლოდ ვიზუალური)
  // იყენებს პირველი პროდუქტის manual_sub_category-ს, ან scraped sub_category-ს
  const [manualSub,    setManualSub]    = useState(existingPO.manual_sub_category || repProduct?.sub_category || "");
  const [description,  setDescription]  = useState(existingPO.manual_description || repProduct?.description || "");
  const [locked,       setLocked]       = useState(allLocked);
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [imgErr,       setImgErr]       = useState(false);

  const previewImg = displayImage || group.image;

  useEffect(() => {
    const h = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Group-level visual override
      await saveGroupOverride(groupKey, {
        display_name:         displayName  || null,
        display_image:        displayImage || null,
        display_category:     displayCat   || null,
        display_sub_category: displaySub   || null,
      });

      // 2. Per-product overrides — description + manual_sub_category ყველა პროდუქტზე
      const allUids = group.items?.map(p => p.id).filter(Boolean) || [];
      const subChanged = manualSub && manualSub !== (repProduct?.sub_category || "");

      await Promise.all(group.items?.map(p => {
        if (!p.id) return Promise.resolve();
        const payload = {};
        if (p.id === repUid) payload.manual_description = description || null;
        if (subChanged)      payload.manual_sub_category = manualSub;
        if (Object.keys(payload).length === 0) return Promise.resolve();
        return saveProductOverride(p.id, payload);
      }) || []);

      // 3. MeiliSearch პირდაპირ განახლება — ფილტრი მაშინვე მუშაობს
      if (subChanged && allUids.length > 0) {
        try {
          const meiliDocs = allUids.map(uid => ({ uid, sub_category: manualSub }));
          await idx.updateDocuments(meiliDocs);
        } catch (meiliErr) {
          console.warn("[admin] MeiliSearch sub_category update failed:", meiliErr);
          // Firebase შენახულია — MeiliSearch შემდეგ sync-ზე განახლდება
        }
      }

      if (allUids.length > 0 && locked !== allLocked) {
        await setGroupLocked(allUids, locked);
      }
      setSaved(true);
      setTimeout(() => { setSaved(false); onSaved(); }, 1000);
    } catch (e) {
      console.error("[admin] save error:", e);
      alert("Firebase შეცდომა! Console-ს შეამოწმე.");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!confirm("ყველა override ამ ჯგუფიდან წაიშალოს?")) return;
    setSaving(true);
    try {
      await clearGroupOverride(groupKey);
      if (repUid) await saveProductOverride(repUid, { manual_description: null });
      const allUids = group.items?.map(p => p.id).filter(Boolean) || [];
      if (allUids.length > 0) await setGroupLocked(allUids, false);
      onSaved(); onClose();
    } catch (e) { console.error("[admin] clear error:", e); }
    finally { setSaving(false); }
  };

  const hasExisting = existingGO.display_name || existingGO.display_image ||
    existingGO.display_category || existingGO.display_sub_category ||
    existingPO.manual_description || allLocked;

  const isMergedGroup = group.items?.some(p => p._override?.manual_group_id);

  const handleUnmergeProduct = async (productId) => {
    if (!confirm("ეს პროდუქტი ჯგუფიდან ამოვიღოთ?")) return;
    setSaving(true);
    try {
      await unmergeProduct(productId);
      onSaved(); onClose();
    } catch (e) {
      console.error("[admin] unmerge error:", e);
      alert("შეცდომა! Console-ს შეამოწმე.");
    } finally {
      setSaving(false);
    }
  };

  const handleUnmergeAll = async () => {
    if (!confirm(`ყველა პროდუქტი ამ ჯგუფიდან გამოვიყვანოთ? (${group.items?.length} პროდ.)`)) return;
    setSaving(true);
    try {
      const allUids = group.items?.map(p => p.id).filter(Boolean) || [];
      await Promise.all(allUids.map(uid => unmergeProduct(uid)));
      onSaved(); onClose();
    } catch (e) {
      console.error("[admin] unmerge all error:", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="adm-mov" onClick={onClose}>
      <div className="adm-modal" onClick={e => e.stopPropagation()}>
        <div className="adm-mhdr">
          <span style={{fontSize:20}}>✏️</span>
          <div className="adm-mttl">
            ჯგუფის რედაქტირება
            <span>— {group.canonical_name?.slice(0, 36)}</span>
          </div>
          <button className="m-close" onClick={onClose}>✕</button>
        </div>

        <div className="adm-mbody">
          <div className="adm-sec-ttl">ჯგუფის ჩვენება</div>

          <div className="adm-row">
            <div className="adm-lbl">სახელი</div>
            <input className="adm-inp" value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder={`ავტო: ${group.canonical_name || "—"}`}/>
            <div className="adm-hint">ცარიელი = ავტო სახელი</div>
          </div>

          <div className="adm-row">
            <div className="adm-lbl">სურათის URL</div>
            <div className="adm-img-row">
              {previewImg && !imgErr
                ? <img className="adm-img-preview" src={previewImg} alt=""
                    referrerPolicy="no-referrer" onError={() => setImgErr(true)}/>
                : <div className="adm-img-ph">🖼</div>}
              <input className="adm-inp" style={{flex:1}} value={displayImage}
                onChange={e => { setDisplayImage(e.target.value); setImgErr(false); }}
                placeholder="https://..."/>
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div className="adm-row">
              <div className="adm-lbl">კატეგორია</div>
              <input className="adm-inp" value={displayCat}
                onChange={e => setDisplayCat(e.target.value)}
                placeholder={group.category || "—"}/>
            </div>
            <div className="adm-row">
              <div className="adm-lbl">ქვეკატ.</div>
              <input className="adm-inp" value={manualSub}
                onChange={e => { setManualSub(e.target.value); setDisplaySub(e.target.value); }}
                placeholder={group.sub_category || "—"}/>
              <div className="adm-hint" style={{color: manualSub && manualSub !== (repProduct?.sub_category||"") ? "var(--purple)" : ""}}>
                {manualSub && manualSub !== (repProduct?.sub_category||"")
                  ? `⚠ გადაიტანს კატეგორიაში: "${manualSub}" — Firebase + MeiliSearch განახლდება`
                  : "ცარიელი = ავტო კატეგორია scraper-იდან"}
              </div>
            </div>
          </div>

          <div className="adm-sec-ttl" style={{marginTop:4}}>პროდუქტი ({storeLabel(repProduct?.store || "")})</div>

          <div className="adm-row">
            <div className="adm-lbl">აღწერა</div>
            <textarea className="adm-inp adm-ta" value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="ხელით შეყვანილი აღწერა..."/>
          </div>

          {/* Unmerge section — shown only if group has manually merged products */}
          {group.items?.length > 1 && (
            <div>
              <div className="adm-sec-ttl" style={{marginTop:4}}>ჯგუფის შემადგენლობა</div>
              <div style={{display:"flex",flexDirection:"column",gap:4,marginTop:6}}>
                {group.items.map(p => {
                  const isMerged = !!p._override?.manual_group_id;
                  const sc = storeColor(p.store || "");
                  const sl = storeLabel(p.store || "");
                  return (
                    <div key={p.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:"var(--bg)",border:"1px solid var(--brd)",borderRadius:"var(--r-sm)"}}>
                      <span style={{width:8,height:8,borderRadius:"50%",background:sc,flexShrink:0}}/>
                      <span style={{fontSize:11,fontWeight:700,color:sc,minWidth:52}}>{sl}</span>
                      <span style={{flex:1,fontSize:12,color:"var(--dark)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name?.slice(0,45)}</span>
                      {isMerged && <span style={{fontSize:9,background:"var(--purple-lt)",color:"var(--purple)",padding:"1px 6px",borderRadius:3,fontWeight:700,flexShrink:0}}>manual</span>}
                      <button
                        onClick={() => handleUnmergeProduct(p.id)}
                        disabled={saving}
                        style={{background:"none",border:"1px solid var(--brd)",borderRadius:4,padding:"2px 8px",fontSize:11,color:"var(--txt3)",cursor:"pointer",flexShrink:0,transition:"all .12s"}}
                        onMouseEnter={e=>e.currentTarget.style.cssText+="border-color:var(--red);color:var(--red)"}
                        onMouseLeave={e=>e.currentTarget.style.cssText="background:none;border:1px solid var(--brd);border-radius:4px;padding:2px 8px;font-size:11px;color:var(--txt3);cursor:pointer;flex-shrink:0"}
                        title="ამ პროდუქტის ჯგუფიდან ამოღება"
                      >
                        ✕ ამოღება
                      </button>
                    </div>
                  );
                })}
              </div>
              {group.items.some(p => p._override?.manual_group_id) && (
                <button
                  onClick={handleUnmergeAll}
                  disabled={saving}
                  style={{marginTop:6,width:"100%",padding:"7px",background:"none",border:"1px dashed var(--brd)",borderRadius:"var(--r-sm)",fontSize:12,color:"var(--txt3)",cursor:"pointer"}}
                >
                  ✕ ყველა ამოღება (ჯგუფი დაიშლება)
                </button>
              )}
            </div>
          )}

          <div className="adm-lock" onClick={() => setLocked(v => !v)}>
            <div className="adm-lock-ico">{locked ? "🔒" : "🔓"}</div>
            <div className="adm-lock-txt">
              <div className="adm-lock-lbl">სკრაპერისგან დაცვა</div>
              <div className="adm-lock-sub">
                {locked ? "სკრაპერი ვერ გადაწერს სახელს / სურათს / აღწერას"
                        : "სკრაპერი შეიძლება განაახლებს ავტო ველებს"}
              </div>
            </div>
            <div className={`adm-sw ${locked ? "on" : ""}`}/>
          </div>

          <details style={{fontSize:11,color:"var(--txt3)"}}>
            <summary style={{cursor:"pointer",userSelect:"none"}}>🔑 ტექ. ინფო</summary>
            <div style={{marginTop:6,lineHeight:1.7,wordBreak:"break-all"}}>
              <b>group_key:</b> {groupKey}<br/>
              <b>firebase key:</b> {gFbKey}<br/>
              <b>products:</b> {group.items?.length} ({group.items?.map(p=>p.id).join(", ")})
            </div>
          </details>
        </div>

        <div className="adm-foot">
          {saved ? (
            <div className="adm-saved-msg">✅ შენახულია!</div>
          ) : (
            <>
              <button className="adm-cancel-btn" onClick={onClose}>გაუქმება</button>
              {hasExisting && (
                <button className="adm-clear-btn" onClick={handleClear} disabled={saving}>
                  🗑 გასუფთავება
                </button>
              )}
              <button className="adm-save" onClick={handleSave} disabled={saving}>
                {saving ? "ინახება..." : "💾 შენახვა"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── MergeModal ────────────────────────────────────────────────
function MergeModal({ selectedGroups, onClose, onMerged }) {
  const [mergeName, setMergeName] = useState(selectedGroups[0]?.canonical_name || "");
  const [saving, setSaving] = useState(false);
  const totalProducts = selectedGroups.reduce((s, g) => s + (g.items?.length || 0), 0);

  const handleMerge = async () => {
    if (!mergeName.trim()) return;
    setSaving(true);
    try {
      const manualGroupId = `manual_${Date.now()}`;
      const allUids = selectedGroups.flatMap(g => g.items?.map(p => p.id).filter(Boolean) || []);
      await mergeProductsIntoGroup(allUids, manualGroupId, mergeName.trim());
      onMerged();
    } catch (e) {
      console.error("[admin] merge error:", e);
      alert("Merge შეცდომა! Console-ს შეამოწმე.");
      setSaving(false);
    }
  };

  return (
    <div className="adm-mov" onClick={onClose}>
      <div className="adm-modal" onClick={e => e.stopPropagation()}>
        <div className="adm-mhdr">
          <span style={{fontSize:20}}>🔗</span>
          <div className="adm-mttl">
            გაერთიანება
            <span>— {selectedGroups.length} ჯგუფი, {totalProducts} პროდ.</span>
          </div>
          <button className="m-close" onClick={onClose}>✕</button>
        </div>
        <div className="adm-mbody">
          <div className="adm-merge-info">
            {selectedGroups.map(g => g.canonical_name?.slice(0, 35)).join(" ＋ ")}
          </div>
          <div className="adm-row">
            <div className="adm-lbl">ახალი ჯგუფის სახელი</div>
            <input className="adm-inp" value={mergeName} autoFocus
              onChange={e => setMergeName(e.target.value)} placeholder="სახელი..."/>
            <div className="adm-hint">
              {totalProducts} პროდუქტი გაერთიანდება. manual_group_id Firebase-ში დაიწერება.
            </div>
          </div>
        </div>
        <div className="adm-foot">
          <button className="adm-cancel-btn" onClick={onClose}>გაუქმება</button>
          <button className="adm-save" onClick={handleMerge}
            disabled={saving || !mergeName.trim()}>
            {saving ? "ინახება..." : "🔗 გაერთიანება"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── LiveDropdown ──────────────────────────────────────────────
function LiveDropdown({ suggestions, loading, onSelect, onViewAll, inputVal, onOpenGroup }) {
  if (!inputVal) return null;
  return (
    <div className="live-dd">
      {loading ? (
        <div className="dd-loading"><div className="spin" style={{width:18,height:18,borderWidth:2}}/>ვეძებთ...</div>
      ) : suggestions.length===0 ? (
        <div className="dd-empty">„{inputVal}" — შედეგი ვერ მოიძებნა</div>
      ) : (
        <>
          <div className="dd-sec">შედეგები — ფასი ↑</div>
          <div className="dd-suggs">
            {suggestions.map((s,i) => {
              return (
                <button key={s.uid||i} className="dd-sugg" onClick={() => {
                  onSelect(s.canonical_name || s.name); // commit query
                  if (s._group && onOpenGroup) onOpenGroup(s._group); // modal პირდაპირ
                }}>
                  <div className="dd-sugg-img">
                    {s.image
                      ? <img src={s.image} alt="" referrerPolicy="no-referrer" onError={e=>{e.currentTarget.style.display="none";}}/>
                      : <span className="dd-sugg-ph">{CAT_ICONS[s.category]||"📦"}</span>}
                  </div>
                  <div className="dd-sugg-info">
                    <div className="dd-sugg-name">{s.canonical_name || s.name}</div>
                    <div className="dd-sugg-sub">{s.sub_category||s.category}</div>
                  </div>
                  <div className="dd-sugg-r">
                    {(s.store_prices?.length ? s.store_prices : [{store: s.store, price: s.price ?? s.cheapest_price}]).map((sp, si) => {
                      const sc = storeColor(sp.store);
                      const sl = storeLabel(sp.store);
                      const isBest = si === 0;
                      return (
                        <div key={sp.store} className="dd-sp-row">
                          <span className="dd-sp-label" style={{color: sc}}>{sl}</span>
                          <span className="dd-sp-price" style={{color: isBest ? "#16A34A" : "var(--dark)", fontWeight: isBest ? 800 : 600}}>
                            {sp.price != null ? fmt(sp.price) : "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="dd-footer" onClick={onViewAll}>ყველა შედეგის ნახვა →</div>
        </>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────
// ── SupplierModal — მომწოდებლის რეგისტრაცია ─────────────────
const FB_URL = "https://recount-91f28-default-rtdb.europe-west1.firebasedatabase.app/store_registrations.json";
const BREVO_KEY = import.meta.env.VITE_BREVO_KEY || "";

async function sendSupplierEmail(data) {
  if (!BREVO_KEY) return;
  await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": BREVO_KEY },
    body: JSON.stringify({
      sender:  { name: "RECOUNT.GE", email: "noreply@recount.ge" },
      to:      [{ email: "gogadididze1988@gmail.com", name: "GoGa" }],
      subject: `🏪 ახალი მომწოდებელი: ${data.store_name}`,
      htmlContent: `
        <h2>ახალი მომწოდებლის განაცხადი</h2>
        <table style="border-collapse:collapse;width:100%">
          <tr><td style="padding:6px;font-weight:bold">მაღაზია</td><td style="padding:6px">${data.store_name}</td></tr>
          <tr><td style="padding:6px;font-weight:bold">ვებსაიტი</td><td style="padding:6px">${data.website || "—"}</td></tr>
          <tr><td style="padding:6px;font-weight:bold">საკონტაქტო</td><td style="padding:6px">${data.contact_name}</td></tr>
          <tr><td style="padding:6px;font-weight:bold">ტელეფონი</td><td style="padding:6px">${data.phone || "—"}</td></tr>
          <tr><td style="padding:6px;font-weight:bold">Email</td><td style="padding:6px">${data.email}</td></tr>
          <tr><td style="padding:6px;font-weight:bold">კატეგორიები</td><td style="padding:6px">${data.categories || "—"}</td></tr>
          <tr><td style="padding:6px;font-weight:bold">შენიშვნა</td><td style="padding:6px">${data.notes || "—"}</td></tr>
        </table>
      `,
    }),
  });
}

function SupplierModal({ onClose }) {
  const [form, setForm] = useState({
    company_name: "", id_code: "",
    first_name: "", last_name: "",
    password: "", password2: "",
    email: "", phone: "", notes: "",
  });
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [newsletter, setNewsletter] = useState(false);
  const [showPass, setShowPass]   = useState(false);
  const [showPass2, setShowPass2] = useState(false);
  const [errors,  setErrors]  = useState({});
  const [status,  setStatus]  = useState(null);

  useEffect(() => {
    const h = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(er => ({ ...er, [k]: false })); };

  const validate = () => {
    const e = {};
    if (!form.company_name.trim()) e.company_name = true;
    if (!form.id_code.trim())     e.id_code = true;
    if (!form.first_name.trim())  e.first_name = true;
    if (!form.last_name.trim())   e.last_name = true;
    if (!form.password.trim())    e.password = true;
    if (form.password !== form.password2) e.password2 = true;
    if (!form.email.trim())       e.email = true;
    if (!agreePrivacy)            e.agreePrivacy = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setStatus("sending");
    const data = { ...form, newsletter, submitted_at: new Date().toISOString() };
    try {
      await fetch(FB_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      await sendSupplierEmail(data).catch(() => {});
      setStatus("ok");
    } catch { setStatus("err"); }
  };

  const EyeOpen  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
  const EyeClose = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;

  const Y  = "#F5B800";
  const inp = (err) => ({ width:"100%", padding:"9px 12px", borderRadius:5, border:`1.5px solid ${err?"#ef4444":"var(--brd)"}`, fontSize:13, background:"var(--bg)", color:"var(--dark)", outline:"none", boxSizing:"border-box", fontFamily:"inherit" });
  const lbl  = { fontSize:12, fontWeight:600, color:"var(--txt3)", marginBottom:5, display:"block" };
  const g2   = { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:12, marginBottom:14 };
  const g2t  = { ...({display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:12, marginBottom:14, marginTop:14}) };
  const pw   = { position:"relative" };
  const eye  = { position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"var(--txt3)", padding:2, display:"flex", alignItems:"center" };
  const chkR = (err) => ({ display:"flex", alignItems:"flex-start", gap:10, padding:"10px 12px", borderRadius:8, background:err?"#FEF2F2":"var(--bg2)", border:`1px solid ${err?"#ef4444":"var(--brd)"}`, marginBottom:10, cursor:"pointer" });
  const sec  = { fontSize:11, fontWeight:700, color:"var(--txt3)", textTransform:"uppercase", letterSpacing:"0.06em", margin:"16px 0 10px" };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:"#ffffff", borderRadius:16, width:"100%", maxWidth:660, maxHeight:"92vh", overflowY:"auto", boxShadow:"0 24px 80px rgba(0,0,0,0.5)", isolation:"isolate", display:"flex", flexDirection:"column" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", gap:12, padding:"20px 24px 16px", borderBottom:`3px solid ${Y}`, flexShrink:0 }}>
          <div style={{ width:40, height:40, borderRadius:10, background:Y, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2"><path d="M3 9h18l-1.5 9a2 2 0 0 1-2 1.5H6.5a2 2 0 0 1-2-1.5L3 9z"/><path d="M3 9l1.5-4.5A1 1 0 0 1 5.4 4h13.2a1 1 0 0 1 .9.5L21 9"/><rect x="9" y="13" width="6" height="5" rx="0.5"/></svg>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:800, fontSize:17, color:"var(--dark)" }}>გახდი მომწოდებელი</div>
            <div style={{ fontSize:12, color:"var(--txt3)", marginTop:2 }}>RECOUNT.GE-ზე განთავსება</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:18, color:"var(--txt3)", cursor:"pointer", padding:"4px 8px", borderRadius:6 }}>✕</button>
        </div>

        {status === "ok" ? (
          <div style={{ textAlign:"center", padding:"48px 24px", flex:1 }}>
            <div style={{ fontSize:56, marginBottom:16 }}>🎉</div>
            <div style={{ fontSize:20, fontWeight:800, color:"var(--dark)", marginBottom:8 }}>განაცხადი მიღებულია!</div>
            <div style={{ fontSize:14, color:"var(--txt3)", marginBottom:28 }}>მალე დაგიკავშირდებით — <b>{form.email}</b></div>
            <button onClick={onClose} style={{ background:Y, color:"#000", border:"none", borderRadius:8, padding:"11px 32px", fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>დახურვა</button>
          </div>
        ) : (
          <>
            <div style={{ padding:"4px 24px 8px", flex:1 }}>

              <div style={g2t}>
                <div>
                  <label style={lbl}>კომპანიის დასახელება <span style={{color:"#ef4444"}}>*</span></label>
                  <input style={inp(errors.company_name)} value={form.company_name} placeholder="შპს / სს / ინდ. მეწარმე" onChange={e => set("company_name", e.target.value)} />
                </div>
                <div>
                  <label style={lbl}>საიდენთიფიკაციო კოდი <span style={{color:"#ef4444"}}>*</span></label>
                  <input style={inp(errors.id_code)} value={form.id_code} placeholder="123456789" onChange={e => set("id_code", e.target.value)} />
                </div>
              </div>

              <div style={g2}>
                <div>
                  <label style={lbl}>სახელი <span style={{color:"#ef4444"}}>*</span></label>
                  <input style={inp(errors.first_name)} value={form.first_name} placeholder="სახელი" onChange={e => set("first_name", e.target.value)} />
                </div>
                <div>
                  <label style={lbl}>გვარი <span style={{color:"#ef4444"}}>*</span></label>
                  <input style={inp(errors.last_name)} value={form.last_name} placeholder="გვარი" onChange={e => set("last_name", e.target.value)} />
                </div>
              </div>

              <div style={g2}>
                <div>
                  <label style={lbl}>პაროლი <span style={{color:"#ef4444"}}>*</span></label>
                  <div style={pw}>
                    <input style={{...inp(errors.password), paddingRight:36}} type={showPass?"text":"password"} value={form.password} placeholder="მინ. 6 სიმბოლო" onChange={e => set("password", e.target.value)} />
                    <button type="button" style={eye} onClick={() => setShowPass(v => !v)}>{showPass ? <EyeClose/> : <EyeOpen/>}</button>
                  </div>
                </div>
                <div>
                  <label style={lbl}>გაიმეორეთ პაროლი <span style={{color:"#ef4444"}}>*</span></label>
                  <div style={pw}>
                    <input style={{...inp(errors.password2), paddingRight:36}} type={showPass2?"text":"password"} value={form.password2} placeholder="გაიმეორეთ" onChange={e => set("password2", e.target.value)} />
                    <button type="button" style={eye} onClick={() => setShowPass2(v => !v)}>{showPass2 ? <EyeClose/> : <EyeOpen/>}</button>
                  </div>
                  {errors.password2 && <div style={{color:"#ef4444",fontSize:11,marginTop:4}}>პაროლები არ ემთხვევა</div>}
                </div>
              </div>

              <div style={g2}>
                <div>
                  <label style={lbl}>ელ-ფოსტა <span style={{color:"#ef4444"}}>*</span></label>
                  <input style={inp(errors.email)} type="email" value={form.email} placeholder="info@company.ge" onChange={e => set("email", e.target.value)} />
                </div>
                <div>
                  <label style={lbl}>ტელეფონი</label>
                  <input style={inp(false)} value={form.phone} placeholder="+995 5xx xxx xxx" onChange={e => set("phone", e.target.value)} />
                </div>
              </div>

              <div style={{ marginBottom:14 }}>
                <label style={lbl}>დამატებითი ინფორმაცია</label>
                <textarea style={{...inp(false), minHeight:76, resize:"vertical"}} value={form.notes} placeholder="პროდუქციის კატეგორიები, ვებსაიტი, სხვა..." onChange={e => set("notes", e.target.value)} />
              </div>

              <div style={chkR(errors.agreePrivacy)} onClick={() => { setAgreePrivacy(v => !v); setErrors(er => ({...er, agreePrivacy:false})); }}>
                <input type="checkbox" style={{width:17,height:17,accentColor:Y,flexShrink:0,marginTop:2,cursor:"pointer"}} checked={agreePrivacy} onChange={() => {}} />
                <span style={{fontSize:13,color:"var(--dark)",lineHeight:1.5}}>
                  ვეთანხმები, ჩემი პირადი მონაცემების დამუშავებას{" "}
                  <span style={{color:Y,fontWeight:700,textDecoration:"underline"}} onClick={e => e.stopPropagation()}>შემდეგი სახით:</span>
                  {" "}<span style={{color:"#ef4444"}}>*</span>
                </span>
              </div>


              {status === "err" && <div style={{color:"#ef4444",fontSize:13,marginBottom:8}}>შეცდომა. სცადე თავიდან.</div>}
            </div>

            <div style={{ padding:"14px 24px", borderTop:"1px solid var(--brd)", display:"flex", justifyContent:"flex-end", gap:10, flexShrink:0, background:"#ffffff", borderRadius:"0 0 16px 16px" }}>
              <button onClick={onClose} style={{ background:"none", border:"1.5px solid var(--brd)", borderRadius:8, padding:"10px 20px", fontSize:13, color:"var(--txt3)", cursor:"pointer", fontFamily:"inherit" }}>
                გაუქმება
              </button>
              <button onClick={handleSubmit} disabled={status==="sending"} style={{ background:status==="sending"?"#ccc":Y, color:"#000", border:"none", borderRadius:8, padding:"10px 28px", fontWeight:800, fontSize:14, cursor:status==="sending"?"not-allowed":"pointer", fontFamily:"inherit" }}>
                {status === "sending" ? "იგზავნება..." : "📨 განაცხადის გაგზავნა"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


export default function RecountApp() {
  const [inputVal,    setInputVal]    = useState("");
  const [query,       setQuery]       = useState("");
  const [activeCat,   setActiveCat]   = useState(null);
  const [activeSub,   setActiveSub]   = useState(null);
  const [activeStore, setActiveStore] = useState(null);
  const [sortBy,      setSortBy]      = useState("price_asc");
  const [openCat,     setOpenCat]     = useState(null);
  const [ddMode,      setDdMode]      = useState(null); // null | "cats" | "live"
  const [suggestions, setSuggestions] = useState([]);
  const [suggLoad,    setSuggLoad]    = useState(false);
  const [modal,       setModal]       = useState(null);
  const [products,    setProducts]    = useState([]);
  const [totalHits,   setTotalHits]   = useState(0);
  const [loading,     setLoading]     = useState(false);
  const [catTree,     setCatTree]     = useState([]);
  const [catFacets,   setCatFacets]   = useState({});
  const [ready,       setReady]       = useState(false);
  const [storesList,  setStoresList]  = useState(STORES_LIST_FALLBACK);

  // ── Admin state ─────────────────────────────────────────────
  const [isAdmin,          setIsAdmin]          = useState(checkAdminAuth);
  const [productOverrides, setProductOverrides] = useState({});
  const [groupOverrides,   setGroupOverrides]   = useState({});
  const [overridesReady,   setOverridesReady]   = useState(false);
  const [adminEditTarget,  setAdminEditTarget]  = useState(null);
  const [mergeMode,        setMergeMode]        = useState(false);
  const [mergeSelection,   setMergeSelection]   = useState(new Set());
  const [mergeModal,       setMergeModal]       = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);

  const ddRef         = useRef(null);
  const hdrDdRef      = useRef(null);
  const suggTmr       = useRef(null);
  const justCommitted = useRef(false); // dropdown-ის ხელახლა გახსნის თავიდან ასაცილებლად
  const isSearching = !!(query || activeCat || activeSub || activeStore);

  // ── URL state sync — refresh-ზე state-ი ინახება ─────────────
  // Mount-ზე: URL params → state
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const q   = p.get("q")     || "";
    const cat = p.get("cat")   || null;
    const sub = p.get("sub")   || null;
    const st  = p.get("store") || null;
    if (q)   { setQuery(q); setInputVal(q); }
    if (cat) { setActiveCat(cat); setOpenCat(cat); }
    if (sub) { setActiveSub(sub); }
    if (st)  { setActiveStore(st); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // State → URL (ყოველ ცვლილებაზე)
  useEffect(() => {
    const p = new URLSearchParams();
    if (query)       p.set("q",     query);
    if (activeCat)   p.set("cat",   activeCat);
    if (activeSub)   p.set("sub",   activeSub);
    if (activeStore) p.set("store", activeStore);
    const str = p.toString();
    const newUrl = str ? `${window.location.pathname}?${str}` : window.location.pathname;
    window.history.replaceState(null, "", newUrl);
  }, [query, activeCat, activeSub, activeStore]);

  // ── Admin keyboard shortcut Ctrl+Shift+A ─────────────────────
  useEffect(() => {
    const h = e => {
      if (e.ctrlKey && e.shiftKey && e.key === "A") {
        e.preventDefault();
        if (isAdmin) {
          if (confirm("Admin რეჟიმი გამოირთოს?")) {
            setAdminAuth(false); setIsAdmin(false);
            setMergeMode(false); setMergeSelection(new Set());
          }
        } else {
          const pw = prompt("Admin პაროლი:");
          if (pw === ADMIN_PASSWORD) { setAdminAuth(true); setIsAdmin(true); }
          else if (pw !== null) alert("არასწორი პაროლი");
        }
      }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [isAdmin]);

  // ── Load overrides from Firebase on mount ─────────────────────
  useEffect(() => {
    loadAllOverrides()
      .then(({ products, groups }) => {
        setProductOverrides(products || {});
        setGroupOverrides(groups || {});
      })
      .catch(e => console.warn("[override] load failed:", e))
      .finally(() => setOverridesReady(true));
  }, []);

  const reloadOverrides = useCallback(async () => {
    try {
      const { products, groups } = await loadAllOverrides();
      setProductOverrides(products || {});
      setGroupOverrides(groups || {});
    } catch (e) { console.warn("[override] reload failed:", e); }
  }, []);

  // ── Override helpers ─────────────────────────────────────────
  const applyProdOverrides = useCallback((normalizedList) => {
    if (!overridesReady || !Object.keys(productOverrides).length) return normalizedList;
    return normalizedList.map(p => {
      const ov = productOverrides[sanitizeFirebaseKey(p.id || "")];
      return ov ? applyManualOverride(p, ov) : p;
    });
  }, [productOverrides, overridesReady]);

  const applyGrpOverrides = useCallback((groups) => {
    if (!overridesReady || !Object.keys(groupOverrides).length) return groups;
    return groups.map(g => {
      const go = groupOverrides[sanitizeFirebaseKey(g.group_key || "")];
      return go ? applyGroupOverride(g, go) : g;
    });
  }, [groupOverrides, overridesReady]);

  // Init
  useEffect(()=>{
    idx.updateSettings({
      filterableAttributes:["category","sub_category","store","in_stock","brand"],
      sortableAttributes:["price","name","last_updated"],
      searchableAttributes:["search_aliases","name","brand","model","product_type","category","sub_category","code"],
      pagination:{maxTotalHits:100000},
    }).then(t=>client.waitForTask(t.taskUid,{timeOutMs:60000})).catch(()=>{}).finally(()=>setReady(true));
  },[]);

  // Load categories + stores + total count
  useEffect(()=>{
    if (!ready) return;
    idx.search("",{limit:0,facets:["category","sub_category","store"]}).then(res=>{
      const cats   = res.facetDistribution?.category||{};
      const stores = res.facetDistribution?.store||{};
      setCatFacets(cats);
      setTotalHits(res.estimatedTotalHits??0);

      // Build dynamic stores list — ყველა მაღაზია MeiliSearch-დან, ჯამი კლებადი
      const sortedStores = Object.entries(stores)
        .sort((a, b) => b[1] - a[1])
        .map(([key]) => ({ key, label: storeLabel(key) }));
      if (sortedStores.length > 0) setStoresList(sortedStores);

      const tree=Object.keys(cats).sort().map(name=>({name,subs:[]}));
      Promise.all(tree.map(cat=>
        idx.search("",{limit:0,filter:`category = "${cat.name}"`,facets:["sub_category"]})
          .then(r=>{cat.subs=Object.keys(r.facetDistribution?.sub_category||{}).sort();})
      )).then(()=>setCatTree([...tree]));
    }).catch(console.error);
  },[ready]);

  // Live suggestions (debounced 250ms)
  useEffect(() => {
    if (!ready) return;
    clearTimeout(suggTmr.current);
    if (!inputVal.trim()) {
      setSuggestions([]);
      if (ddMode === "live") setDdMode(null);
      return;
    }

    // commit()-ის შემდეგ dropdown ავტომატურად არ გაიხსნეს
    if (justCommitted.current) {
      justCommitted.current = false;
      return;
    }

    setDdMode("live");
    setSuggLoad(true);

    suggTmr.current = setTimeout(async () => {
      try {
        const normInput = normalizeQuery(inputVal);
        const filterStr = activeCat ? `category = "${activeCat}"` : undefined;
        const raw      = await fetchCandidates(normInput, filterStr, ["price:asc"]);
        const normalized = applyProdOverrides(raw.map(normalizeProduct));
        const groups   = applyGrpOverrides(groupProducts(normalized));
        const relevant = filterRelevantGroups(groups, normInput, false);

        // სრული group object ვინახავთ — modal პირდაპირ გასახსნელად
        const suggs = relevant.slice(0, 8).map(g => ({
          _group: g,  // სრული group object modal-ისთვის
          uid:          g.products_sorted_by_price[0]?.id,
          image:        g.image,
          canonical_name:   g.canonical_name,
          cheapest_price:   g.cheapest_price,
          highest_price:    g.highest_price,
          stores_count:     g.stores_count,
          category:     g.category,
          sub_category: g.sub_category,
          store:        g.cheapest_store,
          store_prices: g.products_sorted_by_price.map(p => ({
            store: p.store, price: p.price,
          })).filter(p => p.store),
        }));

        setSuggestions(suggs);
      } catch {
        setSuggestions([]);
      } finally {
        setSuggLoad(false);
      }
    }, 250);

    return () => clearTimeout(suggTmr.current);
  }, [inputVal, ready, activeCat, applyProdOverrides, applyGrpOverrides]);

  // Main search — smart retrieval: normalize → expand → group → filter
  const doSearch = useCallback(async () => {
    if (!ready) return;

    setLoading(true);

    try {
      const f = [];

      if (activeCat)   f.push(`category = "${activeCat}"`);
      if (activeSub)   f.push(`sub_category = "${activeSub}"`);
      if (activeStore) f.push(`store = "${activeStore}"`);

      const filterStr = f.length ? f.join(" AND ") : undefined;
      const sort = sortBy === "price_desc" ? ["price:desc"] : ["price:asc"];
      const normalizedQ = query ? normalizeQuery(query) : "";


      const candidates = await fetchCandidates(normalizedQ, filterStr, sort);

      const normalized = applyProdOverrides(candidates.map(normalizeProduct));

      // activeStore: skipGrouping=true — groupProducts-ი სრულ ProductGroup სტრუქტურას ქმნის
      // (search_tokens, brand, model...) — filterRelevantGroups-ს ეს ველები სჭირდება.
      // ძველი inline object ამ ველებს აკლებდა → ძებნა მაღაზიის ფილტრით ვერ მუშაობდა.
      const rawGrouped = groupProducts(normalized, { skipGrouping: !!activeStore });
      const grouped = applyGrpOverrides(rawGrouped);


      const filtered = normalizedQ
          ? filterRelevantGroups(grouped, normalizedQ, true)
          : grouped;


      setProducts(filtered);
      // totalHits — ინახავს MeiliSearch-ის საერთო რაოდენობას (init-ზე ჩაიტვირთა)
      // doSearch-ი ვეღარ გადაწერს — header badge სწორ რიცხვს ინახავს
    } catch (e) {
      console.error("Search error:", e);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [ready, query, activeCat, activeSub, activeStore, sortBy, applyProdOverrides, applyGrpOverrides]);

  useEffect(() => {
    if (isSearching) doSearch();
  }, [doSearch, isSearching]);

  // Outside click
  useEffect(()=>{
    const h=e=>{
      if(ddRef.current && !ddRef.current.contains(e.target)) setDdMode(null);
      if(hdrDdRef.current && !hdrDdRef.current.contains(e.target)) setDdMode(null);
    };
    document.addEventListener("mousedown",h);
    return ()=>document.removeEventListener("mousedown",h);
  },[]);

  const commit = val=>{
    justCommitted.current = true;
    setQuery(val); setInputVal(val); setDdMode(null); setSuggestions([]);
  };
  const clearAll = ()=>{
    setQuery(""); setInputVal(""); setActiveCat(null); setActiveSub(null); setActiveStore(null); setDdMode(null); setSuggestions([]);
  };
  const pickCat = name=>{
    setActiveCat(p=>p===name?null:name); setActiveSub(null);
    setOpenCat(p=>p===name?null:name); setDdMode(null);
    setQuery(""); setInputVal(""); // search-ი იწმინდება კატეგორიის გადართვაზე
  };
  const pickSub = sub=>{ setActiveSub(p=>p===sub?null:sub); };
  const pickStore = key=>{ setActiveStore(p=>p===key?null:key); };
  const onKey = e=>{ if(e.key==="Enter") commit(inputVal); if(e.key==="Escape") setDdMode(null); };

  // ── Merge helpers ───────────────────────────────────────────
  const toggleMergeSelect = useCallback((group) => {
    setMergeSelection(prev => {
      const next = new Set(prev);
      if (next.has(group.group_key)) next.delete(group.group_key);
      else next.add(group.group_key);
      return next;
    });
  }, []);

  const exitMergeMode = () => {
    setMergeMode(false);
    setMergeSelection(new Set());
  };

  const selectedGroupObjects = products.filter(g => mergeSelection.has(g.group_key));

  const onAdminSaved = useCallback(async () => {
    setAdminEditTarget(null);
    await reloadOverrides();
    doSearch();
  }, [reloadOverrides, doSearch]);

  const onMergeDone = useCallback(async () => {
    setMergeModal(false);
    exitMergeMode();
    await reloadOverrides();
    doSearch();
  }, [reloadOverrides, doSearch]);

  const SearchIco = ({s=18}) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
  );

  return (
    <>

      {/* HEADER */}
      <header className={`hdr${isAdmin ? " admin-on" : ""}`}>
        <button className="logo" onClick={clearAll}>RE<em>COUNT</em><span className="logo-ge">.GE</span></button>
        {isSearching && (
          <div className="hdr-sw" ref={hdrDdRef}>
            <span className="hdr-ico"><SearchIco s={14}/></span>
            <input className="hdr-inp" value={inputVal} placeholder="მოძებნე..."
              onChange={e=>setInputVal(e.target.value)} onKeyDown={onKey} autoComplete="off"/>
            {inputVal && <button className="hdr-x" onClick={()=>{setInputVal("");setQuery("");setSuggestions([]);setDdMode(null);}}>✕</button>}
            {ddMode==="live" && <LiveDropdown suggestions={suggestions} loading={suggLoad}
              onSelect={commit} onViewAll={()=>commit(inputVal)}
              inputVal={inputVal} onOpenGroup={setModal}/>}
          </div>
        )}
        <span className="hdr-badge">{totalHits.toLocaleString()} პროდუქტი</span>
        <button className="hdr-auth-btn" onClick={()=>alert("შესვლა — მალე!")}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
          შესვლა
        </button>
        <button className="hdr-cart-btn" onClick={()=>alert("კალათა — მალე!")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
        </button>

        {isAdmin && (
          <>
            <span className="admin-badge">⚙ ADMIN</span>
            {isSearching && (
              <button
                className={`admin-toggle-btn ${mergeMode ? "merge-active" : ""}`}
                onClick={() => mergeMode ? exitMergeMode() : (setMergeMode(true), setMergeSelection(new Set()))}
              >
                🔗 {mergeMode ? `Merge (${mergeSelection.size})` : "Merge Mode"}
              </button>
            )}
            <button className="admin-logout" onClick={() => {
              setAdminAuth(false); setIsAdmin(false);
              setMergeMode(false); setMergeSelection(new Set());
            }}>გამოსვლა</button>
          </>
        )}
      </header>
      {/* HERO */}
      {!isSearching && (
        <section className="hero">
          <h1 className="hero-title">მოიძიე, <em>შეადარე,</em> შეიძინე!</h1>
          <p className="hero-sub">— შეადარე ფასები ყველა მომწოდებლისგან ერთ გვერდზე —</p>

          <div className="hsb-outer" ref={ddRef}>
            <div className="hsb">
              <span className="hsb-ico"><SearchIco s={18}/></span>
              <input className="hsb-inp" value={inputVal} autoFocus autoComplete="off"
                placeholder="ძებნა: აირჩიე კატეგორია..."
                onChange={e=>setInputVal(e.target.value)}
                onKeyDown={e=>{ if(e.key==="Enter") commit(inputVal); if(e.key==="Escape") setDdMode(null); }}
              />
              {inputVal && <button className="hsb-clr" onClick={()=>{setInputVal("");setSuggestions([]);setDdMode(null);}}>✕</button>}
              <span className="hsb-divider"/>
              <button className={`hsb-catbtn ${ddMode==="cats"?"on":""}`} onClick={()=>setDdMode(p=>p==="cats"?null:"cats")} type="button">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                </svg>
                კატეგორიები
              </button>
              <button className="hsb-btn" onClick={()=>commit(inputVal)}>მოძებნე</button>
            </div>

            {/* Category dropdown */}
            {ddMode==="cats" && catTree.length>0 && (
              <div className="live-dd">
                <div className="dd-sec">კატეგორიები</div>
                <div className="dd-cats">
                  {catTree.map(cat=>(
                    <button key={cat.name} className={`dd-cat ${activeCat===cat.name?"on":""}`} onClick={()=>pickCat(cat.name)}>
                      <CatIcon name={cat.name} size={16}/>
                      <span className="dd-cat-nm">{cat.name}</span>
                      {catFacets[cat.name]!=null&&<span className="dd-cat-n">{catFacets[cat.name]}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Live search dropdown */}
            {ddMode==="live" && (
              <LiveDropdown suggestions={suggestions} loading={suggLoad}
                onSelect={commit} onViewAll={()=>commit(inputVal)}
                inputVal={inputVal} onOpenGroup={setModal}/>
            )}
          </div>

          <div className="hero-cta-row">
            <button className="hero-cta-a" onClick={() => setShowSupplierModal(true)}>              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9h18l-1.5 9a2 2 0 0 1-2 1.5H6.5a2 2 0 0 1-2-1.5L3 9z"/><path d="M3 9l1.5-4.5A1 1 0 0 1 5.4 4h13.2a1 1 0 0 1 .9.5L21 9"/><line x1="9" y1="4" x2="9" y2="9"/><line x1="15" y1="4" x2="15" y2="9"/><rect x="9" y="13" width="6" height="6" rx="0.5"/></svg>
              გახდი მომწოდებელი
            </button>
            <button className="hero-cta-b" onClick={()=>alert("კორპორატიული შესყიდვები — მალე!")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
              კორპორატიული შესყიდვები
            </button>
          </div>

          {activeCat && (
            <div className="hero-pill">
              <CatIcon name={activeCat}/> {activeCat}
              <button onClick={()=>{setActiveCat(null);setActiveSub(null);setOpenCat(null);}}>✕</button>
            </div>
          )}

          <div className="hero-stats">
            <div className="hstat"><div className="hstat-v">{totalHits>0?totalHits.toLocaleString():"—"}<em>+</em></div><div className="hstat-l">პროდუქტი</div></div>
            <div className="hstat"><div className="hstat-v"><em>{storesList.length}</em></div><div className="hstat-l">მომწოდებელი</div></div>
            <div className="hstat"><div className="hstat-v">{catTree.length||"—"}</div><div className="hstat-l">კატეგორია</div></div>
          </div>
        </section>
      )}

      {/* RESULTS */}
      {isSearching && (
        <div className="rw">
          <aside className="rsb">
            <div className="sb-ttl">კატეგორიები</div>
            {catTree.map(cat=>(
              <div key={cat.name}>
                <button className={`sb-cat ${activeCat===cat.name?"sel":""}`} onClick={()=>pickCat(cat.name)}>
                  <CatIcon name={cat.name} size={14}/>
                  <span className="sb-nm">{cat.name}</span>
                  {catFacets[cat.name]!=null&&<span className="sb-cnt">{catFacets[cat.name]}</span>}
                </button>
                {openCat===cat.name&&cat.subs.length>0&&(
                  <div className="sb-subs">
                    {cat.subs.map(sub=>(
                      <button key={sub} className={`sb-sub ${activeSub===sub?"sel":""}`} onClick={()=>pickSub(sub)}>{sub}</button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </aside>
          <main className="rm">
            <div className="stabs">
              <button className={`stab ${!activeStore?"sel":""}`} onClick={()=>setActiveStore(null)}>ყველა</button>
              {storesList.map(s=>(
                <button key={s.key} className={`stab ${activeStore===s.key?"sel":""}`}
                  style={activeStore===s.key?{background:storeColor(s.key),borderColor:storeColor(s.key)}:{}}
                  onClick={()=>pickStore(s.key)}>{s.label}</button>
              ))}
            </div>
            <div className="rhead">
              <div className="rcnt">
                <b>{products.length}</b>
                {query ? ` ჯგუფი — „${query}"` : " პროდუქტი"}
                {" "}<span style={{color:"var(--txt3)",fontWeight:400}}>
                  ({products.reduce((sum, g) => sum + g.stores_count, 0)} ჩანაწ.)
                </span>
              </div>
              <div className="chips">
                {activeCat && <div className="chip"><CatIcon name={activeCat}/> {activeCat}<button className="chip-x" onClick={()=>{setActiveCat(null);setActiveSub(null);setOpenCat(null);}}>✕</button></div>}
                {activeSub && <div className="chip">{activeSub}<button className="chip-x" onClick={()=>setActiveSub(null)}>✕</button></div>}
                {activeStore && <div className="chip">{storeLabel(activeStore)}<button className="chip-x" onClick={()=>setActiveStore(null)}>✕</button></div>}
                {mergeMode && <div className="chip" style={{background:"#F5F3FF",color:"var(--purple)",borderColor:"rgba(124,58,237,.2)"}}>🔗 Merge Mode</div>}
              </div>
              <select className="sort-sel" value={sortBy} onChange={e=>setSortBy(e.target.value)}>
                <option value="price_asc">ფასი ↑ (იაფი ზემოთ)</option>
                <option value="price_desc">ფასი ↓ (ძვირი ზემოთ)</option>
              </select>
            </div>
            {loading ? (
              <div className="spin-wrap"><div className="spin"/><div className="spin-txt">იტვირთება...</div></div>
            ) : products.length === 0 ? (
              <div className="empty-st"><div className="empty-ico">🔍</div><div className="empty-ttl">შედეგი ვერ მოიძებნა</div><div className="empty-sub">სცადე სხვა სიტყვა ან გაასუფთავე ფილტრები</div></div>
            ) : (
              <div className="pgrid">
                {products.map((group, i) => (
                  <GroupedCard
                    key={`${group.group_key || ''}|${group.items?.[0]?.id || i}`}
                    group={group}
                    onOpen={setModal}
                    isAdmin={isAdmin}
                    mergeMode={mergeMode}
                    isMergeSelected={mergeSelection.has(group.group_key)}
                    onMergeToggle={toggleMergeSelect}
                    onAdminEdit={setAdminEditTarget}
                  />
                ))}
              </div>
            )}
          </main>
        </div>
      )}

      {modal && !adminEditTarget && <ProductModal group={modal} onClose={() => setModal(null)}/>}

      {/* SUPPLIER REGISTRATION MODAL */}
      {showSupplierModal && <SupplierModal onClose={() => setShowSupplierModal(false)} />}

      {/* ADMIN EDIT MODAL */}
      {adminEditTarget && (
        <AdminEditModal
          group={adminEditTarget}
          productOverrides={productOverrides}
          groupOverrides={groupOverrides}
          onClose={() => setAdminEditTarget(null)}
          onSaved={onAdminSaved}
        />
      )}

      {/* MERGE CONFIRM MODAL */}
      {mergeModal && selectedGroupObjects.length >= 2 && (
        <MergeModal
          selectedGroups={selectedGroupObjects}
          onClose={() => setMergeModal(false)}
          onMerged={onMergeDone}
        />
      )}

      {/* MERGE FLOATING BAR */}
      {mergeMode && (
        <div className="merge-bar">
          <span className="merge-cnt">
            {mergeSelection.size === 0
              ? "ქარდებს დააწექი მონიშვნისთვის"
              : `${mergeSelection.size} ჯგუფი მონიშნული`}
          </span>
          <button className="merge-go"
            disabled={mergeSelection.size < 2}
            onClick={() => setMergeModal(true)}>
            🔗 გაერთიანება
          </button>
          <button className="merge-cancel" onClick={exitMergeMode}>გაუქმება</button>
        </div>
      )}
    </>
  );
}