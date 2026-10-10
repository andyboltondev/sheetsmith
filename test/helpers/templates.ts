import { readFile } from 'node:fs/promises';
import * as P from 'pdf-lib';
const here = (path: string) => new URL(`../../${path}`, import.meta.url);
export const layoutOf = async (id: string) => JSON.parse(await readFile(here(`templates/${id}.json`), 'utf8'));
// Wizards' artwork is not in the repository, so tests use blank pages of the right size and count. The exporter only needs
// the page geometry and the field layout, which is why this stands in for the real, user-supplied sheets.
export async function templatePdf(id: string): Promise<Uint8Array> {
  const layout: { page: number }[] = await layoutOf(id), doc = await P.PDFDocument.create();
  for (let i = 0; i <= Math.max(...layout.map(f => f.page)); i++) doc.addPage([612, 792]).drawRectangle({ x: 0, y: 0, width: 1, height: 1, color: P.rgb(1, 1, 1) });
  return doc.save();
}
export const loadTemplate = async (id: string) => ({ bytes: await templatePdf(id), layout: await layoutOf(id) });
