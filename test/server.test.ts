import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/server.ts';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
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
