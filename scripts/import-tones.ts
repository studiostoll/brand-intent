/**
 * Write the `tones` block of a .brand file from a Figma colour export.
 *
 *   npx tsx scripts/import-tones.ts <colour-export.json> <file.brand>
 *
 * The export (a Figma variables export) lists tone ladders per mode:
 * `modes.<mode>.tones.<row>.<step>` is a hex, or `[hex, alias]`. A ladder whose step aliases a
 * primitive (`Brand/Blue`, `Autumn/Accent 1`) is that colour's ladder; the step is its anchor.
 * Each color in the flat `brand-colors` block (`name: #HEX`) whose hex equals an anchor gets that
 * ladder, so names stay in the .brand file. Families reference those colors (`core: $name`).
 * Replaces an existing `tones` block in place, else inserts one after `brand-colors`.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { parseBrandFile } from '../parser/brandParser';

type Entry = string | [string, string];
interface Export {
  modes: Record<string, { tones: Record<string, Record<string, Entry>> }>;
  primitives: Record<string, string>;
}

const [exportPath, brandPath] = process.argv.slice(2);
if (!exportPath || !brandPath) {
  console.error('usage: npx tsx scripts/import-tones.ts <colour-export.json> <file.brand>');
  process.exit(1);
}

const data = JSON.parse(readFileSync(exportPath, 'utf8')) as Export;
const hexOf = (e: Entry) => (Array.isArray(e) ? e[0] : e).toUpperCase();

// Anchor hex → { primitive, ladder }. The same primitive appears in several modes; they must agree.
const ladders = new Map<string, { primitive: string; ladder: string[] }>();
let steps: string[] | null = null;
for (const [mode, { tones }] of Object.entries(data.modes)) {
  for (const [row, ladder] of Object.entries(tones)) {
    const rowSteps = Object.keys(ladder);
    if (!steps) steps = rowSteps;
    else if (rowSteps.join() !== steps.join()) throw new Error(`${mode}/${row}: steps ${rowSteps} differ from ${steps}`);
    const anchor = Object.values(ladder).find(e => Array.isArray(e) && e[1] in data.primitives) as [string, string] | undefined;
    if (!anchor) continue;
    const hex = anchor[0].toUpperCase();
    const values = Object.values(ladder).map(hexOf);
    const known = ladders.get(hex);
    if (known && known.ladder.join() !== values.join()) throw new Error(`${anchor[1]}: ladder differs between modes (${mode}/${row})`);
    ladders.set(hex, { primitive: anchor[1], ladder: values });
  }
}
if (!steps) throw new Error(`${exportPath}: no tones found`);

const source = readFileSync(brandPath, 'utf8');
const lines = source.split('\n');
const blockEnd = (start: number) => {
  let end = start + 1;
  while (end < lines.length && (lines[end] === '' || /^\s/.test(lines[end]))) end++;
  while (end > start + 1 && lines[end - 1] === '') end--;
  return end;
};
// Read brand-colors directly: the file may already reference tones it doesn't have yet.
const colorsStart = lines.findIndex(l => l === 'brand-colors');
if (colorsStart === -1) throw new Error(`${brandPath}: no brand-colors block`);
const brandColors = lines.slice(colorsStart + 1, blockEnd(colorsStart))
  .map(l => l.match(/^\s+([\w-]+):\s+(#[0-9a-fA-F]{6})\b/))
  .filter((m): m is RegExpMatchArray => !!m)
  .map(m => [m[1], m[2]] as const);
const matched = brandColors
  .map(([name, hex]) => ({ name, hex: hex.toUpperCase(), found: ladders.get(hex.toUpperCase()) }))
  .filter(c => c.found);
if (matched.length === 0) throw new Error(`${brandPath}: no brand color matches an anchor in ${exportPath}`);

const width = Math.max(...matched.map(c => c.name.length)) + 2;
const block = [
  `tones   # from ${basename(exportPath)} via scripts/import-tones.ts, don't edit by hand`,
  `  steps: ${steps.join(', ')}`,
  ...matched.map(c => `  ${`$${c.name}:`.padEnd(width + 1)} ${c.found!.ladder.join(' ')}`),
];

// Replace the existing block (header up to the next top-level line), or insert after brand-colors.
const existing = lines.findIndex(l => /^tones(\s+#.*)?$/.test(l.trim()) && !/^\s/.test(l));
if (existing !== -1) {
  lines.splice(existing, blockEnd(existing) - existing, ...block);
} else {
  lines.splice(blockEnd(colorsStart), 0, '', ...block);
}
const output = lines.join('\n');
parseBrandFile(output, basename(brandPath)); // the result must parse (anchors, step counts)
writeFileSync(brandPath, output);

console.log(`${brandPath}: tones for ${matched.length} colors × ${steps.length} steps = ${matched.length * steps.length} values`);
for (const c of matched) console.log(`  $${c.name} ← ${c.found!.primitive}`);
const unused = [...ladders.values()].filter(l => !matched.some(c => c.found === l)).map(l => l.primitive);
if (unused.length > 0) console.log(`not in the brand (no color with that hex): ${unused.join(', ')}`);
