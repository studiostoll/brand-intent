/**
 * `brand-intent check <folder>`: parse every Brand Intent file in a brand folder and check the files
 * against each other (`checkFiles` in the parser), plus what only a folder shows: the photo library's index.
 *
 * Bundled to cli/check.mjs (`npm run build:cli`) so the CLI runs on plain Node without TypeScript.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  parseIdentityFile, parseBrandFile, parseFormatFile, parsePurposeFile,
  parseCompositionFile, parseStoryFile, parsePlaceFile, parseTimeFile, parsePersonFile, parseGroupFile, parseWorkFile,
  checkFiles, photoLibrary, videoLibrary, PHOTO_EXTENSIONS, VIDEO_EXTENSIONS,
} from '../parser/index';
import type { ParsedBrand, ParsedIdentity, ParsedPurpose, ParsedPlace, ParsedTime, ParsedPerson, ParsedGroup, ParsedWork } from '../parser/index';

/** Folders a brand repo keeps next to its files: never brand content. */
const SKIP_DIRS = new Set(['node_modules', '.git', '.github', '.claude']);

/** The two media libraries of a brand folder: `media/photos/` and `media/videos/`. */
export const MEDIA_KINDS = [
  { kind: 'photo', folder: 'media/photos', extensions: PHOTO_EXTENSIONS as readonly string[] },
  { kind: 'video', folder: 'media/videos', extensions: VIDEO_EXTENSIONS as readonly string[] },
] as const;

/** Files with one of `extensions` below `mediaDir`, relative to it, NFC, sorted. Hidden files and index.json are skipped. */
export function listMedia(mediaDir: string, extensions: readonly string[], prefix = '', skipped: string[] = []): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(mediaDir, prefix))) {
    if (name.startsWith('.') || (!prefix && name === 'index.json')) continue;
    const rel = prefix ? `${prefix}/${name}` : name;
    if (statSync(join(mediaDir, rel)).isDirectory()) { out.push(...listMedia(mediaDir, extensions, rel, skipped)); continue; }
    const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '';
    if (extensions.includes(ext)) out.push(rel.normalize('NFC'));
    else skipped.push(rel);
  }
  return out.sort();
}

/** The `index.json` text a media folder (`media/photos/`, `media/videos/`) should have. */
export function mediaIndexText(mediaDir: string, extensions: readonly string[], skipped?: string[]): string {
  return JSON.stringify(listMedia(mediaDir, extensions, '', skipped), null, 2) + '\n';
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

  let identity: ParsedIdentity | undefined;
  for (const f of ofType('identity')) identity = attempt(f, () => parseIdentityFile(read(f), name(f))) ?? identity;
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
  const formats = collect('format', parseFormatFile);
  const compositions = collect('composition', parseCompositionFile);
  const stories = collect('story', parseStoryFile);
  const purposes: ParsedPurpose[] = collect('purpose', parsePurposeFile);
  for (const p of purposes) if (p.warnings?.length) warnings.push(...p.warnings);

  // The media libraries: the files below media/photos/ and media/videos/, each listed in its index.json.
  // `photos/` and `videos/` beside the .brand file are where they lay before v0.52.
  for (const old of ['photos', 'videos']) {
    if (existsSync(join(dir, old))) errors.push(`${old}/ is media/${old}/ since v0.52; move the folder, then run: npx brand-intent media ${label === '.' ? '' : label}`.trimEnd());
  }
  let photoIds = (brand?.assets?.photos ?? []).map(p => p.id);
  let videoIds = (brand?.assets?.videos ?? []).map(v => v.id);
  for (const { kind, folder, extensions } of MEDIA_KINDS) {
    const mediaDir = join(dir, folder);
    const declared = kind === 'photo' ? brand?.assets?.photos : brand?.assets?.videos;
    if (!existsSync(mediaDir)) {
      if (declared?.length && !existsSync(join(dir, `${kind}s`))) errors.push(`${kind} "${declared[0].id}" has no file: there is no ${folder}/ folder`);
      continue;
    }
    const skipped: string[] = [];
    const expected = mediaIndexText(mediaDir, extensions, skipped);
    for (const s of skipped) warnings.push(`${folder}/${s}: not a ${kind}, left out of the library`);
    const indexFile = join(mediaDir, 'index.json');
    const current = existsSync(indexFile) ? readFileSync(indexFile, 'utf8') : '';
    if (current !== expected) errors.push(`${folder}/index.json is out of date; run: npx brand-intent media ${label === '.' ? '' : label}`.trimEnd());
    if (brand) {
      const library = attempt(indexFile, () => (kind === 'photo' ? photoLibrary : videoLibrary)(declared, JSON.parse(expected), name(brandFiles[0])));
      if (library && kind === 'photo') photoIds = library.map(p => p.id);
      if (library && kind === 'video') videoIds = library.map(v => v.id);
    }
  }

  for (const issue of checkFiles({ brand, identity, formats, compositions, purposes, stories, places, time, people, groups, works, photos: photoIds, videos: videoIds })) {
    (issue.severity === 'error' ? errors : warnings).push(`${issue.file}: ${issue.message}`);
  }

  return { errors, warnings, counts };
}
