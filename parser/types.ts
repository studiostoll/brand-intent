// Brand Intent — shared types for parsers
// Extracted from Brand Atelier. These are the minimal types
// needed by the four parsers.

/** Semantic slot identifiers — fixed vocabulary. */
export type SlotId = 'primary' | 'secondary' | 'detail' | 'meta' | 'cta' | 'label';

/** Inset distances in px (screen) or mm (print). */
export interface ZoneInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** Text alignment options. */
export type TextAlign = 'left' | 'center' | 'right' | 'justify';

// ── Guided colors (v0.8.0) ────────────────────────────────────────────────────

/** Color resolution mode declared at the brand level. */
export type ColorMode = 'static' | 'dynamic' | 'guided' | 'brand';

/** Palette construction strategy for guided shuffle (Path A only). */
export type PaletteStrategy = 'monochrome' | 'duotone' | 'tricolor' | 'spectrum';

/** Adherence level — how tightly guided derivation follows brand groups. */
export type Adherence = 'strict' | 'on-brand' | 'flexible';

/** Optional per-brand tolerance overrides for the declared adherence level. */
export interface AdherenceTolerances {
  /** Hue drift tolerance in degrees. */
  hueTolerance?: number;
  /** Saturation variance tolerance in percentage points. */
  satTolerance?: number;
}

/** Bounds for all guided derivation — brand scales, state variants, neutral interpolation. */
export interface ColorBounds {
  /** Max luminance for derived tints (0–1). Never brighter than this. */
  light?: number;
  /** Min luminance for derived shades (0–1). Never darker than this. */
  dark?: number;
  /** Min saturation (0–100) for derived colors — prevents washed-out grays. */
  saturationFloor?: number;
}

/** Fixed per-brand state (problem / success / warning / info / inactive) colors. */
export interface StateColors {
  problem?: string;
  warning?: string;
  success?: string;
  info?: string;
  inactive?: string;
}

/** Identity group keys (neutral is structurally distinct). */
export type IdentityGroupKey = 'primary' | 'secondary' | 'accent';
/** All four group keys. */
export type GroupKey = IdentityGroupKey | 'neutral';

/** Fixed neutral-role vocabulary — ordered light → dark. */
export type NeutralRole = 'light' | 'subtle' | 'mid' | 'muted' | 'dark';

/** One entry within a brand color group. */
export interface BrandColorEntry {
  /** Resolved 6-digit hex (uppercase). */
  hex: string;
  /** Display name as authored (`#HEX  Name` → "Name"). Reference entries inherit the target's name. */
  name: string;
  /** Authored role (identity groups) or fixed neutral-role vocabulary (neutral group). */
  role?: string;
  /** Marks this entry as the group default. Only meaningful in identity groups. */
  isDefault?: boolean;
  /** Authored meaning string — human-facing only, engine ignores. */
  meaning?: string;
  /** When the entry was declared via a `$group.role` reference, the reference path (informational only). */
  referencedFrom?: string;
  /** Print specs authored on this entry (Pantone, HKS, CMYK). */
  print?: { pantone?: string; hks?: string; cmyk?: string };
}

/** One color group within the `brand-colors` block. */
export interface BrandColorGroup {
  /** Group key — fixed vocabulary. */
  key: GroupKey;
  /** Authored meaning — human-facing only. */
  meaning?: string;
  /** Selection-probability weight (0–100). Invalid on neutral. */
  distribution?: number;
  /** Ordered entries as declared. */
  entries: BrandColorEntry[];
}


// ── Color rules, pair themes, color families (v0.10.0) ────────────────────────

/** Tone class of a color, from its contrast against white. */
export type ToneClass = 'light' | 'mid' | 'dark';

/** Brand-wide contrast and tone rules. */
export interface ColorRules {
  /** Min contrast for text on ground. */
  text: number;
  /** Min contrast between ground and figure. */
  figure: number;
  /** Tone combinations a pair must not form (unordered). */
  avoid: Array<[ToneClass, ToneClass]>;
  /** Tone thresholds as contrast vs white: [light below, dark at/above]. */
  tones: [number, number];
}

/** How families are arranged. */
export type FamilyOrder = 'cycle' | 'sequence';
/** Which neighbours a family may borrow from. */
export type FamilyBorrow = 'previous' | 'next' | 'both' | 'none';
/** Fixed role vocabulary inside a family. */
export type FamilyRole = 'core' | 'accent' | 'contrast';

/** One color declared inside a family. */
export interface FamilyColor {
  role: FamilyRole;
  /** 6-digit uppercase hex. */
  hex: string;
  /** Display name (authored, or generated as `{family}-{role}[-n]`). */
  name: string;
  /** Key in the flat `brandColors` projection. */
  key: string;
}

/** Where a pair color comes from, seen from the pair's family. */
export type PairOrigin = 'own' | 'prev' | 'next' | 'shared' | 'outside';

/** A checked ground/figure pair. */
export interface PairCheck {
  ground: string;
  figure: string;
  /** Resolved text color for this ground. */
  text: string;
  figureRatio: number;
  textRatio: number;
  /** False when no text candidate reaches the text rule (best one is used). */
  textPasses: boolean;
  tones: [ToneClass, ToneClass];
  origins: [PairOrigin, PairOrigin];
  valid: boolean;
  /** Why the pair fails (empty when valid). */
  reasons: string[];
}

/** A curated pair as declared in a family's `pairs` block. */
export interface FamilyPair extends PairCheck {
  /** Theme name the pair was emitted as (only when valid), e.g. `Winter-3`. */
  theme?: string;
}

export interface ColorFamily {
  name: string;
  /** Start date `MM-DD` (`from:`). Declared on every family or on none. */
  from?: string;
  colors: FamilyColor[];
  pairs: FamilyPair[];
}

export interface ColorFamilies {
  order: FamilyOrder;
  borrow: FamilyBorrow;
  distance: number;
  /** Colors allowed in every family (resolved from `shared:` refs). */
  shared: Array<{ name: string; hex: string }>;
  /** Text and figure colors for photos no pair reads on, in order of preference (`photo-fallback:` refs).
   *  Used only over photos, never in pairs or guided generation. Absent when not declared. */
  photoFallback?: Array<{ name: string; hex: string }>;
  families: ColorFamily[];
}

/** Ground / figure / text of a pair theme (declared or emitted from a family pair). */
export interface ThemePair {
  ground: string;
  figure: string;
  text: string;
  /** Family the theme was emitted from, when it came from `color-families`. */
  family?: string;
}
