import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createDndBeyondImporter } from './importers/dndbeyond/index.ts';
import { normalise } from './importers/dndbeyond/parser.ts';
import { fetchPortrait, portraitUrl } from './importers/dndbeyond/portrait.ts';
const root = new URL('../', import.meta.url);
// Browser-facing PDF modules are any plain `src/pdf/<name>.js`, so a new module needs no registration here.
const pdfModule = /^\/pdf\/([a-z][a-z-]*)\.js$/;
const assets: Record<string, [string, string]> = {
  '/': ['public/index.html', 'text/html'], '/app.js': ['public/app.js', 'text/javascript'], '/style.css': ['public/style.css', 'text/css'],
  '/pdf-job.js': ['public/pdf-job.js', 'text/javascript'],
  '/character-url.js': ['public/character-url.js', 'text/javascript'],
  '/official.js': ['public/official.js', 'text/javascript'],
  '/pdf-worker.js': ['public/pdf-worker.js', 'text/javascript'],
  '/pdf-lib.js': ['node_modules/pdf-lib/dist/pdf-lib.esm.min.js', 'text/javascript'],
};
// Static files are hashed and compressed once per version on disk, not on every request.
type Cached = { version: string; content: Buffer; etag: string; gzip?: Buffer };
const fileCache = new Map<string, Cached>();
const catalogs = new Map<string, unknown>();
// The template catalogue is read through the same validated cache and parsed once per version.
async function catalog<T>(): Promise<T> {
  const file = await cachedFile('templates/catalog.json');
  if (!catalogs.has(file.etag)) { catalogs.clear(); catalogs.set(file.etag, JSON.parse(file.content.toString('utf8'))); }
  return catalogs.get(file.etag) as T;
}
async function cachedFile(path: string): Promise<Cached> {
  const url = new URL(path, root), info = await stat(url), version = `${info.mtimeMs}:${info.size}`;
  const hit = fileCache.get(path);
  if (hit?.version === version) return hit;
  const content = await readFile(url);
  const entry = { version, content, etag: `W/"${createHash('sha256').update(content).digest('hex')}"` };
  fileCache.set(path, entry);
  return entry;
}
// A sliding window per route, so portrait previews cannot use up the import allowance.
export const limiter = (limit: number) => {
  let times: number[] = [];
  return () => { const now = Date.now(); times = times.filter(time => now - time < 60_000); if (times.length >= limit) return false; times.push(now); return true; };
};
export function createApp(importer = createDndBeyondImporter()) {
  let active = 0;
  const importAllowed = limiter(20), portraitAllowed = limiter(40);
  return createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data: https://*.dndbeyond.com; connect-src 'self' https://*.dndbeyond.com; worker-src 'self'; frame-src blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    const send = (status: number, data: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
    const sendAsset = (file: Cached, type: string) => {
      // Cache public application resources, never imported character data or portraits.
      const { etag } = file;
      res.setHeader('Cache-Control','public, max-age=0, must-revalidate');
      res.setHeader('ETag',etag);res.setHeader('Vary','Accept-Encoding');
      if(req.headers['if-none-match']===etag){res.writeHead(304);res.end();return;}
      res.setHeader('Content-Type',type);
      let body=file.content;
      if(type!=='application/pdf' && body.length>1024 && (req.headers['accept-encoding']??'').split(',').some(part=>{const [coding,...params]=part.trim().split(';');return coding==='gzip' && !params.some(p=>/^\s*q\s*=\s*0(?:\.0*)?\s*$/.test(p));})){
        res.setHeader('Content-Encoding','gzip');body=file.gzip??=gzipSync(body);
      }
      res.writeHead(200);res.end(body);
    };
    const host = req.headers.host ?? '';
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) return send(403, { error: 'Unrecognized local host.' });
    const path = new URL(req.url ?? '/', `http://${host}`).pathname;
    try {
      if (path === '/api/import' && req.method === 'POST') {
        if (req.headers.origin && req.headers.origin !== `http://${host}`) return send(403, { error: 'Import must be requested from this app.' });
        if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'Expected a JSON request.' });
        if (active >= 3 || !importAllowed()) return send(429, { error: 'Too many imports. Please wait a minute and try again.' });
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
        if (active >= 3 || !portraitAllowed()) return send(429, { error: 'Please wait a minute before trying again.' });
        active++;
        try {
          const image = await fetchPortrait(input);
          res.writeHead(200, { 'Content-Type': image.type });res.end(image.bytes);return;
        } catch { return send(502, { error: 'Portrait could not be retrieved. Upload an image or select No portrait.' }); }
        finally { active--; }
      }
      if (req.method !== 'GET') return send(405, { error: 'Method not allowed.' });
      if (path === '/api/sample') return send(200, normalise(JSON.parse(await readFile(new URL('src/sample/martial.json', root), 'utf8'))));
      if (path === '/api/templates') return send(200, await catalog());
      if (path.startsWith('/templates/')) {
        // Only field layouts are served. The official PDFs belong to Wizards of the Coast and come from the user's own files.
        const filename=path.slice('/templates/'.length);
        const entry=(await catalog<{id:string}[]>()).find(t=>filename===`${t.id}.json`);
        if (!entry) return send(404,{error:'Template not found.'});
        sendAsset(await cachedFile(`templates/${filename}`),'application/json');return;
      }
      const module = pdfModule.exec(path);
      const asset = module ? [`src/pdf/${module[1]}.js`, 'text/javascript'] : assets[path];
      if (!asset) return send(404, { error: 'Not found.' });
      sendAsset(await cachedFile(asset[0]),`${asset[1]}; charset=utf-8`);
    } catch (error) { send((error as NodeJS.ErrnoException)?.code === 'ENOENT' ? 404 : 500, { error: (error as NodeJS.ErrnoException)?.code === 'ENOENT' ? 'Not found.' : 'Something went wrong. Please try again.' }); }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 3000);
  createApp().listen(port, '127.0.0.1', () => console.log(`SheetSmith is ready at http://localhost:${port}`));
}
