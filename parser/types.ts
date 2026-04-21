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
export type ColorMode = 'static' | 'dynamic' | 'guided';

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

