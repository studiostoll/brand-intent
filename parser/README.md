# Brand Intent - Reference Parser

TypeScript parsers for all five Brand Intent file types.

## Parsers

| Parser | File Type | Function |
|--------|-----------|----------|
| `identityParser.ts` | `.identity` | `parseIdentityFile(content, fileName)` |
| `brandParser.ts` | `.brand` | `parseBrandFile(content, fileName)` |
| `formatParser.ts` | `.format` | `parseFormatFile(content, fileName)` |
| `purposeParser.ts` | `.purpose` | `parsePurposeFile(content, fileName)` |
| `compositionParser.ts` | `.composition` | `parseLayoutFile(content, fileName)` |

All parsers are **pure functions**: they take a string (file content) and a filename (for error messages), and return a parsed object. No I/O, no side effects, no dependencies beyond `types.ts`.

## Usage

```typescript
import { readFileSync } from 'fs';
import { parseIdentityFile, parseBrandFile } from './parser';

const identity = parseIdentityFile(
  readFileSync('examples/krume/krume.identity', 'utf-8'),
  'krume.identity'
);

const brand = parseBrandFile(
  readFileSync('examples/krume/krume.brand', 'utf-8'),
  'krume.brand'
);
```

## Notes

- The composition parser exports `parseLayoutFile()` - the function name will be updated to `parseCompositionFile()` in a future version.
- These parsers throw on validation errors, with the filename and line number included in the error message.
