/**
 * Regression test: every real brand file in brand-atelier must still parse
 * cleanly with this parser.
 *
 * Atelier may lawfully be behind a breaking change it has not adopted yet: a parse error whose
 * message names the version it came with ("… since v0.44") is tolerated while Atelier's
 * package.json pins an older brand-intent. Once Atelier is bumped, it fails the suite again.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseBrandFile, photoLibrary } from '../parser/brandParser';

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
  const brandFile = join(brandDir, `${brandId}.brand`);
  try {
    const content = readFileSync(brandFile, 'utf8');
    const parsed = parseBrandFile(content, brandFile);
    const photoIndex = join(brandDir, 'photos', 'index.json');
    if (existsSync(photoIndex)) photoLibrary(parsed.assets?.photos, JSON.parse(readFileSync(photoIndex, 'utf8')), brandFile);
    const groupsLabel = parsed.colorGroups ? `${parsed.colorGroups.length} groups` : 'flat';
    const colorCount = Object.keys(parsed.brandColors ?? {}).length;
    console.log(`  ✓ ${brandId}: ${colorCount} colors (${groupsLabel}), ${Object.keys(parsed.themes ?? {}).length} themes`);
    pass++;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (tolerated(message)) { console.log(`  ~ ${brandId}: ${message} (Atelier not yet bumped)`); toleratedCount++; }
    else { console.log(`  ✗ ${brandId}: ${message}`); fail++; }
  }
}

console.log(`\n${pass} brands parsed, ${fail} failed${toleratedCount ? `, ${toleratedCount} behind the bump` : ''}`);
if (fail > 0) process.exit(1);
