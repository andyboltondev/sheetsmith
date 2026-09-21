export function characterId(input: string): string {
  const message = "We couldn't find a valid D&D Beyond character ID in this URL.";
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new Error(message); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error(message);
  const pattern = ['www.dndbeyond.com', 'dndbeyond.com'].includes(url.hostname)
    ? /^\/characters\/([1-9]\d*)\/?$/
    : url.hostname === 'character-service.dndbeyond.com'
      ? /^\/character\/v5\/character\/([1-9]\d*)\/?$/ : null;
  const match = pattern?.exec(url.pathname);
  if (!match) throw new Error(message);
  return match[1];
}
