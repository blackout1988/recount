import { useState, useEffect, useRef } from "react";

// ── სტატუს ბეჯები ────────────────────────────────────────────────
const STATUS_CONFIG = {
  active:    { label: "აქტიური",   color: "#17C653", bg: "#EAFAF1" },
  inactive:  { label: "Inactive",  color: "#F8285A", bg: "#FFF0F3" },
  scheduled: { label: "Scheduled", color: "#7239EA", bg: "#F3EEFF" },
  published: { label: "Published", color: "#17C653", bg: "#EAFAF1" },
  low_stock: { label: "Low Stock", color: "#F6C000", bg: "#FFFDE7" },
  out:       { label: "მარაგი არ არ","color": "#F8285A", bg: "#FFF0F3" },
};

const STORES = ["ALL", "CITADELI", "GORGIA", "DOMINO", "NOVA", "MODUS"];
const STORE_KEYS = {
  CITADELI: "citadeli_ge",
  GORGIA:   "gorgia_ge",
  DOMINO:   "domino_ge",
  NOVA:     "nova_ge",
  MODUS:    "modus_ge",
};

const NAV_ITEMS = [
  { icon: "📊", label: "Dashboard" },
  { icon: "📦", label: "პროდუქტები", active: true },
  { icon: "🏪", label: "მაღაზიები" },
  { icon: "🏷️", label: "კატეგoriები" },
  { icon: "💰", label: "ფასები" },
  { icon: "📈", label: "ანალიტიკა" },
  { icon: "⚙️", label: "პარამეტრები" },
];

// Demo data
const DEMO_PRODUCTS = [
  { id: "1836", image: "https://www.citadeli.com/upload/products/kD9gmTT7tEVOSDKg.jpg", name: "ჰიდროიზოლაციო ხსნარი WEBER DRY RAPID STOP", code: "SQ0513-0014", stock: 0,  price: 45.00,  rating: 5, status: "active",    store: "citadeli_ge", category: "ჰიდროიზოლაცია" },
  { id: "877",  image: "https://www.citadeli.com/upload/products/kD9gmTT7tEVOSDKg.jpg", name: "სელსილ MDF Kit წებო 100ml+25gr",          code: "02131003",     stock: 43, price: 12.00,  rating: 4, status: "inactive",  store: "citadeli_ge", category: "სახარჯი მასალა" },
  { id: "345",  image: "",                                                                name: "არმატურა 10მმ",                           code: "04224007",     stock: 24, price: 28.00,  rating: 3, status: "scheduled", store: "gorgia_ge",   category: "ლითონის მასალა" },
  { id: "102",  image: "",                                                                name: "ცემენტი M400 50კგ",                       code: "04903007",     stock: 4,  price: 263.00, rating: 4, status: "low_stock", store: "gorgia_ge",   category: "სამშენებლო ფხვნილები" },
  { id: "233",  image: "",                                                                name: "კაბელი სადენი NYM 3x2.5",                 code: "01355007",     stock: 87, price: 156.00, rating: 5, status: "published", store: "domino_ge",   category: "ელექტroობა და განათება" },
  { id: "441",  image: "",                                                                name: "მინაბამბა ISOVER 50მმ",                   code: "04123001",     stock: 12, price: 89.00,  rating: 4, status: "active",    store: "citadeli_ge", category: "ხმის და თბოიზოლაცია" },
  { id: "512",  image: "",                                                                name: "ფილა ევროშიფერი 2x1",                    code: "05012003",     stock: 0,  price: 34.50,  rating: 3, status: "out",       store: "nova_ge",     category: "სახurავი და ფასადი" },
  { id: "678",  image: "",                                                                name: "საღebავი ინტერიერი Dulux 10ლ",             code: "06781002",     stock: 31, price: 195.00, rating: 5, status: "published", store: "gorgia_ge",   category: "საღebavები და ლაქები" },
];

// ── CSS ──────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Georgian:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --sidebar-bg:   #1E2129;
    --sidebar-w:    260px;
    --sidebar-w-sm: 72px;
    --white:        #FFFFFF;
    --bg:           #F4F5F7;
    --accent:       #4A90D9;
    --accent-dark:  #2C6FAC;
    --accent-hover: #3A7BC8;
    --text:         #1A1A2E;
    --muted:        #99A1B7;
    --border:       #E9EDF4;
    --radius:       8px;
    --row-hover:    #F8F9FC;
  }

  body {
    font-family: 'Inter', 'Noto Sans Georgian', sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
  }

  /* ── LAYOUT ── */
  .admin-layout {
    display: flex;
    min-height: 100vh;
  }

  /* ── SIDEBAR ── */
  .sidebar {
    width: var(--sidebar-w);
    background: var(--sidebar-bg);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    transition: width 0.25s ease;
    position: fixed;
    top: 0; left: 0; bottom: 0;
    z-index: 200;
    overflow: hidden;
  }

  .sidebar.collapsed { width: var(--sidebar-w-sm); }

  .sidebar-logo {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 24px 20px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    flex-shrink: 0;
  }

  .logo-icon {
    width: 36px; height: 36px;
    background: var(--accent);
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 14px; color: #fff;
    flex-shrink: 0;
    font-family: 'Inter', sans-serif;
    letter-spacing: -0.5px;
  }

  .logo-label {
    font-weight: 700;
    font-size: 18px;
    color: #fff;
    letter-spacing: -0.5px;
    white-space: nowrap;
    opacity: 1;
    transition: opacity 0.2s;
  }

  .sidebar.collapsed .logo-label { opacity: 0; }

  .sidebar-nav {
    flex: 1;
    padding: 16px 12px;
    overflow-y: auto;
  }

  .nav-section-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.3);
    padding: 8px 8px 4px;
    white-space: nowrap;
    overflow: hidden;
    transition: opacity 0.2s;
  }

  .sidebar.collapsed .nav-section-label { opacity: 0; }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 8px;
    cursor: pointer;
    color: rgba(255,255,255,0.55);
    font-size: 14px;
    font-weight: 500;
    transition: all 0.15s;
    white-space: nowrap;
    margin-bottom: 2px;
    border: none;
    background: none;
    width: 100%;
    text-align: left;
  }

  .nav-item:hover { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.85); }
  .nav-item.active { background: rgba(74,144,217,0.18); color: var(--accent); }
  .nav-item .nav-icon { font-size: 18px; flex-shrink: 0; width: 24px; text-align: center; }
  .nav-item .nav-label { transition: opacity 0.2s; }
  .sidebar.collapsed .nav-label { opacity: 0; }

  .sidebar-bottom {
    padding: 16px 12px;
    border-top: 1px solid rgba(255,255,255,0.07);
  }

  /* ── MAIN ── */
  .main {
    flex: 1;
    margin-left: var(--sidebar-w);
    transition: margin-left 0.25s ease;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .main.collapsed { margin-left: var(--sidebar-w-sm); }

  /* ── TOPBAR ── */
  .topbar {
    background: var(--white);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    padding: 0 24px;
    height: 64px;
    gap: 0;
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .collapse-btn {
    width: 32px; height: 32px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--white);
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    color: var(--muted);
    font-size: 16px;
    margin-right: 20px;
    flex-shrink: 0;
    transition: border-color 0.15s;
  }
  .collapse-btn:hover { border-color: var(--accent); color: var(--accent); }

  .store-tabs {
    display: flex;
    gap: 0;
    flex: 1;
  }

  .store-tab {
    padding: 0 20px;
    height: 64px;
    display: flex;
    align-items: center;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.5px;
    color: var(--muted);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.15s;
    border: none;
    background: none;
    white-space: nowrap;
  }

  .store-tab:hover { color: var(--text); }
  .store-tab.active { color: var(--accent); border-bottom: 2px solid var(--accent); }

  .topbar-right {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-left: auto;
  }

  .avatar {
    width: 36px; height: 36px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--accent), var(--accent-dark));
    display: flex; align-items: center; justify-content: center;
    color: #fff;
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
    overflow: hidden;
  }

  /* ── CONTENT ── */
  .content {
    flex: 1;
    padding: 28px 28px;
  }

  /* ── PAGE HEADER ── */
  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 24px;
  }

  .page-title {
    font-size: 22px;
    font-weight: 700;
    color: var(--text);
    letter-spacing: -0.3px;
  }

  .page-subtitle {
    font-size: 13px;
    color: var(--muted);
    margin-top: 4px;
  }

  .page-actions {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  /* ── BUTTONS ── */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 9px 18px;
    border-radius: var(--radius);
    font-size: 13.5px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.15s;
    white-space: nowrap;
    font-family: inherit;
  }

  .btn-primary {
    background: var(--accent);
    color: #fff;
  }
  .btn-primary:hover { background: var(--accent-hover); }

  .btn-light {
    background: var(--white);
    color: var(--text);
    border: 1px solid var(--border);
  }
  .btn-light:hover { background: var(--bg); border-color: #C8CDDA; }

  .btn-danger {
    background: #FFF0F3;
    color: #F8285A;
    border: 1px solid #FFD6E0;
  }
  .btn-danger:hover { background: #FFD6E0; }

  /* ── CARD ── */
  .card {
    background: var(--white);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }

  /* ── TABLE TOOLBAR ── */
  .table-toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
  }

  .search-wrap {
    position: relative;
    flex: 1;
    max-width: 360px;
  }

  .search-icon-inner {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--muted);
    font-size: 14px;
  }

  .search-input {
    width: 100%;
    padding: 9px 12px 9px 36px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-family: inherit;
    font-size: 13.5px;
    color: var(--text);
    outline: none;
    background: var(--bg);
    transition: border-color 0.15s, background 0.15s;
  }

  .search-input:focus {
    border-color: var(--accent);
    background: var(--white);
    box-shadow: 0 0 0 3px rgba(74,144,217,0.12);
  }

  .search-input::placeholder { color: #B0B8CF; }

  .status-select {
    padding: 9px 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-family: inherit;
    font-size: 13.5px;
    color: var(--muted);
    background: var(--white);
    cursor: pointer;
    outline: none;
    min-width: 130px;
  }

  .toolbar-right { margin-left: auto; display: flex; gap: 10px; }

  /* ── TABLE ── */
  .products-table {
    width: 100%;
    border-collapse: collapse;
  }

  .products-table th {
    padding: 12px 16px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: var(--muted);
    text-align: left;
    border-bottom: 1px solid var(--border);
    background: var(--white);
    white-space: nowrap;
  }

  .products-table td {
    padding: 14px 16px;
    font-size: 13.5px;
    border-bottom: 1px solid var(--border);
    vertical-align: middle;
  }

  .products-table tr:last-child td { border-bottom: none; }

  .products-table tbody tr {
    transition: background 0.12s;
    cursor: pointer;
  }

  .products-table tbody tr:hover { background: var(--row-hover); }

  .products-table tbody tr.selected { background: #EFF6FF; }

  /* checkbox */
  .cb {
    width: 16px; height: 16px;
    accent-color: var(--accent);
    cursor: pointer;
  }

  /* product cell */
  .product-cell {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .product-thumb {
    width: 44px; height: 44px;
    border-radius: 6px;
    object-fit: contain;
    background: var(--bg);
    border: 1px solid var(--border);
    padding: 4px;
    flex-shrink: 0;
  }

  .product-thumb-placeholder {
    width: 44px; height: 44px;
    border-radius: 6px;
    background: linear-gradient(135deg, #EEF0F5, #E4E7EF);
    border: 1px solid var(--border);
    display: flex; align-items: center; justify-content: center;
    font-size: 18px;
    flex-shrink: 0;
  }

  .product-name {
    font-weight: 600;
    font-size: 13.5px;
    color: var(--text);
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    max-width: 260px;
  }

  .product-code {
    font-size: 12px;
    color: var(--muted);
    margin-top: 2px;
  }

  /* stock */
  .stock-val { font-weight: 600; }
  .stock-val.zero { color: #F8285A; }
  .stock-val.low  { color: #F6C000; }
  .stock-val.ok   { color: #17C653; }

  /* price */
  .price-val {
    font-weight: 700;
    font-size: 14px;
    color: var(--text);
    font-family: 'Inter', sans-serif;
  }

  /* rating */
  .stars { display: flex; gap: 2px; }
  .star { font-size: 14px; }
  .star.filled { color: #F6C000; }
  .star.empty  { color: #DDE0EA; }

  /* status badge */
  .badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
  }

  /* store badge */
  .store-badge {
    font-size: 11px;
    padding: 3px 8px;
    border-radius: 4px;
    font-weight: 600;
    color: #fff;
  }

  .store-citadeli_ge { background: #E63946; }
  .store-gorgia_ge   { background: #2A9D8F; }
  .store-domino_ge   { background: #E76F51; }
  .store-nova_ge     { background: #457B9D; }
  .store-modus_ge    { background: #6A4C93; }

  /* actions */
  .actions-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--white);
    font-size: 12.5px;
    font-weight: 500;
    color: var(--text);
    cursor: pointer;
    transition: all 0.12s;
    font-family: inherit;
    white-space: nowrap;
  }
  .actions-btn:hover { border-color: var(--accent); color: var(--accent); }

  /* ── STATS CARDS ── */
  .stats-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 24px;
  }

  .stat-card {
    background: var(--white);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .stat-icon {
    width: 48px; height: 48px;
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 22px;
    flex-shrink: 0;
  }

  .stat-val {
    font-size: 22px;
    font-weight: 700;
    color: var(--text);
    font-family: 'Inter', sans-serif;
    line-height: 1;
  }

  .stat-label {
    font-size: 12px;
    color: var(--muted);
    margin-top: 4px;
  }

  .stat-change {
    font-size: 12px;
    font-weight: 600;
    margin-top: 2px;
  }
  .stat-change.up   { color: #17C653; }
  .stat-change.down { color: #F8285A; }

  /* ── PAGINATION ── */
  .pagination {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    border-top: 1px solid var(--border);
  }

  .pagination-info { font-size: 13px; color: var(--muted); }

  .pagination-btns { display: flex; gap: 6px; }

  .page-btn {
    width: 32px; height: 32px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--white);
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    color: var(--muted);
    display: flex; align-items: center; justify-content: center;
    transition: all 0.12s;
    font-family: inherit;
  }
  .page-btn:hover { border-color: var(--accent); color: var(--accent); }
  .page-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }

  /* ── BULK ACTIONS ── */
  .bulk-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 20px;
    background: #EFF6FF;
    border-bottom: 1px solid #BFDBFE;
    font-size: 13px;
    color: var(--accent-dark);
    font-weight: 500;
  }

  /* ── RESPONSIVE ── */
  @media (max-width: 1024px) {
    .stats-row { grid-template-columns: repeat(2, 1fr); }
    .sidebar { width: var(--sidebar-w-sm); }
    .main { margin-left: var(--sidebar-w-sm); }
    .sidebar .logo-label, .sidebar .nav-label, .sidebar .nav-section-label { opacity: 0; }
  }

  @media (max-width: 640px) {
    .stats-row { grid-template-columns: 1fr 1fr; }
    .content { padding: 16px; }
    .topbar { padding: 0 16px; }
    .store-tab { padding: 0 12px; font-size: 12px; }
  }
`;

// ── STARS ────────────────────────────────────────────────────────
function Stars({ count }) {
  return (
    <div className="stars">
      {[1,2,3,4,5].map(i => (
        <span key={i} className={`star ${i <= count ? "filled" : "empty"}`}>★</span>
      ))}
    </div>
  );
}

// ── STATUS BADGE ─────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.active;
  return (
    <span className="badge" style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

// ── STAT CARD ────────────────────────────────────────────────────
function StatCard({ icon, iconBg, value, label, change, up }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: iconBg }}>{icon}</div>
      <div>
        <div className="stat-val">{value}</div>
        <div className="stat-label">{label}</div>
        {change && <div className={`stat-change ${up ? "up" : "down"}`}>{up ? "↑" : "↓"} {change}</div>}
      </div>
    </div>
  );
}

// ── MAIN APP ─────────────────────────────────────────────────────
export default function AdminApp() {
  const [collapsed,     setCollapsed]     = useState(false);
  const [activeStore,   setActiveStore]   = useState("ALL");
  const [activeNav,     setActiveNav]     = useState("პროდუქტები");
  const [search,        setSearch]        = useState("");
  const [statusFilter,  setStatusFilter]  = useState("all");
  const [selected,      setSelected]      = useState(new Set());
  const [products,      setProducts]      = useState(DEMO_PRODUCTS);

  // Filter products
  const filtered = products.filter(p => {
    const matchStore  = activeStore === "ALL" || STORE_KEYS[activeStore] === p.store;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.code.includes(search);
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchStore && matchSearch && matchStatus;
  });

  const activeStoreData = activeStore === "ALL" ? null : STORE_KEYS[activeStore];

  const toggleSelect = (id) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(p => p.id)));
    }
  };

  const deleteSelected = () => {
    setProducts(prev => prev.filter(p => !selected.has(p.id)));
    setSelected(new Set());
  };

  const storeTitle = activeStore === "ALL" ? "ყველა მაღაზია" : activeStore;
  const storeSubtitle = activeStore === "ALL"
    ? `სულ ${filtered.length} პროდუქტი`
    : `${filtered.length} პროდუქტი`;

  return (
    <>
      <style>{css}</style>
      <div className="admin-layout">

        {/* ── SIDEBAR ── */}
        <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
          <div className="sidebar-logo">
            <div className="logo-icon">RC</div>
            <div className="logo-label">RECOUNT</div>
          </div>

          <nav className="sidebar-nav">
            <div className="nav-section-label">PAGES</div>
            {NAV_ITEMS.map(item => (
              <button
                key={item.label}
                className={`nav-item ${activeNav === item.label ? "active" : ""}`}
                onClick={() => setActiveNav(item.label)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="sidebar-bottom">
            <button className="nav-item">
              <span className="nav-icon">📚</span>
              <span className="nav-label">Docs & Info</span>
            </button>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <div className={`main ${collapsed ? "collapsed" : ""}`}>

          {/* TOPBAR */}
          <header className="topbar">
            <button className="collapse-btn" onClick={() => setCollapsed(c => !c)}>
              {collapsed ? "→" : "←"}
            </button>

            <div className="store-tabs">
              {STORES.map(s => (
                <button
                  key={s}
                  className={`store-tab ${activeStore === s ? "active" : ""}`}
                  onClick={() => setActiveStore(s)}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="topbar-right">
              <div className="avatar">G</div>
            </div>
          </header>

          {/* CONTENT */}
          <div className="content">

            {/* PAGE HEADER */}
            <div className="page-header">
              <div>
                <div className="page-title">{storeTitle}</div>
                <div className="page-subtitle">{storeSubtitle}</div>
              </div>
              <div className="page-actions">
                <button className="btn btn-light">🔽 ფილტრი</button>
                <button className="btn btn-primary">＋ კატეგoriის დამატება</button>
              </div>
            </div>

            {/* STATS */}
            <div className="stats-row">
              <StatCard icon="📦" iconBg="#EFF6FF" value={products.length}  label="სულ პროდუქტი"  change="12% ამ თვეში" up={true} />
              <StatCard icon="✅" iconBg="#EAFAF1" value={products.filter(p=>p.in_stock!==false).length} label="მარaგშია" change="5 განახლდა" up={true} />
              <StatCard icon="💰" iconBg="#FFF8E7" value="₾ 12,450" label="საშ. ფასი" change="3% გაიზარდა" up={true} />
              <StatCard icon="🏪" iconBg="#F3EEFF" value="5"         label="მაღაზია"  change={null} />
            </div>

            {/* TABLE CARD */}
            <div className="card">

              {/* BULK BAR */}
              {selected.size > 0 && (
                <div className="bulk-bar">
                  <span>{selected.size} მონიშნული</span>
                  <button className="btn btn-danger" style={{padding:"5px 12px", fontSize:"12px"}} onClick={deleteSelected}>
                    🗑️ წაშლა
                  </button>
                  <button className="btn btn-light" style={{padding:"5px 12px", fontSize:"12px"}} onClick={() => setSelected(new Set())}>
                    გაუქმება
                  </button>
                </div>
              )}

              {/* TOOLBAR */}
              <div className="table-toolbar">
                <div className="search-wrap">
                  <span className="search-icon-inner">🔍</span>
                  <input
                    className="search-input"
                    placeholder="პროდუქტის ძებნა..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>

                <select
                  className="status-select"
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                >
                  <option value="all">Status — ყველა</option>
                  <option value="active">აქტიური</option>
                  <option value="inactive">Inactive</option>
                  <option value="published">Published</option>
                  <option value="low_stock">Low Stock</option>
                  <option value="out">მარაგი არ არ</option>
                </select>

                <div className="toolbar-right">
                  <button className="btn btn-primary">＋ პროდუქტის დამატება</button>
                </div>
              </div>

              {/* TABLE */}
              <table className="products-table">
                <thead>
                  <tr>
                    <th style={{width:40}}>
                      <input
                        type="checkbox"
                        className="cb"
                        checked={selected.size === filtered.length && filtered.length > 0}
                        onChange={toggleAll}
                      />
                    </th>
                    <th>დასახელება</th>
                    <th>ფასი (₾)</th>
                    <th>მარაგი</th>
                    <th>Price</th>
                    <th>Rating</th>
                    <th>Status</th>
                    {activeStore === "ALL" && <th>მაღაზია</th>}
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{textAlign:"center", padding:"48px", color:"var(--muted)"}}>
                        🔍 შედეგი ვერ მოიძებნა
                      </td>
                    </tr>
                  ) : filtered.map(p => (
                    <tr
                      key={p.id}
                      className={selected.has(p.id) ? "selected" : ""}
                      onClick={() => toggleSelect(p.id)}
                    >
                      <td onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="cb"
                          checked={selected.has(p.id)}
                          onChange={() => toggleSelect(p.id)}
                        />
                      </td>

                      <td>
                        <div className="product-cell">
                          {p.image ? (
                            <img
                              className="product-thumb"
                              src={p.image.replace(/__/g, "")}
                              alt={p.name}
                              onError={e => { e.target.style.display="none"; }}
                            />
                          ) : (
                            <div className="product-thumb-placeholder">📦</div>
                          )}
                          <div>
                            <div className="product-name">{p.name}</div>
                            <div className="product-code">{p.code}</div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className={`stock-val ${p.stock === 0 ? "zero" : p.stock <= 5 ? "low" : "ok"}`}>
                          {p.stock}
                          {p.stock > 0 && p.stock <= 5 && (
                            <span className="badge" style={{marginLeft:8, background:"#FFFDE7", color:"#F6C000", fontSize:10}}>Low stock</span>
                          )}
                        </span>
                      </td>

                      <td><span className="price-val">{p.price.toFixed(2)}</span></td>
                      <td><span className="price-val">{p.price.toFixed(2)}</span></td>

                      <td><Stars count={p.rating} /></td>

                      <td><StatusBadge status={p.status} /></td>

                      {activeStore === "ALL" && (
                        <td>
                          <span className={`store-badge store-${p.store}`}>
                            {Object.keys(STORE_KEYS).find(k => STORE_KEYS[k] === p.store) || p.store}
                          </span>
                        </td>
                      )}

                      <td onClick={e => e.stopPropagation()}>
                        <button className="actions-btn">
                          Actions ▾
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* PAGINATION */}
              <div className="pagination">
                <div className="pagination-info">
                  {filtered.length} პროდუქტი
                </div>
                <div className="pagination-btns">
                  <button className="page-btn">‹</button>
                  <button className="page-btn active">1</button>
                  <button className="page-btn">2</button>
                  <button className="page-btn">3</button>
                  <button className="page-btn">›</button>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </>
  );
}