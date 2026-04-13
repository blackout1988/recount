// ═══════════════════════════════════════════════════════════════
// RECOUNT.GE — scripts/enrichAliases.js
// ES Module version (works when package.json has "type":"module")
//
// Run:
//   node scripts/enrichAliases.js
//   node scripts/enrichAliases.js --dry-run
//   node scripts/enrichAliases.js --verbose
// ═══════════════════════════════════════════════════════════════

import { MeiliSearch } from "meilisearch";

const MEILI_HOST  = "http://localhost:7700";
const MEILI_KEY   = "uW_K4inBKuVQJj2jic06rr2DSV_Bc6p_sb6ST9sJt8g";
const INDEX_NAME  = "products";
const BATCH_SIZE  = 500;
const FETCH_LIMIT = 1000;

const DRY_RUN = process.argv.includes("--dry-run");
const VERBOSE = process.argv.includes("--verbose");

const client = new MeiliSearch({ host: MEILI_HOST, apiKey: MEILI_KEY });
const idx    = client.index(INDEX_NAME);

// ─── Custom task waiter (works across all MeiliSearch JS versions) ─
async function waitForTask(taskUid, maxMs = 120000) {
  const start = Date.now();

  while (Date.now() - start < maxMs) {
    const task = await client.tasks.getTask(taskUid);

    if (task.status === "succeeded") return task;
    if (task.status === "failed") {
      throw new Error(`Task ${taskUid} failed: ${JSON.stringify(task.error)}`);
    }

    await new Promise(r => setTimeout(r, 600));
  }

  throw new Error(`Task ${taskUid} timed out after ${maxMs}ms`);
}


// ─── Firebase key sanitization ────────────────────────────────
// Firebase Realtime DB keys cannot contain: . # $ / [ ]
// Also strip leading/trailing whitespace and collapse spaces
function sanitizeFirebaseKey(str) {
  return (str || "")
    .trim()
    .replace(/[.#$\/\[\]]/g, "_")  // forbidden chars → underscore
    .replace(/\s+/g, "_")           // spaces → underscore
    .replace(/_+/g, "_")            // collapse multiple underscores
    .replace(/^_|_$/g, "")          // strip leading/trailing underscores
    .slice(0, 768);                  // Firebase key max length
}


const TYPE_ALIASES = {
  "წებო-ცემენტი":   ["წებოცემენტი","წებო ცემენტი","ფილის წებო","კერამოგრანიტის წებო","კერამიკული ფილის წებო","tile adhesive","tile cement","tsebocementi","cebocementi","webocementi"],
  "ფუგა":           ["grout","joint filler","tile grout","fuga"],
  "გრუნტი":         ["primer","priming","grunt"],
  "შტუკატური":      ["plaster","rendering","shtukatura"],
  "შპაკლი":         ["filler","putty","shpakli"],
  "თაბაშირი":       ["gypsum","tabashiri"],
  "ცემენტი":        ["cement","cementi","tsementi"],
  "საღებავი":       ["paint","coating","saghebavi"],
  "სილიკონი":       ["silicone","sealant","silikoni"],
  "ქაფი":           ["foam","mounting foam","qafi"],
  "ჰიდროიზოლაცია":  ["waterproof","waterproofing","hidroizolatsia"],
  "იზოლაცია":       ["insulation","izolatsia"],
  "ბეტონი":         ["concrete","betoni"],
  "მასტიკა":        ["mastic","mastika"],
  "პრაიმერი":       ["primer","praimeri"],
};

const GEO_TO_LAT_PHRASE = {
  "წებოცემენტი":"tsebocementi","ცემენტი":"tsementi","ფუგა":"fuga",
  "გრუნტი":"grundi","შპაკლი":"shpakli","შტუკატური":"shtukatura",
  "თაბაშირი":"tabashiri","საღებავი":"saghebavi","სილიკონი":"silikoni",
  "ქაფი":"qafi","ბლოკი":"bloki","აგური":"aguri","მილი":"mili","კაბელი":"kabeli",
};

const GEO_CHAR = {
  "ა":"a","ბ":"b","გ":"g","დ":"d","ე":"e","ვ":"v","ზ":"z","თ":"t","ი":"i",
  "კ":"k","ლ":"l","მ":"m","ნ":"n","ო":"o","პ":"p","ჟ":"j","რ":"r","ს":"s",
  "ტ":"t","უ":"u","ფ":"f","ქ":"k","ღ":"g","ყ":"q","შ":"sh","ჩ":"ch","ც":"c",
  "ძ":"dz","წ":"ts","ჭ":"ch","ხ":"kh","ჯ":"j","ჰ":"h",
};
function geoToLat(s){ return s.split("").map(c=>GEO_CHAR[c]||c).join(""); }

// ─── FIELD RESOLVERS ──────────────────────────────────────────
function resolve(raw,...keys){
  for(const k of keys){ if(raw[k]!=null&&raw[k]!=="") return raw[k]; }
  return null;
}

function normStr(str){
  return (str||"").toLowerCase().trim()
    .replace(/[-\u2013\u2014\/\\]+/g," ")
    .replace(/(?<![a-z])([a-z]{2,3})\s+(\d{1,4})\b/g,"$1$2")
    .replace(/[^\wა-ჿ\s]/g,"").replace(/\s+/g," ").trim();
}

const UNITS=new Set(["kg","gr","ml","lt","l","g","m","mm","cm","pc","კგ","გრ","მლ","ლ","მ","მმ","სმ","ც","შტ"]);
const KNOWN_BRANDS=["ceresit","knauf","weber","litokol","mapei","sika","baumit","henkel","basf","pagel","hidrostop","isomat","akfix","moment","pci","perel","unis","volma","bergauf"];

function extractBrand(name){
  const tokens=normStr(name).split(" ").filter(Boolean);
  for(const t of tokens){ if(KNOWN_BRANDS.includes(t)) return t.charAt(0).toUpperCase()+t.slice(1); }
  const caps=name.match(/\b([A-Z]{2,})\b/);
  if(caps&&!UNITS.has(caps[1].toLowerCase())) return caps[1].charAt(0)+caps[1].slice(1).toLowerCase();
  return null;
}

function extractModel(norm){
  const tokens=norm.split(" ").filter(Boolean);
  const models=tokens.filter(t=>(/^[a-z]+\d/.test(t)||/^\d+[a-z]/.test(t))&&!UNITS.has(t)&&t.length>1);
  return models.length>0?models[0].toUpperCase():null;
}

const TYPE_RULES=[
  {type:"წებო-ცემენტი",phrases:["წებოცემენტი","წებო ცემენტი","წებო-ცემენტი","ფილის წებო","კერამოგრანიტის წებო","tile adhesive","tile cement"]},
  {type:"ფუგა",         phrases:["ფუგა","grout","joint filler"]},
  {type:"ჰიდროიზოლაცია",phrases:["ჰიდროიზოლაცია","waterproof","waterproofing"]},
  {type:"გრუნტი",       phrases:["გრუნტი","primer","priming"]},
  {type:"შტუკატური",    phrases:["შტუკატური","plaster","rendering"]},
  {type:"შპაკლი",       phrases:["შპაკლი","filler","putty"]},
  {type:"თაბაშირი",     phrases:["თაბაშირი","gypsum"]},
  {type:"ცემენტი",      phrases:["ცემენტი","cement"]},
  {type:"საღებავი",     phrases:["საღებავი","paint","coating","ლაქი"]},
  {type:"სილიკონი",     phrases:["სილიკონი","silicone","sealant"]},
  {type:"ქაფი",         phrases:["ქაფი","foam","mounting foam"]},
  {type:"წებო",         phrases:["წებო","adhesive","glue"]},
];

function extractProductType(name){
  const hay=name.toLowerCase().replace(/[-\u2013\u2014]+/g," ").replace(/\s+/g," ").trim();
  for(const rule of TYPE_RULES){ for(const p of rule.phrases){ if(hay.includes(p.toLowerCase())) return rule.type; } }
  return null;
}

function addVariants(set,str){
  if(!str||!str.trim()) return;
  const low=str.toLowerCase().trim();
  set.add(low);
  const joined=low.replace(/[-\u2013\u2014\s]+/g,"");
  const spaced=low.replace(/[-\u2013\u2014]+/g," ").replace(/\s+/g," ").trim();
  const dashed=low.replace(/\s+/g,"-");
  if(joined!==low&&joined.length>1) set.add(joined);
  if(spaced!==low) set.add(spaced);
  if(dashed!==low) set.add(dashed);
  const mj=low.replace(/\b([a-z]{1,4})\s+(\d{1,5})\b/g,"$1$2");
  if(mj!==low) set.add(mj);
  const ms=low.replace(/\b([a-z]{1,4})(\d{1,5})\b/g,"$1 $2");
  if(ms!==low) set.add(ms);
}

function generateAliases(raw){
  const name       =(resolve(raw,"name","title","product_name")||"").trim();
  const brand      =resolve(raw,"brand")||extractBrand(name);
  const normN      =normStr(name);
  const model      =extractModel(normN);
  const productType=extractProductType(name);
  const category   =resolve(raw,"category")||"";
  const subCat     =resolve(raw,"sub_category","sub")||"";
  const code       =resolve(raw,"code","sku","article")||"";

  const aliases=new Set();
  addVariants(aliases,name);
  if(brand) aliases.add(brand.toLowerCase());
  if(model){
    addVariants(aliases,model);
    const latM=geoToLat(model).toLowerCase();
    if(latM!==model.toLowerCase()) addVariants(aliases,latM);
  }
  if(brand&&model){
    addVariants(aliases,`${brand} ${model}`);
    addVariants(aliases,`${model} ${brand}`);
  }
  if(productType){
    addVariants(aliases,productType);
    const normPT=productType.replace(/[\s-]+/g,"").toLowerCase();
    const lat=GEO_TO_LAT_PHRASE[normPT];
    if(lat) aliases.add(lat);
    const typeKey=Object.keys(TYPE_ALIASES).find(k=>k===productType||k.replace(/[\s-]/g,"")===productType.replace(/[\s-]/g,""));
    if(typeKey) TYPE_ALIASES[typeKey].forEach(a=>addVariants(aliases,a));
  }
  if(category) aliases.add(category.toLowerCase());
  if(subCat)   aliases.add(subCat.toLowerCase());
  if(code)     aliases.add(code.toLowerCase());
  const composite=[brand,model,productType].filter(Boolean).join(" ");
  if(composite.trim()) addVariants(aliases,composite);
  if(model&&/[a-z]/i.test(model)){
    const geoM=model.toLowerCase().replace(/cm/g,"ცმ").replace(/vs/g,"ვს").replace(/ct/g,"ცტ");
    if(geoM!==model.toLowerCase()) aliases.add(geoM);
  }
  return [...aliases].filter(a=>a&&a.trim().length>1);
}

// ─── MAIN STEPS ───────────────────────────────────────────────
async function ensureSettings(){
  console.log("⚙️  Checking settings...");
  const s=await idx.getSettings();
  const sa=s.searchableAttributes||["*"];
  if(!sa.includes("search_aliases")&&!sa.includes("*")){
    if(!DRY_RUN){
      const t=await idx.updateSettings({searchableAttributes:["search_aliases",...sa]});
      await waitForTask(t.taskUid);
    }
    console.log("   ✓ Added search_aliases to searchableAttributes.");
  } else {
    console.log("   ✓ Settings OK.");
  }
}

async function fetchAll(){
  console.log("\n📥 Fetching products...");
  let all=[],offset=0;
  while(true){
    const page=await idx.getDocuments({limit:FETCH_LIMIT,offset});
    const hits=page.results||page;
    if(!hits||!hits.length) break;
    all=all.concat(hits); offset+=hits.length;
    process.stdout.write(`   ${all.length} fetched...\r`);
    if(hits.length<FETCH_LIMIT) break;
  }
  console.log(`   ✓ ${all.length} products.`);
  return all;
}

async function uploadBatches(docs){
  if(DRY_RUN){
    const s=docs[0];
    console.log("\n[dry-run] Sample:");
    if(s){ console.log(" Product:", s.name); console.log(" Aliases:", (s.search_aliases||[]).slice(0,8).join(", ")); }
    return;
  }
  console.log(`\n📤 Uploading ${docs.length} docs...`);
  const tasks=[];
  for(let i=0;i<docs.length;i+=BATCH_SIZE){
    const batch=docs.slice(i,i+BATCH_SIZE);
    const t=await idx.addDocuments(batch,{primaryKey:"uid"});
    tasks.push(t.taskUid);
    process.stdout.write(`   Batch ${Math.ceil((i+1)/BATCH_SIZE)}/${Math.ceil(docs.length/BATCH_SIZE)}...\r`);
  }
  console.log("\n   Waiting for indexing...");
  await Promise.all(tasks.map(tid=>waitForTask(tid)));
  console.log("   ✓ Indexed.");
}

async function main(){
  console.log("\n══════════════════════════════════");
  console.log(" RECOUNT.GE — Alias Enrichment");
  console.log(DRY_RUN?" MODE: DRY RUN":" MODE: LIVE");
  console.log("══════════════════════════════════\n");
  await ensureSettings();
  const raw=await fetchAll();
  console.log("\n🔧 Generating aliases...");
  const enriched = raw.map(r => {
    // Sanitize uid/key for Firebase compatibility
    const rawUid = r.uid ?? r.id ?? `${r.store ?? ""}|${r.url ?? r.name ?? Math.random()}`;
    const uid    = sanitizeFirebaseKey(String(rawUid));
    return { ...r, uid, search_aliases: generateAliases(r) };
  });
  if(VERBOSE) enriched.slice(0,3).forEach(e=>console.log(` ${e.name}\n  → ${(e.search_aliases||[]).slice(0,6).join(", ")}`));
  console.log(`   ✓ ${enriched.length} products enriched.`);
  await uploadBatches(enriched);
  console.log("\n✅ Enrichment complete!\n");
}

main().catch(e=>{console.error("❌",e.message);process.exit(1);});
