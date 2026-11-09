---
description: Generate and validate on-brand content using Brand Intent files
---

# Brand Intent

**Scope:** `$ARGUMENTS`

> If `$ARGUMENTS` is "onboard": run the guided brand onboarding interview (see Onboarding section below).
> If `$ARGUMENTS` is "example": scaffold the Krume bakery reference implementation into `examples/krume/` and explain what each file does.
> If `$ARGUMENTS` names a purpose (e.g. "daily-bread", "event", "quote"): compose context from the layers and generate content for that purpose.
> If `$ARGUMENTS` names a story (e.g. "today", "breads-of-the-week"): generate the open slots of every page of that story, one topic across all pages, variables left as written.
> If `$ARGUMENTS` is "validate": read the most recent generated or provided content and run the validation checklist against the brand files.
> If `$ARGUMENTS` is empty: find the active brand (see File Discovery below), summarize the brand voice and list available purposes.

You are working in a project that uses **Brand Intent**, an open file format for encoding brand identity, expression intent, and content composition rules across eleven composable file types. This skill teaches you how to read, compose, and validate Brand Intent files.

## The File Types

Brand Intent distributes brand knowledge across eleven file types in three groups: five layers that describe the brand, a story file for what it posts, and five fact files for what is true about it. Each answers one question:

| Layer | File | Question | Changes |
|-------|------|----------|---------|
| **Identity** | `.identity` | Who is this brand? | Rarely (strategy) |
| **Brand** | `.brand` | What expression intent does it derive? | Occasionally (design) |
| **Format** | `.format` | Where does this content appear? | When platforms change |
| **Purpose** | `.purpose` | What is this content trying to do? | When content types evolve |
| **Composition** | `.composition` | How are elements composed? | Reusable across brands |
| **Story** | `.story` | What does the brand post, page by page? | Per post series |
| **Time** | `.time` | When does the brand live: its founding, seasons, windows and day? | When the year changes |
| **Place** | `.place` | Which site do the posts speak about? | When hours or address change |
| **Person** | `.person` | Who do the posts name, quote or show, and what did they agree to? | When a person joins or withdraws |
| **Group** | `.group` | Which group of people do the posts speak about? | When a band, an estate, a partner comes or goes |
| **Work** | `.work` | What does the brand put out or put on? | When a product, a release, a class or an event is added |

The arrow between layers is a **derivation arrow**: Identity contains reasoning. Brand derives expression intent from that reasoning. Format, Purpose, and Composition condition specific acts of expression without repeating what upstream layers establish.

```
Identity → Brand → Format → Purpose → Composition   + Story   + Time · Place · Person · Group · Work
```

## How to Read Each Layer

### `.identity`: Strategy (no visual properties)

**Required:** essence, promise, voice (register, persona, rhythm, always/never), pillars, audience segments.

**Optional:** tagline, positioning, mission, vision, archetype, narratives (`narrative NAME`, exactly one marked `primary`), values (with behavior statements and `say:`/`not:` examples), anti-audience segments, imagery, image-theme, goal, review.

**The `always`/`never` construct is your primary guardrail.** These are concrete, testable rules. When generating or reviewing content, check every item in `never:` and confirm every item in `always:`. They are not suggestions; they are constraints.

**`voice.instead`** pairs a phrase to avoid with the brand's own wording. When a draft contains the phrase, use the replacement as the model for the rewrite.

**`values`** are not just keywords; each has a behavior statement that describes how it manifests. Use these to inform decisions when voice rules don't cover a situation. `say:` lines are examples to match in tone, `not:` lines are the tone to avoid.

**`imagery`** is the image counterpart of `voice`: `always`/`never` rules for photos and film. Apply them when reviewing a photo or writing an image brief or prompt. **`image-theme`** blocks name subjects for photos and film, some tied to a narrative.

**`goal`** says what a piece of content is for, independent of its format. A purpose names a default goal with `goal:`. Follow the goal's `always`/`never` rules and answer its `question`. `share:` is a planning target, not a rule for a single piece.

**`review`** lists yes/no questions to check before publishing: `copy` for texts, `image` for photos and film.

**`anti-audience`** segments define who the brand is explicitly *not* for. Never generate content that sounds like it's addressing an anti-audience. This is as important as `voice.never`.

**`positioning`** gives the competitive frame: what the brand is the only one of. Use this when the content needs to differentiate.

**Does NOT contain:** hex values, font names, type sizes, spacing, composition rules, or any visual properties.

### `.brand`: Derived Expression Intent

Contains: color primitives (`brand-colors`), semantic themes, color families, fonts, named typography styles, spacing, dividers, badge styles, icons, declared assets (logos, photos, illustrations). Also `location` (the area the brand is in, coordinates for sunrise, sunset and weather variables), `camera`, `framing NAME` modules (horizon position, goals) and `photo-look` (saturation, warmth, contrast, scrim). Seasons and windows are not here: they are the brand's `.time`.

**For writing you need:** `framing` when briefing a photo. Writing rules such as `sentence-max` live in the purpose's `voice` block, not here.

**Does NOT contain:** identity reasoning, audience definitions, strategic prose, composition rules, writing rules.

### `.format`: Canvas Definition

Contains: platform, dimensions, safe zones (danger/crop/comfort), grid, allowed purposes.

**You rarely need this directly** unless generating content that must fit specific dimensions or validating whether a purpose is allowed on a given platform.

### `.purpose`: Content Type Definition

Contains: semantic slot definitions (primary, secondary, detail, meta, cta, label, credit: attribution, never written by AI), typography and color per slot, `example` pages, length constraints (`maxLength`, `words:`, `sentences:`), `scope`, `context`, a `voice` block with writing rules, a default `goal:` and `framing:`.

**`voice`** holds the production-enforceable writing rules for this content type:
- `sentence-max:` maximum words per sentence. Enforce this.
- `headline-pattern:` structural pattern for headlines (e.g., `noun-first`, `verb-first`).
- `number-format:` `cardinal` means write "drei" not "3"; `digit` the opposite.

**`example`** blocks are whole pages, one topic each, every slot written together. AI writing produces whole pages in this shape, never independent variants per slot. An example with `when: NAME` only fits while that `.time` window or season is open; an example with `work: ID` only while that work is in season (its days, the days before and after its date), and the page gets the work's variables.

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

### `.story`: What the Brand Posts

Ordered `page` blocks, each naming a purpose (and optionally a composition, theme, photo). A slot on a page is **fixed** (text written in the story), **variable** (calendar and sky: `{date}`, `{weekday}`, `{sunrise}`, `{sunset}`, `{weather}`; place: `{place}`, `{address}`, `{hours}`, `{week-hours}`, `{opens}`, `{closes}`; time: `{season}`, `{founded}`, `{years}`, `{daily NAME}`; person: `{person}`, `{role}`, `{since}`, `{since-years}`, `{reason}`; group: `{group}`, `{where}`, `{group-since}`, `{group-years}`; work: `{work}`, `{kind}`, `{by}`, `{price}`, `{on}`, `{time}`, `{days-until}`; list: `{n}`, `{count}`), or **open** (left to an example, a person, or AI). `repeat: MIN-MAX` makes a page list. `place:` names a `.place`, `when:` a `.time` window or season, `person:` a `.person`, `group:` a `.group`, `work:` a `.work`; a page may name its own `person:`, `group:` and `work:`.

When writing for a story: fill only open slots, keep one topic across all pages, leave variables exactly as written. Variables are filled by the implementation from the calendar, the sky, a forecast, the place, the time file, the person, the group or the work. **Weather, opening times, dates and names are not guessed:** never replace a variable with a value you made up, and never name a person the files don't name.

### `.place`: A Site the Posts Speak About

Facts only: `name`, `address`, `latitude`/`longitude`, `context` (what the place is like, for AI writing), `opening` (date a new place opens), `hours` (regular weekly hours; a day not named is closed), `capacity` (`indoor`, `outdoor`). Use `context` and `hours` as facts when writing about the place. Never state a capacity, hour or address the file doesn't give. Before `opening:` the place is not open yet.

### `.time`: The Brand's Rhythm

One per brand, facts only: `founded` (date or year), `season NAME` blocks (`label`, `from`), `windows` (named yearly date ranges such as `advent: 11-27..12-24`), and `daily` (named moments of the brand's day: `oven: 04:00 Oven on`). Nothing in it is an occasion: a Saturday bread, a class, a mill day are works. A `when:` on an example, a story or a brand photo names a window or a season. Only pick content that is in season today. Never state a season, a date, an age or a time of day the file doesn't give.

### `.person`: Who the Posts Speak About

One file per person, facts only: `name` (optional), `role` (how a post calls them: `Baker`, `Regular in Lemkenhafen`), `since`, `place`, `group` (the band or estate they belong to), `reason` (why they come, what they do), `context`, `photos`, `consent` (the date they agreed), `until` (when that ends), and `quote` blocks with the person's own words. One human is a person, whatever their role; more than one is a group. The file is the consent: it holds only what the person agreed to. A story or page names a person with `person:`. Write their name only when `name:` is set; otherwise call them by their role. Quote only what a `quote` block holds, verbatim; never write, extend or rewrite a quote. From `until:` on, a page naming the person does not go out. A purpose with `person: required` needs a person on every page, and without one the page is not posted. Never invent a person, a first name or a reason: a goal that asks for "a person with their reason to come" is answered from a `.person` file or not at all.

### `.group`: More Than One Person Under One Name

A band, an estate, a family farm, a mill, a club, a label. Facts only: `name`, `role` (what it is to the brand: `Band on the label`, `The mill`), `since`, `where` (region or town as a post says it; a fact, not a place), `members` (person ids; each names the group with `group:`), `links`, `photos`, `context`, and `quote` blocks with words the group published as one (a statement, liner notes, a back label). A group is public: no `consent:`, no `until:`. A story or page names a group with `group:`; a page's person brings their group along. Quote a group only from its `quote` blocks, verbatim, attributed as the group; a member's remark is the member's quote. Never invent a member, a region or a founding year.

### `.work`: What the Brand Puts Out or Puts On

A bread, a wine, a record, a book, a class, a tasting evening, a show, a mill day. Facts only: `title`, `kind` (the brand's own word: `bread`, `album`, `class`, `event`), `by` (person or group ids; absent: the brand's own), `on` (a yearly `MM-DD` or one-off `YYYY-MM-DD`, ranges allowed: the day it comes out or takes place), `days` (the weekdays it comes round on), `time`, `lead` (days before `on` it is in season, default 14), `until` (the day after which it is no longer posted about), `when` (a `.time` window or season it fits), `place`, `price` (as a post writes it; never compute with it), `links`, `photos`, a `facts:` block (ingredients, duration, edition, line-up), and `review` blocks (a critic's words, verbatim, with `by:` as the credit, optional `on:` and `link:`). An event is a work: it carries its own date. A story, page or purpose example names a work with `work:`. Content about a work is in season when every date it has says so: a yearly `on:` from `lead` days before to its end, a one-off `on:` from `lead` days before and from then on (a launch, not an expiry), `days:` on those days, `until:` up to that day. State a price, a date, a time or an ingredient only from the file. Quote a review only from its `review` block, verbatim, in quotation marks, credited with its `by:`; never write, extend, shorten or rewrite one, and never put a critic in a `.person`.
## Composing Context for Content Generation

When generating content for a specific purpose, read all layers silently (do not dump file contents or context notes to the user), then lead with the generated content.

### Reading layers (internal, not shown to user):

1. **Read `.identity`** — voice.always/never/instead (hard constraints), persona, register, pillars.avoid, anti-audience, values and their examples, positioning; the goal named by the purpose
2. **Read `.brand`** — `framing` (for photo briefs)
2b. **Read the `.purpose` `voice` block** — sentence-max, headline-pattern, number-format
2c. **Read the fact files** when writing for a `.story` — the story's `.place` (context, hours, capacity), the `.time` (is the `when:` entry in season; the daily moments), the `.person` (role, since, reason, quotes, until), the `.group` (role, where, quotes), the `.work` (kind, by, on, days, time, price, facts, reviews; is it in season) as facts
3. **Apply `scope` from `.purpose`** — audience and pillar filters narrow the upstream context
4. **Apply `context` from `.purpose`** — slot-specific instructions, follow literally
5. **Generate per-slot content** — respect maxLength and any `words:`/`sentences:` range, use the purpose's `example` pages as structural reference (match pattern, not words; all slots of one output share one topic), follow context instructions

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
6. **`sentence-max`** (purpose `voice`): Count words in every sentence. Does any exceed the limit? If yes, split.
7. **`headline-pattern`:** Does the headline follow the specified pattern? If not, restructure.
8. **`maxLength`:** Does each slot's content fit within its character limit? If not, shorten.
9. **`words:` / `sentences:`:** Is each slot within its editorial range, where one is set? If not, adjust.
10. **`register`:** Does the formality level match? (e.g., if `informal, Du`, no formal address)
11. **`voice.instead`:** Does the text contain a phrase from the instead list? If yes, rewrite along the replacement.
12. **`goal`:** Where a goal applies, does the text follow its rules and answer its question?
13. **`review.copy`:** Answer each question with yes or no. Any no is a failure.
14. **In season:** Is an example, story or page used while its `.time` entry is not in season, or while its work is not (wrong day, too early before its date, after its `until:`)? If yes, pick another.
15. **Variables:** Does a story text still contain its `{variables}` unchanged, with no guessed weather, hours, dates, ages or names? If not, restore them.
16. **Consent:** Is a person named without a `name:` in their file, quoted with words not verbatim from a `quote` block (or a critic with words not verbatim from a `review` block), shown in a photo their file doesn't list, or used past their `until:`? If yes, the page does not go out.
17. **Facts of a work or group:** Is a price, a date, a time, an ingredient, a member or a region stated that the `.work` or `.group` file doesn't give? If yes, remove it or take it from the file.

When reviewing a photo, check `imagery.always`/`never`, the brand's framing (horizon position) and each `review.image` question.

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
├── brandname.time
├── formats/*.format
├── purposes/*.purpose
├── compositions/*.composition
├── stories/*.story
├── places/*.place
├── people/*.person
├── groups/*.group
└── works/*.work
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
- **`purposes/`** — content type with semantic slots, constraints, and example pages. What content does.
- **`compositions/`** — spatial arrangement of slots. How elements are placed.
- **`stories/`** — what Krume posts: `today.story` (one page a day with `{weekday}`, `{sunrise}`, `{closes}`) and `breads-of-the-week.story` (a three-page carousel).
- **`places/`** — `weserstrasse.place`: the shop, its address, hours and capacity.
- **`krume.time`** — founded 2019, four seasons, the rhubarb and advent windows, and the day from `oven: 04:00` to `gone: 12:00`.
- **`people/`** — `baker.person`: the baker, by role only (no `name:`), with her quotes. The file is the consent.
- **`groups/`** — `drax-mill.group`: the mill the flour comes from, with the words it published as one.
- **`works/`** — the breads (`rye-loaf`, `wheat-blend` on Saturdays, `emmer-walnut`, `stollen` in Advent), the `baking-class` and the yearly `mill-day`, each with its own price, days or date. The purpose examples name them with `work:`.

If `examples/krume/` doesn't exist, tell the user to run `npx brand-intent init` first.
