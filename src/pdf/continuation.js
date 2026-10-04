import { lineHeight, wrapText } from './generator.js';
// Continuation panels reuse the template's own "Additional features & traits" artwork, embedded from the page
// already in this document: no second template download, and the page image is stored once.
const panels = {
 official: { field: 'Feat+Traits', crop: { left: 215, bottom: 197, right: 589, top: 426 }, page: [612, 792], size: 10, lines: 278, width: 489,
  title: { x: 46, y: 757 }, slots: [[40, 405], [40, 68]], panel: [532, 326], text: [17, 30, 510, 308] },
 class: { field: 'Back_Additional Features & Traits', crop: { left: 8, bottom: 10, right: 199, top: 474 }, page: [595.28, 841.89], size: 8, lines: 624, width: 241,
  title: { x: 28, y: 797 }, slots: [[12, 62], [303, 62]], panel: [277, 673], text: [16, 24, 261, 651] },
};
export async function appendContinuations(PDFLib, doc, fields, font, groups, options, clean) {
 if (!groups.length) return;
 const spec = panels[options.templateId.startsWith('class-') ? 'class' : 'official'];
 const native = options.layout.find(f => f.name === spec.field);
 if (!native) throw new Error('Missing matching continuation panel.');
 const [panel] = await doc.embedPages([doc.getPage(native.page)], [spec.crop]);
 const { size } = spec, capacity = Math.floor(spec.lines / lineHeight(font, size));
 // Wrap each group once at the panel width; start a group in the next panel rather than strand its heading.
 const pages = [[]];
 for (const g of groups) {
  const lines = [...wrapText(clean(g.label), font, size, spec.width), ...wrapText(clean(g.text), font, size, spec.width)];
  let current = pages[pages.length - 1];
  if (current.length && current.length + Math.min(lines.length, 4) > capacity) { current = []; pages.push(current); }
  else if (current.length) current.push('');
  for (const line of lines) { if (current.length >= capacity) { current = []; pages.push(current); } current.push(line); }
 }
 const filled = pages.filter(p => p.length);
 for (let i = 0; i < filled.length; i += 2) {
  const page = doc.addPage(spec.page);
  page.drawText('Additional character details / 5e (2014)', { ...spec.title, size: 13, font });
  filled.slice(i, i + 2).forEach((lines, j) => {
   const [x, y] = spec.slots[j], [left, bottom, right, top] = spec.text;
   page.drawPage(panel, { x, y, width: spec.panel[0], height: spec.panel[1] });
   const f = fields.text(`Continuation${doc.getPageCount()}.${j}`);
   f.enableMultiline(); f.setText(lines.join('\n'));
   f.addToPage(page, { x: x + left, y: y + bottom, width: right - left, height: top - bottom, font, borderWidth: 0, backgroundColor: undefined, borderColor: undefined });
   f.setFontSize(size);
  });
 }
}
