import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { gunzipSync } from 'node:zlib';
import { request } from 'node:http';
import { readFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { createApp, limiter } from '../src/server.ts';
import { normalise } from '../src/importers/dndbeyond/parser.ts';
import type { CharacterImporter } from '../src/character/model.ts';
const sampleRaw = async () => JSON.parse(await readFile(new URL('../src/sample/martial.json', import.meta.url), 'utf8'));
async function serve(importer?: CharacterImporter) {
  const server = createApp(importer); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = (server.address() as AddressInfo).port, base = `http://127.0.0.1:${port}`;
  return { base, port, close: async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); } };
}
const importer = (run: (url: string) => Promise<unknown>): CharacterImporter => ({ canImport: () => true, import: run as CharacterImporter['import'] });
const post = (base: string, body: unknown, headers: Record<string, string> = { 'Content-Type': 'application/json' }) => fetch(`${base}/api/import`, { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });
test('the import route validates its input, in order, with a clear status for each failure', async () => {
  const app = await serve(importer(async () => normalise(await sampleRaw())));
  try {
    assert.equal((await post(app.base, { url: 'https://www.dndbeyond.com/characters/1' })).status, 200);
    assert.equal((await post(app.base, 'not json')).status, 400);
    assert.equal((await post(app.base, { url: 7 })).status, 400);
    assert.equal((await post(app.base, {}, { 'Content-Type': 'text/plain' })).status, 415);
    assert.equal((await post(app.base, { url: 'x'.repeat(5000) })).status, 413);
    assert.equal((await post(app.base, { url: 'https://www.dndbeyond.com/characters/1' }, { 'Content-Type': 'application/json', Origin: 'https://evil.test' })).status, 403);
    assert.equal((await fetch(`${app.base}/api/import`, { method: 'PUT' })).status, 405);
    assert.equal((await fetch(`${app.base}/api/portrait?url=https://example.com/a.png`)).status, 400);
    assert.equal((await fetch(`${app.base}/api/portrait?url=https://www.dndbeyond.com/a.png`, { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  } finally { await app.close(); }
});
test('an importer failure is reported with its own message and does not take the server down', async () => {
  let fail = true;
  const app = await serve(importer(async () => { if (fail) throw new Error('This character could not be retrieved.'); return normalise(await sampleRaw()); }));
  try {
    const failed = await post(app.base, { url: 'https://www.dndbeyond.com/characters/1' });
    assert.equal(failed.status, 502); assert.equal((await failed.json()).error, 'This character could not be retrieved.');
    fail = false;
    assert.equal((await post(app.base, { url: 'https://www.dndbeyond.com/characters/1' })).status, 200);
  } finally { await app.close(); }
});
test('imports are limited to 20 a minute and three at a time', async () => {
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  const app = await serve(importer(async () => { await gate; return normalise(await sampleRaw()); }));
  try {
    const url = { url: 'https://www.dndbeyond.com/characters/1' };
    const running = [post(app.base, url), post(app.base, url), post(app.base, url)];
    await new Promise(resolve => setTimeout(resolve, 50));
    const fourth = await post(app.base, url);
    assert.equal(fourth.status, 429); assert.match((await fourth.json()).error, /Too many imports/);
    release(); assert.deepEqual((await Promise.all(running)).map(r => r.status), [200, 200, 200]);
    for (let i = 3; i < 20; i++) assert.equal((await post(app.base, url)).status, 200, `request ${i + 1}`);
    assert.equal((await post(app.base, url)).status, 429, 'the 21st within a minute');
  } finally { await app.close(); }
});
test('the sliding window frees a slot once a minute has passed', () => {
  mock.timers.enable({ apis: ['Date'], now: 0 });
  try {
    const allowed = limiter(2);
    assert.deepEqual([allowed(), allowed(), allowed()], [true, true, false]);
    mock.timers.tick(59_000); assert.equal(allowed(), false);
    mock.timers.tick(1_500); assert.equal(allowed(), true);
  } finally { mock.timers.reset(); }
});
test('requests to an unexpected host are refused before anything is served', async () => {
  const app = await serve();
  try {
    const status = (host: string) => new Promise<number>((resolve, reject) => { const req = request({ host: '127.0.0.1', port: app.port, path: '/', headers: { Host: host } }, res => { res.resume(); resolve(res.statusCode!); }); req.on('error', reject); req.end(); });
    assert.equal(await status('evil.test'), 403);
    assert.equal(await status('localhost.evil.test:3000'), 403);
    assert.equal(await status('localhost:3000'), 200);
  } finally { await app.close(); }
});
test('every response carries the security headers, and caching follows what the content is', async () => {
  const app = await serve();
  try {
    for (const path of ['/', '/app.js', '/api/sample', '/api/templates', '/nothing-here']) {
      const res = await fetch(app.base + path); await res.arrayBuffer();
      const csp = res.headers.get('content-security-policy') ?? '';
      assert.match(csp, /default-src 'self'/, path); assert.match(csp, /frame-ancestors 'none'/, path); assert.match(csp, /object-src 'none'/, path);
      assert.match(csp, /frame-src blob:/, path); assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/, path);
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff', path); assert.equal(res.headers.get('referrer-policy'), 'no-referrer', path);
    }
    assert.equal((await fetch(`${app.base}/api/sample`)).headers.get('cache-control'), 'no-store', 'character data is never cached');
    assert.match((await fetch(`${app.base}/style.css`)).headers.get('cache-control')!, /must-revalidate/);
  } finally { await app.close(); }
});
test('files compress when asked, and nothing outside the allowlist is reachable', async () => {
  const app = await serve();
  try {
    const plain = await (await fetch(`${app.base}/app.js`, { headers: { 'Accept-Encoding': 'identity' } })).text();
    const zipped = await fetch(`${app.base}/app.js`, { headers: { 'Accept-Encoding': 'gzip' } });
    assert.equal(zipped.headers.get('content-encoding'), 'gzip');
    // fetch undoes the compression itself, so equal text proves the compressed body is the same file.
    assert.equal(await zipped.text(), plain);
    const raw = await new Promise<Buffer>((resolve, reject) => { const req = request({ host: '127.0.0.1', port: app.port, path: '/app.js', headers: { 'Accept-Encoding': 'gzip' } }, res => { const parts: Buffer[] = []; res.on('data', d => parts.push(d)); res.on('end', () => resolve(Buffer.concat(parts))); }); req.on('error', reject); req.end(); });
    assert.equal(gunzipSync(raw).toString(), plain); assert.ok(raw.length < plain.length / 2, 'compression is worthwhile');
    const layout = await fetch(`${app.base}/templates/official-standard.json`, { headers: { 'Accept-Encoding': 'gzip' } });
    assert.equal(layout.headers.get('content-type'), 'application/json'); assert.equal(layout.headers.get('content-encoding'), 'gzip');
    assert.equal((await fetch(`${app.base}/templates/official-standard.json`, { headers: { 'If-None-Match': layout.headers.get('etag')! } })).status, 304);
    for (const path of ['/templates/../package.json', '/templates/%2e%2e%2fpackage.json', '/templates/catalog.json', '/src/server.ts', '/test/ui.test.ts', '/node_modules/pdf-lib/package.json', '/pdf/..%2fserver.js'])
      assert.ok([404].includes((await fetch(app.base + path)).status), path);
  } finally { await app.close(); }
});
