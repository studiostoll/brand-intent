/**
 * `brand-intent check <folder>`: parse every Brand Intent file in a brand folder and check the files
 * against each other (ids, typography, framing, people, groups, works, the .time, the photo library).
 *
 * Bundled to cli/check.mjs (`npm run build:cli`) so the CLI runs on plain Node without TypeScript.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  parseIdentityFile, parseBrandFile, parseFormatFile, parsePurposeFile,
  parseCompositionFile, parseStoryFile, parsePlaceFile, parseTimeFile, parsePersonFile, parseGroupFile, parseWorkFile,
  checkBrand, checkPurpose, checkStory, checkPerson, checkGroup, checkWork, photoLibrary, PHOTO_EXTENSIONS,
} from '../parser/index';
import type { ParsedBrand, ParsedPurpose, ParsedPlace, ParsedTime, ParsedPerson, ParsedGroup, ParsedWork } from '../parser/index';

/** Folders a brand repo keeps next to its files: never brand content. */
const SKIP_DIRS = new Set(['node_modules', '.git', '.github', '.claude']);

/** Image files below `photosDir`, relative to it, NFC, sorted. Hidden files and index.json are skipped. */
export function listPhotos(photosDir: string, prefix = '', skipped: string[] = []): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(photosDir, prefix))) {
    if (name.startsWith('.') || (!prefix && name === 'index.json')) continue;
    const rel = prefix ? `${prefix}/${name}` : name;
    if (statSync(join(photosDir, rel)).isDirectory()) { out.push(...listPhotos(photosDir, rel, skipped)); continue; }
    const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '';
    if ((PHOTO_EXTENSIONS as readonly string[]).includes(ext)) out.push(rel.normalize('NFC'));
    else skipped.push(rel);
  }
  return out.sort();
}

/** The `photos/index.json` text a folder should have. */
export function photoIndexText(photosDir: string, skipped?: string[]): string {
  return JSON.stringify(listPhotos(photosDir, '', skipped), null, 2) + '\n';
}

export interface CheckResult {
  /** Problems that make the folder wrong: a file that does not parse, an id that is not there. */
  errors: string[];
  /** Things worth a look that break nothing. */
  warnings: string[];
  /** Files parsed, by extension. */
  counts: Record<string, number>;
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    if (e.isDirectory()) return SKIP_DIRS.has(e.name) || e.name.startsWith('.') ? [] : walk(join(dir, e.name));
    return [join(dir, e.name)];
  });
}

/** Check one brand folder. Never throws: every problem lands in `errors` or `warnings`. */
export function checkFolder(dir: string, label = dir): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const counts: Record<string, number> = {};
  const files = walk(dir);
  const name = (f: string) => relative(dir, f);
  const read = (f: string) => readFileSync(f, 'utf8');
  const ofType = (ext: string) => {
    const list = files.filter(f => f.endsWith(`.${ext}`));
    if (list.length) counts[ext] = list.length;
    return list;
  };
  const attempt = <T>(f: string, fn: () => T): T | undefined => {
    try { return fn(); } catch (err) { errors.push(err instanceof Error ? err.message : `${name(f)}: ${String(err)}`); return undefined; }
  };

  const brandFiles = ofType('brand');
  if (brandFiles.length !== 1) errors.push(`${brandFiles.length ? 'more than one' : 'no'} .brand file in ${dir}; a brand folder has exactly one`.replace(` in ${dir}`, ` in ${label}`));

  for (const f of ofType('identity')) attempt(f, () => parseIdentityFile(read(f), name(f)));
  let brand: ParsedBrand | undefined;
  for (const f of brandFiles.slice(0, 1)) brand = attempt(f, () => parseBrandFile(read(f), name(f)));
  if (brand?.warnings?.length) warnings.push(...brand.warnings);

  let time: ParsedTime | null = null;
  for (const f of ofType('time')) time = attempt(f, () => parseTimeFile(read(f), name(f))) ?? time;
  const collect = <T>(ext: string, parse: (text: string, file: string) => T): T[] =>
    ofType(ext).flatMap(f => { const out = attempt(f, () => parse(read(f), name(f))); return out === undefined ? [] : [out]; });
  const people: ParsedPerson[] = collect('person', parsePersonFile);
  const groups: ParsedGroup[] = collect('group', parseGroupFile);
  const works: ParsedWork[] = collect('work', parseWorkFile);
  const places: ParsedPlace[] = collect('place', parsePlaceFile);
  const formats = collect('format', parseFormatFile).map(f => f.id);
  const compositions = collect('composition', parseCompositionFile).map(c => c.id);
  const purposes: ParsedPurpose[] = collect('purpose', parsePurposeFile);
  for (const p of purposes) if (p.warnings?.length) warnings.push(...p.warnings);

  // The photo library: the files below photos/, listed in photos/index.json.
  const photosDir = join(dir, 'photos');
  let photoIds = (brand?.assets?.photos ?? []).map(p => p.id);
  if (existsSync(photosDir)) {
    const skipped: string[] = [];
    const expected = photoIndexText(photosDir, skipped);
    for (const s of skipped) warnings.push(`photos/${s}: not a photo, left out of the library`);
    const indexFile = join(photosDir, 'index.json');
    const current = existsSync(indexFile) ? readFileSync(indexFile, 'utf8') : '';
    if (current !== expected) errors.push(`photos/index.json is out of date; run: npx brand-intent photos ${label === '.' ? '' : label}`.trimEnd());
    if (brand) {
      const library = attempt(indexFile, () => photoLibrary(brand!.assets?.photos, JSON.parse(expected), name(brandFiles[0])));
      if (library) photoIds = library.map(p => p.id);
    }
  }

  if (brand) {
    const fileName = name(brandFiles[0]);
    errors.push(...checkBrand(brand, { time, people, groups, works }, fileName));
    for (const p of purposes) {
      errors.push(...checkPurpose(p, { time, works }, `${p.id}.purpose`));
      for (const s of p.slots) {
        if (s.typographyRef && !brand.typographies?.[s.typographyRef]) errors.push(`${p.id}.purpose: typography "${s.typographyRef}" is not in the .brand`);
      }
      if (p.framing && !brand.framings?.some(fr => fr.id === p.framing)) errors.push(`${p.id}.purpose: framing "${p.framing}" is not in the .brand`);
    }
  }
  errors.push(
    ...people.flatMap(p => checkPerson(p, { groups, places }, `${p.id}.person`)),
    ...groups.flatMap(g => checkGroup(g, { people }, `${g.id}.group`)),
    ...works.flatMap(w => checkWork(w, { people, groups, time, places }, `${w.id}.work`)),
  );

  for (const f of ofType('story')) {
    const story = attempt(f, () => parseStoryFile(read(f), name(f)));
    if (!story || !brand) continue;
    errors.push(...checkStory(story, {
      purposes, compositions, formats, places,
      themes: Object.keys(brand.themes ?? {}),
      photos: photoIds,
      illustrations: (brand.assets?.illustrations ?? []).map(i => i.id),
      time, people, groups, works, name: brand.name,
      location: !!brand.location,
    }, name(f)));
  }

  return { errors, warnings, counts };
}
