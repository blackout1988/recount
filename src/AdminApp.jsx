import { useState, useEffect, useCallback, useRef } from "react";
import MeiliSearch from "meilisearch";
import { normalizeProduct } from "./utils/normalizeProduct";
import { groupProducts } from "./utils/groupProducts";
import { expandQuery, normalizeQuery, isTransliterationQuery } from "./utils/searchExpander";

// ─── MeiliSearch კლიენტი ──────────────────────────────────────
const useMeiliClient = () => {
  const clientRef = useRef(null);
  const indexRef  = useRef(null);

  if (!clientRef.current) {
    clientRef.current = new MeiliSearch({
      host:   "http://localhost:7700",
      apiKey: "uW_K4inBKuVQJj2jic06rr2DSV_Bc6p_sb6ST9sJt8g",
    });
    indexRef.current = clientRef.current.index("products");
  }

  return { client: clientRef.current, idx: indexRef.current };
};

// ─── Constants ───────────────────────────────────────────────
const STORE_LABELS = {
  gorgia_ge:   "Gorgia",
  domino_ge:   "Domino",
  citadeli_ge: "Citadeli",
  nova_ge:     "Nova",
  modus_ge:    "Modus",
};

const STORE_COLORS = {
  gorgia_ge:   "#1B6B3A",
  domino_ge:   "#D35400",
  citadeli_ge: "#C0392B",
  nova_ge:     "#6B3DAA",
  modus_ge:    "#1A6DAF",
};

const STORES_LIST = [
  { key: "gorgia_ge",   label: "Gorgia"   },
  { key: "domino_ge",   label: "Domino"   },
  { key: "citadeli_ge", label: "Citadeli" },
  { key: "nova_ge",     label: "Nova"     },
  { key: "modus_ge",    label: "Modus"    },
];

const CAT_ICONS = {
  "ელექტროობა და განათება":  "⚡",
  "სამშენებლო ფხვნილები":    "🪣",
  "ბლოკი და აგური":          "🧱",
  "თაბაშირ-მუყაო":           "📐",
  "სამშენებლო ფილა":         "🔳",
  "სამშენებლო პროფილები":    "📏",
  "ხმის და თბოიზოლაცია":    "🔇",
  "ჰიდროიზოლაცია":           "💧",
  "სახურავი და ფასადი":       "🏠",
  "საღებავები და ლაქები":    "🎨",
  "ლითონის მასალა":          "⚙️",
  "სახარჯი მასალა":          "🔧",
  "სანტექნიკა კანალიზაცია":  "🚿",
  "ხის მასალა":              "🪵",
  "გათბობის სისტემა":        "🔥",
};

const fmt = (v) => (v != null ? `${Number(v).toFixed(2)} ₾` : "—");

// ─── Utility: extract latin tokens from query ─────────────────
function extractLatinTokens(query = "") {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1 && /^[a-z0-9]+$/.test(t));
}

// ─── Utility: extract Georgian tokens from query ──────────────
function extractGeoTokens(query = "") {
  return query
    .split(/\s+/)
    .filter((t) => t.length > 1 && /[ა-ჿ]/.test(t));
}

// ─── Utility: filter groups by relevance ──────────────────────
function filterRelevantGroups(groups, query, strict = false) {
  if (!query || !query.trim()) return groups;

  // If this is a transliteration/typo query (e.g. "cebocemnti"),
  // expandQuery already added Georgian terms — let MeiliSearch
  // retrieval handle relevance. Don't over-filter here.
  if (isTransliterationQuery(query)) return groups;

  const expanded = expandQuery(query);
  const allTerms = [...new Set([query, ...expanded])].map(t => t.toLowerCase());

  return groups.filter((g) => {
    const hay = [
      g.canonical_name, g.brand, g.model,
      g.product_type, g.category, g.sub_category,
      ...(g.items ?? []).flatMap(p => [p.name, p.brand, p.model]),
    ].filter(Boolean).join(" ").toLowerCase();

    return allTerms.some(t => hay.includes(t));
  });
}

// ─── SearchIco ───────────────────────────────────────────────
function SearchIco({ s = 16 }) {
  return (
    <svg
      width={s} height={s}
      viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

// ─── LiveDropdown ─────────────────────────────────────────────
function LiveDropdown({ suggestions, loading, onSelect, onViewAll, inputVal }) {
  if (loading) {
    return (
      <div className="live-dd">
        <div className="live-dd-loading">ძებნა...</div>
      </div>
    );
  }

  if (!suggestions.length) return null;

  return (
    <div className="live-dd">
      {suggestions.map((s, i) => (
        <div key={s.uid ?? s.id ?? i} className="live-dd-item" onClick={() => onSelect(s.canonical_name || s.name)}>
          {s.image
            ? <img className="live-dd-img" src={s.image} alt="" />
            : <div className="live-dd-img-ph">🏗️</div>
          }
          <span className="live-dd-name">{s.canonical_name || s.name}</span>
          <span className="live-dd-price">{fmt(s.cheapest_price ?? s.price)}</span>
        </div>
      ))}
      <div className="live-dd-footer" onClick={onViewAll}>
        ყველა შედეგი "{inputVal}" →
      </div>
    </div>
  );
}

// ─── GroupedCard ─────────────────────────────────────────────
function GroupedCard({ group, onOpen }) {
  const cheapest = group.products_sorted_by_price?.[0];

  return (
    <div className="card" onClick={() => onOpen(group)}>
      <div className="card-img">
        {group.image
          ? <img src={group.image} alt={group.canonical_name} loading="lazy" />
          : <span className="card-img-placeholder">🏗️</span>
        }
      </div>

      <div className="card-body">
        <div className="card-name">{group.canonical_name}</div>

        <div className="card-price-row">
          <span className="card-price">{fmt(group.cheapest_price)}</span>
          {group.savings_percent != null && (
            <span className="card-savings">-{group.savings_percent}%</span>
          )}
        </div>

        <div className="card-stores">
          {group.products_sorted_by_price?.map((p) => (
            <span
              key={p.store}
              className="store-tag"
              style={{ background: STORE_COLORS[p.store] ?? "#6b7280" }}
            >
              {STORE_LABELS[p.store] ?? p.store}
            </span>
          ))}
        </div>

        {group.multi && (
          <div className="card-multi-badge">
            {group.stores_count} მაღაზია · შეადარე ფასები
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ProductModal ─────────────────────────────────────────────
function ProductModal({ group, onClose }) {
  const items   = group.products_sorted_by_price ?? [];
  const cheapestPrice = group.cheapest_price;

  // close on overlay click
  const handleOverlay = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  // close on Escape
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="overlay" onClick={handleOverlay}>
      <div className="modal">
        {/* Header */}
        <div className="modal-hdr">
          {group.image
            ? <img className="modal-img" src={group.image} alt={group.canonical_name} />
            : <div className="modal-img-ph">🏗️</div>
          }
          <div style={{ flex: 1 }}>
            <div className="modal-title">{group.canonical_name}</div>
            <div className="modal-meta">
              {[group.brand, group.model, group.product_type, group.category]
                .filter(Boolean).join(" · ")}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {group.multi && group.savings_percent != null && (
            <div className="modal-savings-banner">
              💡 გადაარჩინე {group.savings_percent}% — იყიდე იქ, სადაც იაფია
            </div>
          )}

          <div className="modal-stores-title">ფასი მაღაზიების მიხედვით</div>

          {items.map((p) => {
            const isCheapest = p.price != null && p.price === cheapestPrice;
            return (
              <div
                key={p.store}
                className={`modal-store-row${isCheapest ? " cheapest" : ""}`}
              >
                <span
                  className="store-tag"
                  style={{ background: STORE_COLORS[p.store] ?? "#6b7280" }}
                >
                  {STORE_LABELS[p.store] ?? p.store}
                </span>

                <div>
                  <div className="modal-store-name">
                    {STORE_LABELS[p.store] ?? p.store}
                    {isCheapest && (
                      <span style={{ marginLeft: 6, fontSize: 10, color: "#059669", fontWeight: 700 }}>
                        ✓ იაფი
                      </span>
                    )}
                  </div>
                  <div className={`modal-store-stock ${p.in_stock === false ? "stock-no" : "stock-yes"}`}>
                    {p.in_stock === false ? "არ არის მარაგში" : "მარაგშია"}
                  </div>
                </div>

                <div className="modal-store-price">{fmt(p.price)}</div>

                {p.url && (
                  <a
                    className="modal-store-btn"
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    გახსნა ↗
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── CSS ─────────────────────────────────────────────────────
const css = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background: #f8f9fa; color: #111827; -webkit-font-smoothing: antialiased; }

.hdr { position: sticky; top: 0; z-index: 200; background: #fff; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; gap: 16px; padding: 0 24px; height: 60px; }
.logo { background: none; border: none; cursor: pointer; font-size: 22px; font-weight: 800; letter-spacing: -1px; color: #0f172a; line-height: 1; padding: 0; display: flex; align-items: baseline; gap: 1px; }
.logo em { font-style: normal; color: #2563eb; }
.logo-ge { font-size: 11px; color: #94a3b8; font-weight: 500; margin-left: 1px; }
.hdr-sw { position: relative; flex: 1; max-width: 500px; display: flex; align-items: center; background: #f1f5f9; border-radius: 10px; border: 1.5px solid transparent; transition: border-color .15s; }
.hdr-sw:focus-within { border-color: #2563eb; background: #fff; }
.hdr-ico { padding: 0 8px 0 12px; color: #94a3b8; display: flex; align-items: center; flex-shrink: 0; }
.hdr-inp { flex: 1; background: none; border: none; outline: none; font-size: 14px; padding: 10px 0; color: #111827; }
.hdr-inp::placeholder { color: #94a3b8; }
.hdr-x { background: none; border: none; cursor: pointer; color: #94a3b8; font-size: 14px; padding: 0 12px; height: 100%; display: flex; align-items: center; }
.hdr-x:hover { color: #374151; }
.hdr-badge { margin-left: auto; font-size: 12px; color: #6b7280; white-space: nowrap; font-weight: 500; }

.hero { min-height: calc(100vh - 60px); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 24px; }
.hero-logo { font-size: 56px; font-weight: 900; letter-spacing: -2px; color: #0f172a; line-height: 1; }
.hero-logo em { font-style: normal; color: #2563eb; }
.hero-logo-ge { font-size: 22px; color: #94a3b8; }
.hero-sub { font-size: 16px; color: #6b7280; margin: 12px 0 40px; text-align: center; max-width: 480px; line-height: 1.6; }
.hero-search { width: 100%; max-width: 620px; display: flex; align-items: center; background: #fff; border: 2px solid #e5e7eb; border-radius: 16px; padding: 4px 4px 4px 20px; box-shadow: 0 4px 24px rgba(0,0,0,.06); gap: 8px; transition: border-color .15s, box-shadow .15s; }
.hero-search:focus-within { border-color: #2563eb; box-shadow: 0 4px 24px rgba(37,99,235,.12); }
.hero-inp { flex: 1; background: none; border: none; outline: none; font-size: 16px; padding: 14px 0; color: #111827; }
.hero-inp::placeholder { color: #9ca3af; }
.hero-btn { background: #2563eb; color: #fff; border: none; border-radius: 12px; padding: 13px 26px; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background .15s; white-space: nowrap; }
.hero-btn:hover { background: #1d4ed8; }
.hero-cats { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 32px; max-width: 720px; }
.hero-cat { background: #fff; border: 1.5px solid #e5e7eb; border-radius: 10px; padding: 8px 16px; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all .15s; color: #374151; }
.hero-cat:hover { border-color: #2563eb; color: #2563eb; background: #eff6ff; }
.hero-stats { display: flex; gap: 40px; margin-top: 52px; }
.stat { text-align: center; }
.stat-num { font-size: 32px; font-weight: 900; color: #0f172a; letter-spacing: -1px; }
.stat-lbl { font-size: 12px; color: #9ca3af; margin-top: 2px; }

.layout { display: flex; flex-direction: row; min-height: calc(100vh - 60px); }
.sidebar { width: 240px; flex-shrink: 0; background: #fff; border-right: 1px solid #e5e7eb; padding: 20px 0; position: sticky; top: 60px; height: calc(100vh - 60px); overflow-y: auto; }
.main { flex: 1; padding: 24px; min-width: 0; }

.sb-section-title { font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: .8px; padding: 0 16px 8px; }
.sb-cat { display: flex; align-items: center; gap: 8px; padding: 8px 16px; cursor: pointer; font-size: 13px; color: #374151; transition: all .1s; border-left: 3px solid transparent; }
.sb-cat:hover { background: #f8f9fa; }
.sb-cat.active { background: #eff6ff; color: #2563eb; border-left-color: #2563eb; font-weight: 600; }
.sb-cat-ico { font-size: 15px; flex-shrink: 0; }
.sb-cat-count { margin-left: auto; font-size: 11px; color: #9ca3af; }
.sb-subs { padding: 0 0 6px 44px; }
.sb-sub { font-size: 12px; color: #6b7280; padding: 5px 8px; cursor: pointer; border-radius: 6px; transition: all .1s; }
.sb-sub:hover { background: #f3f4f6; color: #374151; }
.sb-sub.active { background: #eff6ff; color: #2563eb; font-weight: 600; }
.sb-divider { height: 1px; background: #f3f4f6; margin: 14px 16px; }
.sb-store { display: flex; align-items: center; gap: 8px; padding: 8px 16px; cursor: pointer; font-size: 13px; color: #374151; transition: all .1s; border-left: 3px solid transparent; }
.sb-store:hover { background: #f8f9fa; }
.sb-store.active { font-weight: 600; border-left-color: var(--sc); }
.sb-store-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--sc); flex-shrink: 0; }

.toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
.toolbar-info { font-size: 14px; color: #6b7280; flex: 1; }
.toolbar-info strong { color: #111827; }
.sort-btn { background: none; border: 1.5px solid #e5e7eb; border-radius: 8px; padding: 6px 14px; font-size: 13px; cursor: pointer; color: #374151; transition: all .15s; }
.sort-btn.active { border-color: #2563eb; color: #2563eb; background: #eff6ff; font-weight: 600; }
.sort-btn:hover:not(.active) { border-color: #94a3b8; }
.clear-btn { background: none; border: none; cursor: pointer; font-size: 12px; color: #9ca3af; padding: 6px 8px; border-radius: 6px; }
.clear-btn:hover { color: #ef4444; background: #fef2f2; }

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
.empty { text-align: center; padding: 60px 20px; color: #9ca3af; font-size: 15px; }
.loading-wrap { display: flex; justify-content: center; align-items: center; min-height: 240px; }
.spinner { width: 32px; height: 32px; border: 3px solid #e5e7eb; border-top-color: #2563eb; border-radius: 50%; animation: spin .7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.card { background: #fff; border: 1.5px solid #e5e7eb; border-radius: 14px; overflow: hidden; cursor: pointer; transition: all .15s; }
.card:hover { border-color: #2563eb; box-shadow: 0 4px 20px rgba(37,99,235,.1); transform: translateY(-2px); }
.card-img { aspect-ratio: 4/3; overflow: hidden; background: #f8f9fa; display: flex; align-items: center; justify-content: center; }
.card-img img { width: 100%; height: 100%; object-fit: contain; padding: 12px; }
.card-img-placeholder { font-size: 44px; color: #e5e7eb; }
.card-body { padding: 14px; }
.card-name { font-size: 13px; font-weight: 600; color: #0f172a; line-height: 1.4; margin-bottom: 10px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.card-price-row { display: flex; align-items: baseline; gap: 8px; margin-bottom: 10px; }
.card-price { font-size: 21px; font-weight: 800; color: #0f172a; letter-spacing: -.5px; }
.card-old-price { font-size: 13px; color: #9ca3af; text-decoration: line-through; }
.card-savings { font-size: 10px; font-weight: 700; color: #059669; background: #d1fae5; padding: 2px 6px; border-radius: 4px; }
.card-stores { display: flex; flex-wrap: wrap; gap: 4px; }
.store-tag { font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 4px; color: #fff; }
.card-multi-badge { font-size: 11px; color: #6b7280; margin-top: 7px; }

.live-dd { position: absolute; top: calc(100% + 6px); left: 0; right: 0; background: #fff; border: 1.5px solid #e5e7eb; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,.1); z-index: 300; overflow: hidden; }
.live-dd-item { display: flex; align-items: center; gap: 12px; padding: 10px 14px; cursor: pointer; transition: background .1s; }
.live-dd-item:hover { background: #f8f9fa; }
.live-dd-img { width: 40px; height: 40px; border-radius: 6px; object-fit: contain; background: #f1f5f9; flex-shrink: 0; }
.live-dd-img-ph { width: 40px; height: 40px; border-radius: 6px; background: #f1f5f9; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
.live-dd-name { font-size: 13px; font-weight: 500; color: #111827; line-height: 1.3; flex: 1; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.live-dd-price { font-size: 13px; font-weight: 700; color: #0f172a; white-space: nowrap; }
.live-dd-footer { border-top: 1px solid #f3f4f6; padding: 10px 14px; text-align: center; font-size: 13px; color: #2563eb; cursor: pointer; font-weight: 500; }
.live-dd-footer:hover { background: #eff6ff; }
.live-dd-loading { padding: 20px; text-align: center; color: #9ca3af; font-size: 13px; }

.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 500; display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(2px); }
.modal { background: #fff; border-radius: 20px; max-width: 640px; width: 100%; max-height: 90vh; overflow-y: auto; }
.modal-hdr { display: flex; align-items: flex-start; gap: 16px; padding: 24px; border-bottom: 1px solid #f3f4f6; }
.modal-img { width: 100px; height: 100px; object-fit: contain; border-radius: 12px; background: #f8f9fa; flex-shrink: 0; }
.modal-img-ph { width: 100px; height: 100px; border-radius: 12px; background: #f8f9fa; display: flex; align-items: center; justify-content: center; font-size: 44px; flex-shrink: 0; }
.modal-title { font-size: 16px; font-weight: 700; color: #0f172a; line-height: 1.4; margin-bottom: 6px; }
.modal-meta { font-size: 12px; color: #9ca3af; line-height: 1.6; }
.modal-close { margin-left: auto; background: #f1f5f9; border: none; cursor: pointer; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; color: #6b7280; flex-shrink: 0; transition: background .15s; }
.modal-close:hover { background: #e2e8f0; }
.modal-body { padding: 20px 24px 28px; }
.modal-stores-title { font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: .8px; margin-bottom: 12px; }
.modal-store-row { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 10px; margin-bottom: 8px; border: 1.5px solid #f3f4f6; transition: all .15s; }
.modal-store-row:hover { border-color: #e5e7eb; background: #f8f9fa; }
.modal-store-row.cheapest { border-color: #bbf7d0; background: #f0fdf4; }
.modal-store-name { font-size: 13px; font-weight: 600; color: #111827; }
.modal-store-price { font-size: 19px; font-weight: 800; color: #0f172a; letter-spacing: -.5px; margin-left: auto; }
.modal-store-stock { font-size: 11px; margin-top: 2px; }
.stock-yes { color: #059669; }
.stock-no { color: #ef4444; }
.modal-store-btn { display: inline-flex; align-items: center; gap: 4px; background: #f1f5f9; color: #374151; border: none; border-radius: 6px; padding: 5px 10px; font-size: 12px; font-weight: 500; cursor: pointer; text-decoration: none; transition: all .15s; }
.modal-store-btn:hover { background: #e2e8f0; }
.modal-savings-banner { background: linear-gradient(135deg, #d1fae5, #a7f3d0); border-radius: 10px; padding: 12px 16px; display: flex; align-items: center; gap: 8px; margin-bottom: 16px; font-size: 13px; color: #065f46; font-weight: 600; }

@media (max-width: 768px) {
  .sidebar { display: none; }
  .main { padding: 16px; }
  .hdr { padding: 0 16px; gap: 10px; }
  .hdr-badge { display: none; }
  .grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .hero-stats { gap: 24px; }
  .stat-num { font-size: 24px; }
  .hero-logo { font-size: 40px; }
  .hero-sub { font-size: 14px; }
  .modal { border-radius: 16px; }
  .modal-hdr { padding: 18px; }
  .modal-body { padding: 16px 18px 24px; }
}
`;

// ─── RecountApp ───────────────────────────────────────────────
function RecountApp() {
  const { client, idx } = useMeiliClient();

  const [inputVal,    setInputVal]    = useState("");
  const [query,       setQuery]       = useState("");
  const [activeCat,   setActiveCat]   = useState(null);
  const [activeSub,   setActiveSub]   = useState(null);
  const [activeStore, setActiveStore] = useState(null);
  const [sortBy,      setSortBy]      = useState("price_asc");
  const [openCat,     setOpenCat]     = useState(null);
  const [ddMode,      setDdMode]      = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [suggLoad,    setSuggLoad]    = useState(false);
  const [modal,       setModal]       = useState(null);
  const [products,    setProducts]    = useState([]);
  const [totalHits,   setTotalHits]   = useState(0);
  const [loading,     setLoading]     = useState(false);
  const [catTree,     setCatTree]     = useState([]);
  const [catFacets,   setCatFacets]   = useState({});
  const [ready,       setReady]       = useState(false);

  const ddRef    = useRef(null);
  const hdrDdRef = useRef(null);
  const suggTmr  = useRef(null);

  const isSearching = !!(inputVal || query || activeCat || activeSub || activeStore);

  // ── fetchCandidates ────────────────────────────────────────
  // Searches MeiliSearch using expanded query terms.
  // search_aliases covers transliterations; name/brand/model are fallback.
  const fetchCandidates = useCallback(
    async (normalizedQ, filterStr, sort) => {
      if (!idx) return [];

      const baseOpts = {
        limit: 300,
        sort,
        ...(filterStr && { filter: filterStr }),
      };

      if (!normalizedQ) {
        const res = await idx.search("", { ...baseOpts, limit: 500 });
        return res.hits ?? [];
      }

      // expandQuery returns 2-6 variants:
      // original, typo-fixed, geo-canonical, model joined/spaced, etc.
      const terms = expandQuery(normalizedQ);

      const results = await Promise.all(
        terms.slice(0, 6).map((term, i) =>
          idx.search(term, { ...baseOpts, limit: i === 0 ? 250 : 100 })
             .catch(() => ({ hits: [] }))
        )
      );

      const seen   = new Set();
      const merged = [];
      for (const r of results) {
        for (const h of r.hits ?? []) {
          const id = h.uid ?? h.id;
          if (id && !seen.has(id)) { seen.add(id); merged.push(h); }
        }
      }
      return merged;
    },
    [idx]
  );

  // ── Main Search ────────────────────────────────────────────
  // Uses inputVal (live typing) — not just committed query.
  // This is the key fix for "results don't update while typing".
  const doSearch = useCallback(async () => {
    if (!ready || !idx) return;

    // Use inputVal for live updates; fall back to committed query
    const activeQuery = inputVal || query;

    setLoading(true);
    try {
      const f = [];
      if (activeCat)   f.push(`category = "${activeCat}"`);
      if (activeSub)   f.push(`sub_category = "${activeSub}"`);
      if (activeStore) f.push(`store = "${activeStore}"`);

      const filterStr  = f.length ? f.join(" AND ") : undefined;
      const sort       = sortBy === "price_desc" ? ["price:desc"] : ["price:asc"];
      const normalizedQ = activeQuery ? normalizeQuery(activeQuery) : "";

      const candidates = await fetchCandidates(normalizedQ, filterStr, sort);
      const normalized = candidates.map(normalizeProduct);
      const grouped    = groupProducts(normalized);

      // Light relevance filter — only remove obvious false positives
      const filtered = filterRelevantGroups(grouped, normalizedQ);

      setProducts(filtered);
      setTotalHits(filtered.length);
    } catch (e) {
      console.error("Search error:", e);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [ready, inputVal, query, activeCat, activeSub, activeStore, sortBy, idx, fetchCandidates]);

  // ── Init MeiliSearch Settings ──────────────────────────────
  useEffect(() => {
    if (!idx || ready) return;
    idx.updateSettings({
      searchableAttributes: ["search_aliases", "name", "brand", "model", "category", "sub_category", "code"],
      filterableAttributes: ["category", "sub_category", "store", "in_stock", "brand"],
      sortableAttributes:   ["price", "name", "last_updated"],
      pagination:           { maxTotalHits: 100000 },
    })
      .catch(console.error)
      .finally(() => setReady(true));
  }, [idx, ready]);

  // ── Load Categories ────────────────────────────────────────
  useEffect(() => {
    if (!ready || !idx) return;

    idx.search("", { limit: 0, facets: ["category", "sub_category"] })
      .then((res) => {
        const cats = res.facetDistribution?.category || {};
        setCatFacets(cats);
        setTotalHits(res.estimatedTotalHits || 0);

        const tree = Object.keys(cats).sort().map((name) => ({ name, subs: [] }));

        Promise.all(
          tree.map((cat) =>
            idx.search("", {
              limit: 0,
              filter: `category = "${cat.name}"`,
              facets: ["sub_category"],
            }).then((r) => {
              cat.subs = Object.keys(r.facetDistribution?.sub_category || {}).sort();
            })
          )
        ).then(() => setCatTree([...tree]));
      })
      .catch(console.error);
  }, [ready, idx]);

  // ── Live Suggestions (debounced) ───────────────────────────
  useEffect(() => {
    if (!ready || !idx) return;
    clearTimeout(suggTmr.current);

    if (!inputVal.trim()) {
      setSuggestions([]);
      if (ddMode === "live") setDdMode(null);
      return;
    }

    setDdMode("live");
    setSuggLoad(true);

    suggTmr.current = setTimeout(async () => {
      try {
        const normInput = normalizeQuery(inputVal);
        const f         = activeCat ? `category = "${activeCat}"` : undefined;
        const baseOpts  = { sort: ["price:asc"], ...(f && { filter: f }) };

        const expanded  = expandQuery(normInput);
        const latinToks = extractLatinTokens(normInput);
        const geoToks   = extractGeoTokens(normInput);

        const results = await Promise.all([
          ...expanded.slice(0, 5).map((term, i) =>
            idx.search(term, { ...baseOpts, limit: i === 0 ? 12 : 6 }).catch(() => ({ hits: [] }))
          ),
          ...latinToks.slice(0, 2).map((t) =>
            idx.search(t, { ...baseOpts, limit: 6 }).catch(() => ({ hits: [] }))
          ),
          ...geoToks.slice(0, 1).map((t) =>
            idx.search(t, { ...baseOpts, limit: 6 }).catch(() => ({ hits: [] }))
          ),
        ]);

        const seen   = new Set();
        const merged = [];
        for (const r of results) {
          for (const h of r.hits ?? []) {
            if (!seen.has(h.uid ?? h.id)) {
              seen.add(h.uid ?? h.id);
              merged.push(h);
            }
          }
        }

        const groups   = groupProducts(merged.map(normalizeProduct));
        const relevant = filterRelevantGroups(groups, normInput, false);
        const suggs    = relevant.slice(0, 8).map((g) => ({
          ...g.products_sorted_by_price[0],
          canonical_name: g.canonical_name,
          cheapest_price: g.cheapest_price,
          stores_count:   g.stores_count,
        }));

        setSuggestions(suggs);
      } catch (err) {
        console.error(err);
        setSuggestions([]);
      } finally {
        setSuggLoad(false);
      }
    }, 250);

    return () => clearTimeout(suggTmr.current);
  }, [inputVal, ready, activeCat, idx]);

  // Debounced live search — runs when typing or filters change
  const searchTmr = useRef(null);
  useEffect(() => {
    if (!isSearching) { setProducts([]); return; }
    clearTimeout(searchTmr.current);
    searchTmr.current = setTimeout(() => { doSearch(); }, 300);
    return () => clearTimeout(searchTmr.current);
  }, [doSearch, isSearching]);

  // ── Outside Click ──────────────────────────────────────────
  useEffect(() => {
    const handle = (e) => {
      if (ddRef.current    && !ddRef.current.contains(e.target))    setDdMode(null);
      if (hdrDdRef.current && !hdrDdRef.current.contains(e.target)) setDdMode(null);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // ── Handlers ──────────────────────────────────────────────
  const commit = (val) => {
    setQuery(val);
    setInputVal(val);
    setDdMode(null);
    setSuggestions([]);
  };

  const clearAll = () => {
    setQuery(""); setInputVal("");
    setActiveCat(null); setActiveSub(null); setActiveStore(null);
    setDdMode(null); setSuggestions([]);
  };

  const pickCat = (name) => {
    setActiveCat((p) => (p === name ? null : name));
    setActiveSub(null);
    setOpenCat((p)  => (p === name ? null : name));
    setDdMode(null);
  };

  const pickSub   = (sub) => setActiveSub((p)   => (p === sub ? null : sub));
  const pickStore = (key) => setActiveStore((p)  => (p === key ? null : key));

  const onKey = (e) => {
    if (e.key === "Enter")  commit(inputVal);
    if (e.key === "Escape") setDdMode(null);
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <>
      <style>{css}</style>

      {/* HEADER (shown only while searching) */}
      <header className="hdr">
        <button className="logo" onClick={clearAll}>
          RE<em>COUNT</em>
          <span className="logo-ge">.GE</span>
        </button>

        {isSearching && (
          <div className="hdr-sw" ref={hdrDdRef}>
            <span className="hdr-ico"><SearchIco s={14} /></span>
            <input
              className="hdr-inp"
              value={inputVal}
              placeholder="მოძებნე..."
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={onKey}
              autoComplete="off"
            />
            {inputVal && (
              <button className="hdr-x" onClick={() => {
                setInputVal(""); setQuery("");
                setSuggestions([]); setDdMode(null);
              }}>✕</button>
            )}
            {ddMode === "live" && (
              <LiveDropdown
                suggestions={suggestions}
                loading={suggLoad}
                onSelect={commit}
                onViewAll={() => commit(inputVal)}
                inputVal={inputVal}
              />
            )}
          </div>
        )}

        <span className="hdr-badge">{totalHits.toLocaleString()} პროდუქტი</span>
      </header>

      {/* HERO (home screen) */}
      {!isSearching && (
        <section className="hero">
          <div className="hero-logo">
            RE<em>COUNT</em>
            <span className="hero-logo-ge">.GE</span>
          </div>
          <p className="hero-sub">
            შეადარე სამშენებლო მასალების ფასები 5 მაღაზიაში — Gorgia, Domino, Citadeli, Nova, Modus
          </p>

          {/* Hero Search */}
          <div className="hero-search" ref={ddRef}>
            <span style={{ color: "#94a3b8", display: "flex", alignItems: "center" }}>
              <SearchIco s={20} />
            </span>
            <input
              className="hero-inp"
              value={inputVal}
              placeholder="მოძებნე — ceresit cm14, შპაკლი, ფუგა..."
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={onKey}
              autoComplete="off"
            />
            {inputVal && (
              <button
                style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 16, padding: "0 4px" }}
                onClick={() => { setInputVal(""); setSuggestions([]); setDdMode(null); }}
              >✕</button>
            )}
            <button className="hero-btn" onClick={() => commit(inputVal)}>
              <SearchIco s={14} /> ძებნა
            </button>

            {ddMode === "live" && (
              <LiveDropdown
                suggestions={suggestions}
                loading={suggLoad}
                onSelect={commit}
                onViewAll={() => commit(inputVal)}
                inputVal={inputVal}
              />
            )}
          </div>

          {/* Quick category pills */}
          <div className="hero-cats">
            {catTree.slice(0, 12).map((cat) => (
              <button key={cat.name} className="hero-cat" onClick={() => pickCat(cat.name)}>
                <span>{CAT_ICONS[cat.name] ?? "📦"}</span>
                {cat.name}
              </button>
            ))}
          </div>

          {/* Stats row */}
          <div className="hero-stats">
            <div className="stat">
              <div className="stat-num">{(catFacets ? Object.values(catFacets).reduce((a, b) => a + b, 0) : 0).toLocaleString()}</div>
              <div className="stat-lbl">პროდუქტი</div>
            </div>
            <div className="stat">
              <div className="stat-num">5</div>
              <div className="stat-lbl">მაღაზია</div>
            </div>
            <div className="stat">
              <div className="stat-num">{catTree.length}</div>
              <div className="stat-lbl">კატეგორია</div>
            </div>
          </div>
        </section>
      )}

      {/* RESULTS LAYOUT */}
      {isSearching && (
        <div className="layout">

          {/* Sidebar */}
          <aside className="sidebar">
            <div className="sb-section-title">კატეგორიები</div>

            {catTree.map((cat) => (
              <div key={cat.name}>
                <div
                  className={`sb-cat${activeCat === cat.name ? " active" : ""}`}
                  onClick={() => pickCat(cat.name)}
                >
                  <span className="sb-cat-ico">{CAT_ICONS[cat.name] ?? "📦"}</span>
                  <span style={{ flex: 1 }}>{cat.name}</span>
                  <span className="sb-cat-count">{catFacets[cat.name] ?? ""}</span>
                </div>

                {openCat === cat.name && cat.subs.length > 0 && (
                  <div className="sb-subs">
                    {cat.subs.map((sub) => (
                      <div
                        key={sub}
                        className={`sb-sub${activeSub === sub ? " active" : ""}`}
                        onClick={() => pickSub(sub)}
                      >
                        {sub}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div className="sb-divider" />
            <div className="sb-section-title">მაღაზიები</div>

            {STORES_LIST.map(({ key, label }) => (
              <div
                key={key}
                className={`sb-store${activeStore === key ? " active" : ""}`}
                style={{ "--sc": STORE_COLORS[key] }}
                onClick={() => pickStore(key)}
              >
                <span className="sb-store-dot" />
                {label}
              </div>
            ))}
          </aside>

          {/* Main */}
          <main className="main">
            {/* Toolbar */}
            <div className="toolbar">
              <span className="toolbar-info">
                {loading
                  ? "იძებნება..."
                  : <><strong>{products.length}</strong> ჯგუფი{query ? ` — "${query}"` : ""}</>
                }
              </span>

              <button
                className={`sort-btn${sortBy === "price_asc" ? " active" : ""}`}
                onClick={() => setSortBy("price_asc")}
              >
                ↑ იაფიდან
              </button>
              <button
                className={`sort-btn${sortBy === "price_desc" ? " active" : ""}`}
                onClick={() => setSortBy("price_desc")}
              >
                ↓ ძვირიდან
              </button>

              <button className="clear-btn" onClick={clearAll}>× გასუფთავება</button>
            </div>

            {/* Grid */}
            {loading ? (
              <div className="loading-wrap">
                <div className="spinner" />
              </div>
            ) : products.length === 0 ? (
              <div className="empty">
                🔍 შედეგი ვერ მოიძებნა<br />
                <span style={{ fontSize: 13, marginTop: 8, display: "block" }}>
                  სცადე სხვა საძიებო სიტყვა ან შეამოწმე კატეგორიები
                </span>
              </div>
            ) : (
              <div className="grid">
                {products.map((group) => (
                  <GroupedCard key={group.group_key} group={group} onOpen={setModal} />
                ))}
              </div>
            )}
          </main>
        </div>
      )}

      {/* MODAL */}
      {modal && <ProductModal group={modal} onClose={() => setModal(null)} />}
    </>
  );
}

export default RecountApp;
