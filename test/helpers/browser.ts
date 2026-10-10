import { readFile } from 'node:fs/promises';
import { JSDOM, VirtualConsole } from 'jsdom';
// Runs the real page (index.html + app.js and its modules) in jsdom. jsdom cannot load ES modules, so each module is
// wrapped as a function whose exports other modules receive in place of their import lines. Network and the PDF worker
// are supplied by the test; everything else is the shipped code.
const root = new URL('../../', import.meta.url);
// Captured before any test mocks timers, so waiting for the page's promises always works.
const realTimeout = globalThis.setTimeout;
const files: Record<string, string> = {
  '/app.js': 'public/app.js', '/pdf-job.js': 'public/pdf-job.js', '/character-url.js': 'public/character-url.js',
  '/pdf/selection.js': 'src/pdf/selection.js', '/pdf/official.js': 'src/pdf/official.js', '/official.js': 'public/official.js', '/pdf/fresh.js': 'src/pdf/fresh.js', '/pdf/prepared.js': 'src/pdf/prepared.js', '/pdf/format.js': 'src/pdf/format.js',
};
const resolve = (from: string, specifier: string) => specifier.startsWith('/') ? specifier : new URL(specifier, `http://x${from.slice(0, from.lastIndexOf('/') + 1)}`).pathname;
async function wrap(name: string): Promise<string> {
  let source = await readFile(new URL(files[name], root), 'utf8');
  const exported: string[] = [];
  source = source.replace(/^import\s+\*\s+as\s+([A-Za-z0-9_$]+)\s+from\s+'([^']+)';?/gm, (_, id: string, specifier: string) => `const ${id} = __modules[${JSON.stringify(resolve(name, specifier))}];`);
  source = source.replace(/^import\s+\{([^}]*)\}\s+from\s+'([^']+)';?/gm, (_, names: string, specifier: string) => `const {${names}} = __modules[${JSON.stringify(resolve(name, specifier))}];`);
  source = source.replace(/^export\s+(async\s+function|function|const)\s+([A-Za-z0-9_$]+)/gm, (_, kind: string, id: string) => { exported.push(id); return `${kind} ${id}`; });
  return `__modules[${JSON.stringify(name)}] = (() => {\n${source}\nreturn {${exported.join(',')}};\n})();`;
}
const opened: { close(): void }[] = [];
// Closing windows releases their timers so the test process can exit.
const timers: ReturnType<typeof setTimeout>[] = [];
export const closeAll = () => { for (const window of opened.splice(0)) window.close(); for (const timer of timers.splice(0)) clearTimeout(timer); };
export type FakeWorkerMessage = { character: any; options: any };
export class FakeWorker {
  static instances: FakeWorker[] = [];
  message!: FakeWorkerMessage; stopped = false; onmessage: any; onerror: any; onmessageerror: any;
  url: string; options: unknown;
  constructor(url: string, options: unknown) { this.url = url; this.options = options; FakeWorker.instances.push(this); }
  postMessage(message: FakeWorkerMessage) { this.message = message; }
  terminate() { this.stopped = true; }
  // The worker's reply, as the real one would send it.
  finish(result = { bytes: new Uint8Array([37, 80, 68, 70]), warnings: [] as string[] }) { this.onmessage({ data: { result } }); }
  fail(error: string) { this.onmessage({ data: { error } }); }
}
export type Routes = Record<string, (init?: RequestInit) => Response | Promise<Response>>;
export async function openApp(routes: Routes, { storage = {} as Record<string, string>, pdfViewer = true } = {}) {
  const html = (await readFile(new URL('public/index.html', root), 'utf8')).replace(/<script[^>]*><\/script>/, '');
  const dom = new JSDOM(html, { url: 'http://localhost:3000/', runScripts: 'outside-only', virtualConsole: new VirtualConsole() });
  const { window } = dom as any;
  opened.push(window);
  for (const [key, value] of Object.entries(storage)) window.localStorage.setItem(key, value);
  FakeWorker.instances = [];
  const calls: { path: string; init?: RequestInit }[] = [];
  Object.assign(window, {
    structuredClone, FakeWorker, Worker: FakeWorker,
    fetch: async (input: string, init?: RequestInit) => {
      const path = String(input).split('?')[0]; calls.push({ path, init });
      const route = routes[path]; if (!route) return new Response('{}', { status: 404 });
      return route(init);
    },
  });
  window.URL.createObjectURL = () => `blob:test/${Math.random().toString(16).slice(2)}`; window.URL.revokeObjectURL = () => {};
  Object.defineProperty(window.navigator, 'pdfViewerEnabled', { value: pdfViewer, configurable: true });
  window.Element.prototype.scrollIntoView = () => {}; window.HTMLElement.prototype.focus ??= () => {};
  window.setTimeout = (...args: Parameters<typeof setTimeout>) => { const timer = globalThis.setTimeout(...args); timers.push(timer); return timer; };
  window.clearTimeout = (timer: ReturnType<typeof setTimeout>) => globalThis.clearTimeout(timer);
  const order = ['/pdf/format.js', '/character-url.js', '/pdf/selection.js', '/pdf/official.js', '/official.js', '/pdf/fresh.js', '/pdf/prepared.js', '/pdf-job.js', '/app.js'];
  // Module bodies are async only through `await`, which the wrapper cannot hold, so the app is evaluated as one async script.
  const parts = await Promise.all(order.map(wrap));
  const loaded: Promise<void> = window.eval(`(async () => { const __modules = {}; ${parts.slice(0, -1).join('\n')}\n${parts.at(-1)!.replace(/^__modules\["\/app.js"\] = \(\(\) => \{/, '{').replace(/return \{\};\n\}\)\(\);$/, '}')} })()`);
  await loaded;
  const $ = (id: string) => window.document.getElementById(id);
  const settle = async (ms = 0) => { await new Promise(resolve => realTimeout(resolve, ms)); };
  // Lets already-resolved promises run without relying on timers, which a test may have mocked.
  const flush = async () => { for (let i = 0; i < 25; i++) await new Promise(resolve => setImmediate(resolve)); };
  return { dom, window, document: window.document as Document, $, calls, settle, flush, workers: FakeWorker.instances };
}
