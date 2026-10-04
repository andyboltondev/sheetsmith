import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
function luminance(hex:string){return [0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);}
function ratio(a:string,b:string){const [lo,hi]=[luminance(a),luminance(b)].sort((x,y)=>x-y);return (hi+.05)/(lo+.05);}
for(const [name,selector] of [['light',':root'],['dark','body[data-theme=dark]']])test(`${name} theme text, controls and focus meet contrast targets`,()=>{
 const block=css.slice(css.indexOf(selector));const declarations=block.slice(block.indexOf('{')+1,block.indexOf('}'));const vars=Object.fromEntries([...declarations.matchAll(/--([\w-]+):#([0-9a-f]{6})/g)].map(m=>[m[1],m[2]]));
 for(const fg of ['text','muted'])for(const bg of ['bg','surface','soft','notice'])assert.ok(ratio(vars[fg],vars[bg])>=4.5,`${fg}/${bg}`);
 assert.ok(ratio(vars['control-border'],vars.surface)>=3);assert.ok(ratio(vars.focus,vars.surface)>=3);assert.ok(ratio(vars.green,vars.surface)>=4.5);
});
