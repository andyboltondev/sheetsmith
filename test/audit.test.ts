import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/server.ts';
import { createDndBeyondImporter } from '../src/importers/dndbeyond/index.ts';
const sample = async () => JSON.parse(await readFile(new URL('../src/sample/martial.json', import.meta.url), 'utf8'));
test('every module the browser imports is served', async () => {
  const server = createApp(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const sources: [string, string][] = [];
    for (const dir of ['public', 'src/pdf']) for (const file of await readdir(new URL(`../${dir}/`, import.meta.url))) if (file.endsWith('.js')) sources.push([dir, file]);
    const missing: string[] = [];
    for (const [dir, file] of sources) {
      const code = await readFile(new URL(`../${dir}/${file}`, import.meta.url), 'utf8');
      const served = dir === 'public' ? `/${file}` : `/pdf/${file}`;
      if ((await fetch(base + served)).status !== 200) missing.push(served);
      for (const [, specifier] of code.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        const url = specifier.startsWith('/') ? specifier : new URL(specifier, `http://x${dir === 'public' ? '/' : '/pdf/'}`).pathname;
        if (url.endsWith('.js') && (await fetch(base + url)).status !== 200) missing.push(`${file} imports ${url}`);
      }
    }
    assert.deepEqual(missing, []);
    assert.equal((await fetch(`${base}/pdf/not-a-module.js`)).status, 404);
    assert.equal((await fetch(`${base}/pdf/..%2Fserver.js`)).status, 404);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
test('malformed upstream lists are skipped rather than failing the import', async () => {
  const raw = await sample(); raw.data.inventory = [null, 5, ...raw.data.inventory, []]; raw.data.modifiers.class[0].subType = 7; raw.data.modifiers.race = [null, ...(raw.data.modifiers.race ?? [])];
  const importer = createDndBeyondImporter(async () => new Response(JSON.stringify(raw)));
  const character = await importer.import('https://www.dndbeyond.com/characters/1');
  assert.equal(character.identity.name, 'Mara Ashford');
});
test('a parser fault is reported as unreadable data, not as an upstream outage', async () => {
  const body = async () => new Response(JSON.stringify(await sample()));
  const fault = createDndBeyondImporter(body, () => { throw new TypeError("Cannot read properties of undefined (reading 'x')"); });
  await assert.rejects(fault.import('https://www.dndbeyond.com/characters/1'), error => /data could not be read/.test((error as Error).message) && !/Cannot read|unavailable/.test((error as Error).message));
  // Curated messages from the parser pass through unchanged.
  const unsupported = createDndBeyondImporter(async () => new Response(JSON.stringify({ data: { name: 'x', classes: 7 } })));
  await assert.rejects(unsupported.import('https://www.dndbeyond.com/characters/1'), /class or level is missing/);
  // A real network fault is an outage.
  const offline = createDndBeyondImporter(async () => { throw new TypeError('fetch failed'); });
  await assert.rejects(offline.import('https://www.dndbeyond.com/characters/1'), /currently unavailable/);
});
test('exported PDFs ask viewers to show the character name as the window title', async () => {
  const [{ generatePdf }, PDFLib, { normalise }] = await Promise.all([
    // @ts-expect-error Browser module
    import('../src/pdf/generator.js'), import('pdf-lib'), import('../src/importers/dndbeyond/parser.ts')]);
  const { bytes } = await generatePdf(PDFLib, normalise(await sample()), { templateId: 'compact' });
  const doc = await PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
  assert.equal(doc.catalog.getOrCreateViewerPreferences().getDisplayDocTitle(), true);
  assert.equal(doc.getProducer(), 'SheetSmith');
  assert.match(doc.getTitle() ?? '', /Mara Ashford/);
});
test('near-miss character links are completed, and anything else is left for the server to judge', async () => {
  // @ts-expect-error Browser module
  const { characterUrl } = await import('../public/character-url.js');
  assert.equal(characterUrl(' 171344792 '), 'https://www.dndbeyond.com/characters/171344792');
  assert.equal(characterUrl('dndbeyond.com/characters/1'), 'https://dndbeyond.com/characters/1');
  assert.equal(characterUrl('www.dndbeyond.com/characters/1'), 'https://www.dndbeyond.com/characters/1');
  assert.equal(characterUrl('https://www.dndbeyond.com/characters/1'), 'https://www.dndbeyond.com/characters/1');
  assert.equal(characterUrl('evil.test/characters/1'), 'evil.test/characters/1');
  assert.equal(characterUrl('12345678901234'), '12345678901234');
});
