# Brand Intent / AI Skill

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

When generating content for a specific purpose, compose your context by reading layers in order:

### Step 1: Read `.identity`

Load the full identity. Pay special attention to:
- `voice.always` and `voice.never`: these are your hard constraints
- `voice.persona`: adopt this voice
- `voice.register`: match this formality level
- `pillars.avoid`: never generate content in these topic areas
- `anti-audience`: never sound like you're addressing these people
- `values`: use behavior statements to guide decisions when voice rules don't cover a situation
- `positioning`: use when content needs to differentiate

### Step 2: Read `.brand`

Load voice-constraints and content-defaults:
- Enforce `sentence-max` on all generated text
- Follow `headline-pattern` for headlines
- Use `number-format` for numbers
- Apply `density` from content-defaults

### Step 3: Apply `scope` from `.purpose`

The purpose file's `scope` narrows the composed upstream:
- `audience:` only use language guidance from these audience blocks
- `pillars:` restrict to this pillar scope (`primary`, `secondary`, or `all`)

If no filter is specified, include everything.

### Step 4: Apply `context` from `.purpose`

Read the `context` block. This contains slot-specific instructions that cannot be derived from identity or brand. Follow them literally; they are precise, not general.

### Step 5: Generate per-slot content

For each slot in the purpose:
- Respect `maxLength` (hard character limit)
- Use `samples` as structural reference (match the pattern, not the words)
- Follow the `context` instructions for this slot

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
# Single brand
brandname.identity
brandname.brand
formats/*.format
purposes/*.purpose
compositions/*.composition

# Multi-brand
brands/brandname/brandname.identity
brands/brandname/brandname.brand
formats/*.format           ← shared
purposes/*.purpose         ← shared
compositions/*.composition ← shared
```

To find the active brand, look for `.identity` and `.brand` files. There is exactly one of each per brand.

## Relationship to Impeccable

If this project also uses [Impeccable](https://impeccable.style), the two are complementary:
- **Impeccable** teaches you how to design well (general craft)
- **Brand Intent** teaches you what this brand's expression intent is (specific identity)

Apply both. Impeccable governs execution quality. Brand Intent governs brand specificity.
