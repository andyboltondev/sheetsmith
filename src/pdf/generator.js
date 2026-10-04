import { generateGroupedPdf } from './grouped.js';
import { generateSuppliedPdf } from './supplied.js';
import { template } from './template.js';
export const signed = value => value >= 0 ? `+${value}` : String(value);
export const ordinal = n => n+(['th','st','nd','rd'][n%100>10&&n%100<14?0:n%10]??'th');
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
export function mapCharacter(character, playerName = '') {
  return { ...character, identity: { ...character.identity, playerName },
    classLevel: character.classes.map(entry => `${entry.name} ${entry.level}`).join(' / '),
    abilityDisplay: Object.fromEntries(Object.entries(character.abilities).map(([key,value]) => [key, `${value.score} (${signed(value.modifier)})`])),
    saveDisplay: character.saves.map(value => `${signed(value.bonus)}  ${value.name}`).join('\n'),
    skillDisplay: character.skills.map(value => `${signed(value.bonus).padStart(3)}  ${value.name}${value.expertise ? ' (expertise)' : value.proficient ? ' *' : ''}`).join('\n'),
  };
}
const get = (data, path) => path.split('.').reduce((value, key) => value?.[key], data);
export async function generatePdf(PDFLib, character, options = {}) {
  if (options.templateId === 'compact') return generateGroupedPdf(PDFLib,character,options);
  if (options.templateBytes) return generateSuppliedPdf(PDFLib,character,options);
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const heading = await doc.embedFont(StandardFonts.TimesRomanBold);
  const form = doc.getForm(), fields = fieldFactory(PDFLib, form);
  const warnings = [];
  const clean = createCleaner(font, warnings);
  const pages = ['Character record', 'Inventory & identity', 'Spellbook'].map((title, i) => {
    const page = doc.addPage([template.width, template.height]);
    page.drawText('SHEETSMITH', { x:42,y:798,size:10,font,color:rgb(.38,.4,.35) });
    page.drawText(title, { x:42,y:764,size:27,font:heading,color:rgb(.14,.22,.18) });
    page.drawLine({start:{x:42,y:749},end:{x:553,y:749},thickness:1,color:rgb(.4,.5,.42)});
    page.drawText(`EDITABLE CHARACTER SHEET  /  ${i + 1} OF 3`, {x:42,y:38,size:8,font,color:rgb(.38,.4,.35)});
    page.drawText('Review imported values before play.', {x:350,y:38,size:8,font,color:rgb(.38,.4,.35)});
    return page;
  });
  const data = mapCharacter(character, options.playerName || character.identity.playerName);
  // Wrap and paginate long content rather than silently losing inventory or features.
  const overflow = [];
  for (const config of template.fields) {
    const page = pages[config.page ?? 0];
    page.drawText(config.label,{x:config.x,y:config.y+config.height+8,size:7,font,color:rgb(.33,.39,.34)});
    let value = get(data, config.path);
    if (value !== undefined && value !== null && config.signed) value = signed(value);
    let content = clean(value);
    const field = fields.text(config.name, config.label);
    if (config.multiline) {
      field.enableMultiline();
      const lines = wrapText(content, font, 10, config.width - 12);
      const capacity = Math.floor((config.height - 12) / 12);
      if (lines.length > capacity) {
        overflow.push({ label: config.label, lines: lines.slice(capacity - 1) });
        content = [...lines.slice(0, capacity - 1), '[Continued on extra pages]'].join('\n');
      } else content = lines.join('\n');
    }
    field.setText(content);
    if(!config.multiline&&(/^[+-]?\d+(?:\s*\([+-]?\d+\))?$/.test(content)||/^(AC|HPMax|Speed|Initiative|ProfBonus|Passive|HDTotal|HD)$/.test(config.name)))field.setAlignment(PDFLib.TextAlignment.Center);
    field.addToPage(page,{x:config.x,y:config.y,width:config.width,height:config.height,borderWidth:.5,borderColor:rgb(.72,.76,.7),backgroundColor:rgb(.98,.985,.97),font});
    const preferredSize = config.name === 'CharacterName' ? 22 : config.height >= 40 ? 17 : 14;
    field.setFontSize(config.multiline ? 10 : Math.max(4, Math.min(preferredSize, (config.width - 8) / Math.max(1, font.widthOfTextAtSize(content || ' ', 1)))));
  }
  if (options.portrait) {
    const image = await embedPortrait(doc, options.portrait);
    const box = template.portrait; const scale = Math.min(box.width/image.width, box.height/image.height);
    pages[box.page].drawImage(image,{x:box.x+(box.width-image.width*scale)/2,y:box.y+(box.height-image.height*scale)/2,width:image.width*scale,height:image.height*scale});
  }
  for (const group of overflow) {
    const lines = wrapText(group.lines.join('\n'),font,10,499);
    for (let offset = 0; offset < lines.length; offset += 51) {
      const page = doc.addPage([template.width,template.height]);
      page.drawText(`${group.label} / CONTINUED`,{x:42,y:790,size:14,font:heading});
      const field = fields.text(`Continuation${doc.getPageCount()}`);field.enableMultiline();field.setText(lines.slice(offset,offset+51).join('\n'));
      field.addToPage(page,{x:42,y:90,width:511,height:650,font,borderWidth:0});field.setFontSize(10);
      page.drawText('SHEETSMITH / CONTINUATION',{x:42,y:38,size:8,font});
    }
  }
  doc.setTitle(`${clean(character.identity.name)} - Character Sheet`);
  return { bytes: await savePdf(PDFLib, doc, form, font), warnings };
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
  const capacity = Math.max(1, Math.floor(height / lineHeight(font, min)) - 1);
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
  return { size: min, text: [...kept, marker].join('\n'), rest: rest.join('\n').replace(/^\n+/, '') };
}
export function wrapText(text, font, size, width) {
  return text.split('\n').flatMap(paragraph => {
    if (!paragraph) return [''];
    const lines = []; let line = '';
    for (const word of paragraph.trim().split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) { line = candidate; continue; }
      if (line) { lines.push(line); line = ''; }
      // Only split a word when the word itself cannot fit on a line.
      for (const char of word) {
        if (line && font.widthOfTextAtSize(line + char, size) > width) { lines.push(line); line = ''; }
        line += char;
      }
    }
    if (line) lines.push(line);
    return lines;
  });
}
