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

console.log('\nsample windows:');

test('goal: names an identity goal', () => {
  const g = (line: string) => parsePurposeFile(`id: p\ncompositions: panel\n${line}\n\nslot primary\n  label: Headline\n  typography: headline\n  maxLength: 40\n  samples: a\n`, 'p.purpose').goal;
  assertEq(g('goal: localhood'), 'localhood', 'goal');
  assertEq(g(''), undefined, 'absent');
});

test('words: and sentences: ranges on a slot', () => {
  const slot = (props: string) => parsePurposeFile(`id: p\ncompositions: panel\n\nslot primary\n  label: Headline\n  typography: headline\n  maxLength: 60\n${props}  samples: a\n`, 'p.purpose').slots[0];
  assertEq(slot('  words: 3..8\n').words, { min: 3, max: 8 }, 'words range');
  assertEq(slot('  sentences: 1\n').sentences, { min: 1, max: 1 }, 'single sentence');
  assertEq(slot('').words, undefined, 'absent');
  for (const bad of ['  words: 8..3\n', '  words: 0\n', '  sentences: one\n']) {
    let threw = false;
    try { slot(bad); } catch { threw = true; }
    assertEq(threw, true, `rejects ${bad.trim()}`);
  }
});

test('@name marker sets sampleWindows and is stripped from the text', () => {
  const slot = (samples: string, type = '') => parsePurposeFile(`id: p\ncompositions: panel\n\nslot primary\n  label: Headline\n  typography: headline\n  maxLength: 80\n${type}${samples}`, 'p.purpose').slots[0];
  const inline = slot('  samples: Raps blüht im Mai @rapsbluete | Hafen Burgstaaken\n');
  assertEq(inline.samples, ['Raps blüht im Mai', 'Hafen Burgstaaken'], 'inline samples');
  assertEq(inline.sampleWindows, ['rapsbluete', undefined], 'inline windows');
  const multi = slot('  samples:\n    - Zugvögel über Wallnau  @zugvoegel\n      zweite Zeile\n    - Ganzjährig\n');
  assertEq(multi.samples, ['Zugvögel über Wallnau\nzweite Zeile', 'Ganzjährig'], 'multi samples');
  assertEq(multi.sampleWindows, ['zugvoegel', undefined], 'multi windows');
  assertEq(slot('  samples: a | b\n').sampleWindows, undefined, 'no markers');
  assertEq(slot('  samples: Mail an info@example.org\n').samples, ['Mail an info@example.org'], 'mid-word @ untouched');
});

test('@name marker on a continuation line throws', () => {
  let threw = false;
  try {
    parsePurposeFile(`id: p\ncompositions: panel\n\nslot primary\n  label: Headline\n  typography: headline\n  maxLength: 80\n  samples:\n    - Erste Zeile\n      Raps blüht @rapsbluete\n`, 'p.purpose');
  } catch (e) { threw = /first line/.test((e as Error).message); }
  assertEq(threw, true, 'throws');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
