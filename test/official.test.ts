import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as P from 'pdf-lib';
// @ts-expect-error Browser-compatible JS
import { OFFICIAL_SOURCES, OFFICIAL_NEEDS, OFFICIAL_PAGE, OFFICIAL_ARCHIVE, MAX_OFFICIAL_BYTES, checkOfficial, prepareOfficial, sha256 } from '../src/pdf/official.js';
// @ts-expect-error Browser-compatible JS
import { generatePdf } from '../src/pdf/generator.js';
import { sample } from './helpers/scenarios.ts';
import { layoutOf } from './helpers/templates.ts';
type Source = { id: string; label: string; file: string; sha256: string; fields: number };
// Stand-ins for Wizards' form-fillable files: one page each, with a form field and a link, which must not survive preparation.
async function fake(id: string, pages = 1) {
  const doc = await P.PDFDocument.create(), form = doc.getForm();
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([612, 792]); page.drawText(`${id} artwork ${i}`, { x: 50, y: 700, size: 12, font: await doc.embedFont(P.StandardFonts.Helvetica) });
    form.createTextField(`${id}.field${i}`).addToPage(page, { x: 50, y: 600, width: 100, height: 20 });
  }
  return new Uint8Array(await doc.save());
}
async function fixtures() {
  const files: Record<string, Uint8Array> = {};
  for (const s of OFFICIAL_SOURCES as Source[]) files[s.id] = await fake(s.id);
  const sources = await Promise.all((OFFICIAL_SOURCES as Source[]).map(async s => ({ ...s, sha256: await sha256(files[s.id]) })));
  return { files, sources };
}
test('the pinned checksums are well formed and every official style names real downloads', () => {
  const ids = (OFFICIAL_SOURCES as Source[]).map(s => s.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set((OFFICIAL_SOURCES as Source[]).map(s => s.sha256)).size, ids.length, 'one checksum per file');
  for (const s of OFFICIAL_SOURCES as Source[]) { assert.match(s.sha256, /^[0-9a-f]{64}$/, s.id); assert.match(s.file, /Form Fillable\.pdf$/, `${s.id} must be the editable file`); }
  for (const needs of Object.values(OFFICIAL_NEEDS) as string[][]) for (const id of needs) assert.ok(ids.includes(id), id);
  assert.match(OFFICIAL_PAGE, /^https:\/\/www\.dndbeyond\.com\//); assert.match(OFFICIAL_ARCHIVE, /^https:\/\/media\.dndbeyond\.com\/.*\.zip$/);
});
test('only a byte-for-byte genuine file is accepted, whatever it is called', async () => {
  const { files, sources } = await fixtures();
  const found = await checkOfficial(files.standard, sources);
  assert.equal(found.source?.id, 'standard');
  const edited = new Uint8Array([...files.standard, 10]);
  assert.match((await checkOfficial(edited, sources)).error!, /checksum does not match/);
  // Re-saving the same pages (which also strips the form) is a different file and is refused.
  const reopened = await P.PDFDocument.load(files.standard); reopened.setTitle('re-saved');
  const resaved = new Uint8Array(await reopened.save());
  assert.match((await checkOfficial(resaved, sources)).error!, /checksum/);
  assert.match((await checkOfficial(new TextEncoder().encode('not a pdf at all'), sources)).error!, /not a PDF/);
  assert.match((await checkOfficial(new Uint8Array(0), sources)).error!, /empty/);
  assert.match((await checkOfficial(new Uint8Array(MAX_OFFICIAL_BYTES + 1).fill(37), sources)).error!, /too large/);
});
test('the real pinned checksums refuse files that merely look like the sheets', async () => {
  const { files } = await fixtures();
  for (const bytes of Object.values(files)) assert.match((await checkOfficial(bytes)).error!, /checksum/);
});
test('preparing keeps the artwork pages, drops the form, and builds the spell page separately', async () => {
  const { files, sources } = await fixtures();
  for (const [id, sheet] of [['official-standard', 'standard'], ['official-alternative', 'alternative']]) {
    const { main, spells } = await prepareOfficial(P, files, id, sources);
    const doc = await P.PDFDocument.load(main), spellDoc = await P.PDFDocument.load(spells);
    assert.equal(doc.getPageCount(), 2, `${id}: sheet and details`); assert.equal(spellDoc.getPageCount(), 1);
    assert.equal(doc.getForm().getFields().length, 0, 'wizards’ duplicated fields are removed'); assert.equal(spellDoc.getForm().getFields().length, 0);
    assert.ok(doc.getPages().every(p => !p.node.has(P.PDFName.of('Annots'))));
    const text = (bytes: Uint8Array) => Buffer.from(bytes).toString('latin1');
    assert.ok(main.length < files[sheet].length + files.details.length, 'no orphaned objects carried over');
    assert.ok(text(main).includes('%PDF'), id);
  }
});
test('a missing or swapped file stops the export with a clear message', async () => {
  const { files, sources } = await fixtures();
  const { standard, ...without } = files;
  await assert.rejects(prepareOfficial(P, without, 'official-standard', sources), /Add the official “Character Sheet” PDF first/);
  await assert.rejects(prepareOfficial(P, { ...files, standard: files.details }, 'official-standard', sources), /not the genuine official PDF/);
  await assert.rejects(prepareOfficial(P, undefined, 'official-standard', sources), /Add the official/);
  await assert.rejects(prepareOfficial(P, files, 'compact', sources), /Choose one of the available/);
});
test('prepared sheets export a full character with editable fields', async () => {
  const { files, sources } = await fixtures();
  const c = await sample(), { main, spells } = await prepareOfficial(P, files, 'official-standard', sources);
  const { bytes } = await generatePdf(P, c, { templateId: 'official-standard', templateBytes: main, layout: await layoutOf('official-standard'), spellResource: { bytes: spells, layout: await layoutOf('official-spells') } });
  const form = (await P.PDFDocument.load(bytes)).getForm();
  assert.equal(form.getTextField('AC').getText(), '18');
});
// Runs against the real downloads when SHEETSMITH_OFFICIAL_DIR points at the unzipped "Fifth Edition Character Sheets".
const realDir = process.env.SHEETSMITH_OFFICIAL_DIR;
test('the genuine downloads match their pinned checksums and export with their artwork', { skip: realDir ? false : 'set SHEETSMITH_OFFICIAL_DIR to the unzipped Wizards download to run this' }, async () => {
  const files: Record<string, Uint8Array> = {};
  for (const s of OFFICIAL_SOURCES as Source[]) {
    files[s.id] = new Uint8Array(await readFile(`${realDir}/${s.file}`));
    assert.equal((await checkOfficial(files[s.id])).source?.id, s.id, s.file);
    assert.equal((await P.PDFDocument.load(files[s.id])).getForm().getFields().length, s.fields, `${s.file} is the editable version`);
  }
  const c = await sample();
  for (const id of ['official-standard', 'official-alternative']) {
    const { main, spells } = await prepareOfficial(P, files, id);
    const layout = await layoutOf(id), doc = await P.PDFDocument.load(main);
    assert.ok(layout.every((f: { page: number }) => f.page < doc.getPageCount()), `${id} layout fits the assembled pages`);
    const { bytes } = await generatePdf(P, c, { templateId: id, templateBytes: main, layout, spellResource: { bytes: spells, layout: await layoutOf('official-spells') } });
    const out = await P.PDFDocument.load(bytes);
    // The artwork travels once; Wizards' own duplicated fields and unused objects do not.
    assert.ok(bytes.length < 450_000, `${id}: ${bytes.length} bytes`);
    assert.equal(out.getForm().getTextField('AC').getText(), '18');
  }
});
