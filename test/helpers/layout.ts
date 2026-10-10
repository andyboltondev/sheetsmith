import * as P from 'pdf-lib';
export type Widget = { name: string; page: number; x: number; y: number; w: number; h: number; text: string; multiline: boolean; size: number; kind: 'text' | 'check' };
const FONT_SIZE = /\/\S+\s+([\d.]+)\s+Tf/;
// Every editable field's placement and content, read back from the finished PDF.
export async function widgets(bytes: Uint8Array): Promise<{ doc: P.PDFDocument; list: Widget[]; pages: { width: number; height: number }[] }> {
  const doc = await P.PDFDocument.load(bytes, { updateMetadata: false });
  const index = new Map(doc.getPages().map((page, i) => [page.ref.toString(), i]));
  const list: Widget[] = [];
  for (const field of doc.getForm().getFields()) {
    const isText = field instanceof P.PDFTextField;
    for (const widget of field.acroField.getWidgets()) {
      const { x, y, width: w, height: h } = widget.getRectangle(), page = index.get(widget.P()?.toString() ?? '') ?? -1;
      const da = field.acroField.getDefaultAppearance() ?? '', size = Number(da.match(FONT_SIZE)?.[1] ?? 0);
      list.push({ name: field.getName(), page, x, y, w, h, kind: isText ? 'text' : 'check', text: isText ? field.getText() ?? '' : '', multiline: isText && field.isMultiline(), size });
    }
  }
  return { doc, list, pages: doc.getPages().map(page => page.getSize()) };
}
export async function measurer() {
  const doc = await P.PDFDocument.create(), font = await doc.embedFont(P.StandardFonts.Helvetica), bold = await doc.embedFont(P.StandardFonts.HelveticaBold);
  return { width: (text: string, size: number, f = font) => f.widthOfTextAtSize(text, size), line: (size: number) => font.heightAtSize(size) * 1.2, bold };
}
export type Problem = { name: string; page: number; problem: string };
// Text that would be clipped or spill out of its box, and boxes that leave the page.
export async function fitProblems(bytes: Uint8Array): Promise<Problem[]> {
  const { list, pages } = await widgets(bytes), m = await measurer(), problems: Problem[] = [];
  for (const f of list) {
    const page = pages[f.page];
    if (!page) { problems.push({ name: f.name, page: f.page, problem: 'not on a page' }); continue; }
    if (f.x < -0.5 || f.y < -0.5 || f.x + f.w > page.width + 0.5 || f.y + f.h > page.height + 0.5) problems.push({ name: f.name, page: f.page, problem: 'outside the page' });
    if (f.kind !== 'text' || !f.text || !f.size) continue;
    const lines = f.text.split('\n');
    // Bold fields are measured in bold; a regular measure would pass text that really overflows.
    const widest = Math.max(...lines.map(l => Math.max(m.width(l, f.size), 0)));
    if (!f.multiline && lines.length === 1 && widest > f.w - 1) problems.push({ name: f.name, page: f.page, problem: `text ${widest.toFixed(1)}pt wide in a ${f.w.toFixed(1)}pt box` });
    if (f.multiline) {
      if (widest > f.w + 0.5) problems.push({ name: f.name, page: f.page, problem: `line ${widest.toFixed(1)}pt wide in a ${f.w.toFixed(1)}pt box` });
      if (lines.length * m.line(f.size) > f.h + 2) problems.push({ name: f.name, page: f.page, problem: `${lines.length} lines need ${(lines.length * m.line(f.size)).toFixed(1)}pt in a ${f.h.toFixed(1)}pt box` });
    }
  }
  return problems;
}
// Pairs of editable boxes on the same page that cover each other, which makes one of them hard to click or read.
export const overlaps = (list: Widget[], minimum = 4): [string, string][] => {
  const found: [string, string][] = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    if (a.page !== b.page) continue;
    const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (w > 0 && h > 0 && w * h > minimum) found.push([a.name, b.name]);
  }
  return found;
};
