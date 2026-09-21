import type { CharacterImporter } from '../../character/model.ts';
import { characterId } from './url.ts';
import { normalise } from './parser.ts';

export function createDndBeyondImporter(fetcher: typeof fetch = fetch): CharacterImporter {
  return {
    canImport(input) { try { characterId(input); return true; } catch { return false; } },
    async import(input) {
      const id = characterId(input);
      try {
        const response = await fetcher(`https://character-service.dndbeyond.com/character/v5/character/${id}`, {
          signal: AbortSignal.timeout(15_000), redirect: 'error', headers: { Accept: 'application/json' },
        });
        if ([401, 403, 404].includes(response.status)) throw new Error('This character could not be retrieved. Check that the character exists and is accessible.');
        if (!response.ok) throw new Error('D&D Beyond character data is currently unavailable. Please try again later.');
        const reader = response.body?.getReader();
        if (!reader) throw new Error('D&D Beyond returned unsupported character data.');
        const chunks: Uint8Array[] = []; let size = 0;
        for (;;) {
          const { done, value } = await reader.read(); if (done) break;
          size += value.length;
          if (size > 5_000_000) { await reader.cancel(); throw new Error('Character data exceeds the supported size.'); }
          chunks.push(value);
        }
        let payload: unknown;
        try { payload = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new Error('D&D Beyond returned unsupported character data.'); }
        return normalise(payload);
      } catch (error) {
        if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError' || error instanceof TypeError)) throw new Error('D&D Beyond character data is currently unavailable. Please try again later.');
        throw error;
      }
    },
  };
}
