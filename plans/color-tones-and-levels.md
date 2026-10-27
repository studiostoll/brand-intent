# Plan — Color tones and levels

Status: **approved 2026-10-27.** All five decisions signed off (see the end).

Bring the Fehmarn website colour model into Brand Intent as a general grammar, then into Brand Atelier. It replaces the data-only stopgap discussed on 2026-10-26 (swap contrast colours, rewrite pairs), which would have crammed a richer model into `color-families` pairs.

Source of the model: Figma library 🤖 Fehmarn Designsystem (`jXxMt7DxMYU70pflZEpJ7H`, sheet „Foundation“ 3073:2), export `fehmarn.de/docs/farben/library-colour.json`, write-up `fehmarn.de/docs/farben/refactor-colour-system.md` (state 2026-10-27, refactor done).

## Source of truth

**Now:** the website design system, Figma library 🤖 Fehmarn Designsystem (`jXxMt7DxMYU70pflZEpJ7H`, collections Primitives, Season, Level). It is exported by `fehmarn.de/scripts/figma/export-colour.js` to `fehmarn.de/docs/farben/library-colour.json`. One export feeds every place: the fehmarn.de styleguide and prototype (`prototyp/_src/build.py`), and Brand Intent / Atelier (import script, see Change 1). Only the foundation is imported (Primitives, `Tones/*`, `Levels/*`, Level modes), never the website tokens.

**Temporary.** The user (2026-10-27) may later split this into a foundation file holding only the foundation, plus one design system per touchpoint or usage context (website, print/social, …) that references it. That is too much overhead for now. So the import takes the export path as a parameter and reads only foundation sections; when the foundation moves, only the export source changes.

**Sync state 2026-10-27:** a fresh export from the library matches the committed `library-colour.json` (tones, level cells per season, primitives identical; Level and Tokens identical except the variable order in the panel). `build.py` produces no diff; the online styleguide (fehmarn.stoll.studio/website/styleguide, Vercel `fehmarn-website-prototyp`) runs that commit (`69593e5`). Brand Atelier is the only place still out of sync (next section).

**Replaced source (Atelier, for later context):** until now `brand-atelier/app/public/brands/fehmarn/fehmarn.brand` took its colours from the Identity Deck's Farbkreislauf (Figma „Fehmarn Visuelle Sprache“ `SK2VRgJCOqQJOnLDny9g4i`, rule 05), before the Tonleiter existed: per season `core` + two `accent` + a fixed `contrast` colour (Dunkeloliv `#263410`, Petrol `#0F4C5C`, Marine `#1A2E5C`, Dunkelbraun `#4A2215`), 28 hand-picked ground/figure pairs (7 per season), and `blau-mittel #0000B4` / `blau-dunkel #000050` as extra brand colours. The user called the fixed contrast colours outdated (2026-10-26): the dark tones of each season's own colours replace them. This state is archived in `brand-atelier/archive/brands/fehmarn-2026-10/`. The `figma-file-key: Gqmk0F06tocZCcUC2ntzki` in that file is unused (`tokens: inline`). The import replaces the colour block; it doesn't merge with it.

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

The Tonleiter is declared, not generated. The colour system already defines every tone (Figma library, export `library-colour.json`); Brand Intent reads them instead of computing them again, so Figma stays the only source of truth.

```
tones                        # imported from library-colour.json, don't edit by hand
  steps: 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 98
  $fehmarn-blau:    #000050 #0000b4 #0000f8 #3d3dfa #6363fb #8383fc #a2a2fc #c1c1fd #e0e0fe #efefff #f9f9ff
  $winter-accent-1: #05201a #1b352f #314c45 #415c55 …
  …
```

- One line per solid colour in `brand-colors` and `color-families`, one hex per step, in the order of `steps:`. The colour's own hex must appear on its line (the anchor); the parser checks that.
- Reference: `$fehmarn-blau.10`, `$winter-accent-2.95`. Inside a family, slot shorthands `p`, `a1`, `a2` refer to its own colours (`a2.95`).
- Import script (in brand-intent, `scripts/`): reads `library-colour.json` `modes.*.tones`, writes the `tones` block for the 13 Fehmarn colours (143 values). Change in Figma → export → import.
- Checked 2026-10-27: the export is consistent (each season colour's Tonleiter is CIELAB L* steps, Blue is a mix with white plus hand-set 10 and 20), but Brand Intent doesn't need to know that.

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
- `parser/colorSystem.ts`: tone lookup, level resolution (defaults → family override), rule checks per cell, `familyIndexForDate` skips undated families, `reachableFamilies` skips undated families. `checkFamilyPair`/`colorOrigin`: reach check against level colours.
- `parser/brandParser.ts`: blocks `tones`, `levels`, `level`; family key `signal:`; `$name.step` and `<level>.<slot>` references.
- VS Code grammar: new keywords, `.step` references.
- Tests: import script against the library export (143 values, anchors on their lines); level fixture (13 slots × 4 levels × 6 families against `library-colour.json` `level.modes` resolved per season, 1,224 CSS values already checked once in fehmarn.de); rule warnings; undated families; all existing brands parse unchanged.

### `brand-atelier`

- `app/src/colorFamilies.ts`: `familyShuffle`, `familyColorsForPhoto`, `seasonalIconPair` work on family × level; photo fallback stays.
- `ColorPaletteSection.tsx`, `ColorModeInfo.tsx`: level switch, family list including Mono and Year-round.
- `routes/ColorPairsRoute.tsx` (`?tools=pairs`): becomes a level table view (rows = families, columns = levels, each cell a tile), matching sheet 3073:2.
- `app/public/brands/fehmarn/fehmarn.brand`: rewrite colours as `tones` + `levels` + 6 families; drop the old contrast colours and the level-3 pairs; `photo-fallback` stays.

## Rollout

1. User signs off this plan (decisions below).
2. brand-intent: tones (declared + import script), then levels, then rules and SPEC; fixtures from `library-colour.json`; release.
3. Atelier: bump, derive page colours from family × level, level switch, table view.
4. `fehmarn.brand` rewrite; visual check against Figma sheet 3073:2 and the fehmarn.de styleguide (same values by construction).
5. Later: the same import for levels (the level table from `level.modes`), so the whole colour block comes from the export.

## Decisions (user, 2026-10-27)

1. **Levels for posters and social:** yes, all four (Neutral, Light, Medium, Strong). Page = family × level.
2. **Context:** both. Seasons by date (default), Mono and Year-round by hand per page or purpose.
3. **Curated pairs:** dropped for Fehmarn once levels exist; `pairs` stays in the grammar for brands without levels.
4. **Tone notation:** dot. `$winter-accent-2.95`, inside a family `a2.95`; alpha stays `$ref 75%`.
5. **Tones:** declared, written by an import script from `library-colour.json`. No generator in Brand Intent: the colour system already defines them.

## Out of scope

- Generating tones (`method: lab-l`, `mix`) for brands without a Tonleiter of their own. Possible later; the check against the library showed it would reproduce Fehmarn exactly.

- Brand-identity part names beyond the Atelier slot mapping (poster ground, sticker, info box): later, on top of levels.
- A fifth, stronger level (the model leaves room for it).
- Live Figma sync.
