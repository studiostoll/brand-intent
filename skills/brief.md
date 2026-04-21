---
description: Generate a portable markdown brand brief from Brand Intent DSL files
---

# Brief

**Scope:** `$ARGUMENTS`

> If `$ARGUMENTS` is empty: auto-detect the active brand from the current working directory (see File Discovery in the Brand Intent skill) and generate its brief.
> If `$ARGUMENTS` names a brand id (e.g. "krume", "studio-stoll"): locate that brand folder under the current working directory and generate its brief.
> If no brand is found: tell the user to run `/brand-intent onboard` (or `npx brand-intent init` to scaffold the Krume example) and stop.

You are generating a **portable brand brief** — a single markdown file, `{brand-id}-brief.md`, written at the brand root. The brief is format-agnostic: it can be dropped into any tool that doesn't read Brand Intent files directly — a Claude Design project, another LLM, a human collaborator.

The brief is **derived**, not authored. Every value comes verbatim from the DSL files. You never rephrase, interpret, or invent.

## When to Regenerate

The brief is a snapshot. Regenerate it after any change to `.identity`, `.brand`, `.purpose`, `.format`, or `.composition` files. The header always stamps the generation timestamp and the Brand Intent DSL version so stale briefs are detectable.

## Procedure

1. **Resolve the brand root.** Find the folder containing both `{brand-id}.identity` and `{brand-id}.brand`. If either file is missing, stop and tell the user to run `/brand-intent onboard`.

2. **Read the required files.**
   - `{brand-id}.identity` — strategic layer
   - `{brand-id}.brand` — derived expression layer

3. **Read optional files if present.** Each becomes a labeled optional section in the brief. If absent, omit the section entirely — do not emit empty headers.
   - `{brand-id}.purpose` at brand root (rare)
   - any files under `purposes/` (multiple allowed)
   - any files under `formats/`
   - any files under `compositions/`

4. **Read the Brand Intent DSL version.** Try resolving the installed `brand-intent` package's `package.json` version. If unreachable (the skill runs in a harness, not always inside the brand-intent repo), use `"unknown"`.

5. **Compose the brief** per the template below. Extract values verbatim — never rephrase or interpret. If a field is absent in the DSL, omit its row; never invent.

6. **Auto-derive the Guardrails section** from `.identity`:
   - every item in `voice.never`
   - every item in `voice.always`
   - `pillars.avoid` list
   - every `anti-audience` block (label + description)

   The Guardrails *section in the brief* is derived. Never add a `guardrails:` block to the DSL — guardrails live inside `.identity` already.

7. **Write the file.** Output path: `{brand-root}/{brand-id}-brief.md`. If the file exists, confirm overwrite in one line before proceeding.

8. **Report.** Print one line: `Wrote {path}. Regenerate after any DSL change.`

## Output Template

Write exactly this structure. Each section includes a one-line **role description** so the brief self-documents when pasted into any context.

```markdown
# {Brand Name} — Brand Brief

> Portable brief derived from Brand Intent DSL files.
> Brand Intent version: {version} · Generated: {ISO timestamp}
> Source of truth lives in the DSL files. Regenerate after any DSL change.

## Essence
_Role: the irreducible truth of the brand._

{identity.essence}

## Promise
_Role: what the brand commits to deliver._

{identity.promise}

## Positioning / Mission / Vision / Tagline / Archetype
_Role: strategic frame. Only rows that exist in the identity are emitted._

- **Positioning:** {...}
- **Mission:** {...}
- (etc. — skip any row whose field is absent)

## Narratives
_Role: the brand's stories. The primary narrative is the default story._

- **{name}** (primary) — {text}
- **{name}** — {text}

## Voice
_Role: how this brand sounds._

- **Register:** {voice.register}
- **Persona:** {voice.persona}
- **Rhythm:** {voice.rhythm}

## Values
_Role: behavior statements, not keywords._

- **{name}** — {behavior}

## Content Pillars
_Role: what the brand talks about, and what it avoids._

- **Primary:** {pillars.primary}
- **Secondary:** {pillars.secondary}
- **Avoid:** {pillars.avoid}

## Audiences
_Role: who the brand speaks to._

For each audience segment in `.identity`:

- **{label}**
  - Profile: {...}
  - Motivation: {...}
  - Language guidance: {...}

## Expression (from .brand)
_Role: derived expression conditions — the "how it looks and sounds" layer, not expression itself._

- **Language / locale:** {brand.language} / {brand.locale}
- **Color primitives:** list each `brand-colors` entry as `name → hex`
- **Themes:** list each theme with its slot-to-color mappings
- **Typography styles:** for each named style — font, weight, size (always append unit `cqh` — container-query-height, responsive to the canvas height), lineHeight, letterSpacing, flags like `uppercase`, autofit-min/max if present
- **Fonts:** for each font block — name, source, variants
- **Spacing scale:** unit + named steps (e.g. `cqmin` — container-query-min, responsive to the shorter canvas side; xs/s/m/l/xl)
- **Dividers:** if present, list each
- **Voice constraints:** `sentence-max`, `headline-pattern`, `number-format`, `register` (if absent in `.brand`, note "not declared" — do not omit the row)

## Guardrails (auto-derived)
_Role: hard rules any generator, agent, or reviewer must enforce._

**Never:**
- {each voice.never item}

**Always:**
- {each voice.always item}

**Avoid topics:**
- {each pillars.avoid item}

**Anti-audiences:**
- **{label}** — {description}

## Purposes (optional)
_Role: content types — what each piece of content is trying to do. Only emitted if any `.purpose` files are present._

For each purpose, emit **glossed** tags — not verbatim DSL values:

- **{id}** — {name}
  - Compositions: {composition ids}
  - **Density:** gloss the value — `light` = "minimal slots filled, headline-forward"; `medium` = "balanced slot fill"; `full` = "all slots populated". Emit as `{value} — "{gloss}"`.
  - **Palette:** gloss — `dynamic` = "inherits theme colors at render time"; `fixed` = "uses a specific theme"; other values pass through verbatim.
  - **Uses photo:** translate `camera:` field — `true` → "yes"; `false` → "no". Do not emit "camera: false".
  - **Logo:** gloss — `text` = "wordmark (text logo)"; `mark` = "graphic mark"; other values pass through verbatim.
  - Scope: {scope audience + pillars}
  - Context: {context prose per slot}
  - Slots: for each slot — id, typography, maxLength, samples. Omit `color:` references (theme-internal detail). Override hints (`hyphenate`, `textAlign`) pass through as-is.

## Formats (optional)
_Role: where content appears. Only emitted if any `.format` files are present._

For each format, label axes and units explicitly:

- **{id}** ({label} {sublabel}) — category: {category}
  - **Size:** {width} × {height} px
  - **Grid:** {rows} rows × {cols} cols — always state which number is which. The DSL writes `grid: ROWS COLS`.
  - **Danger zone:** {top} {right} {bottom} {left} px (platform UI overlay insets)
  - **Crop:** {top} {right} {bottom} {left} px, or "none"
  - **Comfort zone:** {value}% inset from the usable area

## Compositions (optional)
_Role: spatial arrangement of slots. Only emitted if any `.composition` files are present._

For each composition, gloss the layout mode and decode positioning tokens:

- **{id}** ({name})
  - **Mode:** gloss — `flow` = "sequential vertical stack of slots with tunable spacers between them"; `grid` = "2D cell placement on the format grid". Emit as `{mode} — "{gloss}"`.
  - **Image:** if present, state whether it's full-bleed or panel-scoped (`full` → "full-bleed background", other values pass through).
  - **Sticky bar:** translate `sticky: top m` as "pinned to top edge, size/padding `m` (from spacing scale)"; list each item (e.g. `label left`, `logo right`) with position noted.
  - **Flow:** emit the raw flow string for precision, then a one-line prose gloss describing what the layout visually produces. Decode tokens:
    - `spacer-xs/s/m/l/xl` — spacer using the named step from the spacing scale
    - `spacer-auto` — flexible spacer that absorbs remaining space
    - `{slot} left/center/right` — slot with its text alignment
    - `panel {anchor} {width} {height}` — a constrained panel anchored to an edge or corner (e.g. `panel bottom-left 2/3 1/1` = "panel anchored to bottom-left, 2/3 canvas width × full canvas height")
    - `split {edge} {fraction}` — the canvas is split at the given edge and fraction (e.g. `split bottom 1/2` = "canvas split horizontally, content occupies bottom half")
    - `divider-{name}` — references a divider style from `.brand`
    - `columns:N gap:{size}` — the slot renders as N columns with the named gap

---
Generated by `/brief` from brand-intent v{version}. To change anything in this brief, edit the DSL files and regenerate.
```

## Rules

- **No rephrasing.** Values are extracted verbatim from the DSL files.
- **No interpretation.** If a field is ambiguous, emit it as-is; don't explain it.
- **Omit absent optional sections entirely.** No empty headers, no "none" placeholders.
- **Never add `guardrails:` to the DSL.** The Guardrails section in the brief is always derived from existing `.identity` fields.
- **Never invent.** If `voice.always` is empty, the Always list is empty. Don't fill gaps.
- **Claude Design is an example, not a dependency.** This brief works anywhere. Don't phrase it as Claude-specific.
