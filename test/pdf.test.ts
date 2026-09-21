import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as PDFLib from 'pdf-lib';
// @ts-expect-error Browser-compatible module intentionally uses JavaScript.
import { generatePdf } from '../src/pdf/generator.js';
import { normalise } from '../src/importers/dndbeyond/parser.ts';
const sample = async () => normalise(JSON.parse(await readFile(new URL('./fixtures/martial.json', import.meta.url), 'utf8')));
test('PDF roundtrip preserves editable field values and player override without source mutation', async () => {
  const character = await sample();const original = structuredClone(character);
  const { bytes } = await generatePdf(PDFLib, character, { playerName: 'Andy' });
  const doc = await PDFLib.PDFDocument.load(bytes);const form = doc.getForm();
  assert.equal(doc.getPageCount(), 3);
  assert.equal(form.getTextField('CharacterName').getText(), 'Mara Ashford');
  assert.equal(form.getTextField('PlayerName').getText(), 'Andy');
  assert.equal(form.getTextField('AC').getText(), '18');
  assert.match(form.getTextField('Equipment').getText()!, /Longsword.*\n/);
  assert.equal(form.getTextField('strength').getText(), '16 (+3)');
  assert.deepEqual(character, original);
});
test('long features continue on editable extra pages', async () => {
  const character = await sample();character.features = Array.from({length:200},(_,i) => `Feature ${i}: A memorable ability.`).join('\n');
  const { bytes } = await generatePdf(PDFLib,character);const doc = await PDFLib.PDFDocument.load(bytes);
  assert.ok(doc.getPageCount()>3);
  const content = doc.getForm().getFields().map(field => field instanceof PDFLib.PDFTextField ? field.getText() : '').join('\n');
  assert.match(content,/Feature 199/);assert.match(content,/Continued on extra pages/);
});
test('PNG portrait embeds successfully and unsupported text produces an explicit warning', async () => {
  const character = await sample();character.identity.name = 'Mara 🐉';
  const portrait = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');
  const { bytes, warnings } = await generatePdf(PDFLib,character,{portrait});
  assert.ok(bytes.length>1000);assert.equal(warnings.length,1);
});
