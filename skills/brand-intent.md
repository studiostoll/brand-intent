---
description: Generate and validate on-brand content using Brand Intent files
---

# Brand Intent

**Scope:** `$ARGUMENTS`

> If `$ARGUMENTS` names a purpose (e.g. "daily-bread", "event", "quote"): compose context from the five layers and generate content for that purpose.
> If `$ARGUMENTS` is "validate": read the most recent generated or provided content and run the validation checklist against the brand files.
> If `$ARGUMENTS` is empty: discover all `.identity`, `.brand`, `.purpose` files in the project, summarize the brand voice and list available purposes.

You are working in a project that uses **Brand Intent**, an open file format for encoding brand identity, expression intent, and content composition rules across five composable layers. This skill teaches you how to read, compose, and validate Brand Intent files.

## The Five Layers

Brand Intent distributes brand knowledge across five independent file types. Each answers one question:

| Layer | File | Question | Changes |
|-------|------|----------|---------|
| **Identity** | `.identity` | Who is this brand? | Rarely (strategy) |
| **Brand** | `.brand` | What expression intent does it derive? | Occasionally (design) |
| **Format** | `.format` | Where does this content appear? | When platforms change |
| **Purpose** | `.purpose` | What is this content trying to do? | When content types evolve |
| **Composition** | `.composition` | How are elements composed? | Reusable across brands |

The arrow between layers is a **derivation arrow**: Identity contains reasoning. Brand derives expression intent from that reasoning. Format, Purpose, and Composition condition specific acts of expression without repeating what upstream layers establish.

```
Identity → Brand → Format → Purpose → Composition
```

## How to Read Each Layer

### `.identity`: Strategy (no visual properties)

**Required:** essence, promise, voice (register, persona, rhythm, always/never), pillars, audience segments.

**Optional:** tagline, positioning, mission, vision, archetype, narrative, values (with behavior statements), anti-audience segments.

**The `always`/`never` construct is your primary guardrail.** These are concrete, testable rules. When generating or reviewing content, check every item in `never:` and confirm every item in `always:`. They are not suggestions; they are constraints.

**`values`** are not just keywords; each has a behavior statement that describes how it manifests. Use these to inform decisions when voice rules don't cover a situation.

**`anti-audience`** segments define who the brand is explicitly *not* for. Never generate content that sounds like it's addressing an anti-audience. This is as important as `voice.never`.

**`positioning`** gives the competitive frame: what the brand is the only one of. Use this when the content needs to differentiate.

**Does NOT contain:** hex values, font names, type sizes, spacing, composition rules, or any visual properties.

### `.brand`: Derived Expression Intent

Contains: color primitives, semantic themes, font definitions, named typography styles, `voice-constraints` (operationalized voice parameters), `content-defaults`, spacing, divider styles.

**`voice-constraints`** are production-enforceable limits derived from identity voice reasoning:
- `sentence-max:` maximum words per sentence. Enforce this.
- `headline-pattern:` structural pattern for headlines (e.g., `noun-first`, `verb-first`).
- `number-format:` `cardinal` means write "drei" not "3".
- `register:` must match the identity register.

**Does NOT contain:** identity reasoning, audience definitions, strategic prose, composition rules.

### `.format`: Canvas Definition

Contains: platform, dimensions, safe zones (danger/crop/comfort), grid, allowed purposes.

**You rarely need this directly** unless generating content that must fit specific dimensions or validating whether a purpose is allowed on a given platform.

### `.purpose`: Content Type Definition

Contains: semantic slot definitions (primary, secondary, detail, meta, cta, label), typography and color per slot, sample content, length constraints, `scope`, `context`.

**Semantic slots are roles, not positions:**
- `primary` = main communicative act (headline, key message)
- `secondary` = supporting signal (subline, number)
- `detail` = extended content (body, list)
- `meta` = contextual info (date, caption)
- `cta` = call to action
- `label` = orientation marker (badge, tag)

### `.composition`: Spatial Arrangement

Contains: slot-to-position mappings in grid or flow mode.

**You rarely need to read this** unless debugging layout issues. Compositions contain zero brand-specific information.

## Composing Context for Content Generation

When generating content for a specific purpose, read all layers silently (do not dump file contents or context notes to the user), then lead with the generated content.

### Reading layers (internal, not shown to user):

1. **Read `.identity`** — voice.always/never (hard constraints), persona, register, pillars.avoid, anti-audience, values, positioning
2. **Read `.brand`** — voice-constraints: sentence-max, headline-pattern, number-format, register
3. **Apply `scope` from `.purpose`** — audience and pillar filters narrow the upstream context
4. **Apply `context` from `.purpose`** — slot-specific instructions, follow literally
5. **Generate per-slot content** — respect maxLength, use samples as structural reference (match pattern, not words), follow context instructions

### Output format:

- Show each **slot** with its generated content — nothing else
- After the content, show a **compact validation summary** (pass/fail per rule, only call out failures in detail)

Do NOT show: layer contents, file paths, context notes, voice constraint values, scope details, or step-by-step reasoning. The user wants content, not process.

## Validation Checklist

After generating or reviewing content, validate against these rules in order:

1. **`voice.never`:** Does any generated text contain a phrase, pattern, or concept from the never list? If yes, rewrite.
2. **`voice.always`:** Does the text follow every rule in the always list? If not, fix.
3. **`anti-audience`:** Could this content be read as addressing an anti-audience? If yes, rewrite.
4. **`pillars.avoid`:** Does the content touch an avoided topic area? If yes, reject.
5. **`values`:** Does the content contradict any value's behavior statement? If yes, fix.
6. **`sentence-max`:** Count words in every sentence. Does any exceed the limit? If yes, split.
7. **`headline-pattern`:** Does the headline follow the specified pattern? If not, restructure.
8. **`maxLength`:** Does each slot's content fit within its character limit? If not, shorten.
9. **`register`:** Does the formality level match? (e.g., if `informal, Du`, no formal address)

## What NOT to Do

- **Do not restate identity in purpose-level work.** If a purpose's `context` block says "keep it warm and friendly," that belongs in `.identity`, not here. Flag it.
- **Do not invent voice rules.** Only apply constraints from the actual files. Your interpretation of the brand is less reliable than the authored rules.
- **Do not mix layers.** If asked to suggest a color, look in `.brand`. If asked about audience, look in `.identity`. Never guess from the wrong layer.
- **Do not ignore `never` rules.** These exist because the brand has been burned by generic AI output before. The `never` list is the most important part of the identity file.

## File Discovery

Brand Intent files follow this structure:

```
brandname.identity
brandname.brand
formats/*.format
purposes/*.purpose
compositions/*.composition
```

To find the active brand, look for the `.identity` and `.brand` files at the project root. There is exactly one of each per project.
