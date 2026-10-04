import { generateGroupedPdf } from './grouped.js';
import { generateSuppliedPdf } from './supplied.js';
import { template } from './template.js';
const signed = value => value >= 0 ? `+${value}` : String(value);
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
  if (options.templateId === 'field-notes') return generateGroupedPdf(PDFLib,character,options);
  if (options.templateBytes) return generateSuppliedPdf(PDFLib,character,options);
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const heading = await doc.embedFont(StandardFonts.TimesRomanBold);
  const form = doc.getForm();
  const warnings = [];
  const clean = value => [...String(value ?? '')].map(char => { if (char === '\n' || char === '\r') return char; if (char === '\t') return ' '; try { font.encodeText(char); return char; } catch { if (!warnings.includes('Some characters could not be represented in the PDF font and were replaced with ?.')) warnings.push('Some characters could not be represented in the PDF font and were replaced with ?.'); return '?'; } }).join('');
  const pages = ['Character record', 'Inventory & identity', 'Spellbook'].map((title, i) => {
    const page = doc.addPage([template.width, template.height]);
    page.drawText('FIELD NOTES', { x:42,y:798,size:10,font,color:rgb(.38,.4,.35) });
    page.drawText(title, { x:42,y:764,size:27,font:heading,color:rgb(.14,.22,.18) });
    page.drawLine({start:{x:42,y:749},end:{x:553,y:749},thickness:1,color:rgb(.4,.5,.42)});
    page.drawText(`EDITABLE CHARACTER SHEET  /  ${i + 1} OF 3`, {x:42,y:38,size:8,font,color:rgb(.38,.4,.35)});
    page.drawText('Review imported values before play.', {x:350,y:38,size:8,font,color:rgb(.38,.4,.35)});
    return page;
  });
  const data = mapCharacter(character, options.playerName ?? character.identity.playerName);
  // Wrap and paginate long content rather than silently losing inventory or features.
  const overflow = [];
  for (const config of template.fields) {
    const page = pages[config.page ?? 0];
    page.drawText(config.label,{x:config.x,y:config.y+config.height+8,size:7,font,color:rgb(.33,.39,.34)});
    let value = get(data, config.path);
    if (value !== undefined && value !== null && config.signed) value = signed(value);
    let content = clean(value);
    const field = form.createTextField(config.name);
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
    const image = await doc.embedPng(options.portrait);
    const box = template.portrait; const scale = Math.min(box.width/image.width, box.height/image.height);
    pages[box.page].drawImage(image,{x:box.x+(box.width-image.width*scale)/2,y:box.y+(box.height-image.height*scale)/2,width:image.width*scale,height:image.height*scale});
  }
  for (const group of overflow) {
    const lines = wrapText(group.lines.join('\n'),font,10,499);
    for (let offset = 0; offset < lines.length; offset += 51) {
      const page = doc.addPage([template.width,template.height]);
      page.drawText(`${group.label} / CONTINUED`,{x:42,y:790,size:14,font:heading});
      const field = form.createTextField(`Continuation${doc.getPageCount()}`);field.enableMultiline();field.setText(lines.slice(offset,offset+51).join('\n'));
      field.addToPage(page,{x:42,y:90,width:511,height:650,font,borderWidth:0});field.setFontSize(10);
      page.drawText('FIELD NOTES / CONTINUATION',{x:42,y:38,size:8,font});
    }
  }
  form.updateFieldAppearances(font);
  doc.setTitle(`${clean(character.identity.name)} - Character Sheet`);
  return { bytes: await doc.save(), warnings };
}
// Display only: single items need no count, and coins list just what the character holds.
export const displayItems = text => String(text??'').replace(/^1 x /gm,'').replace(/^(\d+) x /gm,'$1 × ');
export const coinLine = coins => { const held=['pp','gp','ep','sp','cp'].filter(c=>Number(coins?.[c])>0).map(c=>`${coins[c]} ${c.toUpperCase()}`); return `Coins: ${held.join(', ')||'none'}`; };
// Matches pdf-lib's multiline appearance: line height is 1.2 × the font's full height.
export const lineHeight = (font, size) => font.heightAtSize(size) * 1.2;
export const CONTINUED = '(Continued on extra pages)';
// Use the largest readable size that fits the box; shrink before overflowing, and only
// then split at a line or sentence boundary. `rest` keeps the original line structure so
// continuation pages can re-wrap it at their own width.
export function fitText(text, font, { width, height, max = 10, min = 7, step = 0.5, marker = CONTINUED }) {
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
        if (font.widthOfTextAtSize(line + char, size) > width) { lines.push(line); line = ''; }
        line += char;
      }
    }
    if (line) lines.push(line);
    return lines;
  });
}
