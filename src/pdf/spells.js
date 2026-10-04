import { dotAppearance, loadPdf, signed, wrapText } from './generator.js';
const hidden = { borderWidth: 0, backgroundColor: undefined, borderColor: undefined };
const unique = list => [...new Set(list.filter(v => v != null && v !== ''))];
const checkBox = (PDFLib, fields, page, name, tooltip, [x, y, r, t], on) => {
 const width = r - x, height = t - y, check = fields.checkBox(name, tooltip);
 check.addToPage(page, { x, y, width, height, ...hidden });
 if (on) check.check();
 check.updateAppearances(() => dotAppearance(PDFLib, width, height));
};
// Class spell cards: twelve cards a page. Long effects continue on a following "(cont.)" card.
export async function appendClassSpells(PDFLib, doc, fields, font, spells, resource, clean, slots = []) {
 const effect = resource.layout.find(f => f.name === 'SpellSheet1_Spell Effect 01');
 const cards = [];
 const capacity = Math.floor((effect.rect[3] - effect.rect[1] - 10) / 7.2) - 1;
 for (const s of spells) {
  const lines = wrapText(clean([s.components.length > 22 ? 'Components: ' + s.components : '', s.summary, s.restriction, s.reference].filter(Boolean).join('\n')), font, 6, effect.rect[2] - effect.rect[0] - 8);
  for (let i = 0; i < lines.length; i += capacity) cards.push({ ...s, name: s.name + (i ? ' (cont.)' : ''), effect: lines.slice(i, i + capacity).join('\n') });
 }
 const headline = { 'SpellSheet 1_Cantrips Known': spells.filter(s => s.level === 0).length, 'SpellSheet 1_Spells Known': spells.filter(s => s.level > 0).length };
 const attack = unique(spells.map(s => s.attackBonus)), dc = unique(spells.map(s => s.saveDC));
 if (attack.length === 1) headline['SpellSheet 1_Spell Atk'] = signed(attack[0]);
 if (dc.length === 1) headline['SpellSheet 1_Spell DC'] = dc[0];
 // The first page is copied from the template; later pages draw the same artwork, so its page image is stored once.
 const [first] = await doc.copyPages(await loadPdf(PDFLib, resource.bytes), [0]);
 let artwork;
 for (let offset = 0; offset < cards.length; offset += 12) {
  let page;
  if (!offset) page = doc.addPage(first);
  else {
   artwork ??= await doc.embedPage(first);
   page = doc.addPage([first.getWidth(), first.getHeight()]);
   page.drawPage(artwork);
  }
  const values = { ...headline };
  cards.slice(offset, offset + 12).forEach((s, i) => {
   const put = (key, v) => values[`${key} ${String(i + 1).padStart(2, '0')}`] = v;
   const components = s.components.length > 22 ? 'See effect' : s.components;
   put('SpellSheet1_Ritual', s.ritual); put('SpellSheet1_Concentration', s.concentration); put('SpellSheet1_Prepared', s.prepared);
   for (const [label, component] of [['Verbal', 'V'], ['Somatic', 'S'], ['Material', 'M']]) put('SpellSheet1_' + label, new RegExp('(^|[^A-Za-z])' + component + '([^A-Za-z]|$)').test(s.components));
   put('SpellSheet1_Spell Name', s.name); put('SpellSheet 1_Spells Level', s.level === 0 ? '0' : s.level); put('SpellSheet1_Spell School', s.school);
   put('SpellSheet1_Range', s.range); put('SpellSheet1_Casting Time', s.casting);
   put('SpellSheet1_Save', s.requiresSave ? `${s.savingThrow} ${s.saveDC ?? '?'}` : s.requiresAttack && s.attackBonus != null ? `${signed(s.attackBonus)} atk` : '');
   put('SpellSheet1_Duration', s.duration + (s.concentration ? ' (C)' : ''));
   put('SpellSheet1_Components', components + (s.ritual ? ' / Ritual' : '')); put('SpellSheet1_Component', components);
   put('SpellSheet1_Spell Effect', s.effect);
  });
  const prefix = `Spellbook${doc.getPageCount()}.`;
  for (const f of resource.layout) {
   const slotMatch = f.name.match(/Spell Slot (\d)(?:st|nd|rd|th) (\d)/);
   if (slotMatch && f.type === '/Btn') {
    const slot = slots.find(s => s.level === Number(slotMatch[1]));
    if (slot && Number(slotMatch[2]) <= slot.total) values[f.name] = slot.used != null && Number(slotMatch[2]) <= slot.used;
   }
   if (!Object.hasOwn(values, f.name)) continue;
   if (f.type === '/Btn') { checkBox(PDFLib, fields, page, prefix + f.name, f.name.replace('SpellSheet1_', '') + (slotMatch ? ' used' : ''), f.rect, values[f.name]); continue; }
   if (f.type !== '/Tx') continue;
   const [x, y, r, t] = f.rect, value = clean(values[f.name]);
   const field = fields.text(prefix + f.name, f.name.replace(/SpellSheet.?_?/g, 'Spell '));
   const multi = /Effect|Components? \d/.test(f.name); if (multi) field.enableMultiline();
   field.setText(multi ? wrapText(value, font, 6, r - x - 8).join('\n') : value);
   const paddingY = t - y < 12 ? 0 : 2, height = t - y - 2 * paddingY;
   field.addToPage(page, { x: x + 2, y: y + paddingY, width: r - x - 4, height, font, ...hidden });
   const maximum = /School/.test(f.name) ? 6 : 9;
   field.setFontSize(multi ? 6 : Math.min(maximum, (r - x - 7) / Math.max(1, font.widthOfTextAtSize(value || ' ', 1)), (height - 2) / font.heightAtSize(1, { descender: false })));
  }
 }
}
// Official spellcasting page: spell names by level with prepared checkboxes, slot totals and casting headline.
// Field names are unordered, so lines are assigned to levels geometrically: the slot header above a line names its level.
export async function appendOfficialSpells(PDFLib, doc, fields, font, character, resource, clean) {
 const spells = character.spellRows ?? [];
 const [page] = await doc.copyPages(await loadPdf(PDFLib, resource.bytes), [0]); doc.addPage(page);
 const layout = resource.layout, column = f => f.rect[0] < 215 ? 0 : f.rect[0] < 400 ? 1 : 2;
 const headers = layout.filter(f => /^SlotsTotal (19|2[0-7])$/.test(f.name)).map(f => ({ ...f, level: Number(f.name.slice(11)) - 18 }));
 const lines = layout.filter(f => /^Spells 10\d\d$/.test(f.name)).map(f => {
  const above = headers.filter(h => column(h) === column(f) && h.rect[1] >= f.rect[3] - 2).sort((a, b) => a.rect[1] - b.rect[1])[0];
  const box = layout.find(b => b.type === '/Btn' && column(b) === column(f) && b.rect[0] < f.rect[0] && Math.abs((b.rect[1] + b.rect[3]) / 2 - (f.rect[1] + f.rect[3]) / 2) < 5);
  return { ...f, level: above?.level ?? 0, box };
 }).sort((a, b) => a.level - b.level || b.rect[1] - a.rect[1]);
 const values = {}, checks = {};
 const casters = character.classes.map(c => c.subclass ? `${c.name} (${c.subclass})` : c.name);
 const ability = unique(spells.map(s => s.ability)), attack = unique(spells.map(s => s.attackBonus)), dc = unique(spells.map(s => s.saveDC));
 values['Spellcasting Class 2'] = casters.join(' / '); values['SpellcastingAbility 2'] = ability.join(' / ');
 values['SpellSaveDC  2'] = dc.join(' / '); values['SpellAtkBonus 2'] = attack.map(signed).join(' / ');
 for (const slot of character.spellSlots ?? []) { values[`SlotsTotal ${18 + slot.level}`] = slot.total; if (slot.used != null) values[`SlotsRemaining ${18 + slot.level}`] = slot.used; }
 for (let level = 0; level <= 9; level++) {
  const rows = lines.filter(l => l.level === level), list = spells.filter(s => s.level === level);
  rows.forEach((row, i) => {
   const s = list[i]; if (!s) return;
   const more = list.length - rows.length;
   values[row.name] = i === rows.length - 1 && more > 0 ? `+${more + 1} more (see spell details)` : s.name + (s.ritual ? ' (R)' : '') + (s.concentration ? ' (C)' : '');
   if (row.box && level > 0) checks[row.box.name] = !!s.prepared;
  });
 }
 const prefix = `Spellcasting${doc.getPageCount()}.`;
 for (const f of layout) {
  const name = prefix + f.name.trim(), [x, y, r, t] = f.rect, width = r - x, height = t - y;
  if (f.type === '/Btn' && Object.hasOwn(checks, f.name)) { checkBox(PDFLib, fields, page, name, 'Prepared', f.rect, checks[f.name]); continue; }
  if (f.type !== '/Tx') continue;
  const value = clean(values[f.name] ?? ''), field = fields.text(name, /^Spells /.test(f.name) ? 'Spell name' : f.name.replace(/\s*\d+$/, '').replace(/([a-z])([A-Z])/g, '$1 $2'));
  field.setText(value); field.addToPage(page, { x, y, width, height, font, ...hidden });
  field.setFontSize(Math.max(5, Math.min(/^Spells /.test(f.name) ? 9 : 12, height * .7, (width - 4) / Math.max(1, font.widthOfTextAtSize(value || ' ', 1)))));
  if (!/^Spells |Spellcasting Class/.test(f.name)) field.setAlignment(PDFLib.TextAlignment.Center);
 }
}
