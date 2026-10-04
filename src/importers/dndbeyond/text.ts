// Imported rich text is rendered as plain text; never insert it as HTML.
const entities:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',ensp:' ',emsp:' ',thinsp:' ',ndash:'–',mdash:'—',lsquo:'‘',rsquo:'’',ldquo:'“',rdquo:'”',hellip:'…',bull:'•',middot:'·',times:'×',divide:'÷',plusmn:'±',minus:'−',le:'≤',ge:'≥',ne:'≠',deg:'°',copy:'©',reg:'®',trade:'™',eacute:'é',Eacute:'É',aacute:'á',ouml:'ö',uuml:'ü',ntilde:'ñ'};
function decode(text:string):string {
 return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi,(entity,code:string)=>{
  if(code[0]!=='#')return entities[code]??entity;
  const n=code[1]?.toLowerCase()==='x'?parseInt(code.slice(2),16):parseInt(code.slice(1),10);
  return n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):'�';
 });
}
export function plainText(value:unknown):string {
 if(typeof value!=='string')return typeof value==='number'?String(value):'';
 let text=value.replace(/\r\n?/g,'\n');
 // Also accept escaped HTML from imported notes; bound decoding for malformed input.
 for(let i=0;i<3;i++){
  text=decode(text)
   .replace(/<!--[^]*?(?:-->|$)/g,'')
   .replace(/<(script|style|iframe|object)\b[^>]*>[^]*?(?:<\/\1\s*>|$)/gi,'')
   .replace(/<\/?([a-z][\w:-]*)(?:\s+(?:"[^"]*"|'[^']*'|[^'">])*)?\s*\/?>/gi,(tag,name:string)=>{
    const key=name.toLowerCase(),closing=tag.startsWith('</');
    if(key==='li'&&!closing)return '\n• ';
    if((key==='td'||key==='th')&&closing)return ' | ';
    return /^(p|div|h[1-6]|ul|ol|li|dl|dt|dd|tr|blockquote|section|br)$/.test(key)?'\n':'';
   });
 }
 return text.replace(/[\t \u00a0]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
