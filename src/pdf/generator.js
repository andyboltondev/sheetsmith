import { generateGroupedPdf } from './grouped.js';
import { generateSuppliedPdf } from './supplied.js';
import { signed, ordinal } from './format.js';
export { signed, ordinal };
export const UNSUPPORTED = 'Some characters could not be represented in the PDF font and were replaced with ?.';
// Standard PDF fonts cover WinAnsi only; anything else prints as ? with one warning. Checked once per character.
export function createCleaner(font, warnings) {
  const known = new Map([['\n','\n'],['\r',''],['\t',' ']]);
  return value => {
    let out = '';
    for (const char of String(value ?? '')) {
      let safe = known.get(char);
      if (safe === undefined) {
        try { font.encodeText(char); safe = char; } catch { safe = '?'; if (!warnings.includes(UNSUPPORTED)) warnings.push(UNSUPPORTED); }
        known.set(char, safe);
      }
      out += safe;
    }
    return out;
  };
}
// pdf-lib's createTextField/createCheckBox re-decode every sibling's name on each call, which is quadratic
// and was most of the export time. Fresh forms attach new fields directly and track names here instead.
export function fieldFactory(PDFLib, form) {
  const { PDFAcroText, PDFAcroCheckBox, PDFAcroNonTerminal, PDFTextField, PDFCheckBox, PDFName, PDFHexString } = PDFLib;
  const { doc } = form, context = doc.context, fresh = form.getFields().length === 0;
  const names = new Set(), parents = new Map([['', [form.acroForm, undefined]]]);
  const parentOf = path => {
    if (parents.has(path)) return parents.get(path);
    if (names.has(path)) throw new Error(`PDF field ${path} cannot also be a group.`);
    const cut = path.lastIndexOf('.'), [up, upRef] = parentOf(cut < 0 ? '' : path.slice(0, cut));
    const node = PDFAcroNonTerminal.create(context); node.setPartialName(path.slice(cut + 1)); node.setParent(upRef);
    const ref = context.register(node.dict); up.addField(ref);
    parents.set(path, [node, ref]); return [node, ref];
  };
  const make = (Acro, Field, fallback) => (name, tooltip = name.replaceAll('.', ' ')) => {
    let field;
    if (!fresh) field = fallback(name);
    else {
      if (names.has(name) || parents.has(name)) throw new Error(`Duplicate PDF field ${name}.`);
      const cut = name.lastIndexOf('.'), [parent, parentRef] = parentOf(cut < 0 ? '' : name.slice(0, cut));
      const acro = Acro.create(context); acro.setPartialName(name.slice(cut + 1)); parent.addField(acro.ref); acro.setParent(parentRef);
      field = Field.of(acro, acro.ref, doc);
    }
    names.add(name);
    field.acroField.dict.set(PDFName.of('TU'), PDFHexString.fromText(tooltip));
    return field;
  };
  return { text: make(PDFAcroText, PDFTextField, n => form.createTextField(n)), checkBox: make(PDFAcroCheckBox, PDFCheckBox, n => form.createCheckBox(n)), has: name => names.has(name) };
}
// Portraits arrive as JPEG (photos) or PNG (images with transparency). pdf-lib's JPEG reader ignores a view's
// byte offset, so the bytes are copied into their own buffer first.
export const embedPortrait = (doc, bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 ? doc.embedJpg(new Uint8Array(bytes)) : doc.embedPng(bytes);
// Export runs in a worker, so parsing and saving need not pause every few objects for the event loop
// (browsers clamp each pause to 4 ms or more).
export const loadPdf =(PDFLib, bytes) => PDFLib.PDFDocument.load(bytes, { parseSpeed: PDFLib.ParseSpeeds.Fastest });
// pdf-lib keeps every object it ever made, including appearance streams replaced when a field changes after
// placement and template objects nothing points to. Draw final appearances, embed, drop the unreferenced, save.
export async function savePdf(PDFLib, doc, form, font) {
  const { PDFRef, PDFDict, PDFArray, PDFStream } = PDFLib, context = doc.context, reachable = new Set();
  form.updateFieldAppearances(font);
  // Viewers show the character's name in the title bar rather than a file name.
  doc.catalog.getOrCreateViewerPreferences().setDisplayDocTitle(true);
  doc.setProducer('SheetSmith'); doc.setCreator('SheetSmith');
  // Tab moves through the fields in the order they appear on the page, not the order they were created.
  for (const page of doc.getPages()) page.node.set(PDFLib.PDFName.of('Tabs'), PDFLib.PDFName.of('S'));
  await doc.flush();
  const pending = [context.trailerInfo.Root, context.trailerInfo.Info];
  while (pending.length) {
    let value = pending.pop();
    if (value instanceof PDFRef) { if (reachable.has(value)) continue; reachable.add(value); value = context.lookup(value); }
    if (value instanceof PDFStream) value = value.dict;
    if (value instanceof PDFDict) pending.push(...value.values());
    else if (value instanceof PDFArray) pending.push(...value.asArray());
  }
  for (const [ref] of context.enumerateIndirectObjects()) if (!reachable.has(ref)) context.delete(ref);
  return doc.save({ updateFieldAppearances: false, objectsPerTick: Infinity });
}
export async function generatePdf(PDFLib, character, options = {}) {
  if (options.templateId === 'compact') return generateGroupedPdf(PDFLib,character,options);
  if (options.templateBytes) return generateSuppliedPdf(PDFLib,character,options);
  throw new Error('Choose one of the available sheet styles.');
}
// Display only: single items need no count, and coins list just what the character holds.
export const displayItems = text => String(text??'').replace(/^1 x /gm,'').replace(/^(\d+) x /gm,'$1 × ');
export const coinLine = coins => { if (coins && Object.values(coins).length && Object.values(coins).every(v => v === null)) return `Coins: ${['pp','gp','ep','sp','cp'].map(c => `__ ${c.toUpperCase()}`).join(', ')}`; const held=['pp','gp','ep','sp','cp'].filter(c=>Number(coins?.[c])>0).map(c=>`${coins[c]} ${c.toUpperCase()}`); return `Coins: ${held.join(', ')||'none'}`; };
// Checked state for template checkboxes: a solid dot that fills the printed circle, not a tick.
export const dotAppearance = (PDFLib, width, height) => ({normal:{on:PDFLib.drawEllipse({x:width/2,y:height/2,xScale:Math.min(width,height)*.36,yScale:Math.min(width,height)*.36,color:PDFLib.rgb(0,0,0),borderWidth:0}),off:[]}});
// Matches pdf-lib's multiline appearance: line height is 1.2 × the font's full height.
export const lineHeight = (font, size) => font.heightAtSize(size) * 1.2;
export const CONTINUED = '(Continued on extra pages)';
// Use the largest readable size that fits the box; shrink before overflowing, and only
// then split at a line or sentence boundary. `rest` keeps the original line structure so
// continuation pages can re-wrap it at their own width.
// `isHeading` marks lines that must not end a box, so a heading moves on with its text.
export function fitText(text, font, { width, height, max = 10, min = 7, step = 0.5, marker = CONTINUED, isHeading = () => false }) {
  const source = String(text ?? '').replace(/\n{3,}/g, '\n\n').trim();
  for (let size = max; size >= min - 1e-9; size -= step) {
    const lines = wrapText(source, font, size, width);
    if (lines.length * lineHeight(font, size) <= height) return { size, text: lines.join('\n'), rest: '' };
  }
  // The marker is wrapped like any other text, so in a narrow box it takes the lines it needs rather than being clipped.
  const markerLines = wrapText(marker, font, min, width);
  const capacity = Math.max(1, Math.floor(height / lineHeight(font, min)) - markerLines.length);
  const kept = [];
  const paragraphs = source.split('\n');
  let index = 0;
  for (; index < paragraphs.length; index++) {
    const lines = wrapText(paragraphs[index], font, min, width);
    if (kept.length + lines.length > capacity) break;
    kept.push(...lines);
  }
  let rest = paragraphs.slice(index);
  // Never leave a large box nearly empty: split a long paragraph after its last whole sentence that fits.
  if (index < paragraphs.length && capacity - kept.length >= 2) {
    const sentences = paragraphs[index].split(/(?<=[.!?;])\s+/);
    let taken = 0;
    while (taken < sentences.length - 1 && kept.length + wrapText(sentences.slice(0, taken + 1).join(' '), font, min, width).length <= capacity) taken++;
    if (taken === 0) {
      const words = paragraphs[index].split(/\s+/);
      while (taken < words.length - 1 && kept.length + wrapText(words.slice(0, taken + 1).join(' '), font, min, width).length <= capacity) taken++;
      if (taken) { kept.push(...wrapText(words.slice(0, taken).join(' ') + ' …', font, min, width)); rest = ['… ' + words.slice(taken).join(' '), ...rest.slice(1)]; }
    } else {
      kept.push(...wrapText(sentences.slice(0, taken).join(' '), font, min, width));
      rest = [sentences.slice(taken).join(' '), ...rest.slice(1)];
    }
  }
  while (kept.length && !kept[kept.length - 1]) kept.pop();
  if (kept.length > 1 && isHeading(kept[kept.length - 1])) { rest = [kept.pop(), ...rest]; while (kept.length && !kept[kept.length - 1]) kept.pop(); }
  return { size: min, text: [...kept, ...markerLines].join('\n'), rest: rest.join('\n').replace(/^\n+/, '') };
}
// Word widths are measured once per font and size. A line grows by adding word widths, and only a line close to
// the limit is re-measured as a whole (the standard fonts kern letter pairs, so the sum is an estimate).
const widths = new WeakMap();
const measure = (font, size, text) => {
  let bySize = widths.get(font); if (!bySize) widths.set(font, bySize = new Map());
  let words = bySize.get(size); if (!words) bySize.set(size, words = new Map());
  let width = words.get(text); if (width === undefined) { width = font.widthOfTextAtSize(text, size); words.set(text, width); }
  return width;
};
export function wrapText(text, font, size, width) {
  const space = measure(font, size, ' ');
  return text.split('\n').flatMap(paragraph => {
    if (!paragraph) return [''];
    const lines = []; let line = '', lineWidth = 0, count = 0;
    for (const word of paragraph.trim().split(/\s+/)) {
      // Kerning error grows with every word added to the estimate.
      const slack = size * (1 + count * .15);
      const estimate = line ? lineWidth + space + measure(font, size, word) : measure(font, size, word);
      if (estimate <= width - slack) { line = line ? `${line} ${word}` : word; lineWidth = estimate; count++; continue; }
      if (estimate <= width + slack || !line) {
        const candidate = line ? `${line} ${word}` : word, exact = font.widthOfTextAtSize(candidate, size);
        if (exact <= width) { line = candidate; lineWidth = exact; count = 0; continue; }
      }
      if (line) { lines.push(line); line = ''; lineWidth = 0; count = 0; }
      // Only split a word when the word itself cannot fit on a line.
      if (measure(font, size, word) <= width) { line = word; lineWidth = measure(font, size, word); continue; }
      for (const char of word) {
        if (line && font.widthOfTextAtSize(line + char, size) > width) { lines.push(line); line = ''; }
        line += char;
      }
      lineWidth = line ? font.widthOfTextAtSize(line, size) : 0;
    }
    if (line) lines.push(line);
    return lines;
  });
}
