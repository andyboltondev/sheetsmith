import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import * as P from 'pdf-lib';
import { exportAll, sample, type Scenario } from './helpers/scenarios.ts';
// @ts-expect-error Browser module
import { generatePdf } from '../src/pdf/generator.js';
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
test('every prepared damaging spell is in the attack table; a long table moves equipment to its own page', async () => {
  const heavy = all.find(s => s.name === 'compact-heavy')!, { list } = await widgets(heavy.bytes);
  const attacks = list.filter(f => /^Attack\.\d+\.Name$/.test(f.name) && f.text);
  assert.ok(attacks.length > 7, 'the table grows past the usual row count instead of dropping attacks');
  assert.ok(attacks.every(f => f.page === 0), 'all of them are on page one');
  assert.ok(!list.some(f => /Attacks \(continued\)/.test(f.name)), 'nothing is pushed to a continuation list');
  assert.ok(list.find(f => f.name === 'Item.1.Name')!.page > 0, 'equipment moves to the next page');
  const sample = await widgets(all.find(s => s.name === 'compact-sample')!.bytes);
  assert.equal(sample.list.find(f => f.name === 'Item.1.Name')!.page, 0, 'a short table keeps equipment on page one');
});
test('the Appearance boxes flex: any count shares evenly over full-width rows of equal boxes', async () => {
  const keys = ['gender', 'age', 'size', 'height', 'weight', 'eyes', 'skin', 'hair', 'faith', 'lifestyle'];
  for (let n = 1; n <= keys.length; n++) {
    const c = await sample();
    (c as any).details = Object.fromEntries(keys.slice(0, n).map(k => [k, 'x']));
    const { list } = await widgets((await generatePdf(P, c, { templateId: 'compact' })).bytes);
    const boxes = list.filter(f => f.name.startsWith('Appearance.')), rows = new Map<number, typeof boxes>();
    for (const f of boxes) rows.set(Math.round(f.y), [...(rows.get(Math.round(f.y)) ?? []), f]);
    assert.equal(boxes.length, n);
    const sizes = [...rows.values()].map(r => r.length);
    assert.ok(Math.max(...sizes) <= 5 && Math.max(...sizes) - Math.min(...sizes) <= 1, `${n} boxes split ${sizes}`);
    for (const row of rows.values()) {
      const sorted = [...row].sort((a, b) => a.x - b.x);
      assert.ok(new Set(row.map(f => Math.round(f.w))).size === 1, 'equal boxes within a row');
      assert.ok(Math.abs(sorted[0].x - 31) < 4 && Math.abs(sorted.at(-1)!.x + sorted.at(-1)!.w - 565) < 4, 'the row spans the width');
    }
  }
});
