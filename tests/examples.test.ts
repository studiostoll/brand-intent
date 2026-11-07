/**
 * The shipped example brand must parse with the shipped parser.
 * `npx brand-intent init` copies examples/krume into every new project, so this is
 * the first Brand Intent file set most people open.
 *
 * Run: npm test
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  parseIdentityFile, parseBrandFile, parseFormatFile, parsePurposeFile,
  parseCompositionFile, parseStoryFile, parsePlaceFile, checkStory,
} from '../parser/index';
import type { ParsedPurpose, ParsedPlace } from '../parser/index';

const EXAMPLES = join(__dirname, '..', 'examples');

let pass = 0;
let fail = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    pass++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    fail++;
    console.log(`  ✗ ${name}`);
    console.log(`      ${err instanceof Error ? err.message : String(err)}`);
  }
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
}

for (const brandId of readdirSync(EXAMPLES)) {
  const dir = join(EXAMPLES, brandId);
  console.log(`\nexamples/${brandId}:`);

  const files = walk(dir);
  const read = (f: string) => readFileSync(f, 'utf8');
  const name = (f: string) => relative(dir, f);
  const ofType = (ext: string) => files.filter(f => f.endsWith(`.${ext}`));

  const purposes: ParsedPurpose[] = [];
  const places: ParsedPlace[] = [];
  const compositions: string[] = [];
  const formats: string[] = [];
  let brand: ReturnType<typeof parseBrandFile> | undefined;

  for (const f of ofType('identity')) test(name(f), () => {
    const out = parseIdentityFile(read(f), name(f));
    const primary = (out.narratives ?? []).filter(n => n.primary);
    if (primary.length !== 1) throw new Error(`expected exactly one primary narrative, got ${primary.length}`);
  });
  for (const f of ofType('brand')) test(name(f), () => { brand = parseBrandFile(read(f), name(f)); });
  for (const f of ofType('format')) test(name(f), () => { formats.push(parseFormatFile(read(f), name(f)).id); });
  for (const f of ofType('purpose')) test(name(f), () => {
    const out = parsePurposeFile(read(f), name(f));
    if (out.warnings?.length) throw new Error(out.warnings.join('; '));
    purposes.push(out);
  });
  for (const f of ofType('composition')) test(name(f), () => { compositions.push(parseCompositionFile(read(f), name(f)).id); });
  for (const f of ofType('place')) test(name(f), () => { places.push(parsePlaceFile(read(f), name(f))); });

  // Cross-file checks: a purpose's framing, goal-free slots, and every story against the rest.
  test('purpose typography and framing exist in the .brand', () => {
    if (!brand) throw new Error('no .brand parsed');
    for (const p of purposes) {
      for (const s of p.slots) {
        if (s.typographyRef && !brand.typographies?.[s.typographyRef]) throw new Error(`${p.id}: typography "${s.typographyRef}" is not in the .brand`);
      }
      if (p.framing && !brand.framings?.some(fr => fr.id === p.framing)) throw new Error(`${p.id}: framing "${p.framing}" is not in the .brand`);
    }
  });

  for (const f of ofType('story')) test(name(f), () => {
    if (!brand) throw new Error('no .brand parsed');
    const story = parseStoryFile(read(f), name(f));
    const problems = checkStory(story, {
      purposes, compositions, formats, places,
      themes: Object.keys(brand.themes ?? {}),
      photos: (brand.assets?.photos ?? []).map(p => p.id),
      illustrations: (brand.assets?.illustrations ?? []).map(i => i.id),
      windows: Object.keys(brand.windows ?? {}),
      location: !!brand.location,
    }, name(f));
    if (problems.length) throw new Error(problems.join('; '));
  });
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
