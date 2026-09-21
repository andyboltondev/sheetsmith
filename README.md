# D&D Beyond Character Sheet PDF

Import once. Normalise once. Output anywhere.

## Status

Initial TypeScript foundation, not yet a working web application. Includes URL validation, a replaceable importer with timeout/error handling, a normalized identity/class/ability model, and offline tests. The supplied brief is in `docs/project-brief.md`.

## Run tests

Install Node.js 22.18 or newer, then run `npm test`. There are no package dependencies yet. Node executes the TypeScript directly; a separate type-check step will be added with the application toolchain.

## Architecture

- `src/importers/dndbeyond`: upstream URL parsing, transport and normalization.
- `src/character`: source-independent model and calculations.
- Future `src/pdf`: template mapping and PDF generation, consuming only the normalized model.
- Future UI and server: transient import proxy to avoid browser CORS restrictions; no character persistence.

The character-service endpoint is undocumented. Current normalization is intentionally incomplete and emits a warning: species, feat, item and class modifiers are not yet applied. Do not treat these initial scores as a verified final sheet. Live upstream access has not been validated.

## Next milestones

- [ ] Add a responsive, accessible interface with light/dark/system appearance.
- [ ] Add a server import route with request limits and no character logging/storage.
- [ ] Expand the normalized model, modifier handling, skills, combat, inventory and spells.
- [ ] Add sanitized martial, caster, multiclass and edge-case fixtures.
- [ ] Select a redistributable fillable PDF or create an original template.
- [ ] Add configurable field mappings and a PDF-field inspection utility.
- [ ] Add player-name and portrait overrides without changing source data.
- [ ] Generate editable PDFs; verify overflow and portrait placement visually.

No original PDF template was supplied. Template selection and mapping remain open.
