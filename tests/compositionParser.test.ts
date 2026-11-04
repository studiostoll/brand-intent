/**
 * Tests for .composition flow blocks: panel `inset` and the `| photo` flow item.
 *
 * Run: npm test
 */

import { parseCompositionFile } from '../parser/compositionParser';

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

const comp = (body: string) => parseCompositionFile(`id: c\nmode: flow\nlogo: top left\n${body}`, 'c.composition');

// ── credit slot ──────────────────────────────────────────────────────────────

test('credit is a slot in a sticky bar and in the flow', () => {
  const c = comp(`image: full\n\nsticky: bottom s\n  | credit left bottom\n\nflow:\n  | primary left\n  | credit left\n`);
  assertEq(c.sticky[0].items.map(i => i.type === 'slot' ? i.id : i.type), ['credit'], 'sticky credit');
  assertEq(c.flow?.items.filter(i => i.type === 'slot').map(i => i.type === 'slot' && i.id), ['primary', 'credit'], 'flow credit');
});

// ── panel inset ──────────────────────────────────────────────────────────────

test('panel without inset has no inset flag', () => {
  assertEq(comp(`image: full\n\nflow: panel bottom-left 3/5 1/3\n  | primary left\n`).flow?.panel,
    { position: 'bottom-left', widthFraction: 0.6, heightFraction: 1 / 3 });
});

test('panel inset after the fractions', () => {
  assertEq(comp(`image: full\n\nflow: panel bottom-left 3/5 1/3 inset\n  | primary left\n`).flow?.panel?.inset, true);
});

test('panel inset without fractions keeps the defaults', () => {
  const panel = comp(`image: full\n\nflow: panel top-right inset\n  | primary left\n`).flow?.panel;
  assertEq(panel?.position, 'top-right');
  assertEq(panel?.widthFraction, 2 / 3);
  assertEq(panel?.inset, true);
});

test('unknown word after the panel fractions throws', () => {
  assertThrows(() => comp(`image: full\n\nflow: panel bottom-left 3/5 1/3 inside\n  | primary left\n`), /unexpected "inside"/, 'panel');
});

// ── photo flow item ──────────────────────────────────────────────────────────

test('photo item with align and size', () => {
  const items = comp(`flow:\n  | spacer-auto\n  | photo center l\n  | primary left\n`).flow?.items;
  assertEq(items?.[1], { type: 'photo', align: 'center', size: 'l' });
});

test('photo item defaults to center m', () => {
  assertEq(comp(`flow:\n  | photo\n  | primary left\n`).flow?.items[0], { type: 'photo', align: 'center', size: 'm' });
});

test('photo item keeps the default image (the flow photo is the image)', () => {
  const c = comp(`flow:\n  | photo left s\n  | primary left\n`);
  assertEq(c.image, 'full');
  assertEq(c.imageExplicit, false);
});

test('photo item with explicit image: throws', () => {
  assertThrows(() => comp(`image: full\n\nflow:\n  | photo center\n`), /can't be combined/, 'image');
});

test('photo item in a panel throws', () => {
  assertThrows(() => comp(`flow: panel bottom-left\n  | photo center\n`), /only allowed in a plain/, 'panel');
});

test('two photo items throw', () => {
  assertThrows(() => comp(`flow:\n  | photo center\n  | photo center\n`), /one photo at most/, 'two');
});

test('bad photo align and size throw', () => {
  assertThrows(() => comp(`flow:\n  | photo middle\n`), /invalid photo align/, 'align');
  assertThrows(() => comp(`flow:\n  | photo center xl\n`), /invalid photo size/, 'size');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
