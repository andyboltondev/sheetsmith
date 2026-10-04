import { resolveTemplate } from '/pdf/selection.js';
import { createPdfJob } from '/pdf-job.js';
import { blankForPlay, playReminders } from '/pdf/fresh.js';
const $ = id => document.getElementById(id);
let character = null;
let busy = false;
let avatarUrl = null;
let downloadUrl = null;
let pdfJob = null;
const showError = (id, message = '') => { $(id).textContent = message; $(id).hidden = !message; };
// Remember the appearance choice on this device only; storage may be unavailable.
const applyTheme = value => { document.body.dataset.theme = value; $('theme').value = value; };
try { const saved = localStorage.getItem('theme'); if (['system','light','dark'].includes(saved)) applyTheme(saved); } catch {}
$('theme').addEventListener('change', event => { applyTheme(event.target.value); try { localStorage.setItem('theme', event.target.value); } catch {} });
function setBusy(value) {
  busy = value;
  for (const id of ['import-button','sample-button','generate-button']) $(id).setAttribute('aria-disabled', String(value));
  $('import-form').setAttribute('aria-busy', String(value));
  $('generate-form').setAttribute('aria-busy', String(value));
}
async function loadCharacter(sample = false) {
  if (busy) return;
  setBusy(true);showError('error');showError('export-error');$('status').textContent = sample ? 'Opening a sample character…' : 'Fetching your character…';
  // Clear the previous import so a failed request cannot export the wrong character.
  character = null;$('character-section').hidden = true;$('download-link').hidden=true;if(downloadUrl){URL.revokeObjectURL(downloadUrl);downloadUrl=null;}
  try {
    const response = await fetch(sample ? '/api/sample' : '/api/import', sample ? {} : { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:$('character-url').value}) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? 'Character import failed.');
    character = data;
    $('character-name').textContent = data.identity.name;
    $('character-summary').textContent = [data.identity.species,data.classes.map(entry => `${entry.name} ${entry.level}`).join(' / '),data.identity.background].filter(Boolean).join(' · ');
    $('source-label').textContent = sample ? 'SAMPLE CHARACTER' : 'CHARACTER IMPORTED';
    renderAbilities();
    await loadTemplates();
    $('warnings').replaceChildren(...data.warnings.map(warning => { const li = document.createElement('li');li.textContent = warning;return li; }));
    $('player-name').value = '';$('portrait-file').value = '';
    const portrait = safePortrait(data.identity.portrait);
    $('portrait-mode').querySelector('[value="beyond"]').disabled = !portrait;
    $('portrait-mode').value = portrait ? 'beyond' : 'none';
    $('upload-wrap').hidden = true;
    for (const [id,key] of [['armour-class','armourClass'],['max-hp','maxHP'],['speed','speed']]) $(id).value = data.combat[key] ?? '';
    const reminders = playReminders(data);for (const key of ['hp','coins','tracking']) $(`blank-${key}-note`).textContent = reminders[key];
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
async function portraitBytes() {
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
$('generate-form').addEventListener('submit', async event => {
  event.preventDefault();if (busy || !character) return;
  setBusy(true);showError('export-error');$('export-status').textContent = 'Preparing your character sheet…';
  try {
    const final = structuredClone(character);
    for (const [id,key] of [['armour-class','armourClass'],['max-hp','maxHP'],['speed','speed']]) final.combat[key] = $(id).value === '' ? null : Number($(id).value);
    // Keep the recorded damage when Max HP is overridden, so current HP never exceeds the new maximum.
    const { maxHP, currentHP } = character.combat;
    if (final.combat.maxHP !== maxHP) final.combat.currentHP = final.combat.maxHP !== null && maxHP != null && currentHP != null ? Math.max(0, final.combat.maxHP - (maxHP - currentHP)) : null;
    const blanks = {hp:$('blank-hp').checked,coins:$('blank-coins').checked,tracking:$('blank-tracking').checked};
    // Reminders reflect the values that would have been printed, including any Max HP override.
    const reminders = playReminders(final);
    const notes = Object.keys(blanks).filter(key => blanks[key]).map(key => reminders[key].replace(/^Currently:? /,'').replace(/\.$/,''));
    const printed = Object.values(blanks).some(Boolean) ? blankForPlay(final,blanks) : final;
    const templateId=$('template').value;
    const options = {playerName:$('player-name').value.trim(),templateId,abilityOrder:$('ability-order').value,equipmentWeight:$('equipment-weight').checked,equipmentQuantity:$('equipment-quantity').checked};
    const portrait = await portraitBytes();
    pdfJob = createPdfJob(printed,{...options,portrait});$('cancel-export').hidden=false;
    const result = await pdfJob.promise;
    if(downloadUrl)URL.revokeObjectURL(downloadUrl);
    downloadUrl=URL.createObjectURL(new Blob([result.bytes],{type:'application/pdf'}));
    const a=$('download-link');a.textContent=`Download ${final.identity.name}'s character sheet`;a.href=downloadUrl;a.download=`${final.identity.name.replace(/[^a-z0-9_-]/gi,'-').slice(0,70)||'character'}-sheet.pdf`;a.hidden=false;a.click();
    $('export-status').textContent = `Your editable sheet is ready. Check your downloads.${notes.length ? ' Left blank to fill in: ' + notes.join(' · ') + '.' : ''}${result.warnings.length ? ' ' + result.warnings.join(' ') : ''}`;
  } catch (error) { $('export-status').textContent = '';showError('export-error',error.message || 'Could not generate the PDF. Please try again.');$('export-error').focus(); }
  finally { pdfJob=null;$('cancel-export').hidden=true;setBusy(false); }
});

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
  const catalog=await response.json();
  const previous=$('template').value;
  const entries=catalog.filter(t=>!t.characterClass&&!t.resource);
  let match;try{match=resolveTemplate(catalog,character,'class');}catch{}
  if(match)entries.push({id:'class',name:`Class Sheet — ${match.name.replace(/ — 5e$/,'').replace(/ Class Sheet$/,'')} — 5e`});
  entries.unshift({id:'compact',name:'SheetSmith — 5e'});
  $('template').replaceChildren(...entries.map(t=>{const option=document.createElement('option');option.value=t.id;option.textContent=t.name;return option;}));
  $('template').value=entries.some(t=>t.id===previous)?previous:'compact';
  $('template-description').textContent='5e (2014). '+(match?'Class sheets automatically match your class and available subclass variant.':'No matching single-class sheet is available; use Official or SheetSmith.')+' Each style stays consistent across its pages.';
}
$('ability-order').addEventListener('change',()=>{renderAbilities();$('position-status').textContent=$('ability-order').selectedOptions[0].textContent;});
$('cancel-export').addEventListener('click',()=>pdfJob?.cancel());
window.addEventListener('pagehide',()=>{pdfJob?.cancel();if(downloadUrl)URL.revokeObjectURL(downloadUrl);if(avatarUrl)URL.revokeObjectURL(avatarUrl);});
// Native validation retains browser-specific guidance; expose errors to assistive technology too.
for(const formId of ['import-form','generate-form']){
  $(formId).addEventListener('invalid',event=>{event.target.setAttribute('aria-invalid','true');},true);
  $(formId).addEventListener('input',event=>{if(event.target.validity?.valid)event.target.removeAttribute('aria-invalid');});
}
