# Brand Intent

An open file format specification for making brand intent machine-readable.

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

## Get started

### 1. Install the VS Code extension

Syntax highlighting, autocomplete, and validation for all five file types.

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

## Documentation

- [Specification](SPEC.md): formal grammar for all five file types
- [intent.stoll.studio](https://intent.stoll.studio): project landing page

## License

MIT

---

By [Christophe Stoll / Studio Stoll](https://stoll.studio)
