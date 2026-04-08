# Brand Intent Framework — Design Session Documentation

This document summarises the reasoning, decisions, and open questions from the design conversation that produced the Brand Intent. It is intended as context for Claude Code when implementing the v1.0 repository, the VS Code extension, and the npx CLI. Read this before touching any file.

---

## What Brand Intent is and why it exists

Brand Intent is an open file format specification for making brand intent machine-readable. It was developed in the context of **Brand Studio** — a "service as software" approach to brand operationalization, where a designer acts as ongoing brand steward for multiple clients, with AI-assisted content production running inside guardrails the designer authors and maintains.

The commercial context matters for understanding the design decisions: Brand Intent is not trying to become a W3C standard. It is positioned as a **personal tool with a public spec** — a reference implementation others can adopt, fork, and build on, in the same way that the Open Color Tools project (an earlier initiative by the same author) shaped today's best practices for Figma color variables without ever becoming a formal standard. The goal is conceptual influence and niche community exchange, not institutional adoption.

### What existing formats don't capture

**Design tokens** (W3C DTCG format) capture decisions as values: `color.primary = #0324B1`. They do not capture why that color was chosen, for whom, from what cultural position, or what content it is appropriate to use it in.

**Brand guidelines (PDF/portal)** capture rules and rationale in prose, but they are not machine-readable. An AI agent cannot parse a PDF to understand always/never voice rules.

**DAM/brand portals** (Frontify, Bynder) store assets and guidelines but do not encode content intent — what a specific piece of content is trying to do, for which audience, within which topical scope.

**Prompt engineering** can carry all of this, but as unstructured prose that lives in someone's head, a ChatGPT thread, or a CLAUDE.md file. It is not portable, not version-controlled, not composable across tools.

Brand Intent addresses all four gaps by distributing brand knowledge across five distinct, composable layers.

---

## The five layers — IBFPC

The framework's core insight is that every brand system must answer five questions that are genuinely independent of each other. Most tools collapse them. Brand Intent keeps them separate.

```
Identity → Brand → Format → Purpose → Composition
```

The arrow is a **derivation arrow**, not merely a sequence. Identity contains reasoning. Brand derives expression intent from that reasoning. Format, Purpose, and Composition condition specific acts of expression without repeating what upstream layers establish.

### Layer 1 — Identity (`.identity`)

**The question it answers:** Who is this brand?

**What it contains:** Strategic reasoning. Cultural codes, narratives, positioning, essence, promise. Voice persona. The `always` / `never` construct — concrete, parseable rules an AI can follow without interpretation. Content pillars (what topics the brand inhabits and avoids). Audience definitions with language guidance per audience.

**What it deliberately excludes:** Hex values, font names, type sizes, composition rules, canvas dimensions, platform specifications. No visual properties of any kind.

**Who authors it:** The brand strategist and designer together. It is the brief.

**How it changes:** Slowly. It changes when strategy changes — which may be years apart.

**Key design decision — the `always`/`never` construct:** Rather than prose voice guidance, Brand Intent uses a structured list of concrete rules. `Always say "Ostsee", never "Nordsee"` is more useful to an AI model than `brand voice: warm and nature-oriented`. The former is a rule. The latter is an interpretation prompt. Brand Intent prefers rules over descriptions wherever possible.

**Example:**
```yaml
# fehmarn.identity

essence:  Fehmarn ist das Draußen-Sein. Wind, Weite, echtes Inselleben.
promise:  Wer kommt, spürt sofort: hier ist das Wetter kein Hintergrund,
          es ist das Erlebnis.

voice
  register:  informal, Du
  persona:   ortskundige Freundin — begeistert, konkret, nie werblich
  rhythm:    kurze Sätze, Aktivverben, konkrete Ortsnamen

  always:
    - Ostsee, not Nordsee
    - Du, not Sie
    - konkrete Ortsnamen (Südstrand, Staberhuk) over "die Insel"
    - Wind als Protagonist, nicht als Kulisse

  never:
    - Superlative ohne Substanz (schönste, größte, unvergessliche)
    - Tourismus-Floskeln (Traumurlaub, Erholung pur)
    - Passivkonstruktionen in Headlines

pillars
  primary:   Windsport, Natur, Draußen-Leben, Ostsee
  secondary: Inselkultur, Nachhaltigkeit, Entschleunigung
  avoid:     Wellness-Tourismus, Städtevergleiche, Massentourismus

audience windsport
  label:       Windsport-Enthusiasten
  profile:     25–45, aktiv, planungsfreudig, erfahren
  motivation:  optimale Bedingungen finden, Insider-Wissen
  language:    präzise, sportlich, auf Augenhöhe — kein Lehrton

audience nature
  label:       Naturtouristen
  profile:     Familien und Paare, 30–55, nachhaltigkeitsbewusst
  motivation:  Entschleunigung, echtes Inselerlebnis
  language:    einladend, sensorisch, ruhige Energie
```

---

### Layer 2 — Brand (`.brand`)

**The question it answers:** What expression intent does the brand derive from its identity?

**Important framing:** `.brand` is NOT just the visual file. This was a key conceptual shift during the design session. The brand file contains the full **expression intent** derived from identity — visual language AND operationalized voice parameters AND structural content defaults. The word "expression" here is used carefully: this is not expression itself (pixels, rendered words), but the authored conditions and semantic structures that govern what valid expression looks like.

A hex value in a theme is not a color on screen — it is an intent that a renderer realizes. A `sentence-max: 12` is not a word count — it is a constraint a text generation system enforces. Designers author intent. Tools and agents produce expression from it.

**The derivation relationship:** Every decision in `.brand` should be traceable to a statement in `.identity`. If it isn't, it is either an undocumented strategic choice (which should be made explicit in `.identity`) or arbitrary decoration (which has no place in either file). This traceability is a governance mechanism — not just a documentation principle.

**What it contains:**
- Color primitives and semantic theme mappings (slot names → color values per theme)
- Font definitions and named typography styles (including optical sizing, autofit ranges, weight variants — richer than design tokens)
- Spacing tokens and named divider styles
- `voice-tokens` — operationalized voice parameters derived from `.identity` voice reasoning (register, sentence-max, headline-pattern, etc.)
- `content-defaults` — production-level defaults derived from identity (density, image-treatment, divider style)

**What it deliberately excludes:** Identity reasoning, audience definitions, content pillar descriptions, strategic prose of any kind. Composition rules. Platform specifications. The reasoning for any decision — that lives in `.identity`.

**Who authors it:** The designer. It is what the brief produces.

**How it changes:** More frequently than `.identity`, as expression decisions are refined through practice and usage.

**Example (partial):**
```yaml
# fehmarn.brand — expression intent derived from fehmarn.identity

brand-colors
  primary:   #0324B1   # Pantone 286 C / HKS 44 K
  secondary: #071142
  accent1:   #E32D39
  accent2:   #84D3DA
  white:     #FFFFFF

theme Basic
  background:     $primary
  text-primary:   $white
  text-secondary: #D0D8F0
  logo:           $accent2
  cta:            $accent1
  divider:        $accent1

theme Strand
  background:     #F5EDE3
  text-primary:   #2C1810
  cta:            #C05E2C
  divider:        #C05E2C

font primary
  name:     Die Grotesk
  fallback: sans-serif
  source:   local

typography headline
  weight:      800
  strong:      900
  size:        8        # cqh
  opsz:        24       # optical size axis
  lineHeight:  1.1
  autofit-min: 4
  autofit-max: 12

# Derived from identity voice reasoning — operationalized for production
voice-tokens
  register:         informal
  sentence-max:     12      # words
  headline-pattern: verb-first
  number-format:    cardinal  # "drei", not "3"

content-defaults
  density:         medium
  image-treatment: full-bleed
  divider:         ruler
```

**Open question — voice-tokens vocabulary:** The `voice-tokens` block is new and its full key vocabulary is not yet defined. Needs to be specified: what keys are valid, what value types they accept, how they are passed to AI context. This is a significant design task for v1.0.

---

### Layer 3 — Format (`.format`)

**The question it answers:** Where does this content appear?

**What it contains:** Platform, canvas dimensions, safe zones (danger / crop / comfort), grid specification, and the list of purpose IDs that are editorially valid for this surface.

**What it deliberately excludes:** Color values, typography, voice, brand strategy, composition rules. The `purposes` list is an editorial choice (which content types are appropriate here) — not a technical constraint.

**Cardinality:** Multiple per brand. A brand inhabits multiple platforms and aspect ratios. A single `.identity` and `.brand` file govern all of them.

**Example:**
```yaml
# instagram-4-5-feed-portrait.format

id:       4:5
label:    4:5
sublabel: Feed Portrait
category: instagram

size:     1080 1350
grid:     5 4           # rows × cols

danger:   0 0 0 0       # px — always cropped
crop:     0 34 0 34     # px — may be cropped by UI
comfort:  40            # px — safe reading margin

purposes: announcement, quote, event, listicle-cover,
          listicle-item-card, listicle-item-text,
          article-cover, article-item-teaser
```

**Open question — audience affinity on formats:** Should a format be able to declare an audience affinity? Some formats (e.g. a kitesurfing-specific story format) might be inherently more relevant to one audience. Not implemented, worth considering.

---

### Layer 4 — Purpose (`.purpose`)

**The question it answers:** What is this content trying to do?

**What it contains:** Semantic slot definitions, typography and color role per slot, sample content, length constraints, and the `identity-filter` / `identity-extension` pair that composes AI context from upstream layers.

**What it deliberately excludes:** Color values (only named semantic slots from `.brand`). Absolute positions (only slot names that compositions resolve). Full voice/strategy (only a filtered reference to the composed upstream).

**The slot system — the most important design decision in the format:** Slots are semantic roles, not visual positions. `primary` is the main communicative act of this piece of content. `secondary` is a supporting signal. `meta` is contextual. `label` is an orientation marker. `detail` is extended description. `cta` is the call to action.

These names travel through the entire stack. A composition doesn't know what a "headline" is — it knows where `primary` goes. A purpose doesn't know where anything sits on the canvas — it knows what `primary` means for this content type. This separation is what makes the system composable: a composition can serve multiple purposes, a purpose can be rendered in multiple compositions, both governed by a single brand.

**Cardinality:** Multiple per brand. New content types = new purpose files. Purposes can be shared across brands (a `listicle-cover` purpose is not brand-specific — it could be used for any brand, with identity-filter doing the brand-specific work).

---

### Layer 5 — Composition (`.composition`)

**The question it answers:** How are elements composed to achieve the intent?

**Naming rationale:** The rename from `.layout` to `.composition` was deliberate. Layout is a tool term — it implies placement mechanics. Composition is a designer term — it implies authorship, visual judgment, and the intentional relationship between elements. The file type name should reflect the designer's act, not the software's operation.

**What it contains:** Slot-to-position mappings and structural relationships. Nothing else.

**Cardinality:** Multiple. Compositions are the most reusable layer — a single composition can serve many purposes across many brands. They contain zero brand-specific information.

**Two modes — grid and flow:**

- **Grid mode** (`mode: grid`) — explicit row/column placement. Precise, declarative, suited to editorial compositions where exact alignment governs the reading sequence. Previously called "compose mode" — renamed to grid for clarity.
- **Flow mode** (`mode: flow`) — compositional intent: panels, stacks, split areas, sticky elements. Content structure and AI-assisted generation drive the spatial result. The designer sets conditions; elements find their place within them. This is closer to how content-driven and AI-assisted composition actually works.

The grid/flow distinction is meaningful: grid mode is the designer placing elements. Flow mode is the designer setting conditions under which elements compose themselves — which is why "flow" stays and "compose" (the old mode name) was retired. The word "compose" now belongs to the file type, not the mode.

**Example (both modes):**
```yaml
# editorial.composition — grid mode
id:    editorial
mode:  grid
image: full
logo:  top left

label      row 1  cols 3--3  left
secondary  row 2  cols 1--4  left center
primary    row 3  cols 1--4  left
meta       row 6  cols 1--2  left center
cta        row 6  cols 3--4  right bottom

# panel.composition — flow mode
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

**Open question — grid vs flow:** Both modes are valid and serve different compositional intentions. No need to unify them. The question is whether the grid mode syntax should also be updated to feel more expressive — currently it reads more like a data table than a designer's notation.

---

## The identity-filter / identity-extension mechanism

This is the most architecturally significant part of Brand Intent and the part that most needs clear documentation for implementers.

### The composed upstream

By the time a `.purpose` file needs to compose its AI context, the upstream has already been resolved:

```
.identity (reasoning)
    ↓
.brand (derived expression intent)
    ↓
composed upstream ← this is what identity-filter operates on
    ↓
.purpose (identity-filter narrows / identity-extension adds)
    ↓
.format + .composition (condition the specific act of expression)
```

The purpose doesn't filter `.identity` and `.brand` separately. It filters the **composed upstream** — which includes both the strategic reasoning from `.identity` and the operationalized parameters from `.brand`. The parser resolves which layer each key comes from.

### identity-filter — narrowing

`identity-filter` selects a relevant subset of the composed upstream for this specific content type. It narrows. It does not add anything not already present in the upstream layers.

```yaml
identity-filter
  audience: windsport, nature    # pulls audience blocks from .identity
  pillars:  primary              # restricts to primary content pillar scope
  # voice-tokens and content-defaults from .brand are included automatically
```

When the parser composes AI context for this purpose, the result includes:
- The audience language guidance for `windsport` and `nature` from `.identity`
- The primary pillar scope from `.identity`
- The always/never voice rules from `.identity` (always included unless explicitly excluded)
- The operationalized `sentence-max`, `headline-pattern` from `.brand`
- The `content-defaults` from `.brand`

None of this is restated in the purpose file. It is referenced and composed.

### identity-extension — adding

`identity-extension` adds only what is genuinely specific to this content type — what cannot be derived from identity or brand.

**The test for what belongs here:**
- If it sounds like voice guidance → belongs in `.identity`
- If it sounds like a production parameter → belongs in `.brand`
- If it appears across 3+ purpose files → belongs upstream
- If it is genuinely slot-level and content-type-specific → belongs here

**Wrong (restates identity):**
```yaml
identity-extension
  Keep the tone warm and direct.
  Avoid promotional language.
  Write in German, informal register.
  # ✗ all of this is already in .identity
```

**Right (slot-specific only):**
```yaml
identity-extension
  secondary is the rank number displayed large: "01", "02" etc.
  primary is a place name, 1–3 words.
  meta is a short descriptor, 3–6 words.
  # ✓ genuinely specific to this content type
```

**Open question — filter key vocabulary:** What keys can `identity-filter` reference? Currently: `audience`, `pillars`. Should it be able to explicitly exclude voice rules? Reference specific themes? Declare an image mood? The vocabulary needs to be fully specified for v1.0.

---

## File format syntax principles

These are non-negotiable design decisions established during the session:

1. **Never JSON.** The format should feel like writing CSS and structured AI prompts simultaneously.
2. **YAML-like, but not YAML.** Indentation-based block structure. No colons required for block headers. No quotes required for simple string values.
3. **`$reference` syntax** for cross-referencing named values within the same file (e.g. `$primary` referencing a brand-color named `primary`).
4. **`#` comments** everywhere. Comments are first-class — they carry the reasoning that connects decisions to identity.
5. **Named blocks** rather than keyed objects. `theme Basic` not `themes: { Basic: { ... } }`.
6. **Presence as boolean.** Some flags (like `italic`, `uppercase` in typography) are set by presence alone, not `italic: true`.
7. **Human-writable as a primary constraint.** The format should feel like authoring, not configuring. A brand strategist writing `.identity` should not feel like they are filling in a schema.

---

## The distribution model

**GitHub repository:**
- The spec (this document + formal grammar)
- Reference parser (`brandParser.ts` — already exists in Brand Studio prototype)
- Reference implementation: the Fehmarn brand (`.identity`, `.brand`, formats, purposes, compositions) with full inline comments explaining derivation decisions
- MIT license or similar open license

**npm package — `brand-intent`:**
```bash
npx brand-intent install-skills    # install Brand Intent skill files for your AI harness
npx brand-intent add fehmarn/brand # install a brand into a project
npx brand-intent init --from fehmarn  # scaffold a new brand from the reference
```

**VS Code extension — already exists:**
- Syntax highlighting for all five file types (`.identity`, `.brand`, `.format`, `.purpose`, `.composition`)
- Autocomplete for known keys within each file type
- Grammar validation
- This is a significant distribution advantage — the authoring experience is already first-class

**AI harness skill file:**
- A markdown file installed into `.claude/`, `.cursor/`, `.gemini/`, `.agents/` etc.
- Teaches the agent: what Brand Intent layers are, how to compose context from them, how to resolve `identity-filter`, how to validate content against `voice.never` and `pillars.avoid`
- Compatible with Impeccable (complementary, not competing — Impeccable = design craft, Brand Intent = brand identity)

---

## Relationship to Impeccable

[Impeccable](https://impeccable.style) (by Paul Bakaus, 13.3k GitHub stars, launched Feb 2026) is a skill pack for AI coding assistants that gives them design vocabulary — commands like `/polish`, `/audit`, `/typeset`. It uses `.impeccable.md` as a project-level context file populated by `/teach-impeccable`.

**The relationship is complementary, not competitive:**
- Impeccable teaches agents *how to design well* (general craft)
- Brand Intent teaches agents *what this brand's expression intent is* (specific identity)

A complete AI-assisted brand production workflow would use both. This should be mentioned in the Brand Intent README and landing page.

---

## Open questions for v1.0

These were explicitly identified during the design session as unresolved:

**Grammar and syntax:**
- Full `voice-tokens` key vocabulary — what keys are valid? What value types?
- `content-defaults` key vocabulary — same question
- `identity-filter` key vocabulary — what can be filtered? Can things be explicitly excluded?
- Should `density` (currently on `.purpose`) be defined in `.brand` as a default and overridable per purpose?
- Grid vs flow layout mode — should one supersede the other, or remain as parallel tools?
- `archetypes` field in `.purpose` files — these are referenced but not defined anywhere in the current files. What defines the archetype vocabulary?

**Architecture:**
- How does the parser actually compose the AI context object from five layers? What is the data structure passed to the model?
- Should `.format` be able to declare audience affinity?
- Multi-brand folder structure — how does a project with 3 brands organize its files? Suggested: `brands/fehmarn/fehmarn.identity`, `brands/fehmarn/fehmarn.brand`, shared `purposes/` and `compositions/` at project root
- How are purposes shared across brands? By file reference? By convention?

**Tooling:**
- What does the skill file actually contain? (The landing page implies it exists — it needs to be written)
- `npx brand-intent` CLI — needs to be built. Which commands are v1.0 vs later?
- Validation: when should the parser warn that an `identity-extension` is restating identity?

**Conceptual:**
- The `voice-tokens` naming — is "tokens" the right word here? It implies the design token ecosystem. "voice-params" or "voice-constraints" might be more precise.
- Should `.brand` reference `.identity` explicitly (a `derives-from` field)? This would make the derivation relationship machine-checkable, not just documented.
- The `samples` field in `.purpose` slots — is this training data, documentation, or both? The answer affects how it should be formatted and validated.

---

## What Brand Studio is (background context)

Brand Studio is a multi-tenant web application prototype developed by Studio Stoll (Christophe Stoll, Hamburg) for the Fehmarn destination marketing brand. It is a "service as software" product: not a generic SaaS tool, but a designer-mediated brand production environment where:

- The designer (Christophe) authors and maintains all Brand Intent files for a client brand
- Non-designer team members at the client use the Brand Studio interface to produce on-brand content
- AI generates text and assists with image selection, constrained by the Brand Intent files
- The designer is the ongoing brand steward — not just the initial setup person

Brand Intent emerged from Brand Studio's internal file format for encoding brand decisions. The goal of open-sourcing it is not to scale Brand Studio, but to establish a shared conceptual vocabulary and demonstrate the framework's value to other designers and agencies who could build their own Brand Intent-based tools.

The commercial model for Brand Studio itself (10–15 brands, designer as steward, strong lock-in through encoded brand knowledge) is intentionally not a scalable SaaS play. The open-source Brand Intent spec is the "marketing" layer — community exchange, intellectual credibility, and potential inbound interest from designers who encounter the framework.

---

## Fehmarn reference implementation — file inventory

The following files exist in the current Brand Studio prototype and should be included in the v1.0 repository as the reference implementation:

- `fehmarn.identity` — to be created based on session discussion (does not yet exist as a file)
- `fehmarn.brand` — exists, needs `voice-tokens` and `content-defaults` sections added
- `instagram-4-5-feed-portrait.format` — exists
- (other formats exist, to be inventoried)
- `listicle-cover.purpose` — exists
- `listicle-item-card.purpose` — exists, needs `identity-filter` / `identity-extension` replacing `ai-context`
- `listicle-item-text.purpose` — exists, same
- `editorial.composition` — exists (renamed from `editorial.layout`)
- `half-stack-bottom.composition` — exists (renamed from `half-stack-bottom.layout`)
- `panel.composition` — exists (renamed from `panel.layout`)

The migration from `ai-context` to `identity-filter` + `identity-extension` in all `.purpose` files is a concrete v1.0 task. The file extension migration from `.layout` to `.composition` (and the internal `compose` mode rename to `grid`) is a straightforward rename task — update the parser, the VS Code extension grammar, and all reference files.

---

## Suggested v1.0 repository structure

```
/
├── README.md                         # intro, quick start, link to spec
├── SPEC.md                           # formal specification of all five layers
├── DESIGN.md                         # this document (reasoning and decisions)
├── package.json                      # for npx brand-intent CLI
│
├── brands/
│   └── fehmarn/
│       ├── fehmarn.identity          # reference implementation
│       ├── fehmarn.brand
│       └── assets/
│
├── formats/
│   ├── instagram-4-5-feed-portrait.format
│   └── (other reference formats)
│
├── purposes/
│   ├── listicle-cover.purpose
│   ├── listicle-item-card.purpose
│   ├── listicle-item-text.purpose
│   └── (other reference purposes)
│
├── compositions/
│   ├── editorial.composition
│   ├── panel.composition
│   ├── half-stack-bottom.composition
│   └── (other reference compositions)
│
├── parser/
│   └── brandParser.ts                # reference parser (from Brand Studio)
│
├── skills/
│   ├── claude/brand-context.md       # Brand Intent skill for Claude Code
│   ├── cursor/brand-context.md
│   └── (other harnesses)
│
└── vscode-extension/                 # or link to separate repo
```

---

*This document was produced from a design conversation between Christophe Stoll (Studio Stoll) and Claude (Anthropic), April 2026. It captures the reasoning at a point in time — decisions marked as open questions should be resolved before finalizing the v1.0 spec.*
