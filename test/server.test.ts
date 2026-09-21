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
    const sample = await fetch(`${base}/api/sample`);assert.equal((await sample.json()).identity.name,'Mara Ashford');
    const post = (body: unknown, origin?: string) => fetch(`${base}/api/import`, { method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify(body) });
    assert.equal((await post({url:'https://example.com/characters/1'})).status,400);
    assert.equal((await post({url:'https://www.dndbeyond.com/characters/1'},'https://evil.test')).status,403);
    assert.equal((await fetch(`${base}/package.json`)).status,404);
  } finally { server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve())); }
});
