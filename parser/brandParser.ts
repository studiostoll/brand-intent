/**
 * Parser for .brand brand definition files.
 *
 * Line-based format, same conventions as .purpose / .composition / .format / .identity.
 * Strategic/narrative content belongs in the sibling `.identity` file — this parser
 * handles expression-layer primitives only (colors, typography, dividers, assets, badge styles).
 */

import type {
  BrandColorGroup,
  BrandColorEntry,
  ColorMode,
  PaletteStrategy,
  Adherence,
  AdherenceTolerances,
  ColorBounds,
  StateColors,
  GroupKey,
  NeutralRole,
  ColorRules,
  ColorFamilies,
  ColorFamily,
  FamilyColor,
  FamilyRole,
  FamilyOrder,
  FamilyBorrow,
  ToneClass,
  ThemePair,
} from './types';
import {
  DEFAULT_COLOR_RULES,
  isHex6,
  contrastRatio,
  derivePairSlots,
  resolveTextColor,
  checkFamilyPair,
  reachCoversAll,
} from './colorSystem';
import { parseIconSource, isIconId } from './icons';
import { parseDateWindowRanges } from './dateWindows';
import type { DateWindowRange } from './dateWindows';
import type { ParsedIconDef } from './icons';

// ── Parsed type ────────────────────────────────────────────────────────────────

export interface ParsedBrand {
  id: string;
  name: string;
  language: string;
  locale: string;
  /** Canonical domain for this brand (used for OG meta, favicon paths, share links). */
  domain?: string;
  /** Named font primitives: name → font definition. First entry is the brand default. */
  fonts?: Record<string, ParsedFontDef>;
  /** Token source type: 'figma' | 'inline' */
  tokensSource: 'figma' | 'inline';
  /** Figma file key (only when tokensSource === 'figma') */
  figmaFileKey?: string;
  /** Figma collection name (only when tokensSource === 'figma') */
  figmaCollection?: string;
  /** Path to the runtime tokens file (relative to /src) */
  tokensFile: string;
  /** Path to app icon asset (relative to /public), used for PWA icon */
  appIcon?: string;
  /** Path to favicon asset (relative to /public), used for browser tab icon */
  favicon?: string;
  /** Path to OG image asset (relative to /public), used for social sharing previews */
  ogImage?: string;
  /** Core brand color primitives: name → hex (e.g. primary, secondary, accent1, accent2, white).
   *  Always present when any colors are declared — grouped-syntax brands get a flat projection
   *  generated from all entries, so legacy consumers keep working unchanged. */
  brandColors?: Record<string, string>;
  /** Structured print specs per brand color: name → {pantone?, hks?, cmyk?} */
  brandColorPrint?: Record<string, BrandColorPrintSpec>;
  /** Grouped-syntax representation (v0.8.0+). Present only when the `brand-colors` block uses the grouped form. */
  colorGroups?: BrandColorGroup[];
  /** Per-brand fixed state colors (problem/warning/success/info/inactive). */
  stateColors?: StateColors;
  /** Bounds for guided derivation (luminance + saturation floor). */
  colorBounds?: ColorBounds;
  /** Color resolution mode. Defaults behave as `static` when absent. */
  colorMode?: ColorMode;
  /** Palette strategy default for Path A (guided shuffle). Optional. */
  colorStrategy?: PaletteStrategy;
  /** Adherence level for guided derivation. Optional — engine-side default per level. */
  colorAdherence?: Adherence;
  /** Per-brand tolerance overrides for the declared adherence level. */
  colorAdherenceOverrides?: AdherenceTolerances;
  /** Contrast + tone rules (`color-rules` block). Absent when not declared. */
  colorRules?: ColorRules;
  /** Color families (`color-families` block): ordered sets with roles, reach config and checked pairs. */
  colorFamilies?: ColorFamilies;
  /** Ground / figure / text for every pair theme (authored `ground:`/`figure:` themes and emitted family pairs). */
  themePairs?: Record<string, ThemePair>;
  /** Non-fatal color findings: rule violations, rejected family pairs, reach config hints. */
  colorWarnings?: string[];
  /** Inline themes: theme name → slot name → resolved hex color (only when tokensSource === 'inline') */
  themes?: Record<string, Record<string, string>>;
  /** Print annotations from inline # comments: slot name → annotation text */
  themeDescriptions?: Record<string, string>;
  /** Spacing scale (only when tokensSource === 'inline') */
  spacing?: { unit: string; xs: number; s: number; m: number; l: number; xl: number };
  /** Divider style definitions: name → divider config */
  dividers?: Record<string, ParsedDividerDef>;
  /** Named typography styles: name → style definition */
  typographies?: Record<string, ParsedTypographyDef>;
  /** Brand-declared assets: curated logos, photos, videos, illustrations with labels and metadata */
  assets?: { logos?: ParsedAssetDef[]; photos?: ParsedAssetDef[]; videos?: ParsedAssetDef[]; illustrations?: ParsedAssetDef[] };
  /** Label badge style — padding (top/right/bottom/left in cqh) and corner radius (cqh) */
  label?: ParsedBadgeStyle;
  /** CTA pill style — padding (top/right/bottom/left in cqh) and corner radius (cqh, or 999 for full pill) */
  cta?: ParsedBadgeStyle;
  /** Brand icon set (`icons` block), in declaration order. Absent → the brand has no set. */
  icons?: ParsedIconDef[];
  /** List counter component (`counter` block). */
  counter?: ParsedCounterDef;
  /** Photo framing modules (`framing NAME` blocks), in declaration order. Absent → no camera guides. */
  framings?: ParsedFramingDef[];
  /** Camera defaults (`camera` block). Absent → rear camera, no grid. */
  camera?: ParsedCameraDef;
  /** Photo treatment (`photo-look` block). Absent → photos stay as taken. */
  photoLook?: ParsedPhotoLookDef;
  /** Named yearly date windows (`windows` block): name → ranges. Referenced by sample `@name` markers and photo `when:`. */
  windows?: Record<string, DateWindowRange[]>;
}

export type PhotoLookKey = 'saturation' | 'contrast' | 'warmth' | 'fade' | 'mono' | 'duotone';

export interface ParsedPhotoLookDef {
  /** -100..100, 0 = unchanged. */
  saturation: number;
  /** -100..100, 0 = unchanged. */
  contrast: number;
  /** -100 (cool) .. 100 (warm), 0 = unchanged. */
  warmth: number;
  /** Lifted black point, 0..100. */
  fade: number;
  /** Grayscale (monochrome). */
  mono: boolean;
  /** Map luminance onto two colors (resolved hex), shadows → highlights. Excludes `mono`. */
  duotone?: { shadow: string; highlight: string };
  /** Keys the person cannot change. All others are starting values. */
  fixed: PhotoLookKey[];
}

export interface ParsedCameraDef {
  /** Which camera opens first. */
  facing: 'front' | 'rear';
  /** Viewfinder grid as rows × columns of cells. Absent → no grid. */
  grid?: { rows: number; cols: number };
}

export interface ParsedFramingDef {
  id: string;
  /** Display name. Defaults to the id. */
  label: string;
  /** Horizon position as % of image height, measured from the top. null → no horizon (close-ups). */
  horizon: number | null;
  /** The photographic task, one line. */
  description?: string;
}

export type CounterFormat = '1' | '01' | '1.' | '(1)' | 'i';
export type CounterShape = 'none' | 'circle' | 'square' | 'pill';

export interface ParsedCounterDef {
  /** Number format: 1 | 01 | 1. | (1) | i (lowercase roman). */
  format: CounterFormat;
  /** Typography style for the digits. Absent → the list item's typography. */
  typography?: string;
  /** Background shape, coloured with the theme's counter-bg / counter-fg. */
  shape: CounterShape;
  /** Counter height in em, relative to the list item text. */
  size: number;
  /** Inner padding in em. */
  padding: number;
}

export interface ParsedAssetDef {
  id: string;
  label: string;
  src: string;
  aspectRatio?: number;
  scale?: number;
  lottieSrc?: string;
  animated?: boolean;
  loop?: boolean;
  /** Path to a glTF/GLB 3D model. When present, the asset renders as a live 3D object; `src` remains the 2D fallback. */
  gltfSrc?: string;
  /** Procedural generator id (e.g. "mobius", "spiral", "ribbon"). Renders as live geometry; `src` is the 2D fallback. */
  generator?: string;
  /** Default parameters for the procedural generator, keyed by param name. Declared via the indented `generator-params` sub-block. */
  generatorParams?: Record<string, number>;
  /** Logos only: artwork per horizontal placement, declared via `align-left` / `align-center` / `align-right`
   *  sub-blocks. Consumers render the variant matching where the logo sits, else the base `src`. */
  alignVariants?: Partial<Record<LogoAlign, { src: string; aspectRatio?: number }>>;
  /** Library group (e.g. "experimental"). Consumers list each group as its own section after the ungrouped assets. */
  group?: string;
  /** Photos only: name of the date window the photo fits (`when:`). Absent → all year. */
  when?: string;
}

export type LogoAlign = 'left' | 'center' | 'right';

export interface ParsedBadgeStyle {
  /** Padding in cqh: [top, right, bottom, left] */
  padding: [number, number, number, number];
  /** Corner radius in cqh. Use 999 for a full pill. */
  radius: number;
}

export interface ParsedFontDef {
  /** Display name, e.g. "Matter", "system-ui", "Inter" */
  name: string;
  /** CSS fallback stack, e.g. "sans-serif", "serif" */
  fallback: string;
  /** Font source: 'local' (bundled in public/fonts/), 'system' (no @font-face), 'google' (future) */
  source: 'local' | 'system' | 'google';
  /** Variable font filename, relative to the brand's fonts/ directory. Used by preview where weight interpolation matters. */
  variable?: string;
  /** Variable italic font filename, when the family ships separate Roman/Italic variable files. */
  variableItalic?: string;
  /**
   * Static font instances, keyed by `{weight}` or `{weight}i` (italic).
   * E.g. `{ "400": "Pangea-Regular.ttf", "400i": "Pangea-Italic.ttf", "600": "Pangea-SemiBold.ttf" }`.
   * Required for export pipelines (Chromium PDF, print) that cannot embed variable or WOFF2 fonts.
   * Filenames are relative to the brand's `fonts/` directory and may contain subdirectories.
   */
  static?: Record<string, string>;
}

export interface BrandColorPrintSpec {
  /** PANTONE color name, e.g. "286 C" */
  pantone?: string;
  /** HKS color name, e.g. "44 K" */
  hks?: string;
  /** CMYK values as "C/M/Y/K" string, e.g. "97/80/0/31" */
  cmyk?: string;
}

export interface ParsedTypographyDef {
  /** Font key referencing a named font block (e.g. "mono"). Defaults to the brand primary font. */
  font?: string;
  weight: number;
  size: number;
  opsz?: number;
  lineHeight: number;
  letterSpacing?: number;
  italic?: boolean;
  uppercase?: boolean;
  /** Weight to use for **strong** inline markup. If absent, strong renders as normal. */
  strong?: number;
  /** Autofit minimum font size in cqh. If absent, autofit is disabled (fixed size). */
  autofitMin?: number;
  /** Autofit maximum font size in cqh. If absent, autofit is disabled (fixed size). */
  autofitMax?: number;
}

export interface ParsedDividerDef {
  /** Line thickness in cqmin */
  thickness: number;
  /** Line width — percentage string (e.g. '15%') or '100%' */
  width: string;
  /** Spacing token name applied above and below the divider (xs | s | m | l | xl) */
  spacing: string;
  /** Horizontal alignment of a partial-width divider (default: 'left') */
  align: 'left' | 'center' | 'right';
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const GROUP_KEYWORDS = new Set<string>(['primary', 'secondary', 'accent', 'neutral']);
const NEUTRAL_ROLES = new Set<NeutralRole>(['light', 'subtle', 'mid', 'muted', 'dark']);
const STATE_KEYS = new Set<string>(['problem', 'warning', 'success', 'info', 'inactive']);
const VALID_COLOR_MODES = new Set<ColorMode>(['static', 'dynamic', 'guided', 'brand']);
const VALID_STRATEGIES = new Set<PaletteStrategy>(['monochrome', 'duotone', 'tricolor', 'spectrum']);
const VALID_ADHERENCES = new Set<Adherence>(['strict', 'on-brand', 'flexible']);
const TONE_CLASSES = new Set<ToneClass>(['light', 'mid', 'dark']);
const FAMILY_ROLES = new Set<FamilyRole>(['core', 'accent', 'contrast']);

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function isMonthDay(value: string): boolean {
  const m = value.match(/^(\d{2})-(\d{2})$/);
  if (!m) return false;
  const month = Number(m[1]), day = Number(m[2]);
  return month >= 1 && month <= 12 && day >= 1 && day <= DAYS_IN_MONTH[month - 1];
}
const FAMILY_ORDERS = new Set<FamilyOrder>(['cycle', 'sequence']);
const FAMILY_BORROWS = new Set<FamilyBorrow>(['previous', 'next', 'both', 'none']);
const PAIR_KEYS = ['ground', 'figure', 'text'] as const;

/** Flat-projection key for a display name: lowercased, spaces → hyphens. */
function colorKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Expand a 3-digit hex to 6-digit. Pass-through for 6 or 8-digit.
 * Returns null for invalid input.
 */
function normalizeHex(hex: string): string | null {
  const m = hex.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
  if (!m) return null;
  const body = m[1];
  if (body.length === 3) {
    return '#' + body.split('').map(c => c + c).join('').toUpperCase();
  }
  return '#' + body.toUpperCase();
}

/** Parse a 6-digit hex into [r, g, b]. Input must be normalised to 6 digits. */
function hexToRgb(hex6: string): [number, number, number] {
  const body = hex6.slice(1);
  return [
    parseInt(body.slice(0, 2), 16),
    parseInt(body.slice(2, 4), 16),
    parseInt(body.slice(4, 6), 16),
  ];
}

/**
 * Resolve a theme-slot value string to a final CSS color.
 *
 * Supports: `$ref`, `$ref NN%`, `#HEX`, `#HEX NN%`, raw rgba(...) pass-through.
 * Throws on malformed alpha or unresolved `$ref`.
 */
function resolveThemeSlotValue(
  raw: string,
  brandColors: Record<string, string>,
  fileName: string,
  slot: string,
): string {
  const value = raw.trim();

  // Legacy rgba(...) literal — pass through unchanged.
  if (/^rgba?\s*\(/i.test(value)) return value;

  // Detect an alpha suffix: "<base> NN%" (one or more spaces, numeric, trailing %).
  // If the line contains a % but the shape doesn't match, it's malformed.
  let base = value;
  let alpha: number | null = null;
  const alphaMatch = value.match(/^(\S+)\s+([0-9]+(?:\.[0-9]+)?)%$/);
  if (alphaMatch) {
    base = alphaMatch[1];
    alpha = parseFloat(alphaMatch[2]);
    if (alpha < 0 || alpha > 100) {
      throw new Error(
        `${fileName}: theme slot "${slot}" alpha must be between 0 and 100, got ${alpha}`,
      );
    }
  } else if (value.includes('%')) {
    throw new Error(
      `${fileName}: theme slot "${slot}" alpha syntax is "<value> NN%" with a single space, got "${value}"`,
    );
  }

  // Resolve base to a hex string.
  let hex: string | null = null;
  if (base.startsWith('$')) {
    const refName = base.slice(1);
    const resolved = brandColors[refName];
    if (!resolved) {
      throw new Error(
        `${fileName}: theme slot "${slot}" references unknown brand color "$${refName}"`,
      );
    }
    hex = normalizeHex(resolved);
    if (!hex) {
      throw new Error(
        `${fileName}: theme slot "${slot}" base "$${refName}" resolves to "${resolved}", which is not a valid hex color`,
      );
    }
  } else {
    hex = normalizeHex(base);
    if (!hex) {
      // Not a hex, not a $ref — but it might be a bare keyword like "currentColor" or
      // a semantic slot name used for dividers historically. Pass through only when
      // no alpha was requested; with alpha, the base must be concrete.
      if (alpha !== null) {
        throw new Error(
          `${fileName}: theme slot "${slot}" base "${base}" must be "$ref" or "#HEX" when using alpha`,
        );
      }
      return value;
    }
  }

  // No alpha → solid hex.
  if (alpha === null) return hex;

  // 100% alpha → emit solid hex (keep output clean).
  if (alpha === 100) return hex;

  const [r, g, b] = hexToRgb(hex);
  // Drop trailing zeros for cleanliness: 0.7 not 0.70, 0.5 not 0.50.
  const a = Number((alpha / 100).toFixed(4)).toString();
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// ── Parser ─────────────────────────────────────────────────────────────────────

export function parseBrandFile(content: string, fileName: string): ParsedBrand {
  const lines = content.split('\n');

  const result: Partial<ParsedBrand> = {
    tokensFile: 'tokens.json',
    tokensSource: 'figma',
  };

  type ActiveBlock = 'none' | 'brand-colors' | 'state-colors' | 'color-bounds' | 'color-adherence' | 'color-rules' | 'color-families' | 'theme' | 'spacing' | 'divider' | 'typography' | 'font' | 'logo' | 'photo' | 'video' | 'illustration' | 'label' | 'cta' | 'icons' | 'counter' | 'framing' | 'camera' | 'photo-look' | 'windows';
  let activeBlock: ActiveBlock = 'none';
  let currentThemeName = '';
  let currentDividerName = '';
  let currentTypographyName = '';
  let currentFontName = '';
  const brandColors: Record<string, string> = {};
  const brandColorPrint: Record<string, BrandColorPrintSpec> = {};
  let currentBrandColorName = '';

  // Grouped brand-colors state (v0.8.0+).
  // Shape is detected lazily: when the first non-blank indented line inside `brand-colors`
  // is a bare group keyword, the block switches to grouped mode. Otherwise it stays flat.
  type GroupedShape = 'unknown' | 'flat' | 'grouped';
  let brandColorsShape: GroupedShape = 'unknown';
  const colorGroups: BrandColorGroup[] = [];
  let currentGroup: BrandColorGroup | null = null;
  let currentGroupedEntry: BrandColorEntry | null = null;
  const stateColorsRaw: Record<string, string> = {};
  const colorBoundsRaw: Record<string, string> = {};
  const adherenceOverridesRaw: Record<string, string> = {};
  const colorRulesRaw: Record<string, string> = {};
  let colorRulesDeclared = false;
  type RawFamily = { name: string; line: number; from?: string; colors: Array<{ role: string; value: string; line: number }>; pairs: Array<{ ground: string; figure: string; line: number }> };
  const familiesProps: Record<string, string> = {};
  const familiesRaw: RawFamily[] = [];
  let familiesDeclared = false;
  let currentFamily: RawFamily | null = null;
  let inPairs = false;
  const themes: Record<string, Record<string, string>> = {};
  const themeDescriptions: Record<string, string> = {};
  const spacingRaw: Record<string, string> = {};
  const dividersRaw: Record<string, Record<string, string>> = {};
  const typographiesRaw: Record<string, Record<string, string>> = {};
  const fontsRaw: Array<{ name: string; props: Record<string, string> }> = [];
  const logosRaw: Array<{ id: string; props: Record<string, string> }> = [];
  const photosRaw: Array<{ id: string; props: Record<string, string> }> = [];
  const videosRaw: Array<{ id: string; props: Record<string, string> }> = [];
  const illustrationsRaw: Array<{ id: string; props: Record<string, string> }> = [];
  let currentAssetId = '';
  let currentSubBlock: string | null = null;
  const labelRaw: Record<string, string> = {};
  const ctaRaw: Record<string, string> = {};
  const icons: ParsedIconDef[] = [];
  let iconsDeclared = false;
  const counterRaw: Record<string, { value: string; line: number }> = {};
  let counterDeclared = false;
  const cameraRaw: Record<string, { value: string; line: number }> = {};
  let cameraDeclared = false;
  const photoLookRaw: Record<string, { value: string; line: number }> = {};
  let photoLookDeclared = false;
  const windowsRaw: Array<{ name: string; value: string; line: number }> = [];
  let windowsDeclared = false;
  const framingsRaw: Array<{ id: string; line: number; props: Record<string, { value: string; line: number }> }> = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const lineNum = i + 1;
    const isIndented = raw.startsWith('  ') || raw.startsWith('\t');

    // Comment — end any active block and skip
    if (raw.startsWith('#')) {
      activeBlock = 'none';
      continue;
    }

    // Indented continuation line — route to the active block
    if (isIndented) {
      if (activeBlock === 'brand-colors') {
        const trimmed = raw.trimStart();
        if (trimmed === '') continue;
        const indentLen = raw.length - trimmed.length;

        // Shape detection: first non-blank indented line decides.
        // Grouped = bare group keyword (`primary`/`secondary`/`accent`/`neutral`) at 2-space indent.
        // Flat    = `key: value` at 2-space indent.
        if (brandColorsShape === 'unknown') {
          if (GROUP_KEYWORDS.has(trimmed) && indentLen <= 2) {
            brandColorsShape = 'grouped';
          } else {
            brandColorsShape = 'flat';
          }
        }

        if (brandColorsShape === 'grouped') {
          // ── Grouped shape ────────────────────────────────────────────────
          const groupKwMatch = GROUP_KEYWORDS.has(trimmed) && indentLen <= 2;
          if (groupKwMatch) {
            const key = trimmed as GroupKey;
            if (colorGroups.some(g => g.key === key)) {
              throw new Error(`${fileName}:${lineNum}: duplicate color group "${key}"`);
            }
            currentGroup = { key, entries: [] };
            colorGroups.push(currentGroup);
            currentGroupedEntry = null;
            continue;
          }
          if (!currentGroup) {
            throw new Error(
              `${fileName}:${lineNum}: grouped brand-colors entries must appear inside a group block (primary/secondary/accent/neutral)`,
            );
          }
          // Group-level properties at 4-space indent OR color-entry header / sub-properties.
          // We distinguish by: entry header = starts with `#` or `$`.
          if (trimmed.startsWith('#') || trimmed.startsWith('$')) {
            // New entry. Header forms:
            //   "#HEX  Display Name"
            //   "$group.role"
            if (trimmed.startsWith('#')) {
              // Split header: "#HEX  Name" — hex then whitespace then name
              const headerMatch = trimmed.match(/^(#[0-9a-fA-F]{3,8})(?:\s+(.+))?$/);
              if (!headerMatch) {
                throw new Error(
                  `${fileName}:${lineNum}: expected "#HEX  Name" entry header, got "${trimmed}"`,
                );
              }
              const hex = normalizeHex(headerMatch[1]);
              if (!hex) {
                throw new Error(
                  `${fileName}:${lineNum}: invalid hex "${headerMatch[1]}"`,
                );
              }
              const name = (headerMatch[2] ?? '').trim();
              if (!name) {
                throw new Error(
                  `${fileName}:${lineNum}: color entry needs a display name after the hex`,
                );
              }
              currentGroupedEntry = { hex, name };
              currentGroup.entries.push(currentGroupedEntry);
            } else {
              // $group.role reference — resolved in finalisation pass.
              const refMatch = trimmed.match(/^\$([a-z]+)\.([a-z-]+)$/i);
              if (!refMatch) {
                throw new Error(
                  `${fileName}:${lineNum}: expected "$group.role" reference, got "${trimmed}"`,
                );
              }
              currentGroupedEntry = {
                hex: '',
                name: '',
                referencedFrom: `${refMatch[1]}.${refMatch[2]}`,
              };
              currentGroup.entries.push(currentGroupedEntry);
            }
            continue;
          }
          // `key: value` line — either group property (indent ≤ 4) or entry sub-property.
          const colonIdx = trimmed.indexOf(':');
          if (colonIdx === -1) continue;
          const key = trimmed.slice(0, colonIdx).trim();
          const value = trimmed.slice(colonIdx + 1).trim();
          // Group property lives at indent 4 and only appears before the first entry.
          if (indentLen <= 4 && !currentGroupedEntry) {
            if (key === 'meaning') {
              currentGroup.meaning = value;
            } else if (key === 'distribution') {
              if (currentGroup.key === 'neutral') {
                throw new Error(
                  `${fileName}:${lineNum}: neutral group cannot declare distribution — it's the scale, not a selection target`,
                );
              }
              const pct = parseFloat(value.replace(/%$/, ''));
              if (isNaN(pct)) {
                throw new Error(
                  `${fileName}:${lineNum}: distribution "${value}" is not a number`,
                );
              }
              currentGroup.distribution = pct;
            }
            continue;
          }
          // Entry sub-property.
          if (!currentGroupedEntry) continue;
          if (key === 'role') {
            currentGroupedEntry.role = value;
            if (value === 'default') currentGroupedEntry.isDefault = true;
          } else if (key === 'meaning') {
            currentGroupedEntry.meaning = value;
          } else if (key === 'pantone' || key === 'hks' || key === 'cmyk') {
            if (!currentGroupedEntry.print) currentGroupedEntry.print = {};
            currentGroupedEntry.print[key] = value;
          }
          continue;
        }

        // ── Flat shape (legacy) ────────────────────────────────────────────
        const colonIdx = trimmed.indexOf(':');
        if (colonIdx !== -1) {
          const key = trimmed.slice(0, colonIdx).trim();
          const value = trimmed.slice(colonIdx + 1).trim();
          if (indentLen <= 2) {
            // Top-level color line: "  primary: #0324B1"
            // Brand colors are solid primitives only — alpha belongs in theme slots.
            if (/%/.test(value) || /rgba\s*\(/i.test(value)) {
              throw new Error(
                `${fileName}:${lineNum}: brand color "${key}" must be a solid hex — alpha syntax (e.g. "$ref 75%" or rgba()) is only allowed in theme slots`,
              );
            }
            brandColors[key] = value;
            currentBrandColorName = key;
          } else if (currentBrandColorName) {
            // Print sub-key: "    pantone: 286 C" / "    hks: 44 K" / "    cmyk: 97/80/0/31"
            if (!brandColorPrint[currentBrandColorName]) brandColorPrint[currentBrandColorName] = {};
            const spec = brandColorPrint[currentBrandColorName];
            if (key === 'pantone') spec.pantone = value;
            else if (key === 'hks') spec.hks = value;
            else if (key === 'cmyk') spec.cmyk = value;
          }
        }
        continue;
      }
      if (activeBlock === 'state-colors') {
        const trimmed = raw.trimStart();
        const colonIdx = trimmed.indexOf(':');
        if (colonIdx !== -1) {
          const key = trimmed.slice(0, colonIdx).trim();
          const value = trimmed.slice(colonIdx + 1).trim();
          stateColorsRaw[key] = value;
        }
        continue;
      }
      if (activeBlock === 'color-bounds') {
        const trimmed = raw.trimStart();
        const colonIdx = trimmed.indexOf(':');
        if (colonIdx !== -1) {
          const key = trimmed.slice(0, colonIdx).trim();
          const value = trimmed.slice(colonIdx + 1).trim();
          colorBoundsRaw[key] = value;
        }
        continue;
      }
      if (activeBlock === 'color-adherence') {
        const trimmed = raw.trimStart();
        const colonIdx = trimmed.indexOf(':');
        if (colonIdx !== -1) {
          const key = trimmed.slice(0, colonIdx).trim();
          const value = trimmed.slice(colonIdx + 1).trim();
          adherenceOverridesRaw[key] = value;
        }
        continue;
      }
      if (activeBlock === 'color-rules') {
        const trimmed = raw.trim();
        const colonIdx = trimmed.indexOf(':');
        if (colonIdx !== -1) {
          colorRulesRaw[trimmed.slice(0, colonIdx).trim()] = trimmed.slice(colonIdx + 1).trim();
        }
        continue;
      }
      if (activeBlock === 'color-families') {
        const trimmed = raw.trim();
        if (trimmed === '') continue;
        const familyMatch = trimmed.match(/^family\s+(\S+)$/);
        if (familyMatch) {
          if (familiesRaw.some(f => f.name === familyMatch[1])) {
            throw new Error(`${fileName}:${lineNum}: duplicate family "${familyMatch[1]}"`);
          }
          currentFamily = { name: familyMatch[1], line: lineNum, colors: [], pairs: [] };
          familiesRaw.push(currentFamily);
          inPairs = false;
          continue;
        }
        if (!currentFamily) {
          const colonIdx = trimmed.indexOf(':');
          if (colonIdx === -1) {
            throw new Error(`${fileName}:${lineNum}: expected "key: value" or "family NAME" in color-families, got "${trimmed}"`);
          }
          familiesProps[trimmed.slice(0, colonIdx).trim()] = trimmed.slice(colonIdx + 1).trim();
          continue;
        }
        if (trimmed === 'pairs') {
          inPairs = true;
          continue;
        }
        if (inPairs && trimmed.includes('/')) {
          const parts = trimmed.split('/').map(p => p.trim());
          if (parts.length !== 2 || !parts[0] || !parts[1]) {
            throw new Error(`${fileName}:${lineNum}: pair must be "ground / figure", got "${trimmed}"`);
          }
          currentFamily.pairs.push({ ground: parts[0], figure: parts[1], line: lineNum });
          continue;
        }
        const colonIdx = trimmed.indexOf(':');
        const key = colonIdx !== -1 ? trimmed.slice(0, colonIdx).trim() : trimmed;
        if (key === 'from' && colonIdx !== -1) {
          const value = trimmed.slice(colonIdx + 1).trim();
          if (currentFamily.from !== undefined) throw new Error(`${fileName}:${lineNum}: family "${currentFamily.name}" declares from: twice`);
          if (!isMonthDay(value)) throw new Error(`${fileName}:${lineNum}: family "${currentFamily.name}" from: must be "MM-DD" (e.g. 12-01), got "${value}"`);
          inPairs = false;
          currentFamily.from = value;
          continue;
        }
        if (colonIdx === -1 || !FAMILY_ROLES.has(key as FamilyRole)) {
          throw new Error(`${fileName}:${lineNum}: family "${currentFamily.name}": expected from / core / accent / contrast / pairs, got "${trimmed}"`);
        }
        inPairs = false;
        currentFamily.colors.push({ role: key, value: trimmed.slice(colonIdx + 1).trim(), line: lineNum });
        continue;
      }
      if (activeBlock === 'theme' && currentThemeName) {
        // slot: #HEX or $ref  # optional comment
        const colonIdx = raw.indexOf(':');
        if (colonIdx !== -1) {
          const slot = raw.slice(0, colonIdx).trim();
          const rest = raw.slice(colonIdx + 1).trim();
          // Split on first ' #' to separate value from inline comment
          const commentIdx = rest.search(/\s+#/);
          const value = commentIdx !== -1 ? rest.slice(0, commentIdx).trim() : rest.trim();
          const comment = commentIdx !== -1 ? rest.slice(commentIdx).replace(/^\s+#\s*/, '') : '';
          if (!themes[currentThemeName]) themes[currentThemeName] = {};
          themes[currentThemeName][slot] = value; // may be $ref — resolved after parsing
          if (comment && !themeDescriptions[slot]) {
            themeDescriptions[slot] = comment;
          }
        }
        continue;
      }
      if (activeBlock === 'spacing') {
        const colonIdx = raw.indexOf(':');
        if (colonIdx !== -1) {
          const key = raw.slice(0, colonIdx).trim();
          const value = raw.slice(colonIdx + 1).trim();
          spacingRaw[key] = value;
        }
        continue;
      }
      if (activeBlock === 'divider' && currentDividerName) {
        const colonIdx = raw.indexOf(':');
        if (colonIdx !== -1) {
          const key = raw.slice(0, colonIdx).trim();
          const value = raw.slice(colonIdx + 1).trim();
          if (key === 'color') {
            throw new Error(
              `${fileName}:${lineNum}: divider "${currentDividerName}": color is no longer configurable. Remove the "color:" line — divider color is sourced from the theme's "divider" slot.`,
            );
          }
          if (!dividersRaw[currentDividerName]) dividersRaw[currentDividerName] = {};
          dividersRaw[currentDividerName][key] = value;
        }
        continue;
      }
      if (activeBlock === 'typography' && currentTypographyName) {
        const trimmed = raw.trim();
        if (!typographiesRaw[currentTypographyName]) typographiesRaw[currentTypographyName] = {};
        const colonIdx = trimmed.indexOf(':');
        if (colonIdx !== -1) {
          const key = trimmed.slice(0, colonIdx).trim();
          const value = trimmed.slice(colonIdx + 1).trim();
          typographiesRaw[currentTypographyName][key] = value;
        } else if (trimmed === 'italic' || trimmed === 'uppercase') {
          // Bare flag — presence means true
          typographiesRaw[currentTypographyName][trimmed] = 'true';
        }
        continue;
      }
      if (activeBlock === 'font' && currentFontName) {
        const colonIdx = raw.indexOf(':');
        if (colonIdx !== -1) {
          const key = raw.slice(0, colonIdx).trim();
          const value = raw.slice(colonIdx + 1).trim();
          const last = fontsRaw[fontsRaw.length - 1];
          if (last && last.name === currentFontName) last.props[key] = value;
        }
        continue;
      }
      if ((activeBlock === 'logo' || activeBlock === 'photo' || activeBlock === 'video' || activeBlock === 'illustration') && currentAssetId) {
        const indent = raw.match(/^(\s*)/)?.[1].length ?? 0;
        const colonIdx = raw.indexOf(':');
        if (colonIdx !== -1) {
          const key = raw.slice(0, colonIdx).trim();
          const value = raw.slice(colonIdx + 1).trim();
          const arr = activeBlock === 'logo' ? logosRaw : activeBlock === 'photo' ? photosRaw : activeBlock === 'video' ? videosRaw : illustrationsRaw;
          const last = arr[arr.length - 1];
          if (last && last.id === currentAssetId) {
            // 4+ space indent after a bare sub-block keyword (e.g. generator-params) → nested param.
            // Store under "subBlock.key" so toAssetDef can split it out.
            if (indent >= 4 && currentSubBlock) {
              last.props[`${currentSubBlock}.${key}`] = value;
            } else {
              last.props[key] = value;
              currentSubBlock = null;
            }
          }
        } else {
          const trimmed = raw.trim();
          if (trimmed === 'animated' || trimmed === 'loop') {
            const arr = activeBlock === 'logo' ? logosRaw : activeBlock === 'photo' ? photosRaw : activeBlock === 'video' ? videosRaw : illustrationsRaw;
            const last = arr[arr.length - 1];
            if (last && last.id === currentAssetId) last.props[trimmed] = 'true';
            currentSubBlock = null;
          } else if (trimmed === 'generator-params' || (activeBlock === 'logo' && /^align-(left|center|right)$/.test(trimmed))) {
            // Open a nested sub-block — subsequent deeper-indented key: value lines attach here.
            currentSubBlock = trimmed;
          }
        }
        continue;
      }
      if (activeBlock === 'label' || activeBlock === 'cta') {
        const colonIdx = raw.indexOf(':');
        if (colonIdx !== -1) {
          const key = raw.slice(0, colonIdx).trim();
          const value = raw.slice(colonIdx + 1).trim();
          const target = activeBlock === 'label' ? labelRaw : ctaRaw;
          target[key] = value;
        }
        continue;
      }
      if (activeBlock === 'icons') {
        const trimmed = raw.trim();
        if (trimmed.startsWith('#')) continue;
        const commentIdx = trimmed.search(/\s+#/);
        const entry = commentIdx !== -1 ? trimmed.slice(0, commentIdx) : trimmed;
        const colonIdx = entry.indexOf(':');
        if (colonIdx === -1) throw new Error(`${fileName}:${lineNum}: icons entry must be "ID: SOURCE", got "${trimmed}"`);
        const id = entry.slice(0, colonIdx).trim();
        if (!isIconId(id)) throw new Error(`${fileName}:${lineNum}: invalid icon id "${id}" — use lowercase kebab-case`);
        if (icons.some(ic => ic.id === id)) throw new Error(`${fileName}:${lineNum}: duplicate icon "${id}"`);
        icons.push({ id, source: parseIconSource(entry.slice(colonIdx + 1), `${fileName}:${lineNum}`) });
        continue;
      }
      if (activeBlock === 'counter') {
        const trimmed = raw.trim();
        if (trimmed.startsWith('#')) continue;
        const commentIdx = trimmed.search(/\s+#/);
        const entry = commentIdx !== -1 ? trimmed.slice(0, commentIdx) : trimmed;
        const colonIdx = entry.indexOf(':');
        if (colonIdx === -1) throw new Error(`${fileName}:${lineNum}: counter property must be "KEY: VALUE", got "${trimmed}"`);
        counterRaw[entry.slice(0, colonIdx).trim()] = { value: entry.slice(colonIdx + 1).trim(), line: lineNum };
        continue;
      }
      if (activeBlock === 'camera') {
        const trimmed = raw.trim();
        if (trimmed.startsWith('#')) continue;
        const commentIdx = trimmed.search(/\s+#/);
        const entry = commentIdx !== -1 ? trimmed.slice(0, commentIdx) : trimmed;
        const colonIdx = entry.indexOf(':');
        if (colonIdx === -1) throw new Error(`${fileName}:${lineNum}: camera property must be "KEY: VALUE", got "${trimmed}"`);
        cameraRaw[entry.slice(0, colonIdx).trim()] = { value: entry.slice(colonIdx + 1).trim(), line: lineNum };
        continue;
      }
      if (activeBlock === 'photo-look') {
        const trimmed = raw.trim();
        if (trimmed.startsWith('#')) continue;
        // `# …` is a comment, but `#RGB` / `#RRGGBB` is a duotone color
        const commentIdx = trimmed.search(/\s+#(?![0-9a-f]{3}(?:[0-9a-f]{3}(?:[0-9a-f]{2})?)?(?:\s|$))/i);
        const entry = commentIdx !== -1 ? trimmed.slice(0, commentIdx) : trimmed;
        const colonIdx = entry.indexOf(':');
        // Bare flag (`mono`) or KEY: VALUE
        if (colonIdx === -1) photoLookRaw[entry.trim()] = { value: '', line: lineNum };
        else photoLookRaw[entry.slice(0, colonIdx).trim()] = { value: entry.slice(colonIdx + 1).trim(), line: lineNum };
        continue;
      }
      if (activeBlock === 'windows') {
        const trimmed = raw.trim();
        if (trimmed.startsWith('#')) continue;
        const entry = trimmed.replace(/\s+#.*$/, '');
        const colonIdx = entry.indexOf(':');
        if (colonIdx === -1) throw new Error(`${fileName}:${lineNum}: window must be "NAME: MM-DD..MM-DD", got "${trimmed}"`);
        windowsRaw.push({ name: entry.slice(0, colonIdx).trim(), value: entry.slice(colonIdx + 1).trim(), line: lineNum });
        continue;
      }
      if (activeBlock === 'framing') {
        const trimmed = raw.trim();
        if (trimmed.startsWith('#')) continue;
        const colonIdx = trimmed.indexOf(':');
        if (colonIdx === -1) throw new Error(`${fileName}:${lineNum}: framing property must be "KEY: VALUE", got "${trimmed}"`);
        framingsRaw[framingsRaw.length - 1].props[trimmed.slice(0, colonIdx).trim()] = { value: trimmed.slice(colonIdx + 1).trim(), line: lineNum };
        continue;
      }
      // Indented line with no active block — ignore
      continue;
    }

    // Blank lines are ignored — they don't close active blocks (grouped brand-colors
    // relies on blank lines between groups for readability).
    if (raw.trim() === '') continue;

    // Non-indented non-blank line ends any active block
    activeBlock = 'none';

    // brand-colors — starts the brand color primitives block
    if (raw.trim() === 'brand-colors') {
      activeBlock = 'brand-colors';
      currentGroup = null;
      currentGroupedEntry = null;
      continue;
    }

    // state-colors — flat block of problem/warning/success/info/inactive
    if (raw.trim() === 'state-colors') {
      activeBlock = 'state-colors';
      continue;
    }

    // color-bounds — luminance + saturation floor for guided derivation
    if (raw.trim() === 'color-bounds') {
      activeBlock = 'color-bounds';
      continue;
    }

    // color-rules — contrast minimums and tone rules
    if (raw.trim() === 'color-rules') {
      activeBlock = 'color-rules';
      colorRulesDeclared = true;
      continue;
    }

    // color-families — ordered color sets with roles, reach and pairs
    if (raw.trim() === 'color-families') {
      if (familiesDeclared) throw new Error(`${fileName}:${lineNum}: duplicate color-families block`);
      activeBlock = 'color-families';
      familiesDeclared = true;
      currentFamily = null;
      inPairs = false;
      continue;
    }

    // icons — the brand icon set
    if (raw.trim() === 'icons') {
      if (iconsDeclared) throw new Error(`${fileName}:${lineNum}: duplicate icons block`);
      iconsDeclared = true;
      activeBlock = 'icons';
      continue;
    }

    // counter — list counter component
    if (raw.trim() === 'counter') {
      if (counterDeclared) throw new Error(`${fileName}:${lineNum}: duplicate counter block`);
      counterDeclared = true;
      activeBlock = 'counter';
      continue;
    }

    // camera — camera defaults (facing, viewfinder grid)
    if (raw.trim() === 'camera') {
      if (cameraDeclared) throw new Error(`${fileName}:${lineNum}: duplicate camera block`);
      cameraDeclared = true;
      activeBlock = 'camera';
      continue;
    }

    // photo-look — photo treatment (saturation)
    if (raw.trim() === 'photo-look') {
      if (photoLookDeclared) throw new Error(`${fileName}:${lineNum}: duplicate photo-look block`);
      photoLookDeclared = true;
      activeBlock = 'photo-look';
      continue;
    }

    // windows — named yearly date windows
    if (raw.trim() === 'windows') {
      if (windowsDeclared) throw new Error(`${fileName}:${lineNum}: duplicate windows block`);
      windowsDeclared = true;
      activeBlock = 'windows';
      continue;
    }

    // framing <id> — photo framing module (horizon position)
    const framingMatch = raw.match(/^framing\s+(\S+)\s*$/);
    if (framingMatch) {
      const id = framingMatch[1];
      if (framingsRaw.some(f => f.id === id)) throw new Error(`${fileName}:${lineNum}: duplicate framing "${id}"`);
      framingsRaw.push({ id, line: lineNum, props: {} });
      activeBlock = 'framing';
      continue;
    }

    // theme ThemeName — starts a theme block
    const themeMatch = raw.match(/^theme\s+(\S+)/);
    if (themeMatch) {
      currentThemeName = themeMatch[1];
      activeBlock = 'theme';
      continue;
    }

    // divider name — starts a divider block
    const dividerMatch = raw.match(/^divider\s+(\S+)/);
    if (dividerMatch) {
      currentDividerName = dividerMatch[1];
      activeBlock = 'divider';
      continue;
    }

    // typography name — starts a typography block
    const typographyMatch = raw.match(/^typography\s+(\S+)/);
    if (typographyMatch) {
      currentTypographyName = typographyMatch[1];
      activeBlock = 'typography';
      continue;
    }

    // font <name> or bare "font" — starts a font primitive block
    // Bare "font" (no name) uses "_default" internally; first font is always the brand default.
    const fontBlockMatch = raw.match(/^font(?:\s+(\S+))?$/);
    if (fontBlockMatch) {
      currentFontName = fontBlockMatch[1] ?? '_default';
      fontsRaw.push({ name: currentFontName, props: {} });
      activeBlock = 'font';
      continue;
    }

    // logo/photo/video/illustration <id> — starts an asset block
    const assetMatch = raw.match(/^(logo|photo|video|illustration)\s+(\S+)/);
    if (assetMatch) {
      const [, type, id] = assetMatch;
      currentAssetId = id;
      activeBlock = type as 'logo' | 'photo' | 'video' | 'illustration';
      const arr = type === 'logo' ? logosRaw : type === 'photo' ? photosRaw : type === 'video' ? videosRaw : illustrationsRaw;
      arr.push({ id, props: {} });
      continue;
    }

    const colonIdx = raw.indexOf(':');
    if (colonIdx === -1) continue;

    const key = raw.slice(0, colonIdx).trim();
    const value = raw.slice(colonIdx + 1).trim();

    switch (key) {
      case 'id':           result.id = value; break;
      case 'name':         result.name = value; break;
      case 'language':     result.language = value; break;
      case 'locale':       result.locale = value; break;
      case 'domain':       result.domain = value; break;
      case 'tokens':
        if (value === 'figma' || value === 'inline') {
          result.tokensSource = value;
        } else {
          console.warn(`${fileName}:${lineNum}: unknown tokens source "${value}", defaulting to "figma"`);
        }
        break;
      case 'figma-file-key':    result.figmaFileKey = value; break;
      case 'figma-collection':  result.figmaCollection = value; break;
      case 'tokens-file':       result.tokensFile = value; break;
      case 'app-icon':          result.appIcon = value; break;
      case 'favicon':           result.favicon = value; break;
      case 'og-image':          result.ogImage = value; break;
      case 'spacing':
        activeBlock = 'spacing';
        break;
      case 'label':
        activeBlock = 'label';
        break;
      case 'cta':
        activeBlock = 'cta';
        break;
      case 'color-mode':
        if (!VALID_COLOR_MODES.has(value as ColorMode)) {
          throw new Error(`${fileName}:${lineNum}: color-mode must be "static", "dynamic", "guided", or "brand", got "${value}"`);
        }
        result.colorMode = value as ColorMode;
        break;
      case 'color-strategy':
        if (!VALID_STRATEGIES.has(value as PaletteStrategy)) {
          throw new Error(`${fileName}:${lineNum}: color-strategy must be one of monochrome/duotone/tricolor/spectrum, got "${value}"`);
        }
        result.colorStrategy = value as PaletteStrategy;
        break;
      case 'color-adherence':
        if (!VALID_ADHERENCES.has(value as Adherence)) {
          throw new Error(`${fileName}:${lineNum}: color-adherence must be "strict", "on-brand", or "flexible", got "${value}"`);
        }
        result.colorAdherence = value as Adherence;
        // Optional indented overrides follow.
        activeBlock = 'color-adherence';
        break;
      default:
        // Unknown keys silently ignored for forward compatibility
        break;
    }
  }

  // ── Finalise grouped brand-colors (v0.8.0+) ────────────────────────────────
  if (colorGroups.length > 0) {
    // Resolve $group.role references in declaration order — a reference may only point
    // to a group earlier in the list than its containing group.
    const resolvedNames = new Set<string>();
    for (let gi = 0; gi < colorGroups.length; gi++) {
      const group = colorGroups[gi];
      for (const entry of group.entries) {
        if (!entry.referencedFrom) {
          // Normal entry — ensure its name doesn't collide (important for flat projection).
          if (resolvedNames.has(entry.name)) {
            throw new Error(`${fileName}: duplicate color name "${entry.name}" in brand-colors`);
          }
          resolvedNames.add(entry.name);
          continue;
        }
        // Reference shape: "<group>.<role>"
        const [refGroupKey, refRole] = entry.referencedFrom.split('.');
        const refGroupIdx = colorGroups.findIndex(g => g.key === refGroupKey);
        if (refGroupIdx === -1) {
          throw new Error(`${fileName}: reference "$${entry.referencedFrom}" targets unknown group "${refGroupKey}"`);
        }
        if (refGroupIdx >= gi) {
          throw new Error(`${fileName}: reference "$${entry.referencedFrom}" must point to a group declared earlier (forward/self references forbidden)`);
        }
        const refGroup = colorGroups[refGroupIdx];
        // Find the target entry. `default` matches explicit or first-declared default.
        let target: BrandColorEntry | undefined;
        if (refRole === 'default') {
          target = refGroup.entries.find(e => e.isDefault) ?? refGroup.entries[0];
        } else {
          target = refGroup.entries.find(e => e.role === refRole);
        }
        if (!target) {
          throw new Error(`${fileName}: reference "$${entry.referencedFrom}" — no entry with role "${refRole}" in group "${refGroupKey}"`);
        }
        entry.hex = target.hex;
        entry.name = target.name;
        // Don't add referenced name to resolvedNames — it's already registered under the target.
      }

      // Apply default selection rule for identity groups.
      if (group.key !== 'neutral' && group.entries.length > 0) {
        const explicit = group.entries.find(e => e.isDefault);
        if (!explicit) {
          // First-declared wins implicitly.
          group.entries[0].isDefault = true;
        }
      }

      // Neutral-group role validation.
      if (group.key === 'neutral') {
        for (const entry of group.entries) {
          if (entry.role && !NEUTRAL_ROLES.has(entry.role as NeutralRole)) {
            throw new Error(
              `${fileName}: neutral entry "${entry.name}" role "${entry.role}" is not in the fixed vocabulary (light | subtle | mid | muted | dark)`,
            );
          }
        }
      }
    }

    result.colorGroups = colorGroups;

    // Build flat projection so legacy consumers keep working unchanged.
    // Key convention: the entry's display name lowercased, spaces → hyphens.
    // Name collisions already rejected above, so the projection is deterministic.
    for (const group of colorGroups) {
      for (const entry of group.entries) {
        const key = entry.name.toLowerCase().replace(/\s+/g, '-');
        if (!brandColors[key]) {
          brandColors[key] = entry.hex;
          if (entry.print) brandColorPrint[key] = entry.print;
        }
      }
    }
  }

  const colorWarnings: string[] = [];

  // ── Finalise color-rules ──────────────────────────────────────────────────
  const rules: ColorRules = { ...DEFAULT_COLOR_RULES, avoid: [], tones: [...DEFAULT_COLOR_RULES.tones] as [number, number] };
  if (colorRulesDeclared) {
    const num = (key: string) => {
      const n = parseFloat(colorRulesRaw[key]);
      if (isNaN(n) || n < 1 || n > 21) {
        throw new Error(`${fileName}: color-rules "${key}" must be a contrast ratio between 1 and 21, got "${colorRulesRaw[key]}"`);
      }
      return n;
    };
    if (colorRulesRaw.text !== undefined) rules.text = num('text');
    if (colorRulesRaw.figure !== undefined) rules.figure = num('figure');
    if (colorRulesRaw.avoid !== undefined) {
      for (const combo of colorRulesRaw.avoid.split(',').map(c => c.trim()).filter(Boolean)) {
        const parts = combo.split('+').map(c => c.trim());
        if (parts.length !== 2 || !parts.every(t => TONE_CLASSES.has(t as ToneClass))) {
          throw new Error(`${fileName}: color-rules avoid "${combo}" must be two of light / mid / dark joined by "+"`);
        }
        rules.avoid.push([parts[0] as ToneClass, parts[1] as ToneClass]);
      }
    }
    if (colorRulesRaw.tones !== undefined) {
      const t = colorRulesRaw.tones.split(',').map(v => parseFloat(v.trim()));
      if (t.length !== 2 || t.some(isNaN) || t[0] >= t[1]) {
        throw new Error(`${fileName}: color-rules tones must be two ascending contrast values, e.g. "1.8, 4.5"`);
      }
      rules.tones = [t[0], t[1]];
    }
    result.colorRules = rules;
  }

  // ── Finalise color-families: colors + flat projection (pairs later, after themes) ──
  let colorFamilies: ColorFamilies | undefined;
  if (familiesDeclared) {
    const order = (familiesProps.order ?? 'cycle') as FamilyOrder;
    if (!FAMILY_ORDERS.has(order)) throw new Error(`${fileName}: color-families order must be "cycle" or "sequence", got "${order}"`);
    const borrow = (familiesProps.borrow ?? 'both') as FamilyBorrow;
    if (!FAMILY_BORROWS.has(borrow)) throw new Error(`${fileName}: color-families borrow must be previous / next / both / none, got "${borrow}"`);
    const distance = familiesProps.distance !== undefined ? Number(familiesProps.distance) : 1;
    if (!Number.isInteger(distance) || distance < 1) throw new Error(`${fileName}: color-families distance must be a whole number ≥ 1, got "${familiesProps.distance}"`);
    if (familiesRaw.length === 0) throw new Error(`${fileName}: color-families declares no family`);

    const shared: Array<{ name: string; hex: string }> = [];
    for (const ref of (familiesProps.shared ?? '').split(',').map(r => r.trim()).filter(Boolean)) {
      if (!ref.startsWith('$')) throw new Error(`${fileName}: color-families shared entries must be $refs to brand-colors, got "${ref}"`);
      const hex = brandColors[ref.slice(1)] ? normalizeHex(brandColors[ref.slice(1)]) : null;
      if (!hex || !isHex6(hex)) throw new Error(`${fileName}: color-families shared "${ref}" is not a known 6-digit brand color`);
      shared.push({ name: ref.slice(1), hex });
    }

    const families: ColorFamily[] = [];
    for (const raw of familiesRaw) {
      const counts: Record<string, number> = {};
      for (const c of raw.colors) counts[c.role] = (counts[c.role] ?? 0) + 1;
      if (counts.core !== 1) throw new Error(`${fileName}:${raw.line}: family "${raw.name}" needs exactly one core color`);
      if (counts.contrast !== 1) throw new Error(`${fileName}:${raw.line}: family "${raw.name}" needs exactly one contrast color`);
      const seen: Record<string, number> = {};
      const colors: FamilyColor[] = raw.colors.map(c => {
        const m = c.value.match(/^(#[0-9a-fA-F]{3,6})(?:\s+(.+))?$/);
        const hex = m ? normalizeHex(m[1]) : null;
        if (!m || !hex || !isHex6(hex)) {
          throw new Error(`${fileName}:${c.line}: family "${raw.name}" ${c.role} must be "#HEX" or "#HEX  Name", got "${c.value}"`);
        }
        seen[c.role] = (seen[c.role] ?? 0) + 1;
        const generated = `${raw.name.toLowerCase()}-${c.role}${counts[c.role] > 1 ? `-${seen[c.role]}` : ''}`;
        const name = m[2]?.trim() || generated;
        return { role: c.role as FamilyRole, hex, name, key: colorKey(name) };
      });
      for (const c of colors) {
        if (brandColors[c.key]) {
          throw new Error(`${fileName}: family "${raw.name}" color name "${c.name}" collides with an existing brand color`);
        }
        brandColors[c.key] = c.hex;
      }
      families.push({ name: raw.name, ...(raw.from ? { from: raw.from } : {}), colors, pairs: [] });
    }
    const dated = familiesRaw.filter(f => f.from !== undefined);
    if (dated.length > 0 && dated.length < familiesRaw.length) {
      const missing = familiesRaw.filter(f => f.from === undefined).map(f => f.name).join(', ');
      throw new Error(`${fileName}: color-families: from: must be declared on every family or on none (missing: ${missing})`);
    }
    for (const f of dated) {
      const twin = dated.find(o => o !== f && o.from === f.from);
      if (twin) throw new Error(`${fileName}:${f.line}: families "${twin.name}" and "${f.name}" share from: ${f.from}`);
    }
    colorFamilies = { order, borrow, distance, shared, families };
    if (borrow !== 'none' && reachCoversAll(families.length, { order, borrow, distance })) {
      colorWarnings.push(`color-families: borrow "${borrow}" with distance ${distance} reaches every family — the borrow rule has no effect`);
    }
    result.colorFamilies = colorFamilies;
  }

  // Store brand colors (flat projection)
  if (Object.keys(brandColors).length > 0) {
    result.brandColors = brandColors;
    if (Object.keys(brandColorPrint).length > 0) result.brandColorPrint = brandColorPrint;
  }

  // ── Finalise state-colors / color-bounds / adherence overrides ────────────
  if (Object.keys(stateColorsRaw).length > 0) {
    const state: StateColors = {};
    for (const [key, value] of Object.entries(stateColorsRaw)) {
      if (!STATE_KEYS.has(key)) continue; // forward-compat: ignore unknown
      const hex = normalizeHex(value);
      if (!hex) {
        throw new Error(`${fileName}: state-colors "${key}" value "${value}" is not a valid hex`);
      }
      (state as Record<string, string>)[key] = hex;
    }
    if (Object.keys(state).length > 0) result.stateColors = state;
  }

  if (Object.keys(colorBoundsRaw).length > 0) {
    const bounds: ColorBounds = {};
    if (colorBoundsRaw.light !== undefined) bounds.light = parseFloat(colorBoundsRaw.light);
    if (colorBoundsRaw.dark !== undefined) bounds.dark = parseFloat(colorBoundsRaw.dark);
    if (colorBoundsRaw['saturation-floor'] !== undefined) {
      bounds.saturationFloor = parseFloat(colorBoundsRaw['saturation-floor']);
    }
    result.colorBounds = bounds;
  }

  if (Object.keys(adherenceOverridesRaw).length > 0) {
    const overrides: AdherenceTolerances = {};
    if (adherenceOverridesRaw['hue-tolerance'] !== undefined) {
      overrides.hueTolerance = parseFloat(adherenceOverridesRaw['hue-tolerance']);
    }
    if (adherenceOverridesRaw['sat-tolerance'] !== undefined) {
      overrides.satTolerance = parseFloat(adherenceOverridesRaw['sat-tolerance']);
    }
    if (Object.keys(overrides).length > 0) result.colorAdherenceOverrides = overrides;
  }

  // ── Minimum-structure validation for color-mode: guided ───────────────────
  if (result.colorMode === 'guided' && !(colorFamilies && colorFamilies.families.length >= 2)) {
    if (colorGroups.length === 0) {
      throw new Error(
        `${fileName}: color-mode: guided requires grouped brand-colors syntax or a color-families block with at least two families — flat syntax alone is not sufficient.`,
      );
    }
    const primary = colorGroups.find(g => g.key === 'primary');
    const neutral = colorGroups.find(g => g.key === 'neutral');
    if (!primary) {
      throw new Error(`${fileName}: color-mode: guided requires a "primary" group`);
    }
    if (!neutral) {
      throw new Error(`${fileName}: color-mode: guided requires a "neutral" group`);
    }
    const neutralRoles = new Set(neutral.entries.map(e => e.role).filter(Boolean));
    if (!neutralRoles.has('light')) {
      throw new Error(`${fileName}: color-mode: guided requires neutral group to declare at least role "light"`);
    }
    if (!neutralRoles.has('dark')) {
      throw new Error(`${fileName}: color-mode: guided requires neutral group to declare at least role "dark"`);
    }
    if (primary.entries.length === 0) {
      throw new Error(`${fileName}: color-mode: guided requires primary group to have at least one color`);
    }
  }

  // Finalise inline tokens — resolve $ref values against brandColors, apply optional alpha.
  //
  // Theme slot grammar:
  //   slot: $ref              → resolve ref to hex
  //   slot: $ref 75%          → resolve ref, then apply alpha (rgba)
  //   slot: #HEX              → pass through
  //   slot: #HEX 30%          → apply alpha (rgba)
  //   slot: rgba(...)         → pass through (legacy, discouraged)
  //
  // Alpha is expressed as `<number>%`, 0–100, separated from the base value by exactly one space.
  // 100% emits solid hex (not rgba) to keep output clean.
  //
  // Pair themes: `ground:` + `figure:` (+ optional `text:`) derive every slot not written explicitly.
  const themePairs: Record<string, ThemePair> = {};
  const neutral = colorGroups.find(g => g.key === 'neutral');
  const neutralText = ['dark', 'light']
    .map(role => neutral?.entries.find(e => e.role === role)?.hex)
    .filter((h): h is string => !!h);
  for (const [name, theme] of Object.entries(themes)) {
    const pairRaw: Partial<Record<typeof PAIR_KEYS[number], string>> = {};
    for (const key of PAIR_KEYS) {
      if (theme[key] !== undefined) { pairRaw[key] = theme[key]; delete theme[key]; }
    }
    for (const [slot, value] of Object.entries(theme)) {
      theme[slot] = resolveThemeSlotValue(value, brandColors, fileName, slot);
    }
    if (Object.keys(pairRaw).length === 0) continue;
    if (!pairRaw.ground || !pairRaw.figure) {
      throw new Error(`${fileName}: theme "${name}" needs both "ground:" and "figure:" (pair theme), or neither`);
    }
    const solid = (key: string, value: string) => {
      const hex = resolveThemeSlotValue(value, brandColors, fileName, key);
      if (!isHex6(hex)) throw new Error(`${fileName}: theme "${name}" ${key} must be a solid 6-digit color, got "${value}"`);
      return hex;
    };
    const ground = solid('ground', pairRaw.ground);
    const figure = solid('figure', pairRaw.figure);
    let text: string;
    if (pairRaw.text) {
      text = solid('text', pairRaw.text);
    } else {
      const resolved = resolveTextColor(ground, neutralText, rules);
      text = resolved.text;
      if (!resolved.passes) {
        colorWarnings.push(`theme "${name}": no text color reaches ${rules.text}:1 on ${ground} — using ${text} (${resolved.ratio.toFixed(1)}:1)`);
      }
    }
    themes[name] = { ...derivePairSlots(ground, figure, text), ...theme };
    themePairs[name] = { ground, figure, text };
  }

  // Family pairs → checked; valid ones become themes named `{Family}-{n}` (n = declared position).
  if (colorFamilies) {
    const config = { order: colorFamilies.order, borrow: colorFamilies.borrow, distance: colorFamilies.distance };
    colorFamilies.families.forEach((family, index) => {
      const raw = familiesRaw[index];
      raw.pairs.forEach((p, n) => {
        const resolve = (value: string) => {
          const hex = value.startsWith('$') ? (brandColors[value.slice(1)] ? normalizeHex(brandColors[value.slice(1)]) : null) : normalizeHex(value);
          if (!hex || !isHex6(hex)) throw new Error(`${fileName}:${p.line}: pair color "${value}" is not a known 6-digit color`);
          return hex;
        };
        const check = checkFamilyPair(resolve(p.ground), resolve(p.figure), index, colorFamilies!, config, rules, neutralText);
        const themeName = `${family.name}-${n + 1}`;
        if (check.valid) {
          if (themes[themeName]) throw new Error(`${fileName}: family pair theme "${themeName}" collides with an authored theme`);
          themes[themeName] = derivePairSlots(check.ground, check.figure, check.text);
          themePairs[themeName] = { ground: check.ground, figure: check.figure, text: check.text, family: family.name };
          family.pairs.push({ ...check, theme: themeName });
          if (!check.textPasses) {
            colorWarnings.push(`${themeName}: no text color reaches ${rules.text}:1 on ${check.ground} — using ${check.text} (${check.textRatio.toFixed(1)}:1)`);
          }
        } else {
          family.pairs.push(check);
          colorWarnings.push(`${themeName} (${check.ground} / ${check.figure}) rejected: ${check.reasons.join('; ')}`);
        }
      });
    });
  }

  // Counter colours default to the label badge's.
  for (const theme of Object.values(themes)) {
    if (theme['counter-bg'] === undefined && theme['label-bg'] !== undefined) theme['counter-bg'] = theme['label-bg'];
    if (theme['counter-fg'] === undefined && theme['label-fg'] !== undefined) theme['counter-fg'] = theme['label-fg'];
  }

  // Rule checks on every theme (only when the brand declares color-rules).
  if (colorRulesDeclared) {
    for (const [name, theme] of Object.entries(themes)) {
      const bg = theme['background'];
      if (!bg || !isHex6(bg)) continue;
      const txt = theme['text-primary'];
      if (txt && isHex6(txt) && contrastRatio(bg, txt) < rules.text && !themePairs[name]) {
        colorWarnings.push(`theme "${name}": text-primary ${txt} on ${bg} is ${contrastRatio(bg, txt).toFixed(1)}:1, below ${rules.text}:1`);
      }
      const fig = theme['logo'];
      if (fig && isHex6(fig) && contrastRatio(bg, fig) < rules.figure && !themePairs[name]?.family) {
        colorWarnings.push(`theme "${name}": logo ${fig} on ${bg} is ${contrastRatio(bg, fig).toFixed(1)}:1, below ${rules.figure}:1`);
      }
    }
  }

  // color-mode: brand starts pages from a declared theme, so it needs at least one.
  if (result.colorMode === 'brand' && Object.keys(themes).length === 0) {
    throw new Error(`${fileName}: color-mode: brand requires at least one theme (a theme block or a valid color-families pair)`);
  }

  if (Object.keys(themes).length > 0) {
    result.themes = themes;
    result.themeDescriptions = themeDescriptions;
  }
  if (Object.keys(themePairs).length > 0) result.themePairs = themePairs;
  if (colorWarnings.length > 0) result.colorWarnings = colorWarnings;
  if (Object.keys(spacingRaw).length > 0) {
    result.spacing = {
      unit: spacingRaw['unit'] ?? 'cqmin',
      xs: parseFloat(spacingRaw['xs'] ?? '1.5'),
      s:  parseFloat(spacingRaw['s']  ?? '2'),
      m:  parseFloat(spacingRaw['m']  ?? '3'),
      l:  parseFloat(spacingRaw['l']  ?? '5'),
      xl: parseFloat(spacingRaw['xl'] ?? '6.5'),
    };
  }

  // Finalise dividers — color is always sourced from the active theme's "divider" slot.
  if (Object.keys(dividersRaw).length > 0) {
    const dividers: Record<string, ParsedDividerDef> = {};
    for (const [name, raw] of Object.entries(dividersRaw)) {
      const alignRaw = raw['align'] ?? 'left';
      const align: ParsedDividerDef['align'] =
        alignRaw === 'center' ? 'center' : alignRaw === 'right' ? 'right' : 'left';
      dividers[name] = {
        thickness: parseFloat(raw['thickness'] ?? '0.2'),
        width: raw['width'] ?? '100%',
        spacing: raw['spacing'] ?? 'xs',
        align,
      };
    }
    result.dividers = dividers;
  }

  // Finalise font primitives
  if (fontsRaw.length > 0) {
    const fonts: Record<string, ParsedFontDef> = {};
    for (const { name, props } of fontsRaw) {
      const fontName = props['name'];
      if (!fontName) {
        console.warn(`${fileName}: font block "${name}" missing "name:" property — skipping`);
        continue;
      }
      const rawSource = props['source'];
      const source: ParsedFontDef['source'] =
        rawSource === 'system' ? 'system' : rawSource === 'google' ? 'google' : 'local';
      const fallback = props['fallback'] ?? 'sans-serif';
      const def: ParsedFontDef = { name: fontName, fallback, source };
      if (props['variable']) def.variable = props['variable'];
      if (props['variable-italic']) def.variableItalic = props['variable-italic'];
      const staticInstances: Record<string, string> = {};
      for (const [key, value] of Object.entries(props)) {
        const match = key.match(/^static-(\d{3})(i)?$/);
        if (match) staticInstances[match[1] + (match[2] ?? '')] = value;
      }
      if (Object.keys(staticInstances).length > 0) def.static = staticInstances;
      fonts[name] = def;
    }
    if (Object.keys(fonts).length > 0) result.fonts = fonts;
  }

  // Finalise typographies
  if (Object.keys(typographiesRaw).length > 0) {
    const typographies: Record<string, ParsedTypographyDef> = {};
    for (const [name, raw] of Object.entries(typographiesRaw)) {
      const weight = parseInt(raw['weight'] ?? '400', 10);
      const size = parseFloat(raw['size'] ?? '3');
      const lineHeight = parseFloat(raw['lineHeight'] ?? '1.4');
      if (isNaN(weight) || isNaN(size) || isNaN(lineHeight)) {
        console.warn(`${fileName}: typography "${name}" has invalid numeric values — skipping`);
        continue;
      }
      const def: ParsedTypographyDef = { weight, size, lineHeight };
      if (raw['font'] !== undefined) def.font = raw['font'].replace(/^\$/, '');
      if (raw['opsz'] !== undefined) def.opsz = parseFloat(raw['opsz']);
      if (raw['letterSpacing'] !== undefined) def.letterSpacing = parseFloat(raw['letterSpacing']);
      if (raw['italic'] === 'true' || raw['italic'] === '') def.italic = true;
      if (raw['uppercase'] === 'true' || raw['uppercase'] === '') def.uppercase = true;
      if (raw['strong'] !== undefined) def.strong = parseInt(raw['strong'], 10);
      if (raw['autofit-min'] !== undefined) def.autofitMin = parseFloat(raw['autofit-min']);
      if (raw['autofit-max'] !== undefined) def.autofitMax = parseFloat(raw['autofit-max']);
      typographies[name] = def;
    }
    result.typographies = typographies;
  }

  // Finalise brand-declared assets
  const toAssetDef = (raw: { id: string; props: Record<string, string> }): ParsedAssetDef => {
    const def: ParsedAssetDef = { id: raw.id, label: raw.props['label'] ?? raw.id, src: raw.props['src'] ?? '' };
    if (raw.props['aspect']) def.aspectRatio = parseFloat(raw.props['aspect']);
    if (raw.props['scale']) def.scale = parseFloat(raw.props['scale']);
    if (raw.props['lottie']) def.lottieSrc = raw.props['lottie'];
    if (raw.props['animated'] === 'true') def.animated = true;
    if (raw.props['loop'] === 'true') def.loop = true;
    if (raw.props['gltf']) def.gltfSrc = raw.props['gltf'];
    if (raw.props['generator']) def.generator = raw.props['generator'];
    if (raw.props['group']) def.group = raw.props['group'];
    if (raw.props['when']) def.when = raw.props['when'];
    // generator-params are stored as "generator-params.KEY" by the sub-block parser.
    const paramEntries: [string, number][] = [];
    for (const [k, v] of Object.entries(raw.props)) {
      if (k.startsWith('generator-params.')) {
        const paramKey = k.slice('generator-params.'.length);
        const n = parseFloat(v);
        if (!Number.isNaN(n)) paramEntries.push([paramKey, n]);
      }
    }
    if (paramEntries.length > 0) def.generatorParams = Object.fromEntries(paramEntries);
    // align-* sub-blocks are stored as "align-left.src" / "align-left.aspect".
    for (const align of ['left', 'center', 'right'] as const) {
      const src = raw.props[`align-${align}.src`];
      if (!src) continue;
      const aspect = raw.props[`align-${align}.aspect`];
      def.alignVariants = { ...def.alignVariants, [align]: { src, ...(aspect ? { aspectRatio: parseFloat(aspect) } : {}) } };
    }
    return def;
  };
  // Finalise date windows (before assets: photo `when:` references them)
  if (windowsDeclared) {
    const windows: Record<string, DateWindowRange[]> = {};
    for (const w of windowsRaw) {
      if (!/^[a-z][a-z0-9-]*$/.test(w.name)) throw new Error(`${fileName}:${w.line}: window name must be lowercase kebab-case, got "${w.name}"`);
      if (windows[w.name]) throw new Error(`${fileName}:${w.line}: duplicate window "${w.name}"`);
      try { windows[w.name] = parseDateWindowRanges(w.value); }
      catch (e) { throw new Error(`${fileName}:${w.line}: window "${w.name}": ${(e as Error).message}`); }
    }
    result.windows = windows;
  }
  for (const [kind, arr] of [['logo', logosRaw], ['video', videosRaw], ['illustration', illustrationsRaw]] as const) {
    const a = arr.find(r => r.props['when']);
    if (a) throw new Error(`${fileName}: ${kind} "${a.id}": when: is for photos only`);
  }
  for (const p of photosRaw) {
    const when = p.props['when'];
    if (when && !result.windows?.[when]) throw new Error(`${fileName}: photo "${p.id}" references unknown window "${when}"`);
  }

  if (logosRaw.length > 0 || photosRaw.length > 0 || videosRaw.length > 0 || illustrationsRaw.length > 0) {
    result.assets = {};
    if (logosRaw.length > 0) result.assets.logos = logosRaw.map(toAssetDef);
    if (photosRaw.length > 0) result.assets.photos = photosRaw.map(toAssetDef);
    if (videosRaw.length > 0) result.assets.videos = videosRaw.map(toAssetDef);
    if (illustrationsRaw.length > 0) result.assets.illustrations = illustrationsRaw.map(toAssetDef);
  }

  // Finalise label / cta badge styles
  const parseBadgeStyle = (raw: Record<string, string>, defaults: ParsedBadgeStyle): ParsedBadgeStyle => {
    const padding = (() => {
      const p = raw['padding'];
      if (!p) return defaults.padding;
      const nums = p.split(/\s+/).map(parseFloat).filter(n => !isNaN(n));
      if (nums.length === 1) return [nums[0], nums[0], nums[0], nums[0]] as [number, number, number, number];
      if (nums.length === 2) return [nums[0], nums[1], nums[0], nums[1]] as [number, number, number, number];
      if (nums.length === 3) return [nums[0], nums[1], nums[2], nums[1]] as [number, number, number, number];
      if (nums.length >= 4) return [nums[0], nums[1], nums[2], nums[3]] as [number, number, number, number];
      return defaults.padding;
    })();
    const radius = raw['radius'] !== undefined ? parseFloat(raw['radius']) : defaults.radius;
    return { padding, radius: isNaN(radius) ? defaults.radius : radius };
  };
  if (Object.keys(labelRaw).length > 0) {
    result.label = parseBadgeStyle(labelRaw, { padding: [0.5, 1, 0.7, 1], radius: 0 });
  }
  if (Object.keys(ctaRaw).length > 0) {
    result.cta = parseBadgeStyle(ctaRaw, { padding: [0.8, 2.5, 0.8, 2.5], radius: 999 });
  }

  // Finalise icon set — font glyphs need a declared font (bare `font U+…` → first font).
  if (iconsDeclared) {
    if (icons.length === 0) throw new Error(`${fileName}: icons block is empty`);
    const fontNames = Object.keys(result.fonts ?? {});
    for (const icon of icons) {
      if (icon.source.kind !== 'font') continue;
      if (!icon.source.font) {
        if (fontNames.length === 0) throw new Error(`${fileName}: icon "${icon.id}" uses a font glyph, but no font block is declared`);
        icon.source.font = fontNames[0];
      } else if (!fontNames.includes(icon.source.font)) {
        throw new Error(`${fileName}: icon "${icon.id}" references unknown font "$${icon.source.font}"`);
      }
    }
    result.icons = icons;
  }

  // Finalise counter component
  if (counterDeclared) {
    const known = new Set(['format', 'typography', 'shape', 'size', 'padding']);
    for (const [key, { line }] of Object.entries(counterRaw)) {
      if (!known.has(key)) throw new Error(`${fileName}:${line}: unknown counter property "${key}"`);
    }
    const formats: CounterFormat[] = ['1', '01', '1.', '(1)', 'i'];
    const shapes: CounterShape[] = ['none', 'circle', 'square', 'pill'];
    const em = (key: string, fallback: number): number => {
      const entry = counterRaw[key];
      if (!entry) return fallback;
      const m = entry.value.match(/^(\d+(?:\.\d+)?)(?:em)?$/);
      if (!m) throw new Error(`${fileName}:${entry.line}: counter ${key} must be a number in em (e.g. "1.2em"), got "${entry.value}"`);
      return parseFloat(m[1]);
    };
    const format = counterRaw['format']?.value ?? '1';
    if (!formats.includes(format as CounterFormat)) {
      throw new Error(`${fileName}:${counterRaw['format'].line}: counter format must be one of ${formats.join(' | ')}, got "${format}"`);
    }
    const shape = counterRaw['shape']?.value ?? 'circle';
    if (!shapes.includes(shape as CounterShape)) {
      throw new Error(`${fileName}:${counterRaw['shape'].line}: counter shape must be one of ${shapes.join(' | ')}, got "${shape}"`);
    }
    const counter: ParsedCounterDef = {
      format: format as CounterFormat,
      shape: shape as CounterShape,
      size: em('size', 1),
      padding: em('padding', 0.2),
    };
    const typo = counterRaw['typography'];
    if (typo) {
      if (!result.typographies?.[typo.value]) throw new Error(`${fileName}:${typo.line}: counter typography "${typo.value}" is not a declared typography`);
      counter.typography = typo.value;
    }
    result.counter = counter;
  }

  // Finalise camera defaults
  if (cameraDeclared) {
    const known = new Set(['facing', 'grid']);
    for (const [key, { line }] of Object.entries(cameraRaw)) {
      if (!known.has(key)) throw new Error(`${fileName}:${line}: unknown camera property "${key}"`);
    }
    const facing = cameraRaw['facing']?.value ?? 'rear';
    if (facing !== 'front' && facing !== 'rear') {
      throw new Error(`${fileName}:${cameraRaw['facing'].line}: camera facing must be front | rear, got "${facing}"`);
    }
    const camera: ParsedCameraDef = { facing };
    const g = cameraRaw['grid'];
    if (g) {
      // "3" → 3 × 3, "3 4" → 3 rows × 4 columns
      const nums = g.value.split(/\s+/).map(Number);
      const [rows, cols = rows] = nums;
      if (nums.length > 2 || ![rows, cols].every(n => Number.isInteger(n) && n >= 2 && n <= 12)) {
        throw new Error(`${fileName}:${g.line}: camera grid must be "N" or "ROWS COLS" (2–12), got "${g.value}"`);
      }
      camera.grid = { rows, cols };
    }
    result.camera = camera;
  }

  // Finalise photo treatment
  if (photoLookDeclared) {
    const keys: PhotoLookKey[] = ['saturation', 'contrast', 'warmth', 'fade', 'mono', 'duotone'];
    for (const [key, { line }] of Object.entries(photoLookRaw)) {
      if (key !== 'fixed' && !keys.includes(key as PhotoLookKey)) throw new Error(`${fileName}:${line}: unknown photo-look property "${key}"`);
    }
    const int = (key: string, min: number, max: number): number => {
      const p = photoLookRaw[key];
      if (!p) return 0;
      const n = Number(p.value);
      if (!/^[+-]?\d+$/.test(p.value) || n < min || n > max) {
        throw new Error(`${fileName}:${p.line}: photo-look ${key} must be an integer from ${min} to ${max}, got "${p.value}"`);
      }
      return n;
    };
    const look: ParsedPhotoLookDef = {
      saturation: int('saturation', -100, 100),
      contrast: int('contrast', -100, 100),
      warmth: int('warmth', -100, 100),
      fade: int('fade', 0, 100),
      mono: false,
      fixed: [],
    };
    const mono = photoLookRaw['mono'];
    if (mono) {
      if (mono.value !== '') throw new Error(`${fileName}:${mono.line}: photo-look mono is a flag and takes no value`);
      look.mono = true;
    }
    const duo = photoLookRaw['duotone'];
    if (duo) {
      if (mono) throw new Error(`${fileName}:${duo.line}: photo-look cannot be both mono and duotone`);
      const refs = duo.value.split(/\s+/);
      if (refs.length !== 2) throw new Error(`${fileName}:${duo.line}: photo-look duotone must be "SHADOW HIGHLIGHT", got "${duo.value}"`);
      const [shadow, highlight] = refs.map(ref => {
        if (ref.startsWith('$') && !brandColors[ref.slice(1)]) {
          throw new Error(`${fileName}:${duo.line}: photo-look duotone references unknown brand color "${ref}"`);
        }
        const hex = normalizeHex(ref.startsWith('$') ? brandColors[ref.slice(1)] : ref);
        if (!hex) throw new Error(`${fileName}:${duo.line}: photo-look duotone colors must be $ref or #HEX, got "${ref}"`);
        return hex;
      });
      look.duotone = { shadow, highlight };
    }
    const fixed = photoLookRaw['fixed'];
    if (fixed) {
      for (const key of fixed.value.split(/\s+/)) {
        if (!keys.includes(key as PhotoLookKey)) throw new Error(`${fileName}:${fixed.line}: photo-look fixed lists unknown key "${key}"`);
        if (!photoLookRaw[key]) throw new Error(`${fileName}:${fixed.line}: photo-look fixed lists "${key}", which is not set`);
        look.fixed.push(key as PhotoLookKey);
      }
    }
    result.photoLook = look;
  }

  // Finalise framing modules
  if (framingsRaw.length > 0) {
    const known = new Set(['label', 'horizon', 'description']);
    result.framings = framingsRaw.map(({ id, line, props }) => {
      for (const [key, { line: l }] of Object.entries(props)) {
        if (!known.has(key)) throw new Error(`${fileName}:${l}: unknown framing property "${key}"`);
      }
      const h = props['horizon'];
      if (!h) throw new Error(`${fileName}:${line}: framing "${id}" needs "horizon: N%" or "horizon: none"`);
      let horizon: number | null = null;
      if (h.value !== 'none') {
        const m = h.value.match(/^(\d+(?:\.\d+)?)%$/);
        const n = m ? parseFloat(m[1]) : NaN;
        if (!(n > 0 && n < 100)) throw new Error(`${fileName}:${h.line}: framing horizon must be a percentage between 0% and 100% or "none", got "${h.value}"`);
        horizon = n;
      }
      const def: ParsedFramingDef = { id, label: props['label']?.value || id, horizon };
      if (props['description']?.value) def.description = props['description'].value;
      return def;
    });
  }

  // Validate required fields
  const required: (keyof ParsedBrand)[] = ['id', 'name', 'language', 'locale'];
  for (const field of required) {
    if (!result[field]) {
      throw new Error(`${fileName}: missing required field "${field}"`);
    }
  }

  return result as ParsedBrand;
}
