/**
 * Parser tests for brand-colors grouped syntax, references, state-colors,
 * color-bounds, and color-mode minimum-structure validation (v0.8.0+).
 *
 * Run: npm test
 * (uses tsx — no build step, imports the parser directly)
 */

import { parseBrandFile } from '../parser/brandParser';

// ── Tiny test harness (no dep) ────────────────────────────────────────────────

let pass = 0;
let fail = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    pass++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    fail++;
    const msg = err instanceof Error ? err.message : String(err);
    failures.push(`  ✗ ${name}\n      ${msg}`);
    console.log(`  ✗ ${name}`);
    console.log(`      ${msg}`);
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
    if (!matcher.test(msg)) {
      throw new Error(`${label}: expected error matching ${matcher}, got "${msg}"`);
    }
    return;
  }
  throw new Error(`${label}: expected to throw, but did not`);
}

const HEADER = `id: test\nname: Test\nlanguage: en\nlocale: en-US\n`;

// ── Flat syntax still works (regression) ─────────────────────────────────────

console.log('\nFlat brand-colors (regression):');

test('parses flat colors', () => {
  const src = `${HEADER}brand-colors\n  primary: #0324B1\n  accent: #E32D39\n`;
  const out = parseBrandFile(src, 'test.brand');
  assertEq(out.brandColors, { primary: '#0324B1', accent: '#E32D39' }, 'brandColors');
  assertEq(out.colorGroups, undefined, 'colorGroups (should be undefined)');
});

test('parses flat colors with print specs', () => {
  const src = `${HEADER}brand-colors\n  primary: #0324B1\n    pantone: 286 C\n    cmyk: 97/80/0/31\n`;
  const out = parseBrandFile(src, 'test.brand');
  assertEq(out.brandColorPrint?.primary, { pantone: '286 C', cmyk: '97/80/0/31' }, 'brandColorPrint.primary');
});

test('rejects alpha in flat brand color (unchanged behavior)', () => {
  const src = `${HEADER}brand-colors\n  primary: #0324B1 75%\n`;
  assertThrows(() => parseBrandFile(src, 'test.brand'), /alpha syntax/, 'alpha reject');
});

// ── Grouped syntax ───────────────────────────────────────────────────────────

console.log('\nGrouped brand-colors:');

const GROUPED_MIN = `${HEADER}brand-colors\n
  primary
    meaning: identity
    distribution: 60%
    #2C1810  Espresso
      meaning: core mark
    #5C3A28  Walnut
      role: warmth

  neutral
    meaning: structure
    #FAF6F0  Flour
      role: light
    #2C1810  Espresso Text
      role: dark
`;

test('parses grouped syntax with 2 groups', () => {
  const out = parseBrandFile(GROUPED_MIN, 'test.brand');
  if (!out.colorGroups) throw new Error('colorGroups missing');
  assertEq(out.colorGroups.length, 2, 'group count');
  assertEq(out.colorGroups[0].key, 'primary', 'first group');
  assertEq(out.colorGroups[0].meaning, 'identity', 'primary meaning');
  assertEq(out.colorGroups[0].distribution, 60, 'primary distribution');
  assertEq(out.colorGroups[0].entries.length, 2, 'primary entries');
  assertEq(out.colorGroups[0].entries[0].hex, '#2C1810', 'first hex');
  assertEq(out.colorGroups[0].entries[0].name, 'Espresso', 'first name');
  assertEq(out.colorGroups[0].entries[0].meaning, 'core mark', 'first meaning');
});

test('first-declared entry becomes default in identity group', () => {
  const out = parseBrandFile(GROUPED_MIN, 'test.brand');
  assertEq(out.colorGroups![0].entries[0].isDefault, true, 'Espresso isDefault');
  assertEq(out.colorGroups![0].entries[1].isDefault, undefined, 'Walnut is not default');
});

test('explicit role: default wins over first-declared', () => {
  const src = `${HEADER}brand-colors\n
  primary
    #2C1810  Espresso
    #5C3A28  Walnut
      role: default
  neutral
    #FAF6F0  Flour
      role: light
    #1C1E26  Slate
      role: dark
`;
  const out = parseBrandFile(src, 'test.brand');
  assertEq(out.colorGroups![0].entries[0].isDefault, undefined, 'Espresso not default');
  assertEq(out.colorGroups![0].entries[1].isDefault, true, 'Walnut default');
});

test('flat projection generated from grouped entries', () => {
  const out = parseBrandFile(GROUPED_MIN, 'test.brand');
  assertEq(out.brandColors?.['espresso'], '#2C1810', 'flat projection espresso');
  assertEq(out.brandColors?.['walnut'], '#5C3A28', 'flat projection walnut');
  assertEq(out.brandColors?.['flour'], '#FAF6F0', 'flat projection flour');
});

test('neutral group rejects distribution', () => {
  const src = `${HEADER}brand-colors\n
  primary
    #2C1810  Espresso
  neutral
    distribution: 20%
    #FAF6F0  Flour
      role: light
    #1C1E26  Slate
      role: dark
`;
  assertThrows(() => parseBrandFile(src, 'test.brand'), /neutral group cannot declare distribution/, 'neutral distribution reject');
});

test('neutral role must be in fixed vocabulary', () => {
  const src = `${HEADER}brand-colors\n
  primary
    #2C1810  Espresso
  neutral
    #FAF6F0  Flour
      role: light
    #1C1E26  Slate
      role: depth
`;
  assertThrows(() => parseBrandFile(src, 'test.brand'), /not in the fixed vocabulary/, 'bad neutral role');
});

// ── Layer 2 references ──────────────────────────────────────────────────────

console.log('\nLayer 2 references:');

test('$primary.default resolves to first-declared primary', () => {
  const src = `${HEADER}brand-colors\n
  primary
    #2C1810  Espresso
    #5C3A28  Walnut

  neutral
    #FAF6F0  Flour
      role: light
    $primary.default
      role: dark
      meaning: text and structural weight
`;
  const out = parseBrandFile(src, 'test.brand');
  const neutral = out.colorGroups!.find(g => g.key === 'neutral')!;
  assertEq(neutral.entries[1].hex, '#2C1810', 'ref hex');
  assertEq(neutral.entries[1].name, 'Espresso', 'ref name (inherited)');
  assertEq(neutral.entries[1].role, 'dark', 'ref role (authored locally)');
  assertEq(neutral.entries[1].meaning, 'text and structural weight', 'ref meaning (authored locally)');
  assertEq(neutral.entries[1].referencedFrom, 'primary.default', 'referencedFrom recorded');
});

test('$primary.<role> (non-default) resolves by role match', () => {
  const src = `${HEADER}brand-colors\n
  primary
    #2C1810  Espresso
    #5C3A28  Walnut
      role: warmth

  neutral
    #FAF6F0  Flour
      role: light
    $primary.warmth
      role: dark
`;
  const out = parseBrandFile(src, 'test.brand');
  const neutral = out.colorGroups!.find(g => g.key === 'neutral')!;
  assertEq(neutral.entries[1].hex, '#5C3A28', 'ref hex for $primary.warmth');
  assertEq(neutral.entries[1].name, 'Walnut', 'ref name');
});

test('forward reference is rejected', () => {
  const src = `${HEADER}brand-colors\n
  primary
    $neutral.light
      role: light
  neutral
    #FAF6F0  Flour
      role: light
    #1C1E26  Slate
      role: dark
`;
  assertThrows(() => parseBrandFile(src, 'test.brand'), /declared earlier|unknown group/, 'forward reference reject');
});

// ── Minimum structure for guided ────────────────────────────────────────────

console.log('\ncolor-mode: guided minimum structure:');

test('guided with flat syntax is rejected', () => {
  const src = `${HEADER}color-mode: guided\nbrand-colors\n  primary: #0324B1\n`;
  assertThrows(() => parseBrandFile(src, 'test.brand'), /requires grouped brand-colors/, 'flat+guided reject');
});

test('guided without neutral is rejected', () => {
  const src = `${HEADER}color-mode: guided\nbrand-colors\n
  primary
    #0324B1  Blue
`;
  assertThrows(() => parseBrandFile(src, 'test.brand'), /requires a "neutral" group/, 'missing neutral');
});

test('guided without neutral.light is rejected', () => {
  const src = `${HEADER}color-mode: guided\nbrand-colors\n
  primary
    #0324B1  Blue

  neutral
    #1C1E26  Slate
      role: dark
`;
  assertThrows(() => parseBrandFile(src, 'test.brand'), /role "light"/, 'missing neutral.light');
});

test('guided with minimum structure parses', () => {
  const src = `${HEADER}color-mode: guided\nbrand-colors\n
  primary
    #0324B1  Blue

  neutral
    #FAFAFA  White
      role: light
    #1C1E26  Slate
      role: dark
`;
  const out = parseBrandFile(src, 'test.brand');
  assertEq(out.colorMode, 'guided', 'colorMode');
});

// ── state-colors, color-bounds, adherence ───────────────────────────────────

console.log('\nstate-colors / color-bounds / adherence:');

test('state-colors parses flat hex values', () => {
  const src = `${HEADER}state-colors\n  problem: #C62828\n  success: #2E7D32\n  info: #1565C0\n`;
  const out = parseBrandFile(src, 'test.brand');
  assertEq(out.stateColors, { problem: '#C62828', success: '#2E7D32', info: '#1565C0' }, 'stateColors');
});

test('state-colors rejects non-hex values', () => {
  const src = `${HEADER}state-colors\n  problem: red\n`;
  assertThrows(() => parseBrandFile(src, 'test.brand'), /not a valid hex/, 'bad state hex');
});

test('color-bounds parses numeric values', () => {
  const src = `${HEADER}color-bounds\n  light: 0.95\n  dark: 0.04\n  saturation-floor: 15\n`;
  const out = parseBrandFile(src, 'test.brand');
  assertEq(out.colorBounds, { light: 0.95, dark: 0.04, saturationFloor: 15 }, 'colorBounds');
});

test('color-mode and color-strategy parse', () => {
  const src = `${HEADER}color-mode: dynamic\ncolor-strategy: duotone\n`;
  const out = parseBrandFile(src, 'test.brand');
  assertEq(out.colorMode, 'dynamic', 'colorMode');
  assertEq(out.colorStrategy, 'duotone', 'colorStrategy');
});

test('color-mode rejects unknown value', () => {
  const src = `${HEADER}color-mode: magical\n`;
  assertThrows(() => parseBrandFile(src, 'test.brand'), /color-mode must be/, 'bad color-mode');
});

test('color-adherence with tolerance overrides', () => {
  const src = `${HEADER}color-adherence: on-brand\n  hue-tolerance: 4\n  sat-tolerance: 8\n`;
  const out = parseBrandFile(src, 'test.brand');
  assertEq(out.colorAdherence, 'on-brand', 'colorAdherence');
  assertEq(out.colorAdherenceOverrides, { hueTolerance: 4, satTolerance: 8 }, 'overrides');
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(f);
  process.exit(1);
}
