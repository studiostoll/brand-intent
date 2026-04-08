# Brand Intent — Specification v0.1

This document defines the formal grammar for all five Brand Intent file types. For the reasoning behind these decisions, see [DESIGN.md](DESIGN.md).

---

## General Syntax

All Brand Intent files share these rules:

- **Line-based.** Each non-blank, non-comment line is a statement.
- **Indentation-based nesting.** Child properties use 2-space indentation. Sub-blocks use 4-space indentation.
- **`#` comments.** Whole-line comments are ignored by the parser. Inline comments (after a value) are allowed.
- **No quotes required** for simple string values. Quotes are only needed when a value contains `#` (which would otherwise start a comment).
- **`$reference` syntax** for cross-referencing named values within the same file (e.g., `$primary` referencing a color named `primary` in `brand-colors`).
- **Presence as boolean.** Some flags (e.g., `italic`, `uppercase`) are set by presence alone — no `: true` needed.
- **Named blocks** use the form `keyword NAME` (e.g., `theme Laden`, `audience regulars`), not `keyword: { NAME: { ... } }`.

### Value Types

| Type | Examples | Notes |
|------|----------|-------|
| `string` | `Libre Franklin`, `informal` | Unquoted unless contains `#` |
| `int` | `800`, `1080` | Integer |
| `float` | `1.15`, `0.02` | Decimal number |
| `hex` | `#2C1810`, `#FAF6F0` | CSS hex color (3, 6, or 8 digits) |
| `enum` | `left`, `informal`, `local` | One of a fixed set of values |
| `list` | `a, b, c` | Comma-separated or space-separated |
| `insets` | `40`, `40 80`, `40 80 50 60` | 1, 2, or 4 values (CSS shorthand) |
| `ref` | `$primary`, `$white` | Reference to a named value in the same file |
| `flag` | `italic`, `uppercase` | Bare word = true; absence = false |

---

## Layer 1 — Identity (`.identity`)

**Cardinality:** One per brand.
**File extension:** `.identity`
**Filename convention:** `brandname.identity` (e.g., `krume.identity`)

The identity file encodes brand strategy in machine-readable form. It contains no visual properties of any kind.

### Top-Level Keys

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `essence:` | string | Yes | One-sentence brand essence |
| `promise:` | string | Yes | Brand promise (may span multiple lines via indentation) |
| `voice` | block | Yes | Voice and tone definition |
| `pillars` | block | Yes | Content pillar definitions |
| `audience NAME` | block | Yes (1+) | Audience segment (repeatable) |

### `voice` Block

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `register:` | string | Yes | Formality level (e.g., `informal, Du`) |
| `persona:` | string | Yes | Voice character description |
| `rhythm:` | string | No | Sentence structure guidance |
| `always:` | list | Yes | Concrete rules the brand always follows |
| `never:` | list | Yes | Concrete rules the brand never breaks |

`always:` and `never:` use YAML-style list syntax:
```
always:
  - Sauerteig, not "artisan bread"
  - konkrete Mehlsorten (Tipo 1, Roggen 1150) over "beste Zutaten"
```

**Design principle:** Every item in `always` and `never` should be a concrete, testable rule — not a description or aspiration. An AI agent should be able to evaluate any piece of content against these rules with a yes/no answer.

### `pillars` Block

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `primary:` | list | Yes | Primary content topics |
| `secondary:` | list | No | Secondary content topics |
| `avoid:` | list | Yes | Topics the brand does not inhabit |

### `audience NAME` Block

`NAME` is a lowercase identifier (e.g., `regulars`, `newcomers`).

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `label:` | string | Yes | Human-readable audience name |
| `profile:` | string | No | Demographic and behavioral description |
| `motivation:` | string | Yes | What this audience wants from the brand |
| `language:` | string | Yes | Tone and register guidance for this audience |

### Exclusion Rule

An `.identity` file must NOT contain: hex values, font names, type sizes, spacing values, composition rules, canvas dimensions, or platform specifications.

### Example

```yaml
# krume.identity

essence:  Brot ist Handwerk, nicht Lifestyle. Mehl, Wasser, Zeit.
promise:  Wer reinkommt, riecht sofort, dass hier seit vier Uhr
          morgens jemand steht.

voice
  register:  informal, Du
  persona:   Bäckerin hinterm Tresen — direkt, trocken, stolz auf das Handwerk
  rhythm:    kurze Sätze, konkrete Angaben, kein Erklären

  always:
    - Sauerteig, not "artisan bread"
    - konkrete Mehlsorten (Tipo 1, Roggen 1150) over "beste Zutaten"
    - Backzeit in Stunden, nicht "lange Teigführung"
    - Kiez-Bezug (Neukölln, Weserstraße) over "unser Standort"

  never:
    - Lifestyle-Sprache (kuratiert, handverlesen, Genussmoment)
    - "Artisan" oder "Craft" — wir sagen Handwerk
    - Englische Begriffe wenn ein deutsches Wort existiert

pillars
  primary:   Sauerteig, Handwerk, Zutaten, Kiez
  secondary: Saisonales, Nachhaltigkeit, Backwissen
  avoid:     Lifestyle-Gastronomie, Wellness-Ernährung, Influencer-Kultur

audience regulars
  label:       Stammkunden aus dem Kiez
  profile:     25–65, täglich oder wöchentlich, kennen die Sorten
  motivation:  ihr Brot, ihr Laden, verlässlicher Rhythmus
  language:    knapp, direkt, kein Erklären — die wissen Bescheid

audience newcomers
  label:       Neugierige und Laufkundschaft
  profile:     Touristen, neue Nachbarn, Marktbesucher
  motivation:  gutes Brot finden, verstehen was anders ist
  language:    einladend, konkret, erklärt ohne belehrend zu sein
```

---

## Layer 2 — Brand (`.brand`)

**Cardinality:** One per brand.
**File extension:** `.brand`
**Filename convention:** `brandname.brand` (e.g., `krume.brand`)

The brand file encodes derived expression intent — visual language and operationalized voice parameters. Every decision should be traceable to a statement in `.identity`.

### Top-Level Keys

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `id:` | string | Yes | Brand identifier |
| `name:` | string | Yes | Display name |
| `language:` | string | Yes | ISO 639-1 language code (e.g., `de`) |
| `locale:` | string | Yes | BCP 47 locale (e.g., `de-DE`) |
| `brand-colors` | block | Yes | Color primitive definitions |
| `theme NAME` | block | Yes (1+) | Semantic theme (repeatable) |
| `font NAME` | block | Yes (1+) | Font definition (repeatable) |
| `typography NAME` | block | Yes (1+) | Named typography style (repeatable) |
| `voice-constraints` | block | No | Operationalized voice parameters |
| `content-defaults` | block | No | Production-level defaults |
| `spacing:` | block | No | Spacing token scale |
| `divider NAME` | block | No | Named divider style (repeatable) |

### `brand-colors` Block

Named color primitives. Each entry is `name: hex`. Optional 4-space indented print specs below each color.

```yaml
brand-colors
  primary:   #2C1810
    pantone: 286 C
    cmyk: 97/80/0/31
  accent1:   #C8A47E
  white:     #FAF6F0
```

### `theme NAME` Block

Maps semantic slot names to colors. Colors are hex values or `$references` to `brand-colors` names.

**Valid theme slots:**

| Slot | Description |
|------|-------------|
| `background` | Canvas background |
| `text-primary` | Primary text color |
| `text-secondary` | Secondary text color |
| `text-tertiary` | Tertiary text color |
| `text-subtle` | Subtle text |
| `text-muted` | Most muted text |
| `logo` | Logo color |
| `cta` | Call-to-action color |
| `label-bg` | Label badge background |
| `label-fg` | Label badge foreground |
| `sticker-bg` | Sticker background |
| `sticker-fg` | Sticker foreground |
| `icon` | Icon color |
| `divider` | Divider color |

```yaml
theme Laden
  background:     $white
  text-primary:   $primary
  text-secondary: $secondary
  cta:            $accent2
  divider:        $accent1
```

### `font NAME` Block

`NAME` is a lowercase identifier. The first font defined is the brand default.

| Key | Type | Required | Values |
|-----|------|----------|--------|
| `name:` | string | Yes | Font family name |
| `fallback:` | string | Yes | CSS fallback (e.g., `sans-serif`) |
| `source:` | enum | Yes | `local` \| `system` \| `google` |

### `typography NAME` Block

`NAME` is a lowercase identifier (e.g., `headline`, `body`, `caption`, `number`, `label`).

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `weight:` | int | Yes | Font weight (100–900) |
| `size:` | float | Yes | Font size in cqh |
| `lineHeight:` | float | Yes | Line height multiplier |
| `font:` | string | No | Named font key; defaults to brand primary |
| `strong:` | int | No | Weight for `**strong**` markup (100–900) |
| `opsz:` | float | No | Optical size axis value |
| `letterSpacing:` | float | No | Letter spacing in em |
| `autofit-min:` | float | No | Minimum autofit size (cqh) |
| `autofit-max:` | float | No | Maximum autofit size (cqh) |
| `italic` | flag | No | Enable italic |
| `uppercase` | flag | No | Enable uppercase transform |

### `voice-constraints` Block

Operationalized voice parameters derived from `.identity` voice reasoning. These are production-enforceable constraints, not restated strategy.

| Key | Type | Description |
|-----|------|-------------|
| `register:` | string | Formality level (must match `.identity`) |
| `sentence-max:` | int | Maximum words per sentence |
| `headline-pattern:` | string | Headline structure pattern (e.g., `noun-first`, `verb-first`) |
| `number-format:` | enum | `cardinal` \| `digit` — "drei" vs "3" |

This vocabulary is extensible. Custom keys are allowed and passed through to AI context.

### `content-defaults` Block

Production-level defaults derived from identity.

| Key | Type | Values |
|-----|------|--------|
| `density:` | enum | `low` \| `medium` \| `high` |
| `image-treatment:` | enum | `full-bleed` \| `natural` \| `contained` |
| `divider:` | string | Named divider style or `none` |

### `spacing:` Block

```yaml
spacing:
  unit: cqmin
  xs: 1.5
  s: 2
  m: 3
  l: 5
  xl: 6.5
```

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `unit:` | string | `cqmin` | Unit for all spacing values |
| `xs`, `s`, `m`, `l`, `xl` | float | — | Spacing scale values |

### `divider NAME` Block

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `thickness:` | float | `0.2` | Line thickness (cqmin) |
| `width:` | string | `100%` | Width as percentage |
| `color:` | string | `text-tertiary` | Theme slot name or hex |
| `align:` | enum | `left` | `left` \| `center` \| `right` |
| `spacing:` | string | `xs` | Spacing token name |

### Exclusion Rule

A `.brand` file must NOT contain: identity reasoning, audience definitions, content pillar descriptions, strategic prose, composition rules, or platform specifications.

---

## Layer 3 — Format (`.format`)

**Cardinality:** Multiple per brand.
**File extension:** `.format`
**Filename convention:** descriptive kebab-case (e.g., `instagram-4-5-feed-portrait.format`)

The format file describes a canvas — platform, dimensions, safe zones. It knows nothing about what content means or how elements should be arranged.

### Keys

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `id:` | string | Yes | Unique identifier (e.g., `4:5`, `A4`) |
| `label:` | string | Yes | Display label |
| `sublabel:` | string | Yes | Secondary label (e.g., `Feed Portrait`) |
| `category:` | enum | Yes | `instagram` \| `linkedin` \| `print` \| `signage` |
| `size:` | string | Yes | Dimensions — pixels (e.g., `1080 1350`) or mm (e.g., `210mm 297mm`) |
| `grid:` | string | Yes | Row × column grid (e.g., `5 4`) |
| `danger:` | insets | No | Pixels/mm always cropped by platform (default: `0`) |
| `crop:` | insets or `none` | No | Pixels/mm that may be cropped by UI (default: `none`) |
| `comfort:` | float | No | Safe reading margin (default: `0`) |
| `dpi:` | int | No | Print resolution (default: `300` for print/signage) |
| `bleed:` | float | No | Print bleed margin in mm |
| `purposes:` | list | No | Valid purpose IDs for this format (default: all) |
| `no:` | list | No | Capability restrictions (e.g., `motion video`) |

### Safe Zone Model

```
┌─────────────────────────────────────┐
│ danger — always cropped by platform │
│  ┌──────────────────────────────┐   │
│  │ crop — may be cropped by UI  │   │
│  │  ┌───────────────────────┐   │   │
│  │  │ comfort — safe reading│   │   │
│  │  │                       │   │   │
│  │  │     content area      │   │   │
│  │  │                       │   │   │
│  │  └───────────────────────┘   │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

### Inset Shorthand

- **1 value:** all sides — `40` → top/right/bottom/left = 40
- **2 values:** vertical horizontal — `40 80` → top/bottom = 40, left/right = 80
- **4 values:** top right bottom left — `40 80 50 60`

### Exclusion Rule

A `.format` file must NOT contain: color values, typography, voice, brand strategy, slot definitions, or composition rules.

---

## Layer 4 — Purpose (`.purpose`)

**Cardinality:** Multiple per brand. Can be shared across brands.
**File extension:** `.purpose`
**Filename convention:** descriptive kebab-case (e.g., `daily-bread.purpose`)

The purpose file defines a content type through semantic slots and composes AI context from upstream layers.

### Top-Level Keys

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `id:` | string | Yes | Unique purpose identifier |
| `name:` | string | No | Display name (derived from id if omitted) |
| `compositions:` | list | Yes | Valid composition IDs for this purpose |
| `density:` | enum | No | `light` \| `medium` \| `full` |
| `identity-filter` | block | No | Filters the composed upstream |
| `identity-extension` | block | No | Adds purpose-specific AI context |
| `slot SLOTID` | block | Yes (1+) | Semantic slot definition (repeatable) |

### Semantic Slots

The following slot IDs are valid:

| Slot ID | Role |
|---------|------|
| `primary` | Main communicative act (headline, key message) |
| `secondary` | Supporting signal (subline, number, kicker) |
| `detail` | Extended content (body text, list items) |
| `meta` | Contextual information (date, attribution, caption) |
| `cta` | Call to action |
| `label` | Orientation marker (category badge, tag) |

These names are fixed. They travel through the entire stack — a composition places `primary` without knowing what it contains; a purpose defines what `primary` means without knowing where it sits.

### `slot SLOTID` Block

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `label:` | string | Yes | Human-readable slot name |
| `typography:` | string | Yes | Named typography style from `.brand` |
| `color:` | string | No | Theme slot name (e.g., `text-primary`, `cta`) |
| `maxLength:` | int | Yes | Character limit |
| `samples:` | list | Yes | Example content (pipe-separated or multi-line) |
| `type:` | enum | No | `text` (default) or `list` |
| `override:` | block | No | Typography property overrides (4-space indent) |

#### Samples Format

**Inline:** `samples: Roggenbrot | Vollkornbrot | Sauerteiglaib`

**Multi-line:**
```yaml
samples:
  - Roggenbrot 750 g
  - Vollkornbrot 500 g
  - Dinkellaib mit Walnuss
```

#### `type: list` Sub-Block (4-space indent)

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `maxItems:` | int | — | Maximum items |
| `maxLength:` | int | — | Max characters per item |
| `samples:` | list | — | Example list content |
| `icons:` | bool | `false` | Per-item icons supported |
| `direction:` | enum | `vertical` | `vertical` \| `horizontal` |
| `itemGap:` | float | `0.5` | Gap between items (em) |

#### `override:` Sub-Block (4-space indent)

Any typography property can be overridden: `weight`, `size`, `opsz`, `lineHeight`, `letterSpacing`, `italic`, `uppercase`, `autofit-min`, `autofit-max`, `autofit: none`, `textAlign`.

### `identity-filter` Block

Selects a relevant subset of the composed upstream (`.identity` + `.brand` resolved together) for this content type. Narrows — does not add.

| Key | Type | Description |
|-----|------|-------------|
| `audience:` | list | Audience IDs to include from `.identity` |
| `pillars:` | enum | `primary` \| `secondary` \| `all` — pillar scope |

Voice rules (`always`, `never`) and `voice-constraints` from `.brand` are always included unless explicitly excluded.

### `identity-extension` Block

Adds only what is genuinely specific to this content type — what cannot be derived from identity or brand. Written as free-form text, indented under the block header.

**The test for what belongs here:**
- Sounds like voice guidance → belongs in `.identity`
- Sounds like a production parameter → belongs in `.brand`
- Appears across 3+ purpose files → belongs upstream
- Is genuinely slot-level and content-type-specific → belongs here

```yaml
identity-extension
  primary is the bread name, 1–3 words.
  secondary is the weight ("750 g") or slice count.
  meta is one sentence: what makes this bread specific.
```

### Exclusion Rule

A `.purpose` file must NOT contain: color values (only named theme slots), absolute positions, canvas dimensions, or full voice/strategy (only filtered references).

---

## Layer 5 — Composition (`.composition`)

**Cardinality:** Multiple. The most reusable layer — zero brand-specific information.
**File extension:** `.composition`
**Filename convention:** descriptive kebab-case (e.g., `editorial.composition`, `panel.composition`)

The composition file describes how slots are arranged on the canvas. It knows slot names and their spatial relationships. Nothing else.

### Top-Level Keys

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `id:` | string | Yes | Composition identifier |
| `name:` | string | No | Display name (derived from id if omitted) |
| `mode:` | enum | No | `grid` \| `flow` (inferred from structure if omitted) |
| `image:` | string | No | Background image placement (default: `full`) |
| `logo:` | string | No | Logo placement |
| `icon:` | string | No | Icon placement |
| `sticky: POSITION [SIZE]` | block | No | Sticky bar (flow mode, repeatable) |
| `flow: [TYPE] [PROPS]` | block | No | Flow region (flow mode) |
| Slot placement lines | — | Yes (grid mode) | Grid slot placements |

### Grid Mode

Explicit row/column placement. Each slot is a single line:

```
SLOTID  row N  cols N--M  ALIGN [VALIGN]
```

- **SLOTID:** `primary`, `secondary`, `detail`, `meta`, `cta`, `label`
- **Row:** numeric (1-based) or keyword (`top`, `center`, `bottom`)
- **Cols:** range `N--M` (1-based)
- **Align:** `left` \| `center` \| `right`
- **Valign** (optional): `top` \| `center` \| `bottom`

```yaml
# editorial.composition — grid mode
id:    editorial
mode:  grid
image: full
logo:  top left

label      row 1  cols 3--3  left
secondary  row 2  cols 1--4  left center
primary    row 3  cols 1--4  left
meta       row 6  cols 1--2  left center
cta        row 6  cols 3--4  right bottom
```

### Flow Mode

Content-driven arrangement using sticky bars and flow regions.

#### `sticky: POSITION [SIZE]` Block

Position: `top` \| `bottom` \| `left` \| `right`
Size (optional, default `m`): `s` \| `m` \| `l`

Items use 2-space indent + `|` prefix:

```yaml
sticky: bottom s
  | logo right
  | meta left bottom
```

#### `flow: [TYPE] [PROPERTIES]` Block

**Types:**
- `flow:` — default fill
- `flow: panel POSITION WIDTH HEIGHT` — floating panel (e.g., `panel bottom-left 2/3 1/1`)
- `flow: split EDGE FRACTION` — split layout (e.g., `split bottom 1/2`)

**Properties** (indented, no pipe):
- `direction: vertical | horizontal`
- `columns: N` (1–6)
- `column-gap: TOKEN`

**Items** (2-space indent + `|` prefix):
- `| spacer-TOKEN` — spacing (TOKEN: `auto`, `xs`, `s`, `m`, `l`, `xl`)
- `| divider-VARIANT` — divider (VARIANT: `ruler`, `hairline`)
- `| SLOTID ALIGN [VALIGN]` — text slot with alignment
- `| logo ALIGN [SIZE]` — logo
- `| icon ALIGN [SIZE]` — icon

```yaml
# panel.composition — flow mode
id:    panel
mode:  flow
image: full

sticky: bottom s
  | logo right

flow: panel bottom-left 2/3 1/1
  | spacer-auto
  | detail left
  | divider-ruler
  | primary left
  | spacer-auto
  | meta left
```

### `image:` Values

- `full` — full-bleed background image
- `none` — no background image
- Grid region — e.g., `top--center cols 1--2`

### `logo:` / `icon:` Placement

```
logo: POSITION ALIGN [SIZE]
```

- **Position:** `top` \| `center` \| `bottom` or `row N` (1-based)
- **Align:** `left` \| `center` \| `right`
- **Size** (optional, default `m`): `s` \| `m` \| `l`
- **Special:** `logo: none` disables the logo

### Exclusion Rule

A `.composition` file must NOT contain: color values, typography values, slot content definitions, brand/voice/identity information, or platform constraints.

---

## Context Composition

When an AI agent generates content, the five layers compose into a single context. The composition order is:

```
.identity (reasoning)
    ↓
.brand (derived expression intent)
    ↓
composed upstream
    ↓
.purpose (identity-filter narrows, identity-extension adds)
    ↓
.format + .composition (condition the specific act of expression)
```

The purpose does not filter `.identity` and `.brand` separately. It filters the **composed upstream** — which includes both the strategic reasoning from `.identity` and the operationalized parameters from `.brand`. The parser resolves which layer each key originates from.

### Composition Rules

1. `voice.always` and `voice.never` from `.identity` are **always included** unless explicitly excluded by `identity-filter`.
2. `voice-constraints` and `content-defaults` from `.brand` are **always included** automatically.
3. `identity-filter.audience` selects which audience blocks to include from `.identity`.
4. `identity-filter.pillars` restricts the pillar scope.
5. `identity-extension` adds text that is not present in any upstream layer.
6. If the same key appears in `identity-extension` and an upstream layer, the upstream value takes precedence (the extension should not restate upstream).

### Validation

A parser should warn when:
- An `identity-extension` restates content from `.identity` (voice guidance, tone descriptions)
- An `identity-extension` restates content from `.brand` (production parameters)
- The same extension text appears in 3+ purpose files (belongs upstream)
- A `slot` references a `typography` style not defined in `.brand`
- A `slot` references a `color` not defined as a theme slot
- An `archetypes` entry references a non-existent `.composition` file
- A `purposes` entry in `.format` references a non-existent `.purpose` file

---

## File Organization

### Single-Brand Project

```
project/
├── brandname.identity
├── brandname.brand
├── formats/
│   └── instagram-4-5-feed-portrait.format
├── purposes/
│   └── daily-bread.purpose
└── compositions/
    └── editorial.composition
```

### Multi-Brand Project

```
project/
├── brands/
│   ├── krume/
│   │   ├── krume.identity
│   │   └── krume.brand
│   └── otherbrand/
│       ├── otherbrand.identity
│       └── otherbrand.brand
├── formats/          ← shared across brands
├── purposes/         ← shared across brands
└── compositions/     ← shared across brands
```

Formats, purposes, and compositions are brand-independent by design. They are shared at the project root. Only `.identity` and `.brand` files are brand-specific.

---

*Brand Intent Specification v0.1 — April 2026*
*See [DESIGN.md](DESIGN.md) for reasoning behind these decisions.*
