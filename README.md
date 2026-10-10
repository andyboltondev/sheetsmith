# SheetSmith — D&D Beyond Character Sheet PDF

A local-first initial build: import a public D&D Beyond character, review it, choose a portrait and player name, and download an editable A4 PDF. Includes a sample character for offline exploration.

## Start

Requires Node.js 22.18 or newer. The page needs a current browser (Chrome 117, Safari 17.4 or Firefox 119 or newer).

```sh
npm install
npm start
```

Open http://localhost:3000. Use `npm run dev` for server restart on changes. Set `PORT` to choose another port. The server binds only to your computer (127.0.0.1).

```sh
npm run check        # types, undeclared-name check for browser/PDF code, then all tests
npm test
npm run typecheck
npm run inspect-pdf -- path/to/sheet.pdf
SHEETSMITH_OFFICIAL_DIR=path/to/unzipped/sheets npm test   # also checks the real Wizards PDFs against their pinned checksums
```

## Official sheets

Wizards of the Coast's character sheets are free to download but are not licensed for redistribution, so SheetSmith does not ship them (nor any third-party class sheets). SheetSmith itself needs no download. To use **Official Standard** or **Official Alternative**:

1. Open the [official D&D character sheets page](https://www.dndbeyond.com/resources/1779-d-d-character-sheets) and download **Fifth Edition Character Sheets** ([direct ZIP](https://media.dndbeyond.com/compendium-images/marketing/5e_charactersheets.zip)).
2. Unzip it. Do not edit or re-save the PDFs.
3. In the app, open **Official sheets: download and add** under the sheet choice and choose the form-fillable PDFs below (all at once is fine).

| Needed for | File in the ZIP | SHA-256 |
| --- | --- | --- |
| Standard | `Character Sheet - Form Fillable.pdf` | `6a4ba96b2d4c0e8bf0786d62e151bd602b01c6a6d59a1be8114aa586601d3fe1` |
| Alternative | `Character Sheet - Alternative - Form Fillable.pdf` | `a5c24cf034d93cd7c0dba1b8f740f648acac3ceb58e4103ff5aaaeac347ab561` |
| Both | `Character Details (Optional) - Form Fillable.pdf` | `f1fa96c35ac3bc91eb95dad15b4b5baca4b73ec49c8450f58f3b0a46958cd4b0` |
| Both | `Spellcasting Sheet (Optional) - Form Fillable.pdf` | `c0a50a0fbd225ec45441025575f788b9172c36699978fcda7ae68bc2ac5130b2` |

Each file is hashed in your browser and accepted only if it matches, which also guarantees it is the editable, unmodified original (the "Print Version" files have the same artwork but no fields, and are refused). Verified files are kept in this browser's IndexedDB so you add them once; nothing is uploaded anywhere, and **Remove saved official sheets** clears them. SheetSmith removes Wizards' own form fields from its working copy and recreates clean ones, so a re-saved or edited PDF is refused rather than trusted. You can check a file yourself with `shasum -a 256 "<file>"`.

If Wizards publishes a revised sheet its checksum will differ; the app then says the checksum does not match, and the pinned values in `src/pdf/official.js` need updating after checking the new file.

## What works

- Supported D&D Beyond URL validation, server-side fetching, timeout, bounded responses and clear errors.
- Identity, multiple classes, base/bonus/override ability scores, common unconditional score bonuses, saves, skills and expertise, Jack of All Trades and Remarkable Athlete, passive Perception/Insight/Investigation, senses, other movement speeds, damage resistances/immunities/vulnerabilities and save notes, inventory, currency, traits, features and basic spell lists.
- Equipped magic items: unconditional bonuses (for example a Cloak of Protection on saves) and set scores (Headband of Intellect) apply only when equipped and, where required, attuned. Items keep their rarity, attunement and a short effect for the sheets.
- Spell slots from the class table for one spellcasting class, or from the PHB multiclass table using D&D Beyond's caster divisor and rounding. Subclasses that cannot cast (a Champion fighter) get no slots. Pact Magic stays separate.
- Attack table rows for equipped weapons (including unconditional style modifiers such as Dueling), damaging cantrips scaled by character level, and unarmed strike.
- Spellcasters get the matching spell page: the official spellcasting sheet (names by level, prepared marks, slots, DC and attack) followed by compact spell details.
- Player-name override; D&D Beyond, uploaded PNG/JPEG/WebP, or no portrait. Images are fitted without cropping.
- SheetSmith (default), plus Official Standard and Official Alternative once you add Wizards of the Coast's own PDFs (see “Official sheets”), all labelled 5e. 5.5e is reserved for future support.
- Score-above-modifier or modifier-above-score positioning in both the preview and exported PDF.
- Editable fields, fitted portraits and continuation pages for long text and spell lists. The official sheets keep their printed artwork.
- Responsive interface, light/dark/system appearance, labeled controls, keyboard focus and announced status/errors.
- A live preview of the finished PDF with a Download button. The preview refreshes shortly after any option changes; the chosen sheet, ability order and equipment options are remembered on this device. Browsers without a built-in PDF viewer (most phones) get the download only.
- The character link field also accepts the bare character number or a link without `https://`.
- No accounts, character database, saved uploads or saved generated PDFs. PDF generation happens in the browser; the import server handles character data transiently. The browser downloads the resulting file only when requested.

## Initial-build limits

Review values before play. The undocumented upstream format and all D&D rule interactions are not fully supported. Conditional modifiers, item charges, custom overrides, Pact Magic slot tracking and conditional attack modifiers remain future work. AC supports normal light/medium/heavy armour, shields and unconditional equipment bonuses with attunement checks. Maximum HP uses recorded base HP, Constitution per level and supported bonuses. Walking speed uses species speed and supported bonuses/armour penalties. Explicit overrides win. Unsupported conditional combat rules remain blank with a targeted warning. Temporary effects are not automatically activated. Multiclass characters can use any style. The UI always shows a review notice.

Remote portraits use a transient, size-limited local proxy with validated D&D Beyond HTTPS URLs and redirects. If upstream images are unavailable, upload a local copy or choose no portrait. Uploads are limited to 5 MB and 40 megapixels. Standard PDF fonts support Western text; unsupported characters become `?` with a visible export warning.

This is a local development app, not a hardened public hosting service. Imports are limited to 20 per minute and three concurrent requests. Live endpoint availability is outside this app's control.

## Architecture

- `src/importers/dndbeyond`: URL parsing, bounded fetch and normalization; all upstream-specific assumptions stay here.
- `src/character`: source-independent model, skills and calculations.
- `src/pdf/grouped.js`: the SheetSmith sheet, assembled from sections: `compact-kit.js` (drawing primitives), then header, abilities, defences, attacks, actions, equipment, spells and details modules, each reporting where it ended. Text that does not fit is queued for the detail pages.
- `src/pdf/format.js`: small helpers shared by the page and every sheet style.
- `templates`: field layouts (geometry only) for the official sheets. No PDF artwork is shipped.
- `src/pdf/supplied.js`: official-template filling, geometric ability ordering and continuation pages.
- `src/pdf/official.js` and `public/official.js`: the pinned checksums, verification and assembly of the user's own official PDFs, and the browser panel that stores them.
- `src/pdf/class-info.js`: class numbers (Rage damage, Sneak Attack, Extra Attack, maneuver DC…) shown in SheetSmith's Class traits.
- `src/pdf/generator.js`: browser/Node-compatible PDF creation, editable forms, portrait placement and overflow, plus the helpers every style shares: a linear-time form field factory, text cleaning, fitting and `savePdf` (drops unreferenced objects before saving).
- `src/server.ts`: local HTTP app and transient import route. Static files are explicitly allowlisted; browser PDF modules are any `src/pdf/<name>.js`. Imports and portrait previews have separate rate limits.
- `src/sample`: the sample character offered by the page and used by the tests.
- `public`: browser interface; overrides operate on a copy of the normalized character.
- `test`: offline normalization, importer, HTTP and PDF roundtrip tests.

## Checks

`npm run check` runs everything CI runs: TypeScript, a check of the browser and PDF JavaScript for undeclared names and bad imports, then the tests.

- Importer and calculations: unit tests plus a mutation test that damages every field of the sample payload and requires the importer to neither crash nor print `NaN` or `[object Object]` on a sheet.
- Every sheet style is exported with a light and a heavy character and checked for clipped text, boxes off the page or on top of each other, missing screen-reader names and tab order, and file size.
- `test/snapshot.test.ts` records where fields sit, what they hold and what is drawn on each page. After an intended layout change, look at the pages, then run `npm run test:update-snapshots` and commit `test/snapshots/layout.json`.
- `test/ui.test.ts` runs the real page in jsdom with a fake worker and network, including an axe accessibility scan.
- `test/server-limits.test.ts` covers validation, rate limits, headers, compression and the static allowlist.
- `test/templates.test.ts` checks the layouts fit their pages and that no artwork is shipped; `test/official.test.ts` covers checksum verification and assembly.

The full supplied brief is in `docs/project-brief.md`. The first build is an end-to-end foundation, not completion of every item in that brief.

## Next milestones

1. Validate against a representative set of real public characters, adding sanitized fixtures for edge cases.
2. Extend equipment-aware combat, conditional effects and spellcasting calculations.
3. Support user-supplied fillable PDF templates, font embedding, and richer review/edit controls.


## Accessibility and browser performance

- Stronger text, input and focus contrast in both themes; labelled, stacked ability values.
- Skip navigation, full ability names, native form validation with invalid states, linked help/errors and announced status updates.
- Layouts adapt to narrow screens; controls have larger targets. Forced-colour and reduced-motion preferences are respected.
- PDF generation runs in a cancellable module Web Worker. The minified PDF library and the field layout of the selected template load only when exporting; continuation pages reuse artwork already in the sheet. A persistent download link remains after export.
- Exports take roughly 70–140 ms per sheet. Replaced appearance streams are dropped and photo portraits travel as JPEG. For the test character a SheetSmith export is about 0.12 MB.
- Public code/template assets use ETag revalidation and text compression; the server hashes and compresses each file once per version on disk. Character imports, samples and portraits retain `no-store` responses.
- Supplied PDF exports include document language and descriptive field tooltips. They are **not fully tagged PDFs** and no PDF/UA conformance is claimed.

Target: WCAG 2.2 AA. Automated tests and source review are not a conformance certification. Interactive keyboard, screen-reader, zoom/reflow and cross-browser checks remain necessary; the available browser tool could not perform them because its policy verification service was unavailable.

## Sheet styles and gameplay references

- SheetSmith is the default and is built in. Official Standard and Official Alternative are available as 5e (2014) styles once you add your own copy of Wizards' PDFs. 5.5e is not implemented.
- Third-party class sheets are not included: they are not licensed for redistribution. Everything they showed that comes from your character is carried into SheetSmith instead: resource pools (Rage, Ki, Sorcery Points, Superiority Dice…) as use trackers, and a Class traits line with Rage damage, Brutal Critical, Sneak Attack, Song of Rest, Martial Arts die, Wild Shape max CR, Extra Attack, Superiority die and maneuver DC, Trick Shot DC, Fisticuffs die, Warlock Arcanum, and the number of metamagic options, invocations and cantrips known. Multiclass characters get every class's numbers.
- Continuation panels reuse the official sheet's own Additional Features & Traits artwork; official sheets list magic items there. SheetSmith is the default: a minimal, play-first layout. Page one has vitals, a grouped ability/save/skill table with filled proficiency dots and armour drawbacks (such as Stealth disadvantage), grouped proficiencies, senses and defences, a conditions and exhaustion tracker, attacks, class traits, actions grouped by cost (action, bonus action, reaction, special) with limited uses and short/long-rest recovery, a spell table with one line of effect per spell, passive features, and equipment with item weights, carrying capacity and attunement.
- Page references cite the PHB (2014) and require explicit page metadata. Basic Rules entries (D&D Beyond source 1) are cited as PHB pages, because D&D Beyond numbers them by PHB page (Dwarf traits 20, Fighter 70). Missing pages are left unspecified. Traits whose only effect is a proficiency are listed by name and page. D&D Beyond's hidden placeholder feats (`__DISGUISE_FEAT`, such as Hero's Journey Boon) are omitted, as on its own sheet. Imported concise snippets resolve supported character placeholders; otherwise complete descriptions are retained and paginated. Five verified PHB spell summaries currently have concise gameplay versions; other spells use their imported text.
- The home banner includes a local decorative SVG with reserved dimensions.

HTML cleanup applies to names, inventory, notes, traits, features and spells; paragraph/list boundaries and common/numeric entities are preserved as plain text.

Weapon tables show inventory weapons and standard base attack/damage rolls; conditional bonuses remain separate. Equipped gear and packed items are listed separately, and equipped armour fills its dedicated slot.

Gameplay summaries omit explicit PHB-backed upgrade sections and future-level instructions while retaining current mechanics, component costs and restrictions. Missing source pages are never guessed. Current subclass rules map by source identity and level, with unmatched rules retained in Additional Features. Original preprinted future-level text remains part of Wizards' artwork on the official sheets. Full automatic mapping of every D&D Beyond resource, item effect and spell-slot rule is not claimed.
