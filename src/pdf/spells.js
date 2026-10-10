import { dotAppearance, loadPdf, signed, wrapText } from './generator.js';
const hidden = { borderWidth: 0, backgroundColor: undefined, borderColor: undefined };
const unique = list => [...new Set(list.filter(v => v != null && v !== ''))];
const checkBox = (PDFLib, fields, page, name, tooltip, [x, y, r, t], on) => {
 const width = r - x, height = t - y, check = fields.checkBox(name, tooltip);
 check.addToPage(page, { x, y, width, height, ...hidden });
 if (on) check.check();
 check.updateAppearances(() => dotAppearance(PDFLib, width, height));
};
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
