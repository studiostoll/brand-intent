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

Installs the Brand Intent skill for your AI agent. The skill handles everything else: onboard your brand through a guided interview, explore the Krume bakery reference, generate and validate on-brand content.

```bash
npx brand-intent init
```

## Documentation

- [Specification](SPEC.md): formal grammar for all five file types
- [Design Decisions](DESIGN.md): reasoning behind the framework
- [intent.stoll.studio](https://intent.stoll.studio): project landing page

## License

MIT

---

By [Christophe Stoll / Studio Stoll](https://stoll.studio)
