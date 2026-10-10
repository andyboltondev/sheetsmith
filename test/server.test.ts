import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/server.ts';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
test('scripts and styles are served under a versioned URL that is cached for a year, and stale versions are not served', async () => {
  const server = createApp();server.listen(0,'127.0.0.1');await once(server,'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const page = await (await fetch(base)).text();
    const build = /\/v\/([^/"]+)\/app\.js/.exec(page)?.[1];
    assert.ok(build, 'the page loads app.js from a versioned URL'); assert.ok(page.includes(`/v/${build}/style.css`)); assert.ok(!page.includes('{{'));
    const script = await fetch(`${base}/v/${build}/app.js`), body = await script.text();
    assert.equal(script.headers.get('cache-control'), 'public, max-age=31536000, immutable');
    assert.ok(body.includes(`from '/v/${build}/pdf/selection.js'`), 'imports point at the same build');
    assert.ok((await (await fetch(`${base}/v/${build}/pdf-job.js`)).text()).includes(`WorkerClass('/v/${build}/pdf-worker.js'`));
    assert.equal((await fetch(`${base}/v/${build}/pdf/generator.js`)).status, 200);
    for (const path of [`/v/stale/app.js`, `/v/${build}/api/sample`, `/v/${build}/favicon.svg`, `/v/${build}/pdf/nope.js`]) assert.equal((await fetch(base + path)).status, 404, path);
    assert.match((await fetch(`${base}/`)).headers.get('cache-control') ?? '', /must-revalidate/, 'the page itself is always revalidated');
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
test('HTTP server serves the app and sample, rejects invalid input and foreign origins', async () => {
  const server = createApp();server.listen(0,'127.0.0.1');await once(server,'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    assert.equal((await fetch(base)).status,200);
    const script=await fetch(`${base}/app.js`);const body=await script.text();assert.ok(!body.includes("from '/pdf-lib.js'"));
    assert.match(script.headers.get('cache-control')??'',/must-revalidate/);
    const cached=await fetch(`${base}/app.js`,{headers:{'If-None-Match':script.headers.get('etag')!}});assert.equal(cached.status,304);
    const noGzip=await fetch(`${base}/app.js`,{headers:{'Accept-Encoding':'gzip;q=0'}});assert.equal(noGzip.headers.get('content-encoding'),null);
    assert.equal((await fetch(`${base}/pdf-worker.js`)).status,200);
    assert.equal((await fetch(`${base}/pdf-job.js`)).status,200);
    const catalog=await (await fetch(`${base}/api/templates`)).json();assert.equal(catalog[0].id,'official-standard');assert.ok(catalog.every((t:{edition:string})=>t.edition==='5e'));
    // Wizards' PDFs are never served: only field layouts are.
    for(const id of ['official-standard','official-alternative','official-spells'])assert.equal((await fetch(`${base}/templates/${id}.pdf`)).status,404,id);
    assert.equal((await fetch(`${base}/templates/class-fighter.json`)).status,404);
    assert.equal((await fetch(`${base}/official.js`)).status,200);assert.equal((await fetch(`${base}/pdf/official.js`)).status,200);
    assert.equal((await fetch(`${base}/templates/official-standard.json`)).status,200);
    assert.equal((await fetch(`${base}/templates/not-real.pdf`)).status,404);
    const sample = await fetch(`${base}/api/sample`);assert.equal(sample.headers.get('cache-control'),'no-store');assert.equal((await sample.json()).identity.name,'Mara Ashford');
    const post = (body: unknown, origin?: string) => fetch(`${base}/api/import`, { method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify(body) });
    assert.equal((await post({url:'https://example.com/characters/1'})).status,400);
    assert.equal((await post({url:'https://www.dndbeyond.com/characters/1'},'https://evil.test')).status,403);
    assert.equal((await fetch(`${base}/package.json`)).status,404);
  } finally { server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve())); }
});
