# Plan — Color tones and levels

Status: **concept, not approved.** No code until the user signs off on the open decisions at the end.

Bring the Fehmarn website colour model into Brand Intent as a general grammar, then into Brand Atelier. It replaces the data-only stopgap discussed on 2026-10-26 (swap contrast colours, rewrite pairs), which would have crammed a richer model into `color-families` pairs.

Source of the model: Figma library 🤖 Fehmarn Designsystem (`jXxMt7DxMYU70pflZEpJ7H`, sheet „Foundation“ 3073:2), export `fehmarn.de/docs/farben/library-colour.json`, write-up `fehmarn.de/docs/farben/refactor-colour-system.md` (state 2026-10-27, refactor done).

## Why

1. **One colour per role is too coarse.** Fehmarn's families declare `core`, `accent`, `contrast` as fixed hex values. The website works with a *Tonleiter* per colour (steps 10–98) and picks a step per use: Winter's darkest ground is A2 20, Autumn's is A2 10, Spring's text-on-pastel is A1 20. The fixed `contrast` colours (Dunkeloliv, Petrol, Marine, Dunkelbraun) are outdated: the designer replaced them with the dark steps of each season's own accents.
2. **A pair is only one intensity.** A ground/figure pair is effectively the strongest level. The website has four levels per family (Neutral, Light, Medium, Strong), each with the same slots filled with different tones. That is the abstraction the brand needs everywhere: "how much colour" independent of "which season".
3. **Not every context is a date.** Besides the four seasons the website has `Mono` (Fehmarn Blue only) and `Year-round` (the four primaries spread over the slots, no season leads). Both are chosen by hand, not by `from:`.
4. **Curated pairs don't scale.** 28 hand-picked pairs cover one level. Four levels × six contexts would mean 100+ pairs. A level × family table with per-family overrides says the same in about 30 lines and is checkable.

The foundation is medium-neutral: it never names a button, field, map or panel. Each application (website tokens, Atelier theme slots) maps its own parts onto level slots.

## The model

| Layer | What it is | DSL today | Proposed |
|---|---|---|---|
| Colours | Fehmarn Blue, White, Primary 1–4, Accent 1–2 per season | `brand-colors`, `color-families` roles | unchanged, `contrast` becomes optional |
| Tones | every colour on steps 10 … 98 (step = CIELAB L*) | none | `tones` block, reference `$name.step` |
| Contexts | Mono, Year-round, Winter, Spring, Summer, Autumn | `family` with `from:` | `family` without `from:` allowed alongside dated ones |
| Levels | Neutral, Light, Medium, Strong; 13 slots in four pairs | none | `levels` block with defaults + per-family overrides |
| Rules | contrast minimums, borrow rule, "from Medium up no Fehmarn Blue with season colours" | `color-rules`, `borrow` | `color-rules` checks every level slot pair |

Slots (same in every level): **Ground** · On Ground/Headline, /Text, /Accent, /Line, /Divider · **Contrast** · On Contrast · **Inset** · On Inset/Text, /Accent · **Signal** · On Signal.

## Change 1 — `tones`

```
tones
  steps:  10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 98
  method: lab-l            # step = CIELAB L*, hue and chroma from the anchor
  anchor: own              # the declared hex keeps its own lightness and stands for the nearest step
```

- Every solid colour in `brand-colors` and `color-families` gets a Tonleiter. Reference: `$fehmarn-blau.10`, `$winter-accent-2.95`. Inside a family, slot shorthands `p`, `a1`, `a2` refer to its own colours (`a2.95`).
- Explicit overrides per colour for steps the algorithm can't reach (Fehmarn: Blue 10 is `#000050`, L* 5):
  ```
  tones
    …
    fix $fehmarn-blau.10: #000050
  ```
- The algorithm must reproduce all 88 library tones exactly (fixture: `library-colour.json` → `modes.*.tones`). If it can't, the fallback is declaring the 11 hex values per colour.

## Change 2 — contexts without dates

- `from:` stays optional per family, but "all or none" is relaxed: families without `from:` are **hand-picked contexts** and never win `familyIndexForDate`.
- Borrowing ignores undated families (they are not on the cycle).
- Fehmarn adds `family Mono` (all slots Fehmarn Blue) and `family Year-round` (p = Primary 1, a1 = Primary 2, a2 = Primary 3; Signal uses `$primary-4.40` directly).
- `contrast:` becomes optional. Text resolution uses the level's `on-ground/text` when levels exist, else today's chain.

## Change 3 — `levels`

Defaults per level in slot shorthand, then overrides per family where the season differs. This table is the actual design decision: it was invisible in the old roles, and the levels make it visible.

```
levels
  level Neutral                        # holds only White and Blue, same for every family
    ground:              $weiss
    on-ground/headline:  $fehmarn-blau
    on-ground/text:      $fehmarn-blau.10
    …
  level Strong
    ground:              required      # the darkest tone differs per family, see below
    on-ground/headline:  a2.95
    on-ground/text:      $weiss
    on-ground/accent:    a1.80
    on-ground/divider:   p.80
    contrast:            a2.90
    on-contrast:         strong.ground # reference to another cell, changes in one place
    inset:               a2.95
    on-inset/text:       strong.ground
    …

family Winter
  …
  signal: a1.40 / $weiss               # Signal pair, same in every level for now
  level Strong
    ground: a2.20

family Summer
  …
  signal: a2.70 / a1.20
  level Strong
    ground:             a1.20
    on-ground/headline: p.98           # yellow instead of apricot (user, 2026-10-27)
    contrast:           p.95
    inset:              p.98
```

(Values from the Strong table in the refactor doc: the four seasons share most slot choices, the darkest tone and Summer's light tones are the exceptions.)

- `required` marks a slot every family must set. Unknown slots are errors; every level must resolve all 13 slots for every family (inherit from default, then override).
- Values: slot shorthand, `$ref`, `$ref.step`, `#HEX`, or a cell reference `<level>.<slot>` (as the library's `Levels/*` variables alias `Levels/Strong/Ground`). No alpha.
- `color-rules` checks each pair (On X on X) for every level × family and reports **warnings** with the cell (`Winter / Light / on-ground/accent on ground 4.2:1 < 4.5`).
- New rule key, suggested: `exclusive: $fehmarn-blau from Medium`. That is, no level from Medium up may hold Fehmarn Blue together with a family colour.

## Change 4 — Atelier: page = family × level

The theme slots of a page follow from the level slots. One mapping, written once per brand (default below, overridable in the `.brand` file):

| Atelier slot | Level slot |
|---|---|
| `background` | ground |
| `text-primary` (tiers by alpha, as today) | on-ground/text |
| headline colour (new slot `text-headline`, optional) | on-ground/headline |
| `logo`, `icon`, `illustration` | on-ground/accent |
| `divider` | on-ground/divider |
| `cta`, `label-bg`, `counter-bg` | contrast |
| `label-fg`, `counter-fg` | on-contrast |
| `sticker-bg` / `sticker-fg` | signal / on-signal |

- A purpose gets `palette: level Medium` (family = in-season or picked), combinable with today's `palette: family Winter`.
- The editor's Palette card gets a level switch next to the family selector. Shuffle moves within the chosen family × level instead of across pairs.
- **Curated pairs stay optional.** A brand with `levels` can drop `pairs`. If pairs remain, they are checked against the levels (a pair whose colours don't appear in any level of that family gets a warning).

## Consequences

### `brand-intent`

- `SPEC.md`: new sections `tones` and `levels` next to `color-families` (409); `color-families` (relaxed `from:`, optional `contrast`, shorthands); `theme` (462: derived slots from levels); `color-mode` (366: `brand` satisfied by levels); `palette: level` in the `.purpose` section (1070).
- `parser/colorSystem.ts`: tone generation and lookup, level resolution (defaults → family override), rule checks per cell, `familyIndexForDate` skips undated families, `reachableFamilies` skips undated families. `checkFamilyPair`/`colorOrigin`: reach check against level colours.
- `parser/brandParser.ts`: blocks `tones`, `levels`, `level`, `fix`; family key `signal:`; `$name.step` and `<level>.<slot>` references.
- VS Code grammar: new keywords, `.step` references.
- Tests: tone fixture against the library export (88 values); level fixture (13 slots × 4 levels × 6 families against `library-colour.json` `level.modes` resolved per season, 1,224 CSS values already checked once in fehmarn.de); rule warnings; undated families; all existing brands parse unchanged.

### `brand-atelier`

- `app/src/colorFamilies.ts`: `familyShuffle`, `familyColorsForPhoto`, `seasonalIconPair` work on family × level; photo fallback stays.
- `ColorPaletteSection.tsx`, `ColorModeInfo.tsx`: level switch, family list including Mono and Year-round.
- `routes/ColorPairsRoute.tsx` (`?tools=pairs`): becomes a level table view (rows = families, columns = levels, each cell a tile), matching sheet 3073:2.
- `app/public/brands/fehmarn/fehmarn.brand`: rewrite colours as `tones` + `levels` + 6 families; drop the old contrast colours and the level-3 pairs; `photo-fallback` stays.

## Rollout

1. User signs off this plan (decisions below).
2. brand-intent: tones, then levels, then rules and SPEC; fixtures from `library-colour.json`; release.
3. Atelier: bump, derive page colours from family × level, level switch, table view.
4. `fehmarn.brand` rewrite; visual check against Figma sheet 3073:2 and the fehmarn.de styleguide (same values by construction).
5. Later: read the export directly (`tokens: figma` or an import script) instead of copying values by hand.

## Open decisions (user)

1. **Levels for posters and social.** Recommendation: yes. Strong ≈ today's pairs, Medium/Light give quieter pages; same four levels as the website.
2. **Context by date or by hand.** Recommendation: both. Seasons by date (default), Mono and Year-round by hand per page or purpose.
3. **Curated pairs.** Recommendation: drop them for Fehmarn once levels exist. The level table is the curation. Keep `pairs` in the grammar for brands without levels.
4. **Tone notation.** `$winter-accent-2.95` / `a2.95` (proposed) vs. `$winter-accent-2 95` (collides visually with alpha `$ref 75%`).
5. **Generate or declare tones.** Generate with fixed exceptions (proposed) vs. declare all hex values (88 lines for Fehmarn, no algorithm to maintain).

## Out of scope

- Brand-identity part names beyond the Atelier slot mapping (poster ground, sticker, info box): later, on top of levels.
- A fifth, stronger level (the model leaves room for it).
- Live Figma sync.
