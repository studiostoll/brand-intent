/**
 * The shipped example brand must pass `brand-intent check`, and its identity has exactly one primary
 * narrative. `npx brand-intent init` copies examples/krume into every new project, so this is the
 * first Brand Intent file set most people open.
 *
 * Run: npm test
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseIdentityFile } from '../parser/index';
import { checkFolder } from '../cli/check';

const EXAMPLES = join(__dirname, '..', 'examples');
let fail = 0;

for (const brandId of readdirSync(EXAMPLES)) {
  const dir = join(EXAMPLES, brandId);
  const { errors, warnings, counts } = checkFolder(dir, `examples/${brandId}`);
  // The example is the model: a warning there is a fault.
  const problems = [...errors, ...warnings];
  const identity = parseIdentityFile(readFileSync(join(dir, `${brandId}.identity`), 'utf8'), `${brandId}.identity`);
  const primary = (identity.narratives ?? []).filter(n => n.primary).length;
  if (primary !== 1) problems.push(`${brandId}.identity: expected exactly one primary narrative, got ${primary}`);
  if (problems.length) { fail++; console.log(`  ✗ examples/${brandId}`); for (const p of problems) console.log(`      ${p}`); }
  else console.log(`  ✓ examples/${brandId}: ${Object.entries(counts).map(([e, n]) => `${n} .${e}`).join(', ')}`);
}

if (fail > 0) process.exit(1);
