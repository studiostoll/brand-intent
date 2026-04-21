// Brand Intent — reference parser
// All five parsers are pure functions:
// they take a string (file content) and filename, return a parsed object.

export { parseIdentityFile } from './identityParser';
export type { ParsedIdentity, ParsedVoice, ParsedPillars, ParsedAudience, ParsedAntiAudience, ParsedValue } from './identityParser';

export { parseBrandFile } from './brandParser';
export type { ParsedBrand, ParsedFontDef, ParsedTypographyDef, ParsedDividerDef, BrandColorPrintSpec, ParsedAssetDef, ParsedBadgeStyle } from './brandParser';
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
} from './types';

export { parseFormatFile } from './formatParser';
export type { ParsedFormat } from './formatParser';

export { parsePurposeFile } from './purposeParser';
export type { ParsedPurpose, ParsedPurposeSlot, Density } from './purposeParser';

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
