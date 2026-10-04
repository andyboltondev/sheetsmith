# Supplied 5e templates

Official Standard is the default; Official Alternative and the matching class sheets are optional. All entries are explicitly 5e. No 5.5e templates are included.

Prepared from the user's `Official 5e Character Sheets.zip` and `Class Character Sheets.zip` archives. Artwork, printed text and original notices are retained. The source archives are unchanged. The prepared PDFs contain page artwork; adjacent JSON files describe editable widget geometry. The exporter recreates independent fields to avoid the original PDFs' duplicated and incorrectly linked form fields.

Official sheets contain the main page and the supplied character-details page. Class sheets contain the primary class page and its back page. Fighter also offers the supplied Eldritch Knight front page. Spellcasters also get the family's spell page (official spellcasting sheet or class spell cards). Overflowing text is placed on editable continuation pages, which reuse each sheet's own Additional Features & Traits artwork. The `official-reference` and `class-reference` files are kept for layout work but are not needed at export time.

After adding or replacing a template PDF, run `node scripts/prune-templates.mjs` to remove objects no page uses (some archive PDFs carry unused page images). Referenced artwork is written back unchanged.

Known source repairs in Official Alternative: separate History from Insight, separate Investigation from Medicine checkboxes, remove overlapping duplicate Acrobatics/Sleight widgets, and correct the swapped Proficiency/Inspiration field names. Ability placement uses actual box coordinates, not potentially misleading original field names.

`catalog.json` lists supported templates. Each `<id>.json` contains names, page indices, rectangles, field types, alignment and original default text. Ability field names in generated PDFs describe their semantic values (`strength.score`, `strength.modifier`, etc.), regardless of their visual position.
