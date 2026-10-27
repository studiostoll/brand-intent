// Brand Intent — reference parser
// All five parsers are pure functions:
// they take a string (file content) and filename, return a parsed object.

export { parseIdentityFile } from './identityParser';
export type { ParsedIdentity, ParsedVoice, ParsedReplacement, ParsedPillars, ParsedAudience, ParsedAntiAudience, ParsedValue, ParsedImagery, ParsedImageTheme, ParsedGoal, ParsedReview } from './identityParser';

export { parseBrandFile } from './brandParser';
export {
  contrastRatio,
  relativeLuminance,
  toneClass,
  isHex6,
  pairRuleViolations,
  derivePairSlots,
  resolveTextColor,
  reachableFamilies,
  cycleMembers,
  LEVEL_SLOTS,
  LEVEL_PAIRS,
  levelRuleViolations,
  reachCoversAll,
  colorOrigin,
  toneAnchorsFrom,
  familyTextCandidates,
  checkFamilyPair,
  enumerateFamilyPairs,
  familyIndexForDate,
  DEFAULT_COLOR_RULES,
} from './colorSystem';
export type { ReachConfig, ToneAnchors } from './colorSystem';
export type { ParsedBrand, ParsedFontDef, ParsedTypographyDef, ParsedDividerDef, BrandColorPrintSpec, ParsedAssetDef, ParsedBadgeStyle, LogoAlign, ParsedCounterDef, CounterFormat, CounterShape, ParsedFramingDef, ParsedCameraDef, ParsedPhotoLookDef, PhotoLookKey } from './brandParser';

export { parseDateWindowRanges, isInDateWindow, SAMPLE_WINDOW_MARKER } from './dateWindows';
export type { DateWindowRange } from './dateWindows';

export { parseIconRef, parseIconSource, resolveIconRef, parseListItem, phosphorName, PHOSPHOR_WEIGHTS } from './icons';
export type { IconRef, IconSource, ParsedIconDef, ResolvedIcon, PhosphorWeight } from './icons';
export type {
  ColorMode,
  PaletteStrategy,
  Adherence,
  AdherenceTolerances,
  ColorBounds,
  StateColors,
  GroupKey,
  IdentityGroupKey,
  NeutralRole,
  BrandColorEntry,
  BrandColorGroup,
  ToneClass,
  ColorRules,
  FamilyOrder,
  FamilyBorrow,
  FamilyRole,
  FamilyColor,
  PairOrigin,
  PairCheck,
  FamilyPair,
  ColorFamily,
  ColorFamilies,
  ThemePair,
  Tones,
  Levels,
  LevelSlot,
} from './types';

export { parseFormatFile } from './formatParser';
export type { ParsedFormat } from './formatParser';

export { parsePurposeFile } from './purposeParser';
export type { ParsedPurpose, ParsedPurposeSlot, CountRange, Density, ListMarker } from './purposeParser';

export { parseCompositionFile } from './compositionParser';
export type {
  ParsedComposition,
  ParsedFlowRegion,
  ParsedStickyRegion,
  ParsedFlowItem,
  ParsedImageRegion,
  ParsedIllustration,
  IllustrationAnchor,
  GridYKeyword,
} from './compositionParser';

export type { SlotId, ZoneInsets, TextAlign } from './types';
