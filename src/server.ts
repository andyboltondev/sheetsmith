import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createDndBeyondImporter } from './importers/dndbeyond/index.ts';
import { normalise } from './importers/dndbeyond/parser.ts';
import { fetchPortrait, portraitUrl } from './importers/dndbeyond/portrait.ts';
const root = new URL('../', import.meta.url);
const assets: Record<string, [string, string]> = {
  '/': ['public/index.html', 'text/html'], '/app.js': ['public/app.js', 'text/javascript'], '/style.css': ['public/style.css', 'text/css'],
  '/pdf/generator.js': ['src/pdf/generator.js', 'text/javascript'], '/pdf/template.js': ['src/pdf/template.js', 'text/javascript'],
  '/pdf-lib.js': ['node_modules/pdf-lib/dist/pdf-lib.esm.js', 'text/javascript'],
};
export function createApp(importer = createDndBeyondImporter()) {
  let active = 0;
  let requests: number[] = [];
  return createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data: https://*.dndbeyond.com; connect-src 'self' https://*.dndbeyond.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    const send = (status: number, data: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
    const host = req.headers.host ?? '';
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) return send(403, { error: 'Unrecognized local host.' });
    const path = new URL(req.url ?? '/', `http://${host}`).pathname;
    try {
      if (path === '/api/import' && req.method === 'POST') {
        if (req.headers.origin && req.headers.origin !== `http://${host}`) return send(403, { error: 'Import must be requested from this app.' });
        if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'Expected a JSON request.' });
        requests = requests.filter(time => Date.now() - time < 60_000);
        if (active >= 3 || requests.length >= 20) return send(429, { error: 'Too many imports. Please wait a minute and try again.' });
        requests.push(Date.now());
        let body = ''; for await (const chunk of req) { body += chunk.toString(); if (body.length > 4096) return send(413, { error: 'Import request is too large.' }); }
        let input: unknown; try { input = JSON.parse(body); } catch { return send(400, { error: 'Invalid import request.' }); }
        const url = typeof input === 'object' && input !== null && 'url' in input ? input.url : undefined;
        if (typeof url !== 'string' || !importer.canImport(url)) return send(400, { error: "We couldn't find a valid D&D Beyond character ID in this URL." });
        active++;
        try { return send(200, await importer.import(url)); }
        catch (error) { return send(502, { error: error instanceof Error ? error.message : 'Character import failed. Please try again.' }); }
        finally { active--; }
      }
      if (path === '/api/portrait' && req.method === 'GET') {
        if (req.headers['sec-fetch-site'] === 'cross-site') return send(403, { error: 'Portraits must be requested from this app.' });
        const input = new URL(req.url!, `http://${host}`).searchParams.get('url') ?? '';
        try { if (input.length > 2048) throw new Error();portraitUrl(input); } catch { return send(400, { error: 'Unsupported portrait URL.' }); }
        requests = requests.filter(time => Date.now() - time < 60_000);
        if (active >= 3 || requests.length >= 20) return send(429, { error: 'Please wait a minute before trying again.' });
        requests.push(Date.now());active++;
        try {
          const image = await fetchPortrait(input);
          res.writeHead(200, { 'Content-Type': image.type });res.end(image.bytes);return;
        } catch { return send(502, { error: 'Portrait could not be retrieved. Upload an image or select No portrait.' }); }
        finally { active--; }
      }
      if (req.method !== 'GET') return send(405, { error: 'Method not allowed.' });
      if (path === '/api/sample') return send(200, normalise(JSON.parse(await readFile(new URL('test/fixtures/martial.json', root), 'utf8'))));
      const asset = assets[path];
      if (!asset) return send(404, { error: 'Not found.' });
      const content = await readFile(new URL(asset[0], root));
      res.writeHead(200, { 'Content-Type': `${asset[1]}; charset=utf-8` }); res.end(content);
    } catch { send(500, { error: 'Something went wrong. Please try again.' }); }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 3000);
  createApp().listen(port, '127.0.0.1', () => console.log(`Character Sheet Studio is ready at http://localhost:${port}`));
}
