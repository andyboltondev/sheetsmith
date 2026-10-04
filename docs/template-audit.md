# Template audit — 25 September 2026

Test character: Kazrek Ironscript, D&D Beyond character 171344792; Mountain Dwarf, Fighter 3 / Eldritch Knight, Chaotic Good. Rules edition: 5e (2014).

## Scope and results

- Exported all 27 selectable layouts (two official, 24 class variants, Field Notes) in both ability orders: 54 exports, 220 pages.
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

This validates layout mapping with this character, not every class mechanic. Missing or dynamic feature limits and multiclass slot calculations are not guessed. Conditional weapon bonuses remain separate from base rolls. Printed future-level rules embedded in supplied artwork remain part of that artwork. PHB page references are only used when present in the source; Basic Rules references retain their own book label. Browser automation was unavailable, so the checks cover generated PDFs and automated application tests, not a fresh interactive browser walkthrough.

## Readability pass — 4 October 2026

Re-exported all 27 layouts in both ability orders (54 exports) with the same test character; all succeeded with no raw field identifiers in the output.

- Multiline boxes now use the largest size that fits (official 10→7 pt, class 8→6 pt) and shrink before overflowing. Related boxes share one size: personality/ideals/bonds/flaws, allies/enemies and the class feature column.
- Overflow splits at a line or sentence boundary, never mid-sentence. Continued text is titled in plain language, e.g. "PERSONALITY TRAITS (CONTINUED)", and each box says where it continues. Line structure is preserved, so equipment lists are no longer merged into one paragraph.
- Possessions and holdings use the official sheets' Treasure box. Short lists in wide boxes run inline before overflowing. Single items drop the "1 x" prefix, and coins list only what is held.
- Class sheets: feature text clears the level badges, casting-time text clears the concentration bubble, favourite-spell reminders never spawn pages (the spell cards hold full text), and continuation pages use 8 pt instead of 6 pt.
- Field Notes spacing is tighter. Result: official sheets 4→3 pages and Field Notes 6→5 for this character.
- Accuracy: overriding Max HP now keeps recorded damage, so current HP cannot exceed the new maximum. "1 times" reads as "once". Spell reminders no longer show a doubled full stop.
