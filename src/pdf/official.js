// The official 5e sheets belong to Wizards of the Coast and are not shipped with SheetSmith. People download Wizards' free
// form-fillable PDFs themselves and add them here. Each file is identified by its SHA-256, so only the genuine, editable
// originals are accepted, and everything stays in the browser.
export const OFFICIAL_PAGE = 'https://www.dndbeyond.com/resources/1779-d-d-character-sheets';
export const OFFICIAL_ARCHIVE = 'https://media.dndbeyond.com/compendium-images/marketing/5e_charactersheets.zip';
export const MAX_OFFICIAL_BYTES = 5_000_000;
// `fields` is the number of form fields in the original; a pinned hash already implies it, but it makes the check legible.
export const OFFICIAL_SOURCES = [
  { id: 'standard', label: 'Character Sheet', file: 'Character Sheet - Form Fillable.pdf', sha256: '6a4ba96b2d4c0e8bf0786d62e151bd602b01c6a6d59a1be8114aa586601d3fe1', fields: 106 },
  { id: 'alternative', label: 'Character Sheet – Alternative', file: 'Character Sheet - Alternative - Form Fillable.pdf', sha256: 'a5c24cf034d93cd7c0dba1b8f740f648acac3ceb58e4103ff5aaaeac347ab561', fields: 100 },
  { id: 'details', label: 'Character Details (Optional)', file: 'Character Details (Optional) - Form Fillable.pdf', sha256: 'f1fa96c35ac3bc91eb95dad15b4b5baca4b73ec49c8450f58f3b0a46958cd4b0', fields: 14 },
  { id: 'spells', label: 'Spellcasting Sheet (Optional)', file: 'Spellcasting Sheet (Optional) - Form Fillable.pdf', sha256: 'c0a50a0fbd225ec45441025575f788b9172c36699978fcda7ae68bc2ac5130b2', fields: 214 },
];
// Which downloads each official style is built from. The first is the sheet itself; the others are its detail and spell pages.
export const OFFICIAL_NEEDS = {
  'official-standard': ['standard', 'details', 'spells'],
  'official-alternative': ['alternative', 'details', 'spells'],
};
export async function sha256(bytes) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
// Returns { source } for a genuine official file, or { error } saying why it was refused.
export async function checkOfficial(bytes, sources = OFFICIAL_SOURCES) {
  if (!bytes?.length) return { error: 'The file is empty.' };
  if (bytes.length > MAX_OFFICIAL_BYTES) return { error: 'The file is too large to be one of the official sheets.' };
  if (String.fromCharCode(...bytes.subarray(0, 5)) !== '%PDF-') return { error: 'This is not a PDF.' };
  const hash = await sha256(bytes), source = sources.find(s => s.sha256 === hash);
  return source ? { source } : { error: 'This is not one of the official form-fillable sheets (the checksum does not match). Download the original again and do not edit or re-save it.' };
}
// Wizards' files carry their own duplicated, partly mislinked form fields. SheetSmith keeps only the printed artwork and
// recreates every field from the template layout, so the form and its link annotations are removed here.
async function artwork(PDFLib, bytes) {
  const doc = await PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
  doc.catalog.delete(PDFLib.PDFName.of('AcroForm'));
  for (const page of doc.getPages()) page.node.delete(PDFLib.PDFName.of('Annots'));
  return doc;
}
async function assemble(PDFLib, docs) {
  const out = await PDFLib.PDFDocument.create();
  for (const doc of docs) for (const page of await out.copyPages(doc, doc.getPageIndices())) out.addPage(page);
  return out.save();
}
// `files` maps a source id to the uploaded bytes. Every file is checked again here, so bytes that did not come from the
// verified store can never reach the exporter. Returns the prepared sheet and spell page.
export async function prepareOfficial(PDFLib, files, templateId, sources = OFFICIAL_SOURCES) {
  const needs = OFFICIAL_NEEDS[templateId];
  if (!needs) throw new Error('Choose one of the available sheet styles.');
  const docs = {};
  for (const id of needs) {
    const source = sources.find(s => s.id === id), bytes = files?.[id];
    if (!bytes) throw new Error(`Add the official “${source.label}” PDF first (see “Official sheets”).`);
    const found = await checkOfficial(bytes, sources);
    if (found.source?.id !== id) throw new Error(`“${source.label}” is not the genuine official PDF. Add the original ${source.file} again.`);
    docs[id] = await artwork(PDFLib, bytes);
  }
  const sheet = needs[0];
  return { main: await assemble(PDFLib, [docs[sheet], docs.details]), spells: await assemble(PDFLib, [docs.spells]) };
}
