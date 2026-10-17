# Plan — Color pairs, color rules, color families

Three grammar additions shipped together in one `brand-intent` release, plus the guided engine and a pair test view in `brand-atelier`.

First consumer: Fehmarn's seasonal color system ("Farbkreislauf", Figma `SK2VRgJCOqQJOnLDny9g4i`, nodes `1022:2` palette + rules, `1062:2` combinations). Designed so any brand can use each part on its own.

## Why

1. **Themes are pairs written out by hand.** Every joschi theme is a ground and a figure color; the other 13 slots follow mechanically (figure on logo/cta/divider/sticker-bg, ground on sticker-fg/label-fg, hand-picked grey tints for text tiers). 4 themes × 15 slots = 60 lines for 8 decisions.
2. **Contrast rules exist only in designers' heads.** No brand states its minimums, so nothing checks them. White on joschi `Gruen` is ~3.7:1 and on `Orange` ~3.1:1: fine for headlines, below 4.5:1 for body text. Guided mode (`palette: dynamic`, used by 19 purposes) drifts hues in LCh but never checks contrast.
3. **Some color systems are cyclic, not hierarchical.** Fehmarn has four seasons, each with a core, two accents and a contrast color. A season may borrow from its neighbours, never from the opposite season. The grouped `brand-colors` shape (`primary / secondary / accent / neutral`) expresses hierarchy and distribution; it cannot express "these four colors belong together, and these sets sit next to each other in this order". The same structure fits times of day (cycle), magazine sections or event editions (sequence), and sub-brands sharing a base.

## Change 1 — Pair themes

### Grammar

```
theme Gruen
  ground: $gruen
  figure: $weiss
  text:   $weiss          # optional
```

- `ground:` and `figure:` are new keys in the existing `theme` block. Both present = pair theme. Only one of them = hard error.
- `text:` is optional. When absent it is resolved (see below).
- Any explicit slot (`logo:`, `cta:`, …) overrides the derived value. Full slot-only themes keep working unchanged.

### Derivation

| Slot | Value |
|---|---|
| `background` | ground |
| `text-primary` | text |
| `text-secondary` / `-tertiary` / `-subtle` / `-muted` | text at 85% / 70% / 55% / 40% (alpha syntax) |
| `logo`, `cta`, `divider`, `icon`, `illustration`, `sticker-bg`, `label-bg` | figure |
| `sticker-fg`, `label-fg` | ground |

### Text resolution (no `text:` given)

Candidates in order, first one reaching `color-rules.text` against ground wins:

1. The owning family's `contrast` color (only inside `color-families`, rule 04 in Fehmarn)
2. The neutral `dark` entry, then the neutral `light` entry (grouped brand-colors), else `#000000` / `#FFFFFF`

No candidate passes → parser warning, `text-primary` falls back to the higher-contrast candidate.

Example: Winter ground `#006EFA` with contrast color `#263410` is only ~2.9:1, so text resolves to white (4.6:1). Figma rule 04 holds where it can and degrades safely where it can't.

## Change 2 — `color-rules`

### Grammar

```
color-rules
  text:   4.5            # min contrast for text on ground
  figure: 3              # min contrast between ground and figure
  avoid:  light+light, mid+mid
  tones:  1.8, 4.5       # optional: tone class thresholds (contrast vs white)
```

- All fields optional. Block absent = no checks (today's behaviour).
- Tone classes, computed from WCAG contrast against white: `< 1.8` light, `≥ 4.5` dark, else mid. `tones:` overrides the two thresholds.
- `avoid:` takes combinations of `light | mid | dark` joined with `+`.

### Where rules apply

- **Every theme**, pair or slot-only: parser warnings for `text-primary` vs `background` and `figure` (or `logo`) vs `background`. Warnings, not errors, so existing brands keep parsing.
- **Curated pairs** inside `color-families` (Change 3).
- **Guided generation**: rules become a hard filter on candidates.

## Change 3 — `color-families`

### Grammar

```
color-families
  order:    cycle            # cycle | sequence
  borrow:   both             # previous | next | both | none
  distance: 1                # steps borrowing may reach, default 1
  shared:   $fehmarn-blau, $weiss

  family Winter
    core:     #006EFA
    accent:   #415C55
    accent:   #BCD6E2
    contrast: #263410
    pairs
      #006EFA / #F9FF9D
      #263410 / #B6E1FC

  family Fruehling
    …
```

- Family order = declaration order.
- Roles, fixed vocabulary: `core` (exactly 1), `accent` (0+), `contrast` (exactly 1, the text carrier).
- Values: `#HEX`, optionally followed by a display name like in `brand-colors`. Unnamed entries get a generated name `{family}-{role}[-n]` (e.g. `winter-accent-2`). All family colors join the flat projection, so `$winter-core` works in themes.
- `shared:` lists `brand-colors` references that are allowed in every family.
- `pairs` is optional: `ground / figure`, one per line, hex or `$ref`. Each pair becomes a pair theme (Change 1) named `{Family}-{n}` (e.g. `Winter-3`).

### Reach

A family may use:
- its own colors and the `shared` colors,
- colors of families up to `distance` steps away in the `borrow` direction(s).
- `order: cycle` wraps around, `sequence` doesn't.
- `borrow: none` = own + shared only.

Warning when `distance` makes every family reachable (e.g. `cycle` of 4 with `both` + `distance: 2`): the borrow rule then has no effect.

### Pair validation (warnings, pair excluded from themes)

- color outside the family's reach (names the owning family and its direction)
- ground/figure contrast below `color-rules.figure`
- tone combination listed in `color-rules.avoid`

Warnings rather than errors, so switching `borrow:` to test a variant never breaks the brand. It just shows which pairs fall out.

### Relation to `brand-colors` and guided mode

- `color-families` coexists with flat or grouped `brand-colors`. `shared:` refs point into it.
- `color-mode: guided` currently requires grouped `brand-colors` with `primary` and neutral `light`/`dark`. New: **either** that, **or** a `color-families` block with ≥ 2 families. When families exist, the guided engine uses them (Change 4); grouped groups/distribution are ignored for generation.

### Purpose selection

```
palette: family Winter        # this family's pairs (curated, or guided if dynamic)
palette: dynamic              # guided across the family selected in the editor
```

## Change 4 — Guided generation from families (`brand-atelier`)

New code path in `guidedColors.ts`, taken when `brand.colorFamilies` exists:

1. **Pool**: active family + reachable colors + shared.
2. **Enumerate** all ordered ground/figure pairs from the pool (Fehmarn: ≤ 18 × 17 ≈ 300).
3. **Filter** through `color-rules`.
4. **Weight**: curated pairs ×N (start N = 4), other valid pairs ×1.
5. **Pick** with the seeded RNG (`mulberry32`), derive the theme as in Change 1.

- Colors stay as declared (implicitly `strict`). LCh drift for families is out of scope for now.
- **Photo path**: pick the family whose core is nearest in hue to the photo (reuse `nearestIdentityGroup` logic), then choose figure + text from that family's pool for contrast against the photo zone.

## Change 5 — Pair test view (`brand-atelier`)

A fast way to judge colors without going through compositions. Mirrors the Figma combination frame.

### Where

- New `view=pairs` in the existing `?colors` playground (current grid becomes `view=pages`).
- Entry point: a "Color test" button in Sensei mode (Palette card), opening `?colors&view=pairs&brand={id}` in a new tab.
- Works for every brand. Without families it shows the pair themes and slot themes, checked against `color-rules`.

### Tile

A small square canvas per pair:
- background = ground
- logo in the figure color
- one headline + one body line in the resolved text color
- the two-circle swatch (outer circle = ground, inner dot = figure) as a legend
- below: hex values, ground/figure contrast, text contrast, tone classes, origin badge (`own` / `prev` / `next` / `shared`)

### Layout and controls

- One row per family, as in Figma. Or one row per theme for brands without families.
- **Source**: `curated` | `guided` (all valid pairs) | `rejected` (failed pairs, greyed, with reason)
- **Live overrides** of `order`, `borrow`, `distance` (URL params only, never written back to the `.brand` file). This makes testing the borrow config a click instead of an edit-reload cycle.
- Swatch-only toggle: circles on white, identical to the Figma frame, for side-by-side comparison.
- Click a tile → opens the editor with that theme applied.

## Implementation

### `brand-intent` repo

- `parser/brandParser.ts`: `ground`/`figure`/`text` keys and slot derivation; `color-rules` block; `color-families` block (roles, generated names, flat projection, reach, pair validation, distance warning); guided precondition change.
- Types: `ColorRules`, `ColorFamilies`, `ColorFamily`, `FamilyPair`, `ToneClass`; export a pure `reachableFamilies(order, borrow, distance, index)` helper and `contrastRatio`/`toneClass` so the app uses the same math.
- `SPEC.md`: three new sections next to `brand-colors` / `theme`; `palette: family <Name>` in the `.purpose` section.
- VS Code grammar: keywords `ground`, `figure`, `color-rules`, `color-families`, `family`, `pairs`, roles.
- Tests:
  - pair derivation, explicit override wins, text resolution incl. the fallback-to-white case
  - rules: threshold edges, `avoid`, warnings on slot-only themes
  - reach: cycle/sequence × previous/next/both/none × distance 1–2; sequence edges; "covers everything" warning
  - **synthetic fixtures**: a 4-family cycle with the Fehmarn values (all 28 Figma pairs must validate with `borrow: both`; `previous` must reject 5, `next` must reject 8), a 5-family sequence, a 6-family cycle with `distance: 2`
- Release via `/release-intent`.

### `brand-atelier` repo (after publish)

1. Bump `brand-intent`.
2. Consume derived pair themes. `PageColors` stays the target, so the renderer is unchanged.
3. Guided families path (Change 4) + `palette: family` in purpose resolution + family selector in the editor's Palette card.
4. Pair test view (Change 5).
5. **joschi → pair themes** as proof: 4 themes, ~60 lines → ~12, renders identical except the derived text tiers.
6. **Fehmarn rewrite**: replace the whole TSF palette (Baltic Blue, Raps, Camping, …) with `brand-colors` (`#0000F8` Fehmarn-Blau, `#FFFFFF` Weiss, state colors kept) + `color-rules` (4.5 / 3 / light+light, mid+mid) + `color-families` (4 seasons, 28 pairs, `borrow: both`). Remove `theme Basic`; update the purpose using `palette: Basic`. Color names are functional color descriptors, not imagery:

   | Season | core | accent | accent | contrast |
   |---|---|---|---|---|
   | Winter | `#006EFA` Blau | `#415C55` Graugruen | `#BCD6E2` Graublau | `#263410` Dunkeloliv |
   | Fruehling | `#B6E1FC` Hellblau | `#B5E5CB` Mint | `#F9FF9D` Hellgelb | `#0F4C5C` Petrol |
   | Sommer | `#F8EDAD` Sand | `#558648` Gruen | `#F4A14C` Orange | `#1A2E5C` Marine |
   | Herbst | `#FC5529` Rotorange | `#6F927E` Salbei | `#844A33` Rostbraun | `#4A2215` Dunkelbraun |
   | shared | `#0000F8` Fehmarn-Blau | `#FFFFFF` Weiss | | |

   Check logo SVGs against the new logo blue `#0000F8` (old: `#0324B1`).

## Out of scope

- Choosing the family by date (`palette: family auto`, month ranges). Comes with scheduled posts.
- LCh drift / `color-adherence` other than strict inside families.
- Figma variables sync of families.

## Rollout order

1. Spec + parser + tests in `brand-intent`, release.
2. App: bump, derivation, rules warnings surfaced in the console.
3. Pair test view (useful before the engine, to judge the Fehmarn rewrite).
4. Fehmarn rewrite + joschi conversion.
5. Guided families engine.

## Open questions

- Text tiers: alpha stops (85/70/55/40) or mixed tints toward ground? Alpha is simpler and stays linked to the primitive.
- Tone thresholds 1.8 / 4.5 classify all 16 Fehmarn colors plausibly (`#F4A14C` = mid at 2.1, `#558648` = mid at 4.3). Confirm with the designer's own sense of "Mittelton".
- Curated weight N in guided mode.

## Validation checklist

- [ ] All existing brands parse unchanged (realBrands test)
- [ ] joschi pair themes render identical apart from text tiers
- [ ] Fehmarn: 28 curated pairs valid with `borrow: both`, 5 rejected with `previous`, 8 with `next`
- [ ] Guided shuffle for Fehmarn never produces a pair from the opposite season or below 3:1
- [ ] Pair test view: overrides change the rejected set live without touching the file
