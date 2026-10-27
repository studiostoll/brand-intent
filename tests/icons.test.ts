/**
 * Tests for brand icon sets (`icons`), the `counter` block, counter theme slots,
 * icon references and list markers in .purpose files.
 *
 * Run: npm test
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseBrandFile } from '../parser/brandParser';
import { parsePurposeFile } from '../parser/purposeParser';
import { resolveIconRef, parseListItem } from '../parser/icons';

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
const FONTS = `font primary\n  name: Inter\n  fallback: sans-serif\n\nfont display\n  name: Display Serif\n  fallback: serif\n`;
const brand = (body: string) => parseBrandFile(`${HEADER}${FONTS}${body}`, 'test.brand');

// ── icons block ──────────────────────────────────────────────────────────────

console.log('\nicons block:');

test('parses all four source kinds in order', () => {
  const out = brand(`icons\n  quote: font $display U+201C   # opening quote\n  pin:   font $display icon.pin\n  map:   icons/map.svg\n  wave:  phosphor wave light\n`);
  assertEq(out.icons, [
    { id: 'quote', source: { kind: 'font', font: 'display', codepoint: 0x201c } },
    { id: 'pin', source: { kind: 'font', font: 'display', glyph: 'icon.pin' } },
    { id: 'map', source: { kind: 'svg', src: 'icons/map.svg' } },
    { id: 'wave', source: { kind: 'phosphor', name: 'Wave', weight: 'light' } },
  ], 'icons');
});

test('font glyph without $font uses the first font', () => {
  const out = brand(`icons\n  quote: font U+201C\n`);
  assertEq(out.icons?.[0].source, { kind: 'font', font: 'primary', codepoint: 0x201c }, 'source');
});

test('kebab Phosphor names become PascalCase', () => {
  const out = brand(`icons\n  pin: phosphor map-pin\n`);
  assertEq(out.icons?.[0].source, { kind: 'phosphor', name: 'MapPin' }, 'source');
});

test('no icons block → undefined', () => {
  assertEq(brand('').icons, undefined, 'icons');
});

test('rejects unknown font', () => {
  assertThrows(() => brand(`icons\n  quote: font $mono U+201C\n`), /unknown font "\$mono"/, 'unknown font');
});
test('rejects font ref without $', () => {
  assertThrows(() => brand(`icons\n  quote: font display U+201C\n`), /must start with "\$"/, 'missing $');
});
test('rejects bad codepoint', () => {
  assertThrows(() => brand(`icons\n  quote: font U+20\n`), /invalid codepoint/, 'codepoint');
});
test('rejects duplicate ids', () => {
  assertThrows(() => brand(`icons\n  pin: icons/a.svg\n  pin: icons/b.svg\n`), /duplicate icon "pin"/, 'duplicate');
});
test('rejects unknown source', () => {
  assertThrows(() => brand(`icons\n  pin: icons/pin.png\n`), /invalid icon source/, 'png');
});
test('rejects bad Phosphor weight', () => {
  assertThrows(() => brand(`icons\n  pin: phosphor map-pin heavy\n`), /invalid icon weight/, 'weight');
});
test('rejects empty block', () => {
  assertThrows(() => brand(`icons\n`), /icons block is empty/, 'empty');
});

// ── counter block ────────────────────────────────────────────────────────────

console.log('\ncounter block:');

test('parses counter with em units', () => {
  const out = brand(`typography counter\n  weight: 600\n  size: 3\n\ncounter\n  format: 01\n  typography: counter\n  shape: pill\n  size: 1.2em\n  padding: 0.25em\n`);
  assertEq(out.counter, { format: '01', shape: 'pill', size: 1.2, padding: 0.25, typography: 'counter' }, 'counter');
});
test('counter defaults', () => {
  assertEq(brand(`counter\n  format: (1)\n`).counter, { format: '(1)', shape: 'circle', size: 1, padding: 0.2 }, 'counter');
});
test('rejects unknown typography', () => {
  assertThrows(() => brand(`counter\n  typography: nope\n`), /not a declared typography/, 'typography');
});
test('rejects unknown format / shape / property', () => {
  assertThrows(() => brand(`counter\n  format: A\n`), /counter format/, 'format');
  assertThrows(() => brand(`counter\n  shape: star\n`), /counter shape/, 'shape');
  assertThrows(() => brand(`counter\n  colour: red\n`), /unknown counter property/, 'property');
});

// ── counter theme slots ──────────────────────────────────────────────────────

console.log('\ncounter theme slots:');

test('pair themes derive counter-bg / counter-fg', () => {
  const out = brand(`brand-colors\n  green: #1B4D3E\n  white: #FFFFFF\n\ntheme Green\n  ground: $green\n  figure: $white\n`);
  assertEq(out.themes?.Green['counter-bg'], '#FFFFFF', 'counter-bg');
  assertEq(out.themes?.Green['counter-fg'], '#1B4D3E', 'counter-fg');
});
test('explicit themes fall back to label-bg / label-fg', () => {
  const out = brand(`brand-colors\n  a: #111111\n  b: #EEEEEE\n\ntheme T\n  background: $b\n  label-bg: $a\n  label-fg: $b\n`);
  assertEq([out.themes?.T['counter-bg'], out.themes?.T['counter-fg']], ['#111111', '#EEEEEE'], 'counter');
});
test('explicit counter slots win', () => {
  const out = brand(`brand-colors\n  a: #111111\n  b: #EEEEEE\n\ntheme T\n  label-bg: $a\n  counter-bg: $b\n`);
  assertEq(out.themes?.T['counter-bg'], '#EEEEEE', 'counter-bg');
});

// ── purpose references and markers ───────────────────────────────────────────

console.log('\npurpose icons and markers:');

const PURPOSE = (top: string, list: string) => `id: p\ncompositions: panel\n${top}\nslot detail\n  label: List\n  typography: body\n  type: list\n    maxItems: 3\n    maxLength: 40\n${list}`;

test('defaultIcon: brand id, Phosphor fallback, explicit phosphor:', () => {
  const p = (v: string) => parsePurposeFile(PURPOSE(`defaultIcon: ${v}`, '    samples: a\n'), 'p.purpose').defaultIcon;
  assertEq(p('quote'), { id: 'quote' }, 'bare');
  assertEq(p('phosphor:quotes duotone'), { id: 'quotes', library: 'phosphor', weight: 'duotone' }, 'phosphor');
  assertThrows(() => p('Quotes'), /invalid icon id/, 'PascalCase rejected');
});

test('marker + slot defaultIcon + [id] samples', () => {
  const out = parsePurposeFile(PURPOSE('', '    marker: icon\n    defaultIcon: pin\n    samples:\n      - [harbour] Hafen Burgstaaken\n        Südstrand\n'), 'p.purpose');
  const slot = out.slots[0];
  assertEq([slot.marker, slot.defaultIcon], ['icon', { id: 'pin' }], 'slot');
  assertEq(parseListItem(slot.samples[0].split('\n')[0]), { icon: { id: 'harbour' }, text: 'Hafen Burgstaaken' }, 'item');
});

test('icons: true → marker counter (deprecated)', () => {
  const out = parsePurposeFile(PURPOSE('', '    icons: true\n    samples: a\n'), 'p.purpose');
  assertEq(out.slots[0].marker, 'counter', 'marker');
});

test('iconOnly implies marker icon, rejects counter', () => {
  const out = parsePurposeFile(PURPOSE('', '    iconOnly: true\n'), 'p.purpose');
  assertEq(out.slots[0].marker, 'icon', 'marker');
  assertThrows(() => parsePurposeFile(PURPOSE('', '    iconOnly: true\n    marker: counter\n'), 'p.purpose'), /iconOnly needs "marker: icon"/, 'counter');
});

test('[id] sample and defaultIcon need marker icon', () => {
  assertThrows(() => parsePurposeFile(PURPOSE('', '    samples: [pin] Hafen\n'), 'p.purpose'), /no "marker: icon"/, 'sample');
  assertThrows(() => parsePurposeFile(PURPOSE('', '    marker: counter\n    defaultIcon: pin\n    samples: a\n'), 'p.purpose'), /defaultIcon needs "marker: icon"/, 'defaultIcon');
});

test('rejects invalid marker', () => {
  assertThrows(() => parsePurposeFile(PURPOSE('', '    marker: bullet\n    samples: a\n'), 'p.purpose'), /invalid marker/, 'marker');
});

// ── resolveIconRef ───────────────────────────────────────────────────────────

console.log('\nresolveIconRef:');

test('brand set first, then Phosphor; phosphor: skips the set', () => {
  const icons = brand(`icons\n  quote: font $display U+201C\n`).icons;
  assertEq(resolveIconRef({ id: 'quote' }, icons).kind, 'brand', 'brand');
  assertEq(resolveIconRef({ id: 'map-pin', weight: 'bold' }, icons), { kind: 'phosphor', name: 'MapPin', weight: 'bold' }, 'fallback');
  assertEq(resolveIconRef({ id: 'quote', library: 'phosphor' }, icons), { kind: 'phosphor', name: 'Quote' }, 'explicit');
  assertEq(resolveIconRef({ id: 'quote' }, undefined).kind, 'phosphor', 'no set');
});

// ── real purpose files still parse ───────────────────────────────────────────

const BRANDS_DIR = '/Users/christophestoll/Documents/GitHub/brand-atelier/app/public/brands';
if (existsSync(BRANDS_DIR)) {
  console.log('\nreal purposes:');
  for (const brandId of readdirSync(BRANDS_DIR)) {
    const dir = join(BRANDS_DIR, brandId, 'purposes');
    if (!existsSync(dir)) continue;
    test(brandId, () => {
      for (const f of readdirSync(dir).filter(f => f.endsWith('.purpose'))) {
        parsePurposeFile(readFileSync(join(dir, f), 'utf8'), `${brandId}/${f}`);
      }
    });
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
