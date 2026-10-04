import { lineHeight, wrapText } from './generator.js';
// Continuation panels reuse artwork from the selected template pack.
export async function appendContinuations(PDFLib,doc,form,font,groups,options,clean){
 if(!groups.length)return;
 const isClass=options.templateId.startsWith('class-');
 const resource=options.reference??{bytes:options.templateBytes,layout:options.layout};
 const source=await PDFLib.PDFDocument.load(resource.bytes);
 const field=(page,name,content,rect,size=10)=>{const [x,y,r,t]=rect;const f=form.createTextField(name);f.acroField.dict.set(PDFLib.PDFName.of('TU'),PDFLib.PDFHexString.fromText(name.replaceAll('.',' ')));f.enableMultiline();f.setText(content);f.addToPage(page,{x,y,width:r-x,height:t-y,font,borderWidth:0,backgroundColor:undefined,borderColor:undefined});f.setFontSize(size);};
 const native=resource.layout.find(f=>f.name===(isClass?'Back_Additional Features & Traits':'Feat+Traits'));
 // Wrap each group once at the panel width; start a group in the next panel rather than strand its heading.
 const paginate=(size,width,capacity)=>{
  const panels=[[]];
  for(const g of groups){
   const lines=[...wrapText(clean(g.label),font,size,width),...wrapText(clean(g.text),font,size,width)];
   let current=panels[panels.length-1];
   if(current.length&&current.length+Math.min(lines.length,4)>capacity){current=[];panels.push(current);}
   else if(current.length)current.push('');
   for(const line of lines){if(current.length>=capacity){current=[];panels.push(current);}current.push(line);}
  }
  return panels.filter(p=>p.length);
 };
 if(!isClass){
  if(!native)throw new Error('Missing matching continuation panel.');
  const [panel]=await doc.embedPages([source.getPage(native.page)],[{left:215,bottom:197,right:589,top:426}]);
  const size=10,capacity=Math.floor(278/lineHeight(font,size));
  const panels=paginate(size,489,capacity);
  for(let i=0;i<panels.length;i+=2){const page=doc.addPage([612,792]);
   page.drawText('Additional character details / 5e (2014)',{x:46,y:757,size:13,font});
   panels.slice(i,i+2).forEach((lines,j)=>{const y=[405,68][j];page.drawPage(panel,{x:40,y,width:532,height:326});
    field(page,`Continuation${doc.getPageCount()}.${j}`,lines.join('\n'),[57,y+30,550,y+308],size);});
  }
  return;
 }
 const back=options.layout.find(f=>f.name==='Back_Additional Features & Traits');
 if(!back)throw new Error('Missing matching class continuation panel.');
 const main=await PDFLib.PDFDocument.load(options.templateBytes);
 const [panel]=await doc.embedPages([main.getPage(back.page)],[{left:8,bottom:10,right:199,top:474}]);
 const size=8,capacity=Math.floor(624/lineHeight(font,size));
 const panels=paginate(size,241,capacity);
 for(let i=0;i<panels.length;i+=2){const page=doc.addPage([595.28,841.89]);
  page.drawText('Additional character details / 5e (2014)',{x:28,y:797,size:13,font});
  panels.slice(i,i+2).forEach((lines,col)=>{const x=12+col*291;page.drawPage(panel,{x,y:62,width:277,height:673});
   field(page,`Continuation${doc.getPageCount()}.${col}`,lines.join('\n'),[x+16,86,x+261,713],size);});
 }
}
