import { OFFICIAL_SOURCES, OFFICIAL_NEEDS, checkOfficial } from '/pdf/official.js';
// The official sheets are Wizards of the Coast's, so SheetSmith holds none. People add their own downloads here; each is
// accepted only if its SHA-256 matches the genuine form-fillable original, and is kept on this device only (IndexedDB).
const DB = 'sheetsmith-official', STORE = 'files';
const files = {};
const open = () => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(STORE);
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
const transact = async (mode, work) => {
  const db = await open();
  try { return await new Promise((resolve, reject) => { const tx = db.transaction(STORE, mode), result = work(tx.objectStore(STORE)); tx.oncomplete = () => resolve(result.result); tx.onerror = tx.onabort = () => reject(tx.error); }); }
  finally { db.close(); }
};
// Storage can be unavailable (private windows, blocked site data); the sheets then last until the page closes.
const keep = async (id, bytes) => { try { await transact('readwrite', store => store.put(bytes, id)); } catch {} };
export const sources = OFFICIAL_SOURCES;
export const stored = () => ({ ...files });
export const missingFor = templateId => (OFFICIAL_NEEDS[templateId] ?? []).filter(id => !files[id]).map(id => OFFICIAL_SOURCES.find(s => s.id === id).label);
export const isReady = templateId => missingFor(templateId).length === 0;
// Verifies each file by checksum and keeps the genuine ones. Returns one result per file for display.
export async function addFiles(list) {
  const results = [];
  for (const file of list) {
    if (file.size > 5_000_000) { results.push({ name: file.name, error: 'The file is too large to be one of the official sheets.' }); continue; }
    const bytes = new Uint8Array(await file.arrayBuffer()), found = await checkOfficial(bytes);
    if (found.error) { results.push({ name: file.name, error: found.error }); continue; }
    files[found.source.id] = bytes; await keep(found.source.id, bytes);
    results.push({ name: file.name, source: found.source });
  }
  return results;
}
export async function restore() {
  try {
    const db = await open();
    const entries = await new Promise((resolve, reject) => { const request = db.transaction(STORE).objectStore(STORE).openCursor(), found = []; request.onsuccess = () => { const cursor = request.result; if (cursor) { found.push([cursor.key, cursor.value]); cursor.continue(); } else resolve(found); }; request.onerror = () => reject(request.error); });
    db.close();
    // Stored bytes are checked again, so a damaged or swapped entry is dropped rather than trusted.
    for (const [id, value] of entries) { const bytes = new Uint8Array(value), found = await checkOfficial(bytes); if (found.source?.id === id) files[id] = bytes; }
  } catch {}
}
export async function clear() {
  for (const id of Object.keys(files)) delete files[id];
  try { await transact('readwrite', store => store.clear()); } catch {}
}
