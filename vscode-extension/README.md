# Brand Intent Language Extension

VS Code extension providing syntax highlighting, autocomplete, and hover documentation for the five file types in the **Brand Intent** specification.

---

## What this extension does

Brand Intent is an open specification for defining brand identity, visual language, and content architecture in plain-text DSL files.

| File type | Extension | Defines |
|---|---|---|
| Identity | `.identity` | Brand essence, voice, pillars, audience segments |
| Brand | `.brand` | Token mode, color themes, typography, spacing, fonts |
| Format | `.format` | Canvas size, grid, safe zones, restrictions |
| Purpose | `.purpose` | Content types, text slots, typography overrides |
| Composition | `.composition` | How elements are arranged on the canvas |

This extension adds:
- **Syntax coloring** -- keywords, values, slot names, rows, columns, hex colors
- **Autocomplete** -- context-sensitive suggestions as you type
- **Hover documentation** -- inline docs for every keyword in all file types

---

## How to install

This extension is not published to the VS Code Marketplace. Install it locally:

### Option A -- workspace extension
Place the extension folder at `.vscode/brand-intent-lang/` in your project root. VS Code picks it up automatically.

### Option B -- install globally
```bash
cp -r path/to/brand-intent-lang ~/.vscode/extensions/brand-intent-lang
```

Then reload VS Code (`Cmd+Shift+P` / `Ctrl+Shift+P` -> "Reload Window").

---

## File type reference

### .identity files

Define the brand's core identity -- its essence, voice, pillars, and target audiences.

```
# Brand Identity

essence: Accessible adventure for everyone
promise: Making the outdoors welcoming and easy to navigate

voice
  register: warm, clear, confident
  persona: A knowledgeable local who speaks plainly
  rhythm: short-punchy
  always: Use active voice, be specific
  never: Use jargon, be condescending

pillars
  primary: Accessibility
  secondary: Adventure
  avoid: Exclusivity

audience Families
  label: Families with children
  profile: Parents planning day trips or vacations
  motivation: Safe, easy, memorable experiences
  language: Reassuring, practical, enthusiastic
```

### .brand files

Define the brand's visual tokens -- its metadata, token source, color themes, typography styles, fonts, spacing, and content constraints.

```
# Brand Definition

id: my-brand
name: My Brand
language: en
locale: en-US
domain: example.com

tokens: inline

voice-constraints
  register: friendly
  sentence-max: 25
  headline-pattern: action-first

content-defaults
  density: medium
  image-treatment: full-bleed

font Primary
  name: Inter
  fallback: system-ui
  source: fonts/Inter.woff2

typography heading
  font: $Primary
  weight: 700
  size: 24
  lineHeight: 1.1

theme Primary
  background: #0324B1
  text-primary: #FFFFFF
  text-secondary: #D0D8F0
  logo: #84D3DA
  cta: #E32D39

spacing:
  unit: cqmin
  xs: 1.5
  s: 2
  m: 3
  l: 5
  xl: 6.5
```

### .format files

Define a canvas format -- its dimensions, grid structure, and what content is allowed on it.

```
id: 1:1
label: 1:1
sublabel: Feed Square
category: instagram

size: 1080 1080
grid: 2 6

danger: 0 135 0 135
comfort: 40

no: motion video
purposes: announcement, event, ad
```

### .purpose files

Define a content purpose -- what the asset is for and how its text slots behave.

```
id: announcement
name: Announcement
compositions: bottom-stack, center-stage, editorial
density: medium
defaultIcon: megaphone regular

identity-filter
  audience: Families
  pillars: primary

slot primary
  label: Headline
  samples: New Season Opening | Summer Festival 2026
  maxLength: 60
  typography: $heading
  color: $text-primary

slot secondary
  label: Subline
  samples: Join us for the grand opening
  maxLength: 120

slot detail
  label: Details
  samples: June 15, 2026 | Central Park

slot cta
  label: Call to Action
  samples: Learn More | Sign Up
```

### .composition files

Define how elements are arranged on the canvas. A composition describes the spatial relationship between image, logo, icon, and text slots.

```
id: bottom-stack
name: Bottom Stack

image: full
logo: top col right m

mode: grid
primary    row 5 cols 1--4 left
secondary  row 4 cols 1--4 left
detail     row 6 cols 1--3 left
cta        row 6 cols 4--4 right
```

Flow-based compositions use `mode: flow`:

```
id: half-stack-bottom
name: Half Stack Bottom

image: full
mode: flow

flow: split bottom 1/2
  | primary left
  | spacer-s
  | secondary left
  | spacer-auto
  | detail left
```

## Editing the extension

### Syntax grammars -- `syntaxes/*.tmLanguage.json`

TextMate grammars. Each grammar is a JSON file with `patterns` and a `repository` of named rules. Each rule has a `match` regex and `captures` that assign scope names.

Scope names map to colors via the user's VS Code theme: `keyword.control` = keyword color, `constant.numeric` = number color, `entity.name.tag` = type/class color, `comment.line` = comment color.

### Autocomplete provider -- `extension.js`

Registers `CompletionItemProvider` and `HoverProvider` for each language. The completion provider fires on trigger characters (space, colon, dash) and inspects the current line prefix with regex to decide what to suggest.

### Language configuration -- `language-configuration.json`

Tells VS Code that `#` starts a line comment. Enables `Cmd+/` to toggle comments.

---

## License

MIT
