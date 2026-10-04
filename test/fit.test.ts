import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as PDFLib from 'pdf-lib';
// @ts-expect-error Browser-compatible module intentionally uses JavaScript.
import { fitText, generatePdf, lineHeight } from '../src/pdf/generator.js';
import { normalise } from '../src/importers/dndbeyond/parser.ts';
const font = async () => (await PDFLib.PDFDocument.create()).embedFont(PDFLib.StandardFonts.Helvetica);
const load = async (name: string) => readFile(new URL(`../templates/${name}`, import.meta.url));

test('text keeps the largest size that fits and shrinks before overflowing', async () => {
  const f = await font();
  const short = fitText('Short note.', f, { width: 200, height: 40, max: 10, min: 7 });
  assert.equal(short.size, 10); assert.equal(short.rest, '');
  const text = Array.from({ length: 4 }, () => 'A sentence that wraps across the box.').join(' ');
  const shrunk = fitText(text, f, { width: 120, height: lineHeight(f, 8) * 6, max: 10, min: 7 });
  assert.ok(shrunk.size < 10 && shrunk.size >= 7); assert.equal(shrunk.rest, '');
});

test('overflow splits at line and sentence boundaries and keeps list structure', async () => {
  const f = await font();
  const list = Array.from({ length: 30 }, (_, i) => `Item ${i}`).join('\n');
  const fit = fitText(list, f, { width: 200, height: lineHeight(f, 7) * 5, max: 9, min: 7, marker: '(more)' });
  assert.match(fit.text, /\(more\)$/);
  assert.equal(fit.text.split('\n').length, 5);
  assert.match(fit.rest, /^Item 4\nItem 5\n/);
  const prose = fitText('First sentence here. Second sentence follows. Third sentence ends it. Fourth one too. Fifth closes.', f, { width: 95, height: lineHeight(f, 7) * 3, max: 7, min: 7, marker: '(more)' });
  assert.match(prose.text, /follows\.\n\(more\)$/, 'kept text ends on a whole sentence');
  assert.match(prose.rest, /^Third sentence/);
});

test('continued text is titled for readers and never splits list lines together', async () => {
  const c = normalise(JSON.parse(await readFile(new URL('./fixtures/martial.json', import.meta.url), 'utf8')));
  c.details = { ...c.details, personalityTraits: Array.from({ length: 12 }, (_, i) => `Trait sentence ${i} is quite memorable.`).join(' ') };
  c.equipment = Array.from({ length: 60 }, (_, i) => `1 x Thing ${i} with a long descriptive inventory name`).join('\n');
  c.inventoryRows = Array.from({ length: 60 }, (_, i) => ({ name: `Thing ${i} with a long descriptive inventory name`, quantity: 1, equipped: false, category: 'Gear', armourType: null }));
  const result = await generatePdf(PDFLib, c, { templateId: 'official-standard', templateBytes: await load('official-standard.pdf'), layout: JSON.parse((await load('official-standard.json')).toString()) });
  const doc = await PDFLib.PDFDocument.load(result.bytes);
  const text = doc.getForm().getFields().map(field => field instanceof PDFLib.PDFTextField ? field.getText() ?? '' : '').join('\n');
  assert.match(text, /PERSONALITY TRAITS \(CONTINUED\)/);
  assert.match(text, /Continued in Additional Features & Traits/);
  assert.doesNotMatch(text, /PersonalityTraits|\[Continued/);
  assert.match(text, /Thing 58 with a long descriptive inventory name\nThing 59/);
  assert.doesNotMatch(text, /1 x Thing/);
});
