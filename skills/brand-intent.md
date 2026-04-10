---
description: Generate and validate on-brand content using Brand Intent files
---

# Brand Intent

**Scope:** `$ARGUMENTS`

> If `$ARGUMENTS` is "onboard": run the guided brand onboarding interview (see Onboarding section below).
> If `$ARGUMENTS` is "example": scaffold the Krume bakery reference implementation into `examples/krume/` and explain what each file does.
> If `$ARGUMENTS` names a purpose (e.g. "daily-bread", "event", "quote"): compose context from the five layers and generate content for that purpose.
> If `$ARGUMENTS` is "validate": read the most recent generated or provided content and run the validation checklist against the brand files.
> If `$ARGUMENTS` is empty: find the active brand (see File Discovery below), summarize the brand voice and list available purposes.

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

A Brand Intent brand lives in its own folder, named after the brand:

```
brandname/
├── brandname.identity
├── brandname.brand
├── formats/*.format
├── purposes/*.purpose
└── compositions/*.composition
```

### Finding the active brand

A **brand folder** is a directory that contains both a `*.identity` and a `*.brand` file whose base name matches the folder name. To find the active brand:

1. Search the project for brand folders, but **skip anything under `examples/`** — those are reference material, not the user's real brand.
2. **If exactly one non-example brand folder exists**, use it silently. That is the active brand.
3. **If multiple exist**, ask the user which brand they want to work on. Don't guess.
4. **If none exist but an example brand does** (e.g. `examples/krume/`), treat the example as the active brand — the user is in learning mode. Before doing work, say one line: *"Working with the Krume example brand — run `/brand-intent onboard` when you want to create your own."* Then proceed normally.
5. **If nothing exists at all**, suggest running `/brand-intent onboard` to create a brand, or `npx brand-intent init` to scaffold the Krume example.

Explicit references to an example brand (e.g. "show me the Krume example", "how does Krume handle headlines?") always reach into `examples/` directly, regardless of what the active brand is.

## Onboarding: Create a New Brand

When `$ARGUMENTS` is "onboard", guide the user through a structured interview to create their brand files. Do NOT jump to file creation — the interview comes first.

### Interview Flow

Have a natural conversation. Don't dump all questions at once — adapt based on answers. Group questions into rounds of 2-4.

**Round 1: Identity**
- Brand name? (and brand ID — lowercase, no spaces, used in filenames)
- What does this brand do? One sentence.
- Language? (e.g., de, en)
- Essence — the irreducible truth in 3-8 words?

Listen for tone, confidence, specificity. A founder who says "we make artisan coffee" vs "we roast single-origin in a garage in Kreuzberg" gives you very different brands.

**Round 2: Voice & Personality**
- If this brand were a person talking to a customer, who would they be?
- Formal or informal?
- What does this brand ALWAYS do in communication? (2-3 concrete rules)
- What does this brand NEVER do? (2-3 concrete anti-patterns)

The user will often describe what the brand is NOT before what it IS. Capture both.

**Round 3: Visual Direction**
- Describe the color palette. Hex values, or a mood? (e.g., "warm earth tones", "cold Nordic blue")
- What fonts define this brand? (primary + body. If unknown: serif or sans-serif? Heavy or light?)

If the user describes a mood: propose a palette of 4-5 colors (primary, secondary, accent1, accent2, white/background) and confirm before proceeding.

**Round 4: Content & Audience**
- Who are the 1-2 main audiences? For each: who are they, what do they want, how should you talk to them?
- Anti-audience — someone this brand is explicitly NOT for?
- What content topics are on-brand? (primary pillars)
- What topics should the brand avoid?

### Synthesis

After the interview, present a Brand Brief for confirmation:

```
## Brand Brief: [Brand Name]
ID: [brandid] | Language: [language]
Essence: [essence]

Voice: [persona], [register]
Always: [rules]
Never: [anti-patterns]

Colors: primary [hex], secondary [hex], accent [hex], background [hex]
Font: [primary font name]

Audiences: [summaries]
Pillars: [topics] | Avoid: [topics]
```

Ask the user to confirm or adjust. Iterate until they're happy.

### File Generation

Once confirmed, create a folder named after the brand ID and generate these files inside it:

1. **`[brandid]/[brandid].identity`** — essence, promise, tagline, archetype, voice (register, persona, rhythm, always/never), pillars, audience blocks, anti-audience blocks. Follow the structure of the Krume reference.

2. **`[brandid]/[brandid].brand`** — id, name, language, locale, brand-colors, at least one theme (mapping semantic slots to color references), font blocks, typography blocks (headline, body, caption, label at minimum), spacing, dividers. Use `$name` references for theme colors.

3. **`[brandid]/purposes/starter.purpose`** — a starter purpose with slots that have on-brand sample content derived from the identity. Samples must be in the brand's language and respect voice rules.

The brand folder sits at the project root (or wherever the user invoked the skill). If a folder with that name already exists and contains brand files, stop and ask before overwriting.

### Rules

- **Every voice rule, value, and narrative must come from the user's answers.** Don't invent brand personality.
- **Sample content in purposes must match the brand's language.**
- **Don't skip the interview.** Even if the user says "just make a brand called X" — ask at least the essentials (essence, voice, colors, one audience).
- **Typography sizes use `cqmin` units.** Use these sensible defaults unless the user specified otherwise: headline 6, body 2.8, caption 2.2, label 2.
- **Spacing defaults:** unit cqmin, xs 1.5, s 2, m 3, l 5, xl 6.5.

## Example: Explore the Krume Reference

When `$ARGUMENTS` is "example", the Krume bakery reference is already in `examples/krume/` (copied there by `npx brand-intent init`).

Read the files and walk the user through them:

- **`krume.identity`** — the strategic layer: essence, voice, values, audiences. Start here.
- **`krume.brand`** — derived expression: colors, themes, typography, spacing. Every decision traces back to identity.
- **`formats/`** — canvas dimensions, safe zones, grid. Where content appears.
- **`purposes/`** — content type with semantic slots, samples, constraints. What content does.
- **`compositions/`** — spatial arrangement of slots. How elements are placed.

If `examples/krume/` doesn't exist, tell the user to run `npx brand-intent init` first.
