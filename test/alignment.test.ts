import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import * as P from 'pdf-lib';import {normalise} from '../src/importers/dndbeyond/parser.ts';
// @ts-expect-error Browser JS
import {generatePdf} from '../src/pdf/generator.js';
const fixture=async()=>JSON.parse(await readFile(new URL('./fixtures/martial.json',import.meta.url),'utf8'));
test('alignment imports DDB IDs and explicit text without guessing missing values',async()=>{
 const raw=await fixture();for(const [i,name] of ['Lawful Good','Neutral Good','Chaotic Good','Lawful Neutral','Neutral','Chaotic Neutral','Lawful Evil','Neutral Evil','Chaotic Evil'].entries()){raw.data.alignmentId=i+1;assert.equal(normalise(raw).identity.alignment,name);}
 raw.data.alignmentId='6';assert.equal(normalise(raw).identity.alignment,'Chaotic Neutral');
 for(const id of [null,undefined,999]){raw.data.alignmentId=id;assert.equal(normalise(raw).identity.alignment,'');}
 raw.data.alignment='<b>Neutral Good</b>';assert.equal(normalise(raw).identity.alignment,'Neutral Good');
});
test('alignment reaches every supplied template, the custom sheet and legacy layout',async()=>{
 const raw=await fixture();raw.data.alignmentId=6;const c=normalise(raw);
 const catalog=JSON.parse(await readFile(new URL('../templates/catalog.json',import.meta.url),'utf8'));
 for(const t of [...catalog.filter((t:any)=>!t.resource),{id:'compact'},{id:'legacy'}]){
  let opts:any={};if(t.id==='compact')opts.templateId=t.id;else if(t.id!=='legacy')opts={templateId:t.id,templateBytes:await readFile(new URL(`../templates/${t.id}.pdf`,import.meta.url)),layout:JSON.parse(await readFile(new URL(`../templates/${t.id}.json`,import.meta.url),'utf8'))};
  const {bytes}=await generatePdf(P,c,opts),form=(await P.PDFDocument.load(bytes)).getForm();
  const value=t.id==='compact'?form.getTextField('Identity').getText():form.getFields().filter(f=>f.getName().includes('Alignment')).map(f=>(f as P.PDFTextField).getText()).join('');
  assert.ok(value?.includes('Chaotic Neutral'),t.id);
 }
});
