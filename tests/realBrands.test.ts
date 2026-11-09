/**
 * Regression test: every real brand in brand-atelier must pass `brand-intent check`
 * with this parser: every file parses and every id it names is there.
 *
 * Atelier may lawfully be behind a breaking change it has not adopted yet: a parse error whose
 * message names the version it came with ("… since v0.44") is tolerated while Atelier's
 * package.json pins an older brand-intent. Once Atelier is bumped, it fails the suite again.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { checkFolder } from '../cli/check';

const ATELIER = '/Users/christophestoll/Documents/GitHub/brand-atelier/app';
const BRANDS_DIR = `${ATELIER}/public/brands`;

const minor = (v: string): number => { const [a, b] = v.replace(/^[^\d]*/, '').split('.'); return Number(a) * 1000 + Number(b); };
let atelierPins = Infinity;
try { atelierPins = minor(JSON.parse(readFileSync(`${ATELIER}/package.json`, 'utf8')).dependencies['brand-intent']); } catch { /* no Atelier checkout: nothing is tolerated */ }
/** True for a breaking-change error newer than the parser Atelier pins. */
const tolerated = (message: string): boolean => {
  const m = /since v(\d+\.\d+)/.exec(message);
  return !!m && minor(m[1]) > atelierPins;
};
let toleratedCount = 0;

let pass = 0;
let fail = 0;

for (const brandId of readdirSync(BRANDS_DIR)) {
  const brandDir = join(BRANDS_DIR, brandId);
  let dirStat;
  try { dirStat = statSync(brandDir); } catch { continue; }
  if (!dirStat.isDirectory() || brandId.startsWith('.')) continue;
  // Every problem `brand-intent check` finds; a breaking-change error Atelier has not adopted yet is tolerated.
  const { errors, counts } = checkFolder(brandDir, brandId);
  const real = errors.filter(e => !tolerated(e));
  toleratedCount += errors.length - real.length;
  for (const e of errors.filter(tolerated)) console.log(`  ~ ${brandId}: ${e} (Atelier not yet bumped)`);
  if (real.length) { fail++; for (const e of real) console.log(`  ✗ ${brandId}: ${e}`); }
  else { pass++; console.log(`  ✓ ${brandId}: ${Object.values(counts).reduce((a, b) => a + b, 0)} files`); }
}

console.log(`\n${pass} brands parsed, ${fail} failed${toleratedCount ? `, ${toleratedCount} behind the bump` : ''}`);
if (fail > 0) process.exit(1);
