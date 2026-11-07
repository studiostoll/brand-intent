/**
 * Tests for .purpose slot typography overrides.
 *
 * Run: npm test
 */

import { parsePurposeFile, checkPurpose } from '../parser/purposeParser';
import { parseTimeFile } from '../parser/timeParser';

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

test('scrim: none takes the brand scrim off the purpose', () => {
  const s = (line: string) => () => parsePurposeFile(`id: p\ncompositions: panel\n${line}\n\nslot primary\n  label: Headline\n  typography: headline\n  maxLength: 40\n  samples: a\n`, 'p.purpose').scrim;
  assertEq(s('scrim: none')(), 'none', 'none');
  assertEq(s('')(), undefined, 'absent');
  assertThrows(s('scrim: 30%'), /invalid scrim "30%"/, 'a strength');
});

test('framing: names a brand framing module', () => {
  const f = (line: string) => parsePurposeFile(`id: p\ncompositions: panel\n${line}\n\nslot primary\n  label: Headline\n  typography: headline\n  maxLength: 40\n  samples: a\n`, 'p.purpose').framing;
  assertEq(f('framing: close'), 'close', 'id');
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

test('legacy @name marker sets sampleWindows and is stripped from the text', () => {
  const slot = (samples: string, type = '') => parsePurposeFile(`id: p\ncompositions: panel\n\nslot primary\n  label: Headline\n  typography: headline\n  maxLength: 80\n${type}${samples}`, 'p.purpose').slots[0];
  const inline = slot('  samples: Stollen ab Advent @christmas | Roggenlaib\n');
  assertEq(inline.samples, ['Stollen ab Advent', 'Roggenlaib'], 'inline samples');
  assertEq(inline.sampleWindows, ['christmas', undefined], 'inline windows');
  const multi = slot('  samples:\n    - Erdbeerkuchen  @strawberries\n      zweite Zeile\n    - Ganzjährig\n');
  assertEq(multi.samples, ['Erdbeerkuchen\nzweite Zeile', 'Ganzjährig'], 'multi samples');
  assertEq(multi.sampleWindows, ['strawberries', undefined], 'multi windows');
  assertEq(slot('  samples: a | b\n').sampleWindows, undefined, 'no markers');
  assertEq(slot('  samples: Mail an info@example.org\n').samples, ['Mail an info@example.org'], 'mid-word @ untouched');
});

test('legacy @name marker on a continuation line throws', () => {
  let threw = false;
  try {
    parsePurposeFile(`id: p\ncompositions: panel\n\nslot primary\n  label: Headline\n  typography: headline\n  maxLength: 80\n  samples:\n    - Erste Zeile\n      Stollen @christmas\n`, 'p.purpose');
  } catch (e) { threw = /first line/.test((e as Error).message); }
  assertEq(threw, true, 'throws');
});

console.log('\nexamples:');

const SLOTS = `slot label\n  label: Badge\n  typography: label\n  maxLength: 20\n\nslot primary\n  label: Headline\n  typography: headline\n  maxLength: 40\n\nslot detail\n  label: Facts\n  typography: body\n  type: list\n    maxItems: 3\n    maxLength: 40\n\nslot cta\n  label: CTA\n  typography: label\n  maxLength: 20\n  value: Order now\n`;
const withExamples = (examples: string, slots = SLOTS) => parsePurposeFile(`id: p\ncompositions: panel\n\n${slots}\n${examples}`, 'p.purpose');

function assertThrows(fn: () => unknown, pattern: RegExp, label: string) {
  try { fn(); } catch (e) {
    if (pattern.test((e as Error).message)) return;
    throw new Error(`${label}: wrong error "${(e as Error).message}"`);
  }
  throw new Error(`${label}: did not throw`);
}

test('example blocks: topic, goal, when, single- and multi-line slot texts', () => {
  const p = withExamples(`example\n  topic: The Saturday rye loaf\n  goal: regulars\n  when: christmas\n  label: Heute frisch\n  primary: Roggenlaib\n  detail:\n    Roggen 1150\n    18 Stunden Teigführung\n\nexample\n  label: Neu\n  primary: Dinkelvollkorn\n  detail:\n    Emmer\n`);
  assertEq(p.examples, [
    { texts: { label: 'Heute frisch', primary: 'Roggenlaib', detail: 'Roggen 1150\n18 Stunden Teigführung' }, topic: 'The Saturday rye loaf', goal: 'regulars', when: 'christmas' },
    { texts: { label: 'Neu', primary: 'Dinkelvollkorn', detail: 'Emmer' } },
  ], 'examples');
  assertEq(p.warnings, [], 'no warnings');
  assertEq(p.slots.map(s => s.samples), [[], [], [], ['Order now']], 'slot samples empty, value kept');
});

test('a credit slot needs no example: the implementation fills it', () => {
  const p = withExamples(`example\n  label: A\n  primary: B\n  detail:\n    C\n`, `${SLOTS}\nslot credit\n  label: Credit\n  typography: caption\n  maxLength: 60\n`);
  assertEq(p.slots.map(s => s.id), ['label', 'primary', 'detail', 'cta', 'credit'], 'credit slot parsed');
  assertEq(p.examples[0].texts, { label: 'A', primary: 'B', detail: 'C' }, 'example without credit');
});

test('example may leave a slot out; a slot no example fills throws', () => {
  const p = withExamples(`example\n  label: A\n  primary: B\n  detail:\n    C\nexample\n  primary: D\n`);
  assertEq(p.examples[1].texts, { primary: 'D' }, 'partial example');
  assertThrows(() => withExamples(`example\n  label: A\n  primary: B\n`), /slot "detail" is filled by no example/, 'unfilled slot');
});

test('list grid: columns, labels above, labelSize, divider', () => {
  const facts = (props: string, item = 'Wind: 4 Bft') => withExamples(`example\n  primary: B\n  detail:\n    ${item}\n`,
    `slot primary\n  label: Headline\n  typography: headline\n  maxLength: 40\n\nslot detail\n  label: Facts\n  typography: body\n  type: list\n    maxItems: 6\n    maxLength: 40\n${props}`).slots[1];
  const s = facts('    columns: 2\n    labels: above\n    labelSize: 0.6\n    divider: hairline\n');
  assertEq([s.listColumns, s.listLabels, s.labelSize, s.listDivider], [2, 'above', 0.6, 'hairline'], 'parsed');
  assertEq(facts('').listColumns, undefined, 'absent');
  assertThrows(() => facts('    columns: 7\n'), /must be 1 to 6/, 'columns range');
  assertThrows(() => facts('    columns: 2\n    direction: horizontal\n'), /columns needs a vertical list/, 'horizontal');
  assertThrows(() => facts('    labelSize: 0.6\n'), /labelSize needs "labels: above"/, 'labelSize alone');
  assertThrows(() => facts('    divider: hairline\n'), /divider needs "columns:"/, 'divider without columns');
  assertThrows(() => facts('    labels: above\n', 'just a value'), /needs a label/, 'item without label');
  assertEq(facts('    labels: above\n', 'Sonne: 07:21').listLabels, 'above', 'time after the label');
  assertEq(facts('    labels: above\n', 'Hours: Mon–Fri 8–18\n    Sat 9–14').listLabels, 'above', 'a line without a label continues the item above');
  assertThrows(() => facts('    columns: 2\n    labels: above\n', 'Hours: Mon–Fri 8–18\n    Sat 9–14'), /needs a label/, 'not in a grid');
});

test('example validation errors', () => {
  const full = '  label: A\n  primary: B\n  detail:\n    C\n';
  assertThrows(() => withExamples(`example\n${full}  secondary: X\n`), /does not declare/, 'undeclared slot');
  assertThrows(() => withExamples(`example\n${full}  cta: Buy\n`), /fixed value/, 'value slot');
  assertThrows(() => withExamples(`example\n${full}  colour: red\n`), /unknown example key/, 'unknown key');
  assertThrows(() => withExamples(`example\n${full}  primary: again\n`), /duplicate "primary"/, 'duplicate key');
  assertThrows(() => withExamples(`example\n${full}  when: Christmas\n`), /invalid when/, 'when name');
  assertThrows(() => withExamples(`example\n  label: A @christmas\n  primary: B\n  detail:\n    C\n`), /use "when:"/, 'marker in text');
  assertThrows(() => withExamples(`example\n  label: A\n  primary: B\n  detail:\n    [pin] C\n`), /no "marker: icon"/, 'icon without marker');
  assertThrows(() => withExamples(`example\n  topic: nothing\n`), /without slot texts/, 'empty example');
});

test('person: required, and checkPurpose on example when:', () => {
  const p = parsePurposeFile(`id: p\ncompositions: panel\nperson: required\n\n${SLOTS}\nexample\n  when: advent\n  label: A\n  primary: B\n  detail:\n    C\n`, 'p.purpose');
  assertEq(p.person, 'required', 'required');
  assertEq('person' in withExamples('example\n  label: A\n  primary: B\n  detail:\n    C\n'), false, 'absent');
  assertThrows(() => parsePurposeFile(`id: p\ncompositions: panel\nperson: thomas\n\n${SLOTS}`, 'p.purpose'), /invalid person "thomas" \(expected required/, 'only required');
  assertEq(checkPurpose(p, { time: parseTimeFile('windows\n  advent: 11-27..12-24\n', 'p.time') }, 'p.purpose'), [], 'known');
  assertEq(checkPurpose(p, { time: parseTimeFile('', 'p.time') }, 'p.purpose'), ['p.purpose: example 1: when "advent" is not in the .time'], 'unknown');
  assertEq(checkPurpose(p, { time: null }, 'p.purpose'), ['p.purpose: example 1: when "advent" is not in the .time (the brand has no .time)'], 'no .time');
  const g = parsePurposeFile(`id: p\ncompositions: panel\ngroup: required\nwork: required\n\n${SLOTS}\nexample\n  work: rye-loaf\n  label: A\n  primary: B\n  detail:\n    C\n`, 'p.purpose');
  assertEq([g.group, g.work, g.examples[0].work], ['required', 'required', 'rye-loaf'], 'group and work required, example work');
  assertThrows(() => parsePurposeFile(`id: p\ncompositions: panel\nwork: rye-loaf\n\n${SLOTS}`, 'p.purpose'), /invalid work "rye-loaf" \(expected required/, 'only required');
  assertThrows(() => withExamples(`example\n  work: Rye Loaf\n  label: A\n  primary: B\n  detail:\n    C\n`), /invalid work/, 'example work id');
  assertEq(checkPurpose(g, { works: [] }, 'p.purpose'), ['p.purpose: example 1: work "rye-loaf" does not exist'], 'unknown work');
  assertEq(checkPurpose(g, { works: [{ id: 'rye-loaf' }] }, 'p.purpose'), [], 'known work');
  assertEq(checkPurpose(p, {}, 'p.purpose'), [], 'not checked');
});

test('slot samples next to example blocks throws', () => {
  const slots = SLOTS.replace('  maxLength: 20\n\nslot primary', '  maxLength: 20\n  samples: Neu\n\nslot primary');
  assertThrows(() => withExamples(`example\n  label: A\n  primary: B\n  detail:\n    C\n`, slots), /next to "example" blocks/, 'mixed');
});

test('legacy slot samples become examples paired by position, with a warning', () => {
  const p = parsePurposeFile(`id: p\ncompositions: panel\n\nslot label\n  label: Badge\n  typography: label\n  maxLength: 20\n  samples: Neu | Heute  @christmas\n\nslot primary\n  label: Headline\n  typography: headline\n  maxLength: 40\n  samples: A | B | C\n\nslot cta\n  label: CTA\n  typography: label\n  maxLength: 20\n  value: Order now\n`, 'p.purpose');
  assertEq(p.examples, [
    { texts: { label: 'Neu', primary: 'A' }, legacy: true },
    { texts: { label: 'Heute', primary: 'B' }, when: 'christmas', legacy: true },
    { texts: { label: 'Neu', primary: 'C' }, legacy: true },
  ], 'paired');
  assertEq(p.warnings.length, 1, 'one warning');
  assertEq(/p\.purpose:8: deprecated slot "samples:"/.test(p.warnings[0]), true, 'warning names the line');
});

test('slot without examples, samples or value throws', () => {
  assertThrows(() => parsePurposeFile(`id: p\ncompositions: panel\n\nslot primary\n  label: Headline\n  typography: headline\n  maxLength: 40\n`, 'p.purpose'), /has no text/, 'no text');
});

test('illustration takes one id or a list', () => {
  const i = (line: string) => parsePurposeFile(`id: p\ncompositions: panel\n${line}\n\nslot primary\n  label: Headline\n  typography: headline\n  maxLength: 40\n  samples: a\n`, 'p.purpose').illustrations;
  assertEq(i('illustration: one, two'), ['one', 'two'], 'list');
  assertEq(i('illustration: one'), ['one'], 'single');
  assertEq(i(''), undefined, 'none');
});

test('photo takes one id or a list', () => {
  const ph = (line: string) => parsePurposeFile(`id: p\ncompositions: panel\n${line}\n\nslot primary\n  label: Headline\n  typography: headline\n  maxLength: 40\n  samples: a\n`, 'p.purpose').photos;
  assertEq(ph('photo: bar, glas'), ['bar', 'glas'], 'list');
  assertEq(ph('photo: bar'), ['bar'], 'single');
  assertEq(ph(''), undefined, 'none');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
