import { resolveTemplate } from '/pdf/selection.js';
import { createPdfJob } from '/pdf-job.js';
import { blankForPlay, playReminders } from '/pdf/fresh.js';
import { preparedLimit, preparable } from '/pdf/prepared.js';
import { ordinal } from '/pdf/format.js';
import { characterUrl } from '/character-url.js';
import { OFFICIAL_PAGE, OFFICIAL_ARCHIVE } from '/pdf/official.js';
import * as official from '/official.js';
const $ = id => document.getElementById(id);
let character = null;
let busy = false;
let avatarUrl = null;
let downloadUrl = null;
let pdfJob = null;
let catalog = null;
let runId = 0;
let refreshTimer = 0;
let previewReady = false;
const showError = (id, message = '') => { $(id).textContent = message; $(id).hidden = !message; };
// Remember the appearance choice on this device only; storage may be unavailable.
const systemDark = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : { matches: false, addEventListener() {} };
const applyTheme = value => { document.body.dataset.theme = value; $('theme').setAttribute('aria-checked', String(value === 'dark' || (value === 'system' && systemDark.matches))); };
applyTheme('system');
try { const saved = localStorage.getItem('theme'); if (['light','dark'].includes(saved)) applyTheme(saved); } catch {}
systemDark.addEventListener('change', () => { if (document.body.dataset.theme === 'system') applyTheme('system'); });
// Everything that can be left blank, in the order shown; the master toggle ticks or clears them together.
const BLANKS = ['hp','coins','advancement','proficiencies','equipment','spells','quantities','tracking'];
// Sheet choices are remembered on this device too; never character data.
const PREFS = 'sheetsmith-prefs';
const savePrefs = () => { try { localStorage.setItem(PREFS, JSON.stringify({ template: $('template').value, abilityOrder: $('ability-order').value, weight: $('equipment-weight').checked, noPageNumbers: $('no-page-numbers').checked })); } catch {} };
try {
  const saved = JSON.parse(localStorage.getItem(PREFS) ?? '{}');
  if (['score-first','modifier-first'].includes(saved.abilityOrder)) $('ability-order').value = saved.abilityOrder;
  if ([...$('template').options].some(o => o.value === saved.template)) $('template').value = saved.template;
  if (typeof saved.weight === 'boolean') $('equipment-weight').checked = saved.weight;
  if (typeof saved.noPageNumbers === 'boolean') $('no-page-numbers').checked = saved.noPageNumbers;
} catch {}
$('theme').addEventListener('click', event => { const next = event.currentTarget.getAttribute('aria-checked') === 'true' ? 'light' : 'dark'; applyTheme(next); try { localStorage.setItem('theme', next); } catch {} });
function setBusy(value) {
  busy = value;
  for (const id of ['import-button','sample-button','generate-button']) $(id).setAttribute('aria-disabled', String(value));
  $('import-form').setAttribute('aria-busy', String(value));
  $('generate-form').setAttribute('aria-busy', String(value));
}
function clearPreview() {
  clearTimeout(refreshTimer);runId++;pdfJob?.cancel();previewReady = false;
  $('preview').hidden = true;$('preview-frame').removeAttribute('src');
  if (downloadUrl) { URL.revokeObjectURL(downloadUrl);downloadUrl = null; }
}
// One tick box per levelled spell, grouped by level, with its details beside it. Nothing starts ticked. Classes that prepare
// from a list are held to their limit: once it is reached the remaining boxes lock until one is cleared.
const clip = (text, max) => text.length > max ? `${text.slice(0,max).replace(/\s+\S*$/,'')} …` : text;
function renderPrepared(data) {
  const list = $('prepared-list'), spells = preparable(data), limit = preparedLimit(data);
  list.replaceChildren();$('prepared-section').hidden = !spells.length;
  const levels = [...new Set(spells.map(spell => spell.level))].sort((a,b) => a - b);
  const update = () => {
    const boxes = [...list.querySelectorAll('input')], total = boxes.filter(box => box.checked).length;
    // Levels above the character's highest spell slot cannot be prepared. Only when the slot table is known (Pact Magic and unsupported multiclass leave it empty).
    const highest = Math.max(0, ...(data.spellSlots ?? []).filter(slot => slot.total > 0).map(slot => slot.level)), known = (data.spellSlots ?? []).length > 0;
    // A level can hold no more prepared spells than its slots, so the 3rd 1st-level spell stays locked with two slots.
    const slotsAt = level => (data.spellSlots ?? []).find(slot => slot.level === level)?.total ?? 0;
    const countAt = level => boxes.filter(box => box.checked && box.dataset.level === String(level)).length;
    for (const box of boxes) { const level = Number(box.dataset.level); box.disabled = !box.checked && (limit != null && total >= limit || known && countAt(level) >= slotsAt(level)); }
    for (const level of levels) {
      const count = boxes.filter(box => box.checked && box.dataset.level === String(level)).length, slots = data.spellSlots?.find(slot => slot.level === level)?.total;
      $(`prepared-count-${level}`).textContent = `${count} prepared${slots ? ` · ${slots} slot${slots === 1 ? '' : 's'}` : known && level > highest ? ' · no slots at this level yet' : ''}`;
    }
    $('prepared-total').textContent = limit == null ? `${total} spells prepared.` : `${total} of ${limit} prepared${total >= limit ? ' — limit reached' : ''}.`;
  };
  for (const level of levels) {
    const head = document.createElement('p');head.className = 'prepared-level';
    const title = document.createElement('span');title.textContent = `${ordinal(level)} level`;
    const count = document.createElement('span');count.id = `prepared-count-${level}`;count.className = 'hint';
    head.append(title,count);list.append(head);
    data.spellRows.forEach((spell, index) => {
      if (spell.level !== level) return;
      const label = document.createElement('label'), box = document.createElement('input'), text = document.createElement('span');
      label.className = 'check';box.type = 'checkbox';box.dataset.index = index;box.dataset.level = level;
      const name = document.createElement('span');name.className = 'check-title';name.textContent = spell.name;
      const meta = document.createElement('span');meta.className = 'hint';
      meta.textContent = [spell.school,spell.casting,spell.range,spell.damage,spell.concentration && 'Concentration',spell.ritual && 'Ritual',spell.duration].filter(Boolean).join(' · ');
      text.append(name,meta);
      if (spell.summary) { const summary = document.createElement('span');summary.className = 'hint';summary.textContent = clip(spell.summary,200);text.append(summary); }
      label.append(box,text);list.append(label);
    });
  }
  list.onchange = update;update();
}
// The master toggle ticks or clears every "leave blank" option; it shows a mixed state when only some are ticked.
// Two presets drive the "leave blank" options: a pre-filled digital sheet, or a printable one with everything that changes left empty.
const PRESET_NOTES = {
  digital: 'Edit or fill in any field with Adobe Acrobat Reader (free), Foxit PDF Reader, PDF Expert (Mac, iPad) or Xodo (phone and tablet), which keep the layout intact. Use the form fields only: “Edit PDF” tools and Word conversion can break the formatting.',
  printable: 'Everything that changes during play (current HP, money, XP, slots used, item quantities, ticks) is left blank so you can pencil it in. Print at actual size, with no scaling.',
  custom: 'A custom mix of pre-filled and blank values.',
};
function syncPreset() {
  const ticked = BLANKS.filter(key => $(`blank-${key}`).checked).length, preset = ticked === 0 ? 'digital' : ticked === BLANKS.length ? 'printable' : 'custom';
  $('preset-digital').checked = preset === 'digital';$('preset-printable').checked = preset === 'printable';
  $('preset-note').textContent = PRESET_NOTES[preset];
}
function syncBlankAll() {
  const boxes = BLANKS.map(key => $(`blank-${key}`)), ticked = boxes.filter(box => box.checked).length;
  $('blank-all').checked = ticked === boxes.length;$('blank-all').indeterminate = ticked > 0 && ticked < boxes.length;
  syncPreset();
}
$('blank-all').addEventListener('change', () => { for (const key of BLANKS) $(`blank-${key}`).checked = $('blank-all').checked;syncBlankAll(); });
for (const key of BLANKS) $(`blank-${key}`).addEventListener('change', syncBlankAll);
for (const id of ['preset-digital','preset-printable']) $(id).addEventListener('change', () => { for (const key of BLANKS) $(`blank-${key}`).checked = id === 'preset-printable';syncBlankAll(); });
syncPreset();
async function loadCharacter(sample = false) {
  if (busy) return;
  setBusy(true);showError('error');showError('export-error');$('status').textContent = sample ? 'Opening a sample character…' : 'Fetching your character…';
  // Clear the previous import so a failed request cannot export the wrong character.
  character = null;$('character-section').hidden = true;clearPreview();
  try {
    const response = await fetch(sample ? '/api/sample' : '/api/import', sample ? {} : { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:characterUrl($('character-url').value)}) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? 'Character import failed.');
    character = data;
    $('character-name').textContent = data.identity.name;
    $('character-summary').textContent = [data.identity.species,data.classes.map(entry => `${entry.name} ${entry.level}`).join(' / '),data.identity.background].filter(Boolean).join(' · ');
    $('source-label').textContent = sample ? 'SAMPLE CHARACTER' : 'CHARACTER IMPORTED';
    renderAbilities();renderPrepared(data);
    await loadTemplates();
    $('warnings').replaceChildren(...data.warnings.map(warning => { const li = document.createElement('li');li.textContent = warning;return li; }));
    $('warnings-box').hidden = !data.warnings.length;
    $('warnings-summary').textContent = `Check these imported values (${data.warnings.length})`;
    $('player-name').value = '';$('portrait-file').value = '';
    const portrait = safePortrait(data.identity.portrait);
    $('portrait-mode').querySelector('[value="beyond"]').disabled = !portrait;
    $('portrait-mode').value = portrait ? 'beyond' : 'none';
    $('upload-wrap').hidden = true;
    for (const [id,key] of [['armour-class','armourClass'],['max-hp','maxHP'],['speed','speed']]) $(id).value = data.combat[key] ?? '';
    const reminders = playReminders(data);for (const key of BLANKS) $(`blank-${key}-note`).textContent = reminders[key];
    $('export-status').textContent = '';$('status').textContent = sample ? 'Sample character loaded. Make it yours below.' : 'Character imported. Review the details below.';
    $('character-section').hidden = false;updateAvatar();$('character-name').focus();
  } catch (error) { $('status').textContent = '';showError('error',error.message || 'Could not connect. Please try again.');$('error').focus(); }
  finally { setBusy(false); }
}
function safePortrait(value) {
  try { const url = new URL(value);return url.protocol === 'https:' && (url.hostname === 'www.dndbeyond.com' || url.hostname.endsWith('.dndbeyond.com')) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
function updateAvatar() {
  if (avatarUrl) { URL.revokeObjectURL(avatarUrl);avatarUrl = null; }
  $('avatar').textContent = '✧';
  const mode = $('portrait-mode').value;
  const file = $('portrait-file').files[0];
  const source = mode === 'beyond' ? (safePortrait(character?.identity.portrait) ? `/api/portrait?url=${encodeURIComponent(character.identity.portrait)}` : null) : mode === 'custom' && file ? (avatarUrl = URL.createObjectURL(file)) : null;
  if (source) { const img = new Image();img.alt = '';img.referrerPolicy = 'no-referrer';img.src = source;img.addEventListener('error', () => { $('avatar').textContent = '✧'; });$('avatar').replaceChildren(img); }
}
$('import-form').addEventListener('submit', event => { event.preventDefault();loadCharacter(); });
$('sample-button').addEventListener('click', () => loadCharacter(true));
$('portrait-mode').addEventListener('change', () => { $('upload-wrap').hidden = $('portrait-mode').value !== 'custom';updateAvatar(); });
$('portrait-file').addEventListener('change', () => {
  const file = $('portrait-file').files[0];
  showError('export-error');$('portrait-file').removeAttribute('aria-invalid');
  if (file && (file.size > 5_000_000 || !['image/png','image/jpeg','image/webp'].includes(file.type))) { showError('export-error','Choose a PNG, JPG or WebP image smaller than 5 MB.');$('portrait-file').value = '';$('portrait-file').setAttribute('aria-invalid','true'); }
  updateAvatar();
});
// Refreshing the preview reuses the prepared portrait rather than fetching and re-encoding it each time.
let portraitCache = null;
function portraitBytes() {
  const file = $('portrait-file').files[0], mode = $('portrait-mode').value;
  const key = [mode, mode === 'custom' ? [file?.name, file?.size, file?.lastModified].join(':') : '', character?.identity.portrait].join('|');
  if (portraitCache?.key !== key) { const promise = preparePortrait();portraitCache = { key, promise };promise.catch(() => { if (portraitCache?.promise === promise) portraitCache = null; }); }
  return portraitCache.promise;
}
async function preparePortrait() {
  const mode = $('portrait-mode').value;
  if (mode === 'none') return undefined;
  let blob;
  if (mode === 'custom') { blob = $('portrait-file').files[0];if (!blob) throw new Error('Choose a portrait image, or select No portrait.'); }
  else {
    const url = safePortrait(character.identity.portrait);
    if (!url) throw new Error('This character has no supported portrait. Upload an image or select No portrait.');
    try { const response = await fetch(`/api/portrait?url=${encodeURIComponent(url)}`,{signal:AbortSignal.timeout(15_000),credentials:'omit',redirect:'error'});if (!response.ok) throw new Error();blob = await response.blob(); }
    catch { throw new Error('The D&D Beyond portrait could not be downloaded. Upload an image or select No portrait.'); }
  }
  if (blob.size > 5_000_000) throw new Error('Choose a portrait image smaller than 5 MB.');
  let bitmap;
  try { bitmap = await createImageBitmap(blob); } catch { throw new Error('This image could not be opened. Please choose another PNG, JPG or WebP.'); }
  if (bitmap.width * bitmap.height > 40_000_000) { bitmap.close();throw new Error('This image is too large. Choose an image under 40 megapixels.'); }
  const scale = Math.min(1,1200/Math.max(bitmap.width,bitmap.height));
  const canvas = document.createElement('canvas');canvas.width = Math.max(1,Math.round(bitmap.width*scale));canvas.height = Math.max(1,Math.round(bitmap.height*scale));
  const context = canvas.getContext('2d');context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  // Photos travel as JPEG, several times smaller in the PDF than PNG; images with transparency stay PNG.
  const { data } = context.getImageData(0,0,canvas.width,canvas.height);
  let opaque = true;for (let i = 3; i < data.length; i += 4) if (data[i] < 255) { opaque = false;break; }
  const image = await new Promise(resolve => opaque ? canvas.toBlob(resolve,'image/jpeg',0.9) : canvas.toBlob(resolve,'image/png'));
  if (!image) throw new Error('Could not prepare your portrait. Please choose another image.');
  return new Uint8Array(await image.arrayBuffer());
}
// Builds the sheet from the current options and shows it. Runs on submit and, once a preview is showing, whenever options change.
async function buildSheet({ refresh = false } = {}) {
  if (!character) return;
  const run = ++runId;pdfJob?.cancel();
  if (!refresh) setBusy(true);
  showError('export-error');$('export-status').textContent = refresh ? 'Updating preview…' : 'Preparing your character sheet…';
  try {
    const final = structuredClone(character);
    for (const box of $('prepared-list').querySelectorAll('input')) final.spellRows[Number(box.dataset.index)].prepared = box.checked;
    if (!$('prepared-section').hidden) final.preparedChosen = true;
    for (const [id,key] of [['armour-class','armourClass'],['max-hp','maxHP'],['speed','speed']]) final.combat[key] = $(id).value === '' ? null : Number($(id).value);
    // Keep the recorded damage when Max HP is overridden, so current HP never exceeds the new maximum.
    const { maxHP, currentHP } = character.combat;
    if (final.combat.maxHP !== maxHP) final.combat.currentHP = final.combat.maxHP !== null && maxHP != null && currentHP != null ? Math.max(0, final.combat.maxHP - (maxHP - currentHP)) : null;
    const blanks = Object.fromEntries(BLANKS.map(key => [key,$(`blank-${key}`).checked]));
    // Reminders reflect the values that would have been printed, including any Max HP override.
    const reminders = playReminders(final);
    const notes = Object.keys(blanks).filter(key => blanks[key]).map(key => reminders[key].replace(/^Currently:? /,'').replace(/\.$/,''));
    const printed = Object.values(blanks).some(Boolean) ? blankForPlay(final,blanks) : final;
    const options = {playerName:$('player-name').value.trim(),templateId:$('template').value,abilityOrder:$('ability-order').value,equipmentWeight:$('equipment-weight').checked,pageNumbers:!$('no-page-numbers').checked,catalog,...($('template').value!=='compact'?{officialFiles:official.stored()}:{})};
    if ($('template').value !== 'compact' && !official.isReady($('template').value)) { $('official-setup').open = true; throw new Error(`Add the official sheet PDFs first: still needed — ${official.missingFor($('template').value).join(', ')}. See “Official sheets” below the sheet choice.`); }
    const portrait = await portraitBytes();
    if (run !== runId) return;
    const job = pdfJob = createPdfJob(printed,{...options,portrait});$('cancel-export').hidden = refresh;
    const result = await job.promise;
    if (run !== runId) return;
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = URL.createObjectURL(new Blob([result.bytes],{type:'application/pdf'}));
    const link = $('download-link');link.href = downloadUrl;
    link.download = `${final.identity.name.replace(/[^a-z0-9_-]/gi,'-').slice(0,70)||'character'}-sheet.pdf`;
    // Browsers without a built-in PDF viewer (most phones) get the download only.
    const inline = navigator.pdfViewerEnabled !== false;
    $('preview-frame').hidden = !inline;
    if (inline) $('preview-frame').src = `${downloadUrl}#view=FitH`;
    const first = !previewReady;previewReady = true;$('preview').hidden = false;
    if (first) $('preview').scrollIntoView({block:'nearest'});
    $('export-status').textContent = `${inline ? 'Preview ready' : 'Your sheet is ready'}. Use Download PDF when it looks right.${notes.length ? ' Left blank to fill in: ' + notes.join(' · ') + '.' : ''}${result.warnings.length ? ' ' + result.warnings.join(' ') : ''}`;
  } catch (error) {
    if (run !== runId) return;
    $('export-status').textContent = '';showError('export-error',error.message || 'Could not generate the PDF. Please try again.');if (!refresh) $('export-error').focus();
  } finally { if (run === runId) { pdfJob = null;$('cancel-export').hidden = true; } if (!refresh) setBusy(false); }
}
$('generate-form').addEventListener('submit', event => { event.preventDefault();if (!busy) buildSheet(); });
// Once a preview exists, option changes refresh it shortly after the last edit.
const scheduleRefresh = () => { if (!previewReady) return;clearTimeout(refreshTimer);refreshTimer = setTimeout(() => buildSheet({ refresh: true }),600); };
$('generate-form').addEventListener('input',scheduleRefresh);$('generate-form').addEventListener('change',scheduleRefresh);

function renderAbilities() {
  if(!character)return;
  const modifierFirst=$('ability-order').value==='modifier-first';
  $('ability-grid').replaceChildren(...Object.entries(character.abilities).map(([name,value])=>{
    const card=document.createElement('dl');card.className='ability-card';
    const label=document.createElement('dt');label.textContent=name[0].toUpperCase()+name.slice(1);card.append(label);
    const values=[['Score',String(value.score)],['Modifier',`${value.modifier>=0?'+':''}${value.modifier}`]];
    if(modifierFirst)values.reverse();
    for(const [kind,number] of values){
      const row=document.createElement('dd'),valueSpan=document.createElement('span'),kindSpan=document.createElement('span');
      valueSpan.className='ability-value';valueSpan.textContent=number;kindSpan.className='ability-kind';kindSpan.textContent=kind;row.append(valueSpan,kindSpan);card.append(row);
    }
    return card;
  }));
}
async function loadTemplates() {
  const response=await fetch('/api/templates');if(!response.ok)throw new Error('Could not load character sheet templates.');
  catalog=await response.json();
  renderTemplates();
}
// Official styles need the user's own copies of Wizards' PDFs; the list says which are ready.
function renderTemplates() {
  const previous=$('template').value;
  const entries=[{id:'compact',name:'SheetSmith — 5e'},...catalog.filter(t=>!t.resource)];
  $('template').replaceChildren(...entries.map(t=>{const option=document.createElement('option');option.value=t.id;option.textContent=t.id==='compact'||official.isReady(t.id)?t.name:`${t.name} (add official PDFs)`;return option;}));
  $('template').value=entries.some(t=>t.id===previous)?previous:'compact';
  syncOfficial();
  $('template-description').textContent='5e (2014). SheetSmith is built in. The Official styles use Wizards of the Coast’s own sheets, which you add once below. Each style stays consistent across its pages.';
}
// The download guide only appears for the Official styles; it opens by itself while their PDFs are still missing.
function syncOfficial() {
  const id=$('template').value,official_=id!=='compact';
  $('official-setup').hidden=!official_;
  if(official_&&!official.isReady(id))$('official-setup').open=true;
}
$('template').addEventListener('change',syncOfficial);
function renderOfficial(results=[]) {
  const done=new Set(Object.keys(official.stored()));
  $('official-sources').replaceChildren(...official.sources.map(source=>{const li=document.createElement('li'),ready=done.has(source.id);li.textContent=`${ready?'✓ Added':'Needed'}: ${source.file}`;li.className=ready?'official-ready':'';return li;}));
  const problems=results.filter(r=>r.error).map(r=>`${r.name}: ${r.error}`);
  $('official-message').textContent=problems.length?problems.join(' '):results.length?`Checked ${results.length} file${results.length===1?'':'s'}. ${results.length-problems.length} verified.`:'';
  $('official-message').classList.toggle('error-text',problems.length>0);
  $('official-clear').hidden=!done.size;
}
$('official-upload').addEventListener('change',async event=>{
  const results=await official.addFiles([...event.target.files]);event.target.value='';
  renderOfficial(results);if(catalog)renderTemplates();
});
$('official-clear').addEventListener('click',async()=>{await official.clear();renderOfficial();if(catalog)renderTemplates();$('official-message').textContent='Saved official sheets removed from this browser.';});
$('official-link').href=OFFICIAL_PAGE;$('official-zip').href=OFFICIAL_ARCHIVE;
official.restore().then(()=>{renderOfficial();if(catalog)renderTemplates();});
$('ability-order').addEventListener('change',()=>{renderAbilities();$('position-status').textContent=$('ability-order').selectedOptions[0].textContent;});
$('cancel-export').addEventListener('click',()=>{runId++;pdfJob?.cancel();pdfJob=null;$('cancel-export').hidden=true;$('export-status').textContent='Export cancelled.';setBusy(false);});
for(const id of ['template','ability-order','equipment-weight','no-page-numbers'])$(id).addEventListener('change',savePrefs);
window.addEventListener('pagehide',()=>{pdfJob?.cancel();if(downloadUrl)URL.revokeObjectURL(downloadUrl);if(avatarUrl)URL.revokeObjectURL(avatarUrl);});
// Native validation retains browser-specific guidance; expose errors to assistive technology too.
for(const formId of ['import-form','generate-form']){
  $(formId).addEventListener('invalid',event=>{event.target.setAttribute('aria-invalid','true');},true);
  $(formId).addEventListener('input',event=>{if(event.target.validity?.valid)event.target.removeAttribute('aria-invalid');});
}

document.getElementById("copyright-year").textContent=new Date().getFullYear();
