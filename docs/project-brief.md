# D&D Beyond Character Sheet Generator

## 1. Project Overview

Build a lightweight web application that allows a user to import a D&D Beyond character using a character URL or character-service URL, then generate a completed PDF character sheet from an editable PDF template.

The application should extract and normalise character data, allow a small number of user overrides such as Player Name and portrait, then populate a selected PDF template.

The project should be designed so that the D&D Beyond importer is modular and can be replaced or supplemented later if the undocumented D&D Beyond character endpoint changes.

---

# 2. Core Goals

The application should:

- Accept a D&D Beyond character URL.
- Extract the character ID automatically.
- Fetch the corresponding character JSON.
- Parse and normalise relevant character data.
- Calculate derived character-sheet values where required.
- Allow the user to override selected information.
- Support an optional character portrait.
- Populate an editable PDF character sheet.
- Download/export the completed PDF.
- Support multiple PDF templates through configurable field mappings.
- Keep the importer, character model and PDF generation layers separate.

The initial version should prioritise simplicity and reliability over supporting every possible D&D Beyond edge case.

---

# 3. Example Input

The application should accept normal D&D Beyond character URLs such as:

```text
https://www.dndbeyond.com/characters/171344792
```

It should also optionally accept direct character-service URLs such as:

```text
https://character-service.dndbeyond.com/character/v5/character/171344792
```

The application should extract:

```text
171344792
```

and use it to request the corresponding character data.

---

# 4. User Flow

## Step 1: Import Character

The main screen should contain:

### Character URL

```text
D&D Beyond Character URL

[________________________________________]
```

Primary action:

```text
[ Import Character ]
```

After import, display a simple summary so the user can confirm the correct character was loaded.

For example:

```text
Kazrek Ironscript

Dwarf
Fighter 5
Folk Hero

[character portrait]
```

---

## Step 2: Configure Output

After a successful import, allow the user to configure:

### Player Name

```text
Player Name
[________________________]
```

The user-entered value should override any player/account information discovered in the imported data.

This field should be optional.

---

### Character Portrait

Provide:

```text
Character Portrait

○ Use D&D Beyond portrait
○ Upload custom image
○ No portrait
```

If a custom image is uploaded, support common formats such as:

- JPG
- JPEG
- PNG
- WebP

Optional simple image controls may include:

- Fit
- Fill
- Crop
- Centre
- Zoom
- Position

Advanced image editing is not required for the MVP.

---

### PDF Template

Provide a template selector:

```text
Character Sheet

[ Standard 5e Character Sheet ▼ ]
```

Additional templates can be added later without modifying the character importer.

---

## Step 3: Generate

Primary action:

```text
[ Generate Character Sheet ]
```

The application should:

1. Populate the selected PDF.
2. Insert the selected portrait if supported by the template.
3. Apply user overrides.
4. Generate the final PDF.
5. Allow the completed PDF to be downloaded.

---

# 5. Architecture

Use a layered architecture:

```text
D&D Beyond
     ↓
D&D Beyond Importer
     ↓
Normalised Character Model
     ↓
Rules / Calculation Engine
     ↓
Template Mapper
     ↓
PDF Generator
     ↓
Completed Character Sheet
```

These layers should remain independent wherever practical.

---

# 6. D&D Beyond Importer

Create a dedicated D&D Beyond importer.

Responsibilities:

- Accept a D&D Beyond URL.
- Extract the character ID.
- Retrieve the character JSON.
- Validate the response.
- Pass the raw data to the normalisation layer.

Example interface:

```text
importCharacter(characterId)
```

The rest of the application should not depend directly on the D&D Beyond JSON structure.

This is important because the character-service endpoint is undocumented and may change.

---

# 7. Normalised Character Model

Convert imported data into an internal application format.

Example structure:

```text
Character
├── identity
│   ├── name
│   ├── playerName
│   ├── portrait
│   ├── race
│   ├── species
│   ├── background
│   ├── alignment
│   └── experience
│
├── classes
│   ├── class
│   ├── subclass
│   └── level
│
├── abilities
│   ├── strength
│   ├── dexterity
│   ├── constitution
│   ├── intelligence
│   ├── wisdom
│   └── charisma
│
├── combat
│   ├── armourClass
│   ├── initiative
│   ├── speed
│   ├── maxHP
│   ├── currentHP
│   ├── temporaryHP
│   ├── hitDice
│   └── deathSaves
│
├── saves
├── skills
├── proficiencies
├── languages
├── senses
├── attacks
├── equipment
├── currency
├── features
├── traits
├── ideals
├── bonds
├── flaws
└── spellcasting
```

PDF templates should consume this model rather than the original API response.

---

# 8. Derived Calculations

Some character-sheet values may not be available directly as final values and must be calculated.

The application should support calculation of common values including:

- Ability modifiers
- Proficiency bonus
- Saving throws
- Skill bonuses
- Passive Perception
- Passive Investigation
- Passive Insight
- Initiative
- Armour Class
- Movement speed
- Maximum HP
- Hit dice
- Spell save DC
- Spell attack bonus
- Weapon attack bonuses
- Weapon damage bonuses

Calculations should account for imported modifiers where possible.

---

# 9. Ability Scores

Support:

- Base ability score
- Racial/species bonuses
- Feat bonuses
- Class bonuses
- Other imported modifiers
- Final score
- Ability modifier

Example:

```text
Strength

Base: 15
Species: +2
Other: +0

Final: 17
Modifier: +3
```

Only the final relevant values need to be displayed in the generated PDF.

---

# 10. Skills

Each skill should contain:

```text
name
ability
proficient
expertise
bonus
```

Support:

- Normal proficiency
- Expertise
- Jack-of-all-trades style bonuses where applicable
- Imported modifiers

---

# 11. Saving Throws

Each saving throw should include:

```text
ability
proficient
bonus
```

---

# 12. Combat Data

Support common combat information including:

- Armour Class
- Initiative
- Speed
- Maximum HP
- Current HP
- Temporary HP
- Hit dice
- Death saves where available

For a printable character sheet, Current HP may optionally be left blank even when present in D&D Beyond.

Template configuration should determine this behaviour.

---

# 13. Attacks

Normalise usable attacks into a simple structure.

Example:

```text
Attack
├── name
├── attackBonus
├── damage
├── damageType
├── range
└── notes
```

Example output:

```text
Longsword
+6
1d8+3 slashing
```

Only a reasonable number of attacks need to fit the selected PDF template.

Overflow handling should be configurable.

---

# 14. Equipment

Extract relevant inventory information.

Support:

- Item name
- Quantity
- Equipped state
- Attunement where applicable
- Weight
- Notes

The MVP does not need to reproduce the full D&D Beyond inventory interface.

---

# 15. Currency

Support standard currencies where available:

- CP
- SP
- EP
- GP
- PP

---

# 16. Character Traits

Support common descriptive fields:

- Personality Traits
- Ideals
- Bonds
- Flaws

Also support:

- Appearance
- Age
- Height
- Weight
- Eyes
- Skin
- Hair

where data exists and where the selected template contains appropriate fields.

---

# 17. Features and Traits

Collect relevant features from sources such as:

- Race/species
- Class
- Subclass
- Background
- Feats

Normalise these into:

```text
Feature
├── name
├── source
└── description
```

Long descriptions may require trimming or overflow handling.

---

# 18. Spellcasting

For spellcasters, support:

- Spellcasting ability
- Spell save DC
- Spell attack bonus
- Spell slots
- Cantrips
- Prepared spells
- Known spells
- Spell level
- Spell name
- Prepared state

Detailed spell descriptions do not need to be inserted into the main character sheet unless the selected template specifically supports them.

Spell sheets may be implemented as separate PDF templates.

---

# 19. Multiclass Characters

The character model should support multiple classes from the beginning.

Example:

```text
classes:
- Fighter 3
- Wizard 2
```

The PDF mapper should convert this to an appropriate display format such as:

```text
Fighter 3 / Wizard 2
```

Multiclass spellcasting and complex derived calculations may be implemented incrementally.

---

# 20. PDF Template System

Templates should preferably be editable/fillable PDFs using AcroForm fields.

Each template should have a configuration describing how internal character values map to PDF fields.

Example:

```text
template:
  name: Standard 5e Sheet

mapping:
  CharacterName: identity.name
  PlayerName: identity.playerName
  ClassLevel: classes.formatted
  Race: identity.race
  Background: identity.background

  STR: abilities.strength.score
  STRmod: abilities.strength.modifier

  DEX: abilities.dexterity.score
  DEXmod: abilities.dexterity.modifier

  AC: combat.armourClass
  Initiative: combat.initiative
  Speed: combat.speed
  HPMax: combat.maxHP
```

Do not hard-code template field names into the importer.

---

# 21. Template Configuration

Each template should define:

- Template name
- PDF file
- Field mappings
- Portrait location
- Portrait dimensions
- Portrait crop behaviour
- Maximum attack rows
- Maximum equipment rows
- Feature text fields
- Overflow behaviour
- Optional additional pages

Example:

```text
template.json
```

This makes adding new templates primarily a configuration task.

---

# 22. Portrait Placement

PDF portraits should not require an existing PDF image form field.

The template configuration can instead define a rectangle:

```text
portrait:
  page: 1
  x: 420
  y: 590
  width: 110
  height: 140
  mode: cover
```

The application can render the image directly onto the PDF.

---

# 23. Text Overflow

PDF fields may have limited space.

Support simple overflow strategies:

```text
shrink
truncate
wrap
overflow-page
```

The MVP can use:

```text
shrink
```

for most short fields and:

```text
truncate
```

for selected long fields.

Later versions may generate continuation pages automatically.

---

# 24. User Overrides

The application should support an override layer.

Initially:

- Player Name
- Character Portrait

The architecture should allow future overrides such as:

- Character Name
- Alignment
- Notes
- Campaign Name
- Level
- XP

Overrides should never modify the imported source data.

Instead:

```text
Imported Character
       +
User Overrides
       ↓
Final Character Data
```

---

# 25. Error Handling

Provide clear errors for:

### Invalid URL

```text
We couldn't find a valid D&D Beyond character ID in this URL.
```

### Character unavailable

```text
This character could not be retrieved.

Check that the character exists and is accessible.
```

### D&D Beyond service unavailable

```text
D&D Beyond character data is currently unavailable.
Please try again later.
```

### Unsupported data

The application should still generate a sheet where possible rather than failing because one optional field could not be interpreted.

---

# 26. Privacy

Avoid permanently storing character data unless persistence is intentionally added later.

For the MVP:

- Character data should exist only during the session.
- Uploaded portraits should not be permanently retained.
- Generated PDFs should not be permanently stored.
- No account should be required.

Where practical, processing should happen locally or transiently.

---

# 27. Interface

The interface should be modern, simple and focused.

Suggested flow:

```text
D&D Beyond Character Sheet Generator

Import your character

D&D Beyond URL
[________________________________________]

[ Import Character ]
```

After import:

```text
Kazrek Ironscript
Dwarf • Fighter 5

[ portrait ]

Player Name
[ Andy ]

Portrait
[ Use D&D Beyond ▼ ]

Character Sheet
[ Standard 5e ▼ ]

[ Generate PDF ]
```

Avoid exposing raw JSON or technical configuration to normal users.

---

# 28. Responsive Design

The web interface should work well on:

- Desktop
- Laptop
- Tablet
- Mobile

Generating and downloading PDFs should work on modern desktop and mobile browsers.

---

# 29. Accessibility

The interface should follow good accessibility practices.

Include:

- Semantic HTML
- Proper form labels
- Keyboard navigation
- Visible focus states
- Accessible error messages
- Good colour contrast
- Screen-reader friendly controls
- No reliance on colour alone to convey information

---

# 30. Light and Dark Mode

Support:

- Light mode
- Dark mode
- System preference

Example:

```text
Light | Dark | System
```

---

# 31. Suggested Technical Architecture

A modern TypeScript-based web stack would suit the project well.

Potential structure:

```text
src/
├── importers/
│   └── dndbeyond/
│       ├── fetch-character.ts
│       ├── parser.ts
│       └── types.ts
│
├── character/
│   ├── model.ts
│   ├── calculations.ts
│   ├── skills.ts
│   ├── combat.ts
│   └── spells.ts
│
├── pdf/
│   ├── generator.ts
│   ├── templates.ts
│   ├── mapping.ts
│   └── images.ts
│
├── templates/
│   └── standard-5e/
│       ├── template.pdf
│       └── template.json
│
└── ui/
```

Exact framework choice is flexible.

---

# 32. Recommended PDF Approach

Use a JavaScript/TypeScript PDF library capable of:

- Loading existing PDFs
- Reading form fields
- Setting field values
- Embedding fonts
- Drawing images
- Flattening fields if desired
- Exporting PDF bytes

The application should preserve the original PDF artwork and only populate the relevant fields.

---

# 33. Form Flattening

Provide an option internally to either:

### Keep fields editable

The generated PDF remains a fillable form.

or:

### Flatten PDF

Entered values become part of the PDF content and cannot easily be edited.

The default should probably remain editable unless there is a reason to flatten it.

---

# 34. Template Development Tooling

During development, provide a utility to inspect a PDF template and list all form field names.

Example:

```text
CharacterName
ClassLevel
Background
PlayerName
Race
Alignment
XP
STR
STRmod
DEX
DEXmod
...
```

This will make creating template mappings much easier.

This utility does not need to be exposed to normal users.

---

# 35. MVP Scope

The initial MVP should support:

- D&D Beyond URL import
- Publicly accessible character data
- Basic identity
- Class
- Level
- Race/species
- Background
- Alignment
- Ability scores
- Ability modifiers
- Proficiency bonus
- Saving throws
- Skills
- Passive Perception
- AC
- Initiative
- Speed
- Maximum HP
- Hit dice
- Basic attacks
- Equipment
- Currency
- Traits
- Features
- Basic spellcasting
- Player Name override
- D&D Beyond portrait
- Custom portrait upload
- No portrait option
- One PDF template
- PDF generation
- PDF download

---

# 36. Phase 2

After the MVP is reliable, consider:

- Multiple PDF templates
- Dedicated spell sheets
- Continuation sheets
- Better text overflow
- Complex multiclass support
- More accurate unusual modifier handling
- Character preview before generation
- Editable character fields before generation
- Save user preferences
- Recently used templates
- Drag-and-drop PDF template creation
- Template mapping editor
- Import from uploaded JSON
- Import from other character-management tools

---

# 37. Future Import Architecture

Do not make the application inherently dependent on D&D Beyond.

Use an importer interface such as:

```text
CharacterImporter
├── canImport()
├── import()
└── normalise()
```

Possible future importers:

```text
D&D Beyond
Uploaded JSON
Foundry VTT
Roll20
Manual Entry
Other character managers
```

Every importer should output the same normalised Character model.

---

# 38. Important D&D Beyond Consideration

The D&D Beyond character-service endpoint used by this application is not a documented public developer API.

Therefore:

- Treat it as an external undocumented dependency.
- Keep all D&D Beyond-specific logic isolated.
- Do not tightly couple PDF generation to its JSON structure.
- Handle endpoint changes gracefully.
- Expect fields or structures to change.
- Avoid assuming long-term availability.

Failure of the D&D Beyond importer should not require rewriting the rest of the project.

---

# 39. Testing

Create sample fixtures representing different character types.

At minimum:

```text
basic martial character
spellcaster
multiclass character
character with feats
character with extensive inventory
character with custom portrait
character with missing optional information
```

Store sanitised sample JSON fixtures for automated testing rather than relying exclusively on live D&D Beyond requests.

Test:

- Importing
- Normalisation
- Derived calculations
- PDF mapping
- Portrait placement
- Missing fields
- Overflow
- PDF generation

---

# 40. Success Criteria

The MVP is successful when a user can:

1. Paste a supported D&D Beyond character URL.
2. Import their character.
3. See that the correct character was detected.
4. Optionally enter a Player Name.
5. Choose or upload a portrait.
6. Select a character-sheet template.
7. Click Generate.
8. Receive a correctly populated PDF character sheet.

The user should not need to understand D&D Beyond JSON, PDF field names or any of the underlying calculations.

---

# 41. Project Principle

The application's core concept should remain:

```text
Import once.
Normalise once.
Output anywhere.
```

D&D Beyond should be treated as one character-data source.

PDF character sheets should be treated as interchangeable output templates.

Keeping those two concepts separate will make the project significantly easier to maintain and expand.