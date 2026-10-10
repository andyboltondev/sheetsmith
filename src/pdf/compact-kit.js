import { createCleaner, fieldFactory, signed as sign } from './generator.js';
// Drawing primitives for the SheetSmith sheet: text, rules, boxes, editable fields and proficiency bullets.
// Blank values print as nothing rather than +0.
export const signed=n=>n==null||n===''?'':sign(n);
export const titleCase=key=>key.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase());
export const plural=(n,one,many=one+'s')=>`${n} ${n===1?one:many}`;
// Classes that prepare spells from a list; everyone else knows theirs, so they get no prepared marker.
export const preparers=new Set(['Artificer','Cleric','Druid','Paladin','Wizard']);
export const groupsOf={strength:['Athletics'],dexterity:['Acrobatics','Sleight of Hand','Stealth'],constitution:[],intelligence:['Arcana','History','Investigation','Nature','Religion'],wisdom:['Animal Handling','Insight','Medicine','Perception','Survival'],charisma:['Deception','Intimidation','Performance','Persuasion']};
export const A4=[595.28,841.89],M=30,RIGHT=A4[0]-M,BOTTOM=38;
export function createKit(PDFLib,doc,font,bold){
 const {rgb}=PDFLib,form=doc.getForm(),fields=fieldFactory(PDFLib,form),warnings=[];
 const ink=rgb(.13,.15,.14),muted=rgb(.42,.45,.42),hair=rgb(.8,.82,.78),accent=rgb(.16,.3,.22),tint=rgb(.94,.955,.925),white=rgb(1,1,1);
 const clean=createCleaner(font,warnings);
 const width=(v,size,f=font)=>f.widthOfTextAtSize(clean(v),size);
 const text=(p,v,x,y,size=8,f=font,color=ink)=>p.drawText(clean(v),{x,y,size,font:f,color});
 const label=(p,v,x,y,size=6,color=muted)=>text(p,String(v).toUpperCase(),x,y,size,bold,color);
 const centred=(p,v,x,y,w,size=6,color=muted)=>label(p,v,x+(w-width(String(v).toUpperCase(),size,bold))/2,y,size,color);
 const rightLabel=(p,v,x,y,size=6,color=muted)=>label(p,v,x-width(String(v).toUpperCase(),size,bold),y,size,color);
 const rule=(p,x1,x2,y,color=hair,thickness=.5)=>p.drawLine({start:{x:x1,y},end:{x:x2,y},thickness,color});
 const vrule=(p,x,y1,y2)=>p.drawLine({start:{x,y:y1},end:{x,y:y2},thickness:.5,color:hair});
 // Rounded box; y is the bottom edge, as elsewhere in pdf-lib.
 const rbox=(p,x,y,w,h,{fill,border=hair,r=3,bw=.6}={})=>p.drawSvgPath(`M ${r} 0 H ${w-r} Q ${w} 0 ${w} ${r} V ${h-r} Q ${w} ${h} ${w-r} ${h} H ${r} Q 0 ${h} 0 ${h-r} V ${r} Q 0 0 ${r} 0 Z`,{x,y:y+h,color:fill,borderColor:border,borderWidth:border?bw:0});
 // Field names follow content (spell, action and feature names), which can repeat or contain the dots PDF uses for nesting.
 const named=n=>String(n??'').replace(/\.+/g,' ').replace(/\s+/g,' ').trim()||'Untitled';
 const unique=name=>{let n=name,k=2;while(fields.has(n))n=`${name} (${k++})`;return n;};
 // Single-line fields shrink to fit their width; multiline fields take pre-wrapped text.
 const field=(p,name,value,x,y,w,h,{size=8,multi=false,align='left',f=font}={})=>{
  const v=clean(value),t=fields.text(unique(name));
  if(multi)t.enableMultiline();t.setText(v);
  t.addToPage(p,{x,y,width:w,height:h,font:f,borderWidth:0,backgroundColor:undefined,borderColor:undefined});
  t.setFontSize(multi?size:Math.max(5,Math.min(size,(w-4)/Math.max(1,f.widthOfTextAtSize(v||' ',1)))));
  if(align!=='left')t.setAlignment(align==='center'?PDFLib.TextAlignment.Center:PDFLib.TextAlignment.Right);
  if(f!==font)t.updateAppearances(f);
  return t;
 };
 // Editable proficiency/usage dot: the ring is page artwork, the fill is the checkbox's on state.
 const dot=(p,name,x,y,on,r=2.7)=>{
  p.drawCircle({x,y,size:r,borderColor:ink,borderWidth:.55,color:white});
  const b=fields.checkBox(unique(name));
  b.addToPage(p,{x:x-r,y:y-r,width:2*r,height:2*r,borderWidth:0,backgroundColor:undefined,borderColor:undefined});
  if(on)b.check();
  b.updateAppearances(()=>({normal:{on:PDFLib.drawEllipse({x:r,y:r,xScale:r-.6,yScale:r-.6,color:accent,borderColor:undefined,borderWidth:0}),off:[]}}));
  return b;
 };
 // Saving-throw bullet: a diamond, as on the official sheet, so saves read differently from skills.
 const diamondPath=r=>`M 0 ${-r} L ${r} 0 L 0 ${r} L ${-r} 0 Z`;
 const diamond=(p,name,x,y,on,r=3.4)=>{
  p.drawSvgPath(diamondPath(r),{x,y,borderColor:ink,borderWidth:.55,color:white});
  const b=fields.checkBox(unique(name));
  b.addToPage(p,{x:x-r,y:y-r,width:2*r,height:2*r,borderWidth:0,backgroundColor:undefined,borderColor:undefined});
  if(on)b.check();
  b.updateAppearances(()=>({normal:{on:PDFLib.drawSvgPath(diamondPath(r-.9),{x:r,y:r,color:accent,borderColor:undefined,borderWidth:0}),off:[]}}));
  return b;
 };
 // Section heading: small accent caps, a hairline to the column edge and an optional right-hand note.
 const heading=(p,title,x,y,w,note='')=>{label(p,title,x,y,6.8,accent);const end=note?x+w-width(note.toUpperCase(),6,bold)-6:x+w;if(note)rightLabel(p,note,x+w,y,6);rule(p,x+width(title.toUpperCase(),6.8,bold)+5,end,y+2.3);};
 const ruled=(p,x,w,top)=>{for(let y=top-12;y>BOTTOM+2;y-=12)rule(p,x,x+w,y,tint,.7);};
 return {PDFLib,doc,form,fields,warnings,font,bold,ink,muted,hair,accent,tint,white,clean,width,text,label,centred,rightLabel,rule,vrule,rbox,named,unique,field,dot,diamond,heading,ruled};
}
