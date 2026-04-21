# Brand Intent / Specification v0.1

This document defines the formal grammar for all five Brand Intent file types. For the reasoning behind these decisions, see [DESIGN.md](DESIGN.md).

---

## General Syntax

All Brand Intent files share these rules:

- **Line-based.** Each non-blank, non-comment line is a statement.
- **Indentation-based nesting.** Child properties use 2-space indentation. Sub-blocks use 4-space indentation.
- **`#` comments.** Whole-line comments are ignored by the parser. Inline comments (after a value) are allowed.
- **No quotes required** for simple string values. Quotes are only needed when a value contains `#` (which would otherwise start a comment).
- **`$reference` syntax** for cross-referencing named values within the same file (e.g., `$primary` referencing a color named `primary` in `brand-colors`).
- **Presence as boolean.** Some flags (e.g., `italic`, `uppercase`) are set by presence alone (no `: true` needed).
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

## Layer 1: Identity (`.identity`)

**Cardinality:** One per brand.
**File extension:** `.identity`
**Filename convention:** `brandname.identity` (e.g., `krume.identity`)

The identity file encodes brand strategy in machine-readable form. It contains no visual properties of any kind.

### Top-Level Keys

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `essence:` | string | Yes | One-sentence brand essence (2-5 words ideal) |
| `promise:` | string | Yes | Brand promise: the commitment to the audience |
| `tagline:` | string | No | Public-facing brand claim (also known as "Claim" in DACH) |
| `positioning:` | string | No | Competitive positioning: what makes this brand the only one of its kind |
| `mission:` | string | No | Organizational mission: what the brand does, for whom |
| `vision:` | string | No | Aspirational future state: what the world looks like if the brand succeeds |
| `archetype:` | string | No | Brand archetype shorthand (e.g., `craftsman`, `sage`, `explorer`) |
| `narrative NAME` | block | No | Named brand narrative (repeatable; exactly one should carry `primary` flag) |
| `voice` | block | Yes | Voice and tone definition |
| `values` | block | No | Core brand values with behavior statements (repeatable) |
| `pillars` | block | Yes | Content pillar definitions |
| `audience NAME` | block | Yes (1+) | Audience segment (repeatable) |
| `anti-audience NAME` | block | No | Explicitly not-our-audience (repeatable) |

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

**Design principle:** Every item in `always` and `never` should be a concrete, testable rule, not a description or aspiration. An AI agent should be able to evaluate any piece of content against these rules with a yes/no answer.

### `narrative NAME` Block

Named brand narratives. Each narrative has a lowercase identifier, an optional `primary` flag (exactly one narrative should be marked primary), and free-form multi-line text.

`NAME` is a free-form title — natural language is encouraged (e.g., `Im besonderen Licht`, `Origin Story`, `Mehl Wasser Zeit`).

| Element | Type | Required | Description |
|---------|------|----------|-------------|
| `NAME` | string | Yes | Narrative title (free-form, after `narrative` keyword) |
| `primary` | flag | No | Marks this as the brand's dominant narrative (exactly one) |
| *(text lines)* | string | Yes | Free-form narrative content (indented, multi-line) |

The `primary` narrative is the brand's default story — the one AI agents use when no specific narrative is requested. Supporting narratives serve specific contexts (editorial, campaigns, internal culture).

```yaml
narrative Mehl Wasser Zeit
  primary
  Gegründet 2019, als die Bäckerin ihren Agenturjob
  kündigte, um das zu tun, was sie jeden Morgen seit
  ihrem sechzehnten Lebensjahr getan hat: Brot backen.

narrative Achtzehn Stunden
  Das Brot entsteht in achtzehn Stunden. Kein Schritt
  wird abgekürzt, kein Mehl wird ersetzt.
```

### `values` Block

Repeatable named entries. Each value has a name and a behavior statement that makes it actionable, not just a keyword.

```yaml
values
  Handwerk
    Wir benennen den Prozess, nicht das Ergebnis.
    Backzeit in Stunden, Mehlsorte beim Namen.

  Ehrlichkeit
    Kein Brot ohne Zutatenliste. Keine Versprechen
    die der Teig nicht halten kann.
```

Each value is a named block (the value name on its own line, unindented within `values`), followed by 2-space indented behavior description lines.

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

### `anti-audience NAME` Block

Defines who the brand is explicitly *not* for. This gives an AI agent a concrete "never sound like you're addressing this person" signal.

`NAME` is a lowercase identifier (e.g., `influencers`, `bargain-hunters`).

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `label:` | string | Yes | Human-readable name |
| `description:` | string | Yes | Who they are and why the brand is not for them |

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
  persona:   Bäckerin hinterm Tresen - direkt, trocken, stolz auf das Handwerk
  rhythm:    kurze Sätze, konkrete Angaben, kein Erklären

  always:
    - Sauerteig, not "artisan bread"
    - konkrete Mehlsorten (Tipo 1, Roggen 1150) over "beste Zutaten"
    - Backzeit in Stunden, nicht "lange Teigführung"
    - Kiez-Bezug (Neukölln, Weserstraße) over "unser Standort"

  never:
    - Lifestyle-Sprache (kuratiert, handverlesen, Genussmoment)
    - "Artisan" oder "Craft" - wir sagen Handwerk
    - Englische Begriffe wenn ein deutsches Wort existiert

narrative Mehl Wasser Zeit
  primary
  Gegründet 2019, als die Bäckerin ihren Agenturjob
  kündigte, um das zu tun, was sie jeden Morgen seit
  ihrem sechzehnten Lebensjahr getan hat: Brot backen.

narrative Achtzehn Stunden
  Das Brot entsteht in achtzehn Stunden. Kein Schritt
  wird abgekürzt, kein Mehl wird ersetzt.

pillars
  primary:   Sauerteig, Handwerk, Zutaten, Kiez
  secondary: Saisonales, Nachhaltigkeit, Backwissen
  avoid:     Lifestyle-Gastronomie, Wellness-Ernährung, Influencer-Kultur

audience regulars
  label:       Stammkunden aus dem Kiez
  profile:     25-65, täglich oder wöchentlich, kennen die Sorten
  motivation:  ihr Brot, ihr Laden, verlässlicher Rhythmus
  language:    knapp, direkt, kein Erklären - die wissen Bescheid

audience newcomers
  label:       Neugierige und Laufkundschaft
  profile:     Touristen, neue Nachbarn, Marktbesucher
  motivation:  gutes Brot finden, verstehen was anders ist
  language:    einladend, konkret, erklärt ohne belehrend zu sein
```

---

## Layer 2: Brand (`.brand`)

**Cardinality:** One per brand.
**File extension:** `.brand`
**Filename convention:** `brandname.brand` (e.g., `krume.brand`)

The brand file encodes derived expression intent: visual language and operationalized voice parameters. Every decision should be traceable to a statement in `.identity`.

### Top-Level Keys

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `id:` | string | Yes | Brand identifier |
| `name:` | string | Yes | Display name |
| `language:` | string | Yes | ISO 639-1 language code (e.g., `de`) |
| `locale:` | string | Yes | BCP 47 locale (e.g., `de-DE`) |
| `domain:` | string | No | Canonical domain (used for OG meta, share links) |
| `app-icon:` | string | No | Path to PWA app icon (relative to /public) |
| `favicon:` | string | No | Path to favicon (relative to /public) |
| `og-image:` | string | No | Path to social sharing image (relative to /public) |
| `brand-colors` | block | Yes | Color primitive definitions |
| `theme NAME` | block | Yes (1+) | Semantic theme (repeatable) |
| `font NAME` | block | Yes (1+) | Font definition (repeatable) |
| `typography NAME` | block | Yes (1+) | Named typography style (repeatable) |
| `spacing:` | block | No | Spacing token scale |
| `divider NAME` | block | No | Named divider style (repeatable) |
| `label:` | block | No | Label badge style (padding + radius) |
| `cta:` | block | No | CTA pill style (padding + radius) |
| `logo NAME` | block | No | Brand-declared logo asset (repeatable) |
| `photo NAME` | block | No | Brand-declared photo asset (repeatable) |
| `video NAME` | block | No | Brand-declared video asset (repeatable) |

### `brand-colors` Block

Named color primitives. Each entry is `name: hex`. Optional 4-space indented print specs below each color.

**Brand colors must be solid hex values.** Alpha/opacity is not allowed in this block — alpha expresses *usage*, not a primitive, and belongs in theme slots. Writing `#FFFFFF 50%` or `rgba(...)` as a brand color is a hard parser error.

```yaml
brand-colors
  primary:   #2C1810
    pantone: 286 C
    cmyk: 97/80/0/31
  accent1:   #C8A47E
  white:     #FAF6F0
```

### `theme NAME` Block

Maps semantic slot names to colors. Values are `$references` to `brand-colors` names, raw hex, or either of those with an optional alpha suffix.

**Value grammar:**

| Form | Example | Renders as |
|------|---------|-----------|
| `$ref` | `$white` | resolved hex of the brand color |
| `#HEX` | `#FFFFFF` | pass-through hex |
| `$ref NN%` | `$white 75%` | `rgba(...)` with alpha |
| `#HEX NN%` | `#FFFFFF 30%` | `rgba(...)` with alpha |

**Alpha rules:**

- Separator between base and alpha is exactly one space. `$white/75%`, `$white@75%`, `$white75%` are parser errors.
- Alpha is `0`–`100`, integer or decimal (`12.5%` is valid).
- `100%` emits solid hex, not `rgba()`, to keep output clean.
- Raw `rgba(...)` literals are tolerated for backwards compatibility but discouraged — they bypass the `$ref` chain.

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
| `illustration` | Illustration line color (optional, only for brands with illustrations) |

```yaml
theme Laden
  background:     $white
  text-primary:   $primary
  text-secondary: $secondary
  text-tertiary:  $primary 60%
  text-muted:     $primary 30%
  cta:            $accent2
  divider:        $accent1 40%
```

### `font NAME` Block

`NAME` is a lowercase identifier. The first font defined is the brand default.

| Key | Type | Required | Values |
|-----|------|----------|--------|
| `name:` | string | Yes | Font family name |
| `fallback:` | string | Yes | CSS fallback (e.g., `sans-serif`) |
| `source:` | enum | Yes | `local` \| `system` \| `google` |
| `variable:` | path | No | Variable font filename (relative to brand `fonts/`). Used by preview where weight interpolation matters. |
| `variable-italic:` | path | No | Italic variable font filename, when the family ships separate Roman/Italic variable files. |
| `static-{weight}:` | path | No | Static font instance for the given CSS weight (100–900). E.g. `static-400:`, `static-700:`. |
| `static-{weight}i:` | path | No | Italic static instance for the given weight. E.g. `static-400i:`. |

Static instances are required for export pipelines that cannot embed variable or WOFF2 fonts (Chromium PDF, print). Filenames are relative to the brand's `fonts/` directory and may include subdirectories.

```yaml
font primary
  name:            Helvetica
  fallback:        sans-serif
  source:          local
  variable:        Helvetica-Variable.ttf
  static-400:      Helvetica-Regular.ttf
  static-600:      Helvetica-SemiBold.ttf
  static-400i:     Helvetica-Italic.ttf
```

### `typography NAME` Block

`NAME` is a lowercase identifier (e.g., `headline`, `body`, `caption`, `number`, `label`).

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `weight:` | int | Yes | Font weight (100-900) |
| `size:` | float | Yes | Font size in cqh |
| `lineHeight:` | float | Yes | Line height multiplier |
| `font:` | string | No | Named font key; defaults to brand primary |
| `strong:` | int | No | Weight for `**strong**` markup (100-900) |
| `opsz:` | float | No | Optical size axis value |
| `letterSpacing:` | float | No | Letter spacing in em |
| `autofit-min:` | float | No | Minimum autofit size (cqh) |
| `autofit-max:` | float | No | Maximum autofit size (cqh) |
| `italic` | flag | No | Enable italic |
| `uppercase` | flag | No | Enable uppercase transform |

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
| `xs`, `s`, `m`, `l`, `xl` | float | - | Spacing scale values |

### `divider NAME` Block

Divider color is **not configurable per-divider** — it is always sourced from the active theme's `divider` slot. Adding a `color:` line to a divider block is a hard parser error.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `thickness:` | float | `0.2` | Line thickness (cqmin) |
| `width:` | string | `100%` | Width as percentage |
| `align:` | enum | `left` | `left` \| `center` \| `right` |
| `spacing:` | string | `xs` | Spacing token name |

### `label:` and `cta:` Blocks

Badge/pill style for `label` and `cta` slot rendering. Both optional; both fall back to sensible defaults when omitted.

```yaml
label:
  padding: 0.5 1 0.7 1
  radius: 0

cta:
  padding: 0.8 2.5
  radius: 999
```

| Key        | Type          | Description                                            |
|------------|---------------|--------------------------------------------------------|
| `padding:` | CSS shorthand | 1–4 values in cqh, CSS order (top/right/bottom/left)   |
| `radius:`  | float         | Corner radius in cqh; `999` = full pill                |

**Defaults** when a block is omitted or a field is missing:

- `label` — padding `0.5 1 0.7 1`, radius `0`
- `cta` — padding `0.8 2.5`, radius `999`

### `logo NAME`, `photo NAME`, `video NAME` Blocks

Brand-declared assets — curated logos, photos, and videos that ship with the brand. Each asset has an id (block header), a display label, and a source file path.

```yaml
logo primary
  label: Primary Logo
  src: logos/primary.svg
  aspect: 5.25

photo hero
  label: Hero Shot
  src: photos/hero.jpg

video intro
  label: Intro Clip
  src: videos/intro.mp4
  loop
```

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `label:` | string | No | Display label (defaults to block id) |
| `src:` | string | Yes | Path to asset file (relative to brand base) |
| `aspect:` | float | No | Aspect ratio (width / height) |
| `scale:` | float | No | Size multiplier when rendered |
| `lottie:` | string | No | Path to Lottie JSON (for animated assets) |
| `animated` | flag | No | Marks asset as animated |
| `loop` | flag | No | Marks video/lottie as looping |

### Exclusion Rule

A `.brand` file must NOT contain: identity reasoning, audience definitions, content pillar descriptions, strategic prose, composition rules, or platform specifications.

---

## Layer 3: Format (`.format`)

**Cardinality:** Multiple per brand.
**File extension:** `.format`
**Filename convention:** descriptive kebab-case (e.g., `instagram-4-5-feed-portrait.format`)

The format file describes a canvas: platform, dimensions, safe zones. It knows nothing about what content means or how elements should be arranged.

### Keys

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `id:` | string | Yes | Unique identifier (e.g., `4:5`, `A4`) |
| `label:` | string | Yes | Display label |
| `sublabel:` | string | Yes | Secondary label (e.g., `Feed Portrait`) |
| `category:` | enum | Yes | `instagram` \| `linkedin` \| `print` \| `signage` |
| `size:` | string | Yes | Dimensions in pixels (e.g., `1080 1350`) or mm (e.g., `210mm 297mm`) |
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
│ danger - always cropped by platform │
│  ┌──────────────────────────────┐   │
│  │ crop - may be cropped by UI  │   │
│  │  ┌───────────────────────┐   │   │
│  │  │ comfort - safe reading│   │   │
│  │  │                       │   │   │
│  │  │     content area      │   │   │
│  │  │                       │   │   │
│  │  └───────────────────────┘   │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

### Inset Shorthand

- **1 value:** all sides (`40` → top/right/bottom/left = 40)
- **2 values:** vertical horizontal (`40 80` → top/bottom = 40, left/right = 80)
- **4 values:** top right bottom left (`40 80 50 60`)

### Exclusion Rule

A `.format` file must NOT contain: color values, typography, voice, brand strategy, slot definitions, or composition rules.

---

## Layer 4: Purpose (`.purpose`)

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
| `palette:` | string | No | Color palette strategy (see below) |
| `scope` | block | No | Narrows the composed upstream |
| `context` | block | No | Adds purpose-specific AI context |
| `voice` | block | No | Purpose-specific writing rules (key-value pairs) |
| `camera:` | bool | No | Show Take Photo / Upload buttons. Default: `true` |
| `analyze:` | bool | No | Include in photo/video AI analysis. Default: `true` |
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

These names are fixed. They travel through the entire stack: a composition places `primary` without knowing what it contains; a purpose defines what `primary` means without knowing where it sits.

### `slot SLOTID` Block

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `label:` | string | Yes | Human-readable slot name |
| `typography:` | string | Yes | Named typography style from `.brand` |
| `color:` | string | No | Theme slot name (e.g., `text-primary`, `cta`) |
| `maxLength:` | int | Yes | Character limit |
| `samples:` | list | * | Example content (pipe-separated or multi-line) |
| `value:` | string | * | Fixed text — never AI-generated or shuffled. Mutually exclusive with `samples:` |
| `editable` | bool | No | When `false`, slot is locked (no user editing in any mode). Default: `true` |
| `type:` | enum | No | `text` (default) or `list` |
| `override:` | block | No | Typography property overrides (4-space indent) |

\* Either `samples:` or `value:` is required (not both). `value:` sets a fixed, immutable text.

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
| `maxItems:` | int | - | Maximum items |
| `maxLength:` | int | - | Max characters per item |
| `samples:` | list | - | Example list content |
| `icons:` | bool | `false` | Per-item icons supported |
| `direction:` | enum | `vertical` | `vertical` \| `horizontal` |
| `itemGap:` | float | `0.5` | Gap between items (em) |

#### `override:` Sub-Block (4-space indent)

Any typography property can be overridden: `weight`, `size`, `opsz`, `lineHeight`, `letterSpacing`, `italic`, `uppercase`, `autofit-min`, `autofit-max`, `autofit: none`, `textAlign`.

### `scope` Block

Selects a relevant subset of the composed upstream (`.identity` + `.brand` resolved together) for this content type. It narrows, but does not add.

| Key | Type | Description |
|-----|------|-------------|
| `audience:` | list | Audience IDs to include from `.identity` |
| `pillars:` | enum | `primary` \| `secondary` \| `all` (pillar scope) |

Voice rules (`always`, `never`) from `.identity` are always included. Purpose-specific voice overrides live in the `voice` block on the purpose.

### `context` Block

Adds only what is genuinely specific to this content type, what cannot be derived from identity or brand. Written as free-form text, indented under the block header.

**The test for what belongs here:**
- Sounds like voice guidance → belongs in `.identity`
- Sounds like a production parameter → belongs in `.brand`
- Appears across 3+ purpose files → belongs upstream
- Is genuinely slot-level and content-type-specific → belongs here

```yaml
context
  primary is the bread name, 1-3 words.
  secondary is the weight ("750 g") or slice count.
  meta is one sentence: what makes this bread specific.
```

### `voice` Block

Purpose-specific writing rules as key-value pairs (2-space indent). These are operationalized constraints for AI text generation — not voice strategy (that lives in `.identity`), but concrete rules for this content type.

```yaml
voice
  number-format: digit
  headline-pattern: noun-first
  sentence-max: 8
```

Common keys: `number-format` (digit | word), `headline-pattern` (noun-first | verb-first | any), `sentence-max` (max words per sentence). Keys are not fixed — any key-value pair is valid. The AI agent receives them as-is.

### `palette:` Field

Determines which color palette to use for this purpose. The brand defines available themes (in `.brand` theme blocks); the purpose decides which one to use.

| Value | Behaviour |
|-------|-----------|
| `dynamic` | Derive colors from photo analysis (default when omitted) |
| `<ThemeName>` | Always use this named theme (e.g. `palette: Basic`) |
| `rotate <T1>, <T2>, ...` | Cycle through named themes on shuffle |

```yaml
palette: dynamic          # photo-derived colors (default)
palette: Basic            # always use the Basic theme
palette: rotate Basic, Strand   # alternate between two themes
```

When `palette` is absent, behaviour is `dynamic` — colors are derived from the photo when one is present, or randomized when no photo is set.

### Exclusion Rule

A `.purpose` file must NOT contain: color values (only named theme slots), absolute positions, canvas dimensions, or full voice/strategy (only filtered references).

---

## Layer 5: Composition (`.composition`)

**Cardinality:** Multiple. The most reusable layer, with zero brand-specific information.
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
| `illustration:` | string | No | Illustration placement (anchor, fit, scale) |
| `sticky: POSITION [SIZE]` | block | No | Sticky bar (flow mode, repeatable) |
| `flow: [TYPE] [PROPS]` | block | No | Flow region (flow mode) |
| Slot placement lines | - | Yes (grid mode) | Grid slot placements |

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
# editorial.composition - grid mode
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
- `flow:` default fill
- `flow: panel POSITION WIDTH HEIGHT` floating panel (e.g., `panel bottom-left 2/3 1/1`)
- `flow: split EDGE FRACTION` split layout (e.g., `split bottom 1/2`)

**Properties** (indented, no pipe):
- `direction: vertical | horizontal`
- `columns: N` (1-6)
- `column-gap: TOKEN`

**Items** (2-space indent + `|` prefix):
- `| spacer-TOKEN` spacing (TOKEN: `auto`, `xs`, `s`, `m`, `l`, `xl`)
- `| divider-VARIANT` divider (VARIANT: `ruler`, `hairline`)
- `| SLOTID ALIGN [VALIGN]` text slot with alignment
- `| logo ALIGN [SIZE]` logo
- `| icon ALIGN [SIZE]` icon

```yaml
# panel.composition - flow mode
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

- `full` full-bleed background image
- `none` no background image
- Grid region, e.g., `top--center cols 1--2`

### `logo:` / `icon:` Placement

```
logo: POSITION ALIGN [SIZE]
```

- **Position:** `top` \| `center` \| `bottom` or `row N` (1-based)
- **Align:** `left` \| `center` \| `right`
- **Size** (optional, default `m`): `s` \| `m` \| `l`
- **Special:** `logo: none` disables the logo

### `illustration:` Placement

Decorative illustration asset anchored to a canvas edge. Grid mode only. The illustration overflows the canvas intentionally — it is not clipped.

```
illustration: ANCHOR FIT SCALE
```

- **Anchor:** `top-left` \| `top-center` \| `top-right` \| `center-left` \| `center` \| `center-right` \| `bottom-left` \| `bottom-center` \| `bottom-right`
- **Fit:** `fit-width` \| `fit-height` — which canvas dimension the scale is relative to
- **Scale:** percentage, e.g. `90%` (1%–200%)

```yaml
illustration: bottom-center fit-width 90%
```

SVG illustrations are colorized at runtime using the `illustration` theme color slot (single color, all fills replaced). PNG illustrations render as-is.

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
.purpose (scope narrows, context adds)
    ↓
.format + .composition (condition the specific act of expression)
```

The purpose does not filter `.identity` and `.brand` separately. It filters the **composed upstream**, which includes both the strategic reasoning from `.identity` and the operationalized parameters from `.brand`. The parser resolves which layer each key originates from.

### Composition Rules

1. `voice.always` and `voice.never` from `.identity` are **always included** unless explicitly excluded by `scope`.
2. `scope.audience` selects which audience blocks to include from `.identity`.
3. `scope.pillars` restricts the pillar scope.
4. `voice` on the purpose adds or overrides writing rules for this content type.
5. `context` adds text that is not present in any upstream layer.
6. If the same key appears in `context` and an upstream layer, the upstream value takes precedence (the context should not restate upstream).

### Validation

A parser should warn when:
- A `context` block restates content from `.identity` (voice guidance, tone descriptions)
- A `context` block restates content from `.brand` (production parameters)
- The same context text appears in 3+ purpose files (belongs upstream)
- A `slot` references a `typography` style not defined in `.brand`
- A `slot` references a `color` not defined as a theme slot
- An `archetypes` entry references a non-existent `.composition` file
- A `purposes` entry in `.format` references a non-existent `.purpose` file

---

## File Organization

### Your Brand

A brand lives in its own folder, named after the brand. The folder contains the brand's `.identity` and `.brand` files alongside its formats, purposes, and compositions:

```
project/
└── brandname/
    ├── brandname.identity
    ├── brandname.brand
    ├── formats/
    │   └── instagram-4-5-feed-portrait.format
    ├── purposes/
    │   └── daily-bread.purpose
    └── compositions/
        └── editorial.composition
```

Every brand is fully self-contained. Formats, purposes, and compositions are specific to one brand's identity and voice — there are no shared files between brands.

### Examples

Reference brands for learning and inspiration live under `examples/`. They mirror the "your brand" structure but are clearly labeled as reference material — not production, not something to build on directly:

```
project/
└── examples/
    └── krume/
        ├── krume.identity
        ├── krume.brand
        ├── formats/
        ├── purposes/
        └── compositions/
```

The `brand-intent` npm package ships example brands under `examples/`. Run `brand-intent init` to copy them into your own project.

---

*Brand Intent Specification v0.1 / April 2026*
