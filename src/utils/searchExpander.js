// RECOUNT.GE — src/utils/searchExpander.js

const TRANSLITERATION = {
  "tsebocementi":"წებოცემენტი","cebocementi":"წებოცემენტი","webocementi":"წებოცემენტი",
  "tsecement":"წებოცემენტი","zebocementi":"წებოცემენტი","jebocementi":"წებოცემენტი",
  "fuga":"ფუგა","fugi":"ფუგა","grunt":"გრუნტი","grundi":"გრუნტი",
  "shpakli":"შპაკლი","shtukatura":"შტუკატური","tabashiri":"თაბაშირი",
  "cementi":"ცემენტი","tsementi":"ცემენტი","saghebavi":"საღებავი",
  "silikoni":"სილიკონი","bloki":"ბლოკი","aguri":"აგური",
  "kabeli":"კაბელი","mili":"მილი","qafi":"ქაფი","hidroizolatsia":"ჰიდროიზოლაცია",
};

const QUERY_TYPOS = {
  "ცმ14":"cm14","ცმ 14":"cm14","ცმ11":"cm11","ცმ 11":"cm11",
  "ცმ16":"cm16","ცმ 16":"cm16","ცმ17":"cm17","ცმ 17":"cm17",
  "ვს500":"vs500","ვს 500":"vs500","ცტ84":"ct84","ცტ 84":"ct84",
  "cerecit":"ceresit","ceresite":"ceresit","cerresit":"ceresit",
  "seresit":"ceresit","ceresid":"ceresit","knaf":"knauf","nauf":"knauf",
  "veber":"weber","lytokol":"litokol","litocol":"litokol",
  "ტცებოცემენტ":"წებოცემენტი","ტცებოცემენტი":"წებოცემენტი",
  "წბოცემენტი":"წებოცემენტი","ცებოცემენტი":"წებოცემენტი","წებოცემენტ":"წებოცემენტი",
};

const KNOWN_LATIN = [
  ...Object.keys(TRANSLITERATION),
  "ceresit","knauf","weber","litokol","mapei","sika","baumit",
  "henkel","basf","pagel","isomat","akfix","perel","unis","volma","bergauf",
];

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = a[i-1]===b[j-1] ? prev : 1+Math.min(prev,row[j],row[j-1]);
      prev = tmp;
    }
  }
  return row[b.length];
}

function fuzzyCorrect(q) {
  if (q.length < 4 || /[ა-ჿ]/.test(q)) return null;
  if (KNOWN_LATIN.includes(q)) return null;
  const threshold = Math.max(1, Math.floor(q.length / 5));
  let best = null, bestDist = Infinity;
  for (const known of KNOWN_LATIN) {
    if (Math.abs(known.length - q.length) > threshold + 1) continue;
    const d = levenshtein(q, known);
    if (d < bestDist && d <= threshold) { bestDist = d; best = known; }
  }
  return best;
}

const GEO_CHAR_MAP = {
  "ც":"c","მ":"m","ვ":"v","ს":"s","ბ":"b","პ":"p","ტ":"t",
  "დ":"d","ფ":"f","გ":"g","ჰ":"h","ი":"i","ლ":"l","ნ":"n",
  "ო":"o","რ":"r","უ":"u","კ":"k","ა":"a","ე":"e",
};
function geoToLat(s) { return s.split("").map(c=>GEO_CHAR_MAP[c]??c).join(""); }

export function normalizeQuery(raw = "") {
  if (!raw) return "";
  return raw.trim().replace(/\s+/g," ").replace(/[-–—]+/g," ").trim().toLowerCase();
}

export function expandQuery(raw = "") {
  if (!raw || !raw.trim()) return [raw || ""];
  const norm    = normalizeQuery(raw);
  const normKey = norm.replace(/\s+/g, "");
  const terms   = new Set([norm]);

  const exactFixed = QUERY_TYPOS[norm] ?? QUERY_TYPOS[normKey];
  if (exactFixed) terms.add(exactFixed.toLowerCase());

  const fuzzyMatch = fuzzyCorrect(normKey);
  if (fuzzyMatch) {
    terms.add(fuzzyMatch);
    const geo = TRANSLITERATION[fuzzyMatch];
    if (geo) { terms.add(geo.toLowerCase()); terms.add(geo.replace(/[\s-]+/g,"").toLowerCase()); }
  }

  const directGeo = TRANSLITERATION[norm] ?? TRANSLITERATION[normKey];
  if (directGeo) { terms.add(directGeo.toLowerCase()); terms.add(directGeo.replace(/[\s-]+/g,"").toLowerCase()); }

  if (/[ა-ჿ]/.test(norm) && /\d/.test(norm)) {
    const lat = geoToLat(normKey);
    if (lat !== normKey) terms.add(lat);
  }

  const joined = norm.replace(/\b([a-z]{1,4})\s+(\d{1,5})\b/g,"$1$2");
  if (joined !== norm) terms.add(joined);
  const spaced = norm.replace(/\b([a-z]{1,4})(\d{1,5})\b/g,"$1 $2");
  if (spaced !== norm) terms.add(spaced);

  const noDash = norm.replace(/[-–—\s]+/g,"");
  if (noDash !== normKey && noDash.length > 2) terms.add(noDash);

  return [...terms].filter(t => t && t.trim().length > 0);
}

export function isTransliterationQuery(raw = "") {
  if (!raw) return false;
  const norm = normalizeQuery(raw);
  if (/[ა-ჿ]/.test(norm)) return false;
  const normKey = norm.replace(/\s+/g,"");
  if (TRANSLITERATION[norm] || TRANSLITERATION[normKey]) return true;
  const fuzzy = fuzzyCorrect(normKey);
  return !!fuzzy && !!TRANSLITERATION[fuzzy];
}
