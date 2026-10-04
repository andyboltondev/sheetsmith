import { createCleaner, displayItems, embedPortrait, fieldFactory, savePdf, fitText, lineHeight, ordinal, signed as sign, wrapText } from './generator.js';
import { BLANK } from './fresh.js';
import { PROFICIENCY_ONLY } from './supplied.js';
// Compact: a minimal one-page summary (abilities, saves and skills in one table with proficiency dots),
// followed by compact two-column detail and spellbook pages. Everything stays editable.
const groups={strength:['Athletics'],dexterity:['Acrobatics','Sleight of Hand','Stealth'],constitution:[],intelligence:['Arcana','History','Investigation','Nature','Religion'],wisdom:['Animal Handling','Insight','Medicine','Perception','Survival'],charisma:['Deception','Intimidation','Performance','Persuasion']};
const signed=n=>n==null||n===''?'':sign(n);
const titleCase=key=>key.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase());
const plural=(n,one,many=one+'s')=>`${n} ${n===1?one:many}`;
// Classes that prepare spells from a list; everyone else simply knows theirs, so no prepared marker.
const preparers=new Set(['Artificer','Cleric','Druid','Paladin','Wizard']);
const A4=[595.28,841.89],M=30,RIGHT=A4[0]-M,BOTTOM=38;
export async function generateGroupedPdf(PDFLib,c,options){
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
  if(showXP){rightLabel(p,milestone?'Advancement':'XP',x,801);field(p,'Experience',c.experience===''?'':milestone?'Milestone':c.experience,x-62,784,64,15,{size:milestone?10:12,align:'right'});x-=70;}
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
 const LX=M,LW=244,RX=LX+LW+14,RW=RIGHT-RX;
 let ly=703;heading(p,'Abilities · saves · skills',LX,ly,LW-84);
 {const y=ly+2.3,kx=LX+LW-78;p.drawCircle({x:kx,y,size:2.6,color:accent,borderColor:ink,borderWidth:.55});text(p,'proficient',kx+5,ly,6,font,muted);
  p.drawCircle({x:kx+48,y,size:2.6,color:accent,borderColor:ink,borderWidth:.55});p.drawCircle({x:kx+48,y,size:4.2,borderColor:ink,borderWidth:.45});text(p,'expertise',kx+55,ly,6,font,muted);}
 ly-=7;
 const row=11,badgeW=46,dotX=LX+badgeW+11;
 const order=options.abilityOrder==='modifier-first'?['modifier','score']:['score','modifier'];
 for(const [ability,skills] of Object.entries(groups)){
  const save=c.saves.find(s=>s.name===ability)??{bonus:0,proficient:false};
  const rows=[{name:'Saving throw',key:'save',bonus:save.bonus,proficient:save.proficient,expertise:false},...skills.map(n=>c.skills.find(s=>s.name===n)).filter(Boolean).map(s=>({...s,key:s.name}))];
  const h=Math.max(rows.length*row,40),top=ly,a=c.abilities[ability];
  rbox(p,LX,top-h,badgeW,h,{fill:tint,border:undefined});
  centred(p,ability.slice(0,3),LX,top-8.5,badgeW,6.5,accent);
  const [first,second]=order.map(k=>[k,k==='modifier'?signed(a.modifier):a.score]);
  field(p,`${ability}.${first[0]}`,first[1],LX+2,top-27,badgeW-4,18,{size:15,align:'center',f:bold});
  rbox(p,LX+badgeW/2-11,top-38,22,10,{fill:white,r:5,bw:.5});
  field(p,`${ability}.${second[0]}`,second[1],LX+badgeW/2-11,top-38,22,10,{size:7.5,align:'center'});
  rows.forEach((r,j)=>{const y=top-(j+1)*row;
   if(r.expertise)p.drawCircle({x:dotX,y:y+row/2,size:4.2,borderColor:ink,borderWidth:.45});
   dot(p,`Proficient.${ability}.${r.key}`,dotX,y+row/2,r.proficient||r.expertise);
   field(p,`${ability}.${r.key}`,signed(r.bonus??0),dotX+5,y+.3,22,row-.6,{size:8,align:'center',f:j===0?bold:font});
   text(p,r.name,dotX+30,y+3.1,8,j===0?bold:font);
   // Armour that imposes disadvantage is flagged on the row itself (Stealth in chain mail).
   if(r.disadvantage){const t=clean(r.disadvantage).replace(/^Disadvantage/,'Disadv.');text(p,t,LX+LW-width(t,6),y+3.4,6,font,accent);}
   if(j===0&&rows.length>1)rule(p,dotX-4,LX+LW,y,hair,.4);
  });
  ly-=h+5;
 }
 const skill=n=>c.skills.find(s=>s.name===n)?.bonus??0;
 ly-=7;heading(p,'Passive scores',LX,ly,LW);ly-=6;
 {const pass=[['Perception',c.passivePerception],['Insight',c.passiveInsight??10+skill('Insight')],['Investigation',c.passiveInvestigation??10+skill('Investigation')]],w=LW/3;
  rbox(p,LX,ly-18,LW,18);
  pass.forEach(([n,v],i)=>{const x=LX+i*w;if(i)vrule(p,x,ly-14,ly-4);label(p,n,x+6,ly-11.3,5.8);field(p,`Passive${n}`,v,x+w-30,ly-16,26,14,{size:10,align:'right',f:bold});});
  ly-=31;}
 // Training grouped as on the official sheet, then what protects the character.
 const def=c.defences??{},list=(n,v)=>v?.length?`${n}: ${v.join(', ')}`:'',pg=c.proficiencyGroups;
 const training=pg?[list('Armour',pg.armour),list('Weapons',pg.weapons),list('Tools',pg.tools)]:[c.proficiencies&&`Armour, weapons & tools: ${c.proficiencies}`];
 const profs=[...training,c.languages&&`Languages: ${c.languages}`].filter(Boolean).join('\n');
 heading(p,'Proficiencies · languages',LX,ly,LW);ly-=4;
 ly-=Math.max(block(p,'Proficiencies',profs,LX,ly,LW,Math.min(90,(ly-BOTTOM)/3),{title:'Proficiencies & languages'}),24)+12;
 const defence=[list('Senses',c.senses),list('Speeds',c.speeds),list('Resistances',def.resistances),list('Immunities',def.immunities),list('Vulnerabilities',def.vulnerabilities),list('Saving throws',def.saveNotes)].filter(Boolean).join('\n');
 if(defence){heading(p,'Senses · defences',LX,ly,LW);ly-=4;ly-=block(p,'Defences',defence,LX,ly,LW,Math.min(70,(ly-BOTTOM)/3),{title:'Senses & defences'})+12;}
 // Conditions change every round; exhaustion is a six-step track.
 heading(p,'Conditions',LX,ly,LW);ly-=13;
 label(p,'Exhaustion',LX,ly,5.8);for(let k=0;k<6;k++)dot(p,`Exhaustion.${k+1}`,LX+44+k*9,ly+2.1,false);
 rule(p,LX+104,LX+LW,ly-2,hair,.5);field(p,'Conditions','',LX+102,ly-2,LW-102,11,{size:8});ly-=16;
 // Passive features by name; anything already listed under actions is left out here.
 const passive=(c.featureRows??[]).filter(f=>!(c.actions??[]).some(a=>a.name===f.name));
 const featureList=c.featureRows?.length?Object.entries(Object.groupBy(passive,f=>f.group||'Features')).map(([g,fs])=>`${g}: ${fs.map(f=>f.name).join(' · ')}`).join('\n'):String(c.features??'').split('\n').filter(Boolean).slice(0,6).join('\n');
 if(featureList){heading(p,'Features & traits',LX,ly,LW,'details overleaf');ly-=4;
  const lines=wrapText(clean(featureList),font,7.3,LW-4),need=Math.max(12,lines.length*lineHeight(font,7.3)+4),h=Math.min(need,90);
  const fit=need>h?fitText(clean(featureList),font,{width:LW-4,height:h-4,max:7.3,min:6.5,marker:'(More overleaf)'}):{text:lines.join('\n'),size:7.3};
  field(p,'FeatureSummary',fit.text,LX-2,ly-h,LW+4,h,{size:fit.size,multi:true});ly-=h+12;}
 heading(p,'Notes',LX,ly,LW);ly-=4;
 field(p,'NotesLeft','',LX-2,BOTTOM,LW+4,ly-BOTTOM,{multi:true});ruled(p,LX,LW,ly);

 // Right column: what you do on your turn, what you can spend, then what you carry.
 let ry=703;heading(p,'Attacks & cantrips',RX,ry,RW,'base rolls');ry-=6;
 // The base-roll caveat is stated once in the heading rather than on every row.
 const note=n=>String(n??'').replace(/;? ?Base roll; conditional bonuses not included\./,'').replace(/^; /,'').trim();
 const attacks=c.attacks?.length?c.attacks.map(a=>({name:a.name,hit:a.attackBonus!=null?signed(a.attackBonus):a.save??'',damage:a.damage,notes:note(a.notes)})):[...(c.weapons??[]).map(w=>({name:w.name+(w.equipped?'':' (stowed)'),hit:w.attackBonus==null?'':signed(w.attackBonus),damage:w.damage,notes:note(w.notes)})),
  ...(c.spellRows??[]).filter(s=>s.level===0&&(s.requiresAttack||s.requiresSave)).map(s=>({name:s.name,hit:s.requiresSave?`${s.savingThrow} DC ${s.saveDC??'?'}`:signed(s.attackBonus),damage:s.damage??'',notes:'Cantrip · '+s.range}))];
 const NW=RW-204;
 rbox(p,RX,ry-11,RW,11,{fill:tint,border:undefined,r:2});
 label(p,'Name',RX+4,ry-7.8,5.4);centred(p,'Hit / DC',RX+90,ry-7.8,34,5.4);label(p,'Damage',RX+127,ry-7.8,5.4);label(p,'Notes',RX+206,ry-7.8,5.4);ry-=11;
 const attackRows=Math.min(6,Math.max(3,attacks.length)),nlh=lineHeight(font,6.3);
 for(let i=0;i<attackRows;i++){const a=attacks[i]??{},notes=wrapText(clean(a.notes??''),font,6.3,NW-4),h=Math.max(13,Math.min(3,notes.length)*nlh+3),y=ry-h;
  field(p,`Attack.${i+1}.Name`,a.name??'',RX+2,y+h-13,88,13,{size:8,f:bold});field(p,`Attack.${i+1}.Hit`,a.hit??'',RX+90,y+h-13,34,13,{size:8,align:'center'});
  field(p,`Attack.${i+1}.Damage`,a.damage??'',RX+125,y+h-13,79,13,{size:7.5});field(p,`Attack.${i+1}.Notes`,(notes.length>3?[...notes.slice(0,2),notes[2]+' …']:notes).join('\n'),RX+204,y+1,NW+2,h-1,{size:6.3,multi:true});
  rule(p,RX,RX+RW,y,hair,.4);ry-=h;if(notes.length>3)overflow.push([`${a.name} (notes)`,a.notes]);}
 if(attacks.length>attackRows)overflow.push(['Attacks (continued)',attacks.slice(attackRows).map(a=>`${a.name}: ${a.hit} ${a.damage} ${a.notes}`.trim()).join('\n')]);
 ry-=16;

 // Actions by what they cost, with limited uses tracked beside them. Spells cast as a bonus action
 // or reaction are listed by name so they are not forgotten; their details are in the spell table.
 const spells=c.spellRows??[],preparer=c.classes.some(v=>preparers.has(v.name));
 const resetShort={'Short rest':'SR','Long rest':'LR','Dawn':'dawn'};
 const uses=c.featureUses??[],acts=c.actions??[];
 const spellNote=s=>s.level?`${ordinal(s.level)}-level spell`:'cantrip';
 const actionGroups=[['Action',[]],['Bonus action',[]],['Reaction',[{name:'Opportunity attack',summary:'When a hostile creature you can see leaves your reach, make one melee attack against it.'}]],['Special',[]]];
 for(const a of acts)actionGroups.find(([g])=>g===a.activation)?.[1].push(a);
 for(const s of spells)if(/^(Bonus action|Reaction)$/.test(s.casting))actionGroups.find(([g])=>g===s.casting)[1].push({name:s.name,note:spellNote(s)});
 heading(p,'Actions & resources',RX,ry,RW,'filled = used');ry-=11;
 const loose=[['Inspiration',1,c.inspiration?1:0,'Inspiration'],['Hit dice spent',Math.min(level,20),c.combat.hitDiceUsed??0,'HitDiceUsed'],
  ...uses.filter(u=>!acts.some(a=>a.name===u.name)).map(u=>[u.name+(resetShort[u.reset]?` (${resetShort[u.reset]})`:''),u.maximum,u.remaining==null?0:u.maximum-u.remaining,`Uses.${named(u.name)}`])];
 const half=(RW-12)/2;
 const tracker=(id,max,used,right,y)=>{if(max<=10){for(let k=0;k<max;k++)dot(p,`${id}.${k+1}`,right-(max-1-k)*8-3,y+2.6,k<used);return max*8;}field(p,id,`${max-used} / ${max}`,right-40,y-3,40,11,{size:8,align:'right'});return 40;};
 loose.forEach(([n,max,used,id],i)=>{const x=RX+(i%2)*(half+12),y=ry-Math.floor(i/2)*11;
  const name=clean(n);let s=7.5;while(s>6&&font.widthOfTextAtSize(name,s)>half-Math.min(max,10)*8-6)s-=.5;text(p,name,x,y,s);tracker(id,max,used,x+half,y);});
 ry-=Math.ceil(loose.length/2)*11-4;
 // Class dice that grow with level (Sneak Attack 3d6, Martial Arts 1d6); dice on listed actions show beside them.
 const scaleOf=n=>c.classScales?.find(v=>v.name===n&&/^\d*d\d+$/.test(v.value))?.value;
 const dice=(c.classScales??[]).filter(v=>/^\d*d\d+$/.test(v.value)&&!acts.some(a=>a.name===v.name));
 if(dice.length){ry-=9;let dx=RX;for(const v of dice){const n=clean(v.name),w=width(n,7.5)+width(v.value,7.5,bold)+18;if(dx>RX&&dx+w>RX+RW){dx=RX;ry-=11;}text(p,n,dx,ry,7.5);text(p,v.value,dx+width(n,7.5)+4,ry,7.5,bold);dx+=w;}ry-=2;}
 // Space below is kept for the spell table and equipment; actions that do not fit continue overleaf.
 const casting=spells.length||c.spellSlots?.length,floor=BOTTOM+(casting?210:0)+120,later=[];
 const entryHeight=e=>10+(e.summary?Math.min(3,wrapText(clean(e.summary),font,6.6,RW-10).length)*lineHeight(font,6.6)+4:0);
 for(const [g,entries] of actionGroups){
  const shown=[];for(const e of entries)if(!later.length&&ry-14-[...shown,e].reduce((n,x)=>n+entryHeight(x),0)>=floor)shown.push(e);else later.push([g,e]);
  if(!shown.length)continue;
  const title=g+(g==='Special'?'':'s');
  ry-=4;label(p,title,RX,ry-6,5.8,accent);rule(p,RX+width(title.toUpperCase(),5.8,bold)+5,RX+RW,ry-4,tint,.7);ry-=10;
  for(const e of shown){
   const use=uses.find(u=>u.name===e.name);
   text(p,e.name,RX+6,ry-7,7.8,bold);
   const aside=e.note??scaleOf(e.name);if(aside)text(p,aside,RX+10+width(e.name,7.8,bold),ry-7,6.3,font,muted);
   if(use){const r=resetShort[use.reset]??'';if(r)rightLabel(p,r,RX+RW,ry-6.8,5.6);tracker(`Uses.${named(use.name)}`,use.maximum,use.remaining==null?0:use.maximum-use.remaining,RX+RW-(r?width(r,5.6,bold)+5:0),ry-9);}
   ry-=10;
   if(e.summary){const lines=wrapText(clean(e.summary),font,6.6,RW-10),shown=lines.length>3?[...lines.slice(0,2),lines[2]+' …']:lines,h=shown.length*lineHeight(font,6.6)+2;
    field(p,`Action.${named(e.name)}`,shown.join('\n'),RX+4,ry-h,RW-4,h,{size:6.6,multi:true});ry-=h+2;}
  }
 }
 if(later.length){overflow.push(['Actions (continued)',later.map(([g,e])=>`${e.name} (${g.toLowerCase()}): ${e.summary??e.note}`).join('\n')]);text(p,`+ ${plural(later.length,'more action')} overleaf`,RX+6,ry-8,6.3,font,muted);ry-=11;}
 text(p,'Standard: Attack · Cast a Spell · Dash · Disengage · Dodge · Help · Hide · Ready · Search · Use an Object',RX,ry-8,5.8,font,muted);
 ry-=24;

 // Spells at a glance: one row of stats and one line of effect each; full text in the spellbook.
 if(spells.length||c.spellSlots?.length){
  heading(p,'Spellcasting',RX,ry,RW,`${plural(spells.filter(s=>s.level===0).length,'cantrip')} · ${plural(spells.filter(s=>s.level>0).length,'spell')}`);ry-=6;
  const atk=[...new Set(spells.map(s=>s.attackBonus).filter(v=>v!=null))],dc=[...new Set(spells.map(s=>s.saveDC).filter(v=>v!=null))],ability=[...new Set(spells.map(s=>s.ability).filter(Boolean))];
  const stats=[['Ability',ability.join(' / '),'SpellAbility'],['Save DC',dc.length===1?dc[0]:'','SpellSaveDC'],['Attack',atk.length===1?signed(atk[0]):'','SpellAttack']],sw=RW/3;
  rbox(p,RX,ry-18,RW,18);
  stats.forEach(([n,v,id],i)=>{const x=RX+i*sw;if(i)vrule(p,x,ry-14,ry-4);label(p,n,x+6,ry-11.3,5.8);field(p,id,v,x+sw-40,ry-16,36,14,{size:10,align:'right',f:bold});});
  ry-=18;
  if(c.spellSlots?.length){ry-=11;let sx=RX;
   for(const s of c.spellSlots){const n=Math.min(s.total,9),w=20+n*8;if(sx+w>RX+RW-60){sx=RX;ry-=11;}
    label(p,ordinal(s.level),sx,ry-2.2,6);for(let i=0;i<n;i++)dot(p,`Slots.${s.level}.${i+1}`,sx+17+i*8,ry,s.used!=null&&i<s.used);sx+=w+10;}
   rightLabel(p,'slots · filled = used',RX+RW,ry-2.2,5.4);ry-=4;}
  if(spells.length){ry-=8;
   const cols=[['Spell',RX+4],['Level',RX+112],['Time',RX+146],['Range',RX+196],['Hit / DC',RX+RW-38]];
   rbox(p,RX,ry-11,RW,11,{fill:tint,border:undefined,r:2});cols.forEach(([n,x])=>label(p,n,x,ry-7.8,5.4));ry-=11;
   const sorted=[...spells].sort((a,b)=>a.level-b.level),rowH=20,fits=Math.max(2,Math.floor((ry-BOTTOM-140)/rowH)),shown=sorted.length>fits?sorted.slice(0,fits-1):sorted;
   for(const s of shown){const y=ry-rowH;
    if(preparer&&s.level>0)dot(p,`SpellList.${named(s.name)}.prepared`,RX+4,y+14,s.prepared,2.4);
    const nx=preparer&&s.level>0?RX+9:RX+2;
    field(p,`SpellList.${named(s.name)}.name`,s.name,nx,y+9,RX+110-nx,11,{size:7.8,f:bold});
    field(p,`SpellList.${named(s.name)}.level`,s.level?ordinal(s.level):'Cantrip',RX+110,y+9,34,11,{size:7});
    field(p,`SpellList.${named(s.name)}.time`,s.casting+(s.concentration?' · C':'')+(s.ritual?' · R':''),RX+144,y+9,50,11,{size:7});
    field(p,`SpellList.${named(s.name)}.range`,s.range,RX+194,y+9,RW-236,11,{size:7});
    field(p,`SpellList.${named(s.name)}.hit`,s.requiresSave?`${s.savingThrow} ${s.saveDC??''}`.trim():s.requiresAttack&&s.attackBonus!=null?signed(s.attackBonus):'',RX+RW-40,y+9,40,11,{size:7});
    const effect=wrapText(clean(s.summary),font,6.4,RW-8);
    field(p,`SpellList.${named(s.name)}.effect`,effect.length>1?effect[0].replace(/[ ,;.]*$/,'')+' …':effect[0]??'',RX+2,y+1,RW-2,9,{size:6.4});
    rule(p,RX,RX+RW,y,hair,.4);ry-=rowH;}
   if(shown.length<sorted.length){text(p,`+ ${sorted.length-shown.length} more in the spellbook overleaf`,RX+2,ry-8,6.3,font,muted);ry-=10;}
  }
  ry-=16;
 }
 heading(p,'Equipment',RX,ry,RW,c.inventoryRows?.some(r=>r.equipped)?'• equipped':'');ry-=6;
 const coins=['pp','gp','ep','sp','cp'],cw=RW/5;
 rbox(p,RX,ry-18,RW,18);
 coins.forEach((k,i)=>{const x=RX+i*cw;if(i)vrule(p,x,ry-14,ry-4);label(p,k,x+6,ry-11.3,5.8);field(p,`Coins.${k.toUpperCase()}`,Number(c.coins?.[k])||'',x+18,ry-16,cw-22,14,{size:9,align:'right'});});
 ry-=24;
 // Items in two columns with weights beside them; whatever does not fit continues overleaf.
 {const size=7.2,elh=lineHeight(font,size),cap=Math.max(2,Math.floor((ry-BOTTOM-(c.carrying?30:8))/elh)),ww=26,nameW=half-ww-2;
  const lb=n=>n?`${Math.round(n*100)/100} lb`:'';
  const rows=c.inventoryRows?.length?c.inventoryRows.map(r=>[`${r.quantity==null?BLANK+' × ':r.quantity>1?r.quantity+' × ':''}${r.name}${r.attuned?' (attuned)':''}`,lb(r.weight),r.equipped])
   :displayItems(c.equipment).split('\n').filter(s=>s.trim()).map(s=>[s,'',false]);
  const items=rows.map(([n,w,on])=>{const lines=wrapText(clean((on?'• ':'')+n),font,size,nameW-4);return [lines,[...Array(lines.length-1).fill(''),w]];});
  const total=items.reduce((n,[l])=>n+l.length,0),target=Math.min(cap,Math.ceil(total/2)),out=[[[],[]],[[],[]]],rest=[];let k=0;
  for(const [lines,ws] of items){if(k===0&&out[0][0].length+lines.length>target)k=1;if(k===1&&out[1][0].length+lines.length>cap)k=2;if(k<2){out[k][0].push(...lines);out[k][1].push(...ws);}else rest.push(lines.join(' '));}
  const h=Math.max(out[0][0].length,out[1][0].length,2)*elh+4;
  [['Equipment',RX],['EquipmentMore',RX+half+12]].forEach(([id,x],i)=>{field(p,id,out[i][0].join('\n'),x-2,ry-h,nameW+4,h,{size,multi:true});field(p,id+'Weight',out[i][1].join('\n'),x+nameW,ry-h,ww+2,h,{size,multi:true,align:'right'});});
  if(rest.length)overflow.push(['Equipment (continued)',rest.join('\n')]);
  ry-=h+4;
  const carry=c.carrying,attunable=(c.inventoryRows??[]).filter(r=>r.attuned).length;
  if(carry){rule(p,RX,RX+RW,ry,hair,.5);ry-=9;
   const parts=[['Carried',`${lb(carry.weight)||'0 lb'}`],['Capacity',lb(carry.capacity)],['Push · drag · lift',lb(carry.pushDragLift)],...(attunable?[['Attuned',`${attunable} / 3`]]:[])],pw=RW/parts.length;
   parts.forEach(([n,v],i)=>{label(p,n,RX+i*pw,ry-1,5.4);field(p,`Carry.${n}`,v,RX+i*pw+width(n.toUpperCase(),5.4,bold)+3,ry-4,pw-width(n.toUpperCase(),5.4,bold)-6,10,{size:7.5,f:bold});});
   ry-=10;}
  ry-=12;}
 if(ry-BOTTOM>30){heading(p,'Notes',RX,ry,RW);ry-=4;field(p,'Notes','',RX-2,BOTTOM,RW+4,ry-BOTTOM,{multi:true});ruled(p,RX,RW,ry);}

 // Detail pages: two-column flow of headed sections.
 const COLW=(RIGHT-M-16)/2,TOP=782,size=8,lh=lineHeight(font,size);
 let page=null,col=0,y=0,serial=0;
 const header=title=>{const pg=doc.addPage(A4);text(pg,title,M,800,13,bold,accent);const n=clean(c.identity.name);text(pg,n,RIGHT-width(n,7.5),801,7.5,font,muted);rule(pg,M,RIGHT,792,accent,1.2);return pg;};
 const next=title=>{if(page&&col===0){col=1;y=TOP;return;}page=header(title);col=0;y=TOP;};
 // A new part starts in a spare column of the current page when there is one, under its own title.
 const start=title=>{
  if(page&&(col===0||y-BOTTOM>(TOP-BOTTOM)*.45)){if(col===0){col=1;y=TOP;}else y-=8;text(page,title,x(),y-11,11,bold,accent);y-=22;return;}
  page=null;next(title);};
 const x=()=>M+col*(COLW+16);
 const section=(title,body,pageTitle,ref='')=>{
  const lines=wrapText(clean(String(body??'').trim()),font,size,COLW-4);if(!lines.some(Boolean))return;
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
 const group=(name,pageTitle,note='')=>{if(y-BOTTOM<64)next(pageTitle);rbox(page,x(),y-13,COLW,13,{fill:tint,border:undefined,r:2});label(page,name,x()+5,y-9,6.5,accent);if(note)rightLabel(page,note,x()+COLW-5,y-9,5.6);y-=20;};
 const d=c.details??{},personal=['personalityTraits','ideals','bonds','flaws'];
 const physical=['gender','age','size','height','weight','eyes','skin','hair','faith','lifestyle'];
 const physicalValue=k=>k==='weight'&&/^\d+(\.\d+)?$/.test(String(d[k]).trim())?`${d[k]} lb`:d[k];
 const detailNotes=Object.entries(d).filter(([k,v])=>v&&!personal.includes(k));
 if(c.featureRows?.length||c.features||overflow.length||detailNotes.length||personal.some(k=>d[k])){start('Features & notes');
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
  // Roleplay notes live with the character details, leaving the summary page for play.
  if(detailNotes.length||personal.some(k=>d[k]))group('Character','Features & notes');
  for(const k of personal)section(titleCase(k),d[k],'Features & notes');
  section('Appearance',[physical.filter(k=>d[k]).map(k=>`${titleCase(k)}: ${physicalValue(k)}`).join('  ·  '),d.appearance].filter(Boolean).join('\n\n'),'Features & notes');
  for(const [k,v] of detailNotes)if(![...physical,'appearance'].includes(k))section(k==='backstory'?'Background':titleCase(k),v,'Features & notes');
 }
 if(spells.length){start('Spellbook');
  for(const [lvl,list] of Object.entries(Object.groupBy(spells,s=>s.level)).sort((a,b)=>a[0]-b[0])){
   const slot=c.spellSlots?.find(s=>s.level===Number(lvl));
   group(lvl==='0'?'Cantrips':`${ordinal(Number(lvl))} level`,'Spellbook',slot?plural(slot.total,'slot'):'');
   for(const s of list){
    const meta=[s.school,s.casting,s.range,s.duration+(s.concentration?' (C)':''),s.components+(s.ritual?' · ritual':''),s.requiresSave?`${s.savingThrow} save DC ${s.saveDC??'?'}`:s.requiresAttack&&s.attackBonus!=null?`${signed(s.attackBonus)} to hit`:''].filter(Boolean).join('  ·  ');
    const body=wrapText(clean([s.summary,s.restriction].filter(Boolean).join('\n')),font,7.6,COLW-4),bh=body.length*lineHeight(font,7.6)+3;
    const metaLines=wrapText(clean(meta),font,6.6,COLW-4),mh=metaLines.length*lineHeight(font,6.6)+2,need=14+mh+bh+8;
    if(need>y-BOTTOM)next('Spellbook');
    const marked=preparer&&s.level>0;if(marked)dot(page,`Spell.${named(s.name)}.prepared`,x()+3,y-5.5,s.prepared);
    field(page,`Spell.${named(s.name)}.name`,s.name,x()+(marked?8:-2),y-11,COLW-70,12,{size:8.5,f:bold});
    if(s.reference){const r=clean(s.reference);text(page,r,x()+COLW-width(r,6),y-8,6,font,muted);}
    field(page,`Spell.${named(s.name)}.meta`,metaLines.join('\n'),x()-2,y-12-mh,COLW+4,mh,{size:6.6,multi:true});
    const avail=y-BOTTOM-14-mh,fit=bh>avail?fitText(body.join('\n'),font,{width:COLW-4,height:avail,max:7.6,min:6.5,marker:'(Continued below)'}):{text:body.join('\n'),size:7.6,rest:''};
    const h=Math.min(bh,avail);field(page,`Spell.${named(s.name)}.effect`,fit.text,x()-2,y-13-mh-h,COLW+4,h,{size:fit.size,multi:true});
    y-=14+mh+h+6;rule(page,x(),x()+COLW,y+3,hair,.4);
    if(fit.rest)section(`${s.name} (continued)`,fit.rest,'Spellbook');
   }
  }
  if(c.spells&&!spells.length)section('Spells',c.spells,'Spellbook');
 }else if(c.spells){start('Spellbook');section('Spells',c.spells,'Spellbook');}
 const total=doc.getPageCount(),foot=clean(`${c.identity.name}  ·  Compact  ·  5e (2014)  ·  Review imported values before play.`);
 doc.getPages().forEach((pg,i)=>{const t=`${i+1} / ${total}`;text(pg,foot,M,22,6,font,muted);text(pg,t,RIGHT-width(t,6.5,bold),22,6.5,bold,muted);});
 doc.setTitle(`${clean(c.identity.name)} — Compact — 5e (2014)`);
 return {bytes:await savePdf(PDFLib,doc,form,font),warnings};
}
