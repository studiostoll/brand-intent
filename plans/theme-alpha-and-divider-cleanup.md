# Plan — Theme alpha syntax + divider cleanup

Two grammar changes shipped together in one `brand-intent` release.

## Why

1. **Theme slots need alpha.** Real-world brands express text/border/divider color as `base @ alpha` (see stoll.studio: five alpha stops per theme). Today the DSL has no way to do this that preserves the link to the primitive. Authors write raw `rgba(...)` literals, which break the `$ref` chain and the Tokens Studio round-trip.

2. **`divider.color:` is a vestigial indirection.** Every brand in brand-atelier (12 divider definitions, 6 brands) writes `color: divider`. The field exists but there is no meaningful use of it — the theme's `divider` slot is the right place to declare divider color. The field adds noise and a degree of freedom nobody needs.

## Change 1 — Alpha syntax in theme slots

### Grammar

```
theme Vibrant
  background:     $vibrant-bg
  text-primary:   $paper
  text-secondary: $paper 75%
  text-tertiary:  $paper 60%
  divider:        #FFFFFF 30%
```

Pattern:

```
<value> <alpha>%
```

Where:
- `<value>` is either `$ref` (brand-color primitive name) or `#HEX` (3, 6, or 8-digit hex).
- `<alpha>` is a number, 0–100. Integer or decimal (e.g. `12.5%`). 100% is allowed but redundant.
- Exactly **one space** between value and alpha token. `$paper75%`, `$paper/75%`, `$paper@75%` are all parser errors.
- A missing alpha suffix = solid color (backwards compatible — existing `.brand` files continue to parse).

### Resolution

1. Parser resolves `$ref` to the brand-color primitive's hex (existing logic at [brandParser.ts:404-412](../parser/brandParser.ts#L404-L412)).
2. If an alpha suffix is present, convert resolved hex + alpha to `rgba(r, g, b, alpha/100)`.
3. If alpha is exactly `100%`, emit solid hex (not rgba) — keeps output clean and identical to pre-change behavior for that case.
4. Store the computed rgba/hex string on the theme slot, same shape as today. No downstream changes needed.

### Hard errors

| Condition | Error message |
|---|---|
| Alpha in `brand-colors` block | `brand color "<name>" must be a solid hex — alpha syntax is only allowed in theme slots` |
| Alpha suffix with no base value (e.g. `  text-muted: 50%`) | `theme slot "<slot>" has alpha suffix without a base color` |
| Alpha out of range (< 0, > 100) | `theme slot "<slot>" alpha must be between 0 and 100, got <value>` |
| Malformed alpha (no `%`, non-numeric) | `theme slot "<slot>" alpha suffix must be a number followed by %, got "<raw>"` |

### Why not allow `0.75` decimals

Decimals look like a numeric primitive (think spacing/typography). Percentages read as "opacity" to any designer. Enforcing `%` keeps the DSL visually distinct and self-documenting. One notation, no ambiguity.

## Change 2 — Drop `color:` on dividers

### Grammar

Today:

```
divider ruler
  thickness: 0.8
  width: 20%
  color: divider        # always this
  align: left
  spacing: m
```

After:

```
divider ruler
  thickness: 0.8
  width: 20%
  align: left
  spacing: m
```

Divider color **always** resolves from the active theme's `divider` slot. The `divider` theme slot is already a required part of the 13-slot theme contract, so no new declaration burden.

### Hard errors

| Condition | Error message |
|---|---|
| `color:` key inside a `divider` block | `divider "<name>": color is no longer configurable. Remove the "color:" line — divider color is sourced from the theme's "divider" slot.` |

No migration window, no deprecation warning. The user asked for a hard error. Every current brand writes `color: divider` anyway, so the migration is a trivial search-and-delete.

## Implementation

### `brand-intent` repo

1. **[parser/brandParser.ts](../parser/brandParser.ts)**
   - Extend the theme-slot branch ([L207-223](../parser/brandParser.ts#L207-L223)) to:
     - Detect ` NN%` suffix after the value.
     - Resolve `$ref` → hex first, then apply alpha → rgba.
     - Validate alpha range, emit hard error on violation.
   - Extend the brand-colors branch ([L185-206](../parser/brandParser.ts#L185-L206)) to:
     - Reject any value containing `%` or `rgba(` — hard error.
   - Extend the divider branch (the `activeBlock === 'divider'` handler):
     - If `key === 'color'`, throw hard error with the migration hint above.
   - Remove `color` from the `DividerDef` type (or mark it derived-at-render-time only).

2. **[parser/types.ts](../parser/types.ts)** — drop `color` from divider shape. Keep `resolveDividerColor()` signature in downstream consumers (brand-atelier) but have it always take the theme's `divider` slot. Or delete it entirely — see "Consumer migration" below.

3. **[SPEC.md](../SPEC.md)** — document the alpha syntax under Theme Slots, and remove `color:` from the Divider section. Add a "Migration" subsection.

4. **[vscode-extension/syntaxes/](../vscode-extension/syntaxes/)** — update tmLanguage grammar:
   - Add pattern for `$ident NN%` and `#HEX NN%` in theme slots (highlight alpha as `constant.numeric`, `%` as `keyword.operator`).
   - Remove `color:` from divider block completions / highlights.

5. **[examples/](../examples/)** — update example brands to use new syntax.

6. **[package.json](../package.json)** — bump to next minor (e.g. `0.4.0` if currently `0.3.x`). This is a breaking change for the divider `color:` field, so arguably major — but brand-intent is pre-1.0, so minor is acceptable per semver rules for 0.x.

### `brand-atelier` repo (after publish)

1. Bump `brand-intent` dep in [app/package.json](../../brand-atelier/app/package.json).

2. **Migrate every `.brand` file:**
   - Remove `color: divider` (and any other divider `color:` lines) from all 6 brands' `.brand` files.
   - Rewrite studio-stoll's rgba-literal theme slots to `$paper NN%` / `$phosphor NN%` syntax.

3. **[app/src/colors.ts](../../brand-atelier/app/src/colors.ts)** — simplify `resolveDividerColor()`: always return `colors.divider` (the theme slot). Drop the `def.color` parameter at call sites (see [PageRenderer.tsx:704](../../brand-atelier/app/src/components/PageRenderer.tsx#L704), [canvasRenderer.ts:460](../../brand-atelier/app/src/canvasRenderer.ts#L460), [export.ts:1158](../../brand-atelier/app/src/export.ts#L1158), [export.ts:1817](../../brand-atelier/app/src/export.ts#L1817)). Or delete the function and inline the lookup.

4. **Smoke-test all 6 brands** — load each in dev, run through compositions, visually verify dividers still render. Run `/audit` to catch anything missed.

## Out of scope

- **Named alpha primitives** (e.g. `white-75` as its own brand-color) — explicitly rejected by user: brand colors are solid only.
- **Alpha in slot-level color refs** inside compositions or typography (none exist today).
- **Tokens Studio / tokens.json export** — the emit path reads resolved theme slots, so rgba strings work as-is. If later we want to preserve the `$paper 75%` semantic in the export, that's a separate task.
- **Other syntax variants** (`@`, `/`) — one notation, one space, `%`. Keep it tight.

## Rollout order

1. Implement + test in brand-intent (this plan).
2. Publish `brand-intent@0.X.0`.
3. Migrate brand-atelier in one PR: dep bump + all 6 brand files + `resolveDividerColor` simplification. Everything breaks until this lands, so it's atomic.
4. Update [brand-atelier/app/CLAUDE.md](../../brand-atelier/app/CLAUDE.md) "Important Conventions" section to document the new alpha syntax + removed divider `color:` field.
5. Update `/onboard-brand` skill to teach the new syntax (it currently writes `color: divider` in every divider block).

## Validation checklist

- [ ] Alpha in brand-colors block → hard error with clear message
- [ ] Alpha malformed (missing `%`, bad range) → hard error
- [ ] `$ref` + alpha resolves correctly to rgba
- [ ] `#HEX` + alpha resolves correctly to rgba
- [ ] 100% alpha emits solid hex, not rgba
- [ ] No alpha suffix → existing behavior unchanged (regression safety)
- [ ] `color:` in divider block → hard error
- [ ] All 6 brand-atelier brands load clean after migration
- [ ] Exports (PNG, PDF) render dividers identically before/after
- [ ] VS Code extension highlights new syntax
- [ ] SPEC.md documents both changes
- [ ] `/onboard-brand` skill updated
