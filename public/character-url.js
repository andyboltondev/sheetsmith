// Accept a bare character number or a link pasted without https://, so near-misses still work.
// The server stays strict and validates whatever this returns.
export function characterUrl(input) {
  const value = String(input ?? '').trim();
  if (/^\d{1,12}$/.test(value)) return `https://www.dndbeyond.com/characters/${value}`;
  return /^(www\.|character-service\.)?dndbeyond\.com\//i.test(value) ? `https://${value}` : value;
}
