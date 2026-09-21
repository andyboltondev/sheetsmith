import type { CharacterImporter } from '../../character/model.ts';
import { characterId } from './url.ts';
import { normalise } from './parser.ts';

export function createDndBeyondImporter(fetcher: typeof fetch = fetch): CharacterImporter {
  return {
    canImport(input) { try { characterId(input); return true; } catch { return false; } },
    async import(input) {
      const id = characterId(input);
      let response: Response;
      try {
        response = await fetcher(`https://character-service.dndbeyond.com/character/v5/character/${id}`, {
          signal: AbortSignal.timeout(15_000), redirect: 'error', headers: { Accept: 'application/json' },
        });
      } catch { throw new Error('D&D Beyond character data is currently unavailable. Please try again later.'); }
      if ([401, 403, 404].includes(response.status)) throw new Error('This character could not be retrieved. Check that the character exists and is accessible.');
      if (!response.ok) throw new Error('D&D Beyond character data is currently unavailable. Please try again later.');
      let payload: unknown;
      try { payload = await response.json(); } catch { throw new Error('D&D Beyond returned unsupported character data.'); }
      return normalise(payload);
    },
  };
}
