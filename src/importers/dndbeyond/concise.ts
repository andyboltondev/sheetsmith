// Remove only explicit, reference-backed upgrades, never arbitrary rule sentences.
export function gameplayText(text:string,reference:string,currentLevel:number):string {
 if(!reference.startsWith('PHB (2014), p. '))return text;
 const body=text.split(/(?:^|\n)\s*(?:At Higher Levels|Using a Higher-Level Spell Slot)(?:\s*[.:]\s*|\s*\n)/i)[0];
 return body.split(/(?<=[.!?])\s+/).filter(sentence=>{
  const future=sentence.match(/^(?:Starting|Beginning|When you reach|At) (?:at )?(\d+)(?:st|nd|rd|th) level\b/i);
  return !future||Number(future[1])<=currentLevel;
 }).join(' ').trim();
}
