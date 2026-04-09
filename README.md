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
| Brand | `.brand` | What expression intent does it derive? |
| Format | `.format` | Where does this content appear? |
| Purpose | `.purpose` | What is this content trying to do? |
| Composition | `.composition` | How are elements composed? |

## Get started

### 1. Install the VS Code extension

Syntax highlighting, autocomplete, and validation for all five file types.

```
ext install studiostoll.brand-intent-lang
```

### 2. Install skills for your AI agent

```bash
npx brand-intent install-skills
```

Works with Claude Code, Cursor, Gemini CLI, VS Code Copilot, Codex CLI, and any MCP-compatible agent.

### 3. Author your brand

Start with `.identity` (strategy, voice, audiences), then derive `.brand` (expression intent). Add formats, purposes, and compositions as needed. The Krume bakery brand in `brands/krume/` is a fully commented reference implementation.

```bash
npx brand-intent init --from krume
```

## Documentation

- [Specification](SPEC.md): formal grammar for all five file types
- [Design Decisions](DESIGN.md): reasoning behind the framework
- [intent.stoll.studio](https://intent.stoll.studio): project landing page

## Relationship to Impeccable

Brand Intent is complementary to [Impeccable](https://impeccable.style). Where Impeccable teaches agents *how to design well* (general craft), Brand Intent teaches them *what this brand's expression intent is* (specific identity). Together: execution quality and brand specificity.

## License

MIT

---

By [Christophe Stoll / Studio Stoll](https://stoll.studio)
