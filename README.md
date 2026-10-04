# SheetSmith — D&D Beyond Character Sheet PDF

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
node scripts/prune-templates.mjs   # after adding or replacing template PDFs
```

## What works

- Supported D&D Beyond URL validation, server-side fetching, timeout, bounded responses and clear errors.
- Identity, multiple classes, base/bonus/override ability scores, common unconditional score bonuses, saves, skills and expertise, Jack of All Trades and Remarkable Athlete, passive Perception/Insight/Investigation, senses, other movement speeds, damage resistances/immunities/vulnerabilities and save notes, inventory, currency, traits, features and basic spell lists.
- Equipped magic items: unconditional bonuses (for example a Cloak of Protection on saves) and set scores (Headband of Intellect) apply only when equipped and, where required, attuned. Items keep their rarity, attunement and a short effect for the sheets.
- Spell slots from the class table for one spellcasting class, or from the PHB multiclass table using D&D Beyond's caster divisor and rounding. Subclasses that cannot cast (a Champion fighter) get no slots. Pact Magic stays separate.
- Attack table rows for equipped weapons (including unconditional style modifiers such as Dueling), damaging cantrips scaled by character level, and unarmed strike.
- Spellcasters get the matching spell page: the official spellcasting sheet (names by level, prepared marks, slots, DC and attack) followed by compact spell details, or the class spell cards.
- Player-name override; D&D Beyond, uploaded PNG/JPEG/WebP, or no portrait. Images are fitted without cropping.
- Official Standard (default), Official Alternative, and matching class sheets, all labelled 5e. 5.5e is reserved for future support.
- Score-above-modifier or modifier-above-score positioning in both the preview and exported PDF.
- Editable fields, fitted portraits and continuation pages for long text and spell lists. The supplied template artwork is retained.
- Responsive interface, light/dark/system appearance, labeled controls, keyboard focus and announced status/errors.
- No accounts, character database, saved uploads or saved generated PDFs. PDF generation happens in the browser; the import server handles character data transiently. The browser downloads the resulting file only when requested.

## Initial-build limits

Review values before play. The undocumented upstream format and all D&D rule interactions are not fully supported. Conditional modifiers, item charges, custom overrides, Pact Magic slot tracking and conditional attack modifiers remain future work. AC supports normal light/medium/heavy armour, shields and unconditional equipment bonuses with attunement checks. Maximum HP uses recorded base HP, Constitution per level and supported bonuses. Walking speed uses species speed and supported bonuses/armour penalties. Explicit overrides win. Unsupported conditional combat rules remain blank with a targeted warning. Temporary effects are not automatically activated. Multiclass characters can use Official or Compact. Class sheets automatically match a single class and, where provided by the archive, its subclass. Unsupported classes are not silently assigned another class sheet. The UI always shows a review notice.

Remote portraits use a transient, size-limited local proxy with validated D&D Beyond HTTPS URLs and redirects. If upstream images are unavailable, upload a local copy or choose no portrait. Uploads are limited to 5 MB and 40 megapixels. Standard PDF fonts support Western text; unsupported characters become `?` with a visible export warning.

This is a local development app, not a hardened public hosting service. Imports are limited to 20 per minute and three concurrent requests. Live endpoint availability is outside this app's control.

## Architecture

- `src/importers/dndbeyond`: URL parsing, bounded fetch and normalization; all upstream-specific assumptions stay here.
- `src/character`: source-independent model, skills and calculations.
- `src/pdf/template.js`: original template layout and model-to-field mapping. The original SheetSmith generator is retained for compatibility; the UI also offers the Compact template (`src/pdf/grouped.js`).
- `templates`: prepared copies and field layouts from the user-supplied archives; original artwork and notices remain intact.
- `src/pdf/supplied.js`: supplied-template filling, geometric ability ordering and continuation pages.
- `src/pdf/generator.js`: browser/Node-compatible PDF creation, editable forms, portrait placement and overflow, plus the helpers every style shares: a linear-time form field factory, text cleaning, fitting and `savePdf` (drops unreferenced objects before saving).
- `scripts/prune-templates.mjs`: removes objects no page uses from template PDFs; referenced artwork is written back byte for byte.
- `src/server.ts`: local HTTP app and transient import route. Static files are explicitly allowlisted.
- `public`: browser interface; overrides operate on a copy of the normalized character.
- `test`: offline normalization, importer, HTTP and PDF roundtrip tests.

The full supplied brief is in `docs/project-brief.md`. The first build is an end-to-end foundation, not completion of every item in that brief.

## Next milestones

1. Validate against a representative set of real public characters, adding sanitized fixtures for edge cases.
2. Extend equipment-aware combat, conditional effects and spellcasting calculations.
3. Support user-supplied fillable PDF templates, font embedding, and richer review/edit controls.


## Accessibility and browser performance

- Stronger text, input and focus contrast in both themes; labelled, stacked ability values.
- Skip navigation, full ability names, native form validation with invalid states, linked help/errors and announced status updates.
- Layouts adapt to narrow screens; controls have larger targets. Forced-colour and reduced-motion preferences are respected.
- PDF generation runs in a cancellable module Web Worker. The minified PDF library and the selected template (plus its spell page for casters) load only when exporting; continuation pages reuse artwork already in the sheet. A persistent download link remains after export.
- Exports take roughly 70–140 ms per sheet. Each page image is stored once, replaced appearance streams are dropped, and photo portraits travel as JPEG. For the test character: Compact 0.24 → 0.12 MB, Official 0.48 → 0.35 MB, Eldritch Knight 5.65 → 4.48 MB.
- Public code/template assets use ETag revalidation and text compression; the server hashes and compresses each file once per version on disk. Character imports, samples and portraits retain `no-store` responses.
- Template resources were deduplicated without rasterising or changing the artwork; all original/prepared page renders compared identically. The original set shrank from 102,043,685 to 42,343,471 bytes; later subclass and reference assets are additional. A later pass removed 34 MB of unreferenced leftover page images (all templates 111 → 77 MB; Revised Ranger Beast Master 20 → 3.3 MB, class spell cards 2.9 → 1.4 MB) with every page render unchanged.
- Supplied PDF exports include document language and descriptive field tooltips. They are **not fully tagged PDFs** and no PDF/UA conformance is claimed.

Target: WCAG 2.2 AA. Automated tests and source review are not a conformance certification. Interactive keyboard, screen-reader, zoom/reflow and cross-browser checks remain necessary; the available browser tool could not perform them because its policy verification service was unavailable.

## Sheet styles and gameplay references

- Official Standard remains the default. Official Alternative, automatic Class Sheet, and Compact are available as 5e (2014) styles. 5.5e is not implemented.
- Class selection resolves all 18 named classes/variants of classes and the archive’s dedicated Battle Master, Eldritch Knight, Beast Master Arcane Trickster and Gunslinger variants. Missing combined multiclass sheets do not mix class artwork.
- Supplemental panels retain the chosen template family’s artwork. Class spells use the supplied class spell cards. Class sheets also fill the equipment slots (head, amulet, cloak, arms, rings, belt, boots) from equipped items, the five magic item boxes (attuned first) and their attunement circles; official sheets list magic items in Additional Features & Traits. Compact (beta) is a minimal, play-first layout. Page one has vitals, a grouped ability/save/skill table with filled proficiency dots and armour drawbacks (such as Stealth disadvantage), grouped proficiencies, senses and defences, a conditions and exhaustion tracker, attacks, actions grouped by cost (action, bonus action, reaction, special) with limited uses and short/long-rest recovery, a spell table with one line of effect per spell, passive features, and equipment with item weights, carrying capacity and attunement. Personality and character details, full feature text, magic items and the spellbook follow on two-column detail pages. Class dice such as Sneak Attack appear with the resources. Milestone campaigns show “Milestone” instead of XP.
- Page references cite the PHB (2014) and require explicit page metadata. Basic Rules entries (D&D Beyond source 1) are cited as PHB pages, because D&D Beyond numbers them by PHB page (Dwarf traits 20, Fighter 70). Missing pages are left unspecified. Traits whose only effect is a proficiency are listed by name and page. D&D Beyond's hidden placeholder feats (`__DISGUISE_FEAT`, such as Hero's Journey Boon) are omitted, as on its own sheet. Imported concise snippets resolve supported character placeholders; otherwise complete descriptions are retained and paginated. Five verified PHB spell summaries currently have concise gameplay versions; other spells use their imported text.
- The home banner includes a local decorative SVG with reserved dimensions.

All named class sheets in the archive are supported, including Blood Hunter, Cook, Mystic, Pugilist and the distinct Revised Ranger, in addition to the 13 core-class sheets. HTML cleanup applies to names, inventory, notes, traits, features and spells; paragraph/list boundaries and common/numeric entities are preserved as plain text.

Weapon tables now show inventory weapons and standard base attack/damage rolls; conditional bonuses remain separate. Class sheets fill front-page spell lists, favourites and unambiguous casting totals. Full spell cards are retained; equipped gear and packed items are listed separately, and equipped armour fills its dedicated slot.

Gameplay summaries omit explicit PHB-backed upgrade sections and future-level instructions while retaining current mechanics, component costs and restrictions. Missing source pages are never guessed. Current subclass rules map by source identity and level into matching class panels, with unmatched rules retained in Additional Features. Armour/weapon proficiency checkboxes replace duplicate category names in Tools. Original preprinted future-level text remains part of the supplied artwork. Full automatic mapping of every D&D Beyond resource, item effect and spell-slot rule is not claimed.
