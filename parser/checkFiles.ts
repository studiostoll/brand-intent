/**
 * The cross-file check: a brand's parsed files against each other.
 *
 * Pure: it takes parsed files and reads nothing itself, so the CLI (`brand-intent check`) and an
 * application that has already loaded the files run the same checks.
 */

import type { ParsedBrand } from './brandParser';
import { checkBrand } from './brandParser';
import type { ParsedIdentity } from './identityParser';
import type { ParsedFormat } from './formatParser';
import type { ParsedComposition } from './compositionParser';
import type { ParsedPurpose } from './purposeParser';
import { checkPurpose } from './purposeParser';
import type { ParsedStory } from './storyParser';
import { checkStory, storyPlace, storyTextVariables, variableProblem } from './storyParser';
import type { ParsedPlace } from './placeParser';
import type { ParsedTime } from './timeParser';
import type { ParsedPerson } from './personParser';
import { checkPerson } from './personParser';
import type { ParsedGroup } from './groupParser';
import { checkGroup } from './groupParser';
import type { ParsedWork } from './workParser';
import { checkWork } from './workParser';

/** A brand's parsed files. A kind the brand has none of is an empty list. */
export interface BrandFiles {
  /** Without a brand, the checks that need one (typography, framing, themes, stories) are skipped. */
  brand?: ParsedBrand;
  /** Without an identity, `scope.audience` is not checked. */
  identity?: Pick<ParsedIdentity, 'audiences'>;
  formats: Pick<ParsedFormat, 'id' | 'purposes' | 'grid' | 'widthMm' | 'heightMm'>[];
  compositions: (Pick<ParsedComposition, 'id' | 'mode' | 'sticky' | 'regions'> & Partial<Pick<ParsedComposition, 'anchoredFlows'>>)[];
  purposes: ParsedPurpose[];
  stories: ParsedStory[];
  places: ParsedPlace[];
  time: ParsedTime | null;
  people: ParsedPerson[];
  groups: ParsedGroup[];
  works: ParsedWork[];
  /** The photo library's ids (`photoLibrary`); default: the ids of the brand's `photo` blocks. */
  photos?: string[];
  /** The video library's ids (`videoLibrary`); default: the ids of the brand's `video` blocks. */
  videos?: string[];
}

export interface FileIssue {
  /** An error makes the brand wrong; a warning is worth a look and breaks nothing. */
  severity: 'error' | 'warning';
  /** The file the issue is in, by id: "quote.purpose". */
  file: string;
  message: string;
}

/** Check a brand's files against each other. Never throws. */
export function checkFiles(files: BrandFiles): FileIssue[] {
  const issues: FileIssue[] = [];
  const { brand, identity, formats, compositions, purposes, stories, places, time, people, groups, works } = files;
  const error = (file: string, message: string) => issues.push({ severity: 'error', file, message });
  const warning = (file: string, message: string) => issues.push({ severity: 'warning', file, message });
  /** The file checks report "file: message"; here the file is its own field. */
  const errorsOf = (file: string, problems: string[]) => problems.forEach(p => error(file, p.startsWith(`${file}: `) ? p.slice(file.length + 2) : p));

  // ── Ids are unique within a kind ────────────────────────────────────────────
  const unique = (ext: string, list: { id: string }[]) => {
    const seen = new Set<string>();
    for (const { id } of list) {
      if (seen.has(id)) error(`${id}.${ext}`, `more than one .${ext} has the id "${id}"`);
      seen.add(id);
    }
  };
  unique('purpose', purposes);
  unique('composition', compositions);
  unique('format', formats);

  // ── Formats name purposes ───────────────────────────────────────────────────
  const purposeIds = new Set(purposes.map(p => p.id));
  for (const format of formats) {
    for (const id of format.purposes ?? []) {
      if (!purposeIds.has(id)) error(`${format.id}.format`, `purposes: purpose "${id}" does not exist`);
    }
  }

  // ── Purposes name compositions, and every composition is named ─────────────
  const compositionIds = new Set(compositions.map(c => c.id));
  const used = new Set<string>();
  for (const purpose of purposes) {
    const file = `${purpose.id}.purpose`;
    for (const id of purpose.preferredCompositions) {
      used.add(id);
      if (!compositionIds.has(id)) error(file, `compositions: composition "${id}" does not exist`);
    }
  }
  for (const composition of compositions) {
    const file = `${composition.id}.composition`;
    if (!used.has(composition.id)) warning(file, 'no purpose lists this composition, so it is never used');
    if (composition.mode === 'grid' && composition.sticky.length) warning(file, 'sticky: is for flow mode; a grid-mode composition ignores it');
    // Anchored flows don't push each other: two on one anchor, or one on the edge of a sticky bar, lie on top of each other
    const anchored = composition.anchoredFlows ?? [];
    for (const edge of ['top', 'center', 'bottom'] as const) {
      if (anchored.filter(f => f.anchor?.edge === edge).length > 1) warning(file, `two flows are anchored to the ${edge}, so they overlap; make them one flow`);
      if (edge !== 'center' && anchored.some(f => f.anchor?.edge === edge) && composition.sticky.some(st => st.position === edge)) warning(file, `flow: ${edge} and sticky: ${edge} overlap; a sticky bar doesn't push an anchored flow`);
    }
    // A distance per format names a format of the brand
    for (const { anchor } of anchored) {
      if (!anchor) continue;
      if (formats.length) {
        for (const id of Object.keys(anchor.formats ?? {})) {
          if (!formats.some(f => f.id === id)) warning(file, `flow: ${anchor.edge} has a distance for format "${id}", which the brand doesn't declare`);
        }
      }
    }
  }

  // ── Purposes against the identity and the brand ────────────────────────────
  // All themes carry the same slot keys, so any one theme gives the valid set.
  const firstTheme = Object.values(brand?.themes ?? {})[0];
  const themeKeys = firstTheme && new Set(Object.keys(firstTheme));
  for (const purpose of purposes) {
    const file = `${purpose.id}.purpose`;
    if (identity) {
      for (const id of purpose.scope?.audience ?? []) {
        if (!(id in identity.audiences)) error(file, `scope: audience "${id}" is not in the .identity`);
      }
    }
    errorsOf(file, checkPurpose(purpose, { time, works }, file));
    if (brand) {
      const roles = purpose.use ? brand.roles?.[purpose.use] : undefined;
      if (purpose.use && !roles) error(file, `use: the .brand has no roles "${purpose.use}"`);
      for (const slot of purpose.slots) {
        if (purpose.use) {
          if (roles && slot.typographyRef && !roles[slot.typographyRef]) error(file, `typography "${slot.typographyRef}" is no role of "${purpose.use}" in the .brand`);
        } else if (slot.typographyRef && !brand.typographies?.[slot.typographyRef]) error(file, `typography "${slot.typographyRef}" is not in the .brand`);
        if (slot.colorRef && themeKeys && !themeKeys.has(slot.colorRef)) error(file, `slot "${slot.id}": color "${slot.colorRef}" is not a slot of the .brand's themes`);
      }
      if (purpose.framing && !brand.framings?.some(fr => fr.id === purpose.framing)) error(file, `framing "${purpose.framing}" is not in the .brand`);
    }

    // An example's variables fill from the brand's only place, the .time and the example's work.
    const place = storyPlace({}, places);
    purpose.examples.forEach((example, i) => {
      const work = example.work ? works.find(w => w.id === example.work) : undefined;
      for (const [slotId, text] of Object.entries(example.texts)) {
        for (const v of new Set(storyTextVariables(text ?? ''))) {
          const problem = variableProblem(v, {
            location: brand && !!brand.location, places, place, time, work,
            named: { person: false, group: false, work: !!example.work },
            checked: { person: true, group: true, work: true },
            nameIt: { person: 'a person, which a purpose example cannot name', group: 'a group, which a purpose example cannot name', work: 'a work: on the example' },
          });
          if (problem) error(file, `example ${i + 1}, slot "${slotId}": ${problem}`);
        }
      }
    });
  }

  // ── The fact files, and what names them ────────────────────────────────────
  if (brand) errorsOf(`${brand.id}.brand`, checkBrand(brand, { time, people, groups, works }, `${brand.id}.brand`));
  for (const p of people) errorsOf(`${p.id}.person`, checkPerson(p, { groups, places }, `${p.id}.person`));
  for (const g of groups) errorsOf(`${g.id}.group`, checkGroup(g, { people }, `${g.id}.group`));
  for (const w of works) errorsOf(`${w.id}.work`, checkWork(w, { people, groups, time, places }, `${w.id}.work`));

  // ── Stories ─────────────────────────────────────────────────────────────────
  if (brand) {
    for (const story of stories) {
      const file = `${story.id}.story`;
      errorsOf(file, checkStory(story, {
        purposes, places, time, people, groups, works,
        compositions: [...compositionIds],
        formats: formats.map(f => f.id),
        themes: Object.keys(brand.themes ?? {}),
        backgrounds: (brand.backgrounds ?? []).map(b => ({ id: b.id, themes: b.themes })),
        photos: files.photos ?? (brand.assets?.photos ?? []).map(p => p.id),
        videos: files.videos ?? (brand.assets?.videos ?? []).map(v => v.id),
        illustrations: (brand.assets?.illustrations ?? []).map(i => i.id),
        name: brand.name,
        location: !!brand.location,
      }, file));
    }
  }

  // ── Printed pieces: regions against the format, the brand and the purpose ──
  if (brand) {
    for (const story of stories) {
      const file = `${story.id}.story`;
      const format = formats.find(f => f.id === story.format);
      if (!format) continue;
      const seen = new Set<string>();
      for (const page of story.pages) {
        const purpose = purposes.find(p => p.id === page.purpose);
        if (!purpose) continue;
        for (const cid of page.composition ? [page.composition] : purpose.preferredCompositions) {
          const composition = compositions.find(c => c.id === cid);
          if (!composition || composition.mode !== 'regions' || !composition.regions || seen.has(cid)) continue;
          seen.add(cid);
          const told = new Set<string>();
          const say = (m: string) => { if (!told.has(m)) { told.add(m); error(file, `composition "${cid}": ${m}`); } };
          const print = brand.print;
          if (format.widthMm === undefined || format.heightMm === undefined) say(`regions mode needs a format with a size in mm, "${format.id}" has none`);
          if (print?.unit === undefined) say('regions mode needs a print block with "x:" in the .brand');
          const rows = format.grid?.rows;
          const cols = format.grid?.cols;
          if (!format.grid) say(`regions mode needs a "grid: R C" in format "${format.id}"`);
          const slotIds = new Set<string>(purpose.slots.map(s => s.id));
          // A repeated region holds its item's slots, every other region the rest
          const slot = (id: string, where: string, r?: { repeat?: string[] }) => {
            if (!slotIds.has(id)) { say(`${where}: slot "${id}" is not a slot of purpose "${purpose.id}"`); return; }
            const item = purpose.items?.find(it => it.slots.includes(id as never));
            if (r?.repeat && !r.repeat.includes(item?.id ?? '')) say(`${where}: slot "${id}" is no slot of ${r.repeat.length > 1 ? 'items' : 'item'} "${r.repeat.join(' ')}", the region repeats per ${r.repeat.join(', ')}`);
            if (r && !r.repeat && item) say(`${where}: slot "${id}" belongs to item "${item.id}", a region with "repeat: ${item.id}" holds it`);
          };
          const last = composition.regions[composition.regions.length - 1];
          if (rows !== undefined && last && Array.isArray(last.fields) && last.fields[1] !== rows) say(`the last region ends on field ${last.fields[1]}, format "${format.id}" has ${rows} fields`);
          // By content: each "content" region takes at least one field, "rest" what they leave
          const contents = composition.regions.filter(r => r.fields === 'content').length;
          for (const r of composition.regions) {
            const where = `region "${r.id}"`;
            for (const id of r.repeat ?? []) if (!purpose.items?.some(it => it.id === id)) say(`${where}: repeat "${id}" is no item of purpose "${purpose.id}"`);
            if (rows !== undefined && Array.isArray(r.fields) && r.fields[1] > rows) say(`${where}: fields ${r.fields[0]}-${r.fields[1]} are outside the format's ${rows} fields`);
            if (rows !== undefined && r.fields === 'rest') {
              const most = rows - contents, need = r.stack && 'field' in r.stack ? r.stack.field : 1;
              if (most < need) say(`${where}: it needs ${need} field${need > 1 ? 's' : ''}, format "${format.id}" leaves it at most ${most}`);
            }
            if (r.photo && cols !== undefined && r.photo[0] !== 1 && r.photo[1] !== cols) say(`${where}: photo columns ${r.photo[0]}-${r.photo[1]} stand on neither side of the format's ${cols} columns`);
            if (r.photo && cols !== undefined) for (const pl of r.places) if (pl.cols[1] >= r.photo[0] && pl.cols[0] <= r.photo[1]) say(`${where}: place "${pl.slot}" columns ${pl.cols[0]}-${pl.cols[1]} lie on the photo's ${r.photo[0]}-${r.photo[1]}`);
            if (r.box && cols !== undefined && r.box.cols[1] > cols) say(`${where}: box columns ${r.box.cols[0]}-${r.box.cols[1]} are outside the format's ${cols} columns`);
            // A slot placed at the foot of a region's columns is the page's, not an item's
            const feet = new Set(r.columns ? r.places.map(pl => pl.slot) : []);
            const own = (id: string) => slot(id, where, feet.has(id) ? {} : r);
            for (const pl of r.places) {
              if (cols !== undefined && pl.cols[1] > cols) say(`${where}: place "${pl.slot}" columns ${pl.cols[0]}-${pl.cols[1]} are outside the format's ${cols} columns`);
              own(pl.slot);
            }
            if (r.stack && 'neighbour' in r.stack && r.stack.gapX !== undefined && print?.unit !== undefined && !print.spacers?.includes(r.stack.gapX)) {
              say(`${where}: stack distance ${r.stack.gapX}x is not one of the brand's print spacers`);
            }
            for (const id of [...(r.group ?? []), ...(r.baseline ?? []), ...(r.fit ?? []), ...Object.keys(r.sizes ?? {}), ...Object.entries(r.sizesLike ?? {}).flat()]) own(id);
          }
        }
      }
    }
  }

  return issues;
}
