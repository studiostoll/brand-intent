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

test('a purpose names a composition that is not there, or none', () => {
  const file = `${purpose(base()).id}.purpose`;
  assertEq(added(f => { purpose(f).preferredCompositions.push('gone'); }), [`error ${file}: compositions: composition "gone" does not exist`]);
  const none = added(f => { purpose(f).preferredCompositions = []; });
  assertEq(none.includes(`warning ${file}: compositions: is empty, so the purpose is never placed on a canvas`), true, 'empty');
});

test('a composition no purpose lists is a warning', () => {
  const extra = { ...base().compositions[0], id: 'spare' };
  assertEq(added(f => { f.compositions.push(extra); }), ['warning spare.composition: no purpose lists this composition, so it is never used']);
});

test('sticky in a grid-mode composition is a warning', () => {
  const issues = added(f => { f.compositions[0].mode = 'grid'; f.compositions[0].sticky = [{ position: 'top', size: 'm' } as never]; });
  assertEq(issues, [`warning ${base().compositions[0].id}.composition: sticky: is for flow mode; a grid-mode composition ignores it`]);
});

test('scope names an audience the identity does not have', () => {
  const file = `${purpose(base()).id}.purpose`;
  assertEq(added(f => { purpose(f).scope = { audience: ['nobody'] }; }), [`error ${file}: scope: audience "nobody" is not in the .identity`]);
  assertEq(added(f => { purpose(f).scope = { audience: ['nobody'] }; f.identity = undefined; }), [], 'unchecked without an identity');
});

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
