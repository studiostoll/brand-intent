# Changelog

What the Brand Intent language gained in each release, by file type. The [specification](SPEC.md) is the source of truth; each key it lists names the version it arrived in.

## v0.58 · 12 Nov 2026

- **Story.** `placeholder: true` marks a page's photo or video as a stand-in. The page is not published until a person replaces it.

## v0.57 · 12 Nov 2026

- **Place.** Opening hours can carry dates: `hours from DATE` starts a new regular week on that day, `hours NAME` holds a set of special days with their dates.
- **Story.** `{hours NAME}`, `{new-week-hours}` and `{new-hours-from}` announce them ahead. In a list slot, `{week-hours}` and `{new-week-hours}` count at the longest week.

## v0.56 · 11 Nov 2026

- **Story.** A page can list photos and videos together, and they take turns by date.
- **Composition.** `flow: width 3/4` sets a flow's text narrower, on the side its first slot is aligned to, without a panel behind it.

## v0.55 · 11 Nov 2026

- **Purpose.** `scrim: paragraph` and `scrim: line` set text on a solid ground per paragraph or per line over a photo or video. An empty line in a text starts a new paragraph.
- **Brand.** `scrim-padding` and `scrim-gap` in `photo-look` set the measures.

## v0.54 · 11 Nov 2026

- **Purpose.** Slots are optional: a purpose without slots is its picture or video and the logo.

## v0.53 · 11 Nov 2026

- **Story.** `video:` names one of the brand's videos for a page, instead of a photo. `brand-intent check` reports an id the brand doesn't have.

## v0.52 · 11 Nov 2026

- **Brand.** Photos and videos live in two folders, `media/photos/` and `media/videos/`. A video's file name is its id, its folders are sections; `src:` on a video is gone. *Breaking.*
- **Tooling.** `brand-intent media` writes both indexes (was `brand-intent photos`).

## v0.51 · 11 Nov 2026

- **Format.** `post: reel` posts a page as a Reel.

## v0.50 · 10 Nov 2026

- **Tooling.** `checkFiles` is one cross-file check for the CLI and applications. `brand-intent check` now also checks a format's `purposes:`, a purpose's `compositions:`, scope audiences, slot `color:`, variables in purpose examples and duplicate ids, and warns about unused compositions.

## v0.49.1 · 10 Nov 2026

- No language change.

## v0.49 · 10 Nov 2026

- **Story.** `{NAME short}` gives the short form of `{weekday}`, `{date}`, `{opening}` and `{on}`.

## v0.48 · 10 Nov 2026

- **Story.** A `prompt` block holds the brief that writes the open slots for every date, with an optional `model:`.

## v0.47 · 9 Nov 2026

- **Work.** `review` blocks quote a critic verbatim, with `by:`, `on:` and `link:`.
- **Tooling.** `brand-intent check` parses a brand folder and checks its files against each other.

## v0.46 · 9 Nov 2026

- **Brand.** The photo library is the `photos/` folder: the file name is the id, a subfolder is the section, up to two levels. `src:` and `section:` are gone. *Breaking.*

## v0.45 · 8 Nov 2026

- **Work.** A series lists its items: one per time it comes round, used once or with `items: cycle`, ended by `until:`.
- **Story.** `{item}`, `{item-name}` and `{item-note}` show the day's item; a page's `background:` takes `#RRGGBB` or `{item}`.

## v0.44 · 7 Nov 2026

- **Group.** New fact file: more than one person under one name.
- **Work.** New fact file: what the brand puts out or puts on, with its own date.
- **Time.** `weekly` and `date` blocks leave; `when:` names a window or a season only. *Breaking.*
- **Story, Purpose.** Stories, pages and purposes take `group:` and `work:`; group and work variables replace the occasion variables.
- **Brand.** An asset's library `group:` is now `section:`. *Breaking.*

## v0.43 · 7 Nov 2026

- **Time.** New fact file: founding, seasons, windows and the moments of the day. Windows move here from the `.brand`. *Breaking.*
- **Person.** New fact file: name or role, since, photos, verbatim quotes. The file is the consent, with `consent:` and `until:` dates.
- **Brand.** Colour families name a `season:` instead of `from: MM-DD`; a photo's `person:` is a person id.
- **Story, Purpose.** `person:` and `when:` on stories and pages; time and person variables. A purpose can require a person.
- **All files.** A trailing `# comment` after a value is allowed.

## v0.42 · 6 Nov 2026

- **Brand.** `focus: X% Y%` and `horizon: N%` on a photo mark its subject and horizon line.
- **Story.** `photo: camera` asks for a photo taken now.

## v0.41 · 6 Nov 2026

- **Story.** `when:` sets the date window a story fits. Page lists with `repeat: MIN-MAX`, and `{n}` and `{count}`.

## v0.40 · 4 Nov 2026

- **Purpose, Composition, Story.** A `credit` slot holds the attribution a licence or source asks for. It is fixed or filled by the implementation, never written by AI.

## v0.39 · 4 Nov 2026

- **Story.** A theme per page, and an example photo.
- **Place.** `opening:` and the `{street}` variable.
- **Composition.** `flow:` takes a panel inset and a photo item.

## v0.38 · 4 Nov 2026

- **Place.** A `capacity` block (indoor, outdoor).
- **Story.** `{week-hours}` writes the week, one line per run of days with the same times.
- **Purpose.** In a one-column labelled list, a line without a label continues the item above.

## v0.37 · 4 Nov 2026

- **Place.** New file type: address, coordinates, maps link, context and weekly opening hours.
- **Story.** `place:` and the variables `{place}`, `{address}`, `{hours}`, `{opens}`, `{closes}`. Sky and weather use the place's coordinates.

## v0.36 · 4 Nov 2026

- **Purpose.** `photo:` takes a comma list; a new page starts with the first photo in season. A story page's `photo:` overrides it.

## v0.35 · 3 Nov 2026

- **Purpose, Story.** `scrim: none` takes the brand's scrim off.

## v0.34 · 3 Nov 2026

- **Brand.** `scrim` in `photo-look`: a dark gradient under light text on photos, at most this dark.

## v0.33 · 3 Nov 2026

- **Purpose.** List grids: `columns`, labels above, `labelSize`, `divider`.

## v0.32 · 3 Nov 2026

- **Brand.** A `location` block (name, latitude, longitude).
- **Story.** `{sunrise}`, `{sunset}`, `{day-length}` and `{moon}` from the location; `{temperature}`, `{wind}` and `{weather}` from a forecast, never guessed.

## v0.31 · 2 Nov 2026

- **Story.** A page's `photo:` takes a comma list, one per date.

## v0.30 · 2 Nov 2026

- **Format.** `post: feed | story` says how a page is posted. Without it, the format is not posted.

## v0.29 · 2 Nov 2026

- **Format.** Category `facebook`.

## v0.28 · 1 Nov 2026

- **Story.** A page can name its `photo:`, overriding the purpose's default.

## v0.27 · 30 Oct 2026

- **Brand.** App settings leave the language: `app-icon`, `favicon`, `og-image` and `tokens` describe an app, not a brand. *Breaking.*

## v0.26 · 30 Oct 2026

- **Purpose, Story.** Illustrations on purposes and story pages.

## v0.25 · 30 Oct 2026

- **Story.** New file type: ordered pages, each a purpose placed by a composition, with fixed, variable and open slots.

## v0.24 · 29 Oct 2026

- **Format, Brand.** `no:` on a format and `domain:` on a brand are gone: both were deployment decisions, not the brand. *Breaking.*

## v0.23 · 27 Oct 2026

- **Purpose.** `example` blocks hold whole pages (topic, goal, when, slot texts). Slots hold the form, examples the content; slot `samples:` are deprecated.

## v0.22 · 27 Oct 2026

- **Identity.** Voice `instead` pairs (phrase -> replacement), `say:` and `not:` on values, imagery `always`/`never`, image themes, goals, and `review` questions for copy and image.
- **Brand.** Framing `caption:` and `goals:`; a photo's `framing:`, `place:`, `person:` and `taken:`.
- **Purpose.** `goal:`, and `words:`/`sentences:` ranges on slots.

## v0.21 · 27 Oct 2026

- **Brand.** A `headline` theme slot (default `text-primary`; pair themes: text).

## v0.20.2 · 27 Oct 2026

- No language change.

## v0.20.1 · 27 Oct 2026

- **Brand.** A tone counts as its colour in the family reach check.

## v0.20 · 27 Oct 2026

- **Brand.** Tone ladders with `$name.step` references, family `$refs`, levels with family overrides, and undated families.

## v0.19 · 20 Oct 2026

- **Brand.** `photo-fallback:` in colour families: the colours, in order, for text over a photo no pair colour reads on.

## v0.18 · 20 Oct 2026

- **Brand.** Date windows (named yearly ranges) and `when:` on photos. **Purpose.** Samples can be bound to a window.

## v0.17 · 20 Oct 2026

- **Brand.** A `photo-look` block: saturation, contrast, warmth, fade, mono, duotone, fixed.

## v0.16 · 19 Oct 2026

- **Brand.** Colour families take a start date, `from: MM-DD`.

## v0.15 · 19 Oct 2026

- **Brand.** `camera` and `framing` blocks. **Purpose.** Camera facing and a framing module.

## v0.14 · 18 Oct 2026

- **Brand.** `hyphenate: fit` hyphenates a word only when it doesn't fit at the smallest size. Without the flag, words are never broken.

## v0.13 · 18 Oct 2026

- **Brand.** Icon sets (font glyphs, SVGs, Phosphor icons) and a `counter` block, with `counter-bg`/`counter-fg` theme slots.
- **Purpose.** List markers: `none`, `counter` or `icon`.

## v0.12.1 · 18 Oct 2026

- No language change.

## v0.12 · 18 Oct 2026

- **Brand.** `color-mode: brand`: new pages start from a declared theme.

## v0.11 · 17 Oct 2026

- **Brand.** Asset blocks take an optional `group:`.

## v0.10 · 17 Oct 2026

- **Brand.** Theme ground/figure pairs derive the remaining slots; `color-rules` (contrast minimums, avoided combinations); `color-families` (cyclic or sequential); logo variants per alignment.

## v0.9 · 22 Apr 2026

- **Identity.** `purpose:`, why the brand exists.
- **Brand.** Logos take `gltf:` for a 3D model, or `generator:` and `generator-params` for procedural artwork; `src` stays the 2D fallback.

## v0.8 · 21 Apr 2026

- **Brand.** Grouped `brand-colors` (primary, secondary, accent, neutral) with roles, meanings and weights; `state-colors`, `color-bounds`, and `color-mode`, `color-strategy`, `color-adherence`.

## v0.7 · 21 Apr 2026

- **Tooling.** The `/brief` skill exports a portable markdown brand brief.

## v0.6 · 21 Apr 2026

- **Brand.** Theme slots take alpha (`$ref 80%`); `brand-colors` stay solid. Divider `color:` is gone, the theme's `divider` slot decides. *Breaking.*
- **Purpose.** Slots are editable by default; `editable: false` locks one.

## v0.5.1 · 16 Apr 2026

- No language change.

## v0.5 · 16 Apr 2026

- **Purpose.** `editable:` on slots; `value:` sets fixed text AI never overwrites; `analyze: false` skips photo and video analysis.

## v0.4.4 · 15 Apr 2026

- **Purpose.** `bg-prompt:` describes the background for an empty placeholder.

## v0.4.3 · 14 Apr 2026

- No language change.

## v0.4.2 · 14 Apr 2026

- **Composition.** Illustrations take an `offset X Y` from their anchor.

## v0.4.1 · 14 Apr 2026

- **Brand.** `illustration` asset blocks, like logos, photos and videos.

## v0.4 · 13 Apr 2026

- **Composition.** `illustration:` places a decorative illustration: anchor, fit and scale.

## v0.3.2 · 12 Apr 2026

- **Format.** The grid's `band` terminology is gone; it is `rows` throughout. *Breaking.*

## v0.3.1 · 11 Apr 2026

- No language change.

## v0.3 · 11 Apr 2026

- **Brand.** Fonts take `variable:` and `static-*` files, for exports that can't embed variable fonts.
- **Tooling.** The parser ships as an npm export.

## v0.2 · 10 Apr 2026

- **Brand.** `label` and `cta` badge styles; logo, photo and video asset blocks. The `ai-context` block is gone, the `.identity` carries it. *Breaking.*
- **Purpose.** Default logo, photo and video; `camera:`.
- **Tooling.** Parser types follow the file names: `ParsedArchetype` is `ParsedComposition`, `parseLayoutFile` is `parseCompositionFile`. *Breaking for parser users.*
- **All files.** A brand is one self-contained folder.

## v0.1.5 – v0.1.8 · 9 Apr 2026

- **Tooling.** `npx brand-intent init` installs the skills and scaffolds the Krume example. No language change.

## v0.1.4 · 9 Apr 2026

- First release: the five layers, `.identity`, `.brand`, `.format`, `.purpose` and `.composition`.
