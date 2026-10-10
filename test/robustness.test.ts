import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P from 'pdf-lib';
// @ts-expect-error Browser module.
import { generatePdf } from '../src/pdf/generator.js';
import { normalise } from '../src/importers/dndbeyond/parser.ts';
import { widgets } from './helpers/layout.ts';
import { here } from './helpers/scenarios.ts';
import { readFile } from 'node:fs/promises';
const raw = async () => JSON.parse(await readFile(here('src/sample/martial.json'), 'utf8'));
// Values an upstream format change or a hand-edited character could put where a list or object is expected.
const bad = [null, 5, 'x', [null], [5], {}, [{}], [[]], true];
function* mutations(data: any, path: string[] = [], depth = 0): Generator<{ path: string[]; value: unknown }> {
  if (depth > 3 || data === null || typeof data !== 'object') return;
  for (const key of Object.keys(data).slice(0, 40)) {
    for (const value of bad) yield { path: [...path, key], value };
    yield* mutations(data[key], [...path, key], depth + 1);
  }
}
const apply = (root: any, path: string[], value: unknown) => { let at = root; for (const key of path.slice(0, -1)) at = at[key]; const last = path.at(-1)!, old = at[last]; at[last] = structuredClone(value); return () => { at[last] = old; }; };
// Every string and number in the imported character, to catch NaN, Infinity and "[object Object]" that would print on a sheet.
function* leaves(value: unknown, path = ''): Generator<[string, string | number]> {
  if (typeof value === 'string' || typeof value === 'number') yield [path, value];
  else if (Array.isArray(value)) for (const [i, item] of value.entries()) yield* leaves(item, `${path}[${i}]`);
  else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) yield* leaves(item, `${path}.${key}`);
}
test('malformed upstream data never crashes the importer, whatever field it appears in', async () => {
  const source = await raw(), crashes = new Map<string, string>(); let count = 0;
  for (const { path, value } of mutations(source.data)) {
    const undo = apply(source.data, path, value); count++;
    try {
      for (const [where, leaf] of leaves(normalise(source))) {
        if (typeof leaf === 'number' && !Number.isFinite(leaf)) crashes.set(`${path.join('.')} → ${where}`, `${leaf}`);
        if (typeof leaf === 'string' && /\[object Object\]|\bNaN\b|\bundefined\b/.test(leaf)) crashes.set(`${path.join('.')} → ${where}`, leaf.slice(0, 50));
      }
    } catch (error) { if (error instanceof TypeError || error instanceof RangeError) crashes.set(path.join('.'), (error as Error).message); }
    undo();
  }
  assert.ok(count > 500, `only ${count} mutations were tried`);
  assert.deepEqual([...crashes], []);
});
test('what the importer returns for damaged data can still be exported and contains no placeholder text', async () => {
  const source = await raw(), garbage = /\b(undefined|NaN|null)\b|\[object Object\]/, found: string[] = []; let tried = 0, n = 0;
  for (const { path, value } of mutations(source.data)) {
    if (n++ % 5) continue;
    const undo = apply(source.data, path, value);
    let character; try { character = normalise(source); } catch { undo(); continue; }
    undo(); tried++;
    const { bytes } = await generatePdf(P, character, { templateId: 'compact' });
    const { list } = await widgets(bytes);
    for (const f of list) if (garbage.test(f.text)) found.push(`${path.join('.')}=${JSON.stringify(value)} → ${f.name}: ${f.text.slice(0, 60)}`);
  }
  assert.ok(tried > 50, `only ${tried} exports were tried`);
  assert.deepEqual(found.slice(0, 10), []);
});
