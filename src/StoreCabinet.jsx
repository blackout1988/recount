// ═══════════════════════════════════════════════════════════════
// RECOUNT.GE — StoreCabinet.jsx  v8
// იმავე სტილი რაც RecountApp-ს აქვს
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from "react";
import MeiliSearch from "meilisearch";
import "./RecountApp.css";

const FB_BASE = "https://recount-91f28-default-rtdb.europe-west1.firebasedatabase.app";
const LS_KEY  = "recount_store_session";
const meili   = new MeiliSearch({ host:"http://localhost:7700", apiKey:"uW_K4inBKuVQJj2jic06rr2DSV_Bc6p_sb6ST9sJt8g" });
const idx     = meili.index("products");

// ── Data ──────────────────────────────────────────────────────
const CAT_SUBS = {
  "სამშენებლო ფხვნილები":["წებოცემენტი","ფუგა","გრუნტი","შპაკლი","შტუკატური","თაბაშირი","ცემენტი","სხვა"],
  "ბლოკი და აგური":["გაზობეტონის ბლოკი","კერამიკული აგური","სილიკატის აგური","პუსტოტელი","სხვა"],
  "თაბაშირ-მუყაო":["GKB ფილა","GKBI ფილა","GKBF ფილა","პროფილი","სახსრის ლენტი","სხვა"],
  "სამშენებლო ფილა":["კედლის ფილა","იატაკის ფილა","კერამოგრანიტი","მოზაიკა","სხვა"],
  "სამშენებლო პროფილები":["CD","UD","CW","UW","კუთხური","სხვა"],
  "ხმის და თბოიზოლაცია":["მინის ბამბა","ქვის ბამბა","პენოფლექსი","პოლისტიროლი","სხვა"],
  "ჰიდროიზოლაცია":["ლენტა","მასტიკა","მემბრანა","ბიტუმი","სხვა"],
  "სახურავი და ფასადი":["მეტალოკრამიტი","ბიტუმური კრამიტი","პროფლისტი","ვენტფასადი","სხვა"],
  "საღებავები და ლაქები":["ინტერიერის","ფასადის","ლაქი","გრუნტი-საღებავი","სხვა"],
  "ლითონის მასალა":["არმატურა","ბალკა","კუთხური","მილი","ფურცელი","სხვა"],
  "სახარჯი მასალა":["ჭანჭიკი","დიუბელი","ხრახნი","მავთული","სხვა"],
  "სანტექნიკა კანალიზაცია":["PVC მილი","PP მილი","შესაერთებელი","კრანი","სხვა"],
  "ხის მასალა":["დაფა","ლამბერი","ტყე-პირი","ფანერა","სხვა"],
  "გათბობის სისტემა":["რადიატორი","ქვაბი","მილი","ფიტინგი","სხვა"],
  "ელექტროობა და განათება":["კაბელი","LED","ამომრთველი","ვარდაკი","ავტომატი","სხვა"],
};
const CATEGORIES = Object.keys(CAT_SUBS);
const UNITS = ["კგ","გ","ლ","მლ","მ","მ²","მ³","ც","შტ","კომპლ.","პაკ.","ყ."];

const COUNTRIES = [
  "საქართველო","გერმანია","საფრანგეთი","იტალია","ესპანეთი",
  "პოლონეთი","ჩეხეთი","ავსტრია","შვეიცარია","ნიდერლანდები",
  "ბელგია","შვედეთი","ფინეთი","დანია","ნორვეგია",
  "რუსეთი","თურქეთი","ჩინეთი","იაპონია","სამხრეთ კორეა",
  "აშშ","კანადა","ბრაზილია","ინდოეთი","ირანი","სხვა",
];
const SIZE_UNITS = ["კგ","გ","ლ","მლ","მ","მ²","მ³","ც","შტ","კომპლ.","პაკ."];

const BANKS = ["TBC Bank","Bank of Georgia","Credo Bank","Liberty Bank","Basis Bank","VTB Bank Georgia","ProCredit Bank","სხვა"];

// ── Firebase ──────────────────────────────────────────────────
async function fbGet(p){ const r=await fetch(`${FB_BASE}${p}.json`); return r.ok?r.json():null; }
async function fbPush(p,d){ const r=await fetch(`${FB_BASE}${p}.json`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(d)}); return r.ok?r.json():null; }
async function fbDelete(p){ await fetch(`${FB_BASE}${p}.json`,{method:"DELETE"}); }
function eKey(e){ return e.toLowerCase().replace(/[.#$[\]]/g,"_"); }
async function loginStore(email,pw){
  const all=await fbGet("/store_registrations"); if(!all) return null;
  const m=Object.values(all).find(s=>s.email?.toLowerCase()===email.toLowerCase()&&s.password===pw);
  if(!m) return null;
  if(m.status==="rejected") return {error:"rejected"};
  return m;
}

// ── Shared atoms using CSS vars ───────────────────────────────
const V = {
  blue:   "#F6B110", blueLt:"#FEF9EC", blueDim:"rgba(246,177,16,.1)",
  bg:     "#F5F8FA", sur:"#fff",       brd:"#E4E6EF",
  txt:    "#3F4254", txt2:"#7E8299",   txt3:"#B5B5C3", dark:"#181C32",
  green:  "#50CD89", red:"#F1416C",    purple:"#7C3AED",
  r:      "10px",    rSm:"6px",
  sh:     "0 1px 20px rgba(82,63,105,.07)",
  sh2:    "0 4px 24px rgba(0,0,0,.09)",
};

// ── Cabinet-specific CSS (injected once) ──────────────────────
const CABINET_CSS = `
.cab-wrap { min-height:100vh; background:var(--bg,${V.bg}); }
.cab-hdr { height:60px; background:#fff; border-bottom:1px solid var(--brd,${V.brd}); display:flex; align-items:center; padding:0 24px; gap:16px; position:sticky; top:0; z-index:400; box-shadow:${V.sh}; }
.cab-logo { font-size:18px; font-weight:700; color:var(--dark,${V.dark}); user-select:none; border:none; background:none; padding:0; display:flex; align-items:center; letter-spacing:-.3px; cursor:pointer; }
.cab-logo em { color:var(--blue,${V.blue}); font-style:normal; }
.cab-logo-ge { font-size:11px; font-weight:600; color:var(--txt3,${V.txt3}); margin-left:1px; align-self:flex-end; margin-bottom:1px; }
.cab-nav { background:var(--sur,#fff); border-bottom:1px solid var(--brd,${V.brd}); display:flex; padding:0 24px; gap:4px; }
.cab-tab { padding:14px 18px; border:none; border-bottom:3px solid transparent; background:none; font-size:13px; font-weight:500; color:var(--txt2,${V.txt2}); cursor:pointer; display:flex; align-items:center; gap:7px; transition:all .15s; white-space:nowrap; }
.cab-tab:hover { color:var(--blue,${V.blue}); }
.cab-tab.active { color:var(--blue,${V.blue}); border-bottom-color:var(--blue,${V.blue}); font-weight:600; }
.cab-tab .badge { background:var(--blue,${V.blue}); color:#fff; font-size:10px; font-weight:700; padding:1px 6px; border-radius:10px; }
.cab-page { padding:28px 24px; max-width:1280px; margin:0 auto; }
.cab-card { background:#fff; border:1px solid var(--brd,${V.brd}); border-radius:var(--r,10px); box-shadow:${V.sh}; overflow:hidden; }
.cab-card-hdr { display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-bottom:1px solid var(--brd,${V.brd}); }
.cab-card-ttl { font-size:15px; font-weight:700; color:var(--dark,${V.dark}); display:flex; align-items:center; gap:8px; }
.cab-card-ttl::before { content:''; display:inline-block; width:4px; height:18px; background:var(--blue,${V.blue}); border-radius:2px; }
.cab-card-body { padding:20px; }
.cab-inp { width:100%; padding:9px 12px; border:1.5px solid var(--brd,${V.brd}); border-radius:var(--r-sm,6px); font-family:inherit; font-size:13px; color:var(--dark,${V.dark}); outline:none; transition:border-color .15s,box-shadow .15s; background:#fff; box-sizing:border-box; }
.cab-inp:focus { border-color:var(--blue,${V.blue}); box-shadow:0 0 0 3px var(--blue-dim,${V.blueDim}); }
.cab-inp.err { border-color:var(--red,${V.red}); }
.cab-lbl { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.7px; color:var(--txt2,${V.txt2}); margin-bottom:5px; display:block; }
.cab-fg { margin-bottom:14px; }
.cab-err { font-size:11px; color:var(--red,${V.red}); margin-top:3px; display:block; }
.cab-btn { display:inline-flex; align-items:center; gap:6px; padding:9px 18px; border-radius:var(--r-sm,6px); font-size:13px; font-weight:600; cursor:pointer; border:none; transition:opacity .15s,transform .1s; white-space:nowrap; font-family:inherit; }
.cab-btn:active { transform:scale(.98); }
.cab-btn:disabled { opacity:.45; cursor:not-allowed; transform:none; }
.cab-btn-primary { background:var(--blue,${V.blue}); color:#fff; }
.cab-btn-primary:hover:not(:disabled) { opacity:.9; }
.cab-btn-ghost { background:var(--bg,${V.bg}); color:var(--txt,${V.txt}); border:1px solid var(--brd,${V.brd}); }
.cab-btn-ghost:hover { border-color:var(--txt3,${V.txt3}); }
.cab-btn-danger { background:none; color:var(--red,${V.red}); border:1px solid var(--red,${V.red}); padding:5px 12px; font-size:12px; }
.cab-btn-danger:hover { background:var(--red,${V.red}); color:#fff; }
.cab-stat-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-bottom:20px; }
.cab-stat { background:#fff; border:1px solid var(--brd,${V.brd}); border-radius:var(--r,10px); padding:20px 22px; box-shadow:${V.sh}; display:flex; align-items:center; justify-content:space-between; }
.cab-stat-val { font-size:28px; font-weight:800; color:var(--dark,${V.dark}); line-height:1; }
.cab-stat-lbl { font-size:13px; color:var(--txt2,${V.txt2}); margin-top:5px; }
.cab-stat-icon { font-size:28px; opacity:.4; }
.cab-toolbar { display:flex; align-items:center; gap:10px; padding:12px 20px; border-bottom:1px solid var(--brd,${V.brd}); background:var(--bg,${V.bg}); flex-wrap:wrap; }
.cab-srch { position:relative; flex:1; min-width:180px; }
.cab-srch input { padding-left:32px; }
.cab-srch svg { position:absolute; left:10px; top:50%; transform:translateY(-50%); color:var(--txt3,${V.txt3}); pointer-events:none; }
.cab-tbl { width:100%; border-collapse:collapse; min-width:900px; }
.cab-tbl th { padding:10px 14px; font-size:11.5px; font-weight:700; color:var(--txt2,${V.txt2}); background:var(--bg,${V.bg}); text-transform:uppercase; letter-spacing:.06em; white-space:nowrap; border-bottom:2px solid var(--brd,${V.brd}); cursor:pointer; user-select:none; }
.cab-tbl th:hover { color:var(--blue,${V.blue}); }
.cab-tbl td { padding:11px 14px; font-size:13px; color:var(--txt,${V.txt}); border-top:1px solid var(--brd,${V.brd}); vertical-align:middle; }
.cab-tbl tr:hover td { background:#f8f9fc; }
.cab-badge { font-size:11px; font-weight:700; padding:3px 10px; border-radius:20px; white-space:nowrap; }
.cab-badge-ok  { background:#E8FFF3; color:#50CD89; }
.cab-badge-pend { background:#FFF8DD; color:#F6C000; }
.cab-badge-rej { background:#FFF5F8; color:#F1416C; }
.cab-pager { display:flex; gap:4px; align-items:center; }
.cab-pager button { min-width:32px; height:32px; padding:0 8px; border:1px solid var(--brd,${V.brd}); border-radius:var(--r-sm,6px); background:#fff; color:var(--txt,${V.txt}); font-size:13px; cursor:pointer; font-family:inherit; transition:all .12s; }
.cab-pager button:hover { border-color:var(--blue,${V.blue}); color:var(--blue,${V.blue}); }
.cab-pager button.active { background:var(--blue,${V.blue}); border-color:var(--blue,${V.blue}); color:#fff; font-weight:700; }
.cab-pager button:disabled { opacity:.4; cursor:default; }
.cab-footer-row { display:flex; align-items:center; justify-content:space-between; padding:14px 20px; flex-wrap:wrap; gap:10px; }
.cab-footer-info { font-size:12.5px; color:var(--txt3,${V.txt3}); }
.cab-modal-ov { position:fixed; inset:0; background:rgba(0,0,0,.45); z-index:2000; display:flex; align-items:center; justify-content:center; padding:20px; animation:mfi .15s; }
.cab-modal { background:#fff; border-radius:var(--r,10px); width:100%; max-width:560px; max-height:90vh; overflow-y:auto; box-shadow:0 24px 64px rgba(0,0,0,.18); animation:mup .18s; display:flex; flex-direction:column; }
.cab-modal.wide { max-width:660px; }
.cab-modal-hdr { padding:18px 20px; border-bottom:1px solid var(--brd,${V.brd}); display:flex; align-items:center; justify-content:space-between; flex-shrink:0; border-top:3px solid var(--blue,${V.blue}); border-radius:var(--r,10px) var(--r,10px) 0 0; }
.cab-modal-ttl { font-size:16px; font-weight:700; color:var(--dark,${V.dark}); }
.cab-modal-x { background:var(--bg,${V.bg}); border:none; border-radius:6px; width:30px; height:30px; cursor:pointer; color:var(--txt3,${V.txt3}); font-size:18px; display:flex; align-items:center; justify-content:center; }
.cab-modal-x:hover { background:var(--brd,${V.brd}); }
.cab-modal-body { padding:20px; flex:1; }
.cab-modal-foot { padding:14px 20px; border-top:1px solid var(--brd,${V.brd}); display:flex; justify-content:flex-end; gap:8px; flex-shrink:0; }
.cab-sec { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.8px; color:var(--blue,${V.blue}); padding-bottom:6px; border-bottom:1px solid var(--blue-lt,${V.blueLt}); margin:18px 0 12px; }
.cab-g2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.cab-g3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; }
.cab-prod-list { border:1.5px solid var(--brd,${V.brd}); border-radius:var(--r-sm,6px); overflow:hidden; margin-bottom:8px; }
.cab-prod-item { display:flex; align-items:center; gap:10px; padding:9px 13px; border-bottom:1px solid var(--brd,${V.brd}); cursor:pointer; transition:background .1s; }
.cab-prod-item:hover { background:var(--bg,${V.bg}); }
.cab-prod-item.sel { background:var(--blue-lt,${V.blueLt}); }
.cab-prod-item:last-child { border-bottom:none; }
.cab-unit-grid { display:flex; flex-wrap:wrap; gap:6px; }
.cab-unit-btn { padding:5px 13px; border-radius:var(--r-sm,6px); border:1.5px solid var(--brd,${V.brd}); background:#fff; color:var(--txt2,${V.txt2}); font-size:12.5px; cursor:pointer; font-family:inherit; transition:all .12s; }
.cab-unit-btn.sel { border-color:var(--blue,${V.blue}); background:var(--blue-lt,${V.blueLt}); color:var(--blue,${V.blue}); font-weight:600; }
.cab-img-drop { border:2px dashed var(--brd,${V.brd}); border-radius:var(--r-sm,6px); height:90px; display:flex; align-items:center; justify-content:center; cursor:pointer; background:var(--bg,${V.bg}); overflow:hidden; position:relative; transition:border-color .15s; }
.cab-img-drop:hover { border-color:var(--blue,${V.blue}); }
.cab-img-drop.has-img { border-color:var(--blue,${V.blue}); background:var(--blue-lt,${V.blueLt}); }
.cab-alert { padding:10px 14px; border-radius:var(--r-sm,6px); font-size:13px; margin-bottom:12px; }
.cab-alert-warn { background:#FFF8DD; border:1px solid #F6C000; color:#7A4F00; }
.cab-alert-info { background:#EEF6FF; border:1px solid #B8D9F8; color:#1565C0; }
.cab-choose-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.cab-choose-card { border:1.5px solid var(--brd,${V.brd}); border-radius:var(--r,10px); padding:24px 16px; background:#fff; cursor:pointer; text-align:center; transition:all .15s; }
.cab-choose-card:hover { border-color:var(--blue,${V.blue}); background:var(--blue-lt,${V.blueLt}); }
.cab-choose-card.disabled { opacity:.5; cursor:not-allowed; }
.cab-choose-icon { font-size:36px; margin-bottom:10px; }
.cab-user-avatar { width:36px; height:36px; border-radius:50%; background:var(--blue,${V.blue}); color:#fff; font-weight:700; font-size:14px; display:flex; align-items:center; justify-content:center; flex-shrink:0; cursor:pointer; }
.cab-login-wrap { min-height:100vh; background:var(--bg,${V.bg}); display:flex; align-items:center; justify-content:center; padding:16px; }
.cab-login-box { background:#fff; border:1px solid var(--brd,${V.brd}); border-radius:var(--r,10px); width:100%; max-width:400px; box-shadow:${V.sh2}; overflow:hidden; }
.cab-login-top { background:var(--dark,${V.dark}); padding:28px 28px 24px; text-align:center; }
.cab-login-logo { font-size:24px; font-weight:700; color:#fff; letter-spacing:-.3px; }
.cab-login-logo em { color:var(--blue,${V.blue}); font-style:normal; }
.cab-login-sub { font-size:12.5px; color:rgba(255,255,255,.45); margin-top:6px; }
.cab-login-body { padding:28px; }
.cab-pw-wrap { position:relative; }
.cab-pw-eye { position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:var(--txt3,${V.txt3}); display:flex; padding:2px; }
.cab-tbl-overflow { overflow-x:auto; }
@keyframes mfi{from{opacity:0}to{opacity:1}}
@keyframes mup{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@media(max-width:768px){.cab-stat-grid{grid-template-columns:1fr}.cab-g2,.cab-g3{grid-template-columns:1fr}.cab-page{padding:16px}}
`;

function useCabinetStyles(){
  useEffect(()=>{
    if(!document.getElementById("cab-css")){
      const s=document.createElement("style");
      s.id="cab-css"; s.textContent=CABINET_CSS;
      document.head.appendChild(s);
    }
  },[]);
}

// ── MODAL ─────────────────────────────────────────────────────
function Modal({title,onClose,children,footer,wide}){
  useEffect(()=>{const h=e=>{if(e.key==="Escape")onClose();};document.addEventListener("keydown",h);return()=>document.removeEventListener("keydown",h);},[onClose]);
  return(
    <div className="cab-modal-ov" onClick={onClose}>
      <div className={`cab-modal${wide?" wide":""}`} onClick={e=>e.stopPropagation()}>
        <div className="cab-modal-hdr">
          <span className="cab-modal-ttl">{title}</span>
          <button className="cab-modal-x" onClick={onClose}>✕</button>
        </div>
        <div className="cab-modal-body">{children}</div>
        {footer&&<div className="cab-modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

function FG({label,error,children}){
  return(
    <div className="cab-fg">
      {label&&<label className="cab-lbl">{label}</label>}
      {children}
      {error&&<span className="cab-err">{error}</span>}
    </div>
  );
}

// ── MANUAL PRODUCT MODAL — multi-step wizard ─────────────────
function ManualProductModal({storeKey,storeName,onClose,onAdded}){
  // step: 1=კატ, 2=პროდუქტი/ახალი, 3=ფასი+ერთ+რაოდ, 4=სურათი+აღწერა
  const [step,setStep]    = useState(1);
  const [cat,setCat]      = useState("");
  const [sub,setSub]      = useState("");
  // step 2
  const [allP,setAll]     = useState([]);
  const [srch,setSrch]    = useState("");
  const [sel,setSel]      = useState(null);   // existing product
  const [isNew,setIsNew]  = useState(false);  // creating new
  const [newName,setNewName]=useState("");
  const [brand,setBrand]    = useState("");
  const [country,setCountry]= useState("");
  const [sizeNum,setSizeNum]= useState("");
  const [sizeUnit,setSizeUnit]=useState("");
  const [shortDesc,setShortDesc]=useState("");
  const [ld,setLd]          = useState(false);
  // step 3
  const [price,setPrice]  = useState("");
  const [priceW,setPriceW]= useState("");
  const [unit,setUnit]    = useState("");
  const [qty,setQty]      = useState("");
  // step 4
  const [img,setImg]      = useState("");
  const [desc,setDesc]    = useState("");
  const [err,setErr]      = useState({});
  const [saving,setSaving]= useState(false);
  const fileRef           = useRef();

  useEffect(()=>{
    const h=e=>{if(e.key==="Escape")onClose();};
    document.addEventListener("keydown",h);
    return()=>document.removeEventListener("keydown",h);
  },[onClose]);

  // Load products when cat+sub set
  useEffect(()=>{
    if(!cat||!sub){setAll([]);setSel(null);setIsNew(false);return;}
    setLd(true);setSrch("");setSel(null);setIsNew(false);
    idx.search("",{filter:`category = "${cat}"`,limit:500,sort:["name:asc"]})
      .then(r=>{const seen=new Set();setAll((r.hits||[]).filter(h=>{const k=h.name?.toLowerCase().trim();if(!k||seen.has(k))return false;seen.add(k);return true;}));})
      .catch(()=>setAll([])).finally(()=>setLd(false));
  },[cat,sub]);

  const filtered = srch.trim()
    ? allP.filter(p=>p.name?.toLowerCase().includes(srch.toLowerCase()))
    : allP;
  const showNewBtn = srch.trim() && filtered.length===0;

  // Step labels
  const STEPS = ["კატეგორია","პროდუქტი","ფასი","დასტური"];

  const goNext1 = () => {
    const e={};
    if(!cat) e.cat="სავალდებულოა";
    if(!sub) e.sub="სავალდებულოა";
    setErr(e);
    if(Object.keys(e).length===0) setStep(2);
  };

  const goNext2 = () => {
    const e={};
    if(!sel && !isNew)         e.prod="აირჩიე არსებული ან შექმენი ახალი";
    if(isNew&&!newName.trim()) e.newName="სახელი სავალდებულოა";
    setErr(e);
    if(Object.keys(e).length===0) setStep(3);
  };

  const goNext3 = () => {
    const e={};
    if(!price||isNaN(+price)) e.price="სავალდებულოა";
    if(!qty||isNaN(+qty))     e.qty="სავალდებულოა";
    setErr(e);
    if(Object.keys(e).length===0) setStep(4);
  };

  const save = async () => {
    setSaving(true);
    const name = isNew ? newName.trim() : (sel?.name||"");
    await fbPush(`/store_products/${storeKey}`,{
      name, category:cat, sub_category:sub,
      price:+price, wholesale_price:priceW?+priceW:null,
      unit:sizeUnit||unit, quantity:+qty, description:desc,
      brand_name:brand||null, country:country||null,
      size_num:sizeNum||null, size_unit:sizeUnit||null, short_description:shortDesc||null,
      image_url:img||(sel?.image||""),
      store_name:storeName, status:"pending",
      submitted_at:new Date().toISOString(),
      store_key:storeKey, meili_uid:sel?.uid||null,
    });
    setSaving(false); onAdded(); onClose();
  };

  const pickImg = e => {
    const f=e.target.files?.[0]; if(!f) return;
    const r=new FileReader(); r.onload=ev=>setImg(ev.target.result); r.readAsDataURL(f);
  };

  // Progress bar
  const Progress = () => (
    <div style={{padding:"0 20px 16px",borderBottom:"1px solid var(--brd)"}}>
      <div style={{display:"flex",alignItems:"center",gap:0}}>
        {STEPS.map((s,i)=>{
          const n=i+1;
          const done=step>n; const active=step===n;
          return(
            <div key={s} style={{display:"flex",alignItems:"center",flex:i<STEPS.length-1?1:"unset"}}>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                <div style={{width:28,height:28,borderRadius:"50%",background:done?"var(--green)":active?"var(--blue)":"var(--bg)",border:`2px solid ${done?"var(--green)":active?"var(--blue)":"var(--brd)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:done||active?"#fff":"var(--txt3)",transition:"all .2s"}}>
                  {done?"✓":n}
                </div>
                <div style={{fontSize:10,fontWeight:active?700:400,color:active?"var(--blue)":done?"var(--green)":"var(--txt3)",whiteSpace:"nowrap"}}>{s}</div>
              </div>
              {i<STEPS.length-1&&<div style={{flex:1,height:2,background:done?"var(--green)":"var(--brd)",margin:"0 4px",marginBottom:18,transition:"background .2s"}}/>}
            </div>
          );
        })}
      </div>
    </div>
  );

  return(
    <div className="cab-modal-ov" onClick={onClose}>
      <div className="cab-modal wide" onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div className="cab-modal-hdr">
          <span className="cab-modal-ttl">პროდუქტის დამატება</span>
          <button className="cab-modal-x" onClick={onClose}>✕</button>
        </div>

        {/* Progress */}
        <Progress/>

        {/* Body */}
        <div className="cab-modal-body">

          {/* ── Step 1: კატეგორია ── */}
          {step===1&&(
            <div>
              <div className="cab-sec" style={{marginTop:0}}>კატეგორია და ქვეკატეგორია</div>
              <div className="cab-g2">
                <FG label="კატეგორია *" error={err.cat}>
                  <select className={`cab-inp${err.cat?" err":""}`} value={cat} style={{appearance:"none"}} onChange={e=>{setCat(e.target.value);setSub("");}}>
                    <option value="">— აირჩიე —</option>
                    {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </FG>
                <FG label="ქვეკატეგორია *" error={err.sub}>
                  <select className={`cab-inp${err.sub?" err":""}`} value={sub} style={{appearance:"none",opacity:cat?1:.6}} disabled={!cat} onChange={e=>setSub(e.target.value)}>
                    <option value="">— აირჩიე —</option>
                    {(CAT_SUBS[cat]||[]).map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </FG>
              </div>
            </div>
          )}

          {/* ── Step 2: პროდუქტის არჩევა ── */}
          {step===2&&!isNew&&(
            <div>
              <div className="cab-sec" style={{marginTop:0}}>
                {cat} → {sub}
              </div>
              {ld?(
                <div className="spin-wrap" style={{padding:32}}><div className="spin"/></div>
              ):(
                <>
                  <div className="cab-srch" style={{marginBottom:10}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                    <input className="cab-inp" value={srch} style={{paddingLeft:32}} placeholder={`${allP.length} პროდუქტიდან მოძებნე...`} onChange={e=>setSrch(e.target.value)} autoFocus/>
                  </div>
                  {err.prod&&<span className="cab-err" style={{marginBottom:8,display:"block"}}>{err.prod}</span>}
                  <div className="cab-prod-list">
                    <div style={{maxHeight:260,overflowY:"auto"}}>
                      {filtered.slice(0,60).map(p=>(
                        <div key={p.uid||p.id} className={`cab-prod-item${sel?.uid===p.uid?" sel":""}`} onClick={()=>{setSel(p);setSrch(p.name||"");}}>
                          {p.image?<img src={p.image} alt="" style={{width:34,height:34,objectFit:"cover",borderRadius:6,flexShrink:0}} onError={e=>{e.currentTarget.style.display="none";}}/>:<span style={{fontSize:20,flexShrink:0}}>📦</span>}
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:13,fontWeight:sel?.uid===p.uid?600:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"var(--dark)"}}>{p.name}</div>
                            {p.brand&&<div style={{fontSize:11,color:"var(--txt3)"}}>{p.brand}</div>}
                          </div>
                          {sel?.uid===p.uid&&<span style={{color:"var(--green)",fontWeight:700,fontSize:16}}>✓</span>}
                        </div>
                      ))}
                    </div>
                    {/* New product button — switches view */}
                    <div className="cab-prod-item" onClick={()=>{setIsNew(true);setSel(null);setNewName(showNewBtn?srch.trim():"");}}
                      style={{borderTop:"2px solid var(--brd)",background:"var(--bg)"}}>
                      <span style={{fontSize:20,color:"var(--blue)"}}>＋</span>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:"var(--blue)"}}>{showNewBtn?`„${srch}" — ახლიდან შექმნა`:"ახალი პროდუქტის შექმნა"}</div>
                        <div style={{fontSize:11,color:"var(--txt3)"}}>სიაში ვერ ნახე? შექმენი ახალი</div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Step 2 NEW: ახალი პროდუქტის ინფო ── */}
          {step===2&&isNew&&(
            <div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
                <button onClick={()=>{setIsNew(false);setSel(null);}} style={{background:"none",border:"1px solid var(--brd)",borderRadius:"var(--r-sm)",padding:"5px 12px",fontSize:12,color:"var(--txt2)",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5}}>
                  ← სიაზე დაბრუნება
                </button>
                <div style={{padding:"6px 12px",background:"var(--blue-lt)",border:"1px solid rgba(246,177,16,.3)",borderRadius:"var(--r-sm)",fontSize:12,color:"var(--txt2)"}}>
                  <b>{cat}</b> → {sub}
                </div>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:14,alignItems:"flex-start",marginBottom:14}}>
                <FG label="დასახელება *" error={err.newName}>
                  <input className={`cab-inp${err.newName?" err":""}`} value={newName}
                    placeholder="პროდუქტის სრული სახელი"
                    onChange={e=>{setNewName(e.target.value);setErr(er=>({...er,newName:""}));}}
                    autoFocus/>
                </FG>
                <div>
                  <label className="cab-lbl">სურათი</label>
                  <div className={`cab-img-drop${img?" has-img":""}`}
                    onClick={()=>fileRef.current?.click()}
                    style={{width:80,height:38,borderRadius:"var(--r-sm)"}}>
                    {img
                      ?<img src={img} alt="" style={{width:"100%",height:"100%",objectFit:"contain"}}/>
                      :<span style={{fontSize:20}}>🖼</span>}
                    {img&&<button onClick={e=>{e.stopPropagation();setImg("");}}
                      style={{position:"absolute",top:2,right:2,background:"rgba(0,0,0,.45)",border:"none",borderRadius:"50%",width:16,height:16,color:"#fff",cursor:"pointer",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={pickImg}/>
                </div>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,marginBottom:14}}>
                <FG label="მწარმოებელი">
                  <input className="cab-inp" value={brand}
                    placeholder="მაგ. Ceresit, Knauf..."
                    onChange={e=>setBrand(e.target.value)}/>
                </FG>
                <FG label="წარმოების ქვეყანა">
                  <select className="cab-inp" value={country} style={{appearance:"none"}} onChange={e=>setCountry(e.target.value)}>
                    <option value="">— აირჩიე —</option>
                    {COUNTRIES.map(cn=><option key={cn} value={cn}>{cn}</option>)}
                  </select>
                </FG>
                <FG label="ზომა / წონა">
                  <div style={{display:"flex",gap:6}}>
                    <input className="cab-inp" type="number" min="0" step="0.01"
                      value={sizeNum} placeholder="20" style={{width:"50%"}}
                      onChange={e=>setSizeNum(e.target.value)}/>
                    <select className="cab-inp" value={sizeUnit} style={{width:"50%",appearance:"none"}}
                      onChange={e=>setSizeUnit(e.target.value)}>
                      <option value="">ერთ.</option>
                      {SIZE_UNITS.map(u=><option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </FG>
              </div>


            </div>
          )}

          {/* ── Step 3: ფასი + რაოდენობა ── */}
          {step===3&&(
            <div>
              <div style={{padding:"10px 14px",background:"var(--bg)",borderRadius:"var(--r-sm)",fontSize:13,fontWeight:600,color:"var(--dark)",marginBottom:16}}>
                {isNew?newName:(sel?.name||"")}
                {(sizeNum&&sizeUnit)&&<span style={{marginLeft:8,fontSize:12,fontWeight:400,color:"var(--txt3)"}}>{sizeNum} {sizeUnit}</span>}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>
                <FG label="საცალო ფასი (₾) *" error={err.price}>
                  <input className={`cab-inp${err.price?" err":""}`} type="number" min="0" step="0.01"
                    value={price} placeholder="0.00" onChange={e=>setPrice(e.target.value)} autoFocus/>
                </FG>
                <FG label="საბითუმო ფასი (₾)">
                  <input className="cab-inp" type="number" min="0" step="0.01"
                    value={priceW} placeholder="0.00" onChange={e=>setPriceW(e.target.value)}/>
                </FG>
                <FG label="რაოდენობა / მარაგი *" error={err.qty}>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <input className={`cab-inp${err.qty?" err":""}`} type="number" min="0" step="1"
                      value={qty} placeholder="0" style={{flex:1}}
                      onChange={e=>setQty(e.target.value)}/>
                    {sizeUnit&&<span style={{fontSize:12,color:"var(--txt2)",whiteSpace:"nowrap",flexShrink:0}}>{sizeUnit}</span>}
                  </div>
                </FG>
              </div>
            </div>
          )}

          {/* ── Step 4: დასტური ── */}
          {step===4&&(
            <div>
              <div style={{textAlign:"center",padding:"24px 0 16px"}}>
                {img
                  ?<img src={img} alt="" style={{width:90,height:90,objectFit:"contain",borderRadius:"var(--r)",border:"1px solid var(--brd)",marginBottom:14}}/>
                  :<div style={{fontSize:52,marginBottom:14}}>📦</div>}
                <div style={{fontWeight:700,fontSize:16,color:"var(--dark)",marginBottom:4}}>{isNew?newName:(sel?.name||"")}</div>
                <div style={{fontSize:13,color:"var(--txt2)"}}>{cat} → {sub}</div>
                {(sizeNum&&sizeUnit)&&<div style={{fontSize:13,color:"var(--txt3)",marginTop:2}}>{sizeNum} {sizeUnit}</div>}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,background:"var(--bg)",borderRadius:"var(--r-sm)",padding:"14px 16px",marginBottom:16}}>
                <div style={{textAlign:"center"}}><div style={{fontSize:11,color:"var(--txt3)",marginBottom:3}}>საცალო</div><div style={{fontWeight:700,fontSize:15,color:"var(--dark)"}}>{price?`${price} ₾`:"—"}</div></div>
                <div style={{textAlign:"center"}}><div style={{fontSize:11,color:"var(--txt3)",marginBottom:3}}>საბითუმო</div><div style={{fontWeight:700,fontSize:15,color:"var(--dark)"}}>{priceW?`${priceW} ₾`:"—"}</div></div>
                <div style={{textAlign:"center"}}><div style={{fontSize:11,color:"var(--txt3)",marginBottom:3}}>მარაგი</div><div style={{fontWeight:700,fontSize:15,color:"var(--dark)"}}>{qty||"—"} {sizeUnit}</div></div>
              </div>
              <div className="cab-alert cab-alert-warn">⚠ პროდუქტი ჩაიწერება <b>განხილვის</b> სტატუსით. ადმინის დადასტურების შემდეგ გამოჩნდება საიტზე.</div>
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="cab-modal-foot">
          {step===1&&<button className="cab-btn cab-btn-ghost" onClick={onClose}>გაუქმება</button>}
          {step>1&&<button className="cab-btn cab-btn-ghost" onClick={()=>{setErr({});setStep(s=>s-1);}}>← უკან</button>}
          <div style={{flex:1}}/>
          {step===1&&<button className="cab-btn cab-btn-primary" onClick={goNext1}>შემდეგი →</button>}
          {step===2&&<button className="cab-btn cab-btn-primary" onClick={goNext2}>შემდეგი →</button>}
          {step===3&&<button className="cab-btn cab-btn-primary" onClick={goNext3}>შემდეგი →</button>}
          {step===4&&<button className="cab-btn cab-btn-primary" onClick={save} disabled={saving}>{saving?"ინახება...":"📦 დამატება"}</button>}
        </div>
      </div>
    </div>
  );
}

// ── ADD CHOOSER ───────────────────────────────────────────────
function AddProductChooser({storeKey,storeName,onClose,onAdded}){
  const [mode,setMode]=useState(null);
  if(mode==="manual") return <ManualProductModal storeKey={storeKey} storeName={storeName} onClose={onClose} onAdded={onAdded}/>;
  return(
    <Modal title="პროდუქტის დამატება" onClose={onClose}>
      <div className="cab-choose-grid">
        {[{icon:"✍️",t:"ხელით დამატება",sub:"ფორმის შევსება ნაბიჯ-ნაბიჯ",mode:"manual",on:true},{icon:"🤖",t:"ავტომატური",sub:"XML / CSV / API — მალე",mode:"auto",on:false}].map(opt=>(
          <div key={opt.mode} className={`cab-choose-card${opt.on?"":" disabled"}`} onClick={()=>opt.on?setMode(opt.mode):null}>
            <div className="cab-choose-icon">{opt.icon}</div>
            <div style={{fontWeight:700,fontSize:14,color:V.dark,marginBottom:4}}>{opt.t}</div>
            <div style={{fontSize:12,color:V.txt3}}>{opt.sub}</div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

// ── PRODUCT ROW ───────────────────────────────────────────────
function ProductRow({id,product:p}){
  const fmtP=v=>v!=null?`${Number(v).toFixed(2)} ₾`:"—";
  const fmtD=d=>d?new Date(d).toLocaleDateString("ka-GE",{day:"2-digit",month:"2-digit",year:"numeric"}):"—";
  const badge=p.status==="approved"?"cab-badge-ok":p.status==="rejected"?"cab-badge-rej":"cab-badge-pend";
  const label=p.status==="approved"?"დადასტ.":p.status==="rejected"?"უარყ.":"განხილვაში";
  return(
    <tr>
      <td style={{maxWidth:260}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {p.image_url?<img src={p.image_url} alt="" style={{width:36,height:36,objectFit:"cover",borderRadius:8,flexShrink:0,border:`1px solid ${V.brd}`}} onError={e=>{e.currentTarget.style.display="none";}}/>:<span style={{fontSize:20,flexShrink:0}}>📦</span>}
          <div style={{minWidth:0}}>
            <div style={{fontWeight:600,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:210}}>{p.name}</div>
            {p.store_name&&<div style={{fontSize:11,color:V.txt3}}>{p.store_name}</div>}
          </div>
        </div>
      </td>
      <td style={{color:V.blue,fontSize:13}}>{p.sub_category||"—"}</td>
      <td style={{color:V.blue,fontSize:13}}>{p.category||"—"}</td>
      <td style={{textAlign:"right",fontWeight:600}}>{fmtP(p.price)}</td>
      <td style={{textAlign:"right",color:V.txt2}}>{fmtP(p.wholesale_price)}</td>
      <td style={{textAlign:"center",fontWeight:600}}>{p.quantity!=null?p.quantity:"—"}</td>
      <td style={{textAlign:"center",color:V.txt3,fontSize:12}}>{fmtD(p.submitted_at)}</td>
      <td style={{textAlign:"center"}}><span className={`cab-badge ${badge}`}>{label}</span></td>
    </tr>
  );
}

// ── PRODUCTS TAB ──────────────────────────────────────────────
function ProductsTab({storeKey,products,loading,onAdd,onDeleted}){
  const [srch,setSrch] = useState("");
  const [catFlt,setCat] = useState("all");
  const [page,setPg]   = useState(1);
  const [perPg,setPP]  = useState(25);
  const [sort,setSort] = useState({col:"submitted_at",asc:false});

  const all=Object.entries(products);

  // dynamic category list from products
  const cats=["all",...[...new Set(all.map(([,p])=>p.category).filter(Boolean))].sort()];
  const catCount=cat=>cat==="all"?all.length:all.filter(([,p])=>p.category===cat).length;

  const filt=all.filter(([,p])=>{
    const q=srch.toLowerCase().trim();
    const mQ=!q||(p.name||"").toLowerCase().includes(q)||(p.category||"").toLowerCase().includes(q)||(p.sub_category||"").toLowerCase().includes(q);
    return mQ&&(catFlt==="all"||p.category===catFlt);
  });
  const srtd=[...filt].sort(([,a],[,b])=>{const av=a[sort.col]??"",bv=b[sort.col]??"";if(!isNaN(+av)&&!isNaN(+bv))return sort.asc?+av-+bv:+bv-+av;return sort.asc?String(av).localeCompare(String(bv)):String(bv).localeCompare(String(av));});
  const total=srtd.length; const pages=Math.max(1,Math.ceil(total/perPg)); const cp=Math.min(page,pages);
  const slice=srtd.slice((cp-1)*perPg,cp*perPg);
  const from=total===0?0:(cp-1)*perPg+1; const to=Math.min(cp*perPg,total);
  const tgSort=c=>setSort(s=>s.col===c?{col:c,asc:!s.asc}:{col:c,asc:true});
  const TH=({label,col,align="left"})=>(<th onClick={col?()=>tgSort(col):undefined} style={{textAlign:align}}>{label}{col&&<span style={{marginLeft:4,fontSize:9,color:sort.col===col?V.blue:"#ccc"}}>{sort.col===col?(sort.asc?"▲":"▼"):"⇅"}</span>}</th>);
  const pgRange=()=>{const r=[];for(let i=1;i<=pages;i++){if(i===1||i===pages||Math.abs(i-cp)<=2)r.push(i);else if(r[r.length-1]!=="…")r.push("…");}return r;};

  const catBtnStyle=(active)=>({
    display:"inline-flex",alignItems:"center",gap:6,
    padding:"0 14px",height:38,
    borderRadius:"var(--r-sm)",
    background:active?"var(--blue-lt)":"var(--sur)",
    border:`1.5px solid ${active?"var(--blue)":"var(--brd)"}`,
    borderLeft:`3px solid ${V.blue}`,
    fontSize:13,fontWeight:active?700:500,
    color:active?"var(--blue)":"var(--txt2)",
    cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",
    transition:"all .12s",flexShrink:0,
  });

  return(
    <div>
      <div className="cab-card">
        <div className="cab-card-hdr">
          <span className="cab-card-ttl">ჩემი პროდუქტები</span>
          <button className="cab-btn cab-btn-primary" onClick={onAdd}>＋ პროდუქტის დამატება</button>
        </div>

        {/* Toolbar */}
        <div className="cab-toolbar" style={{gap:8,flexWrap:"wrap"}}>
          {/* Search */}
          <div className="cab-srch" style={{flex:"1 1 200px",minWidth:180}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input className="cab-inp" value={srch} style={{paddingLeft:32,height:38,boxSizing:"border-box"}} placeholder="სახელი, კატეგორია..." onChange={e=>{setSrch(e.target.value);setPg(1);}}/>
          </div>

          {/* Category filter buttons */}
          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
            {cats.map(cat=>(
              <button key={cat} onClick={()=>{setCat(cat);setPg(1);}} style={catBtnStyle(catFlt===cat)}>
                {cat==="all"?"ყველა":cat}
                <span style={{fontSize:11,background:catFlt===cat?"var(--blue)":"var(--brd)",color:catFlt===cat?"#fff":"var(--txt2)",padding:"1px 6px",borderRadius:10,fontWeight:700,transition:"all .12s"}}>
                  {catCount(cat)}
                </span>
              </button>
            ))}
          </div>

          {/* Per-page */}
          <div style={{display:"flex",alignItems:"center",gap:6,marginLeft:"auto",flexShrink:0}}>
            <span style={{fontSize:12,color:"var(--txt2)",whiteSpace:"nowrap"}}>რაოდ.:</span>
            <select value={perPg} onChange={e=>{setPP(+e.target.value);setPg(1);}} className="cab-inp"
              style={{width:72,padding:"0 8px",height:38,boxSizing:"border-box",appearance:"none",textAlign:"center"}}>
              {[25,50,100,150,200].map(n=><option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        {/* Table */}
        {loading?(
          <div className="spin-wrap"><div className="spin"/><div className="spin-txt">იტვირთება...</div></div>
        ):(
          <div className="cab-tbl-overflow">
            <table className="cab-tbl">
              <thead>
                <tr>
                  <TH label="პროდუქტი"    col="name"/>
                  <TH label="ჯგუფი"       col="sub_category"/>
                  <TH label="კატეგორია"   col="category"/>
                  <TH label="საცალო ₾"    col="price"          align="right"/>
                  <TH label="საბითუმო ₾"  col="wholesale_price" align="right"/>
                  <TH label="რაოდ."       col="quantity"        align="center"/>
                  <TH label="თარიღი"      col="submitted_at"    align="center"/>
                  <TH label="სტატუსი"     col="status"          align="center"/>
                </tr>
              </thead>
              <tbody>
                {slice.length===0?(
                  <tr><td colSpan={8}><div className="empty-st" style={{padding:"48px 0"}}><div className="empty-ico">{srch?"🔍":"📦"}</div><div className="empty-ttl">{srch?"შედეგი ვერ მოიძებნა":"პროდუქტი არ არის"}</div><div className="empty-sub">{srch?"სცადე სხვა სიტყვა":"დაამატე პირველი პროდუქტი"}</div>{!srch&&<button className="cab-btn cab-btn-primary" style={{marginTop:8}} onClick={onAdd}>＋ დამატება</button>}</div></td></tr>
                ):slice.map(([id,p])=>(
                  <ProductRow key={id} id={id} product={p}/>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="cab-footer-row">
          <div className="cab-footer-info">
            {total===0?"0 ჩანაწერი":`ნაჩვენებია ${from} — ${to} / სულ ${total}`}
          </div>
          <div className="cab-pager">
            <button disabled={cp===1} onClick={()=>setPg(1)}>«</button>
            <button disabled={cp===1} onClick={()=>setPg(p=>p-1)}>‹</button>
            {pgRange().map((pg,i)=>pg==="…"?<span key={`e${i}`} style={{padding:"0 4px",color:V.txt3}}>…</span>:<button key={pg} className={pg===cp?"active":""} onClick={()=>setPg(pg)}>{pg}</button>)}
            <button disabled={cp===pages} onClick={()=>setPg(p=>p+1)}>›</button>
            <button disabled={cp===pages} onClick={()=>setPg(pages)}>»</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SETTINGS TAB ──────────────────────────────────────────────
function SettingsTab({storeKey,store}){
  const [accs,setAccs]=useState([]); const [load,setLoad]=useState(true);
  const [form,setForm]=useState({bank:"",iban:"",beneficiary:"",currency:"GEL"});
  const [err,setErr]=useState({}); const [saving,setSv]=useState(false); const [saved,setSaved]=useState(false);
  useEffect(()=>{fbGet(`/store_settings/${storeKey}/bank_accounts`).then(d=>{setAccs(d?Object.entries(d):[]);setLoad(false);});}, [storeKey]);
  const validate=()=>{const e={};if(!form.bank)e.bank="სავალდებულოა";if(!form.iban.trim())e.iban="სავალდებულოა";if(!form.beneficiary.trim())e.ben="სავალდებულოა";setErr(e);return !Object.keys(e).length;};
  const add=async()=>{if(!validate())return;setSv(true);const entry={...form,added_at:new Date().toISOString(),store_key:storeKey};const r=await fbPush(`/store_settings/${storeKey}/bank_accounts`,entry);if(r?.name){setAccs(a=>[...a,[r.name,entry]]);setForm({bank:"",iban:"",beneficiary:"",currency:"GEL"});setSaved(true);setTimeout(()=>setSaved(false),2500);}setSv(false);};
  const del=async(id)=>{if(!confirm("ანგარიში წაიშალოს?"))return;await fbDelete(`/store_settings/${storeKey}/bank_accounts/${id}`);setAccs(a=>a.filter(([k])=>k!==id));};
  return(
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div className="cab-card">
        <div className="cab-card-hdr"><span className="cab-card-ttl">🏦 ბანკის ანგარიშები</span></div>
        <div>
          {load?<div className="spin-wrap" style={{padding:32}}><div className="spin"/></div>
          :accs.length===0?<div className="empty-st" style={{padding:32}}><div className="empty-ico">🏦</div><div className="empty-ttl">ანგარიში არ არის</div><div className="empty-sub">დაამატე გადახდის ანგარიში</div></div>
          :<table className="cab-tbl">
            <thead><tr><th>ბანკი</th><th>IBAN</th><th>მიმღები</th><th>ვალუტა</th><th></th></tr></thead>
            <tbody>
              {accs.map(([id,a])=>(
                <tr key={id}>
                  <td style={{fontWeight:600}}>{a.bank}</td>
                  <td style={{fontFamily:"monospace",fontSize:12}}>{a.iban}</td>
                  <td>{a.beneficiary}</td>
                  <td><span className="cab-badge cab-badge-pend">{a.currency}</span></td>
                  <td style={{textAlign:"right"}}><button className="cab-btn cab-btn-danger" onClick={()=>del(id)}>წაშლა</button></td>
                </tr>
              ))}
            </tbody>
          </table>}
        </div>
      </div>

      <div className="cab-card">
        <div className="cab-card-hdr"><span className="cab-card-ttl">➕ ახალი ანგარიშის დამატება</span></div>
        <div className="cab-card-body">
          <div className="cab-g2">
            <FG label="ბანკი *" error={err.bank}><select className={`cab-inp${err.bank?" err":""}`} style={{appearance:"none"}} value={form.bank} onChange={e=>setForm(f=>({...f,bank:e.target.value}))}><option value="">— აირჩიე —</option>{BANKS.map(b=><option key={b} value={b}>{b}</option>)}</select></FG>
            <FG label="ვალუტა"><div style={{display:"flex",gap:6}}>{["GEL","USD","EUR"].map(c=><button key={c} className={`cab-unit-btn${form.currency===c?" sel":""}`} onClick={()=>setForm(f=>({...f,currency:c}))}>{c}</button>)}</div></FG>
          </div>
          <FG label="IBAN *" error={err.iban}><input className={`cab-inp${err.iban?" err":""}`} style={{fontFamily:"monospace"}} value={form.iban} placeholder="GE12TB0000000000000000" onChange={e=>setForm(f=>({...f,iban:e.target.value.toUpperCase()}))}/></FG>
          <FG label="მიმღების სახელი *" error={err.ben}><input className={`cab-inp${err.ben?" err":""}`} value={form.beneficiary} placeholder="შპს / სს / სახელი გვარი" onChange={e=>setForm(f=>({...f,beneficiary:e.target.value}))}/></FG>
          <div className="cab-alert cab-alert-info" style={{marginBottom:14}}>💡 ეს ანგარიში გამოყენებული იქნება ავტომატური გადარიცხვებისთვის.</div>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <button className="cab-btn cab-btn-primary" onClick={add} disabled={saving}>{saving?"ინახება...":"➕ ანგარიშის დამატება"}</button>
            {saved&&<span style={{color:V.green,fontWeight:600,fontSize:13}}>✅ შენახულია!</span>}
          </div>
        </div>
      </div>
    </div>
  );
}


// ── COMING SOON PAGE ─────────────────────────────────────────
function ComingSoon({icon,label}){
  return(
    <div className="empty-st" style={{paddingTop:80}}>
      <div className="empty-ico">{icon}</div>
      <div className="empty-ttl">{label}</div>
      <div className="empty-sub">ეს განყოფილება მალე გამოჩნდება</div>
    </div>
  );
}

// ── PROFILE MODAL ─────────────────────────────────────────────
function ProfileModal({store,storeKey,onClose,onUpdated}){
  const [form,setForm]=useState({
    company_name: store.company_name||store.store_name||"",
    email:        store.email||"",
    phone:        store.phone||"",
  });
  const [pw,setPw]=useState({old:"",newP:"",conf:""});
  const [showPw,setShowPw]=useState({old:false,newP:false,conf:false});
  const [tab,setTab]=useState("info");
  const [err,setErr]=useState({});
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState("");

  const saveInfo=async()=>{
    const e={};
    if(!form.company_name.trim()) e.company_name="სავალდებულოა";
    if(!form.email.trim())        e.email="სავალდებულოა";
    setErr(e); if(Object.keys(e).length) return;
    setSaving(true);
    const all=await fbGet("/store_registrations");
    if(all){
      const key=Object.keys(all).find(k=>all[k].email?.toLowerCase()===store.email?.toLowerCase());
      if(key){
        await fbPatch(`/store_registrations/${key}`,{company_name:form.company_name.trim(),email:form.email.trim(),phone:form.phone.trim()||null});
        const updated={...store,...form};
        localStorage.setItem("recount_store_session",JSON.stringify(updated));
        if(onUpdated) onUpdated(updated);
      }
    }
    setSaving(false); setSaved("info"); setTimeout(()=>setSaved(""),2500);
  };

  const savePw=async()=>{
    const e={};
    if(!pw.old.trim())          e.old="შეიყვანე ამჟამინდელი";
    if(pw.old!==store.password) e.old="პაროლი არასწორია";
    if(pw.newP.length<6)        e.newP="მინ. 6 სიმბოლო";
    if(pw.newP!==pw.conf)       e.conf="პაროლები არ ემთხვევა";
    setErr(e); if(Object.keys(e).length) return;
    setSaving(true);
    const all=await fbGet("/store_registrations");
    if(all){
      const key=Object.keys(all).find(k=>all[k].email?.toLowerCase()===store.email?.toLowerCase());
      if(key){
        await fbPatch(`/store_registrations/${key}`,{password:pw.newP});
        const updated={...store,password:pw.newP};
        localStorage.setItem("recount_store_session",JSON.stringify(updated));
        if(onUpdated) onUpdated(updated);
        setPw({old:"",newP:"",conf:""});
      }
    }
    setSaving(false); setSaved("pw"); setTimeout(()=>setSaved(""),2500);
  };

  const Eye=({k})=>(
    <button type="button" onClick={()=>setShowPw(s=>({...s,[k]:!s[k]}))}
      style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"var(--txt3)",display:"flex",padding:2}}>
      {showPw[k]
        ?<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
        :<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
    </button>
  );

  return(
    <div className="cab-modal-ov" onClick={onClose}>
      <div className="cab-modal" onClick={e=>e.stopPropagation()}>
        <div className="cab-modal-hdr">
          <span className="cab-modal-ttl">👤 ჩემი პროფილი</span>
          <button className="cab-modal-x" onClick={onClose}>✕</button>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:14,padding:"16px 20px",borderBottom:"1px solid var(--brd)",background:"var(--bg)"}}>
          <div style={{width:52,height:52,borderRadius:"50%",background:"var(--blue)",color:"#fff",fontWeight:800,fontSize:22,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            {(form.company_name||"R")[0].toUpperCase()}
          </div>
          <div>
            <div style={{fontWeight:700,fontSize:15,color:"var(--dark)"}}>{form.company_name||"მაღაზია"}</div>
            <div style={{fontSize:12,color:"var(--txt3)",marginTop:2}}>{form.email}</div>
            <div style={{fontSize:11,marginTop:4,display:"inline-flex",alignItems:"center",gap:4,background:store.status==="approved"?"#E8FFF3":"#FFF8DD",color:store.status==="approved"?"#50CD89":"#F6C000",padding:"2px 8px",borderRadius:20,fontWeight:600}}>
              <span style={{width:5,height:5,borderRadius:"50%",background:"currentColor",display:"inline-block"}}/>
              {store.status==="approved"?"აქტიური":"განხილვაშია"}
            </div>
          </div>
        </div>
        <div style={{display:"flex",borderBottom:"1px solid var(--brd)",padding:"0 20px",gap:4}}>
          {[["info","ინფო"],["password","პაროლი"]].map(([id,lbl])=>(
            <button key={id} onClick={()=>{setTab(id);setErr({});}}
              style={{padding:"10px 14px",border:"none",borderBottom:`2px solid ${tab===id?"var(--blue)":"transparent"}`,background:"none",color:tab===id?"var(--blue)":"var(--txt2)",fontWeight:tab===id?600:400,fontSize:13,cursor:"pointer",fontFamily:"inherit",transition:"all .12s"}}>
              {lbl}
            </button>
          ))}
        </div>
        <div className="cab-modal-body">
          {tab==="info"&&(
            <div>
              <FG label="კომპანიის სახელი *" error={err.company_name}>
                <input className={`cab-inp${err.company_name?" err":""}`} value={form.company_name} onChange={e=>{setForm(f=>({...f,company_name:e.target.value}));setErr(er=>({...er,company_name:""}));}}/>
              </FG>
              <FG label="ელ-ფოსტა *" error={err.email}>
                <input className={`cab-inp${err.email?" err":""}`} type="email" value={form.email} onChange={e=>{setForm(f=>({...f,email:e.target.value}));setErr(er=>({...er,email:""}));}}/>
              </FG>
              <FG label="ტელეფონი">
                <input className="cab-inp" type="tel" value={form.phone} placeholder="+995 5XX XXX XXX" onChange={e=>setForm(f=>({...f,phone:e.target.value}))}/>
              </FG>
              <div style={{display:"flex",alignItems:"center",gap:12,marginTop:4}}>
                <button className="cab-btn cab-btn-primary" onClick={saveInfo} disabled={saving}>{saving?"ინახება...":"💾 შენახვა"}</button>
                {saved==="info"&&<span style={{color:"var(--green)",fontWeight:600,fontSize:13}}>✅ განახლდა!</span>}
              </div>
            </div>
          )}
          {tab==="password"&&(
            <div>
              <FG label="ამჟამინდელი პაროლი" error={err.old}>
                <div style={{position:"relative"}}><input className={`cab-inp${err.old?" err":""}`} type={showPw.old?"text":"password"} value={pw.old} style={{paddingRight:36}} onChange={e=>{setPw(p=>({...p,old:e.target.value}));setErr(er=>({...er,old:""}));}}/><Eye k="old"/></div>
              </FG>
              <FG label="ახალი პაროლი" error={err.newP}>
                <div style={{position:"relative"}}><input className={`cab-inp${err.newP?" err":""}`} type={showPw.newP?"text":"password"} value={pw.newP} placeholder="მინ. 6 სიმბოლო" style={{paddingRight:36}} onChange={e=>{setPw(p=>({...p,newP:e.target.value}));setErr(er=>({...er,newP:""}));}}/><Eye k="newP"/></div>
              </FG>
              <FG label="გაიმეორე პაროლი" error={err.conf}>
                <div style={{position:"relative"}}><input className={`cab-inp${err.conf?" err":""}`} type={showPw.conf?"text":"password"} value={pw.conf} style={{paddingRight:36}} onChange={e=>{setPw(p=>({...p,conf:e.target.value}));setErr(er=>({...er,conf:""}));}}/><Eye k="conf"/></div>
              </FG>
              <div style={{display:"flex",alignItems:"center",gap:12,marginTop:4}}>
                <button className="cab-btn cab-btn-primary" onClick={savePw} disabled={saving}>{saving?"ინახება...":"🔒 შეცვლა"}</button>
                {saved==="pw"&&<span style={{color:"var(--green)",fontWeight:600,fontSize:13}}>✅ პაროლი შეიცვალა!</span>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── BANK MODAL ────────────────────────────────────────────────
function BankModal({storeKey,onClose}){
  const [accs,setAccs]=useState([]); const [load,setLoad]=useState(true);
  const [form,setForm]=useState({bank:"",iban:"",beneficiary:"",currency:"GEL"});
  const [err,setErr]=useState({}); const [saving,setSv]=useState(false); const [saved,setSaved]=useState(false);
  useEffect(()=>{fbGet(`/store_settings/${storeKey}/bank_accounts`).then(d=>{setAccs(d?Object.entries(d):[]);setLoad(false);});}, [storeKey]);
  const validate=()=>{const e={};if(!form.bank)e.bank="სავალდებულოა";if(!form.iban.trim())e.iban="სავალდებულოა";if(!form.beneficiary.trim())e.ben="სავალდებულოა";setErr(e);return !Object.keys(e).length;};
  const add=async()=>{if(!validate())return;setSv(true);const entry={...form,added_at:new Date().toISOString(),store_key:storeKey};const r=await fbPush(`/store_settings/${storeKey}/bank_accounts`,entry);if(r?.name){setAccs(a=>[...a,[r.name,entry]]);setForm({bank:"",iban:"",beneficiary:"",currency:"GEL"});setSaved(true);setTimeout(()=>setSaved(false),2500);}setSv(false);};
  const del=async(id)=>{if(!confirm("ანგარიში წაიშალოს?"))return;await fbDelete(`/store_settings/${storeKey}/bank_accounts/${id}`);setAccs(a=>a.filter(([k])=>k!==id));};
  return(
    <div className="cab-modal-ov" onClick={onClose}>
      <div className="cab-modal wide" onClick={e=>e.stopPropagation()}>
        <div className="cab-modal-hdr">
          <span className="cab-modal-ttl">🏦 საბანკო მონაცემები</span>
          <button className="cab-modal-x" onClick={onClose}>✕</button>
        </div>
        <div className="cab-modal-body" style={{padding:0}}>
          <div style={{padding:"16px 20px",borderBottom:"1px solid var(--brd)"}}>
            <div style={{fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:".7px",color:"var(--txt2)",marginBottom:10}}>შენახული ანგარიშები</div>
            {load?<div style={{textAlign:"center",padding:20}}><div className="spin"/></div>
            :accs.length===0
              ?<div style={{textAlign:"center",padding:"20px 0",color:"var(--txt3)",fontSize:13}}>🏦 ანგარიში ჯერ არ არის</div>
              :<div style={{display:"flex",flexDirection:"column",gap:8}}>
                {accs.map(([id,a])=>(
                  <div key={id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:"var(--bg)",borderRadius:"var(--r-sm)",border:"1px solid var(--brd)"}}>
                    <div style={{fontSize:20,flexShrink:0}}>🏦</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:600,fontSize:13,color:"var(--dark)"}}>{a.bank}</div>
                      <div style={{fontFamily:"monospace",fontSize:12,color:"var(--txt2)",marginTop:2}}>{a.iban}</div>
                      <div style={{fontSize:11,color:"var(--txt3)",marginTop:1}}>{a.beneficiary}</div>
                    </div>
                    <span style={{fontSize:11,fontWeight:700,padding:"3px 8px",borderRadius:12,background:"#FFF8DD",color:"#F6C000",flexShrink:0}}>{a.currency}</span>
                    <button className="cab-btn cab-btn-danger" onClick={()=>del(id)}>წაშლა</button>
                  </div>
                ))}
              </div>}
          </div>
          <div style={{padding:"16px 20px"}}>
            <div style={{fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:".7px",color:"var(--txt2)",marginBottom:12}}>ახალი ანგარიშის დამატება</div>
            <div className="cab-g2" style={{marginBottom:14}}>
              <FG label="ბანკი *" error={err.bank}><select className={`cab-inp${err.bank?" err":""}`} style={{appearance:"none"}} value={form.bank} onChange={e=>setForm(f=>({...f,bank:e.target.value}))}><option value="">— აირჩიე —</option>{BANKS.map(b=><option key={b} value={b}>{b}</option>)}</select></FG>
              <FG label="ვალუტა"><div style={{display:"flex",gap:6}}>{["GEL","USD","EUR"].map(c=><button key={c} className={`cab-unit-btn${form.currency===c?" sel":""}`} onClick={()=>setForm(f=>({...f,currency:c}))}>{c}</button>)}</div></FG>
            </div>
            <FG label="IBAN *" error={err.iban}><input className={`cab-inp${err.iban?" err":""}`} style={{fontFamily:"monospace"}} value={form.iban} placeholder="GE12TB0000000000000000" onChange={e=>setForm(f=>({...f,iban:e.target.value.toUpperCase()}))}/></FG>
            <FG label="მიმღების სახელი *" error={err.ben}><input className={`cab-inp${err.ben?" err":""}`} value={form.beneficiary} placeholder="შპს / სს / სახელი გვარი" onChange={e=>setForm(f=>({...f,beneficiary:e.target.value}))}/></FG>
            <div className="cab-alert cab-alert-info" style={{marginBottom:14}}>💡 ეს ანგარიში გამოყენებული იქნება ავტომატური გადარიცხვებისთვის.</div>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <button className="cab-btn cab-btn-primary" onClick={add} disabled={saving}>{saving?"ინახება...":"➕ ანგარიშის დამატება"}</button>
              {saved&&<span style={{color:"var(--green)",fontWeight:600,fontSize:13}}>✅ შენახულია!</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────
function Dashboard({store,onLogout}){
  useCabinetStyles();
  const [tab,setTab]=useState("products");
  const [products,setProducts]=useState({}); const [loading,setLoad]=useState(true);
  const [showAdd,setAdd]=useState(false);
  const [dropOpen,setDropOpen]=useState(false);
  const [showProfile,setShowProfile]=useState(false);
  const [showBank,setShowBank]=useState(false);
  const [storeData,setStoreData]=useState(store);
  const sk=eKey(store.email);
  const load=useCallback(async()=>{setLoad(true);const d=await fbGet(`/store_products/${sk}`);setProducts(d||{});setLoad(false);},[sk]);
  useEffect(()=>{load();},[load]);
  const dropRef=useRef(null);
  useEffect(()=>{
    if(!dropOpen)return;
    const h=(e)=>{if(dropRef.current&&!dropRef.current.contains(e.target))setDropOpen(false);};
    document.addEventListener('mousedown',h);
    return()=>document.removeEventListener('mousedown',h);
  },[dropOpen]);
  const pending=Object.values(products).filter(p=>p.status==="pending").length;
  const storeName=storeData.company_name||storeData.store_name||"მაღაზია";
  const initial=storeName[0]?.toUpperCase()||"R";
  const TABS=[
    {id:"orders",       icon:"🛒", label:"შეკვეთები"},
    {id:"products",     icon:"📦", label:"პროდუქციის მართვა"},
    {id:"transport",    icon:"🚚", label:"ტრანსპორტირება"},
  ];

  return(
    <div className="cab-wrap">
      {/* Header — ზუსტად RecountApp-ის სტილი */}
      <header className="cab-hdr" style={{height:"auto",paddingBottom:0,flexWrap:"wrap",position:"relative",minHeight:"var(--hh)"}}>
        <button className="cab-logo" onClick={()=>setTab("products")}>
          RE<em>COUNT</em><span className="cab-logo-ge">.GE</span>
        </button>
        <div style={{display:"flex",alignItems:"center",gap:2,marginLeft:8}}>
          {[
            {id:"orders",  label:"შეკვეთები"},
            {id:"products",label:"პროდუქცია"},
            {id:"transport",label:"კურიერი"},
          ].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{padding:"6px 14px",borderRadius:"var(--r-sm)",border:"none",background:tab===t.id?"var(--blue-lt)":"none",color:tab===t.id?"var(--blue)":"var(--txt2)",fontWeight:tab===t.id?600:400,fontSize:13,cursor:"pointer",fontFamily:"inherit",transition:"all .12s"}}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:12,position:"relative"}}>
          <div style={{textAlign:"right",lineHeight:1.3}}>
            <div style={{fontSize:13,fontWeight:600,color:"var(--dark)"}}>{storeName}</div>
            <div style={{fontSize:11,color:store.status==="approved"?"var(--green)":"var(--blue)",marginTop:2,display:"flex",alignItems:"center",justifyContent:"flex-end",gap:3}}>
              <span style={{width:6,height:6,borderRadius:"50%",background:store.status==="approved"?"var(--green)":"var(--blue)",display:"inline-block"}}/>
              {store.status==="approved"?"აქტიური":"განხილვაშია"}
            </div>
          </div>
          <div style={{position:"relative"}} ref={dropRef}>
            <div className="cab-user-avatar" style={{cursor:"pointer"}} onClick={()=>setDropOpen(v=>!v)}>{initial}</div>
            {dropOpen&&(
              <div style={{position:"absolute",right:0,top:"calc(100% + 8px)",background:"#fff",border:"1px solid var(--brd)",borderRadius:"var(--r)",boxShadow:"var(--sh2)",minWidth:200,zIndex:999}}>
                <div style={{padding:"12px 16px",borderBottom:"1px solid var(--brd)"}}>
                  <div style={{fontSize:12,fontWeight:700,color:"var(--dark)"}}>{storeName}</div>
                  <div style={{fontSize:11,color:"var(--txt3)",marginTop:2}}>{store.email}</div>
                </div>
                {[
                  {icon:"👤",label:"ჩემი პროფილი",    action:()=>{setShowProfile(true);setDropOpen(false);}},
                  {icon:"🏦",label:"საბანკო მონაცემები",action:()=>{setShowBank(true);setDropOpen(false);}},
                  {icon:"📍",label:"მისამართები",    action:()=>{setTab("addresses");setDropOpen(false);}},
                  {icon:"🚪",label:"გამოსვლა",       action:onLogout,danger:true},
                ].map(item=>(
                  <button key={item.label} onClick={item.action}
                    style={{width:"100%",padding:"10px 16px",border:"none",background:"none",textAlign:"left",cursor:"pointer",display:"flex",alignItems:"center",gap:10,fontSize:13,color:item.danger?"var(--red)":"var(--txt)",fontFamily:"inherit",transition:"background .12s"}}
                    onMouseEnter={e=>e.currentTarget.style.background="var(--bg)"}
                    onMouseLeave={e=>e.currentTarget.style.background="none"}>
                    <span>{item.icon}</span>{item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>



      {/* Content */}
      <div className="cab-page">
        {tab==="orders"&&<ComingSoon icon="🛒" label="შეკვეთები"/>}
        {tab==="products"&&<ProductsTab storeKey={sk} products={products} loading={loading} onAdd={()=>setAdd(true)} onDeleted={load}/>}
        {tab==="transport"&&<ComingSoon icon="🚚" label="ტრანსპორტირება"/>}
        {tab==="addresses"&&<ComingSoon icon="📍" label="მისამართები"/>}
      </div>

      {showAdd&&<AddProductChooser storeKey={sk} storeName={storeName} onClose={()=>setAdd(false)} onAdded={load}/>}
      {showProfile&&<ProfileModal store={storeData} storeKey={sk} onClose={()=>setShowProfile(false)} onUpdated={s=>setStoreData(s)}/>}
      {showBank&&<BankModal storeKey={sk} onClose={()=>setShowBank(false)}/>}
    </div>
  );
}

// ── LOGIN ─────────────────────────────────────────────────────
function Login({onLogin}){
  useCabinetStyles();
  const [email,setE]=useState(""); const [pw,setPw]=useState("");
  const [showP,setShowP]=useState(false); const [load,setLoad]=useState(false); const [err,setErr]=useState("");
  const go=async()=>{
    if(!email.trim()||!pw.trim()){setErr("შეავსე ყველა ველი");return;}
    setLoad(true);setErr("");
    const r=await loginStore(email.trim(),pw);
    setLoad(false);
    if(!r){setErr("არასწორი ელ-ფოსტა ან პაროლი");return;}
    if(r.error==="rejected"){setErr("თქვენი განაცხადი უარყოფილია.");return;}
    localStorage.setItem(LS_KEY,JSON.stringify(r)); onLogin(r);
  };
  return(
    <div className="cab-login-wrap">
      <div className="cab-login-box">
        <div className="cab-login-top">
          <div className="cab-login-logo">RE<em>COUNT</em>.GE</div>
          <div className="cab-login-sub">კაბინეტი</div>
        </div>
        <div className="cab-login-body">
          <div className="cab-fg">
            <label className="cab-lbl">ელ-ფოსტა</label>
            <input className="cab-inp" type="email" value={email} placeholder="info@company.ge" onChange={e=>setE(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")go();}} autoFocus/>
          </div>
          <div className="cab-fg">
            <label className="cab-lbl">პაროლი</label>
            <div className="cab-pw-wrap">
              <input className="cab-inp" type={showP?"text":"password"} value={pw} placeholder="••••••••" style={{paddingRight:36}} onChange={e=>setPw(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")go();}}/>
              <button className="cab-pw-eye" onClick={()=>setShowP(v=>!v)} type="button">
                {showP?<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
              </button>
            </div>
          </div>
          {err&&<div className="cab-alert cab-alert-warn" style={{marginBottom:14}}>{err}</div>}
          <button className="cab-btn cab-btn-primary" style={{width:"100%",justifyContent:"center",padding:"11px"}} onClick={go} disabled={load}>
            {load?"შემოწმება...":"შესვლა →"}
          </button>
          <div style={{marginTop:16,fontSize:12,color:"var(--txt3)",textAlign:"center"}}>
            ჯერ არ ხარ? <a href="/" style={{color:"var(--blue)",fontWeight:600,textDecoration:"none"}}>დარეგისტრირდი</a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────
export default function StoreCabinet(){
  const [store,setStore]=useState(()=>{try{return JSON.parse(localStorage.getItem(LS_KEY));}catch{return null;}});
  if(!store) return <Login onLogin={s=>{localStorage.setItem(LS_KEY,JSON.stringify(s));setStore(s);}}/>;
  return <Dashboard store={store} onLogout={()=>{localStorage.removeItem(LS_KEY);setStore(null);}}/>;
}
