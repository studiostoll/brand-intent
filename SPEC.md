# Brand Intent / Specification v0.1

This document defines the formal grammar for all Brand Intent file types: the five layers, stories, and the five fact files a story orchestrates: time, place, person, group and work. For the reasoning behind these decisions, see [DESIGN.md](DESIGN.md).

---

## General Syntax

All Brand Intent files share these rules:

- **Line-based.** Each non-blank, non-comment line is a statement.
- **Indentation-based nesting.** Child properties use 2-space indentation. Sub-blocks use 4-space indentation.
- **`#` comments.** Whole-line comments are ignored by the parser. Inline comments (after a value) are allowed.
- **No quotes required** for simple string values. Quotes are only needed when a value contains `#` (which would otherwise start a comment).
- **`$reference` syntax** for cross-referencing named values within the same file (e.g., `$primary` referencing a color named `primary` in `brand-colors`).
- **Presence as boolean.** Some flags (e.g., `italic`, `uppercase`) are set by presence alone (no `: true` needed).
- **Named blocks** use the form `keyword NAME` (e.g., `theme Shop`, `audience regulars`), not `keyword: { NAME: { ... } }`.

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
| `purpose:` | string | No | Brand purpose: why the brand exists, the inner motivation (distinct from `promise:`, `mission:`, `vision:`) |
| `mission:` | string | No | Organizational mission: what the brand does, for whom |
| `vision:` | string | No | Aspirational future state: what the world looks like if the brand succeeds |
| `archetype:` | string | No | Brand archetype shorthand (e.g., `craftsman`, `sage`, `explorer`) |
| `narrative NAME` | block | No | Named brand narrative (repeatable; exactly one should carry `primary` flag) |
| `voice` | block | Yes | Voice and tone definition |
| `values` | block | No | Core brand values with behavior statements (repeatable) |
| `pillars` | block | Yes | Content pillar definitions |
| `audience NAME` | block | Yes (1+) | Audience segment (repeatable) |
| `anti-audience NAME` | block | No | Explicitly not-our-audience (repeatable) |
| `imagery` | block | No | Rules for photos and film |
| `image-theme NAME` | block | No | Named image theme, optionally tied to a narrative (repeatable) |
| `goal NAME` | block | No | Communication goal, e.g. one share of a content mix (repeatable) |
| `review` | block | No | Questions to check before publishing |

### `voice` Block

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `register:` | string | Yes | Formality level (e.g., `informal, Du`) |
| `persona:` | string | Yes | Voice character description |
| `rhythm:` | string | No | Sentence structure guidance |
| `always:` | list | Yes | Concrete rules the brand always follows |
| `never:` | list | Yes | Concrete rules the brand never breaks |
| `instead:` | list | No | Phrases to replace, each as `PHRASE -> REPLACEMENT` |

`always:` and `never:` use YAML-style list syntax:
```
always:
  - Sauerteig, not "artisan bread"
  - konkrete Mehlsorten (Tipo 1, Roggen 1150) over "beste Zutaten"
```

**Design principle:** Every item in `always` and `never` should be a concrete, testable rule, not a description or aspiration. An AI agent should be able to evaluate any piece of content against these rules with a yes/no answer.

`instead:` pairs a phrase the brand avoids with the wording it uses. A pair teaches the rewrite, not just the ban. Quotes around either side are optional and stripped.

```
instead:
  - "the finest ingredients" -> Tipo 1 from the mill in Dachau
  - "baked with love" -> eighteen hours of fermentation
```

### `narrative NAME` Block

Named brand narratives. Each narrative has a lowercase identifier, an optional `primary` flag (exactly one narrative should be marked primary), and free-form multi-line text.

`NAME` is a free-form title — natural language is encouraged (e.g., `In a Special Light`, `Origin Story`, `Flour Water Time`).

| Element | Type | Required | Description |
|---------|------|----------|-------------|
| `NAME` | string | Yes | Narrative title (free-form, after `narrative` keyword) |
| `primary` | flag | No | Marks this as the brand's dominant narrative (exactly one) |
| *(text lines)* | string | Yes | Free-form narrative content (indented, multi-line) |

The `primary` narrative is the brand's default story — the one AI agents use when no specific narrative is requested. Supporting narratives serve specific contexts (editorial, campaigns, internal culture).

```yaml
narrative Flour Water Time
  primary
  Founded in 2019, when the baker quit her agency job
  to do what she had done every morning since she was
  sixteen: bake bread.

narrative Eighteen Hours
  The bread takes eighteen hours. No step is cut short,
  no flour is swapped.
```

### `values` Block

Repeatable named entries. Each value has a name and a behavior statement that makes it actionable, not just a keyword.

```yaml
values
  Craft
    We name the process, not the result.
    Fermentation in hours, the flour by name.

  Honesty
    No bread without an ingredient list. No promises
    the dough can't keep.
```

Each value is a named block (the value name on its own line, unindented within `values`), followed by 2-space indented behavior description lines.

A value can carry examples: `say:` for a line that carries the value, `not:` for one that misses it. Both are repeatable and go after the behavior lines.

```yaml
values
  Craft
    We name the process, not the result.
    say: The rye has been proofing since last night.
    not: Handmade with love.
```

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

### `imagery` Block

What photos and film always show and never show. The image counterpart of `voice`: the same yes/no principle applies, so an AI agent can review a photo or write an image brief against it.

```yaml
imagery
  always:
    - real steps of the work in the bakehouse, nothing staged
    - flour, dough and tools with signs of use
  never:
    - posed smiles into the camera
    - AI-generated or AI-altered images
```

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `always:` | list | No | What every photo and film shows |
| `never:` | list | No | What the imagery never shows |

How photos are framed and treated belongs to the `.brand` file ([`framing`](#framing-name-block), [`photo-look`](#photo-look-block)).

### `image-theme NAME` Block

A named subject for photos and film. `NAME` is free-form. An optional `narrative:` line ties the theme to a narrative by its exact name; the rest is free-form text. Image themes do not have to cover every narrative, and a theme can stand without one.

```yaml
image-theme Dough in the Morning
  narrative: Eighteen Hours
  Hands in dough, flour on the bench,
  the first light through the bakehouse window.
```

### `goal NAME` Block

What a piece of content is for, as opposed to what it is (its [purpose](#layer-4-purpose-purpose)). The same purpose can serve different goals: a quote can show the craft or introduce a neighbour. `NAME` is a lowercase identifier. Goals are listed in declaration order.

```yaml
goal craft
  label:      Show the craft
  share:      60%
  question:   How is the bread made?
  narratives: Eighteen Hours
  always:
    - show one concrete step of the work

goal neighbours
  label:      Neighbourhood
  share:      40%
  question:   Who comes here, and why?
  narratives: Flour Water Time
  always:
    - a person with their name and their reason to come
```

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `label:` | string | Yes | Human-readable goal name |
| `share:` | percentage | No | Target share of produced content. Shares add up to 100% at most. Where the share applies (channel, period) goes in a comment |
| `question:` | string | No | The question content for this goal answers |
| `narratives:` | list | No | Narrative names this goal draws on (comma-separated, exact names) |
| `always:` | list | No | Rules content for this goal follows |
| `never:` | list | No | Rules content for this goal never breaks |

A purpose names its default goal with `goal:`; implementations let the person change it per page. Framings name the goals they serve in the `.brand` file.

### `review` Block

Questions to check before publishing, as a short editorial check. Each one should be answerable with yes or no.

```yaml
review
  copy:
    - Is the occasion clear to a customer at a glance?
    - Does the text name the bread, the flour or the fermentation time?
  image:
    - Does the picture show a real step of the work?
```

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `copy:` | list | No | Questions for texts |
| `image:` | list | No | Questions for photos and film |

### Exclusion Rule

An `.identity` file must NOT contain: hex values, font names, type sizes, spacing values, composition rules, canvas dimensions, or platform specifications.

### Example

```yaml
# krume.identity

essence:  Bread is craft, not lifestyle. Flour, water, time.
promise:  Walk in and you smell at once that someone has been
          standing here since four in the morning.

voice
  register:  informal, first names
  persona:   The baker behind the counter: direct, dry, proud of the craft
  rhythm:    short sentences, concrete facts, no explaining

  always:
    - sourdough, not "artisan bread"
    - named flours (Tipo 1, rye 1150) over "the finest ingredients"
    - fermentation in hours, not "slow-fermented"
    - the Kiez by name (Neukölln, Weserstraße) over "our location"

  never:
    - lifestyle language (curated, hand-picked, moment of indulgence)
    - "artisan" or "artisanal": we say craft
    - food-blog words where a baker's word exists (crumb structure, flavour profile)

narrative Flour Water Time
  primary
  Founded in 2019, when the baker quit her agency job
  to do what she had done every morning since she was
  sixteen: bake bread.

narrative Eighteen Hours
  The bread takes eighteen hours. No step is cut short,
  no flour is swapped.

pillars
  primary:   sourdough, craft, ingredients, Kiez
  secondary: seasonal, sustainability, baking know-how
  avoid:     lifestyle gastronomy, wellness eating, influencer culture

audience regulars
  label:       Regulars from the Kiez
  profile:     25-65, daily or weekly, know the breads
  motivation:  their bread, their shop, a reliable rhythm
  language:    brief, direct, no explaining: they know

audience newcomers
  label:       The curious and passers-by
  profile:     tourists, new neighbours, market visitors
  motivation:  find good bread, understand what is different
  language:    inviting, concrete, explains without lecturing
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
| `brand-colors` | block | Yes | Color primitive definitions (flat or grouped) |
| `state-colors` | block | No | Per-brand fixed state colors (problem/warning/success/info/inactive) |
| `color-bounds` | block | No | Luminance + saturation bounds for guided derivation |
| `color-mode:` | enum | No | `static` \| `dynamic` \| `guided` \| `brand` — color resolution mode |
| `color-strategy:` | enum | No | `monochrome` \| `duotone` \| `tricolor` \| `spectrum` — default palette strategy for guided shuffle |
| `color-adherence:` | enum + block | No | `strict` \| `on-brand` \| `flexible` — guided derivation tightness, with optional tolerance overrides |
| `color-rules` | block | No | Contrast minimums and tone combinations to avoid |
| `color-families` | block | No | Ordered color sets with roles, borrowing rules and curated pairs |
| `theme NAME` | block | Yes (1+) | Semantic theme (repeatable) |
| `font NAME` | block | Yes (1+) | Font definition (repeatable) |
| `typography NAME` | block | Yes (1+) | Named typography style (repeatable) |
| `spacing:` | block | No | Spacing token scale |
| `divider NAME` | block | No | Named divider style (repeatable) |
| `label:` | block | No | Label badge style (padding + radius) |
| `cta:` | block | No | CTA pill style (padding + radius) |
| `icons` | block | No | Brand icon set (font glyphs, SVGs, adopted Phosphor icons) |
| `counter` | block | No | List counter component |
| `camera` | block | No | Camera defaults: facing and viewfinder grid |
| `photo-look` | block | No | Photo treatment for user photos: saturation, contrast, warmth, fade, mono, duotone; scrim under light text |
| `location` | block | No | The area the brand is in: name and coordinates, for sky and weather story variables. Sites such as shops are [`.place`](#place-place) files; the brand's seasons, windows, week and day are its [`.time`](#time-time) file |
| `framing NAME` | block | No | Photo framing module: horizon position for camera guides (repeatable) |
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

#### Grouped Syntax (v0.8.0+)

As of v0.8.0, `brand-colors` also accepts a **grouped** shape that expresses color relationships, roles, meanings, and distributions. The parser auto-detects the shape from the first non-blank indented line: a bare group keyword (`primary`, `secondary`, `accent`, `neutral`) triggers grouped mode; otherwise the block stays flat. The two shapes are mutually exclusive within a single block.

The grouped shape unlocks **guided color mode** (`color-mode: guided`), which requires at minimum: the `primary` group with ≥1 color, and the `neutral` group with both `role: light` and `role: dark` entries.

```
brand-colors

  primary
    meaning: identity, recognition, authority
    distribution: 60%

    #2C1810  Espresso
      meaning: the core mark, anchoring
    #5C3A28  Walnut
      role: warmth
      meaning: softer companion, supporting weight

  secondary
    meaning: warmth, craft, natural quality
    distribution: 30%

    #C8A47E  Wheat

  accent
    meaning: distinction, sparingly used surprise
    distribution: 10%

    #D4A574  Honey

  neutral
    meaning: structure, readability, quiet presence

    #FAF6F0  Flour
      role: light
      meaning: base canvas
    $primary.default
      role: dark
      meaning: text, headings, structural weight
```

**Group rules:**

- Groups are declared in this order: `primary`, `secondary`, `accent`, `neutral`. Declaration order is load-bearing for references — a group can only reference colors in earlier groups.
- `meaning:` is authored prose — engine ignores it.
- `distribution:` is a selection-probability weight (0–100), valid only on identity groups (`primary`, `secondary`, `accent`). Declaring `distribution:` on `neutral` is a hard error.

**Entry rules:**

- Each entry header is either `#HEX  Display Name` (two spaces between hex and name) or a `$group.role` reference line.
- Sub-properties (4-space indent): `role:`, `meaning:`, and the existing print specs `pantone:`, `hks:`, `cmyk:`.
- In identity groups, `role:` is authored freely (`depth`, `warmth`, `signal`, …). The single reserved role is `default` — it marks the group representative. If no entry has `role: default`, the first-declared entry is the default implicitly.
- In the `neutral` group, `role:` is a fixed vocabulary: `light | subtle | mid | muted | dark`. Endpoints `light` and `dark` are required. Other values raise a parser error.

**Layer 2 references:**

- The header line `$group.role` replaces `#HEX  Name`. The target color contributes its hex + display name; the reference entry authors its own `role:` and `meaning:` locally.
- References may only point to groups declared earlier. Forward and self-references are hard errors.
- Neutrals may reference identity groups; identity groups may not reference neutrals.

**Flat projection:** grouped-syntax brands continue to expose `brandColors` (flat map) so legacy consumers work unchanged. The key is the entry's display name lowercased with whitespace replaced by hyphens.

### `state-colors` Block

Per-brand fixed colors for interface states. All values are solid hex. Optional — if omitted, consumers use sensible defaults.

```
state-colors
  problem:   #C62828
  warning:   #E65100
  success:   #2E7D32
  info:      #1565C0
  inactive:  #757575
```

State colors are perceptual anchors (red = problem, green = success). Always strict — never shifted in hue by guided derivation regardless of adherence level.

### `color-bounds` Block

Constraints for all guided derivation — brand color scales, state color variants, neutral interpolation. All fields are optional; sensible defaults apply when omitted.

```
color-bounds
  light: 0.95
  dark: 0.04
  saturation-floor: 15
```

- `light` — maximum luminance for derived tints (0–1).
- `dark` — minimum luminance for derived shades (0–1).
- `saturation-floor` — minimum saturation (0–100) for derived colors, preventing washed-out grays in warm brands.

### `color-mode:`, `color-strategy:`, `color-adherence:`

Top-level keys that configure the color resolution engine.

```
color-mode: guided
color-strategy: duotone

color-adherence: on-brand
  hue-tolerance: 4
  sat-tolerance: 8
```

- `color-mode:` — `static` (themes only, today's default), `dynamic` (random moods + photo derivation, today's behavior), `guided` (algorithmic within brand constraints), or `brand` (new pages start from a declared theme; with `color-families`, a curated pair of the active family; shuffle stays among those themes).
- `color-strategy:` — the default palette strategy for Path A (guided shuffle). Values: `monochrome`, `duotone`, `tricolor`, `spectrum`. Optional; derived from distribution when absent.
- `color-adherence:` — how tightly guided derivation follows brand groups. Values: `strict`, `on-brand`, `flexible`. Accepts an indented override block with `hue-tolerance:` (degrees) and `sat-tolerance:` (percentage points) to dial the level without switching it.

`color-mode: guided` requires either grouped `brand-colors` syntax with the minimum structure above, or a `color-families` block with at least two families. Otherwise it raises a parse error. When families exist, guided generation draws from them and the grouped groups/distribution are not used for generation.

`color-mode: brand` requires at least one theme (an authored `theme` block or a valid family pair) or a `levels` block. Otherwise it raises a parse error. If the brand also meets the guided minimum structure, guided generation stays available as an explicit choice; `brand` only sets the default.

### `color-rules` Block

Brand-wide contrast and tone rules. All fields optional; when the block is absent, nothing is checked (existing brands are unaffected).

```
color-rules
  text:   4.5            # min contrast for text on ground
  figure: 3              # min contrast between ground and figure (logo, signet, large shapes)
  avoid:  light+light, mid+mid
  tones:  1.8, 4.5       # tone thresholds, contrast vs white
```

- `text:` / `figure:` — WCAG contrast ratios (1–21). Defaults `4.5` / `3`.
- `tones:` — every color gets a tone class from its contrast against white: below the first value `light`, at or above the second `dark`, otherwise `mid`. Default `1.8, 4.5`.
- `avoid:` — comma-separated tone combinations (`light | mid | dark` joined by `+`, unordered) a ground/figure pair must not form.

Where rules apply:

- **Every theme**: `text-primary` vs `background` and `logo` vs `background` are checked. Violations are **warnings**, not errors.
- **Family pairs** (below): a pair failing a rule is rejected with a warning.
- **Guided generation**: rules are a hard filter on generated pairs.

### `tones` Block

Declared tone ladders: each listed color on the same steps, from dark to light. Brands with a tone system of their own (e.g. one step per CIELAB L*) write it here instead of letting tools compute shades. The block is declared, never generated: the brand's colour system is the source.

```
tones   # imported, don't edit by hand
  steps: 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 98
  $logo-blue: #0B1A30 #1C3558 #2B4C7E #4A6896 #6984AE #88A0C4 #A7BBD8 #C5D3E8 #E2EAF4 #F0F4FA #F9FBFD
  $green:     #14231A #22382A #334D3C #40604B #5E7D68 #7A9884 #96B3A0 #B2CEBC #CFE8D8 #E2F2E8 #F1FAF4
```

- `steps:` — ascending whole numbers, required. Every line has one hex per step, in that order.
- One line per color: `$name:` names a color in `brand-colors` or a named family color. The color's own hex must appear on its line (its anchor step); a line without it is a hard error.
- Not every color needs a line (white usually has none).
- Reference a tone as `$name.step`, e.g. `$logo-blue.10`, wherever a `$ref` is accepted: theme slots (with alpha: `$logo-blue.10 70%`), family roles and pairs, `shared:`, `photo-fallback:`, `photo-look duotone`.
- Inline comments in this block need a space after `#` (`# note`), since hex values start with `#`.

**Import:** `npx tsx scripts/import-tones.ts <export.json> <file.brand>` writes the block from a Figma colour export (ladders per mode, the anchor step aliased to a primitive). It matches ladders to `brand-colors` entries by the anchor hex, so names stay in the `.brand` file, and replaces the block in place.

### `color-families` Block

Ordered sets of colors that belong together — seasons, times of day, sections, editions. Each family may borrow colors from its neighbours, within a configurable reach.

```
color-families
  order:    cycle            # cycle | sequence
  borrow:   both             # previous | next | both | none
  distance: 1                # how many steps borrowing reaches
  shared:   $logo-blue, $white
  photo-fallback: $logo-blue, $white, $blue-mid, $blue-dark

  family Winter
    season:   winter         # optional: the .time season this family is for
    core:     #2F6FD6  Sky
    accent:   #4E6458  Sage
    accent:   #C4D0D8
    contrast: #2C3520  Olive
    pairs
      #2F6FD6 / #F4F7B0
      #2C3520 / $pale-blue

  family Spring
    season:   spring
    …
```

**Block keys** (before the first `family`):

| Key | Default | Values |
|-----|---------|--------|
| `order:` | `cycle` | `cycle` (last family neighbours the first) \| `sequence` (no wrap-around) |
| `borrow:` | `both` | `previous` \| `next` \| `both` \| `none` |
| `distance:` | `1` | whole number ≥ 1 — steps borrowing may reach |
| `shared:` | — | comma-separated `$refs` to `brand-colors`, allowed in every family |
| `photo-fallback:` | — | comma-separated `$refs` to `brand-colors`, in order of preference: text and figure colors for a photo that no color of the pair reads on. Used only over photos, never in pairs or guided generation, so shades that would be off-brand as grounds (e.g. a very dark blue) can serve here |

**Families:**

- `family NAME` — declaration order is the family order. Names are unique.
- Roles are a fixed vocabulary: `core` (exactly one), `accent` (zero or more), `contrast` (at most one — the text carrier).
- Values are `#HEX`, optionally followed by a display name, or a `$ref` (`$ref.step`) to a color declared elsewhere. Unnamed colors get `{family}-{role}`, accents numbered (`winter-accent-2`). Use `$ref` when families share a color: declare it once in `brand-colors`, reference it in each family.
- `season: NAME` (optional) — the [`.time`](#time-time) season this family is for. A family is in season when its season is; apps pick it then (`familyIndexForDate`), e.g. as the default family or for a seasonal app icon. Each season is named by at most one family. `checkBrand` reports a season the `.time` doesn't declare.
- Families without `season:` next to seasonal ones are **hand-picked contexts** (e.g. a plain context with only the logo color): never in season, off the borrow cycle (they don't borrow and aren't borrowed from). Apps offer them by hand, per page or purpose.
- `signal: VALUE / VALUE` and `level NAME` overrides: see `levels` below.
- All inline family colors join the flat `brandColors` projection (name lowercased, spaces → hyphens), so themes can reference them. A name colliding with an existing brand color is a hard error. `$ref` colors are already there and don't join again.

**Reach:** a family may use its own colors, the `shared` colors, and colors of families up to `distance` steps away in the `borrow` direction(s). A tone (`$name.step`) counts as its color: a tone of a family color is that family's own, a tone of a `shared` color is shared, a neighbour's tone follows the same reach. A reach that covers every family (e.g. a cycle of four with `both` and `distance: 2`) raises a warning — the borrow rule has no effect then.

**Pairs:** optional `pairs` sub-block, one `ground / figure` per line (`#HEX` or `$ref`). Each pair is checked against reach and `color-rules`:

- Valid pairs become pair themes named `{Family}-{n}`, where `n` is the pair's declared position (stable when the reach config changes).
- Invalid pairs are skipped with a warning naming the reason (e.g. `#F9FF9D from Spring is out of reach`). Warnings, not errors, so changing `borrow:` to test a variant never breaks the brand.
- Text color: the family's `contrast` color if it reaches `color-rules.text` on the ground, else the `shared` colors in order, else the neutral `dark` / `light` entries. If none passes, the highest-contrast candidate is used with a warning.

### `levels` Block

Levels say *how much colour* a page carries, independent of *which family*. Every level fills the same 13 slots; a page is family × level. The block declares defaults per level; families override where they differ.

```
levels
  level Neutral
    ground:              $white
    on-ground/headline:  $logo-blue
    …
  level Strong
    ground:              required      # every family sets its own
    on-ground/headline:  a2.95
    on-ground/text:      $white
    on-contrast:         strong.ground # another cell
    …

color-families
  family Dusk
    season: autumn
    core:   $ink
    accent: $moss
    accent: $mist
    signal: a1.40 / $white             # signal / on-signal, same in every level
    level Strong
      ground: a2.20
```

**Slots** (fixed): `ground` · `on-ground/headline`, `on-ground/text`, `on-ground/accent`, `on-ground/line`, `on-ground/divider` · `contrast` · `on-contrast` · `inset` · `on-inset/text`, `on-inset/accent` · `signal` · `on-signal`. Unknown slots are errors. The vocabulary is medium-neutral: apps map their own parts (buttons, stickers, panels) onto slots.

**Levels:** `level NAME`, declared from weakest to strongest (e.g. `Neutral`, `Light`, `Medium`, `Strong`). Names are unique; `p`, `a1`, `a2` are reserved.

**Values:**

| Form | Example | Meaning |
|------|---------|---------|
| `p`, `a1`, `a2` | `a1` | the family's core, first accent, second accent (a missing accent falls back to the core) |
| `p.step`, `a1.step`, `a2.step` | `a2.95` | that tone of the family color (`tones` block) |
| `$ref`, `$ref.step` | `$white`, `$logo-blue.10` | a brand color or its tone |
| `#HEX` | `#FFFFFF` | a literal color |
| `level.slot` | `strong.ground` | another cell of the same family (level name in any case) |
| `required` | | defaults only: every family must set this slot |

No alpha. Cell references resolve within the family; cycles are errors.

**Resolution:** for each family × level × slot, the family's `level` override wins, then the family's `signal:` (for `signal` / `on-signal`), then the level default. A slot without a value, or `required` without an override, is a hard error. Overrides for an undeclared level are errors. `signal:` and family `level` blocks need a `levels` block.

**Rules:** with a `color-rules` block, every cell is checked and violations are **warnings** naming the cell (`Dusk / Light / on-ground/accent on ground 2.1:1 < 3`): `on-ground/headline`, `on-ground/text`, `on-contrast`, `on-inset/text`, `on-signal` against `text:`; `on-ground/accent`, `on-ground/line`, `on-inset/accent` against `figure:`. Dividers are decorative and unchecked.

**Output:** `levels.names` (declaration order) and `levels.cells[family][level][slot]` (6-digit hex). `color-mode: brand` is satisfied by levels; curated `pairs` become optional.

### `theme NAME` Block

Maps semantic slot names to colors. Values are `$references` to `brand-colors` names, raw hex, or either of those with an optional alpha suffix.

**Value grammar:**

| Form | Example | Renders as |
|------|---------|-----------|
| `$ref` | `$white` | resolved hex of the brand color |
| `$ref.step` | `$blue.95` | that step of the color's `tones` ladder |
| `#HEX` | `#FFFFFF` | pass-through hex |
| `$ref NN%` | `$white 75%` | `rgba(...)` with alpha |
| `#HEX NN%` | `#FFFFFF 30%` | `rgba(...)` with alpha |

**Alpha rules:**

- Separator between base and alpha is exactly one space. `$white/75%`, `$white@75%`, `$white75%` are parser errors.
- Alpha is `0`–`100`, integer or decimal (`12.5%` is valid).
- `100%` emits solid hex, not `rgba()`, to keep output clean.
- Raw `rgba(...)` literals are tolerated for backwards compatibility but discouraged — they bypass the `$ref` chain.

**Pair themes:** instead of writing every slot, a theme may declare a ground/figure pair. Missing slots are derived; explicitly written slots override the derived value.

```
theme Green
  ground: $green
  figure: $white
  text:   $white          # optional
```

| Slot | Derived value |
|------|---------------|
| `background` | ground |
| `text-primary`, `headline` | text |
| `text-secondary` / `text-tertiary` / `text-subtle` / `text-muted` | text at 85% / 70% / 55% / 40% |
| `logo`, `cta`, `divider`, `icon`, `illustration`, `sticker-bg`, `label-bg`, `counter-bg` | figure |
| `sticker-fg`, `label-fg`, `counter-fg` | ground |

- `ground:` and `figure:` come together — one without the other is a hard error. Values must be solid (`$ref` or `#HEX`, no alpha).
- Without `text:`, text resolves to the neutral `dark` or `light` entry (whichever reaches `color-rules.text`, default 4.5), else black or white.

**Valid theme slots:**

| Slot | Description |
|------|-------------|
| `background` | Canvas background |
| `text-primary` | Primary text color |
| `headline` | Headline color. Default: `text-primary` |
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
| `counter-bg` | List counter background. Default: `label-bg` |
| `counter-fg` | List counter digits. Default: `label-fg` |
| `icon` | Icon color |
| `divider` | Divider color |
| `illustration` | Illustration line color (optional, only for brands with illustrations) |

```yaml
theme Shop
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

### `icons` Block

The brand's icon set: one entry per icon, a semantic id plus a source. Pickers show only these icons. Without an `icons` block the brand has no set: icons come only from `defaultIcon:` references in `.purpose` files.

```yaml
icons
  quote: font $display U+201C     # glyph by codepoint
  pin:   font $display icon.pin   # glyph by name (unencoded glyphs are fine)
  map:   icons/map.svg            # SVG, relative to the brand folder
  wave:  phosphor wave light      # Phosphor icon adopted into the set
```

| Source | Description |
|--------|-------------|
| `font [$FONT] U+XXXX` | Glyph by codepoint (4–6 hex digits). `$FONT` names a `font` block; omitted → the first font |
| `font [$FONT] GLYPHNAME` | Glyph by its name in the font file |
| `PATH.svg` | SVG file, relative to the brand folder |
| `phosphor NAME [WEIGHT]` | [Phosphor](https://phosphoricons.com) icon, kebab-case name, optional weight (`thin` \| `light` \| `regular` \| `bold` \| `fill` \| `duotone`) |

- Ids are lowercase kebab-case and unique. Order is picker order.
- Sources can be mixed, so a set can start with Phosphor picks and swap entries for brand glyphs without touching purposes or pages.
- Brand icons have one cut; weights apply to Phosphor sources only.
- Font glyphs are fitted to their own bounds. Implementations render them as vector paths, not text, so glyph metrics don't affect the icon box.
- Colour comes from the theme's `icon` slot.

### `counter` Block

The list counter component: numbered markers for list slots with `marker: counter`. Optional; defaults apply when omitted.

```yaml
counter
  format:     01         # 1 | 01 | 1. | (1) | i
  typography: counter    # a typography style
  shape:      circle     # none | circle | square | pill
  size:       1.2em
  padding:    0.2em
```

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `format:` | enum | `1` | `1` \| `01` (zero-padded) \| `1.` \| `(1)` \| `i` (lowercase roman) |
| `typography:` | string | item typography | Typography style for the digits |
| `shape:` | enum | `circle` | `none` \| `circle` \| `square` \| `pill` |
| `size:` | em | `1` | Counter height relative to the list item text |
| `padding:` | em | `0.2` | Inner padding |

Colours come from the theme slots `counter-bg` (shape) and `counter-fg` (digits).

### `camera` Block

Camera defaults. Optional; without it the rear camera opens and the viewfinder has no grid.

```yaml
camera
  facing: rear     # rear | front
  grid:   3        # N (N × N) or ROWS COLS, 2–12
```

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `facing:` | enum | `rear` | Which camera opens first. Purposes override it with `camera: front \| rear` |
| `grid:` | int or int pair | — | Viewfinder grid as cells: `3` = thirds, `4 3` = 4 rows × 3 columns. Drawn inside the framing crop when one is active |

### `framing NAME` Block

Photo framing modules: where the horizon sits in the final crop. Implementations offer them as camera guides. Optional and repeatable; declaration order is picker order. A brand without `framing` blocks gets no camera guides.

```yaml
framing wide
  label:       Wide
  horizon:     40%
  description: The setting leads. The shop and its street, seen from across the square.

framing close
  label:       Close
  horizon:     none
  description: Hands and the bread lead. No far line in the frame.
```

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `horizon:` | % \| `none` | required | Horizon position as a share of image height, measured from the top. `none` for close-ups without a far line |
| `label:` | string | id | Display name |
| `description:` | string | — | The photographic task, one line |
| `caption:` | string | — | What a text adds to a photo in this framing, one line (e.g. who is learning what, and how to join) |
| `goals:` | list | — | Ids of identity [`goal`](#goal-name-block) blocks this framing serves, comma-separated. Implementations suggest the framing for content with that goal |

A purpose can name its module with `framing:` (see [Purpose](#layer-4-purpose-purpose)); the camera then opens on it.

The horizon is measured in the final crop, not the camera frame. Implementations show the target format's crop in the viewfinder and place the line relative to it.

### `photo-look` Block

How user photos are treated. Optional; without it photos stay as taken. Keys follow the adjustment sliders of common phone photo editors, so a guideline ("Sättigung −15") and the DSL read the same.

```yaml
photo-look
  saturation: -15          # -100..100
  contrast:   10           # -100..100
  warmth:     5            # -100 (cool) .. 100 (warm)
  fade:       20           # 0..100, lifted black point
  # mono                   # grayscale
  # duotone:  $ink $sand   # shadows → highlights
  # fixed:    mono         # keys the person cannot change
  # scrim:    45%          # dark gradient under light text, at most this dark
```

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `saturation:` | int | `0` | Colour intensity, `-100` (grey) to `100` |
| `contrast:` | int | `0` | `-100` (flat) to `100` (hard) |
| `warmth:` | int | `0` | Colour temperature, `-100` (cool, blue) to `100` (warm, amber) |
| `fade:` | int | `0` | Lifted black point for a matte look, `0` to `100` |
| `mono` | flag | — | Grayscale (monochrome) |
| `duotone:` | color pair | — | Maps luminance onto two colors, shadow first. Each is a `$ref` to `brand-colors` or `#HEX`. Excludes `mono` |
| `fixed:` | key list | — | Keys the person cannot change. Each must be set in the block |
| `scrim:` | percent | — | Under light text on a photo a dark gradient may lie, at most this dark (`1%`–`100%` black). Absent → no scrim |

**Starting values, not rules.** Every key not listed in `fixed:` is a default: implementations apply it and let the person adjust it, including back to neutral. Use `fixed:` for treatments that define the brand (a grayscale-only or duotone brand).

**Scope.** Applies to photos people add (camera or library). Brand-declared `photo` assets are not affected.

**Scrim.** Not an adjustment of the photo but a layer between photo and text: transparent where the photo shows freely, darkening towards the edge behind the text. The brand declares only whether and how dark; where the gradient lies is the implementation's job, derived from where the text sits. Implementations draw it only when the text on the photo is light (under dark text it would work against it), and count it when they check whether the text reads. Unlike the other keys it covers every photo under light text, brand-declared `photo` assets included, and it is not a starting value the person adjusts, so it cannot be listed in `fixed:`. A `.purpose` or a `.story` can take it off with `scrim: none`; whether a gradient helps depends on the photo and the context, how dark it gets stays the brand's.

**Non-destructive.** The photo file stays as taken; the values are stored with the page and applied when rendering and exporting. Adjustments apply in the order `saturation`, `warmth`, `contrast`, `fade`, then `mono` or `duotone`.

### `location` Block

The area the brand is in, as a whole: an island, a town, a city. Optional; the sky and weather [story variables](#variables) need it unless the story's [place](#place-place) has coordinates. Single sites with an address or opening hours (a shop, an office) are `.place` files, not this block.

```yaml
location
  name:      Harbour Town
  latitude:  54.32       # decimal degrees, north positive
  longitude: 10.14       # decimal degrees, east positive
```

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `name:` | string | Yes | Place name, as people say it. Implementations may show it, e.g. next to a weather credit |
| `latitude:` | number | Yes | Decimal degrees, `-90` to `90` |
| `longitude:` | number | Yes | Decimal degrees, `-180` to `180` |

One location per brand. A brand whose sites lie in one area keeps that area here and gives each site a `.place` file.

### `logo NAME`, `photo NAME`, `video NAME` Blocks

Brand-declared assets — curated logos, photos, and videos that ship with the brand. Each asset has an id (block header), a display label, and, for logos and videos, a source file path.

**The photo library is the `photos/` folder.** Every image below it is a photo; its id is the file name without extension (`photos/Tasting/notizen.jpg` → `notizen`), so a file name is lowercase kebab-case and unique across all folders. A `photo` block names no file: it adds facts (label, `work:`, `focus:` …) to the file of its id. A file without a block is in the library with its id as label. Folders are the library's structure, named as written, two levels at most: the first is a section (`Tasting`, `Releases`), the second a group within it (`Releases/Nachtfahrt`). Files directly in `photos/` come first, then the sections, newest first by the latest one-off `on:` of the [`.work`](#work-work)s their photos show, the rest in order of first appearance; the groups within a section sort the same way. `photos/index.json` lists the files (paths below `photos/`); `brand-intent photos <brand folder>` writes it, `--check` only compares. Consumers resolve the library with `photoLibrary(blocks, files)`, which rejects a block without a file, a file name that is no id, two files of one name and a third folder level. Before v0.46 a photo named its file with `src:` and its section with `section:`; the parser rejects both.

```yaml
logo primary
  label: Primary Logo
  src: logos/primary.svg
  aspect: 5.25

logo mark-3d
  label: Mark 3D
  src: logos/mark.svg
  gltf: logos/mark.glb
  aspect: 1
  animated

logo wordmark
  label: Wordmark
  src: logos/wordmark-centered.svg
  aspect: 1.82
  align-left
    src: logos/wordmark-left.svg
    aspect: 1.79

logo spiral
  label: Spiral
  src: logos/spiral.svg
  generator: spiral
  generator-params
    turns: 3
    radius: 0.4
    thickness: 0.05
  aspect: 1
  animated

photo hero                 # photos/hero.jpg
  label: Hero Shot

photo old-harbour          # photos/Harbour/old-harbour.jpg
  label: Old Harbour
  focus: 40% 55%

video intro
  label: Intro Clip
  src: videos/intro.mp4
  loop
```

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `label:` | string | No | Display label (defaults to block id) |
| `src:` | string | Yes (logos, videos) | Path to the asset file (relative to brand base). A subfolder below the top folder is the library section, named as written: `videos/Events/clip.mp4` sits in "Events". One subfolder at most. Photos take no `src:`: their file is `photos/…/<id>.<ext>` (see above) |
| `aspect:` | float | No | Aspect ratio (width / height) |
| `scale:` | float | No | Size multiplier when rendered |
| `lottie:` | string | No | Path to Lottie JSON (for animated assets) |
| `animated` | flag | No | Marks asset as animated |
| `loop` | flag | No | Marks video/lottie as looping |
| `when:` | string | No | Photos only. Name of a [`.time`](#time-time) entry the photo fits: a window or a season. Absent: all year |
| `framing:` | string | No | Photos only. Id of the [framing](#framing-name-block) module the photo was taken in |
| `place:` | string | No | Photos only. Where the photo was taken |
| `person:` | string | No | Photos only. Id of the [`.person`](#person-person) shown. The person's `photos:` lists this photo; `checkBrand` reports an unknown id |
| `group:` | string | No | Photos only. Id of the [`.group`](#group-group) shown: the band's van, the estate's cellar. The group's `photos:` lists this photo. A photo that shows a face names the `person:`, whose consent it needs; `checkBrand` reports an unknown id |
| `work:` | string | No | Photos only. Id of the [`.work`](#work-work) shown: the sleeve, the bottle, the loaf. The work's `photos:` lists this photo; `checkBrand` reports an unknown id |
| `taken:` | date | No | Photos only. Date taken, `YYYY-MM-DD` |
| `focus:` | `X% Y%` or `none` | No | Photos only. Position of the main subject, measured from the top left. `none`: the photo has no single subject. Consumers keep it inside the crop |
| `horizon:` | `N%` or `none` | No | Photos only. Height of the horizon line from the top; for a tilted horizon, its mean height. `none`: no horizon visible. Consumers can crop so it meets the [framing](#framing-name-block) horizon |
| `gltf:` | string | No | Path to a glTF/GLB 3D model (logos only). When present, the asset renders as a live 3D object; `src` stays as the 2D fallback for thumbnails and export. |
| `generator:` | string | No | Procedural generator id (logos only). Renders live geometry from code (e.g. `spiral`, `mobius`, `ribbon`); `src` stays as the 2D fallback. |
| `generator-params` | sub-block | No | Indented block of numeric defaults for the named generator, keyed `name: number`. Each consumer defines its own param names. |
| `align-left` / `align-center` / `align-right` | sub-block | No | Logos only. Artwork for that horizontal placement, with its own `src:` and optional `aspect:`. A logo placed at the left uses `align-left`, and so on. Without a matching variant, the base `src` is used. Use this when a mark is set differently per alignment (e.g. a stacked wordmark flush left vs. centred), so the brand picks the artwork, not the person placing it. |

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
| `category:` | enum | Yes | `instagram` \| `facebook` \| `linkedin` \| `print` \| `signage` |
| `post:` | enum | No | `feed` \| `story`: how a page in this format is posted. Absent = the format is not posted |
| `size:` | string | Yes | Dimensions in pixels (e.g., `1080 1350`) or mm (e.g., `210mm 297mm`) |
| `grid:` | string | Yes | Row × column grid (e.g., `5 4`) |
| `danger:` | insets | No | Pixels/mm always cropped by platform (default: `0`) |
| `crop:` | insets or `none` | No | Pixels/mm that may be cropped by UI (default: `none`) |
| `comfort:` | float | No | Safe reading margin (default: `0`) |
| `dpi:` | int | No | Print resolution (default: `300` for print/signage) |
| `bleed:` | float | No | Print bleed margin in mm |
| `purposes:` | list | No | Valid purpose IDs for this format (default: all) |

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
| `illustration:` | string list | No | Illustration ids from the `.brand`, comma-separated. A new page shows one of them. A `.story` page's `illustration:` overrides this list |
| `photo:` | string list | No | Photo ids from the `.brand`, comma-separated. A new page starts with the first one that is [in season](#when-in-season); none in season → no photo. A `.story` page's `photo:` overrides this list |
| `scope` | block | No | Narrows the composed upstream |
| `context` | block | No | Adds purpose-specific AI context |
| `voice` | block | No | Purpose-specific writing rules (key-value pairs) |
| `camera:` | bool \| enum | No | `false` hides Take Photo / Upload. `front` \| `rear` overrides the brand's camera `facing:` for this purpose. Default: `true` |
| `scrim:` | `none` | No | No [scrim](#photo-look-block) under this purpose's text, even when the brand declares one. How dark it gets stays the brand's |
| `framing:` | string | No | Id of a brand `framing` block. Photos for this purpose are shot in that module: implementations open the camera on it and may hide the others. Unknown ids are ignored |
| `goal:` | string | No | Id of an identity [`goal`](#goal-name-block) block this purpose serves by default |
| `person:` | `required` | No | Every page of this purpose speaks about a [person](#person-person): a quote, a portrait, a regular's recommendation. A page without one, or with a person who has neither a quote nor a photo, is not posted; `checkStory` reports it |
| `group:` | `required` | No | Every page of this purpose speaks about a [group](#group-group): the band, the estate. A page without one is not posted; `checkStory` reports it |
| `work:` | `required` | No | Every page of this purpose speaks about a [work](#work-work): the bread of the day, the release. A page without one is not posted; `checkStory` reports it |
| `analyze:` | bool | No | Include in photo/video AI analysis. Default: `true` |
| `defaultIcon:` | icon ref | No | Default icon for the icon slot (see [Icon References](#icon-references)) |
| `slot SLOTID` | block | Yes (1+) | Semantic slot definition (repeatable): the form of a slot |
| `example` | block | Yes (1+)* | One example page (repeatable): the content of all slots together |

\* Not needed when every slot has a fixed `value:`.

### Semantic Slots

The following slot IDs are valid:

| Slot ID | Role |
|---------|------|
| `primary` | Main communicative act (headline, key message) |
| `secondary` | Supporting signal (subline, number, kicker) |
| `detail` | Extended content (body text, list items) |
| `meta` | Contextual information (date, place, caption) |
| `cta` | Call to action |
| `label` | Orientation marker (category badge, tag) |
| `credit` | Attribution the content requires (data source, photo credit) |

These names are fixed. They travel through the entire stack: a composition places `primary` without knowing what it contains; a purpose defines what `primary` means without knowing where it sits.

`credit` is not editorial. It carries what a licence or a source asks to be named: a fixed `value:` (a photographer), or a text the implementation fills (the data source of a value on the page). No example has to fill it, and AI never writes it. It usually gets the brand's smallest style and its own place, apart from `meta`.

### `slot SLOTID` Block

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `label:` | string | Yes | Human-readable slot name |
| `typography:` | string | Yes | Named typography style from `.brand` |
| `color:` | string | No | Theme slot name (e.g., `text-primary`, `cta`) |
| `maxLength:` | int | Yes | Character limit. The hard limit: layouts are built for it |
| `words:` | range | No | Editorial word range, `N` or `MIN..MAX` (e.g. `3..8`). Guidance for writing and review on top of `maxLength` |
| `sentences:` | range | No | Editorial sentence range, `N` or `MIN..MAX` |
| `value:` | string | No | Fixed text, never AI-generated or shuffled. The slot takes no example text |
| `editable` | bool | No | When `false`, slot is locked (no user editing in any mode). Default: `true` |
| `type:` | enum | No | `text` (default) or `list` |
| `override:` | block | No | Typography property overrides (4-space indent) |

A slot block describes form only: limits, typography, colour. Its content comes from the purpose's [`example`](#example-block) blocks.

#### `type: list` Sub-Block (4-space indent)

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `maxItems:` | int | - | Maximum items |
| `maxLength:` | int | - | Max characters per item |
| `marker:` | enum | `none` | `none` \| `counter` \| `icon` (item marker) |
| `defaultIcon:` | icon ref | - | Icon for items without an `[ID]` prefix (`marker: icon` only) |
| `iconOnly:` | bool | `false` | Icons only, no text (implies `marker: icon`) |
| `iconGap:` | float | `0.4` | Gap between marker and text (em) |
| `direction:` | enum | `vertical` | `vertical` \| `horizontal` |
| `itemGap:` | float | `0.5` | Gap between items (em) |
| `columns:` | int | `1` | Grid columns (1–6) for a vertical list, filled row by row; `itemGap` is the gap between rows and columns |
| `labels:` | enum | `none` | `none` \| `above`: each item is `Label: value`, the label set small above the value |
| `labelSize:` | float | `0.7` | Label size relative to the item text (`labels: above` only) |
| `divider:` | enum | `none` | `none` \| `hairline`: a line between grid columns (`columns:` 2 or more) |

**Markers:** `counter` numbers the items with the brand's [`counter`](#counter-block) component. `icon` puts an icon from the brand set before each item; an item in an example can name its icon with an `[ID]` prefix, otherwise `defaultIcon:` applies.

```yaml
slot detail
  label: Stops
  typography: body
  type: list
    maxItems: 3
    marker: icon
    defaultIcon: pin

example
  detail:
    [shop] Shop at the market
    Bakery at the station
    Weekly market, Saturday
```

**Fact grids:** `columns:` and `labels: above` together set short facts as a grid, e.g. the facts of the day along the bottom of a photo. With `labels: above` an item splits at its first colon followed by a space: `Wind: 4 Bft` shows "Wind" small above "4 Bft". A time like `07:21` has no space after its colon, so it stays in the value. In a grid every item must have a label. In one column only the first one must: an item without a label continues the item above it, as a further line of its value with no item gap between, so a value can run over several lines (an address and the week's opening hours, below). Inline markup works in both parts (`Wind: **4 Bft**`).

```yaml
slot detail
  label: Facts
  typography: body
  type: list
    maxItems: 4
    columns: 2
    labels: above
    divider: hairline

example
  detail:
    Today: **Saturday**
    Open: **8 to 14**
    Fresh: **Rye loaf**
    Sunset: **16:54**
```

```yaml
slot detail
  label: Visit
  typography: body
  type: list
    maxItems: 6
    labels: above

example
  detail:
    Address: Quay 3, Harbour Town
    Hours: Mon–Fri 8 AM–6 PM
    Sat 9 AM–2 PM
```

On a `.story` page the same slot can take the place's facts: `Hours: {week-hours}` gives one item per line of the week, and the lines after the first continue the `Hours` item.

`[ID]` prefixes and `defaultIcon:` require `marker: icon`. `columns:` needs a vertical list. Implementations warn when an `iconOnly` list has fewer brand icons than `maxItems`. `icons: true` is deprecated and reads as `marker: counter`.

#### `override:` Sub-Block (4-space indent)

Any typography property can be overridden: `weight`, `size`, `opsz`, `lineHeight`, `letterSpacing`, `italic`, `uppercase`, `autofit-min`, `autofit-max`, `autofit: none`, `textAlign`, `hyphenate`.

`hyphenate` sets how a slot may hyphenate (German syllables):

| Value | Meaning |
|-------|---------|
| `true` (or bare `hyphenate`) | Hyphenate freely: lines may end at any syllable. For body text, to even out the rag or justification. |
| `fit` | Last resort for autofit slots: shrink until the longest word fits, and hyphenate a word only if it still doesn't fit at `autofit-min`. For headlines. |
| `false` (default) | Never hyphenate. Implementations never break inside a word; an autofit slot shrinks below `autofit-min` if a word doesn't fit otherwise. |

### `example` Block

One example page: the texts of all slots, written together about one topic. A page always has one purpose, one goal and one topic, so its texts belong together. Implementations fill a new page from one example and swap whole examples, never single slot texts from different examples.

```yaml
example
  topic: The rye loaf that is back on Saturdays
  goal: regulars
  label: Fresh today
  primary: Rye loaf
  secondary: 750 g · €5.80
  detail:
    Rye 1150
    18 hours of fermentation

example
  topic: Christmas stollen, baked from late November
  when: christmas
  label: Advent only
  primary: Butter stollen
  secondary: 1 kg · €24
  detail:
    Butter from the region
    Matured for three weeks
```

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `topic:` | string | No | What the page is about, one sentence. Becomes the page topic, which people can change and which guides AI writing and review |
| `goal:` | string | No | Id of an identity [`goal`](#goal-name-block) block. Overrides the purpose `goal:` for this page |
| `when:` | string | No | Name of a [`.time`](#time-time) entry: a window or a season. The example is only picked [in season](#when-in-season) |
| `work:` | string | No | Id of a [`.work`](#work-work) the example is about. The example is only picked while the work is [in season](#in-season), and the page gets the work's variables |
| `SLOTID:` | string | Yes (1+) | Text for a declared slot. A bare `SLOTID:` takes the following 4-space lines: list items, or line breaks in a text slot |

**Rules:**
- Slot keys must be slots the purpose declares. A slot with `value:` takes no example text.
- An example may leave a slot out (the slot stays empty on that page), but every slot without `value:` must be filled by at least one example.
- `maxLength`, `words:` and `sentences:` apply to example texts as they apply to any text in the slot.
- An example text may contain [variables](#variables). They fill from the brand's only place, the `.time` and the example's `work:`; an example names no person and no group, so their variables have nothing to fill from. `checkFiles` reports a variable that cannot be filled.
- AI writing produces whole pages in this shape, never independent variants per slot.

**Deprecated: slot `samples:`.** Files written before `example` blocks list texts per slot (`samples: A | B` or multi-line `- ` entries, with a trailing ` @name` window marker). Parsers still read them, pair the samples by position into examples (`@name` becomes `when:`) and warn. Implementations should show the warning to the people editing the brand. A purpose with `example` blocks must not also have slot `samples:`.

### Icon References

`defaultIcon:` values and `[ID]` list prefixes reference icons:

| Form | Resolves to |
|------|-------------|
| `quote` | The brand set's `quote`; if the set has none, the Phosphor icon `quote` |
| `phosphor:quotes [WEIGHT]` | The Phosphor icon `quotes`, skipping the brand set |
| `map-pin bold` | Weight applies when the reference resolves to Phosphor |

Ids are kebab-case. Implementations warn when a reference resolves nowhere.

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
| `family <Name>` | Use a color family: its curated pairs, or pairs generated within its reach when the brand is guided |

```yaml
palette: dynamic          # photo-derived colors (default)
palette: Basic            # always use the Basic theme
palette: rotate Basic, Warm   # alternate between two themes
palette: family Winter    # pairs of the Winter color family
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

- **SLOTID:** `primary`, `secondary`, `detail`, `meta`, `cta`, `label`, `credit`
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
- `flow: panel POSITION WIDTH HEIGHT [inset]` floating panel (e.g., `panel bottom-left 2/3 1/1`). Without `inset` the panel sits on the canvas edges. With `inset` the box keeps its size, its outer edges sit on the safe-area lines (aligned with a logo in the same corner), and the padding inside is equal on all sides.
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
- `| photo ALIGN [SIZE]` the page photo inside the flow, uncropped (ALIGN default `center`, SIZE default `m`). Its width is a share of the flow width (`s` 1/3, `m` 1/2, `l` 2/3), its height follows the photo's aspect; an app may shrink it when the flow runs out of room. The flow photo is the page's image: there is no background photo, so `image:` must not be written, and only a plain `flow:` (no panel or split) takes one. One per flow. Suits cut-outs (packshots) on the ground colour.

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

## Story (`.story`)

**Cardinality:** Multiple per brand.
**File extension:** `.story`
**Filename convention:** descriptive kebab-case (e.g., `breads-of-the-week.story`)

A story is an ordered set of pages, posted or shared together: a carousel, a sequence of 9:16 stories, a short article. It is not a sixth layer of the context stack: each page is still a purpose placed by a composition, and the story only says which pages come in which order, which texts are fixed, and what the whole story is about.

### Top-Level Keys

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `id:` | string | Yes | Unique story identifier |
| `name:` | string | No | Display name (derived from id if omitted) |
| `format:` | string | Yes | Format id every page renders at |
| `topic:` | string | No | Story topic: what the whole story is about, one sentence. People can change it per story; it guides AI writing and review on every page |
| `scrim:` | `none` | No | No [scrim](#photo-look-block) on any page of the story, whatever the brand and the pages' purposes declare |
| `place:` | string | No | [Place](#place-place) id the story speaks for. When omitted and the brand has exactly one place, the story speaks for that one; with several places, it speaks for the brand in general (sky and weather use the `.brand` `location`, place variables are not available) |
| `when:` | string | No | Name of a [`.time`](#time-time) entry the story fits: a window or a season. Implementations offer the story as a template only [in season](#when-in-season). Absent: all year |
| `person:` | string | No | [Person](#person-person) id the story speaks about. Person variables resolve from it on every page that doesn't name its own |
| `group:` | string | No | [Group](#group-group) id the story speaks about. Group variables resolve from it on every page that doesn't name its own |
| `work:` | string | No | [Work](#work-work) id the story is about. Work variables resolve from it on every page that doesn't name its own, and the story is offered only while the work is [in season](#in-season) |
| `page` | block | Yes (1+) | One page (repeatable). Order in the file = order in the story |
| `example` | block | No | Texts for the open slots of the pages, about one story topic (repeatable) |
| `prompt` | block | No | The brief for writing the open slots anew for every date the story is posted on (at most one). See [`prompt` Block](#prompt-block) |

### `page` Block

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `purpose:` | string | Yes | Purpose id of the page |
| `composition:` | string | No | Composition id; must be one of the purpose's `compositions:`. When omitted, implementations pick one as for a new page |
| `illustration:` | string list | No | Illustration ids from the `.brand`, comma-separated. One id always shows that illustration; with several, implementations pick one per story date, the same one every time for that date, so a preview and the posted page match. When omitted, the purpose's `illustration:` applies |
| `photo:` | comma list or `camera` | No | Photo ids from the `.brand`. This page starts with one of them instead of the purpose's `photo:` list; with several, implementations pick one per story date, the same one every time for that date (like `illustration:`). `checkStory` reports an unknown id. `photo: camera` instead: the page starts without a photo and asks for one taken now (today's light, today's place); implementations offer the camera in its photo region. It stands alone, and `checkStory` reports it on a purpose with `camera: false` |
| `theme:` | string | No | Theme name from the `.brand`. This page uses that theme instead of the colours the story starts with (the first page's purpose `palette:`). `checkStory` reports an unknown theme |
| `background:` | `#RRGGBB` or `{item}` | No | The page's ground, instead of the theme's background. `{item}` is the day's [item](#items) of the page's work: a colour of the day. Text and logo follow the brand's contrast rule against it. `checkStory` reports `{item}` without a work, without `items:`, or with an item that is not `#RRGGBB` |
| `topic:` | string | No | Page topic: what this page adds to the story |
| `person:` | string | No | [Person](#person-person) id this page speaks about, instead of the story's. One page can name one person; a carousel of three regulars is three pages |
| `group:` | string | No | [Group](#group-group) id this page speaks about, instead of the story's |
| `work:` | string | No | [Work](#work-work) id this page is about, instead of the story's. One page names one work; the breads of the week are a page list with one work per copy |
| `repeat:` | `MIN-MAX` | No | The page is a [page list](#page-lists): between MIN and MAX copies of it in a row, e.g. `2-6`. 1 ≤ MIN ≤ MAX. At most one page per story |
| `SLOTID:` | string | No | Fixed text for a slot the purpose declares. A bare `SLOTID:` takes the following 4-space lines, as in purpose examples |

Every slot of the purpose is one of three kinds on a page:

| Kind | Written as | Meaning |
|------|------------|---------|
| Fixed | `primary: Open today` | Always this text |
| Variable | `label: From {date}` | Fixed text with placeholders, resolved for the story's date |
| Open | slot not named | Filled from the story's examples, by the person, by AI writing, or by the story's [prompt](#prompt-block) |

A slot with `value:` in the purpose is fixed there and is never named on a page.

### Page lists

A page with `repeat: MIN-MAX` stands for a run of item pages: the spots of a listicle, the breads of the week. A story starts with MIN copies of it, or with as many as its example fills. People can add copies up to MAX, remove them down to MIN and reorder them within the list; every other page of the story stays where the file puts it.

```yaml
page
  purpose: listicle-cover
  primary: {count} spots for a rainy day

page
  purpose: listicle-item
  repeat:  3-8
  label:   {n}
```

`{n}` is a copy's position in the list, `{count}` the number of copies; implementations update both as copies are added, removed or moved. A slot that holds `{n}` or `{count}` is fixed like any page text, so the number can't be typed over.

### Variables

A page text may contain `{name}` placeholders. Implementations resolve them for the story's date (the day it is posted or the day a person picks), in the brand's language:

| Variable | Resolves to | Example | Longest |
|----------|-------------|---------|---------|
| `{weekday}` | Full weekday name | `Mittwoch`, `Wednesday` | 10 |
| `{date}` | Day and month, no year | `30. Oktober`, `30 October` | 13 |
| `{sunrise}` | Sunrise, local time | `07:21`, `7:21 AM` | 8 |
| `{sunset}` | Sunset, local time | `16:48`, `4:48 PM` | 8 |
| `{day-length}` | Time from sunrise to sunset | `9 Std. 27 Min.`, `9 h 27 min` | 15 |
| `{moon}` | Moon phase, one of eight (below) | `Vollmond`, `full moon` | 20 |
| `{temperature}` | Highest air temperature of the day | `14 °C` | 6 |
| `{wind}` | Strongest hourly mean wind between sunrise and sunset, Beaufort | `4 Bft` | 6 |
| `{weather}` | The day's condition, one of nine (below) | `teils bewölkt`, `partly cloudy` | 13 |
| `{place}` | The place's `name:` | `Harbour Café` | its length |
| `{address}` | The place's `address:` | `Quay 3, Harbour Town` | its length |
| `{street}` | The address up to its first comma: street and number | `Quay 3` | its length |
| `{hours}` | The day's opening hours, one range per line (below) | `Lunch, 12–2 PM` | per line, below |
| `{week-hours}` | The week's opening hours, one line per group of days (below) | `Mon–Fri 8 AM–6 PM` | per line, below |
| `{opens}` | When the place opens that day | `08:00`, `8:00 AM` | 8 |
| `{closes}` | When it closes that day | `18:00`, `6:00 PM` | 8 |
| `{opening}` | The day the place opens: its `opening:`, day and month | `28. November`, `28 November` | 13 |
| `{season}` | The current season's `label:` | `Frühling`, `Spring` | its length |
| `{founded}` | The year the brand started | `2019` | 4 |
| `{years}` | Whole years since the brand started | `7` | 3 |
| `{daily NAME}` | The time of that moment of the brand's day | `04:00`, `4:00 AM` | 8 |
| `{person}` | The person's `name:`, or their `role:` without a name | `Thomas`, `the baker` | its length |
| `{role}` | The person's `role:` | `Regular in Lemkenhafen` | its length |
| `{since}` | The year the person has been with the brand | `2006` | 4 |
| `{since-years}` | Whole years since then | `20` | 3 |
| `{reason}` | The person's `reason:` | `Holiday without a programme` | its length |
| `{group}` | The group's `name:` | `Giardini di Mirò` | its length |
| `{where}` | The group's `where:` | `Reggio Emilia` | its length |
| `{group-since}` | The year the group has been with the brand | `2001` | 4 |
| `{group-years}` | Whole years since then | `25` | 3 |
| `{work}` | The work's `title:` | `Quasi Casa` | its length |
| `{kind}` | The work's `kind:` | `album`, `bread` | its length |
| `{by}` | Who the work is by: the names of its `by:` persons and groups, or the brand's name | `Giardini di Mirò` | its length |
| `{price}` | The work's `price:` | `750 g · €5.80` | its length |
| `{on}` | The work's next `on:` day, day and month | `24. Oktober`, `24 October` | 13 |
| `{time}` | The work's `time:`, formatted like hours | `14–18 Uhr`, `2–6 PM` | 17 |
| `{days-until}` | Days from the story's date to the work's next `on:` day; `0` on the day | `12` | 3 |
| `{item}` | The value of the day's [item](#items) of the work | `#1F3A5F` | its length |
| `{item-name}` | That item's name | `Harbour Night` | its length |
| `{item-note}` | That item's note | `The colour of the quay after dark.` | its length |
| `{n}` | The page's position in its [page list](#page-lists); only on the page with `repeat:` | `3` | 2 |
| `{count}` | How many pages the page list has; on any page of a story with a page list | `5` | 2 |

**Calendar** variables (`{weekday}`, `{date}`) and **list** variables (`{n}`, `{count}`) need nothing. **Sky** variables (`{sunrise}`, `{sunset}`, `{day-length}`, `{moon}`) are computed from coordinates: the story's [place](#place-place)'s when it has them, else the brand's [`location`](#location-block). **Weather** variables (`{temperature}`, `{wind}`, `{weather}`) come from a forecast for the same coordinates. `checkStory` reports a sky or weather variable without either.

**Place** variables (`{place}`, `{address}`, `{street}`, `{hours}`, `{week-hours}`, `{opens}`, `{closes}`, `{opening}`) come from the story's place: the one its `place:` names, else the brand's only place. `{address}` and `{street}` need the place's `address:`, the hours variables its `hours` block, `{opening}` its `opening:`.

**Time** variables come from the brand's [`.time`](#time-time): `{season}` needs `season` blocks, `{founded}` and `{years}` need `founded:`, `{daily NAME}` needs that `daily` entry.

**Person** variables (`{person}`, `{role}`, `{since}`, `{since-years}`, `{reason}`) come from the page's person: the one its `person:` names, else the story's. `{since}` and `{since-years}` need the person's `since:`, `{reason}` its `reason:`. `{person}` gives the name only with `name:`; otherwise the role, so a page never names someone who didn't agree.

**Consent is not guessed.** A person file holds what the person agreed to and nothing else: a name, photos, quotes. From the person's `until:` day on, a page that names them is not posted: the preview says why.

**Group** variables (`{group}`, `{where}`, `{group-since}`, `{group-years}`) come from the page's group: the one its `group:` names, else the story's, else the group of the page's person (`group:` in the person file). `{where}` needs the group's `where:`, the since variables its `since:`.

**Work** variables (`{work}`, `{kind}`, `{by}`, `{price}`, `{on}`, `{time}`, `{days-until}`) come from the page's work: the one its `work:` names, else the story's. `{price}` needs `price:`, `{time}` needs `time:`, `{on}` and `{days-until}` need `on:`. `{days-until}` counts to the work's next `on:` day on or after the story's date; after a one-off date it has no value. `{by}` joins several names with the brand's language's "and"; without `by:` it is the brand's name. `{item}`, `{item-name}` and `{item-note}` need `items:` and show the day's [item](#items); on a day without one (before the start, after `until:`, the list used up) the page is not posted. `checkStory` reports `{item-name}` or `{item-note}` when an item has no name or note.

**`{hours}`** writes each range of the day on its own line, the label first when it has one: `Lunch, 12–2 PM`. Times drop `:00` on the hour (`17–22 Uhr`, `17:30–22 Uhr`; `5–10 PM`, `5:30–10 PM`). A closed day gives `geschlossen` / `closed`. For `maxLength`, every line counts as its label plus 17 characters, and the text as many lines as the place's longest day has ranges.

**`{week-hours}`** writes the place's whole week, Monday first, one line per run of consecutive days with the same times: `Mo–Fr 8–18 Uhr`, `Sa 9–14 Uhr` / `Mon–Fri 8 AM–6 PM`, `Sat 9 AM–2 PM`. A run of one day names that day; several ranges on a line are comma-separated (`Do–Fr 12–14 Uhr, 17–22 Uhr`). Range labels are left out. Closed days are left out, so a page doesn't state them by hand and can't contradict the `hours` block. For `maxLength`, every line counts as 8 characters for its days plus 17 per range and 2 per comma.

**Closed is not guessed either.** On a day the place is closed, `{opens}` and `{closes}` have no value: a preview shows the placeholder, a scheduled post doesn't go out. Before a place's `opening:` it is closed every day: `{hours}` gives `geschlossen` / `closed`, `{opens}` and `{closes}` have no value. `{week-hours}` still shows the regular week, so a page can announce the hours it will have.

Times are local time in the time zone the story is posted in. Moon phases: new moon, waxing crescent, first quarter, waxing gibbous, full moon, waning gibbous, last quarter, waning crescent. Conditions: clear, partly cloudy, cloudy, fog, rain, sleet, snow, hail, thunderstorm. Implementations translate both into the brand's language.

**Weather is not guessed.** When no forecast exists for the date (too far ahead, or the service doesn't answer), implementations don't fill in a value: a preview shows a placeholder, a scheduled post doesn't go out. A page that shows a weather value credits its source; implementations add the credit themselves, as the source's terms require it.

**Short forms.** Four variables have a short form, written with the word `short` after the name. It is for lines that hold several facts and must not break:

| Variable | Resolves to | Example | Longest |
|----------|-------------|---------|---------|
| `{weekday short}` | Abbreviated weekday name, no period | `Mi`, `Wed` | 3 |
| `{date short}` | Day and abbreviated month, no year | `30. Okt`, `30 Oct` | 7 |
| `{opening short}` | The place's `opening:`, likewise | `28. Nov`, `28 Nov` | 7 |
| `{on short}` | The work's day, likewise | `28. Nov`, `28 Nov` | 7 |

Month abbreviations are the first three letters of the month's name in the brand's language and never end in a period, so a comma can follow (`Mi, 30. Okt, 14 °C`). German weekdays are two letters, English three. A short form needs what its variable needs. `short` after any other variable is an error, and so is any other word; `{daily NAME}` is the only variable whose second word is a name.

An unknown name is an error. Braces that don't form a lowercase `{name}` or `{name word}` stay plain text. Variables appear in page texts and in a purpose's example texts, never in topics or a story's examples. For `maxLength`, a variable counts at its longest form (column "Longest").

### `example` Block

One example fills the open slots of several pages together, about one story topic, so item pages match the story and don't repeat each other. Implementations fill a new story from one example and swap whole examples.

```yaml
page
  purpose:     daily-bread
  composition: editorial
  label:       Ab {date}

page
  purpose: daily-bread

example
  topic: A rye week: three rye breads from mild to dark
  page 1
    topic:   Light rye, the mild start
    primary: Hellroggen
  page 2
    topic:   The classic rye loaf
    label:   Der Klassiker
    primary: Roggenlaib
```

| Key | Indent | Description |
|-----|--------|-------------|
| `topic:` | 2 | Story topic for this example |
| `page N` | 2 | Texts for page N (1-based) |
| `topic:` | 4 | Page topic for page N |
| `photo:` | 4 | One photo id from the `.brand` that belongs to this example's texts (the coffee bag its name is about). It overrides the page's `photo:` while the story is filled from this example |
| `SLOTID:` | 4 | Text for an open slot of page N; a bare `SLOTID:` takes the following 6-space lines |

**Rules:**
- `page N` must exist in the story; each page appears at most once per example. A [page list](#page-lists)'s page may appear several times, once per copy in order, up to its MAX; the example then starts the story with that many copies.
- An example fills only open slots: a slot fixed on the page takes no example text.
- An example may leave pages or slots out; they stay open.
- The purpose's slot limits (`maxLength`, list `maxItems`) apply to page and example texts alike; `words:` and `sentences:` are guidance as for any text in the slot.

### `prompt` Block

A story that is posted again and again can have its open slots written anew each time. The `prompt` block is the brief for that: what to look at and what to say about it. It is free text on 2-space lines, kept as written.

```yaml
page
  purpose: note
  label:   {weekday}

example
  page 1
    primary: Rain is good news for the sourdough.
    credit:  Rain all day in the valley

prompt
  model: haiku
  Look at today's weather and the season.
  Say in one sentence what it means for the bread,
  and name in the credit what the sentence refers to.
```

**The prompt is only the brief.** Who the brand is and how it speaks is in the `.identity`; what the page is for, its slots and their limits are in the `.purpose`. Implementations give a model those files together with the prompt, the story's date, the story's examples and the texts written for earlier dates, so the block doesn't repeat any of it.

| Key | Indent | Description |
|-----|--------|-------------|
| `model:` | 2 | Optional, only as the block's first line: the name of the model that writes, lowercase kebab-case. The names belong to the implementation, which reports one it doesn't know. Absent: the implementation's default |
| text | 2 | The brief, every further line |

**Rules:**
- A story has at most one `prompt`, and it has text.
- The prompt writes open slots only, as an example does: a slot fixed on the page keeps its text. `checkStory` reports a prompt in a story without an open slot.
- The purpose's slot limits (`maxLength`, list `maxItems`) bind what is written. Implementations check the result and don't post a text that breaks them.
- The examples stay: they are what a preview shows, and they show the model what a good text looks like.
- Braces in a prompt are plain text. Variables belong in page texts.

**Written text is not posted unseen.** Implementations show a person what was written for a date before it goes out, with what it refers to, and that person can stop it.

### Exclusion Rule

A `.story` file must NOT contain: color values, typography values, slot definitions, layout values, schedules or posting times. When a story is posted belongs to the implementation, not to the brand files.

---

## Fact Files

The five layers describe; a story orchestrates. To orchestrate it needs to know when, where, who and what, and each answer has a file of the same kind: [`.time`](#time-time) says when, [`.place`](#place-place) says where, [`.person`](#person-person) and [`.group`](#group-group) say who (one human, or more than one), [`.work`](#work-work) says what the brand puts out or puts on. They hold facts, never voice or colour; a story pulls them in with `when:`, `place:`, `person:`, `group:` and `work:`, and their facts reach the page as [variables](#variables). What a fact file doesn't say is not guessed: a closed day has no closing time, a date that passed has no countdown, a person without a name in the file has no name.

A fact file exists only if posts speak about its subject. Each thing carries its own dates: a place its `opening:`, a person their `since:` and `until:`, a work its `on:` or its `days:`. The `.time` holds only what belongs to the brand as a whole.

## Time (`.time`)

**Cardinality:** Zero or one per brand.
**File extension:** `.time`
**Filename convention:** the brand id (e.g., `krume.time`), next to the `.identity` and `.brand`

The brand's rhythm: when it started, its seasons and windows, its day. Facts, not voice: the identity says what the early morning means to the brand, the `.time` says the oven is on at four. Every block is optional. A brand without a `.time` has no seasons and no windows, and everything it posts fits all year.

Nothing in the file is an occasion. A Saturday bread, a baking class, a mill day, a tasting evening have a day or a date of their own and are [works](#work-work); a place's hours are the place's. The `.time` says what is true of the brand as a whole, which is why there is one.

```yaml
# krume.time
# The brand's rhythm: when it started, its seasons and windows, its day.

founded: 2019-05-04

season spring
  label: Spring
  from:  03-01

season summer
  label: Summer
  from:  06-01

season autumn
  label: Autumn
  from:  09-01

season winter
  label: Winter
  from:  12-01

windows
  rhubarb: 04-15..06-24
  advent:  11-27..12-24

daily
  oven:     04:00  Oven on
  shelf:    06:00  Everything on the shelf
  regulars: 07:00  The regulars at the door
  gone:     12:00  Mostly sold out
```

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `founded:` | date or year | No | `YYYY-MM-DD` or `YYYY`: when the brand started. `{founded}` and `{years}` show it; a bare year counts from January 1 |
| `season NAME` | block | No | A season of the brand's year (repeatable, below). At least two when any |
| `windows` | block | No | Named yearly date windows (below) |
| `daily` | block | No | Named moments of the brand's day (below) |

Names (`NAME`, window names, daily names) are lowercase kebab-case and unique across the file. `when:` names a window or a season; a daily moment is a time of day, not a season, and is reached with `{daily NAME}`.

### `season NAME` Block

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `label:` | string | Yes | The season's name as people say it. `{season}` shows it |
| `from:` | `MM-DD` | Yes | The day the season starts |

A season runs until the next season starts, in date order, wrapping over the year end. Start dates are unique. A `.brand` colour family names its season with `season: NAME`.

### `windows` Block

Named yearly date windows for content that only fits part of the year.

```yaml
windows
  strawberries: 06-01..07-31
  plums:        08-01..09-15, 10-01..10-15
  christmas:    11-27..01-06    # wraps over the year end
```

Each entry is `name: MM-DD..MM-DD`, with further ranges separated by commas. Ends are inclusive. A range whose start is after its end wraps over the year end.

### `daily` Block

The brand's own clock: named moments of the day, in order.

```yaml
daily
  oven:  04:00  Oven on
  shelf: 06:00  Everything on the shelf
```

Each line is `name: HH:MM` followed by an optional label. `{daily NAME}` shows the time; AI writing gets the label as a fact, so "on the shelf since six" comes from the file and the identity keeps the sentence as voice.

### `when:` and in season

A `when:` on a purpose example, a brand photo, a story or a story page names one `.time` entry, a window or a season. The content is **in season** on a day inside one of the window's ranges, or inside the season. Content about a work names the work with `work:` instead and is in season when the [work is](#in-season).

Implementations pick and suggest only in-season content, but never remove what a person has already placed. Content without `when:` or `work:` fits all year. An unknown name is an error.

### Exclusion Rule

A `.time` never contains: voice or tone (→ `.identity`), visual parameters (→ `.brand`), a place's opening hours (→ `.place`), events, classes and the days a product is sold (→ `.work`), post texts (→ `.purpose`, `.story`), posting schedules (→ the implementation).

---

## Place (`.place`)

**Cardinality:** Zero or more per brand.
**File extension:** `.place`
**Filename convention:** the place id (e.g., `harbour.place`), in `places/`

A place is a site the brand's posts speak about: a café, a shop, a bar, an information office. It holds facts, not voice or design: where it is, how many people it holds and when it's open. The area the brand is in as a whole stays the `.brand`'s [`location`](#location-block).

A site matters only if posts speak about it. A place without `hours` is one people don't walk in at set times: an office, a storage whose occasional events give their date and time on the event page.

```yaml
# The café on the quay
id:        harbour
name:      Harbour Café
address:   Quay 3, Harbour Town
latitude:  54.32
longitude: 10.14
maps:      https://maps.example.com/harbour
context:   On the quay. Ferry crowd in the morning, locals in the afternoon.

hours
  mon-wed: 08:00-18:00
  thu-fri: Lunch 12:00-14:00, Evening 17:00-22:00
  sat:     09:00-14:00
  sun:     closed

capacity
  indoor:  40
  outdoor: 16
```

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `id:` | string | Yes | Place identifier; stories name it with `place:` |
| `name:` | string | Yes | Name, as people say it. `{place}` shows it |
| `address:` | string | No | Postal address, as on the sign. `{address}` shows it |
| `latitude:` / `longitude:` | number | No | Decimal degrees, both or neither. Sky and weather of the place's stories use them instead of the brand's `location` |
| `maps:` | URL | No | Link to the place on a map (`https://`) |
| `context:` | string | No | Facts for AI writing: what the place is like, who comes, what it offers. Not voice, which belongs to `.identity` |
| `opening:` | date | No | `YYYY-MM-DD`: the day a new place opens. Before it the place is closed every day (see [Variables](#variables)), and AI writing treats it as not open yet. `{opening}` shows it |
| `hours` | block | No | Regular opening hours (below) |
| `capacity` | block | No | How many people the place holds (below) |

### `hours` Block

One line per day or range of days: `DAYS: RANGES`.

- **Days:** `mon`, `tue`, `wed`, `thu`, `fri`, `sat`, `sun`, or a range such as `mon-fri`. A range may wrap over the week end (`fri-mon`). A day appears at most once.
- **Ranges:** `HH:MM-HH:MM`, 24-hour, comma-separated, optionally after a label (`Lunch 12:00-14:00`). An end before the start runs past midnight and belongs to the day it starts; `24:00` is midnight.
- **`closed`**, or a day not named: the place is closed that day.

Only regular weekly hours. Holidays and one-off closures are not part of the file.

### `capacity` Block

How many people the place holds: seats, or standing room where people stand. One line per side, a whole number; at least one.

| Key | Type | Description |
|-----|------|-------------|
| `indoor:` | int | People inside |
| `outdoor:` | int | People outside: a terrace, tables on the street |

A side that isn't named is not stated, not zero. AI writing gets the capacity as a fact and never states a number the block doesn't give.

### Exclusion Rule

A `.place` never contains: voice or tone (→ `.identity`), visual parameters (→ `.brand`), post texts (→ `.purpose`, `.story`).

---

## Person (`.person`)

**Cardinality:** Zero or more per brand.
**File extension:** `.person`
**Filename convention:** the person id (e.g., `thomas.person`), in `people/`

Someone the brand's posts name, quote or show: the founder, the baker, a regular, a guest, a winemaker, a speaker. Facts, not voice: what the person said is theirs and stays verbatim. One file per person, so that withdrawing a person is deleting one file.

The file is the consent. A person who agreed to nothing has no file, and the file holds only what the person agreed to: a `name:` because it may be written, `photos:` because they may be shown, `quote` blocks because they may be quoted. `consent:` records when they agreed, `until:` when that ends.

```yaml
# people/thomas.person
# A regular from Lemkenhafen.

id:      thomas
name:    Thomas
role:    Regular in Lemkenhafen
since:   2006
place:   lemkenhafen
reason:  Holiday without a programme
context: Comes every May for two weeks, cycles to the dyke every morning. Recommends the jetty at seven.
photos:  thomas-jetty, thomas-bike
consent: 2026-05-02
until:   2028-05-02

quote
  I don't need a programme here. The dyke is enough.

quote
  Seven in the morning at the jetty, nobody there yet.
```

A person without a name:

```yaml
# people/baker.person
id:      baker
role:    Baker
since:   2019
reason:  Quit her agency job and turned the copy shop into a bakery.
consent: 2019-05-04

quote
  What's gone is gone. Tomorrow there's more.
```

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `id:` | string | Yes | Person identifier; stories, pages and photos name it with `person:` |
| `name:` | string | No | The name as a post may write it, usually a first name. Omitted: the person is their role, in every post |
| `role:` | string | Yes | Who they are to the brand, in the brand's language, as a post would say it: `Baker`, `Regular in Lemkenhafen`, `Winemaker of the house wine` |
| `since:` | date or year | No | `YYYY-MM-DD` or `YYYY`: since when. `{since}` and `{since-years}` show it; a bare year counts from January 1 |
| `place:` | string | No | The [place](#place-place) they belong to |
| `group:` | string | No | The [group](#group-group) they belong to: the band, the estate. The group's `members:` lists them |
| `reason:` | string | No | Why they come, what they do: the fact a goal like "a person with their reason to come" asks for. `{reason}` shows it |
| `context:` | string | No | Facts for AI writing. Not voice |
| `photos:` | string list | No | Photo ids from the `.brand` that show them, and may be shown. Each of those photos names this person with `person:` |
| `consent:` | date | No | `YYYY-MM-DD`: when the person agreed to what the file holds |
| `until:` | date | No | `YYYY-MM-DD`: when the consent ends. From that day the person is withdrawn: a page that names them is not posted |
| `quote` | block | No | Their words, verbatim, one quote per block on the following 2-space lines (repeatable) |

### Quotes

A `quote` block holds the person's own words. Implementations offer a person's quotes for the open slots of a page that names the person, the way they offer examples; AI writing never writes, extends or rewrites a quote. A quote in a slot is attributed with `{person}`. A purpose with `person: required` needs a person with at least one quote or one photo: something of theirs the page can show.

### Exclusion Rule

A `.person` never contains: voice or tone (→ `.identity`), visual parameters (→ `.brand`), post texts other than the person's quotes (→ `.purpose`, `.story`), an address (→ `.place`), a group's facts (→ `.group`), a critic's review (→ `.work`), what the person did not agree to.

---

## Group (`.group`)

**Cardinality:** Zero or more per brand.
**File extension:** `.group`
**Filename convention:** the group id (e.g., `giardini-di-miro.group`), in `groups/`

More than one person the brand's posts speak about as one: a band, an estate, a family farm, a mill, a club, a distributor, a label. Facts, not voice. One human is a [person](#person-person), whatever their role; a group is a group however small.

A group is public, and the file is not a consent: it has a region and links, no `consent:` and no `until:`. The humans in it who are named, quoted or shown have their own person files and name the group with `group:`. A group that the brand stops speaking about changes its `role:` ("Former artist") or loses its file.

```yaml
# groups/giardini-di-miro.group
# The band. What its members say is in their person files; what the band published as one is here.

id:      giardini-di-miro
name:    Giardini di Mirò
role:    Band on the label
since:   2001
where:   Reggio Emilia
members: luca
links:   https://giardinidimiro.com
photos:  gdm-stage
context: Six people, post-rock, on the label from the first record to the last show.
```

A group with its own published words:

```yaml
# groups/drax-mill.group
id:      drax-mill
name:    Drax mill
role:    The mill
where:   Dachau
links:   https://example.com/drax

quote
  Stone-ground, nothing taken out, nothing put in.
```

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `id:` | string | Yes | Group identifier; stories, pages, persons and photos name it with `group:`, works with `by:` |
| `name:` | string | Yes | The name as posts write it. `{group}` shows it |
| `role:` | string | Yes | What the group is to the brand, in the brand's language, as a post would say it: `Band on the label`, `Estate of the house wine`, `The mill` |
| `since:` | date or year | No | `YYYY-MM-DD` or `YYYY`: since when. `{group-since}` and `{group-years}` show it; a bare year counts from January 1 |
| `where:` | string | No | Region or town, as a post says it. A fact, not a [place](#place-place): a group has no hours. `{where}` shows it |
| `members:` | string list | No | [Person](#person-person) ids. Each of them names this group with `group:` |
| `links:` | URL list | No | The group's own pages (`https://`) |
| `photos:` | string list | No | Photo ids from the `.brand` that show the group. Each of those photos names this group with `group:` |
| `context:` | string | No | Facts for AI writing. Not voice |
| `quote` | block | No | Words the group published as one: a statement, liner notes, a back label. Verbatim, one quote per block (repeatable). Attributed with `{group}` |

### Quotes

A group's `quote` blocks follow the [person's](#quotes): offered for the open slots of a page that names the group, never written, extended or rewritten by AI. A remark by a member is the member's quote, in the member's file, even when the group is the subject. A purpose with `group: required` needs a group with at least one quote or one photo.

### Exclusion Rule

A `.group` never contains: voice or tone (→ `.identity`), visual parameters (→ `.brand`), post texts other than the group's quotes (→ `.purpose`, `.story`), an address with hours (→ `.place`), a member's words or consent (→ `.person`), what the group sells or puts on and what critics wrote about it (→ `.work`).

---

## Work (`.work`)

**Cardinality:** Zero or more per brand.
**File extension:** `.work`
**Filename convention:** the work id (e.g., `rye-loaf.work`), in `works/`

A thing the brand puts out or puts on, that posts return to: a bread, a wine, a record, a book, an exhibition, a class, a tasting evening, a show, a mill day. Facts, not voice: what it is, who it is by, what it costs, when it is out or when it takes place. `kind:` is the brand's own word for it. The work carries its own date: a one-off or yearly `on:`, or the `days:` it comes round on. That is why an event is a work and not an entry in the `.time`.

```yaml
# works/rye-loaf.work
# The classic. The facts a daily-bread page states come from here.

id:     rye-loaf
title:  Rye loaf
kind:   bread
place:  weserstrasse
price:  750 g · €5.80
photos: rye-loaf-cut
facts:
  Rye 1150 from the mill in Dachau, 18 hours of fermentation, caraway from the Wendland.
```

A work with its own days, and one with a date:

```yaml
# works/baking-class.work
id:     baking-class
title:  Baking class
kind:   class
days:   sat
time:   14:00-18:00
place:  weserstrasse
price:  €85, flour and bread included
facts:
  Four hours, six people, two doughs. Everyone leaves with a loaf and a starter.
```

```yaml
# works/mill-day.work
id:     mill-day
title:  Mill day
kind:   event
on:     05-02
time:   10:00-16:00
lead:   21
place:  weserstrasse
by:     drax-mill
facts:
  The mill from Dachau sets up its stones in the yard, bread and cake at the long table.
```

A release:

```yaml
# works/quasi-casa.work
id:     quasi-casa
title:  Quasi Casa
kind:   album
by:     giardini-di-miro
on:     2025-10-24
lead:   42
price:  from €15
links:  https://www.2ndrec.com/products/quasi-casa
photos: quasi-casa-sleeve
facts:
  A live recording of their final show. 2xLP with download code and a 20-page booklet.

review
  by:   Jane Roe, Field Notes
  on:   2025-11-02
  link: https://example.com/field-notes/quasi-casa
  A farewell that never raises its voice.
```

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `id:` | string | Yes | Work identifier; stories, pages, examples and photos name it with `work:` |
| `title:` | string | Yes | The title as posts write it. `{work}` shows it |
| `kind:` | string | Yes | What it is, in the brand's own word: `bread`, `wine`, `album`, `class`, `event`, `show`. `{kind}` shows it |
| `by:` | string list | No | [Person](#person-person) or [group](#group-group) ids the work is by. Absent: the brand's own. `{by}` shows the names |
| `on:` | date or range | No | `MM-DD` for a yearly date, `MM-DD..MM-DD` for a yearly run of days, `YYYY-MM-DD` or `YYYY-MM-DD..YYYY-MM-DD` for a one-off. The day it comes out, takes place or is on the shelf. `{on}` and `{days-until}` show it |
| `days:` | days | No | Weekdays as in [`hours`](#hours-block): `sat`, `thu-fri`, `mon, wed`. The days a work comes round on: a Saturday bread, a Thursday tasting |
| `time:` | `HH:MM-HH:MM` or `HH:MM` | No | When on those days or on that date. `{time}` shows it |
| `lead:` | int | No | Days before `on` during which the work is in season. Default `14` |
| `until:` | date | No | `YYYY-MM-DD`: the day after which the work is no longer posted about. A page that names it is not posted |
| `when:` | string | No | A [`.time`](#time-time) window or season the work fits: a stollen in Advent |
| `place:` | string | No | The [place](#place-place) it is sold, shown or held at |
| `price:` | string | No | As a post writes it, with the unit when there is one: `750 g · €5.80`, `from €15`. `{price}` shows it; implementations never compute with it |
| `links:` | URL list | No | Where to buy, listen, book (`https://`) |
| `photos:` | string list | No | Photo ids from the `.brand` that show the work. Each of those photos names this work with `work:` |
| `facts:` | block | No | Facts for AI writing, on the following 2-space lines: ingredients, duration, edition, vintage, line-up. Not voice |
| `items:` | block | No | A series' items, one per time the work comes round: see [Items](#items). A bare `items:`, or `items: cycle` to start over after the last |
| `review` | block | No | What a critic wrote about the work, verbatim: see [Reviews](#reviews) (repeatable) |

### In season

A work's dates say when content about it fits. A page, a story or an example that names the work is **in season** on a day when every one of these that the work has says so:

| Key | In season |
|-----|-----------|
| yearly `on:` | from `lead` days before its start to its end, inclusive; out of season in between |
| one-off `on:` | from `lead` days before its start, and from then on: the work is out. Before it `{days-until}` counts down |
| `days:` | the day is one of them |
| `when:` | the window or season is, as in the [`.time`](#when-and-in-season) |
| `until:` | the day is not after it |

A work with none of them fits all year. A one-off `on:` is a launch, not an expiry: a record stays in season after its release day. An event that is over is withdrawn with `until:` on its day, or by a yearly `on:` that comes round again.

### Items

A work that is a series lists what each time brings: a colour of the day, a word of the week. One item per 2-space line, `VALUE  Name` (two spaces before the optional name), its optional note on the 4-space lines below. The list's order is the posting order.

```yaml
# works/colour-of-the-day.work
id:     colour-of-the-day
title:  Colour of the day
kind:   series
on:     2026-12-01
until:  2026-12-31
items:
  #1F3A5F  Harbour Night
    The colour of the quay after dark.
  #F2C14E  Mustard
    The awning of the corner shop.
```

```yaml
# works/word-of-the-week.work
id:     word-of-the-week
title:  Word of the week
kind:   series
on:     2026-01-05
days:   mon
items:  cycle
  Fernweh  Far-sickness
  Feierabend  The hour work ends
```

- **Which item a day gets:** the work comes round on its `on:` date and then on each of its `days:` (every day without `days:`), and each time takes the next item. Between two times the last one's item holds: the word of the week all week.
- **No item:** before `on:`, after `until:`, and after the last item. Each item is used once, so nothing repeats; `items: cycle` starts over instead.
- **Needs a one-off `on:`** (`YYYY-MM-DD`): items count from it.
- **A value is plain text.** Where it is used decides what it must be: in a slot anything goes, a story page's `background: {item}` needs `#RRGGBB`.
- **Errors:** an empty list, a value listed twice (case ignored), two `#RRGGBB` values closer than 0.03 in OKLab (they look the same). A `#` line inside the list is an item; only `# …` with a space is a comment.

An item's value is a fact about the work, what this time brings, not the brand's look: a colour of the day is the subject of its post, not a brand colour.

### Reviews

A `review` block holds what a critic wrote about the work: a record review, a restaurant critic's line, a jury's words. Its 2-space lines start with the keys, then the words:

| Key | Required | Description |
|-----|----------|-------------|
| `by:` | Yes | Who wrote it where, as a post credits it: `Jane Roe, Field Notes` |
| `on:` | No | `YYYY-MM-DD`: when it appeared |
| `link:` | No | Where to read it (`https://`) |

The words follow on the next 2-space lines, as published; a `#` line among them is part of the words. Once the words have started, a line that begins with `by:` is a word, not a key.

Reviews follow the [person's quotes](#quotes): implementations offer them for the open slots of a page that names the work, verbatim, in quotation marks and credited with the review's `by:`. AI writing never writes, extends, shortens or rewrites a review. A critic is not a person of the brand: a review never goes into a `.person` or a `.group`, and needs no consent, because it was published.

**Errors:** a review without `by:`, or without words; a key twice; `on:` that is not a date; `link:` that is not `https://`.

### Exclusion Rule

A `.work` never contains: voice or tone (→ `.identity`), visual parameters (→ `.brand`), post texts (→ `.purpose`, `.story`), the brand's seasons (→ `.time`), a place's hours (→ `.place`), who made it beyond their id (→ `.person`, `.group`).

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

A story adds the fact files to the context of each page: the [place](#place-place) its `place:` names, the [time](#time-time) entry its `when:` names, the [person](#person-person), [group](#group-group) and [work](#work-work) its `person:`, `group:` and `work:` name. They add facts and variables, never voice.

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
- An example, photo, story or page `when:` names an entry the `.time` doesn't declare; a `.brand` still has a `windows` block or a colour family `from:` date; a `.time` still has a `weekly` or `date` block (they are works since v0.44); a `.brand` asset still has a library `group:`
- A colour family names a season the `.time` doesn't declare, or two families name the same season
- A story, page or photo names a person that doesn't exist; a page of a purpose with `person: required` has no person; a person's `photos:` lists a photo whose `person:` is someone else, or a photo's `person:` isn't in that person's `photos:`; a page of a purpose with `person: required` names a person with neither a quote nor a photo
- A story, page, person or photo names a group that doesn't exist; a group's `members:` lists a person whose `group:` is another group, or a person's `group:` isn't in that group's `members:`; a group's `photos:` and a photo's `group:` disagree; a page of a purpose with `group: required` has no group, or one with neither a quote nor a photo
- A story, page, example or photo names a work that doesn't exist; a work's `by:` names an id that is neither a person nor a group; a work's `when:` names an entry the `.time` doesn't declare; a work's `photos:` and a photo's `work:` disagree; a page of a purpose with `work: required` has no work; a page names a work whose `until:` has passed
- An example `goal:` references a goal not defined in `.identity`
- A `.purpose` still uses deprecated slot `samples:`
- An `archetypes` entry references a non-existent `.composition` file
- A `purposes` entry in `.format` references a non-existent `.purpose` file
- A `.story` references a format, purpose or composition that doesn't exist, a composition its purpose doesn't list, or a slot its purpose doesn't declare or fixes with `value:`
- A fixed or example text in a `.story` exceeds the slot's limits
- A `.story` names a place that doesn't exist, or uses a place variable without a place (several places and no `place:`), `{address}` without `address:` or an hours variable without `hours`
- A `.story` uses a time variable the `.time` can't give (no `founded:`, no `season`, no such `daily` entry), a person variable without a person, a group variable without a group, or a work variable without a work or one the work can't give (`{price}` without `price:`, `{on}` or `{days-until}` without `on:`, `{time}` without `time:`)

---

## File Organization

### Your Brand

A brand lives in its own folder, named after the brand. The folder contains the brand's `.identity`, `.brand` and `.time` files alongside its formats, purposes, compositions, stories, places, people, groups and works:

```
project/
└── brandname/
    ├── brandname.identity
    ├── brandname.brand
    ├── brandname.time
    ├── formats/
    │   └── instagram-4-5-feed-portrait.format
    ├── purposes/
    │   └── daily-bread.purpose
    ├── compositions/
    │   └── editorial.composition
    ├── stories/
    │   └── breads-of-the-week.story
    ├── places/
    │   └── harbour.place
    ├── people/
    │   └── thomas.person
    ├── groups/
    │   └── drax-mill.group
    └── works/
        └── rye-loaf.work
```

Every brand is fully self-contained. Formats, purposes, compositions, stories and fact files are specific to one brand — there are no shared files between brands.

### Examples

Reference brands for learning and inspiration live under `examples/`. They mirror the "your brand" structure but are clearly labeled as reference material — not production, not something to build on directly:

```
project/
└── examples/
    └── krume/
        ├── krume.identity
        ├── krume.brand
        ├── krume.time
        ├── formats/
        ├── purposes/
        ├── compositions/
        ├── stories/
        ├── places/
        ├── people/
        ├── groups/
        └── works/
```

The `brand-intent` npm package ships example brands under `examples/`. Run `brand-intent init` to copy them into your own project.

**Checking a brand folder.** `brand-intent check <brand folder>` parses every file and checks the files against each other, with the same checks a consumer runs: a story's purpose, composition, format, theme, photo, time entry, person, group and work exist; a format's `purposes:` and a purpose's `compositions:` name files that exist; a purpose's typography, slot `color:` and framing are in the `.brand`, its `scope` audiences in the `.identity`; the variables in a purpose's examples can be filled; people, groups and works name each other correctly; no two purposes, compositions or formats share an id; `photos/index.json` is current and the photo library resolves. A composition no purpose lists, a purpose without compositions and `sticky:` in a grid-mode composition are warnings. Everything but the photo index is one function over parsed files, `checkFiles(files)`, which returns each issue with its severity, file and message, so an application that has already loaded a brand runs the same check without a folder. It prints `✗` for each problem and `!` for each warning, and exits 1 on any problem, so it runs as a CI step. Warnings (an ignored key, a file in `photos/` that is no image) never fail it.

---

*Brand Intent Specification v0.1 / April 2026*
