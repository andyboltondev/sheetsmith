import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { here } from './helpers/scenarios.ts';
import { layoutOf } from './helpers/templates.ts';
type Entry = { id: string; name?: string; edition: string; family: string; resource?: boolean; characterClass?: string };
const catalog = async (): Promise<Entry[]> => JSON.parse(await readFile(here('templates/catalog.json'), 'utf8'));
// Pages in each of Wizards' sheets once assembled: the sheet and its details page, or the spell page alone.
const PAGES: Record<string, number> = { 'official-standard': 2, 'official-alternative': 2, 'official-spells': 1 };
test('the catalogue lists only the official 5e styles and their spell page, each with a consistent layout', async () => {
  const entries = await catalog();
  assert.deepEqual(entries.map(e => e.id), ['official-standard', 'official-alternative', 'official-spells']);
  for (const e of entries) {
    assert.equal(e.edition, '5e', e.id); assert.equal(e.family, 'official', e.id); assert.equal(e.characterClass, undefined, e.id);
    const layout: { name: string; page: number; rect: number[]; type: string }[] = await layoutOf(e.id);
    assert.ok(layout.length > 5, `${e.id} has fields`);
    assert.equal(new Set(layout.map(f => f.name)).size, layout.length, `${e.id} field names are unique`);
    for (const f of layout) {
      assert.ok(f.page >= 0 && f.page < PAGES[e.id], `${e.id}: ${f.name} is on page ${f.page}`);
      const [x, y, r, t] = f.rect;
      assert.ok(r > x && t > y && x >= -1 && y >= -1 && r <= 613 && t <= 793, `${e.id}: ${f.name} sits outside its page`);
    }
  }
});
test('no third-party or Wizards artwork is shipped: the templates folder holds layouts only', async () => {
  const files = (await readdir(here('templates/'))).sort();
  assert.deepEqual(files, ['README.md', 'catalog.json', 'official-alternative.json', 'official-spells.json', 'official-standard.json']);
  assert.match(await readFile(here('.gitignore'), 'utf8'), /^templates\/\*\.pdf$/m, 'PDFs in templates/ stay out of git');
});
test('layouts hold geometry only, with no printed text from the sheets', async () => {
  for (const id of ['official-standard', 'official-alternative', 'official-spells']) {
    const layout: { value?: string }[] = await layoutOf(id);
    assert.ok(layout.every(f => !f.value), id);
  }
});
