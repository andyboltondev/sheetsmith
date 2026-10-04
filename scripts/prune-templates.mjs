import { readFile, readdir, writeFile } from 'node:fs/promises';
import { PDFArray, PDFDict, PDFDocument, PDFRef, PDFStream } from 'pdf-lib';
// Removes objects no page or document entry refers to (leftover page images from template preparation).
// Referenced streams are written back byte for byte, so the artwork is unchanged.
const dir = new URL('../templates/', import.meta.url);
const files = process.argv.slice(2).length ? process.argv.slice(2) : (await readdir(dir)).filter(f => f.endsWith('.pdf'));
for (const file of files) {
  const url = new URL(file, dir), before = await readFile(url);
  const doc = await PDFDocument.load(before, { updateMetadata: false });
  const { context } = doc, reachable = new Set(), pending = [context.trailerInfo.Root, context.trailerInfo.Info];
  while (pending.length) {
    let value = pending.pop();
    if (value instanceof PDFRef) { if (reachable.has(value)) continue; reachable.add(value); value = context.lookup(value); }
    if (value instanceof PDFStream) value = value.dict;
    if (value instanceof PDFDict) pending.push(...value.values());
    else if (value instanceof PDFArray) pending.push(...value.asArray());
  }
  const unused = context.enumerateIndirectObjects().filter(([ref]) => !reachable.has(ref));
  if (!unused.length) { console.log(`${file}: nothing to remove`); continue; }
  for (const [ref] of unused) context.delete(ref);
  const after = await doc.save({ addDefaultPage: false, updateFieldAppearances: false });
  if (after.length >= before.length) { console.log(`${file}: kept (no saving)`); continue; }
  await writeFile(url, after);
  console.log(`${file}: ${(before.length / 1e6).toFixed(2)} MB -> ${(after.length / 1e6).toFixed(2)} MB (${unused.length} objects removed)`);
}
