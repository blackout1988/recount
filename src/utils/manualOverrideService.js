// ═══════════════════════════════════════════════════════════════
// RECOUNT.GE — utils/manualOverrideService.js  v1.0
//
// Firebase Realtime DB — manual_overrides node
//
// Firebase structure:
//   /manual_overrides/{uid}          ← per-product (uid = store_productid)
//     manual_name         string     override display name
//     manual_image_url    string     override image
//     manual_description  string     override description
//     manual_group_id     string     force this product into a manual group
//     manual_group_name   string     display name for that manual group
//     manual_category     string     override category
//     manual_sub_category string     override sub_category
//     manual_locked       boolean    scraper must not overwrite name/image/desc
//     manual_force_solo   boolean    prevent auto-grouping after unmerge
//     edited_at           ISO string
//     edited_by           string
//
//   /group_overrides/{sanitized_group_key}  ← per-group display
//     display_name        string     shown as canonical_name on cards
//     display_image       string     shown as group image on cards
//     display_category    string
//     display_sub_category string
//     edited_at           ISO string
//
// !! The scraper NEVER writes to these nodes !!
// !! Frontend merges scraped + override before display/grouping !!
// ═══════════════════════════════════════════════════════════════

import { initializeApp, getApps } from "firebase/app";
import { getDatabase, ref, get, set, update } from "firebase/database";

// ── Firebase client config ──────────────────────────────────────
// Get apiKey from Firebase Console → Project Settings → Web App
// Other values are fixed for recount-91f28
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDJcJfQAJyhRD4cfcrAAIq1R9vTUgSV2m0",
  authDomain: "recount-91f28.firebaseapp.com",
  databaseURL: "https://recount-91f28-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "recount-91f28",
  storageBucket: "recount-91f28.firebasestorage.app",
  messagingSenderId: "1054986263842",
  appId: "1:1054986263842:web:493e1ed04546c2f64fd97b",
  measurementId: "G-MPDYH3T8B6"
};

// Init once — avoid double-init if hot-reloading
const _app = getApps().length === 0
  ? initializeApp(FIREBASE_CONFIG)
  : getApps()[0];
const _db = getDatabase(_app);

// ── Key sanitizer ───────────────────────────────────────────────
// Firebase keys cannot contain: . # $ [ ] /
// Group keys use | as separator — replace with __
export function sanitizeFirebaseKey(str) {
  return String(str)
    .replace(/\./g, "_DOT_")
    .replace(/#/g, "_HASH_")
    .replace(/\$/g, "_DOLLAR_")
    .replace(/\[/g, "_LB_")
    .replace(/\]/g, "_RB_")
    .replace(/\//g, "_SLASH_")
    .replace(/\|/g, "__PIPE__")
    .slice(0, 200);
}

// ── READ ────────────────────────────────────────────────────────

/** Load all per-product overrides. Returns { [uid]: {...} } */
export async function loadManualOverrides() {
  try {
    const snap = await get(ref(_db, "manual_overrides"));
    return snap.exists() ? snap.val() : {};
  } catch (e) {
    console.error("[override] loadManualOverrides failed:", e);
    return {};
  }
}

/** Load all group-level display overrides. Returns { [sanitized_key]: {...} } */
export async function loadGroupOverrides() {
  try {
    const snap = await get(ref(_db, "group_overrides"));
    return snap.exists() ? snap.val() : {};
  } catch (e) {
    console.error("[override] loadGroupOverrides failed:", e);
    return {};
  }
}

/** Load both in parallel (used on app init) */
export async function loadAllOverrides() {
  const [products, groups] = await Promise.all([
    loadManualOverrides(),
    loadGroupOverrides(),
  ]);
  return { products, groups };
}

// ── WRITE ───────────────────────────────────────────────────────

/**
 * Save / update a per-product override.
 * @param {string} uid   — e.g. "domino_ge_12345"
 * @param {object} data  — partial override fields to merge
 */
export async function saveProductOverride(uid, data) {
  const key = sanitizeFirebaseKey(uid);
  const payload = {
    ...data,
    edited_at: new Date().toISOString(),
    edited_by: "admin",
  };
  // Remove undefined values — Firebase doesn't like them
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
  await update(ref(_db, `manual_overrides/${key}`), payload);
}

/**
 * Save / update a group-level display override.
 * @param {string} groupKey — raw group_key string (will be sanitized)
 * @param {object} data     — { display_name, display_image, display_category, display_sub_category }
 */
export async function saveGroupOverride(groupKey, data) {
  const key = sanitizeFirebaseKey(groupKey);
  const payload = {
    ...data,
    edited_at: new Date().toISOString(),
  };
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
  await update(ref(_db, `group_overrides/${key}`), payload);
}

/**
 * Merge N groups into a single manual group.
 * All products from all selected groups get the same manual_group_id.
 *
 * @param {string[]} uids           — all product uids from selected groups
 * @param {string}   manualGroupId  — stable ID for this manual group (e.g. "manual_1712345678")
 * @param {string}   manualGroupName — human-readable name shown on cards
 */
export async function mergeProductsIntoGroup(uids, manualGroupId, manualGroupName) {
  const batchUpdates = {};
  const now = new Date().toISOString();
  for (const uid of uids) {
    const key = sanitizeFirebaseKey(uid);
    batchUpdates[`manual_overrides/${key}/manual_group_id`]   = manualGroupId;
    batchUpdates[`manual_overrides/${key}/manual_group_name`]  = manualGroupName;
    // Re-allow grouping if this product was previously force-solo after unmerge
    batchUpdates[`manual_overrides/${key}/manual_force_solo`]  = false;
    batchUpdates[`manual_overrides/${key}/edited_at`]          = now;
    batchUpdates[`manual_overrides/${key}/edited_by`]          = "admin";
  }
  await update(ref(_db), batchUpdates);
}

/**
 * Unmerge a product.
 *
 * Important:
 * removing manual_group_id alone is NOT enough, because the product may
 * immediately fall back into auto-grouping. So we also set
 * manual_force_solo = true, which frontend/grouping logic must respect.
 *
 * @param {string} uid
 */
export async function unmergeProduct(uid) {
  const key = sanitizeFirebaseKey(uid);
  await update(ref(_db, `manual_overrides/${key}`), {
    manual_group_id: null,
    manual_group_name: null,
    manual_force_solo: true,
    edited_at: new Date().toISOString(),
    edited_by: "admin",
  });
}

/**
 * Lock all products in a group — scraper will not overwrite name/image/description.
 * @param {string[]} uids
 * @param {boolean}  locked
 */
export async function setGroupLocked(uids, locked) {
  const batchUpdates = {};
  const now = new Date().toISOString();
  for (const uid of uids) {
    const key = sanitizeFirebaseKey(uid);
    batchUpdates[`manual_overrides/${key}/manual_locked`] = locked;
    batchUpdates[`manual_overrides/${key}/edited_at`]     = now;
    batchUpdates[`manual_overrides/${key}/edited_by`]     = "admin";
  }
  await update(ref(_db), batchUpdates);
}

/**
 * Clear a product override entirely (revert to scraped data).
 * @param {string} uid
 */
export async function clearProductOverride(uid) {
  await set(ref(_db, `manual_overrides/${sanitizeFirebaseKey(uid)}`), null);
}

/**
 * Clear a group override entirely (revert to auto canonical_name + image).
 * @param {string} groupKey
 */
export async function clearGroupOverride(groupKey) {
  await set(ref(_db, `group_overrides/${sanitizeFirebaseKey(groupKey)}`), null);
}
