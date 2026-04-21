/**
 * Regression test: every real brand file in brand-atelier must still parse
 * cleanly after the v0.8.0 parser changes.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseBrandFile } from '../parser/brandParser';

const BRANDS_DIR = '/Users/christophestoll/Documents/GitHub/brand-atelier/app/public/brands';

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
    const groupsLabel = parsed.colorGroups ? `${parsed.colorGroups.length} groups` : 'flat';
    const colorCount = Object.keys(parsed.brandColors ?? {}).length;
    console.log(`  ✓ ${brandId}: ${colorCount} colors (${groupsLabel}), ${Object.keys(parsed.themes ?? {}).length} themes`);
    pass++;
  } catch (err) {
    console.log(`  ✗ ${brandId}: ${err instanceof Error ? err.message : err}`);
    fail++;
  }
}

console.log(`\n${pass} brands parsed, ${fail} failed`);
if (fail > 0) process.exit(1);
