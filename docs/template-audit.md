# Template audit — 25 September 2026

Test character: Kazrek Ironscript, D&D Beyond character 171344792; Mountain Dwarf, Fighter 3 / Eldritch Knight, Chaotic Good. Rules edition: 5e (2014).

## Scope and results

- Exported all 27 selectable layouts (two official, 24 class variants, Compact) in both ability orders: 54 exports, 220 pages.
- Checked canonical editable field values, ability scores/modifiers, saving throws and proficiency checks, core combat values, class skills and proficiency checks, alignment, weapons, all five spells, equipment names, book references and note markers.
- Checked populated text fields for width and height fit; no fit failures remained.
- Checked every output for orphaned widgets and missing appearance streams; none remained. Rendered all 110 score-first pages, visually reviewed every layout's first page and all pages of the four matching character exports.
- Automatic class selection resolves to the Eldritch Knight template. Other class artwork was used only for internal layout diagnostics, not as a valid character sheet.
- Type checking and 53 automated tests passed, including regressions for resources, personal notes, inherited feature classification and spell-card fit/markers.

## Character values checked

AC 18; maximum/current HP 34; temporary HP 0; speed 25 ft; initiative +1; proficiency +2; passive Perception 14; passive Insight 12. STR 19 (+4), DEX 13 (+1), CON 19 (+4), INT 17 (+3), WIS 14 (+2), CHA 13 (+1). Spell attack +5, spell save DC 13; two first-level spell slots, zero used. Action Surge and Second Wind each have one use remaining.

## Corrections

Personal appearance, organizations, enemies, possessions and notes now reach supplied sheets or matching continuation pages. Recorded XP, inspiration, current/temporary HP, used hit dice, fixed feature-use counters and explicit single-class spell-slot tables are retained. Small resource counters no longer receive feature descriptions. Inherited base-class features are no longer mistaken for subclass features. Spell-school labels fit their boxes, and spell cards include component/preparation/ritual/concentration markers and known slot-use checkboxes.

## Limits

This validates layout mapping with this character, not every class mechanic. Missing or dynamic feature limits and multiclass slot calculations are not guessed. Conditional weapon bonuses remain separate from base rolls. Printed future-level rules embedded in supplied artwork remain part of that artwork. PHB page references are only used when the source gives a page; Basic Rules pages are cited as PHB pages (see the D&D Beyond parity pass). Browser automation was unavailable, so the checks cover generated PDFs and automated application tests, not a fresh interactive browser walkthrough.

## Readability pass — 4 October 2026

Re-exported all 27 layouts in both ability orders (54 exports) with the same test character; all succeeded with no raw field identifiers in the output.

- Multiline boxes now use the largest size that fits (official 10→7 pt, class 8→6 pt) and shrink before overflowing. Related boxes share one size: personality/ideals/bonds/flaws, allies/enemies and the class feature column.
- Overflow splits at a line or sentence boundary, never mid-sentence. Continued text is titled in plain language, e.g. "PERSONALITY TRAITS (CONTINUED)", and each box says where it continues. Line structure is preserved, so equipment lists are no longer merged into one paragraph.
- Possessions and holdings use the official sheets' Treasure box. Short lists in wide boxes run inline before overflowing. Single items drop the "1 x" prefix, and coins list only what is held.
- Class sheets: feature text clears the level badges, casting-time text clears the concentration bubble, favourite-spell reminders never spawn pages (the spell cards hold full text), and continuation pages use 8 pt instead of 6 pt.
- Compact spacing is tighter. Result: official sheets 4→3 pages and Compact 6→5 for this character.
- Accuracy: overriding Max HP now keeps recorded damage, so current HP cannot exceed the new maximum. "1 times" reads as "once". Spell reminders no longer show a doubled full stop.

## D&D Beyond parity pass — 4 October 2026

Compared fresh exports of the test character with D&D Beyond's own PDF for the same character.

- All templates: page references cite the PHB (D&D Beyond's Basic Rules pages follow PHB numbering). Hidden placeholder feats (Hero's Journey Boon, Dark Bargain) are no longer printed. Dwarven Combat Training, Tool Proficiency and Dwarven Armor Training share one "included in proficiencies" line with their page.
- Official and class sheets: items list their weight, followed by carried weight, capacity and push/drag/lift. Gender, size, faith and lifestyle lead the appearance box. Training is grouped into armour, weapons, tools and languages. Official sheets show the subclass with the class and level.
- Class sheets: resource boxes are filled from D&D Beyond limited uses (Rage, Ki, Sorcery Points, Superiority, Wild Shape, Lay on Hands, Divine Sense, Grit, Moxie, Psi). Dice come from D&D Beyond scale values where present, otherwise from PHB class tables (Sneak Attack, Rage damage, Brutal Critical, Song of Rest, Superiority die, Wild Shape CR, Extra Attack). Also filled: Maneuver and Trick Shot DCs, shield bonus, cantrips known, Mystic Arcanum, and chosen metamagic, invocations, pact boon and Channel Divinity options.
- Page counts for the test character are unchanged (Official Standard 3, Official Alternative 4, Eldritch Knight 4, Compact 3).
- Limits: only the Eldritch Knight sheet was checked with real character data. Other class boxes are covered by synthetic tests. D&D Beyond pool names that differ from those listed, and favoured enemy and terrain choices, are not mapped yet.

## Optimisation pass — 4 October 2026

Measured with the same test character (Node, after warm-up); before → after.

| Style | Export time | File size |
| --- | --- | --- |
| Official Standard | 259 → 136 ms | 0.48 → 0.35 MB |
| Official Alternative | 244 → 125 ms | 0.59 → 0.38 MB |
| Eldritch Knight | 474 → 117 ms | 5.65 → 4.48 MB |
| Compact | 120 → 67 ms | 0.24 → 0.12 MB |

- Every page of every style rendered pixel-identical before and after.
- Field creation was quadratic: pdf-lib re-reads every existing field name on each new field. A shared factory now attaches fields directly.
- Saving drops objects the document no longer uses: appearance streams replaced after a field changes, and pages copied only to be drawn. Saving and parsing no longer pause every 50–100 objects (browsers clamp each pause to 4 ms or more).
- Continuation pages and extra class spell-card pages draw artwork already in the document. Page images are stored once, and the `*-reference` templates (3.3 MB for class sheets) are no longer downloaded.
- Photo portraits are sent as JPEG; images with transparency stay PNG. The test portrait adds about 0.16 MB instead of about 1.2 MB.
- Templates: 34 MB of unreferenced leftover page images were removed (`scripts/prune-templates.mjs`). All 56 template pages render identically.
- The browser loads the minified PDF library (206 KB gzipped instead of 410 KB).

Accuracy and content added in the same pass:
- Single-class Champion fighters and Thief rogues no longer show the Eldritch Knight or Arcane Trickster slot table that D&D Beyond attaches to the base class.
- Multiclass slots use the PHB table.
- Equipped, attuned item bonuses and set scores apply to saves, skills and scores.
- Jack of All Trades and Remarkable Athlete apply to checks and initiative.
- Other movement speeds, magic item effects, class equipment slots and attunement circles are now filled.
- Compact merges proficiency-only traits into one entry, puts the source page beside each spell name, and lists class dice.
- Compact no longer fails when two spells, actions or features share a name.
- A heading no longer ends a full panel without its text.
- Limits: Pact Magic slot tracking, item charges and conditional modifiers are still not imported. Magic item placement by slot uses the item name.
