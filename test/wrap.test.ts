import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as PDFLib from 'pdf-lib';
// @ts-expect-error Browser module
import { wrapText } from '../src/pdf/generator.js';
// The straightforward algorithm: measure every candidate line in full.
const reference = (text: string, font: PDFLib.PDFFont, size: number, width: number) => text.split('\n').flatMap(paragraph => {
  if (!paragraph) return [''];
  const lines: string[] = []; let line = '';
  for (const word of paragraph.trim().split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) { line = candidate; continue; }
    if (line) { lines.push(line); line = ''; }
    for (const char of word) { if (line && font.widthOfTextAtSize(line + char, size) > width) { lines.push(line); line = ''; } line += char; }
  }
  if (line) lines.push(line);
  return lines;
});
test('fast wrapping gives the same lines as measuring every candidate, including kerned pairs and long words', async () => {
  const doc = await PDFLib.PDFDocument.create();
  const fonts = [await doc.embedFont(PDFLib.StandardFonts.Helvetica), await doc.embedFont(PDFLib.StandardFonts.HelveticaBold)];
  const words = 'the of Attack Target Yellow AVATAR Tavern wyvern Victory x-ray (V, S, M) 50gp, 1d8+3 Wolf. Ty Way Av antidisestablishmentarianismthatgoesonandonandonandonandonandon creature within range.'.split(' ');
  let seed = 7; const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  for (let i = 0; i < 1500; i++) {
    const text = Array.from({ length: 1 + Math.floor(random() * 100) }, () => words[Math.floor(random() * words.length)]).join(random() < .1 ? '\n' : ' ');
    const size = [5.2, 6.6, 7.2, 8, 10][Math.floor(random() * 5)], width = 40 + Math.floor(random() * 400), font = fonts[i % 2];
    assert.deepEqual(wrapText(text, font, size, width), reference(text, font, size, width), `case ${i}`);
  }
});
