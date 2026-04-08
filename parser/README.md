# Brand Intent — Reference Parser

TypeScript parsers for all five Brand Intent file types. Extracted from [Brand Atelier](https://atelier.stoll.studio).

## Parsers

| Parser | File Type | Function |
|--------|-----------|----------|
| `brandParser.ts` | `.brand` | `parseBrandFile(content, fileName)` |
| `formatParser.ts` | `.format` | `parseFormatFile(content, fileName)` |
| `purposeParser.ts` | `.purpose` | `parsePurposeFile(content, fileName)` |
| `compositionParser.ts` | `.composition` / `.layout` | `parseLayoutFile(content, fileName)` |

All parsers are **pure functions**: they take a string (file content) and a filename (for error messages), and return a parsed object. No I/O, no side effects, no dependencies beyond `types.ts`.

## Usage

```typescript
import { readFileSync } from 'fs';
import { parseBrandFile, parsePurposeFile } from './parser';

const brand = parseBrandFile(
  readFileSync('brands/krume/krume.brand', 'utf-8'),
  'krume.brand'
);

const purpose = parsePurposeFile(
  readFileSync('purposes/daily-bread.purpose', 'utf-8'),
  'daily-bread.purpose'
);
```

## Notes

- The composition parser is named `compositionParser.ts` but exports `parseLayoutFile()` — this reflects the rename from `.layout` to `.composition` (the function name will be updated in a future version).
- The `.identity` file type does not have a dedicated parser yet. Identity files use the same line-based syntax as brand files but with a different key vocabulary.
- These parsers throw on validation errors, with the filename and line number included in the error message.
