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
  formats: Pick<ParsedFormat, 'id' | 'purposes'>[];
  compositions: Pick<ParsedComposition, 'id' | 'mode' | 'sticky'>[];
  purposes: ParsedPurpose[];
  stories: ParsedStory[];
  places: ParsedPlace[];
  time: ParsedTime | null;
  people: ParsedPerson[];
  groups: ParsedGroup[];
  works: ParsedWork[];
  /** The photo library's ids (`photoLibrary`); default: the ids of the brand's `photo` blocks. */
  photos?: string[];
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
    if (!purpose.preferredCompositions.length) warning(file, 'compositions: is empty, so the purpose is never placed on a canvas');
    for (const id of purpose.preferredCompositions) {
      used.add(id);
      if (!compositionIds.has(id)) error(file, `compositions: composition "${id}" does not exist`);
    }
  }
  for (const composition of compositions) {
    const file = `${composition.id}.composition`;
    if (!used.has(composition.id)) warning(file, 'no purpose lists this composition, so it is never used');
    if (composition.mode === 'grid' && composition.sticky.length) warning(file, 'sticky: is for flow mode; a grid-mode composition ignores it');
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
      for (const slot of purpose.slots) {
        if (slot.typographyRef && !brand.typographies?.[slot.typographyRef]) error(file, `typography "${slot.typographyRef}" is not in the .brand`);
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
        photos: files.photos ?? (brand.assets?.photos ?? []).map(p => p.id),
        illustrations: (brand.assets?.illustrations ?? []).map(i => i.id),
        name: brand.name,
        location: !!brand.location,
      }, file));
    }
  }

  return issues;
}
