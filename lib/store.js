// Keeps the current analysis in the browser (IndexedDB) so that a refresh, or the back and
// forward buttons, do not lose the work or spend the AI calls again. Everything here is
// dropped when the user starts again, or when it is older than KEEP_HOURS.
// Nothing leaves the browser. If storage is unavailable (some private windows), every call
// quietly does nothing and the app works as before.

const DB = "ambidexterity-analyzer", VERSION = 1, KEEP_HOURS = 24;
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, VERSION);
      req.onupgradeneeded = () => { const db = req.result; for (const s of ["session", "cache"]) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbp;
}

async function tx(store, mode, fn) {
  const db = await open();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const t = db.transaction(store, mode), s = t.objectStore(store);
      const req = fn(s);
      t.oncomplete = () => resolve(req?.result);
      t.onerror = t.onabort = () => resolve(undefined);
    } catch { resolve(undefined); }
  });
}

// IndexedDB cannot store functions or class instances; if a value has any, store a JSON copy
const put = (s, value, key) => { const rec = { value, at: Date.now() }; try { return s.put(rec, key); } catch { return s.put(JSON.parse(JSON.stringify(rec)), key); } };

export const sessionGet = (key) => tx("session", "readonly", (s) => s.get(key));
export const sessionSet = (key, value) => tx("session", "readwrite", (s) => put(s, value, key));

export async function loadSession() {
  const [state, docs] = await Promise.all([sessionGet("state"), sessionGet("docs")]);
  const fresh = (x) => x && Date.now() - x.at < KEEP_HOURS * 3600e3;
  if (!fresh(state) && !fresh(docs)) { if (state || docs) await clearAll(); return null; }
  return { state: fresh(state) ? state.value : null, docs: fresh(docs) ? docs.value : null };
}

export async function clearAll() {
  await tx("session", "readwrite", (s) => s.clear());
  await tx("cache", "readwrite", (s) => s.clear());
}

// Cache of AI and search responses, keyed by a hash of the exact request.
function hash(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36) + str.length.toString(36);
}
export const cacheKey = (url, body) => url + ":" + hash(JSON.stringify(body));
export async function cacheGet(key) {
  const x = await tx("cache", "readonly", (s) => s.get(key));
  return x && Date.now() - x.at < KEEP_HOURS * 3600e3 ? x.value : undefined;
}
export const cacheSet = (key, value) => tx("cache", "readwrite", (s) => put(s, value, key));
