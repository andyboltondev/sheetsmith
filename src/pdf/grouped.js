import { createCleaner, displayItems, embedPortrait, fieldFactory, savePdf, fitText, lineHeight, ordinal, signed as sign, wrapText } from './generator.js';
import { BLANK } from './fresh.js';
import { PROFICIENCY_ONLY } from './supplied.js';
// SheetSmith (template id 'compact'): a minimal one-page summary (abilities, saves and skills in one table with proficiency dots),
// followed by compact two-column detail and spellbook pages. Everything stays editable.
const groups={strength:['Athletics'],dexterity:['Acrobatics','Sleight of Hand','Stealth'],constitution:[],intelligence:['Arcana','History','Investigation','Nature','Religion'],wisdom:['Animal Handling','Insight','Medicine','Perception','Survival'],charisma:['Deception','Intimidation','Performance','Persuasion']};
const signed=n=>n==null||n===''?'':sign(n);
const titleCase=key=>key.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase());
const plural=(n,one,many=one+'s')=>`${n} ${n===1?one:many}`;
// Classes that prepare spells from a list; everyone else knows theirs, so they get no prepared marker.
const preparers=new Set(['Artificer','Cleric','Druid','Paladin','Wizard']);
const A4=[595.28,841.89],M=30,RIGHT=A4[0]-M,BOTTOM=38;
export async function generateGroupedPdf(PDFLib,c,options){
 const weights=options.equipmentWeight!==false;
 const {PDFDocument,StandardFonts,rgb}=PDFLib;
 const doc=await PDFDocument.create();doc.setLanguage('en-GB');
 const font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold),form=doc.getForm(),fields=fieldFactory(PDFLib,form),warnings=[];
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
 const heading=(p,title,x,y,w,note='')=>{label(p,title,x,y,6.8,accent);const end=note?x+w-width(note.toUpperCase(),5.6,bold)-6:x+w;if(note)rightLabel(p,note,x+w,y,5.6);rule(p,x+width(title.toUpperCase(),6.8,bold)+5,end,y+2.3);};
 const ruled=(p,x,w,top)=>{for(let y=top-12;y>BOTTOM+2;y-=12)rule(p,x,x+w,y,tint,.7);};
 const overflow=[];
 // Text block sized to its content up to `cap`; anything longer continues on the detail pages.
 const block=(p,name,body,x,top,w,cap,{max=8,min=6.8,title=name}={})=>{
  const source=clean(String(body??'').trim());if(!source)return 0;
  const lines=wrapText(source,font,max,w-4),need=lines.length*lineHeight(font,max)+4;
  if(need<=cap){field(p,name,lines.join('\n'),x-2,top-need,w+4,need,{size:max,multi:true});return need;}
  const fit=fitText(source,font,{width:w-4,height:cap-4,max,min});
  field(p,name,fit.text,x-2,top-cap,w+4,cap,{size:fit.size,multi:true});if(fit.rest)overflow.push([`${title} (continued)`,fit.rest]);return cap;
 };
 const p=doc.addPage(A4);

 // Identity band: name and summary line, with level, XP or milestone and portrait to the right.
 const level=c.classes.reduce((n,v)=>n+(v.level||0),0),portraitW=options.portrait?48:0;
 const milestone=c.advancement==='milestone',showXP=c.experience!=null||milestone;
 const statsW=showXP?110:40,nameW=RIGHT-M-portraitW-statsW-(portraitW?8:0);
 field(p,'CharacterName',c.identity.name,M-2,784,nameW,26,{size:21,f:bold});
 const player=options.playerName||c.identity.playerName;
 const identity=[c.identity.species,...c.classes.map(v=>`${v.name} ${v.level}${v.subclass?' ('+v.subclass+')':''}`),c.identity.background,c.identity.alignment,player?'Player: '+player:''].filter(Boolean).join('  ·  ');
 field(p,'Identity',identity,M-2,769,nameW+statsW-4,13,{size:8.5});
 {let x=RIGHT-portraitW-(portraitW?8:0);
  // A blanked export clears experience to '' so it can be pencilled in.
  if(showXP){rightLabel(p,milestone?'Advancement':'XP',x,801);field(p,'Experience',c.experience===''?'':milestone?'Milestone':c.experience,x-62,784,64,15,{size:milestone?10:12,align:'center'});x-=70;}
  rightLabel(p,'Level',x,801);text(p,String(level),x-width(String(level),15,bold),787.5,15,bold);}
 if(options.portrait){const image=await embedPortrait(doc,options.portrait),s=Math.min(portraitW/image.width,portraitW/image.height);p.drawImage(image,{x:RIGHT-portraitW+(portraitW-image.width*s)/2,y:765+(portraitW-image.height*s)/2,width:image.width*s,height:image.height*s});}
 rule(p,M,RIGHT,761,accent,1.2);

 // Vitals: defence and movement · hit points · recovery, each its own rounded group.
 const vy=717,vh=36,gap=6;
 const vgroups=[[['Armour class',c.combat.armourClass,'AC'],['Initiative',signed(c.combat.initiative),'Initiative'],['Speed',c.combat.speed==null?'':`${c.combat.speed} ft`,'Speed'],['Proficiency',signed(c.proficiencyBonus),'ProfBonus']],
  [['Max HP',c.combat.maxHP,'HPMax'],['Current HP',c.combat.currentHP??'','HPCurrent'],['Temp HP',c.combat.temporaryHP||'','HPTemp']],
  [['Hit dice',c.combat.hitDice,'HitDice'],['Death saves',null,'DeathSaves']]];
 const unit=(RIGHT-M-2*gap)/9.4;
 let vx=M;
 vgroups.forEach((cells,g)=>{const w=g===2?2.4*unit:cells.length*unit,cw=w/cells.length;
  rbox(p,vx,vy,w,vh,{fill:g===1?tint:undefined,border:g===1?undefined:hair});
  cells.forEach(([name,value,id],i)=>{const x=vx+i*cw;if(i)vrule(p,x,vy+6,vy+vh-6);
   centred(p,name,x,vy+vh-9.5,cw,5.6,g===1?accent:muted);
   if(id==='DeathSaves')[['Success',vy+17.5],['Failure',vy+7.5]].forEach(([kind,y])=>{label(p,kind[0],x+cw/2-20,y-2.2,6);for(let k=0;k<3;k++)dot(p,`DeathSave.${kind}.${k+1}`,x+cw/2-7+k*10,y,false,3);});
   else field(p,id,value,x+3,vy+4,cw-6,19,{size:id==='AC'||id==='HPMax'?16:14,align:'center',f:id==='AC'||id==='HPMax'?bold:font});});
  vx+=w+gap;});

 // Left column: abilities, saves and skills as one grouped table.
 const RX=M,RW=RIGHT-M;
// Equipment spans the foot of page one, so both columns stop above this line.
const FLOOR=BOTTOM+150;
 let ly=703;heading(p,'Abilities · saves · skills',M,ly,RIGHT-M,'P proficient · E expertise');
 ly-=7;
 // Six blocks across the page, three a side: each has a key row, the saving throw, then skills in two columns.
 const row=11,badgeW=46,keyH=6,BH=keyH+4*row,colW=104,GAP=12,PW=RIGHT-M-(badgeW+7+colW)-(badgeW+7+2*colW)-2*GAP;
 // Blocks fill a skill column with three skills before starting the next, so the left-hand abilities (three skills or fewer) are narrower.
 const blockW=idx=>badgeW+7+(idx<3?1:2)*colW;
 const cell=(ox,col)=>{const px=ox+badgeW+7+col*colW+5;return {px,ex:px+9,bx:px+14,nx:px+33};};
 const order=options.abilityOrder==='modifier-first'?['modifier','score']:['score','modifier'];
 Object.entries(groups).forEach(([ability,skills],idx)=>{
  const ox=idx<3?M:M+(badgeW+7+colW)+GAP,top=ly-(idx%3)*(BH+5),a=c.abilities[ability];
  const save=c.saves.find(s=>s.name===ability)??{bonus:0,proficient:false};
  const list=skills.map(n=>c.skills.find(s=>s.name===n)).filter(Boolean),perCol=3;
  const rows=[{name:'Saving throw',key:'save',bonus:save.bonus,proficient:save.proficient,expertise:false,isSave:true,col:0,line:0},...list.map((s,i)=>({...s,key:s.name,col:Math.floor(i/perCol),line:1+i%perCol}))];
  rbox(p,ox,top-BH,badgeW,BH,{fill:tint,border:undefined});
  centred(p,ability.slice(0,3),ox,top-9,badgeW,6.5,accent);
  const [first,second]=order.map(k=>[k,k==='modifier'?signed(a.modifier):a.score]);
  field(p,`${ability}.${first[0]}`,first[1],ox+2,top-29,badgeW-4,18,{size:15,align:'center',f:bold});
  rbox(p,ox+badgeW/2-11,top-42,22,10,{fill:white,r:5,bw:.5});
  field(p,`${ability}.${second[0]}`,second[1],ox+badgeW/2-11,top-42,22,10,{size:7.5,align:'center'});
  // The P / E key appears over each column that holds bullets.
  for(const col of list.length>perCol?[0,1]:[0]){const k=cell(ox,col);centred(p,'P',k.px-5,top-4.6,10,5.4,accent);centred(p,'E',k.ex-5,top-4.6,10,5.4,accent);}
  rows.forEach(r=>{const y=top-keyH-(r.line+1)*row,k=cell(ox,r.col),cy=y+row/2;
   if(r.isSave)diamond(p,`Proficient.${ability}.save`,k.px,cy,r.proficient);
   else{dot(p,`Proficient.${ability}.${r.key}`,k.px,cy,r.proficient||r.expertise);dot(p,`Expertise.${ability}.${r.key}`,k.ex,cy,r.expertise);}
   field(p,`${ability}.${r.key}`,signed(r.bonus??0),k.bx,y+.3,19,row-.6,{size:8,align:'center',f:r.isSave?bold:font});
   text(p,r.name,k.nx,y+3.1,7.6,r.isSave?bold:font);
   // Situational notes (armour disadvantage, advantage, conditional bonuses) are flagged beside the skill.
   {const tags=[r.disadvantage&&'Disadv.',r.advantage&&'Adv.',...(r.notes??[])].filter(Boolean).join(' · ');if(tags)text(p,tags,k.nx+width(r.name,7.6)+3,y+3.4,5.6,font,accent);}
  });
  if(list.length)rule(p,ox+badgeW+7,ox+blockW(idx),top-keyH-row,hair,.4);
 });
 // Passive scores and inspiration: a lighter column beside the abilities, quieter than the ability blocks.
 {const skill=n=>c.skills.find(s=>s.name===n)?.bonus??0,px=RIGHT-PW,total=3*BH+2*5,bh=(total-3*5)/4;
  const boxes=[['Perception',c.passivePerception],['Insight',c.passiveInsight??10+skill('Insight')],['Investigation',c.passiveInvestigation??10+skill('Investigation')]];
  boxes.forEach(([n,v],i)=>{const top=ly-i*(bh+5);
   rbox(p,px,top-bh,PW,bh,{});centred(p,`Passive ${n}`,px,top-9,PW,5.4,muted);
   field(p,`Passive${n}`,v,px+4,top-bh+3,PW-8,17,{size:13,align:'center'});});
  // Inspiration is a box to write in, as on the official sheets.
  const top=ly-3*(bh+5);rbox(p,px,top-bh,PW,bh,{fill:tint,border:undefined});centred(p,'Inspiration',px,top-9,PW,5.8,accent);
  rbox(p,px+PW/2-14,top-bh+4,28,15,{fill:white,r:7,bw:.5});field(p,'Inspiration',c.inspiration?1:'',px+PW/2-14,top-bh+4,28,15,{size:10,align:'center',f:bold});}
 ly-=3*BH+2*5+16;
 let colTop=ly;
 // Training grouped as on the official sheet, then what protects the character.
 const def=c.defences??{},list=(n,v)=>v?.length?`${n}: ${v.join(', ')}`:'',pg=c.proficiencyGroups;
 const training=pg?[list('Armour',pg.armour),list('Weapons',pg.weapons),list('Tools',pg.tools)]:[c.proficiencies&&`Armour, weapons & tools: ${c.proficiencies}`];
 const profs=[...training,c.languages&&`Languages: ${c.languages}`].filter(Boolean).join('\n');
 const defence=[list('Senses',c.senses),list('Speeds',c.speeds),list('Resistances',def.resistances),list('Immunities',def.immunities),list('Vulnerabilities',def.vulnerabilities),list('Saving throws',def.saveNotes)].filter(Boolean).join('\n');
 let ry=colTop;
 // What applies right now: senses, resistances and conditional saves in one short line.
 {const cap=t=>String(t).replace(/\b[a-z]/g,m=>m.toUpperCase()),short=t=>String(t).replace(/\.$/,'');
  const save=t=>{const m=String(t).match(/^(Advantage|Disadvantage) on saving throws\s*(?:against|vs\.?)?\s*(.*)$/i);return m?`${/^adv/i.test(m[1])?'Adv.':'Disadv.'} ${m[2]?`vs ${cap(m[2])} Saves`:'on Saves'}`:short(t);};
  const parts=[...(c.senses??[]).map(short),...(def.resistances??[]).map(r=>`${cap(r)} Resistance`),...(def.immunities??[]).map(r=>`${cap(r)} Immunity`),...(def.vulnerabilities??[]).map(r=>`${cap(r)} Vulnerability`),...(def.saveNotes??[]).map(save)].filter(Boolean);
  if(parts.length){const text1=clean(parts.join('  ·  ')),lw0=width('SENSES & DEFENCES',5.8,bold)+14,lines=wrapText(text1,font,7.4,RW-lw0-12),h=Math.max(16,Math.min(3,lines.length)*lineHeight(font,7.4)+7);
   rbox(p,RX,ry-h,RW,h,{});label(p,'Senses & defences',RX+7,ry-h/2-2,5.8,accent);
   field(p,'SensesDefences',lines.slice(0,3).join('\n'),RX+lw0+8,ry-h+2,RW-lw0-8,h-4,{size:7.4,multi:true});ry-=h+16;}}
 heading(p,'Attacks',RX,ry,RW,'base rolls');ry-=6;
 // The base-roll caveat is stated once in the heading rather than on every row.
 const note=n=>String(n??'').replace(/;? ?Base roll; conditional bonuses not included\./,'').replace(/^; /,'').trim();
 const attackRow=a=>({name:a.name,hit:a.attackBonus!=null?signed(a.attackBonus):a.save??'',damage:a.damage,notes:note(a.notes)});
 // Damaging spells are short references here; their full text stays on the spells page.
 const spellRef=s=>({name:s.level?`${s.name} (${ordinal(s.level)})`:s.name,hit:s.requiresSave&&!s.requiresAttack?`${s.savingThrow} ${s.saveDC??'?'}`.trim():s.attackBonus!=null?signed(s.attackBonus):'',damage:s.damage??'',notes:`${s.range} · see Spells`});
 const spellsList=c.spellRows??[],isAttackSpell=s=>s.damage&&(s.requiresAttack||s.requiresSave);
 let attackList;
 if(c.attacks?.length){
  attackList=c.attacks.map(a=>a.source==='spell'?{...attackRow(a),notes:`${String(a.notes??'').split(';')[0]} · see Spells`}:attackRow(a));
  const kinds=c.attacks.map(a=>a.source);let at=kinds.lastIndexOf('spell');if(at<0){const u=kinds.indexOf('unarmed');at=u<0?attackList.length-1:u-1;}
  attackList.splice(at+1,0,...spellsList.filter(s=>s.level>0&&s.prepared&&isAttackSpell(s)).map(spellRef));
 }else attackList=[...(c.weapons??[]).map(w=>attackRow({name:w.name+(w.equipped?'':' (stowed)'),attackBonus:w.attackBonus,damage:w.damage,notes:w.notes})),...spellsList.filter(s=>s.level===0&&isAttackSpell(s)).map(spellRef)];
 const nlh=lineHeight(font,7),NX=RX+322,NWd=RW-322;
 // One table: weapons, unarmed strikes and spell attacks are all just attacks, followed by blank rows to pencil in.
 {rbox(p,RX,ry-10,RW,10,{fill:tint,border:undefined,r:2});label(p,'Name',RX+4,ry-7,5.2);centred(p,'Hit / DC',RX+134,ry-7,36,5.2);label(p,'Damage',RX+178,ry-7,5.2);label(p,'Range · properties · notes',NX+2,ry-7,5.2);ry-=10;
  const rows=Math.min(12,Math.max(4,attackList.length+3));
  for(let i=0;i<rows;i++){const a=attackList[i]??{},notes=wrapText(clean((a.notes??'').replace(/; /g,'  ·  ')),font,7,NWd-4),shown=notes.length>3?[notes[0],notes[1],notes[2].replace(/[ ,;.]*$/,'')+' …']:notes,h=Math.max(2,shown.length)*nlh+6,y=ry-h;
   field(p,`Attack.${i+1}.Name`,a.name??'',RX+2,y+h-14,130,13,{size:8.4,f:bold});field(p,`Attack.${i+1}.Hit`,a.hit??'',RX+134,y+h-14,36,13,{size:8.4,align:'center'});
   field(p,`Attack.${i+1}.Damage`,a.damage??'',RX+176,y+h-14,142,13,{size:8});
   field(p,`Attack.${i+1}.Notes`,shown.join('\n'),NX,y+1,NWd,h-1,{size:7,multi:true});
   rule(p,RX,RX+RW,y,hair,.4);ry-=h;if(notes.length>3)overflow.push([`${a.name} (notes)`,a.notes]);}
  if(attackList.length>rows)overflow.push(['Attacks (continued)',attackList.slice(rows).map(a=>`${a.name}: ${a.hit} ${a.damage} ${a.notes}`.trim()).join('\n')]);}
 ry-=14;

 // Actions by what they cost, in two columns, with limited uses tracked beside them.
 const spells=c.spellRows??[];
 const resetShort={'Short rest':'SR','Long rest':'LR','Dawn':'dawn'};
 const uses=c.featureUses??[],acts=c.actions??[];
 const actionGroups=[['Action',[]],['Bonus action',[]],['Reaction',[]],['Special',[]]];
 for(const a of acts)actionGroups.find(([g])=>g===a.activation)?.[1].push(a);

 const loose=uses.filter(u=>!acts.some(a=>a.name===u.name)).map(u=>[u.name+(resetShort[u.reset]?` (${resetShort[u.reset]})`:''),u.maximum,u.remaining==null?0:u.maximum-u.remaining,`Uses.${named(u.name)}`]);
 const hasActions=loose.length||actionGroups.some(g=>g[1].length);
 if(hasActions){heading(p,'Actions & resources',RX,ry,RW,'filled = used'+(uses.length?' · SR short rest · LR long rest':''));ry-=11;}
 const lw=(RW-2*18)/3;
 const tracker=(id,max,used,right,y)=>{if(max<=10){for(let k=0;k<max;k++)dot(p,`${id}.${k+1}`,right-(max-1-k)*8-3,y+2.6,k<used);return max*8;}field(p,id,`${max-used} / ${max}`,right-40,y-3,40,11,{size:8,align:'center'});return 40;};
 loose.forEach(([n,max,used,id],i)=>{const x=RX+(i%3)*(lw+18),y=ry-Math.floor(i/3)*12;
  const name=clean(n);let sz=7.5;while(sz>6&&font.widthOfTextAtSize(name,sz)>lw-Math.min(max,10)*8-6)sz-=.5;text(p,name,x,y,sz);tracker(id,max,used,x+lw,y);});
 if(loose.length)ry-=Math.ceil(loose.length/3)*12+2;
 // Class dice that grow with level (Sneak Attack 3d6) show beside the action they belong to.
 const scaleOf=n=>c.classScales?.find(v=>v.name===n&&/^\d*d\d+$/.test(v.value))?.value;
 // Space below is kept for the equipment; actions that do not fit continue overleaf.
 const floor=FLOOR+10,later=[],aw=(RW-16)/2,y0=ry;
 const entryHeight=e=>13+(e.summary?Math.min(3,wrapText(clean(e.summary),font,6.6,aw-10).length)*lineHeight(font,6.6)+6:2);
 const groupHeight=entries=>entries.length?22+entries.reduce((n,e)=>n+entryHeight(e),0):0;
 // Fill the left column up to half the total height, then continue in the right.
 const columns=[[],[]],used=[0,0],everything=actionGroups.reduce((n,[,e])=>n+groupHeight(e),0);
 for(const g of actionGroups){if(!g[1].length)continue;const k=used[0]>0&&used[0]+groupHeight(g[1])>everything/2+4?1:0;columns[k].push(g);used[k]+=groupHeight(g[1]);}
 let lowest=y0;
 columns.forEach((groups,k)=>{const ax=RX+k*(aw+16);let cy=y0,full=false;
  for(const [g,entries] of groups){
   const shown=[];for(const e of entries)if(!full&&cy-22-[...shown,e].reduce((n,x)=>n+entryHeight(x),0)>=floor)shown.push(e);else{full=true;later.push([g,e]);}
   if(!shown.length)continue;
   const title=g+(g==='Special'?'':'s');
   cy-=8;label(p,title,ax,cy-6,5.8,accent);rule(p,ax+width(title.toUpperCase(),5.8,bold)+5,ax+aw,cy-4,tint,.7);cy-=14;
   for(const e of shown){
    const use=uses.find(u=>u.name===e.name);
    text(p,e.name,ax+6,cy-7,7.8,bold);
    const aside=e.note??scaleOf(e.name);if(aside)text(p,aside,ax+10+width(e.name,7.8,bold),cy-7,6.3,font,muted);
    if(use){const r=resetShort[use.reset]??'';if(r)rightLabel(p,r,ax+aw,cy-7.4,5.6);tracker(`Uses.${named(use.name)}`,use.maximum,use.remaining==null?0:use.maximum-use.remaining,ax+aw-(r?width(r,5.6,bold)+5:0),cy-7.6);}
    cy-=12;
    if(e.summary){const lines=wrapText(clean(e.summary),font,6.6,aw-10),shown=lines.length>3?[...lines.slice(0,2),lines[2]+' …']:lines,h=shown.length*lineHeight(font,6.6)+2;
     field(p,`Action.${named(e.name)}`,shown.join('\n'),ax+4,cy-h,aw-4,h,{size:6.6,multi:true});cy-=h+6;}else cy-=2;
   }
  }
  lowest=Math.min(lowest,cy);});
 ry=lowest;
 // Actions that do not fit are already described under features; only those with no entry there continue overleaf.
 const carried=later.filter(([,e])=>!e.note&&!(c.featureRows??[]).some(f=>f.name===e.name));
 if(carried.length){overflow.push(['Actions (continued)',carried.map(([g,e])=>`${e.name} (${g.toLowerCase()}): ${e.summary}`).join('\n')]);text(p,`+ ${plural(carried.length,'more action')} overleaf`,RX+6,ry-8,6.3,font,muted);ry-=11;}
 ry-=18;

 // The foot of the page is split in half: equipment (coins, then two columns of items) beside a notes block.
 {const weights=options.equipmentWeight!==false,quantity=options.equipmentQuantity!==false;
  const HW=(RIGHT-M-16)/2,NX0=M+HW+16;
  let ey=Math.min(ly,ry)-2;
  const rowsIn=c.inventoryRows??[],lbs=n=>`${Math.round(n*100)/100}`;
  const keyNotes=[rowsIn.some(r=>r.equipped)&&'filled = equipped',rowsIn.some(r=>r.attunement||r.attuned)&&'diamond = attuned',weights&&c.carrying&&`carried ${lbs(c.carrying.weight)} / ${lbs(c.carrying.capacity)} lb`].filter(Boolean).join(' · ');
  heading(p,'Equipment',M,ey,HW,keyNotes);
  heading(p,'Notes',NX0,ey,HW);
  const notesTop=ey-4;field(p,'Notes','',NX0-2,BOTTOM,HW+4,notesTop-BOTTOM,{multi:true});ruled(p,NX0,HW,notesTop);
  ey-=8;
  const coins=['pp','gp','ep','sp','cp'],cw=HW/5;
  rbox(p,M,ey-18,HW,18);
  coins.forEach((k,i)=>{const x=M+i*cw;if(i)vrule(p,x,ey-14,ey-4);label(p,k,x+5,ey-11.3,5.8);field(p,`Coins.${k.toUpperCase()}`,Number(c.coins?.[k])||'',x+15,ey-16,cw-18,14,{size:9,align:'center'});});
  ey-=24;
  const gap=12,colW=(HW-gap)/2,qw=quantity?15:0,ww=weights?27:0,nameW=colW-9-qw-ww-(quantity?2:0)-(weights?2:0)-(rowsIn.some(r=>r.attunement||r.attuned)?8:0);
  const lb=n=>n?`${Math.round(n*100)/100} lb`:'';
  const items=c.inventoryRows?.length?c.inventoryRows.map(r=>({name:r.name,qty:r.quantity==null?'':r.quantity,weight:lb(r.weight),equipped:r.equipped,attunable:!!(r.attunement||r.attuned),attuned:!!r.attuned}))
   :displayItems(c.equipment).split('\n').filter(t=>t.trim()).map(t=>({name:t,qty:'',weight:'',equipped:false}));
  const rowH=11,perCol=Math.min(16,Math.max(3,Math.floor((ey-BOTTOM-9)/rowH)));
  [0,1].forEach(col=>{const x=M+col*(colW+gap);
   if(quantity)label(p,'Qty',x+9,ey-5,4.8);label(p,'Item',x+9+qw+(quantity?2:0),ey-5,4.8);if(weights)rightLabel(p,'Weight',x+colW,ey-5,4.8);});
  const top=ey-8;
  for(let k=0;k<perCol*2;k++){const col=Math.floor(k/perCol),r=k%perCol,x=M+col*(colW+gap),y=top-(r+1)*rowH,it=items[k],id=`Item.${k+1}`;
   rule(p,x,x+colW,y,hair,.4);
   if(it)dot(p,`${id}.Equipped`,x+3,y+rowH/2,it.equipped,2.2);
   if(quantity)field(p,`${id}.Qty`,it?.qty??'',x+7,y+.5,qw,rowH-1,{size:7.2,align:'center'});
   field(p,`${id}.Name`,it?.name??'',x+9+qw+(quantity?2:0)-2,y+.5,nameW+2,rowH-1,{size:7.2});
   if(it?.attunable)diamond(p,`${id}.Attuned`,x+colW-ww-(weights?2:0)-4.5,y+rowH/2,it.attuned,2.5);
   if(weights)field(p,`${id}.Weight`,it?.weight??'',x+colW-ww,y+.5,ww,rowH-1,{size:6.8,align:'center'});}
  if(items.length>perCol*2)overflow.push(['Equipment (continued)',items.slice(perCol*2).map(it=>`${it.qty===''?'':it.qty+' × '}${it.name}${it.weight?' — '+it.weight:''}`).join('\n')]);
 }

 // Spells: one page of tables, each spell a stat line with its full description beneath. Prepared bullets, slots and the casting summary live here.
 if(spells.length||c.spellSlots?.length){
  const STOP=782,SW=RIGHT-M,preparer=c.classes.some(v=>preparers.has(v.name));let sp=null,sy=0;
  const newPage=cont=>{sp=doc.addPage(A4);text(sp,'Cantrips & spells'+(cont?' (continued)':''),M,800,13,bold,accent);const n=clean(c.identity.name);text(sp,n,RIGHT-width(n,7.5),801,7.5,font,muted);rule(sp,M,RIGHT,792,accent,1.2);sy=STOP;};
  newPage(false);
  const atk=[...new Set(spells.map(s=>s.attackBonus).filter(v=>v!=null))],dc=[...new Set(spells.map(s=>s.saveDC).filter(v=>v!=null))],ability=[...new Set(spells.map(s=>s.ability).filter(Boolean))];
  const stats=[['Spellcasting ability',ability.join(' / '),'SpellAbility'],['Spell save DC',dc.length===1?dc[0]:'','SpellSaveDC'],['Spell attack bonus',atk.length===1?signed(atk[0]):'','SpellAttack']],sw=SW/3;
  rbox(sp,M,sy-20,SW,20);
  stats.forEach(([n,v,id],i)=>{const x=M+i*sw;if(i)vrule(sp,x,sy-16,sy-4);label(sp,n,x+8,sy-12.5,5.8);field(sp,id,v,x+sw-60,sy-17,54,15,{size:11,align:'center',f:bold});});
  {const key=[spells.some(s=>s.concentration)&&'C concentration',spells.some(s=>s.ritual)&&'R ritual',preparer&&spells.some(s=>s.level>0)&&'circle = prepared'].filter(Boolean).join(' · ');if(key)rightLabel(sp,key,RIGHT,sy-28,5.4);}
  sy-=36;
  const cols={name:M+11,time:M+142,range:M+194,hit:M+248,dmg:M+294,dur:M+384,comp:M+470};
  const colEnd={name:cols.time,time:cols.range,range:cols.hit,hit:cols.dmg,dmg:cols.dur,dur:cols.comp,comp:RIGHT};
  const slotsFor=l=>c.spellSlots?.find(v=>v.level===l);
  const groupBar=(lvl,cont)=>{
   rbox(sp,M,sy-13,SW,13,{fill:tint,border:undefined,r:2});
   const title=(lvl===0?'Cantrips':`${ordinal(lvl)} level`)+(cont?' (continued)':'');label(sp,title,M+5,sy-9,6.5,accent);
   const slot=slotsFor(lvl);
   if(slot&&!cont){const n=Math.min(slot.total,9);rightLabel(sp,'slots',RIGHT-5,sy-9,5.4);for(let i=0;i<n;i++)dot(sp,`Slots.${lvl}.${i+1}`,RIGHT-36-(n-1-i)*9,sy-6.5,slot.used!=null&&i<slot.used,2.8);}
   sy-=17;
   [['Spell','name'],['Time','time'],['Range','range'],['Hit / DC','hit'],['Damage','dmg'],['Duration','dur'],['Comp.','comp']].forEach(([n,k])=>label(sp,n,cols[k],sy-4,5.2));
   sy-=8;rule(sp,M,RIGHT,sy,hair,.5);
  };
  const lh7=lineHeight(font,7.2);
  const byLevel=Object.groupBy([...spells].sort((a,b)=>a.level-b.level),s=>s.level);for(const s of c.spellSlots??[])byLevel[s.level]??=[];
  for(const [lvlKey,list] of Object.entries(byLevel).sort((a,b)=>a[0]-b[0])){
   const lvl=Number(lvlKey);
   if(sy-BOTTOM<90)newPage(true);
   groupBar(lvl,false);
   for(const s of list){
    const n=named(s.name),letters=(s.components.match(/\b[VSM]\b/g)||[]).join(', ')||s.components,materials=s.components.length>10?`Components: ${s.components}.`:'';
    const body=clean([s.school&&`${s.school}${s.ritual?' (ritual)':''}.`,materials,s.summary,s.restriction].filter(Boolean).join(' '));
    let lines=wrapText(body,font,7.2,SW-34),room=Math.floor((sy-BOTTOM-24)/lh7),rest='';
    if(lines.length>room&&room<Math.min(lines.length,6)){newPage(true);groupBar(lvl,true);room=Math.floor((sy-BOTTOM-24)/lh7);}
    if(lines.length>room){const fit=fitText(body,font,{width:SW-34,height:room*lh7,max:7.2,min:6.6,marker:'(Continued overleaf)'});lines=wrapText(fit.text,font,fit.size||7.2,SW-34);rest=fit.rest;}
    const refH=s.reference?8:0,nh=lines.length*lh7+3,y=sy-13;
    if(preparer&&s.level>0)dot(sp,`Spell.${n}.prepared`,M+4,y+5.5,s.prepared,2.4);
    // Concentration and ritual are marked with small tags after the name.
    const tags=[s.concentration&&'C',s.ritual&&'R'].filter(Boolean);
    tags.forEach((t,k)=>{const tx=cols.time-5-(tags.length-k)*10;rbox(sp,tx,y+2,8,8,{fill:accent,border:undefined,r:2});text(sp,t,tx+2.4,y+4,5.6,bold,white);});
    field(sp,`Spell.${n}.name`,s.name,cols.name,y,cols.time-cols.name-3-tags.length*10,12,{size:8.2,f:bold});
    field(sp,`Spell.${n}.time`,s.casting,cols.time,y,colEnd.time-cols.time-3,12,{size:7.2});
    field(sp,`Spell.${n}.range`,s.range,cols.range,y,colEnd.range-cols.range-3,12,{size:7.2});
    field(sp,`Spell.${n}.hit`,s.requiresSave?`${s.savingThrow} ${s.saveDC??''}`.trim():s.requiresAttack&&s.attackBonus!=null?signed(s.attackBonus):'',cols.hit,y,colEnd.hit-cols.hit-3,12,{size:7.2});
    field(sp,`Spell.${n}.damage`,s.damage??'',cols.dmg,y,colEnd.dmg-cols.dmg-3,12,{size:7.2});
    field(sp,`Spell.${n}.duration`,s.duration.replace(/^Concentration, up to /i,''),cols.dur,y,colEnd.dur-cols.dur-3,12,{size:7.2});
    field(sp,`Spell.${n}.components`,letters,cols.comp,y,colEnd.comp-cols.comp,12,{size:7.2});
    // Components that cost gold or are used up are flagged so they are not missed.
    {const cost=s.components.match(/(\d[\d,]*)\s*(gp|sp|cp|ep|pp)\b/i),used=/consum/i.test(s.components),flag=cost?`${cost[1]}${cost[2].toLowerCase()}`:used?'consumed':'';
     if(flag){const fw=width(flag,5.2,bold)+5,fx=cols.comp+width(letters,7.2)+4;rbox(sp,fx,y+2,fw,8,{fill:accent,border:undefined,r:2});text(sp,flag,fx+2.5,y+4.2,5.2,bold,white);}}
    label(sp,'Notes',M+11,y-8.5,5.2);field(sp,`Spell.${n}.effect`,lines.join('\n'),M+30,y-nh,SW-30,nh,{size:7.2,multi:true});
    if(s.reference){const r=clean(s.reference);text(sp,r,RIGHT-width(r,6),y-nh-6.5,6,font,muted);}
    sy=y-nh-refH-3;rule(sp,M,RIGHT,sy,hair,.4);sy-=2;
    if(rest)overflow.push([`${s.name} (continued)`,rest]);
   }
   sy-=8;
  }
 }

 // Detail pages: two-column flow of headed sections.
 const COLW=(RIGHT-M-16)/2,TOP=782,size=8,lh=lineHeight(font,size);
 let page=null,col=0,y=0,serial=0;
 const header=title=>{const pg=doc.addPage(A4);text(pg,title,M,800,13,bold,accent);const n=clean(c.identity.name);text(pg,n,RIGHT-width(n,7.5),801,7.5,font,muted);rule(pg,M,RIGHT,792,accent,1.2);return pg;};
 const next=title=>{if(page&&col===0){col=1;y=page===bandPage?bandY:TOP;return;}page=header(title);col=0;y=TOP;};
 // A new part starts in a spare column of the current page when there is one, under its own title.
 const start=title=>{
  if(page&&(col===0||y-BOTTOM>(TOP-BOTTOM)*.45)){if(col===0){col=1;y=page===bandPage?bandY:TOP;}else y-=8;text(page,title,x(),y-11,11,bold,accent);y-=22;return;}
  page=null;next(title);};
 const x=()=>M+col*(COLW+16);
 let flowed=false;
 const section=(title,body,pageTitle,ref='')=>{
  const lines=wrapText(clean(String(body??'').trim()),font,size,COLW-4);if(!lines.some(Boolean))return;flowed=true;
  // Keep short sections whole rather than strand a heading or a couple of lines.
  const need=lines.length*lh+18;if(need>y-BOTTOM&&need<TOP-BOTTOM)next(pageTitle);else if(y-BOTTOM<36)next(pageTitle);
  let offset=0;
  while(offset<lines.length){
   if(y-BOTTOM<36)next(pageTitle);
   const count=Math.min(Math.max(1,Math.floor((y-BOTTOM-14)/lh)),lines.length-offset),h=count*lh+3;
   text(page,title+(offset?' (continued)':''),x(),y-8,8.5,bold);
   if(ref&&!offset){const r=clean(ref);text(page,r,x()+COLW-width(r,6),y-8,6,font,muted);}
   rule(page,x(),x()+COLW,y-11,hair,.4);
   field(page,`Details.${++serial}.${named(title)}`,lines.slice(offset,offset+count).join('\n'),x()-2,y-13-h,COLW+4,h,{size,multi:true});
   y-=h+19;offset+=count;
  }
 };
 const group=(name,pageTitle,note='')=>{flowed=true;if(y-BOTTOM<64)next(pageTitle);rbox(page,x(),y-13,COLW,13,{fill:tint,border:undefined,r:2});label(page,name,x()+5,y-9,6.5,accent);if(note)rightLabel(page,note,x()+COLW-5,y-9,5.6);y-=20;};
 // Proficiencies, languages and defences head the features page in three columns.
 const bandCols=[['Proficiencies',training.filter(Boolean).join('\n'),'Proficiencies'],['Languages',c.languages??'','Languages'],['Senses & defences',defence,'Defences']].filter(v=>v[1]);
 let bandPage=null,bandY=0;
 const d=c.details??{},personal=['personalityTraits','ideals','bonds','flaws'];
 const physical=['gender','age','size','height','weight','eyes','skin','hair','faith','lifestyle'],tableKeys=['gender','age','size','height','weight','eyes','skin','hair','faith','lifestyle'];
 const physicalValue=k=>k==='weight'&&/^\d+(\.\d+)?$/.test(String(d[k]).trim())?`${d[k]} lb`:d[k];
 const detailNotes=Object.entries(d).filter(([k,v])=>v&&!personal.includes(k));
 if(c.featureRows?.length||c.features||overflow.length||detailNotes.length||personal.some(k=>d[k])||bandCols.length||tableKeys.some(k=>d[k])){start('Features & notes');
  // Appearance at a glance: a table of short fields across the top of the page.
  if(tableKeys.some(k=>d[k])){const keys=tableKeys.filter(k=>d[k]),per=keys.length<=5?keys.length:Math.ceil(keys.length/2),cw=(RIGHT-M-(per-1)*8)/per;heading(page,'Appearance',M,y,RIGHT-M);y-=8;
   keys.forEach((k,i)=>{const x=M+(i%per)*(cw+8),top=y-Math.floor(i/per)*30;rbox(page,x,top-24,cw,24,{});label(page,titleCase(k),x+5,top-8,5.4);
    field(page,`Appearance.${titleCase(k)}`,d[k]?String(physicalValue(k)):'',x+3,top-22,cw-6,13,{size:9});});
   y-=Math.ceil(keys.length/per)*30+16;bandPage=page;bandY=y;}
  if(bandCols.length){const bw=(RIGHT-M-16*(bandCols.length-1))/bandCols.length,bsize=7.6,blh=lineHeight(font,bsize);
   const parts=bandCols.map(([t,b,id])=>({t,id,text:clean(b),lines:wrapText(clean(b),font,bsize,bw-4)})),bh=Math.min(150,Math.max(...parts.map(v=>v.lines.length))*blh+4);
   parts.forEach((v,i)=>{const x=M+i*(bw+16);heading(page,v.t,x,y,bw);
    const fit=v.lines.length*blh+4>bh?fitText(v.text,font,{width:bw-4,height:bh-4,max:bsize,min:6.5}):{text:v.lines.join('\n'),size:bsize};
    field(page,v.id,fit.text,x-2,y-6-bh,bw+4,bh,{size:fit.size,multi:true});if(fit.rest)overflow.push([`${v.t} (continued)`,fit.rest]);});
   y-=bh+22;bandPage=page;bandY=y;}
  if(c.featureRows?.length)for(const [g,fs] of Object.entries(Object.groupBy(c.featureRows,f=>f.group||'Features'))){
   // Traits whose only effect is a proficiency share one entry; the proficiency lists carry the rule.
   const covered=fs.filter(f=>f.summary===PROFICIENCY_ONLY),shown=fs.filter(f=>!covered.includes(f)),refs=[...new Set(covered.map(f=>f.reference).filter(Boolean))];
   group(g,'Features & notes',plural(shown.length+(covered.length?1:0),'entry','entries'));
   for(const f of shown)section(f.name,f.summary,'Features & notes',f.reference);
   if(covered.length)section('Proficiency traits',`${covered.map(f=>f.name).join(' · ')}. Included in the proficiency lists.`,'Features & notes',refs.join('; '));}
  else section('Features & traits',c.features,'Features & notes');
  const magic=(c.inventoryRows??[]).filter(r=>r.magic);
  if(magic.length){group('Magic items','Features & notes',plural(magic.length,'item'));for(const r of magic)section(r.name,r.summary,'Features & notes',[r.rarity,r.attunement?(r.attuned?'attuned':'requires attunement'):''].filter(Boolean).join(', '));}
  for(const [t,b] of overflow)section(t,b,'Features & notes');
  // The Character heading spans both columns and governs everything beneath it; it starts a fresh page once features have been laid out.
  if(detailNotes.length||personal.some(k=>d[k])||d.appearance||physical.some(k=>d[k]&&!tableKeys.includes(k))){
   if(flowed){page=null;next('Character');}
   rbox(page,M,y-13,RIGHT-M,13,{fill:tint,border:undefined,r:2});label(page,'Character',M+5,y-9,6.5,accent);rightLabel(page,'personality · appearance · background · notes',RIGHT-5,y-9,5.6);
   y-=20;col=0;bandPage=page;bandY=y;
   for(const k of personal)section(titleCase(k),d[k],'Character');
   section('Appearance',[physical.filter(k=>d[k]&&!tableKeys.includes(k)).map(k=>`${titleCase(k)}: ${physicalValue(k)}`).join('  ·  '),d.appearance].filter(Boolean).join('\n\n'),'Character');
   // Personality and appearance fill the left column; the longer notes follow in the right.
   if(col===0&&y<bandY){col=1;y=bandY;}
   const order=['allies','personalPossessions','otherHoldings','organizations','enemies','backstory','otherNotes'],names={backstory:'Background',organizations:'Organisations',personalPossessions:'Personal Possessions',otherHoldings:'Other Holdings',otherNotes:'Other Notes'};
   const rank=k=>order.includes(k)?order.indexOf(k):order.length;
   for(const [k,v] of [...detailNotes].sort((x,y)=>rank(x[0])-rank(y[0])))if(![...physical,'appearance'].includes(k))section(names[k]??titleCase(k),v,'Character');}
 }
 if(c.spells&&!spells.length){start('Spellbook');section('Spells',c.spells,'Spellbook');}
 doc.setTitle(`${clean(c.identity.name)} — SheetSmith — 5e (2014)`);
 return {bytes:await savePdf(PDFLib,doc,form,font),warnings};
}
