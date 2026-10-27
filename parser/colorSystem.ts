/**
 * Color system helpers — pair themes, color rules, color families.
 *
 * Pure functions shared by the parser (validation at parse time) and by
 * consumers (guided generation, test views with live config overrides).
 * Contrast math follows WCAG 2.x relative luminance.
 */

import type {
  ColorRules,
  ColorFamilies,
  ColorFamily,
  LevelSlot,
  FamilyBorrow,
  FamilyOrder,
  ToneClass,
  PairOrigin,
  PairCheck,
} from './types';

// ── Contrast ────────────────────────────────────────────────────────────────

const HEX6 = /^#[0-9a-fA-F]{6}$/;

/** True for a 6-digit `#RRGGBB` string (the only form the contrast math accepts). */
export function isHex6(value: string): boolean {
  return HEX6.test(value);
}

/** WCAG relative luminance of a 6-digit hex. */
export function relativeLuminance(hex: string): number {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG contrast ratio between two 6-digit hex colors (1–21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// ── Rules ───────────────────────────────────────────────────────────────────

export const DEFAULT_COLOR_RULES: ColorRules = {
  text: 4.5,
  figure: 3,
  avoid: [],
  tones: [1.8, 4.5],
};

/** Tone class from contrast against white: below tones[0] light, at/above tones[1] dark. */
export function toneClass(hex: string, tones: [number, number] = DEFAULT_COLOR_RULES.tones): ToneClass {
  const vsWhite = contrastRatio(hex, '#FFFFFF');
  if (vsWhite < tones[0]) return 'light';
  if (vsWhite >= tones[1]) return 'dark';
  return 'mid';
}

/** Rule violations for a ground/figure pair (empty = passes). Reach is checked separately. */
export function pairRuleViolations(ground: string, figure: string, rules: ColorRules): string[] {
  const reasons: string[] = [];
  const ratio = contrastRatio(ground, figure);
  if (ratio < rules.figure) {
    reasons.push(`contrast ${ratio.toFixed(1)}:1 below ${rules.figure}:1`);
  }
  const tg = toneClass(ground, rules.tones);
  const tf = toneClass(figure, rules.tones);
  for (const [a, b] of rules.avoid) {
    if ((tg === a && tf === b) || (tg === b && tf === a)) {
      reasons.push(`${tg}+${tf} combination avoided`);
      break;
    }
  }
  return reasons;
}

// ── Pair themes ─────────────────────────────────────────────────────────────

/** Alpha stops for the derived text tiers below text-primary. */
const TEXT_TIERS: Array<[string, number]> = [
  ['text-secondary', 0.85],
  ['text-tertiary', 0.7],
  ['text-subtle', 0.55],
  ['text-muted', 0.4],
];

function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Full theme slot map derived from a ground / figure / text triple. */
export function derivePairSlots(ground: string, figure: string, text: string): Record<string, string> {
  const slots: Record<string, string> = {
    'background': ground,
    'text-primary': text,
  };
  for (const [slot, alpha] of TEXT_TIERS) slots[slot] = withAlpha(text, alpha);
  for (const slot of ['logo', 'cta', 'divider', 'icon', 'illustration', 'sticker-bg', 'label-bg', 'counter-bg']) {
    slots[slot] = figure;
  }
  slots['sticker-fg'] = ground;
  slots['label-fg'] = ground;
  slots['counter-fg'] = ground;
  return slots;
}

/**
 * Resolve the text color for a ground.
 * `preferred` candidates are tried in order; the first reaching `rules.text` wins.
 * When none passes, the highest-contrast preferred candidate is used (`passes: false`).
 * Black/white are only considered when no preferred candidates exist.
 */
export function resolveTextColor(
  ground: string,
  preferred: string[],
  rules: ColorRules,
): { text: string; ratio: number; passes: boolean } {
  const candidates = preferred.filter(isHex6);
  const pool = candidates.length > 0 ? candidates : ['#000000', '#FFFFFF'];
  for (const c of pool) {
    const ratio = contrastRatio(ground, c);
    if (ratio >= rules.text) return { text: c, ratio, passes: true };
  }
  let best = pool[0];
  let bestRatio = contrastRatio(ground, best);
  for (const c of pool.slice(1)) {
    const ratio = contrastRatio(ground, c);
    if (ratio > bestRatio) { best = c; bestRatio = ratio; }
  }
  return { text: best, ratio: bestRatio, passes: false };
}

// ── Families ────────────────────────────────────────────────────────────────

export interface ReachConfig {
  order: FamilyOrder;
  borrow: FamilyBorrow;
  distance: number;
}

/**
 * Indices of the families on the cycle: the dated ones when any family declares `from:`,
 * else all. Undated families next to dated ones are hand-picked contexts (e.g. a plain context) and never borrow.
 */
export function cycleMembers(families: Pick<ColorFamily, 'from'>[]): number[] {
  const dated = families.flatMap((f, i) => (f.from ? [i] : []));
  return dated.length > 0 ? dated : families.map((_, i) => i);
}

/**
 * Families reachable from `index` (excluding itself), labelled by direction.
 * `members` limits the cycle to these family indices (see `cycleMembers`); default all `count`.
 */
export function reachableFamilies(count: number, index: number, config: ReachConfig, members?: number[]): Map<number, 'prev' | 'next'> {
  if (members) {
    const pos = members.indexOf(index);
    if (pos === -1) return new Map();
    const inner = reachableFamilies(members.length, pos, config);
    return new Map([...inner].map(([j, dir]) => [members[j], dir]));
  }
  const reach = new Map<number, 'prev' | 'next'>();
  if (config.borrow === 'none') return reach;
  const wantPrev = config.borrow === 'previous' || config.borrow === 'both';
  const wantNext = config.borrow === 'next' || config.borrow === 'both';
  for (let d = 1; d <= config.distance; d++) {
    if (wantPrev) {
      const j = index - d;
      if (j >= 0) reach.set(j, 'prev');
      else if (config.order === 'cycle') reach.set(((j % count) + count) % count, 'prev');
    }
    if (wantNext) {
      const j = index + d;
      if (j < count) { if (!reach.has(j)) reach.set(j, 'next'); }
      else if (config.order === 'cycle') { const w = j % count; if (!reach.has(w)) reach.set(w, 'next'); }
    }
  }
  reach.delete(index);
  return reach;
}

/** True when the reach config lets every family borrow from every other one. */
export function reachCoversAll(count: number, config: ReachConfig): boolean {
  if (count < 3) return false;
  for (let i = 0; i < count; i++) {
    if (reachableFamilies(count, i, config).size < count - 1) return false;
  }
  return true;
}

/** Where a color comes from, seen from family `index`. Null = not usable there. */
export function colorOrigin(
  hex: string,
  index: number,
  system: Pick<ColorFamilies, 'families' | 'shared'>,
  config: ReachConfig,
): PairOrigin | null {
  const families = system.families;
  if (families[index]?.colors.some(c => c.hex === hex)) return 'own';
  if (system.shared.some(s => s.hex === hex)) return 'shared';
  const reach = reachableFamilies(families.length, index, config, cycleMembers(families));
  for (const [j, dir] of reach) {
    if (families[j].colors.some(c => c.hex === hex)) return dir;
  }
  return null;
}

/**
 * Family in season on `date`: the one with the latest `from:` on or before that
 * month/day, wrapping to the year's last start before the first one. Uses the
 * date's local calendar day. Undated families never win. -1 when no family declares a date.
 */
export function familyIndexForDate(families: Pick<ColorFamily, 'from'>[], date: Date): number {
  const today = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  let best = -1;
  let latest = -1;
  families.forEach((f, i) => {
    if (!f.from) return;
    if (f.from! <= today && (best === -1 || f.from! > families[best].from!)) best = i;
    if (latest === -1 || f.from! > families[latest].from!) latest = i;
  });
  return best !== -1 ? best : latest;
}

/** Name of the family that declares `hex` (first match), for error messages. */
export function owningFamily(hex: string, families: ColorFamily[]): string | undefined {
  return families.find(f => f.colors.some(c => c.hex === hex))?.name;
}

/** Text candidates for a family ground: its contrast color(s), then shared colors, then extras. */
export function familyTextCandidates(family: ColorFamily, shared: Array<{ hex: string }>, extra: string[] = []): string[] {
  const out: string[] = [];
  for (const c of family.colors) if (c.role === 'contrast') out.push(c.hex);
  for (const s of shared) out.push(s.hex);
  for (const e of extra) out.push(e);
  return [...new Set(out)];
}

/** Validate one ground/figure pair for family `index` against reach + rules. */
export function checkFamilyPair(
  ground: string,
  figure: string,
  index: number,
  system: ColorFamilies,
  config: ReachConfig,
  rules: ColorRules,
  extraTextCandidates: string[] = [],
): PairCheck {
  const reasons: string[] = [];
  const origins: [PairOrigin | null, PairOrigin | null] = [
    colorOrigin(ground, index, system, config),
    colorOrigin(figure, index, system, config),
  ];
  for (const [hex, origin] of [[ground, origins[0]], [figure, origins[1]]] as const) {
    if (origin === null) {
      const owner = owningFamily(hex, system.families);
      reasons.push(owner ? `${hex} from ${owner} is out of reach` : `${hex} is not in any family or shared`);
    }
  }
  reasons.push(...pairRuleViolations(ground, figure, rules));
  const family = system.families[index];
  const text = resolveTextColor(ground, familyTextCandidates(family, system.shared, extraTextCandidates), rules);
  return {
    ground,
    figure,
    text: text.text,
    figureRatio: contrastRatio(ground, figure),
    textRatio: text.ratio,
    textPasses: text.passes,
    tones: [toneClass(ground, rules.tones), toneClass(figure, rules.tones)],
    origins: [origins[0] ?? 'outside', origins[1] ?? 'outside'],
    valid: reasons.length === 0,
    reasons,
  };
}

/** Every ordered ground/figure pair available to family `index`, checked. */
export function enumerateFamilyPairs(
  index: number,
  system: ColorFamilies,
  config: ReachConfig,
  rules: ColorRules,
  extraTextCandidates: string[] = [],
): PairCheck[] {
  const pool = new Set<string>();
  for (const c of system.families[index].colors) pool.add(c.hex);
  for (const s of system.shared) pool.add(s.hex);
  for (const j of reachableFamilies(system.families.length, index, config, cycleMembers(system.families)).keys()) {
    for (const c of system.families[j].colors) pool.add(c.hex);
  }
  const colors = [...pool];
  const out: PairCheck[] = [];
  for (const g of colors) {
    for (const f of colors) {
      if (g === f) continue;
      out.push(checkFamilyPair(g, f, index, system, config, rules, extraTextCandidates));
    }
  }
  return out;
}

// ── Levels ──────────────────────────────────────────────────────────────────

/** The fixed level slots, in four groups: ground, contrast, inset, signal. */
export const LEVEL_SLOTS = [
  'ground', 'on-ground/headline', 'on-ground/text', 'on-ground/accent', 'on-ground/line', 'on-ground/divider',
  'contrast', 'on-contrast',
  'inset', 'on-inset/text', 'on-inset/accent',
  'signal', 'on-signal',
] as const;

/**
 * Pairs `color-rules` checks in every level cell: [figure slot, ground slot, rule].
 * Dividers are decorative and not checked.
 */
export const LEVEL_PAIRS: Array<[LevelSlot, LevelSlot, 'text' | 'figure']> = [
  ['on-ground/headline', 'ground', 'text'],
  ['on-ground/text', 'ground', 'text'],
  ['on-ground/accent', 'ground', 'figure'],
  ['on-ground/line', 'ground', 'figure'],
  ['on-contrast', 'contrast', 'text'],
  ['on-inset/text', 'inset', 'text'],
  ['on-inset/accent', 'inset', 'figure'],
  ['on-signal', 'signal', 'text'],
];

/** Rule warnings for one resolved level cell, e.g. `Dusk / Light / on-ground/accent on ground 2.1:1 < 3`. */
export function levelRuleViolations(family: string, level: string, cell: Record<LevelSlot, string>, rules: ColorRules): string[] {
  const out: string[] = [];
  for (const [fig, ground, rule] of LEVEL_PAIRS) {
    const ratio = contrastRatio(cell[fig], cell[ground]);
    if (ratio < rules[rule]) out.push(`${family} / ${level} / ${fig} on ${ground} ${ratio.toFixed(1)}:1 < ${rules[rule]}`);
  }
  return out;
}
