import { M, RIGHT, BOTTOM } from './compact-kit.js';
import { displayItems } from './generator.js';
// The foot of page one: equipment (coins, then two columns of items) beside a notes block.
export function drawEquipment(ctx,from){
 const {p,c,options,kit,overflow}=ctx; const {PDFLib,doc,form,fields,warnings,font,bold,ink,muted,hair,accent,tint,white,clean,width,text,label,centred,rightLabel,rule,vrule,rbox,named,unique,field,dot,diamond,heading,ruled}=kit;
 // The foot of the page is split in half: equipment (coins, then two columns of items) beside a notes block.
 {const weights=options.equipmentWeight!==false;
  const HW=(RIGHT-M-16)/2,NX0=M+HW+16;
  let ey=from-2;
  const rowsIn=c.inventoryRows??[],lbs=n=>`${Math.round(n*100)/100}`;
  const keyNotes=[rowsIn.some(r=>r.equipped)&&'filled = equipped',rowsIn.some(r=>r.attunement||r.attuned)&&'diamond = attuned',weights&&c.carrying&&`carried ${lbs(c.carrying.weight)} / ${lbs(c.carrying.capacity)} lb`].filter(Boolean).join(' · ');
  heading(p,'Equipment',M,ey,HW,keyNotes);
  heading(p,'Notes',NX0,ey,HW);
  const notesTop=ey-4;field(p,'Notes','',NX0-2,BOTTOM,HW+4,notesTop-BOTTOM,{multi:true});ruled(p,NX0,HW,notesTop);
  ey-=8;
  const coins=['pp','gp','ep','sp','cp'],cw=HW/5;
  rbox(p,M,ey-18,HW,18);
  coins.forEach((k,i)=>{const x=M+i*cw;if(i)vrule(p,x,ey-14,ey-4);label(p,k,x+5,ey-11.3,6);field(p,`Coins.${k.toUpperCase()}`,Number(c.coins?.[k])||'',x+15,ey-16,cw-18,14,{size:9,align:'center'});});
  ey-=24;
  const gap=12,colW=(HW-gap)/2,qw=15,ww=weights?27:0,nameW=colW-9-qw-ww-2-(weights?2:0)-(rowsIn.some(r=>r.attunement||r.attuned)?8:0);
  const lb=n=>n?`${Math.round(n*100)/100} lb`:'';
  const items=c.inventoryRows?.length?c.inventoryRows.map(r=>({name:r.name,qty:r.quantity==null?'':r.quantity,weight:lb(r.weight),equipped:r.equipped,attunable:!!(r.attunement||r.attuned),attuned:!!r.attuned}))
   :displayItems(c.equipment).split('\n').filter(t=>t.trim()).map(t=>({name:t,qty:'',weight:'',equipped:false}));
  const rowH=11,perCol=Math.max(3,Math.floor((ey-BOTTOM-9)/rowH));
  [0,1].forEach(col=>{const x=M+col*(colW+gap);
   label(p,'Qty',x+9,ey-5,6);label(p,'Item',x+9+qw+2,ey-5,6);if(weights)rightLabel(p,'Weight',x+colW,ey-5,6);});
  const top=ey-8;
  for(let k=0;k<perCol*2;k++){const col=Math.floor(k/perCol),r=k%perCol,x=M+col*(colW+gap),y=top-(r+1)*rowH,it=items[k],id=`Item.${k+1}`;
   rule(p,x,x+colW,y,hair,.4);
   if(it)dot(p,`${id}.Equipped`,x+3,y+rowH/2,it.equipped,2.2);
   field(p,`${id}.Qty`,it?.qty??'',x+7,y+.5,qw,rowH-1,{size:7.2,align:'center'});
   field(p,`${id}.Name`,it?.name??'',x+9+qw,y+.5,nameW+2,rowH-1,{size:7.2});
   if(it?.attunable)diamond(p,`${id}.Attuned`,x+colW-ww-(weights?2:0)-4.5,y+rowH/2,it.attuned,2.5);
   if(weights)field(p,`${id}.Weight`,it?.weight??'',x+colW-ww,y+.5,ww,rowH-1,{size:6.8,align:'center'});}
  if(items.length>perCol*2)overflow.push(['Equipment (continued)',items.slice(perCol*2).map(it=>`${it.qty===''?'':it.qty+' × '}${it.name}${it.weight?' — '+it.weight:''}`).join('\n')]);
 }
}
