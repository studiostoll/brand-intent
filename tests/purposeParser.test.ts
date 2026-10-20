/**
 * Tests for .purpose slot typography overrides.
 *
 * Run: npm test
 */

import { parsePurposeFile } from '../parser/purposeParser';

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

const PURPOSE = (override: string) => `id: p\ncompositions: panel\n\nslot primary\n  label: Headline\n  typography: headline\n  maxLength: 40\n  samples: a\n  override:\n${override}`;

console.log('\npurpose overrides:');

test('hyphenate: bare, true, false, fit', () => {
  const h = (line: string) => parsePurposeFile(PURPOSE(`    ${line}\n`), 'p.purpose').slots[0].typographyOverrides?.hyphenate;
  assertEq(h('hyphenate'), true, 'bare');
  assertEq(h('hyphenate: true'), true, 'true');
  assertEq(h('hyphenate: false'), false, 'false');
  assertEq(h('hyphenate: fit'), 'fit', 'fit');
});

test('camera: false hides, front | rear override facing', () => {
  const c = (line: string) => {
    const p = parsePurposeFile(`id: p\ncompositions: panel\n${line}\n\nslot primary\n  label: Headline\n  typography: headline\n  maxLength: 40\n  samples: a\n`, 'p.purpose');
    return [p.camera, p.cameraFacing];
  };
  assertEq(c('camera: false'), [false, undefined], 'false');
  assertEq(c('camera: true'), [true, undefined], 'true');
  assertEq(c('camera: front'), [true, 'front'], 'front');
  assertEq(c('camera: rear'), [true, 'rear'], 'rear');
});

test('framing: names a brand framing module', () => {
  const f = (line: string) => parsePurposeFile(`id: p\ncompositions: panel\n${line}\n\nslot primary\n  label: Headline\n  typography: headline\n  maxLength: 40\n  samples: a\n`, 'p.purpose').framing;
  assertEq(f('framing: mensch'), 'mensch', 'id');
  assertEq(f('framing:'), undefined, 'empty');
  assertEq(f(''), undefined, 'absent');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
