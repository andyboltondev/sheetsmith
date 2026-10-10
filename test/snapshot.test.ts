import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import * as P from 'pdf-lib';
import { exportAll, here } from './helpers/scenarios.ts';
import { widgets } from './helpers/layout.ts';
// A layout regression net. Each export is reduced to a few hashes per page: where the editable fields sit, what they
// hold, what is drawn on the page, and the artwork behind it. Any change shows which scenario and page moved.
// After an intended change, review the result by eye, then accept it with:  UPDATE_SNAPSHOTS=1 npm test
const file = here('test/snapshots/layout.json');
const hash = (data: string | Uint8Array) => createHash('sha1').update(data).digest('hex').slice(0, 12);
const round = (n: number) => Math.round(n * 10) / 10;
async function digest(bytes: Uint8Array) {
  const { doc, list } = await widgets(bytes), context = doc.context;
  const streams = (page: P.PDFPage) => { const contents = page.node.Contents(); const refs = contents instanceof P.PDFArray ? contents.asArray() : contents ? [contents] : []; return refs.map(ref => { const stream = context.lookup(ref, P.PDFStream); return stream instanceof P.PDFRawStream ? P.decodePDFRawStream(stream).decode() : (stream as P.PDFContentStream).getContents(); }); };
  const pages = doc.getPages().map((page, i) => {
    const mine = list.filter(f => f.page === i);
    return {
      fields: mine.length,
      geometry: hash(mine.map(f => `${f.name}|${round(f.x)}|${round(f.y)}|${round(f.w)}|${round(f.h)}|${f.size}|${f.kind}`).join('\n')),
      text: hash(mine.map(f => `${f.name}=${f.text}`).join('\n')),
      drawing: hash(Buffer.concat(streams(page))),
    };
  });
  const artwork = context.enumerateIndirectObjects().filter(([, o]) => o instanceof P.PDFRawStream && o.dict.get(P.PDFName.of('Subtype')) === P.PDFName.of('Image')).map(([, o]) => hash((o as P.PDFRawStream).contents)).sort();
  return { pages, artwork: hash(artwork.join()) };
}
test('exports match the recorded layout (UPDATE_SNAPSHOTS=1 npm test accepts an intended change)', async () => {
  const actual: Record<string, unknown> = {};
  for (const s of await exportAll()) actual[s.name] = await digest(s.bytes);
  if (process.env.UPDATE_SNAPSHOTS) { await writeFile(file, JSON.stringify(actual, null, 1) + '\n'); return; }
  const expected = JSON.parse(await readFile(file, 'utf8').catch(() => '{}'));
  assert.deepEqual(Object.keys(actual), Object.keys(expected), 'scenarios changed; run UPDATE_SNAPSHOTS=1 npm test');
  const differences: string[] = [];
  for (const [name, now] of Object.entries(actual) as [string, Awaited<ReturnType<typeof digest>>][]) {
    const before = expected[name] as typeof now;
    if (now.artwork !== before.artwork) differences.push(`${name}: artwork changed`);
    if (now.pages.length !== before.pages.length) { differences.push(`${name}: ${before.pages.length} pages became ${now.pages.length}`); continue; }
    now.pages.forEach((page, i) => { for (const key of ['fields', 'geometry', 'text', 'drawing'] as const) if (page[key] !== before.pages[i][key]) differences.push(`${name} page ${i + 1}: ${key} changed`); });
  }
  assert.deepEqual(differences, [], 'Layout changed. If intended, check the pages by eye and run UPDATE_SNAPSHOTS=1 npm test');
});
