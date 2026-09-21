# Field Notes — D&D Beyond Character Sheet PDF

A local-first initial build: import a public D&D Beyond character, review it, choose a portrait and player name, and download an editable A4 PDF. Includes a sample character for offline exploration.

## Start

Requires Node.js 22.18 or newer.

```sh
npm install
npm start
```

Open http://localhost:3000. Use `npm run dev` for server restart on changes. Set `PORT` to choose another port. The server binds only to your computer (127.0.0.1).

```sh
npm test
npm run typecheck
npm run inspect-pdf -- path/to/sheet.pdf
```

## What works

- Supported D&D Beyond URL validation, server-side fetching, timeout, bounded responses and clear errors.
- Identity, multiple classes, base/bonus/override ability scores, common unconditional score bonuses, saves, skills and expertise, passive Perception, inventory, currency, traits, features and basic spell lists.
- Player-name override; D&D Beyond, uploaded PNG/JPEG/WebP, or no portrait. Images are fitted without cropping.
- An original three-page A4 template with editable AcroForms, configurable mappings, and editable continuation pages for long text.
- Responsive interface, light/dark/system appearance, labeled controls, keyboard focus and announced status/errors.
- No accounts, character database, saved uploads or saved generated PDFs. PDF generation happens in the browser; the import server handles character data transiently. The browser downloads the resulting file only when requested.

## Initial-build limits

Review values before play. The undocumented upstream format and all D&D rule interactions are not fully supported. Item effects, conditional modifiers, Jack of All Trades, custom overrides, complex multiclass spellcasting, attacks, spell DCs and slot calculations remain future work. AC and HP are imported only from explicit overrides; otherwise they stay blank and can be entered before export. Speed currently uses base species walking speed. The UI always shows a review notice.

Remote portraits use a transient, size-limited local proxy with validated D&D Beyond HTTPS URLs and redirects. If upstream images are unavailable, upload a local copy or choose no portrait. Uploads are limited to 5 MB and 40 megapixels. Standard PDF fonts support Western text; unsupported characters become `?` with a visible export warning.

This is a local development app, not a hardened public hosting service. Imports are limited to 20 per minute and three concurrent requests. Live endpoint availability is outside this app's control.

## Architecture

- `src/importers/dndbeyond`: URL parsing, bounded fetch and normalization; all upstream-specific assumptions stay here.
- `src/character`: source-independent model, skills and calculations.
- `src/pdf/template.js`: original template layout and model-to-field mapping. No third-party sheet artwork is bundled.
- `src/pdf/generator.js`: browser/Node-compatible PDF creation, editable forms, portrait placement and overflow.
- `src/server.ts`: local HTTP app and transient import route. Static files are explicitly allowlisted.
- `public`: browser interface; overrides operate on a copy of the normalized character.
- `test`: offline normalization, importer, HTTP and PDF roundtrip tests.

The full supplied brief is in `docs/project-brief.md`. The first build is an end-to-end foundation, not completion of every item in that brief.

## Next milestones

1. Validate against a representative set of real public characters, adding sanitized fixtures for edge cases.
2. Extend equipment-aware combat, conditional effects and spellcasting calculations.
3. Support user-supplied fillable PDF templates, font embedding, and richer review/edit controls.
