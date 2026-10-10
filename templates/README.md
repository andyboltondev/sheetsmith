# Official sheet layouts

This folder holds **field layouts only**: names, page indices, rectangles, field types and alignment for Wizards of the Coast's official 5e (2014) sheets. They contain no artwork and no printed text. `catalog.json` lists the styles.

- `official-standard.json`: Character Sheet (page 0) and Character Details (page 1).
- `official-alternative.json`: Character Sheet – Alternative (page 0) and Character Details (page 1).
- `official-spells.json`: Spellcasting Sheet (page 0), shared by both styles.

The PDFs themselves are **not** in the repository (`templates/*.pdf` is ignored). Wizards' files are free to download but not licensed for redistribution, and third-party class sheets are not included at all. People download Wizards' form-fillable originals and add them in the app; each file is accepted only if its SHA-256 matches the pinned value in `src/pdf/official.js`. See "Official sheets" in the main README for the link, the file list and the checksums.

## How the PDFs are used

`prepareOfficial` (in `src/pdf/official.js`) verifies each uploaded file again, removes the form and link annotations (Wizards' files have duplicated and partly mislinked fields), and assembles the pages: sheet + details for the style, and the spell page on its own. The exporter then recreates independent fields from these layouts. The assembled artwork is byte-identical to what earlier versions bundled, which was checked page by page against the real downloads.

Known source repairs in Official Alternative, applied through the layout and exporter: separate History from Insight, separate Investigation from Medicine checkboxes, remove overlapping duplicate Acrobatics/Sleight widgets, and correct the swapped Proficiency/Inspiration field names. Ability placement uses actual box coordinates, not potentially misleading original field names. Ability field names in generated PDFs describe their semantic values (`strength.score`, `strength.modifier`, etc.), regardless of their visual position.

## Tests

The suite runs without Wizards' artwork, using blank pages of the right size built from these layouts. To also check the real downloads, unzip them and run:

```sh
SHEETSMITH_OFFICIAL_DIR=path/to/unzipped/folder npm test
```

## Adding or changing a layout

Read the widget geometry from a Wizards PDF with `npm run inspect-pdf -- path/to/sheet.pdf`, write the matching `<id>.json`, list it in `catalog.json`, and add the new file and its SHA-256 to `OFFICIAL_SOURCES` and `OFFICIAL_NEEDS` in `src/pdf/official.js`.
