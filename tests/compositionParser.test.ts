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

// ── flow width ───────────────────────────────────────────────────────────────

test('flow width is a share of the flow width', () => {
  const c = comp(`image: full\n\nflow: width 3/4\n  | primary left\n`);
  assertEq(c.flow?.width, 3 / 4);
  assertEq(c.flow?.panel, undefined);
  assertEq(comp(`image: full\n\nflow:\n  | primary left\n`).flow?.width, undefined);
});

test('flow width needs a fraction above 0 and at most 1/1', () => {
  assertThrows(() => comp(`flow: width\n  | primary left\n`), /invalid flow width/, 'none');
  assertThrows(() => comp(`flow: width 5/4\n  | primary left\n`), /at most 1\/1/, 'too wide');
  assertThrows(() => comp(`flow: width 0/4\n  | primary left\n`), /above 0/, 'zero');
});

test('unknown flow type throws', () => {
  assertThrows(() => comp(`flow: narrow\n  | primary left\n`), /unknown flow type "narrow"/, 'type');
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

// ── anchored flows ───────────────────────────────────────────────────────────

test('anchored flows: top with a distance, bottom, centre', () => {
  const c = comp(`flow: top xl\n  | label right\nflow: center\n  | primary center\n  | spacer-m\n  | secondary center\nflow: bottom\n  | meta left\n`);
  assertEq(c.flow, null, 'no plain flow');
  assertEq(c.anchoredFlows.map(f => f.anchor), [{ edge: 'top', distance: 'xl' }, { edge: 'center' }, { edge: 'bottom' }], 'anchors');
  assertEq(c.anchoredFlows[1].items.length, 3, 'centre items');
});

test('a plain flow stays as it was', () => {
  const c = comp(`flow:\n  | primary left\n`);
  assertEq(c.anchoredFlows, [], 'no anchored flows');
  assertEq(c.flow?.anchor, undefined, 'no anchor');
});

test('2xl and 3xl are distances', () => {
  assertEq(comp(`flow: bottom 3xl\n  | primary left\n`).anchoredFlows[0].anchor, { edge: 'bottom', distance: '3xl' }, '3xl');
});

test('anchored flow errors', () => {
  assertThrows(() => comp(`flow: center m\n  | primary center\n`), /a centre offset needs a sign: \+m moves it down, -m up/, 'centre offset without sign');
  assertThrows(() => comp(`flow: top 4xl\n  | primary left\n`), /invalid flow distance/, 'unknown token');
  assertThrows(() => comp(`flow: top -20\n  | primary left\n`), /invalid flow distance "-20"/, 'negative distance');
  assertThrows(() => comp(`flow: top 20px\n  | primary left\n`), /invalid flow distance "20px"/, 'unit');
  assertThrows(() => comp(`flow: center +4xl\n  | primary left\n`), /invalid centre offset "\+4xl"/, 'unknown token offset');
  assertThrows(() => comp(`flow: top m l\n  | primary left\n`), /unexpected "l"/, 'extra word');
  assertThrows(() => comp(`flow: bottom\n  | primary left\n  | spacer-auto\n`), /spacer-auto/, 'spacer-auto');
  assertThrows(() => comp(`flow: bottom\n  | photo center\n`), /only allowed in a plain/, 'photo');
});

test('numbers are cqmin with decimals, a centre offset carries its sign', () => {
  const c = comp(`flow: top 6.85\n  | label right\nflow: center -4.44\n  | primary center\nflow: bottom 10\n  | meta left\n`);
  assertEq(c.anchoredFlows.map(f => f.anchor), [{ edge: 'top', distance: 6.85 }, { edge: 'center', distance: -4.44 }, { edge: 'bottom', distance: 10 }], 'anchors');
  assertEq(comp(`flow: center -m\n  | primary center\n`).anchoredFlows[0].anchor, { edge: 'center', distance: '-m' }, 'token up');
  assertEq(comp(`flow: center +m\n  | primary center\n`).anchoredFlows[0].anchor, { edge: 'center', distance: 'm' }, 'token down');
});

test('on FORMAT: gives one format its own distance', () => {
  const c = comp(`flow: top 6.85\n  on 4:5: 12.04\n  on 1:1: xl\n  | label right\nflow: center\n  on 4:5: +4.44\n  | primary center\n`);
  assertEq(c.anchoredFlows[0].anchor, { edge: 'top', distance: 6.85, formats: { '4:5': 12.04, '1:1': 'xl' } }, 'top');
  assertEq(c.anchoredFlows[1].anchor, { edge: 'center', formats: { '4:5': 4.44 } }, 'centre without a default');
  assertEq(c.anchoredFlows[0].items.length, 1, 'on lines are not items');
});

test('on FORMAT: errors', () => {
  assertThrows(() => comp(`flow: top\n  on 4:5: +12\n  | primary left\n`), /invalid flow distance "\+12"/, 'sign on top');
  assertThrows(() => comp(`flow: center\n  on 4:5: 12\n  | primary center\n`), /needs a sign/, 'no sign on centre');
  assertThrows(() => comp(`flow: top\n  on 4:5: 12\n  on 4:5: 13\n  | primary left\n`), /twice/, 'twice');
  assertThrows(() => comp(`flow:\n  on 4:5: 12\n  | primary left\n`), /only allowed in an anchored flow/, 'plain flow');
  assertThrows(() => comp(`flow: top\n  on 4:5 12\n  | primary left\n`), /expected: on FORMAT: DISTANCE/, 'no colon');
});

test('a plain flow and an anchored flow can\'t be combined', () => {
  assertThrows(() => comp(`flow:\n  | primary left\nflow: top\n  | label left\n`), /can't be combined/, 'mixed');
});

test('a second plain flow throws', () => {
  assertThrows(() => comp(`flow:\n  | primary left\nflow:\n  | secondary left\n`), /second plain/, 'two plain');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
