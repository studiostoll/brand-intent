/**
 * Tests for pair themes, color-rules and color-families (v0.10.0).
 *
 * Run: npm test
 */

import { parseBrandFile } from '../parser/brandParser';
import {
  contrastRatio,
  toneClass,
  reachableFamilies,
  enumerateFamilyPairs,
  familyIndexForDate,
  DEFAULT_COLOR_RULES,
} from '../parser/colorSystem';

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

function assertEq<T>(actual: T, expected: T, label = 'value') {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}
function assertThrows(fn: () => unknown, matcher: RegExp, label: string) {
  try {
    fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!matcher.test(msg)) throw new Error(`${label}: expected error matching ${matcher}, got "${msg}"`);
    return;
  }
  throw new Error(`${label}: expected to throw, but did not`);
}

const HEADER = `id: test\nname: Test\nlanguage: en\nlocale: en-US\n`;

// ── Contrast + tone math ──────────────────────────────────────────────────────

console.log('\nContrast and tones:');

test('black on white is 21:1', () => {
  assertEq(contrastRatio('#000000', '#FFFFFF').toFixed(1), '21.0');
});

test('tone classes with default thresholds', () => {
  assertEq(toneClass('#F9FF9D'), 'light');
  assertEq(toneClass('#F4A14C'), 'mid');
  assertEq(toneClass('#263410'), 'dark');
});

// ── Pair themes ───────────────────────────────────────────────────────────────

console.log('\nPair themes:');

const PAIR_BRAND = `${HEADER}brand-colors
  gruen: #049A3B
  weiss: #FFFFFF
  schwarz: #1A1A1A

theme Gruen
  ground: $gruen
  figure: $weiss
  text:   $weiss

theme Override
  ground: $weiss
  figure: $gruen
  text:   $schwarz
  cta:    $schwarz
`;

test('pair theme derives all slots', () => {
  const out = parseBrandFile(PAIR_BRAND, 't.brand');
  const t = out.themes!.Gruen;
  assertEq(t.background, '#049A3B', 'background');
  assertEq(t['text-primary'], '#FFFFFF', 'text-primary');
  assertEq(t['text-secondary'], 'rgba(255, 255, 255, 0.85)', 'text-secondary');
  assertEq(t.logo, '#FFFFFF', 'logo');
  assertEq(t['sticker-fg'], '#049A3B', 'sticker-fg');
  assertEq(t['label-fg'], '#049A3B', 'label-fg');
  assertEq('ground' in t, false, 'pair keys removed from slots');
  assertEq(out.themePairs!.Gruen, { ground: '#049A3B', figure: '#FFFFFF', text: '#FFFFFF' }, 'themePairs');
});

test('explicit slot overrides derived value', () => {
  const t = parseBrandFile(PAIR_BRAND, 't.brand').themes!.Override;
  assertEq(t.cta, '#1A1A1A', 'cta');
  assertEq(t.logo, '#049A3B', 'logo');
});

test('text resolves to black/white when omitted and no neutral group', () => {
  const src = `${HEADER}brand-colors\n  gelb: #F6EA65\n  rot: #E32D39\ntheme Gelb\n  ground: $gelb\n  figure: $rot\n`;
  assertEq(parseBrandFile(src, 't.brand').themes!.Gelb['text-primary'], '#000000');
});

test('ground without figure is rejected', () => {
  const src = `${HEADER}brand-colors\n  a: #FFFFFF\ntheme X\n  ground: $a\n`;
  assertThrows(() => parseBrandFile(src, 't.brand'), /needs both "ground:" and "figure:"/, 'half pair');
});

test('pair color with alpha is rejected', () => {
  const src = `${HEADER}brand-colors\n  a: #FFFFFF\n  b: #000000\ntheme X\n  ground: $a 50%\n  figure: $b\n`;
  assertThrows(() => parseBrandFile(src, 't.brand'), /solid 6-digit color/, 'alpha ground');
});

// ── color-rules ───────────────────────────────────────────────────────────────

console.log('\ncolor-rules:');

test('parses rules', () => {
  const src = `${HEADER}brand-colors\n  a: #FFFFFF\ncolor-rules\n  text: 7\n  figure: 3\n  avoid: light+light, mid+mid\n  tones: 1.5, 5\n`;
  assertEq(parseBrandFile(src, 't.brand').colorRules, { text: 7, figure: 3, avoid: [['light', 'light'], ['mid', 'mid']], tones: [1.5, 5] });
});

test('rejects unknown tone in avoid', () => {
  const src = `${HEADER}brand-colors\n  a: #FFFFFF\ncolor-rules\n  avoid: light+bright\n`;
  assertThrows(() => parseBrandFile(src, 't.brand'), /avoid "light\+bright"/, 'bad avoid');
});

test('warns on slot theme below text rule', () => {
  const src = `${HEADER}brand-colors\n  gruen: #049A3B\n  weiss: #FFFFFF\ncolor-rules\n  text: 4.5\ntheme Gruen\n  background: $gruen\n  text-primary: $weiss\n  logo: $weiss\n`;
  const w = parseBrandFile(src, 't.brand').colorWarnings ?? [];
  assertEq(w.length, 1, 'warning count');
  assertEq(/text-primary #FFFFFF on #049A3B is 3\.\d:1/.test(w[0]), true, 'warning text');
});

test('no rule warnings without color-rules block', () => {
  const src = `${HEADER}brand-colors\n  gruen: #049A3B\n  weiss: #FFFFFF\ntheme Gruen\n  background: $gruen\n  text-primary: $weiss\n`;
  assertEq(parseBrandFile(src, 't.brand').colorWarnings, undefined);
});

// ── Reach ─────────────────────────────────────────────────────────────────────

console.log('\nReach:');

const reach = (count: number, i: number, order: 'cycle' | 'sequence', borrow: 'previous' | 'next' | 'both' | 'none', distance = 1) =>
  [...reachableFamilies(count, i, { order, borrow, distance }).entries()].sort((a, b) => a[0] - b[0]);

test('cycle both distance 1 wraps', () => {
  assertEq(reach(4, 0, 'cycle', 'both'), [[1, 'next'], [3, 'prev']]);
});
test('cycle previous only', () => {
  assertEq(reach(4, 0, 'cycle', 'previous'), [[3, 'prev']]);
});
test('sequence does not wrap at the edges', () => {
  assertEq(reach(5, 0, 'sequence', 'both'), [[1, 'next']]);
  assertEq(reach(5, 4, 'sequence', 'both'), [[3, 'prev']]);
});
test('sequence distance 2 from the middle', () => {
  assertEq(reach(5, 2, 'sequence', 'both', 2), [[0, 'prev'], [1, 'prev'], [3, 'next'], [4, 'next']]);
});
test('cycle of 6 with distance 2 skips the opposite', () => {
  assertEq(reach(6, 0, 'cycle', 'both', 2), [[1, 'next'], [2, 'next'], [4, 'prev'], [5, 'prev']]);
});
test('borrow none reaches nothing', () => {
  assertEq(reach(4, 1, 'cycle', 'none'), []);
});

// ── Fehmarn seasons fixture ───────────────────────────────────────────────────

console.log('\ncolor-families (seasons fixture):');

const seasons = (borrow: string, extra = '') => `${HEADER}brand-colors
  blau: #0000F8
  weiss: #FFFFFF

color-rules
  text: 4.5
  figure: 3
  avoid: light+light, mid+mid

color-mode: guided

color-families
  order: cycle
  borrow: ${borrow}
  shared: $blau, $weiss
${extra}
  family Winter
    core:     #006EFA  Blau-W
    accent:   #415C55
    accent:   #BCD6E2
    contrast: #263410
    pairs
      #006EFA / #F9FF9D
      #263410 / #B6E1FC
      #F9FF9D / #0000F8
      #BCD6E2 / #0000F8
      #263410 / #FC5529
      #415C55 / #BCD6E2
      #0000F8 / #BCD6E2

  family Fruehling
    core:     #B6E1FC
    accent:   #B5E5CB
    accent:   #F9FF9D
    contrast: #0F4C5C
    pairs
      #B6E1FC / #0F4C5C
      #0F4C5C / #B5E5CB
      #B5E5CB / #0000F8
      #F9FF9D / #0F4C5C
      #0000F8 / #F9FF9D
      #0F4C5C / #F9FF9D
      #BCD6E2 / #0F4C5C

  family Sommer
    core:     #F8EDAD
    accent:   #558648
    accent:   #F4A14C
    contrast: #1A2E5C
    pairs
      #F8EDAD / #558648
      #1A2E5C / #F4A14C
      #F4A14C / #1A2E5C
      #F8EDAD / #0000F8
      #4A2215 / #F4A14C
      #1A2E5C / #B6E1FC
      #0F4C5C / #F4A14C

  family Herbst
    core:     #FC5529
    accent:   #6F927E
    accent:   #844A33
    contrast: #4A2215
    pairs
      #4A2215 / #FC5529
      #F8EDAD / #844A33
      #844A33 / #F4A14C
      #844A33 / #F8EDAD
      #FFFFFF / #FC5529
      #F4A14C / #4A2215
      #BCD6E2 / #844A33
`;

const rejectedCount = (src: string) => {
  const out = parseBrandFile(src, 't.brand');
  return out.colorFamilies!.families.flatMap(f => f.pairs).filter(p => !p.valid).length;
};

test('all 28 pairs valid with borrow: both', () => {
  const out = parseBrandFile(seasons('both'), 't.brand');
  const pairs = out.colorFamilies!.families.flatMap(f => f.pairs);
  assertEq(pairs.length, 28, 'pair count');
  assertEq(pairs.filter(p => !p.valid).map(p => p.reasons), [], 'rejected');
  assertEq(Object.keys(out.themes!).length, 28, 'emitted themes');
});

test('borrow: previous rejects 5', () => assertEq(rejectedCount(seasons('previous')), 5));
test('borrow: next rejects 8', () => assertEq(rejectedCount(seasons('next')), 8));

test('family colors join the flat projection with generated names', () => {
  const out = parseBrandFile(seasons('both'), 't.brand');
  assertEq(out.brandColors!['blau-w'], '#006EFA', 'authored name');
  assertEq(out.brandColors!['winter-accent-2'], '#BCD6E2', 'generated accent name');
  assertEq(out.brandColors!['herbst-contrast'], '#4A2215', 'generated contrast name');
});

test('text falls back to white when the contrast color fails', () => {
  const out = parseBrandFile(seasons('both'), 't.brand');
  assertEq(out.themePairs!['Winter-1'], { ground: '#006EFA', figure: '#F9FF9D', text: '#FFFFFF', family: 'Winter' });
  assertEq(out.themes!['Winter-1']['text-primary'], '#FFFFFF');
});

test('text uses the family contrast color on light grounds', () => {
  const out = parseBrandFile(seasons('both'), 't.brand');
  assertEq(out.themePairs!['Fruehling-1'].text, '#0F4C5C');
});

test('rejected pair names its owning family', () => {
  const out = parseBrandFile(seasons('previous'), 't.brand');
  const w = (out.colorWarnings ?? []).find(x => x.startsWith('Winter-1'));
  assertEq(!!w && /#F9FF9D from Fruehling is out of reach/.test(w), true, `warning: ${w}`);
  assertEq(out.themes!['Winter-1'], undefined, 'rejected pair emits no theme');
});

test('guided passes with families and no grouped brand-colors', () => {
  assertEq(parseBrandFile(seasons('both'), 't.brand').colorMode, 'guided');
});

test('distance covering every family warns', () => {
  const w = parseBrandFile(seasons('both', '  distance: 2'), 't.brand').colorWarnings ?? [];
  assertEq(w.some(x => /reaches every family/.test(x)), true);
});

test('enumeration excludes the opposite season', () => {
  const out = parseBrandFile(seasons('both'), 't.brand');
  const sys = out.colorFamilies!;
  const pairs = enumerateFamilyPairs(0, sys, { order: 'cycle', borrow: 'both', distance: 1 }, out.colorRules!);
  const valid = pairs.filter(p => p.valid);
  const sommer = sys.families[2].colors.map(c => c.hex);
  assertEq(valid.some(p => sommer.includes(p.ground) || sommer.includes(p.figure)), false, 'no Sommer color in Winter');
  assertEq(valid.length > 28 / 4, true, 'more valid pairs than the curated ones');
  assertEq(valid.every(p => p.figureRatio >= DEFAULT_COLOR_RULES.figure), true, 'contrast floor');
});

test('family needs exactly one core', () => {
  const src = `${HEADER}brand-colors\n  w: #FFFFFF\ncolor-families\n  family A\n    accent: #000000\n    contrast: #111111\n`;
  assertThrows(() => parseBrandFile(src, 't.brand'), /exactly one core/, 'missing core');
});

test('unknown family key is rejected', () => {
  const src = `${HEADER}brand-colors\n  w: #FFFFFF\ncolor-families\n  family A\n    core: #000000\n    highlight: #111111\n`;
  assertThrows(() => parseBrandFile(src, 't.brand'), /expected from \/ core \/ accent \/ contrast \/ pairs/, 'bad role');
});

test('invalid borrow is rejected', () => {
  assertThrows(() => parseBrandFile(seasons('sideways'), 't.brand'), /borrow must be/, 'bad borrow');
});
test('photo-fallback resolves refs in declared order, absent when not declared', () => {
  const out = parseBrandFile(seasons('both', '  photo-fallback: $weiss, $blau'), 't.brand');
  assertEq(out.colorFamilies!.photoFallback, [{ name: 'weiss', hex: '#FFFFFF' }, { name: 'blau', hex: '#0000F8' }]);
  assertEq(parseBrandFile(seasons('both'), 't.brand').colorFamilies!.photoFallback, undefined);
});
test('photo-fallback rejects unknown and non-$ refs', () => {
  assertThrows(() => parseBrandFile(seasons('both', '  photo-fallback: $nachtblau'), 't.brand'), /photo-fallback "\$nachtblau" is not a known/, 'unknown ref');
  assertThrows(() => parseBrandFile(seasons('both', '  photo-fallback: #000050'), 't.brand'), /photo-fallback entries must be \$refs/, 'hex');
});

const dated = (a: string, b: string) =>
  `${HEADER}brand-colors\n  w: #FFFFFF\ncolor-families\n  family A\n    from: ${a}\n    core: #000000\n    contrast: #111111\n  family B\n    ${b}\n    core: #222222\n    contrast: #333333\n`;

test('family from: is parsed', () => {
  const out = parseBrandFile(dated('12-01', 'from: 06-01'), 't.brand');
  assertEq(out.colorFamilies!.families.map(f => f.from), ['12-01', '06-01']);
});

test('from: on some families only is rejected', () => {
  assertThrows(() => parseBrandFile(dated('12-01', 'accent: #444444'), 't.brand'), /every family or on none \(missing: B\)/, 'partial from');
});

test('from: must be a real MM-DD', () => {
  assertThrows(() => parseBrandFile(dated('13-01', 'from: 06-01'), 't.brand'), /must be "MM-DD"/, 'month 13');
  assertThrows(() => parseBrandFile(dated('04-31', 'from: 06-01'), 't.brand'), /must be "MM-DD"/, 'April 31');
});

test('duplicate from: is rejected', () => {
  assertThrows(() => parseBrandFile(dated('06-01', 'from: 06-01'), 't.brand'), /share from: 06-01/, 'same date');
});

test('familyIndexForDate picks the season, wrapping over new year', () => {
  const fam = [{ from: '12-01' }, { from: '03-01' }, { from: '06-01' }, { from: '09-01' }];
  const at = (m: number, d: number) => familyIndexForDate(fam, new Date(2026, m - 1, d));
  assertEq(at(1, 15), 0, 'January → winter');
  assertEq(at(2, 28), 0, 'end of Feb → winter');
  assertEq(at(3, 1), 1, '1 March → spring');
  assertEq(at(8, 31), 2, 'end of Aug → summer');
  assertEq(at(10, 19), 3, 'October → autumn');
  assertEq(at(12, 1), 0, '1 Dec → winter');
  assertEq(familyIndexForDate([{}, {}], new Date()), -1, 'no dates');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
