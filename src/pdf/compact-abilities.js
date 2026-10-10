import { M, RIGHT, signed, groupsOf } from './compact-kit.js';
// Abilities, saves and skills as one grouped table, with passive scores and inspiration beside it. Returns the y below it.
export function drawAbilities(ctx){
 const {p,c,options,kit,overflow}=ctx; const {PDFLib,doc,form,fields,warnings,font,bold,ink,muted,hair,accent,tint,white,clean,width,text,label,centred,rightLabel,rule,vrule,rbox,named,unique,field,dot,diamond,heading,ruled}=kit;
 const groups=groupsOf;
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
  for(const col of list.length>perCol?[0,1]:[0]){const k=cell(ox,col);centred(p,'P',k.px-5,top-4.6,10,6,accent);centred(p,'E',k.ex-5,top-4.6,10,6,accent);}
  rows.forEach(r=>{const y=top-keyH-(r.line+1)*row,k=cell(ox,r.col),cy=y+row/2;
   if(r.isSave)diamond(p,`Proficient.${ability}.save`,k.px,cy,r.proficient);
   else{dot(p,`Proficient.${ability}.${r.key}`,k.px,cy,r.proficient||r.expertise);dot(p,`Expertise.${ability}.${r.key}`,k.ex,cy,r.expertise);}
   field(p,`${ability}.${r.key}`,signed(r.bonus??0),k.bx,y+.3,19,row-.6,{size:8,align:'center',f:r.isSave?bold:font});
   text(p,r.name,k.nx,y+3.1,7.6,r.isSave?bold:font);
   // Situational notes (armour disadvantage, advantage, conditional bonuses) are flagged beside the skill.
   {const tags=[r.disadvantage&&'Disadv.',r.advantage&&'Adv.',...(r.notes??[])].filter(Boolean).join(' · ');if(tags)text(p,tags,k.nx+width(r.name,7.6)+3,y+3.4,6,font,accent);}
  });
  if(list.length)rule(p,ox+badgeW+7,ox+blockW(idx),top-keyH-row,hair,.4);
 });
 // Passive scores and inspiration: a lighter column beside the abilities, quieter than the ability blocks.
 {const skill=n=>c.skills.find(s=>s.name===n)?.bonus??0,px=RIGHT-PW,total=3*BH+2*5,bh=(total-3*5)/4;
  const boxes=[['Perception',c.passivePerception],['Insight',c.passiveInsight??10+skill('Insight')],['Investigation',c.passiveInvestigation??10+skill('Investigation')]];
  boxes.forEach(([n,v],i)=>{const top=ly-i*(bh+5);
   rbox(p,px,top-bh,PW,bh,{});centred(p,`Passive ${n}`,px,top-9,PW,6,muted);
   field(p,`Passive${n}`,v,px+4,top-bh+3,PW-8,17,{size:13,align:'center'});});
  // Inspiration is a box to write in, as on the official sheets.
  const top=ly-3*(bh+5);rbox(p,px,top-bh,PW,bh,{fill:tint,border:undefined});centred(p,'Inspiration',px,top-9,PW,6,accent);
  rbox(p,px+PW/2-14,top-bh+4,28,15,{fill:white,r:7,bw:.5});field(p,'Inspiration',c.inspiration?1:'',px+PW/2-14,top-bh+4,28,15,{size:10,align:'center',f:bold});}
 ly-=3*BH+2*5+16;
 return ly;
}
