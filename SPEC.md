# Brand Intent — Specification

> Work in progress. This document will contain the formal grammar and rules for all five Brand Intent file types.

## File Types

| Extension | Layer | Question |
|-----------|-------|----------|
| `.identity` | Identity | Who is this brand? |
| `.brand` | Brand | What expression intent does it derive? |
| `.format` | Format | Where does this content appear? |
| `.purpose` | Purpose | What is this content trying to do? |
| `.composition` | Composition | How are elements composed? |

## Syntax Principles

1. Never JSON. The format should feel like writing CSS and structured AI prompts simultaneously.
2. YAML-like, but not YAML. Indentation-based block structure. No colons required for block headers.
3. `$reference` syntax for cross-referencing named values within the same file.
4. `#` comments everywhere. Comments are first-class.
5. Named blocks rather than keyed objects. `theme Basic` not `themes: { Basic: { ... } }`.
6. Presence as boolean. Some flags are set by presence alone.
7. Human-writable as a primary constraint.

## Layers

_To be specified: full grammar, key vocabularies, parsing rules, identity-filter/extension mechanics, composition mode details._

See [DESIGN.md](DESIGN.md) for the reasoning behind these decisions.
