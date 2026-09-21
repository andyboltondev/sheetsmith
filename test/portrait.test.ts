import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchPortrait, portraitUrl } from '../src/importers/dndbeyond/portrait.ts';
test('portrait URL rejects external destinations, credentials and non-HTTPS', () => {
  for (const value of ['http://www.dndbeyond.com/test.png','https://www.dndbeyond.com.evil.test/a','https://localhost/a','https://user@www.dndbeyond.com/a']) assert.throws(()=>portraitUrl(value));
});
test('portrait redirects cannot escape the domain allowlist', async () => {
  await assert.rejects(fetchPortrait('https://www.dndbeyond.com/a',async()=>new Response(null,{status:302,headers:{Location:'https://localhost/a'}})),/Unsupported/);
});
test('portrait fetch accepts images and rejects non-images and oversized bodies', async () => {
  const result = await fetchPortrait('https://www.dndbeyond.com/a',async()=>new Response('image',{headers:{'Content-Type':'image/png'}}));
  assert.equal(result.bytes.toString(),'image');
  await assert.rejects(fetchPortrait('https://www.dndbeyond.com/a',async()=>new Response('html',{headers:{'Content-Type':'text/html'}})),/unsupported/);
  await assert.rejects(fetchPortrait('https://www.dndbeyond.com/a',async()=>new Response(new Uint8Array(5_000_001),{headers:{'Content-Type':'image/png'}})),/5 MB/);
});
