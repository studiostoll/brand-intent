# Brand Intent

An open language to describe a brand: its voice, its behaviour, its look and the facts it stands on. People and AI agents read and write it alike.

Five layers. One brand. Any agent.

```
Identity → Brand → Format → Purpose → Composition
```

## What this is

Design tokens capture decisions. Brand guidelines capture rules. Neither captures *intent*: the reasoning, the derived expression conditions, the signal-level decisions that make a brand specific.

Brand Intent is a set of five composable file types that encode brand knowledge from strategy to composition, in a format any AI agent can read and respect.

| Layer | File | Question |
|-------|------|----------|
| Identity | `.identity` | Who is this brand? |
| Brand | `.brand` | How is it expressed? |
| Format | `.format` | Where does it appear? |
| Purpose | `.purpose` | What is this content for? |
| Composition | `.composition` | How are elements composed? |

Plus `.story`: ordered pages built from purposes and compositions, with fixed, variable and open texts. A story needs to know when, where, who and what, and each answer is a fact file: `.time` says when (founding, seasons, windows, the day), `.place` says where (address, capacity, opening hours), `.person` says who (name, role, quotes, and what the person agreed to), `.group` says who when it is more than one (a band, an estate, a mill), `.work` says what the brand puts out or puts on (a bread, a record, a class, an event, with its own date).

## Get started

### 1. Install the VS Code extension

Syntax highlighting, autocomplete, and hover documentation for all file types. To check a brand's files, run `npx brand-intent check path/to/brand`.

```
ext install studiostoll.brand-intent-lang
```

### 2. Run init

Installs two skills into your AI agent: `/brand-intent` and `/brief`. Together they cover the full loop. Onboard your brand, explore the Krume bakery reference, generate and validate on-brand content, and export a portable brief.

```bash
npx brand-intent init
```

### 3. Use your brand

Two skills are now installed in your AI agent.

- **`/brand-intent`** authors, validates, and generates on-brand content from your Brand Intent files.
- **`/brief`** exports a portable `{brand-id}-brief.md`. Use it to hand the brand to a tool that doesn't read Brand Intent directly, like a Claude Design project, another LLM, or a collaborator.

Edit your Brand Intent files whenever strategy or expression evolves. Regenerate briefs after any change.

Check a brand folder after every change: every file parses, and every id a file names is there.

```bash
npx brand-intent check path/to/brand
npx brand-intent media path/to/brand    # after adding or moving photos or videos: rewrite their index.json
```

## Documentation

- [Specification](SPEC.md): formal grammar for all file types
- [intent.stoll.studio](https://intent.stoll.studio): project landing page

## License

MIT

---

By [Christophe Stoll / Studio Stoll](https://stoll.studio)
