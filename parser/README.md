# Brand Intent - Reference Parser

TypeScript parsers for all Brand Intent file types.

## Parsers

| Parser | File Type | Function |
|--------|-----------|----------|
| `identityParser.ts` | `.identity` | `parseIdentityFile(content, fileName)` |
| `brandParser.ts` | `.brand` | `parseBrandFile(content, fileName)` |
| `formatParser.ts` | `.format` | `parseFormatFile(content, fileName)` |
| `purposeParser.ts` | `.purpose` | `parsePurposeFile(content, fileName)` |
| `compositionParser.ts` | `.composition` | `parseCompositionFile(content, fileName)` |
| `storyParser.ts` | `.story` | `parseStoryFile(content, fileName)`; `checkStory(story, brand, fileName)` checks it against the brand's purposes, compositions, formats, places, time and people |
| `placeParser.ts` | `.place` | `parsePlaceFile(content, fileName)` |
| `timeParser.ts` | `.time` | `parseTimeFile(content, fileName)`; `isInSeason(time, name, date)` answers a `when:` for a day |
| `personParser.ts` | `.person` | `parsePersonFile(content, fileName)` |
| `groupParser.ts` | `.group` | `parseGroupFile(content, fileName)` |
| `workParser.ts` | `.work` | `parseWorkFile(content, fileName)`; `isWorkInSeason(work, time, date)` says whether content about the work fits a day, `daysUntil(work, date)` counts to its next `on:` day |

Cross-file checks: `checkBrand(brand, { time, people, groups, works }, fileName)` (photo `when:`, `person:`, `group:` and `work:`, family `season:`), `checkPurpose(purpose, { time, works }, fileName)` (example `when:` and `work:`), `checkPerson(person, { groups, places })`, `checkGroup(group, { people })` (membership on both sides), `checkWork(work, { people, groups, time, places })` (`by:`, `when:`, `place:`), `checkStory` (above). Each returns problems as `file: message`. `checkFiles(files)` (`checkFiles.ts`) runs all of them over a brand's parsed files and adds what no single file shows: a format's `purposes:`, a purpose's `compositions:`, `scope` audiences and slot `color:`, the variables in purpose examples, duplicate ids, unused compositions. It returns `{ severity, file, message }` per issue; `brand-intent check` is this function plus the photo index.

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

- These parsers throw on validation errors, with the filename and line number included in the error message.
- Non-fatal findings (deprecated syntax, blocks that moved to another file) are returned in `warnings` (`parsePurposeFile`, `parseBrandFile`) as `file:line: message`, so implementations can show them in their UI.
