import { test, mock, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import axe from 'axe-core';
import { normalise } from '../src/importers/dndbeyond/parser.ts';
import { openApp, closeAll, type Routes } from './helpers/browser.ts';
after(closeAll);
const read = async (path: string) => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const character = async () => normalise(await read('src/sample/martial.json'));
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
async function routes(extra: Routes = {}): Promise<Routes> {
  const [sample, catalog] = [await character(), await read('templates/catalog.json')];
  return { '/api/sample': () => json(sample), '/api/templates': () => json(catalog), ...extra };
}
const loadSample = async (app: Awaited<ReturnType<typeof openApp>>) => { app.$('sample-button').click(); await app.settle(20); };
const accessibility = async (app: Awaited<ReturnType<typeof openApp>>) => {
  app.window.eval(axe.source);
  const results = await app.window.axe.run(app.document, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
  return Array.from(results.violations, (v: any) => `${v.id}: ${v.nodes.map((n: any) => n.target.join(' ')).join(', ')}`);
};

test('the page has no automatic accessibility violations before and after a character is loaded', async () => {
  const app = await openApp(await routes());
  assert.deepEqual(await accessibility(app), [], 'empty page');
  await loadSample(app);
  assert.equal(app.$('character-section').hidden, false);
  assert.deepEqual(await accessibility(app), [], 'with a character and a preview');
});
test('loading the sample fills the review form and moves focus to the character', async () => {
  const app = await openApp(await routes());
  await loadSample(app);
  assert.equal(app.$('character-name').textContent, 'Mara Ashford');
  assert.match(app.$('character-summary').textContent!, /Human · Fighter 5 · Soldier/);
  assert.equal(app.document.querySelectorAll('.ability-card').length, 6);
  assert.equal((app.$('armour-class') as HTMLInputElement).value, '18');
  assert.equal(app.document.activeElement, app.$('character-name'));
  assert.equal(app.$('warnings-box').hidden, true, 'the box only appears when this character has real warnings');
  const options = [...(app.$('template') as HTMLSelectElement).options].map(o => o.textContent);
  assert.equal(options[0], 'SheetSmith — 5e');
  assert.deepEqual(options, ['SheetSmith — 5e', 'Official Standard — 5e (add official PDFs)', 'Official Alternative — 5e (add official PDFs)'], 'no class sheets; official styles say they need the user’s PDFs');
  assert.equal((app.$('template') as HTMLSelectElement).value, 'compact');
});
test('import sends a completed link, shows a failure clearly and does not keep the previous character', async () => {
  let body = ''; let respond = () => json({ error: 'This character could not be retrieved.' }, 502);
  const app = await openApp(await routes({ '/api/import': init => { body = String(init?.body); return respond(); } }));
  await loadSample(app);
  (app.$('character-url') as HTMLInputElement).value = ' 171344792 ';
  app.$('import-button').click(); await app.settle(20);
  assert.equal(JSON.parse(body).url, 'https://www.dndbeyond.com/characters/171344792');
  assert.equal(app.$('error').textContent, 'This character could not be retrieved.');
  assert.equal(app.$('error').hidden, false);
  assert.equal(app.$('character-section').hidden, true, 'a failed import cannot export the wrong character');
  assert.equal(app.$('preview').hidden, true);
  respond = (() => json(character())) as any;
});
test('import ignores a second request while one is running', async () => {
  let count = 0; let release!: () => void;
  const app = await openApp(await routes({ '/api/import': () => { count++; return new Promise<Response>(resolve => { release = async () => resolve(json(await character())); }); } }));
  (app.$('character-url') as HTMLInputElement).value = '1';
  app.$('import-button').click(); await app.settle(5);
  app.$('import-button').click(); await app.settle(5);
  assert.equal(count, 1);
  assert.equal(app.$('import-form').getAttribute('aria-busy'), 'true');
  release(); await app.settle(20);
  assert.equal(app.$('import-form').getAttribute('aria-busy'), 'false');
});
test('previewing sends the chosen options and catalogue to the worker and shows the finished sheet', async () => {
  const app = await openApp(await routes());
  await loadSample(app);
  (app.$('player-name') as HTMLInputElement).value = ' Andy ';
  (app.$('ability-order') as HTMLSelectElement).value = 'modifier-first';
  (app.$('equipment-weight') as HTMLInputElement).checked = false;
  app.$('generate-button').click(); await app.settle(20);
  const [worker] = app.workers; assert.equal(app.workers.length, 1);
  assert.equal(worker.url, '/pdf-worker.js');
  assert.deepEqual({ ...worker.message.options, catalog: undefined, portrait: undefined }, { playerName: 'Andy', templateId: 'compact', abilityOrder: 'modifier-first', equipmentWeight: false, pageNumbers: true, catalog: undefined, portrait: undefined });
  assert.ok(worker.message.options.catalog.some((t: { id: string }) => t.id === 'official-standard'), 'the worker needs no second catalogue request');
  assert.equal(app.calls.filter(c => c.path === '/api/templates').length, 1);
  assert.equal(app.$('preview').hidden, true, 'nothing is shown until the PDF exists');
  worker.finish(); await app.settle(20);
  assert.equal(app.$('preview').hidden, false);
  assert.equal(worker.stopped, true);
  assert.match(app.$('export-status').textContent!, /Preview ready/);
  assert.equal(app.$('download-link').getAttribute('download'), 'Mara-Ashford-sheet.pdf');
  assert.match(app.$('download-link').getAttribute('href')!, /^blob:/);
  assert.match((app.$('preview-frame') as HTMLIFrameElement).src, /^blob:.*#view=FitH$/);
});
test('browsers without a PDF viewer get the download without an embedded preview', async () => {
  const app = await openApp(await routes(), { pdfViewer: false });
  await loadSample(app); app.$('generate-button').click(); await app.settle(20); app.workers[0].finish(); await app.settle(20);
  assert.equal(app.$('preview-frame').hidden, true);
  assert.equal(app.$('preview').hidden, false);
  assert.match(app.$('export-status').textContent!, /Your sheet is ready/);
});
test('worker failures are reported, announced and leave no stale preview', async () => {
  const app = await openApp(await routes());
  await loadSample(app); app.$('generate-button').click(); await app.settle(20);
  app.workers[0].fail('The selected template could not be loaded. Please try again.'); await app.settle(20);
  assert.equal(app.$('export-error').textContent, 'The selected template could not be loaded. Please try again.');
  assert.equal(app.$('export-error').getAttribute('role'), 'alert');
  assert.equal(app.$('preview').hidden, true);
  assert.equal(app.$('generate-form').getAttribute('aria-busy'), 'false', 'the user can try again');
});
test('cancelling an export stops the worker and re-enables the form', async () => {
  const app = await openApp(await routes());
  await loadSample(app); app.$('generate-button').click(); await app.settle(20);
  assert.equal(app.$('cancel-export').hidden, false);
  app.$('cancel-export').click(); await app.settle(20);
  assert.equal(app.workers[0].stopped, true);
  assert.equal(app.$('cancel-export').hidden, true);
  assert.equal(app.$('export-error').hidden, true, 'a cancellation is not an error');
  assert.equal(app.$('generate-form').getAttribute('aria-busy'), 'false');
});
test('option changes refresh an existing preview once, after the last edit, and ignore stale results', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const app = await openApp(await routes());
    await loadSample(app);
    const order = app.$('ability-order') as HTMLSelectElement, change = (value: string) => { order.value = value; order.dispatchEvent(new app.window.Event('change', { bubbles: true })); };
    change('modifier-first');
    mock.timers.tick(1000);
    assert.equal(app.workers.length, 0, 'no preview yet, so nothing refreshes by itself');
    app.$('generate-button').click(); await app.flush();
    app.workers[0].finish(); await app.flush();
    assert.equal(app.$('preview').hidden, false);
    // Three quick edits become one refresh.
    for (const value of ['score-first', 'modifier-first', 'score-first']) { change(value); mock.timers.tick(300); await app.flush(); }
    assert.equal(app.workers.length, 1, 'still waiting for the last edit');
    mock.timers.tick(600); await app.flush();
    assert.equal(app.workers.length, 2);
    assert.equal(app.workers[1].message.options.abilityOrder, 'score-first');
    assert.match(app.$('export-status').textContent!, /Updating preview/);
  } finally { mock.timers.reset(); }
});
test('Max HP overrides keep the recorded damage; blanked options reach the sheet', async () => {
  const hurt = await character(); hurt.combat.currentHP = 40;
  const app = await openApp(await routes({ '/api/sample': () => json(hurt) }));
  await loadSample(app);
  const damage = 44 - 40;
  (app.$('max-hp') as HTMLInputElement).value = '60';
  app.$('generate-button').click(); await app.settle(20);
  assert.equal(app.workers[0].message.character.combat.maxHP, 60);
  assert.equal(app.workers[0].message.character.combat.currentHP, 60 - damage);
  app.workers[0].finish(); await app.settle(20);
  (app.$('blank-hp') as HTMLInputElement).checked = true; (app.$('blank-coins') as HTMLInputElement).checked = true;
  (app.$('generate-form') as HTMLFormElement).dispatchEvent(new app.window.Event('submit', { cancelable: true }));
  await app.settle(20);
  const sent = app.workers.at(-1)!.message.character;
  assert.equal(sent.combat.currentHP, null);
  assert.ok(Object.values(sent.coins).every(v => v === null));
  assert.match(app.$('blank-hp-note').textContent!, /Currently/);
});
test('sheet choices and the theme are remembered on this device only', async () => {
  const first = await openApp(await routes());
  await loadSample(first);
  const set = (id: string, value: string) => { const el = first.$(id) as HTMLSelectElement; el.value = value; el.dispatchEvent(new first.window.Event('change', { bubbles: true })); };
  set('template', 'official-alternative'); set('ability-order', 'modifier-first'); first.$('theme').click();
  (first.$('no-page-numbers') as HTMLInputElement).click();
  const stored = Object.fromEntries(Array.from({ length: first.window.localStorage.length }, (_, i) => { const key = first.window.localStorage.key(i)!; return [key, first.window.localStorage.getItem(key)!]; }));
  assert.ok(!Object.values(stored as Record<string, string>).some(v => /Mara|Ashford/.test(v)), 'no character data is stored');
  const second = await openApp(await routes(), { storage: stored });
  assert.equal((second.$('template') as HTMLSelectElement).value, 'official-alternative');
  assert.equal((second.$('ability-order') as HTMLSelectElement).value, 'modifier-first');
  assert.equal((second.$('no-page-numbers') as HTMLInputElement).checked, true);
  assert.equal(second.document.body.dataset.theme, 'dark');
  assert.equal(second.$('theme').getAttribute('aria-checked'), 'true');
});
test('a character with no portrait cannot select the D&D Beyond portrait, and a bad upload is refused before export', async () => {
  const noPortrait = await character(); noPortrait.identity.portrait = '';
  const app = await openApp(await routes({ '/api/sample': () => json(noPortrait) }));
  await loadSample(app);
  const mode = app.$('portrait-mode') as HTMLSelectElement;
  assert.equal(mode.value, 'none');
  assert.equal((mode.querySelector('[value="beyond"]') as HTMLOptionElement).disabled, true);
  mode.value = 'custom'; mode.dispatchEvent(new app.window.Event('change', { bubbles: true }));
  assert.equal(app.$('upload-wrap').hidden, false);
  app.$('generate-button').click(); await app.settle(20);
  assert.match(app.$('export-error').textContent!, /Choose a portrait image/);
  assert.equal(app.workers.length, 0);
});

test('prepared spells show their details, start unticked and stop at the class limit', async () => {
  const data = await character();
  const spell = (name: string, level: number) => ({ name, level, prepared: false, school: 'Evocation', casting: 'Action', range: '120 ft', summary: `${name} does something memorable.` });
  Object.assign(data, { classes: [{ name: 'Wizard', level: 1 }], abilities: { ...data.abilities, intelligence: { ...data.abilities.intelligence, modifier: 1 } },
    spellSlots: [{ level: 1, total: 2, used: null }], spellRows: [spell('Fire Bolt', 0), spell('Shield', 1), spell('Sleep', 1), spell('Thunderwave', 1), spell('Fireball', 3)] });
  const app = await openApp(await routes({ '/api/sample': () => json(data) }));
  await loadSample(app);
  assert.equal(app.$('prepared-section').hidden, false);
  const boxes = [...app.$('prepared-list').querySelectorAll('input')] as HTMLInputElement[];
  assert.equal(boxes.length, 4, 'cantrips get no choice');
  assert.equal(boxes[3].disabled, true, 'no 3rd-level slots, so Fireball cannot be prepared');
  assert.match(app.$('prepared-count-3').textContent!, /no slots at this level yet/);
  assert.ok(boxes.every(b => !b.checked), 'nothing is preselected');
  assert.match(app.$('prepared-list').textContent!, /Evocation · Action · 120 ft/);
  assert.match(app.$('prepared-list').textContent!, /Shield does something memorable/);
  assert.match(app.$('prepared-total').textContent!, /^0 of 2 prepared/);
  const tick = (box: HTMLInputElement) => { box.checked = true; box.dispatchEvent(new app.window.Event('change', { bubbles: true })); };
  tick(boxes[0]); tick(boxes[1]);
  assert.match(app.$('prepared-count-1').textContent!, /2 prepared · 2 slots/);
  assert.equal(boxes[2].disabled, true, 'the limit locks the rest');
  boxes[0].checked = false; boxes[0].dispatchEvent(new app.window.Event('change', { bubbles: true }));
  assert.equal(boxes[2].disabled, false);
  assert.equal(boxes[3].disabled, true, 'still locked once the total has room');
});
test('the master toggle ticks and clears every leave-blank option', async () => {
  const app = await openApp(await routes());
  await loadSample(app);
  const boxes = [...app.document.querySelectorAll('[data-blank]')] as HTMLInputElement[], all = app.$('blank-all') as HTMLInputElement;
  assert.equal(boxes.length, 8);
  const set = (box: HTMLInputElement, on: boolean) => { box.checked = on; box.dispatchEvent(new app.window.Event('change', { bubbles: true })); };
  set(all, true);
  assert.ok(boxes.every(b => b.checked));
  set(boxes[0], false);
  assert.equal(all.checked, false); assert.equal(all.indeterminate, true);
  set(all, false);
  assert.ok(boxes.every(b => !b.checked));
});

// Stands in for the checksum: a fake "download" is %PDF- plus a source id, and hashes to that source's pinned value.
async function withFakeChecksums(app: Awaited<ReturnType<typeof openApp>>) {
  // @ts-expect-error Browser module
  const { OFFICIAL_SOURCES } = await import('../src/pdf/official.js');
  Object.defineProperty(app.window, 'crypto', { configurable: true, value: { subtle: { digest: async (_: string, data: Uint8Array) => {
    const id = new TextDecoder().decode(data).slice(5), source = OFFICIAL_SOURCES.find((s: { id: string }) => s.id === id);
    return Uint8Array.from((source?.sha256 ?? '00').match(/../g)!, (h: string) => parseInt(h, 16)).buffer;
  } } } });
  const pdf = (text: string, name = `${text}.pdf`) => new app.window.File([new TextEncoder().encode(`%PDF-${text}`)], name, { type: 'application/pdf' });
  const upload = async (...files: File[]) => { const input = app.$('official-upload') as HTMLInputElement; Object.defineProperty(input, 'files', { configurable: true, value: files }); input.dispatchEvent(new app.window.Event('change', { bubbles: true })); await app.settle(20); };
  return { pdf, upload };
}
test('an official style cannot be exported until its PDFs are added, and the panel explains what is needed', async () => {
  const app = await openApp(await routes());
  await loadSample(app);
  assert.match((app.$('official-link') as HTMLAnchorElement).href, /^https:\/\/www\.dndbeyond\.com\//);
  assert.match((app.$('official-zip') as HTMLAnchorElement).href, /5e_charactersheets\.zip$/);
  assert.equal(app.$('official-sources').children.length, 4);
  const setup = app.$('official-setup') as HTMLDetailsElement, select = app.$('template') as HTMLSelectElement;
  assert.equal(setup.hidden, true, 'the guide stays hidden for SheetSmith');
  select.value = 'official-standard'; select.dispatchEvent(new app.window.Event('change', { bubbles: true }));
  assert.equal(setup.hidden, false); assert.equal(setup.open, true, 'opens while PDFs are missing');
  select.value = 'compact'; select.dispatchEvent(new app.window.Event('change', { bubbles: true }));
  assert.equal(setup.hidden, true);
  select.value = 'official-standard'; select.dispatchEvent(new app.window.Event('change', { bubbles: true }));
  app.$('generate-button').click(); await app.settle(20);
  assert.equal(app.workers.length, 0, 'nothing is started without the PDFs');
  assert.match(app.$('export-error').textContent!, /Add the official sheet PDFs first.*Character Sheet.*Character Details.*Spellcasting Sheet/);
  assert.equal((app.$('official-setup') as HTMLDetailsElement).open, true);
});
test('only files whose checksum matches are accepted, and then the official style exports with them', async () => {
  const app = await openApp(await routes());
  await loadSample(app);
  const { pdf, upload } = await withFakeChecksums(app);
  await upload(pdf('imposter', 'my-edited-sheet.pdf'));
  assert.match(app.$('official-message').textContent!, /my-edited-sheet\.pdf: This is not one of the official form-fillable sheets \(the checksum does not match\)/);
  assert.equal(app.$('official-sources').querySelectorAll('.official-ready').length, 0);
  await upload(pdf('standard'), pdf('details'), pdf('spells'));
  assert.equal(app.$('official-sources').querySelectorAll('.official-ready').length, 3);
  assert.match(app.$('official-message').textContent!, /3 verified/);
  const options = [...(app.$('template') as HTMLSelectElement).options].map(o => o.textContent);
  assert.equal(options[1], 'Official Standard — 5e', 'standard is ready');
  assert.equal(options[2], 'Official Alternative — 5e (add official PDFs)', 'alternative still needs its own sheet');
  const select = app.$('template') as HTMLSelectElement; select.value = 'official-standard'; select.dispatchEvent(new app.window.Event('change', { bubbles: true }));
  app.$('generate-button').click(); await app.settle(20);
  assert.equal(app.workers.length, 1);
  assert.deepEqual(Object.keys(app.workers[0].message.options.officialFiles).sort(), ['details', 'spells', 'standard']);
  assert.equal(app.workers[0].message.options.templateId, 'official-standard');
  (app.$('official-clear') as HTMLButtonElement).click(); await app.settle(20);
  assert.equal(app.$('official-sources').querySelectorAll('.official-ready').length, 0);
  assert.equal((app.$('template') as HTMLSelectElement).options[1].textContent, 'Official Standard — 5e (add official PDFs)');
});

test('each level can hold no more prepared spells than its slots, even without a class total', async () => {
  const data = await character();
  const spell = (name: string, level: number) => ({ name, level, prepared: false, school: 'Evocation', casting: 'Action', range: '60 ft', summary: 'x' });
  Object.assign(data, { classes: [{ name: 'Fighter', level: 5, subclass: 'Eldritch Knight' }], spellSlots: [{ level: 1, total: 2, used: null }], spellRows: [spell('Shield', 1), spell('Sleep', 1), spell('Thunderwave', 1)] });
  const app = await openApp(await routes({ '/api/sample': () => json(data) }));
  await loadSample(app);
  const boxes = [...app.$('prepared-list').querySelectorAll('input')] as HTMLInputElement[];
  const tick = (box: HTMLInputElement, on = true) => { box.checked = on; box.dispatchEvent(new app.window.Event('change', { bubbles: true })); };
  tick(boxes[0]); assert.equal(boxes[2].disabled, false);
  tick(boxes[1]); assert.equal(boxes[2].disabled, true, 'two slots, two prepared');
  assert.equal(boxes[0].disabled, false, 'ticked boxes can always be cleared');
  tick(boxes[1], false); assert.equal(boxes[2].disabled, false);
});

test('the Digital and Printable presets set every leave-blank option, and a custom mix is described as custom', async () => {
  const app = await openApp(await routes());
  await loadSample(app);
  const digital = app.$('preset-digital') as HTMLInputElement, printable = app.$('preset-printable') as HTMLInputElement;
  const boxes = [...app.document.querySelectorAll('[data-blank]')] as HTMLInputElement[];
  const fire = (el: HTMLElement) => el.dispatchEvent(new app.window.Event('change', { bubbles: true }));
  assert.equal(digital.checked, true); assert.ok(boxes.every(b => !b.checked), 'pre-filled by default');
  assert.match(app.$('preset-note').textContent!, /Acrobat Reader.*Foxit.*PDF Expert.*Xodo/);
  assert.match(app.$('preset-note').textContent!, /Edit PDF.*break the formatting/);
  printable.checked = true; fire(printable);
  assert.ok(boxes.every(b => b.checked)); assert.equal((app.$('blank-quantities') as HTMLInputElement).checked, true);
  assert.match(app.$('preset-note').textContent!, /pencil it in/);
  boxes[0].checked = false; fire(boxes[0]);
  assert.equal(digital.checked || printable.checked, false); assert.match(app.$('preset-note').textContent!, /custom mix/);
  digital.checked = true; fire(digital);
  assert.ok(boxes.every(b => !b.checked)); assert.equal(digital.checked, true);
});
test('printable sends every blank to the sheet, including quantities, and page numbers default on', async () => {
  const app = await openApp(await routes());
  await loadSample(app);
  const printable = app.$('preset-printable') as HTMLInputElement; printable.checked = true; printable.dispatchEvent(new app.window.Event('change', { bubbles: true }));
  app.$('generate-button').click(); await app.settle(20);
  const { character, options } = app.workers[0].message;
  assert.equal(options.pageNumbers, true);
  assert.ok(character.inventoryRows.every((i: { quantity: number | null }) => i.quantity === null));
  assert.equal(character.blanked.quantities, true);
});
