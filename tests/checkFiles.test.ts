/**
 * Tests for checkFiles: a brand's parsed files against each other.
 *
 * Run: npm test
 */

import { checkFiles, type BrandFiles } from '../parser/checkFiles';
import { parseBrandFile } from '../parser/brandParser';
import { parseIdentityFile } from '../parser/identityParser';
import { parseFormatFile } from '../parser/formatParser';
import { parseCompositionFile } from '../parser/compositionParser';
import { parsePurposeFile } from '../parser/purposeParser';
import { parseStoryFile } from '../parser/storyParser';
import { parsePlaceFile } from '../parser/placeParser';
import { parseWorkFile } from '../parser/workParser';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

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

// The example brand, parsed once; each test changes one file.
const DIR = join(__dirname, '..', 'examples', 'krume');
const read = (...path: string[]) => readFileSync(join(DIR, ...path), 'utf8');
const all = <T>(folder: string, parse: (text: string, file: string) => T): T[] =>
  readdirSync(join(DIR, folder)).map(f => parse(read(folder, f), f));

const base = (): BrandFiles => ({
  brand: parseBrandFile(read('krume.brand'), 'krume.brand'),
  identity: parseIdentityFile(read('krume.identity'), 'krume.identity'),
  formats: all('formats', parseFormatFile),
  compositions: all('compositions', parseCompositionFile),
  purposes: all('purposes', parsePurposeFile),
  stories: all('stories', parseStoryFile),
  places: all('places', parsePlaceFile),
  time: null,
  people: [],
  groups: [],
  works: all('works', parseWorkFile),
});
/** The issues a change adds to the example's own. */
const added = (change: (files: BrandFiles) => void): string[] => {
  const before = new Set(checkFiles(base()).map(i => JSON.stringify(i)));
  const files = base();
  change(files);
  return checkFiles(files).filter(i => !before.has(JSON.stringify(i))).map(i => `${i.severity} ${i.file}: ${i.message}`);
};
const purpose = (files: BrandFiles) => files.purposes[0];

console.log('\ncheckFiles:');

test('a format names a purpose that is not there', () => {
  assertEq(added(f => { f.formats[0].purposes = ['daily-bread', 'baking-tip']; }), [`error ${base().formats[0].id}.format: purposes: purpose "baking-tip" does not exist`]);
});

test('a purpose names a composition that is not there', () => {
  const file = `${purpose(base()).id}.purpose`;
  assertEq(added(f => { purpose(f).preferredCompositions.push('gone'); }), [`error ${file}: compositions: composition "gone" does not exist`]);
});

test('a composition no purpose lists is a warning', () => {
  const extra = { ...base().compositions[0], id: 'spare' };
  assertEq(added(f => { f.compositions.push(extra); }), ['warning spare.composition: no purpose lists this composition, so it is never used']);
});

test('sticky in a grid-mode composition is a warning', () => {
  const issues = added(f => { f.compositions[0].mode = 'grid'; f.compositions[0].sticky = [{ position: 'top', size: 'm' } as never]; });
  assertEq(issues, [`warning ${base().compositions[0].id}.composition: sticky: is for flow mode; a grid-mode composition ignores it`]);
});

test('two flows on one anchor, or on a sticky bar\'s edge, are warnings', () => {
  const file = `${base().compositions[0].id}.composition`;
  const issues = added(f => {
    f.compositions[0].mode = 'flow';
    f.compositions[0].anchoredFlows = [{ anchor: { edge: 'bottom' } }, { anchor: { edge: 'bottom', distance: 'xl' } }, { anchor: { edge: 'top' } }] as never;
    f.compositions[0].sticky = [{ position: 'top', size: 'm' } as never];
  });
  assertEq(issues, [
    `warning ${file}: flow: top and sticky: top overlap; a sticky bar doesn't push an anchored flow`,
    `warning ${file}: two flows are anchored to the bottom, so they overlap; make them one flow`,
  ]);
});

test('a distance for a format the brand doesn\'t declare is a warning', () => {
  const file = `${base().compositions[0].id}.composition`;
  const declared = base().formats[0].id;
  const issues = added(f => {
    f.compositions[0].mode = 'flow';
    f.compositions[0].anchoredFlows = [{ anchor: { edge: 'top', distance: 6.85, formats: { [declared]: 12.04, 'no-such-format': 'xl' } } }] as never;
  });
  assertEq(issues, [`warning ${file}: flow: top has a distance for format "no-such-format", which the brand doesn't declare`]);
});

test('scope names an audience the identity does not have', () => {
  const file = `${purpose(base()).id}.purpose`;
  assertEq(added(f => { purpose(f).scope = { audience: ['nobody'] }; }), [`error ${file}: scope: audience "nobody" is not in the .identity`]);
  assertEq(added(f => { purpose(f).scope = { audience: ['nobody'] }; f.identity = undefined; }), [], 'unchecked without an identity');
});

test('use: the slots name roles of that kind, not styles', () => {
  const p = purpose(base());
  const file = `${p.id}.purpose`;
  const style = Object.keys(base().brand!.typographies!)[0];
  assertEq(added(f => { purpose(f).use = 'sign'; }), [`error ${file}: use: the .brand has no roles "sign"`], 'no roles');
  const withRoles = (f: BrandFiles) => { f.brand!.roles = { sign: { statement: { style }, ...Object.fromEntries(purpose(f).slots.map(sl => [sl.typographyRef, { style }])) } }; purpose(f).use = 'sign'; };
  const roleIssues = added(f => { withRoles(f); purpose(f).slots[0].typographyRef = 'statement'; });
  assertEq(roleIssues, [], 'a role of the kind');
  assertEq(added(f => { withRoles(f); purpose(f).slots[0].typographyRef = 'nope'; }), [`error ${file}: typography "nope" is no role of "sign" in the .brand`], 'not a role');
  assertEq(added(f => { purpose(f).slots[0].typographyRef = 'nope'; }), [`error ${file}: typography "nope" is not in the .brand`], 'without use: a style');
});


// ── Regions mode: a printed piece against its format, the brand and the purpose ──
{
  const regionsBase = (f: BrandFiles, text?: string) => {
    const story = f.stories[0];
    const p = purpose(f);
    const [a, b] = p.slots.map(sl => sl.id);
    const comp = parseCompositionFile(text ?? `id: printed\nimage: none\n\nregion head\n  fields: 1-2\n  logo: top left\n  place: ${a} top 1-3\n  group: ${a}\n  stack: field 1\n\nregion foot\n  fields: 3-4\n  place: ${b} bottom right 2-4\n  group: ${b}\n  stack: neighbour 1.5x\n  size: ${b} 4x\n`, 'printed.composition');
    f.compositions.push(comp);
    p.preferredCompositions.push('printed');
    story.pages[0].composition = 'printed';
    const format = f.formats.find(fm => fm.id === story.format)!;
    format.widthMm = 210; format.heightMm = 297; format.grid = { rows: 4, cols: 4 };
  };
  const fileOf = (f: BrandFiles) => `${f.stories[0].id}.story`;
  const at = (m: string) => `error ${fileOf(base())}: composition "printed": ${m}`;

  test('regions: a printed piece that fits has no finding', () => {
    assertEq(added(f => regionsBase(f)), []);
  });

  test('regions: the format needs mm and the brand a print x', () => {
    assertEq(added(f => { regionsBase(f); const fm = f.formats.find(x => x.id === f.stories[0].format)!; fm.widthMm = undefined; }), [at(`regions mode needs a format with a size in mm, "${base().stories[0].format}" has none`)]);
    assertEq(added(f => { regionsBase(f); f.brand!.print = undefined; }), [at('regions mode needs a print block with "x:" in the .brand')]);
  });

  test('regions: the last region ends on the last field, fields and columns stay inside', () => {
    assertEq(added(f => { regionsBase(f); f.formats.find(x => x.id === f.stories[0].format)!.grid = { rows: 5, cols: 4 }; }), [at(`the last region ends on field 4, format "${base().stories[0].format}" has 5 fields`)], 'short');
    assertEq(added(f => { regionsBase(f); f.formats.find(x => x.id === f.stories[0].format)!.grid = { rows: 3, cols: 4 }; }).some(m => m.includes('are outside the format\'s 3 fields')), true, 'too many');
    assertEq(added(f => { regionsBase(f); f.formats.find(x => x.id === f.stories[0].format)!.grid = { rows: 4, cols: 3 }; }).some(m => m.includes('columns 2-4 are outside the format\'s 3 columns')), true, 'columns');
  });

  test('regions: by content, the rest keeps enough fields for its stack', () => {
    const relative = (t: string) => t.replace('fields: 1-2', 'fields: rest').replace('fields: 3-4', 'fields: content');
    const text = (f: BrandFiles) => { const [a, b] = purpose(f).slots.map(sl => sl.id); return `id: printed\nimage: none\n\nregion head\n  fields: 1-2\n  logo: top left\n  place: ${a} top 1-3\n  group: ${a}\n  stack: field 3\n\nregion foot\n  fields: 3-4\n  place: ${b} bottom right 2-4\n  group: ${b}\n  stack: neighbour 1.5x\n  size: ${b} 4x\n`; };
    assertEq(added(f => regionsBase(f, relative(text(f)).replace('stack: field 3', 'stack: field 2'))), [], 'fits: 4 fields, one for the foot');
    assertEq(added(f => regionsBase(f, relative(text(f)))), [], 'three fit');
    assertEq(added(f => regionsBase(f, relative(text(f)).replace('stack: field 3', 'stack: field 4'))), [at('region "head": it needs 4 fields, format "' + base().stories[0].format + '" leaves it at most 3')], 'too few');
  });

  test('regions: a stack distance is one of the print spacers', () => {
    assertEq(added(f => { regionsBase(f); f.brand!.print!.spacers = [0.5, 1]; }), [at('region "foot": stack distance 1.5x is not one of the brand\'s print spacers')]);
  });

  test('regions: a repeated region holds its item\'s slots, the others the rest', () => {
    const [a, b] = purpose(base()).slots.map(sl => sl.id);
    // The item's slot moves into item blocks in every example that writes it
    const items = (f: BrandFiles) => {
      purpose(f).items = [{ id: 'row', slots: [b] }];
      for (const st of f.stories) for (const ex of st.examples) for (const ep of ex.pages) {
        if (ep.texts[b] === undefined) continue;
        ep.items = [{ item: 'row', texts: { [b]: ep.texts[b] } }];
        delete ep.texts[b];
      }
    };
    const text = (repeat: string, head = a) => `id: printed\nimage: none\n\nregion head\n  fields: rest\n  logo: top left\n  place: ${head} top 1-3\n\nregion row\n${repeat}  fields: content\n  place: ${b} bottom 1-4\n  size: ${b} 4x\n`;
    assertEq(added(f => { items(f); regionsBase(f, text('  repeat: row\n')); }), [], 'fits');
    assertEq(added(f => { items(f); regionsBase(f, text('  repeat: lane\n')); }).includes(at('region "row": repeat "lane" is no item of purpose "' + purpose(base()).id + '"')), true, 'unknown item');
    assertEq(added(f => { items(f); regionsBase(f, text('')); }).includes(at(`region "row": slot "${b}" belongs to item "row", a region with "repeat: row" holds it`)), true, 'item slot outside');
    assertEq(added(f => { items(f); regionsBase(f, text('  repeat: row\n').replace(`place: ${b} bottom 1-4`, `place: ${a} bottom 1-4`).replace(`place: ${a} top 1-3`, `place: ${b} top 1-3`)); }).includes(at(`region "row": slot "${a}" is no slot of item "row", the region repeats per row`)), true, 'page slot inside');
    // A region whose items flow down columns places the page's slots at their foot, never an item's
    const flowing = (foot: string) => `id: printed\nimage: none\n\nregion head\n  fields: 1-2\n  logo: top left\n\nregion rows\n  fields: 3-4\n  repeat: row\n  columns: 1-2 3-4\n  place: ${foot} bottom 3-4\n  size: ${foot} 2x\n`;
    assertEq(added(f => { items(f); regionsBase(f, flowing(a)); }), [], 'a page slot at the columns\' foot');
    assertEq(added(f => { items(f); regionsBase(f, flowing(b)); }).includes(at(`region "rows": slot "${b}" belongs to item "row", a region with "repeat: row" holds it`)), true, 'an item slot at the foot');
  });

  test('regions: every slot is a slot of the purpose', () => {
    const msgs = added(f => { regionsBase(f, `id: printed\nimage: none\n\nregion all\n  fields: 1-4\n  place: ghost top 1-2\n  group: ghost\n  stack: field 1\n`); });
    assertEq(msgs, [at('region "all": slot "ghost" is not a slot of purpose "' + purpose(base()).id + '"')]);
  });
}

test('a slot colour is a slot of the themes', () => {
  const p = purpose(base());
  const key = Object.keys(Object.values(base().brand!.themes!)[0])[0];
  assertEq(added(f => { purpose(f).slots[0].colorRef = key; }), [], 'known');
  assertEq(added(f => { purpose(f).slots[0].colorRef = 'neon'; }), [`error ${p.id}.purpose: slot "${p.slots[0].id}": color "neon" is not a slot of the .brand's themes`]);
});

test('variables in a purpose example fill from the place, the .time and the example\'s work', () => {
  const p = purpose(base());
  const slot = Object.keys(p.examples[0].texts)[0];
  const at = `error ${p.id}.purpose: example 1, slot "${slot}": `;
  const withText = (text: string, more?: (f: BrandFiles) => void) => added(f => { purpose(f).examples[0].texts = { [slot]: text }; more?.(f); });
  assertEq(withText('{work}, {price}, {weekday short}'), [], 'the work\'s facts and a calendar variable');
  assertEq(withText('{price}', f => { purpose(f).examples[0].work = undefined; }), [`${at}variable "{price}" needs a work: on the example`]);
  assertEq(withText('{person}'), [`${at}variable "{person}" needs a person, which a purpose example cannot name`]);
  assertEq(withText('{season}'), [`${at}variable "{season}" needs season blocks in the .time (the brand has no .time)`]);
  assertEq(withText('{address}', f => { f.places = []; }).includes(`${at}variable "{address}" needs a place: add a .place file`), true, 'no place');
  assertEq(withText('{nothing}'), [`${at}unknown variable "{nothing}"`]);
});

test('two files of one id', () => {
  assertEq(added(f => { f.formats.push(f.formats[0]); }), [`error ${base().formats[0].id}.format: more than one .format has the id "${base().formats[0].id}"`]);
});

test('stories and fact files are checked, with the file as its own field', () => {
  const issues = checkFiles({ ...base(), works: [] });
  const story = issues.find(i => i.file.endsWith('.story'));
  assertEq(!!story && !story.message.startsWith(story.file), true, 'a story problem without its file prefix');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
