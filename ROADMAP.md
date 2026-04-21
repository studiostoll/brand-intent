# Brand Intent — Roadmap

Proposed DSL extensions. Not commitments — ideas parked with enough context to pick them up later.

For completed, released changes see the git history and [SPEC.md](SPEC.md).

---

## Proposed: Per-theme typography overrides via `mode` blocks

**Status:** proposed, not scheduled. Motivated by Studio Stoll's Terminal theme (in `brand-atelier`) where the entire typography stack switches to IBM Plex Mono at a flat weight — while Light / Dark / Vibrant share identical typography.

**Problem:** theme blocks today express colors only. There is no way to say "this theme swaps the font family and flattens weights site-wide." Authors either duplicate every `typography` block per theme (verbose, drift-prone) or rely on CSS overrides outside the DSL (breaks the "DSL is the source of truth" promise).

**Non-goal:** making per-theme typography the default case. For most brands, typography is shared across themes and only colors differ. A per-theme override is an outlier — when it exists at all, usually for one theme out of several (e.g. Terminal).

### The shape (option D from the design conversation)

A new top-level `mode` block, parallel to `theme`, matched by name:

```yaml
theme Terminal               # colors only (unchanged)
  background: $black
  text-primary: $phosphor
  ...

mode Terminal                # typography overrides, attached by matching name
  font:   $secondary         # every typography renders with this font
  weight: 400                # every typography's weight AND strong pin to this
```

**Semantics:**

- `mode` blocks are optional. A theme with no matching `mode` behaves identically to today.
- `mode NAME` must match an existing `theme NAME` — unmatched modes are a hard parser error.
- When a mode is active, its `font:` overrides every `typography` block's `font:`. No per-typography opt-out.
- `weight:` in mode pins **both** `weight` and `strong` across all typography blocks. (If later we need finer control, split into `weight:` + `strong:` keys — but the Terminal use case wants the flat-weight effect, and splitting now would over-engineer.)

### Rejected alternatives

- **Mixing typography into `theme` blocks** — conflates two orthogonal axes (color vs. type). "Theme" is already established as the color-slot block; muddying it would complicate the mental model for every brand that doesn't need type overrides.
- **Named typography variants (`typography-set Terminal`)** — forces authors to duplicate eight typography blocks per theme. Doesn't match the author's actual intent ("switch the font site-wide"), which is one declarative override, not eight restylings.
- **Nested `preset` blocks** containing both theme and typography — introduces a new nesting depth the DSL doesn't have anywhere else. Parser complexity jumps for a rare case.

### Open questions before implementation

1. Any knobs beyond `font:` and `weight:`? Candidates: `letterSpacing`, `lineHeight`. Keep it minimal at v1 and grow by demand.
2. Should `mode` also override the label/cta badge radius or padding? Probably not — those already have dedicated `label:` / `cta:` blocks and are colour-independent. Leave them alone.
3. Name — `mode` reads well in the UI domain (light mode, compact mode). If a better name surfaces in discussion, swap before release.

### Scope of work when picked up

- `parser/brandParser.ts`: parse `mode NAME` blocks into `ParsedBrand.modes: Record<string, { font?, weight? }>`. Hard error on unmatched name. Existing behaviour unchanged when no mode block is present.
- `SPEC.md`: new section "Mode blocks (typography overrides)".
- VSCE grammar: highlight `mode` header and indented keys.
- Consumers (`brand-atelier`): `resolveTypography(style, theme, mode?)` applies mode override on top of the typography's own values at the render layer. Two call paths — canvas and screen-service.
- Example brand: add a `mode` block to the krume example to document the pattern.
- Bump minor (0.x release — pre-1.0 allows breaking changes, but this one is additive and backwards-compatible).

Until then: brands that need a typographic variant theme (like Studio Stoll's Terminal) can only approximate it with per-page CSS or live with the shared typography.
