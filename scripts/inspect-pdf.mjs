import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
if (!process.argv[2]) { console.error('Usage: npm run inspect-pdf -- path/to/sheet.pdf'); process.exit(1); }
const doc = await PDFDocument.load(await readFile(process.argv[2]));
for (const field of doc.getForm().getFields()) console.log(field.getName());
