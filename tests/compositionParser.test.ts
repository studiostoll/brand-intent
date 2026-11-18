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

test('a composition places slots a purpose names itself', () => {
  const c = comp(`image: full\n\ngrid: 4\n\nopening-hours  row 2  cols 1--4  left\n\nsticky: bottom s\n  | opening-hours left\n\nflow:\n  | opening-hours left\n`);
  assertEq(c.slots.map(s => s.id), ['opening-hours'], 'grid slot');
  assertEq((c.flow?.items[0] as { id: string }).id, 'opening-hours', 'flow item');
});

test('a slot named like a keyword is an error', () => {
  assertThrows(() => comp(`sticky: bottom s\n  | spacer-wide left\n`), /"spacer-wide" can't name a slot/, 'sticky prefix');
  assertThrows(() => comp(`sticky: bottom s\n  | flow left\n`), /"flow" can't name a slot/, 'sticky');
  assertThrows(() => comp(`image: full\n\ngrid: 4\n\nlogo  row 2  cols 1--4  left\n`), /"logo" can't name a slot/, 'grid line');
});


const SIGN = `id: direction-sign
name: Direction sign
mode: regions
image: none

region head
  fields: 1-4
  logo: top left
  place: sender top 7-12
  group: kicker word
  stack: field 2
  fit: word

region foot
  fields: 5-6
  place: note top 1-5
  place: code bottom 1-5
  place: arrow bottom right 6-12
  group: note
  stack: neighbour 1.5x
  baseline: arrow
  size: code 4x
  size: arrow 19.6x
`;
const sign = (edit: (text: string) => string) => parseCompositionFile(edit(SIGN), 'sign.composition');

test('regions mode: the full example parses', () => {
  const c = parseCompositionFile(SIGN, 'sign.composition');
  assertEq(c.mode, 'regions', 'mode');
  assertEq(c.regions?.length, 2, 'regions');
  assertEq(c.regions?.[0], {
    id: 'head', fields: [1, 4],
    places: [{ slot: 'sender', edge: 'top', side: 'left', cols: [7, 12] }],
    logo: { v: 'top', h: 'left' },
    group: ['kicker', 'word'], stack: { field: 2 }, fit: ['word'],
  }, 'head');
  assertEq(c.regions?.[1], {
    id: 'foot', fields: [5, 6],
    places: [
      { slot: 'note', edge: 'top', side: 'left', cols: [1, 5] },
      { slot: 'code', edge: 'bottom', side: 'left', cols: [1, 5] },
      { slot: 'arrow', edge: 'bottom', side: 'right', cols: [6, 12] },
    ],
    group: ['note'], stack: { neighbour: true, gapX: 1.5 }, baseline: ['arrow'], sizes: { code: 4, arrow: 19.6 },
  }, 'foot');
  assertEq(c.image, 'none', 'image');
});

test('regions mode: mode is inferred from region blocks', () => {
  assertEq(sign(t => t.replace('mode: regions\n', '')).mode, 'regions');
});

test('regions mode: stack neighbour without a distance, fields as one number', () => {
  const c = sign(t => t.replace('stack: neighbour 1.5x', 'stack: neighbour').replace('fields: 5-6', 'fields: 5-6').replace('fields: 1-4', 'fields: 1-4'));
  assertEq(c.regions?.[1].stack, { neighbour: true });
  const one = parseCompositionFile('id: s\nregion a\n  fields: 1\n  place: x top 1-2\n', 's.composition');
  assertEq(one.regions?.[0].fields, [1, 1]);
});

test('regions mode: errors', () => {
  assertThrows(() => sign(t => t.replace('fields: 5-6', 'fields: 6-7')), /sign\.composition:\d+: region "foot" starts at field 6, expected 5/, 'gap');
  assertThrows(() => sign(t => t.replace('fields: 5-6', 'fields: 4-6')), /starts at field 4, expected 5/, 'overlap');
  assertThrows(() => sign(t => t.replace('fields: 1-4', 'fields: 2-4')), /region "head" starts at field 2, expected 1/, 'not from 1');
  assertThrows(() => sign(t => t.replace('fields: 1-4', 'fields: 4-1')), /invalid fields "4-1"/, 'descending');
  assertThrows(() => sign(t => t.replace('  fields: 1-4\n', '')), /region "head" needs "fields:"/, 'no fields');
  assertThrows(() => sign(t => t.replace('region foot', 'region foot\n  logo: bottom right')), /only one region may have a logo/, 'two logos');
  assertThrows(() => sign(t => t.replace('logo: top left', 'logo: middle left')), /invalid region logo/, 'logo shape');
  assertThrows(() => sign(t => t.replace('place: note top 1-5', 'place: sender top 1-5')), /sign\.composition:\d+: slot "sender" is placed twice/, 'placed twice');
  assertThrows(() => sign(t => t.replace('place: note top 1-5', 'place: note top 5-1')), /invalid columns "5-1"/, 'cols order');
  assertThrows(() => sign(t => t.replace('place: note top 1-5', 'place: note middle 1-5')), /invalid place/, 'edge');
  assertThrows(() => sign(t => t.replace('place: note top 1-5', 'place: logo top 1-5')), /"logo" can't name a slot/, 'reserved slot');
  assertThrows(() => sign(t => t.replace('  group: note\n', '')), /"stack:" needs "group:"/, 'stack without group');
  assertThrows(() => sign(t => t.replace('  stack: field 2\n', '')), /"group:" needs "stack:"/, 'group without stack');
  assertThrows(() => sign(t => t.replace('stack: field 2', 'stack: field 5')), /stack field 5, the region has 4 fields/, 'stack field range');
  assertThrows(() => sign(t => t.replace('stack: field 2', 'stack: below')), /invalid stack/, 'stack shape');
  assertThrows(() => sign(t => t.replace('1.5x', '1.5')), /invalid stack distance/, 'stack distance');
  assertThrows(() => sign(t => t.replace('size: code 4x', 'size: code 4')), /invalid size|invalid size/, 'size shape');
  assertThrows(() => sign(t => t.replace('fit: word', 'fit:')), /fit: needs at least one slot/, 'empty fit');
  assertThrows(() => sign(t => t.replace('fit: word', 'colour: word')), /unknown region key "colour"/, 'unknown key');
  assertThrows(() => sign(t => t.replace('region foot', 'region head')), /more than one region "head"/, 'duplicate id');
  assertThrows(() => sign(t => t.replace('region foot', 'region Foot')), /invalid region id "Foot"/, 'id shape');
});

test('regions mode: fields by content and the rest', () => {
  const c = sign(t => t.replace('fields: 1-4', 'fields: rest').replace('fields: 5-6', 'fields: content'));
  assertEq(c.regions?.map(r => r.fields), ['rest', 'content']);
  assertThrows(() => sign(t => t.replace('fields: 5-6', 'fields: content')), /fields by number and "content"\/"rest" don't mix/, 'mixed');
  assertThrows(() => sign(t => t.replace('fields: 1-4', 'fields: content').replace('fields: 5-6', 'fields: content')), /one "rest" region, none here/, 'no rest');
  assertThrows(() => sign(t => t.replace('fields: 1-4', 'fields: rest').replace('fields: 5-6', 'fields: rest')), /one "rest" region, not two/, 'two rests');
  assertThrows(() => sign(t => t.replace('fields: 1-4', 'fields: content').replace('fields: 5-6', 'fields: rest')), /a "content" region is as tall as what it holds/, 'content with a stack field');
  assertThrows(() => sign(t => t.replace('fields: 5-6', 'fields: some')), /invalid fields "some"/, 'shape');
});

test('regions mode: a line without fields, a box', () => {
  const c = sign(t => t.replace('fields: 1-4', 'fields: rest').replace('fields: 5-6', 'line: 2x\n  box: 7-12 0.5mm 0.75x'));
  assertEq(c.regions?.[1].fields, 'line', 'line');
  assertEq(c.regions?.[1].lineX, 2, 'line height');
  assertEq(c.regions?.[1].box, { cols: [7, 12], lineMm: 0.5, padX: 0.75 }, 'box');
  assertEq(sign(t => t.replace('fields: 5-6', 'line: 2x')).regions?.map(r => r.fields), [[1, 4], 'line'], 'a line beside fields by number');
  assertThrows(() => sign(t => t.replace('fields: 5-6', 'fields: 5-6\n  line: 2x')), /has its fields, a line has none/, 'fields and line');
  assertThrows(() => sign(t => t.replace('fields: 5-6', 'line: 2x\n  fields: 5-6')), /is a line, it has no fields/, 'line and fields');
  assertThrows(() => sign(t => t.replace('fields: 5-6', 'line: 2')), /invalid line "2"/, 'line shape');
  assertThrows(() => sign(t => t.replace('fields: 1-4', 'line: 2x').replace('fields: 5-6', 'line: 2x')), /at least one region needs "fields:"/, 'only lines');
  assertThrows(() => sign(t => t.replace('fields: 1-4', 'line: 2x').replace('fields: 5-6', 'fields: rest')), /is a line, its stack has no field/, 'line with a stack field');
  assertThrows(() => sign(t => t.replace('fields: 5-6', 'fields: 5-6\n  box: 7-12 0.5 0.75x')), /invalid box/, 'box shape');
});

test('regions mode: mode conflicts', () => {
  assertThrows(() => sign(t => t.replace('mode: regions', 'mode: grid')), /"region" needs "mode: regions"/, 'grid');
  assertThrows(() => sign(t => t.replace('mode: regions', 'mode: flow')), /"region" needs "mode: regions"/, 'flow');
  assertThrows(() => parseCompositionFile('id: s\nmode: regions\nimage: none\n', 's.composition'), /needs at least one "region"/, 'no regions');
  assertThrows(() => sign(t => t.replace('image: none', 'image: none\nlogo: top left')), /logo: is not allowed in regions mode/, 'top-level logo');
  assertThrows(() => sign(t => t.replace('image: none', 'image: none\nflow:\n  | note left')), /flow: is not allowed in regions mode/, 'flow');
  assertThrows(() => sign(t => t.replace('image: none', 'image: none\nsticky: top\n  | logo left')), /sticky: is not allowed in regions mode/, 'sticky');
  assertThrows(() => sign(t => t.replace('image: none', 'image: none\nnote  row 2  cols 1--4  left')), /slot line "note" is not allowed in regions mode/, 'grid slot');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
