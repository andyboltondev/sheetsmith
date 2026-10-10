import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import * as P from 'pdf-lib';
import { exportAll, type Scenario } from './helpers/scenarios.ts';
import { fitProblems, overlaps, widgets } from './helpers/layout.ts';
let all: Scenario[];
before(async () => { all = await exportAll(); });
const each = async (check: (s: Scenario) => Promise<void>) => { for (const s of all) await check(s); };
test('no text is clipped or spills out of its box, on any sheet, with light and heavy characters', () => each(async s => {
  assert.deepEqual(await fitProblems(s.bytes), [], s.name);
}));
test('exports raise no warnings for ordinary Western text', () => each(async s => { assert.deepEqual(s.warnings, [], s.name); }));
test('SheetSmith never places two editable boxes on top of each other', async () => {
  for (const s of all.filter(s => s.name.startsWith('compact'))) {
    const { list } = await widgets(s.bytes);
    assert.deepEqual(overlaps(list), [], s.name);
  }
});
test('every editable field has a name a screen reader can announce', () => each(async s => {
  const doc = await P.PDFDocument.load(s.bytes, { updateMetadata: false });
  const missing = doc.getForm().getFields().filter(f => !f.acroField.dict.get(P.PDFName.of('TU'))).map(f => f.getName());
  assert.deepEqual(missing, [], s.name);
}));
test('tabbing follows the page structure and field names are unique', () => each(async s => {
  const doc = await P.PDFDocument.load(s.bytes, { updateMetadata: false });
  const names = doc.getForm().getFields().map(f => f.getName());
  assert.equal(new Set(names).size, names.length, `${s.name} has duplicate field names`);
  for (const [i, page] of doc.getPages().entries()) assert.equal(page.node.get(P.PDFName.of('Tabs')), P.PDFName.of('S'), `${s.name} page ${i + 1}`);
}));
test('every field sits on a real page and the checkboxes are square enough to click', () => each(async s => {
  const { list } = await widgets(s.bytes);
  assert.ok(list.every(f => f.page >= 0), s.name);
  const tiny = list.filter(f => f.kind === 'check' && (f.w < 3 || f.h < 3)).map(f => f.name);
  assert.deepEqual(tiny, [], s.name);
}));
test('files stay within their size budgets', () => each(async s => {
  const budget = s.name.startsWith('compact') ? 7e5 : 3e5;
  assert.ok(s.bytes.length < budget, `${s.name} is ${(s.bytes.length / 1e6).toFixed(2)} MB`);
}));
test('the fit check notices real problems', async () => {
  // Guards the guard: a field whose text is wider than its box must be reported.
  const doc = await P.PDFDocument.create(), page = doc.addPage([200, 100]), field = doc.getForm().createTextField('Narrow');
  field.setText('A very long line of text that cannot fit'); field.addToPage(page, { x: 10, y: 10, width: 40, height: 14 }); field.setFontSize(9);
  assert.match((await fitProblems(await doc.save()))[0].problem, /wide in a/);
  const off = await P.PDFDocument.create(), offPage = off.addPage([100, 100]), box = off.getForm().createTextField('Off');
  box.addToPage(offPage, { x: 90, y: 90, width: 40, height: 14 });
  assert.match((await fitProblems(await off.save()))[0].problem, /outside the page/);
});
test('a long attack list does not push the actions off page one, and the attacks it drops continue overleaf', async () => {
  const heavy = all.find(s => s.name === 'compact-heavy')!, { list } = await widgets(heavy.bytes);
  const attacks = list.filter(f => f.name.startsWith('Attack.') && f.name.endsWith('.Name') && f.text);
  assert.equal(attacks.length, 6, 'the table stops at six rows when there are actions to show');
  assert.ok(list.some(f => f.page === 0 && f.name.startsWith('Action.')), 'actions appear on page one');
  assert.ok(list.some(f => f.page > 0 && /Attacks \(continued\)/.test(f.name)), 'the remaining attacks are not lost');
});
