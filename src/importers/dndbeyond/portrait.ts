export function portraitUrl(input: string): URL {
  let url: URL;
  try { url = new URL(input); } catch { throw new Error('Unsupported portrait URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !url.hostname.endsWith('.dndbeyond.com')) throw new Error('Unsupported portrait URL.');
  return url;
}
export async function fetchPortrait(input: string, fetcher: typeof fetch = fetch) {
  let url = portraitUrl(input);
  const signal = AbortSignal.timeout(10_000);
  for (let hop = 0; hop < 4; hop++) {
    const response = await fetcher(url, { signal, redirect: 'manual', headers: { Accept: 'image/png,image/jpeg,image/webp' } });
    if ([301,302,303,307,308].includes(response.status)) {
      await response.body?.cancel();
      const location = response.headers.get('location');
      if (!location) throw new Error('Portrait redirect was unavailable.');
      url = portraitUrl(new URL(location,url).href);continue;
    }
    const type = response.headers.get('content-type')?.split(';')[0];
    if (!response.ok || !type || !['image/png','image/jpeg','image/webp'].includes(type)) { await response.body?.cancel();throw new Error('Portrait is unavailable or in an unsupported format.'); }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Portrait was empty.');
    const chunks: Uint8Array[] = [];let size = 0;
    for (;;) {
      const { done,value } = await reader.read();if (done) break;
      size += value.length;
      if (size > 5_000_000) { await reader.cancel();throw new Error('Portrait exceeds the 5 MB limit.'); }
      chunks.push(value);
    }
    return { bytes: Buffer.concat(chunks), type };
  }
  throw new Error('Portrait redirected too many times.');
}
