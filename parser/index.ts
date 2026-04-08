// Brand Intent — reference parser
// Extracted from Brand Atelier. All four parsers are pure functions:
// they take a string (file content) and filename, return a parsed object.

export { parseBrandFile } from './brandParser';
export type { ParsedBrand, ParsedFontDef, ParsedTypographyDef, ParsedDividerDef, BrandColorPrintSpec } from './brandParser';

export { parseFormatFile } from './formatParser';
export type { ParsedFormat } from './formatParser';

export { parsePurposeFile } from './purposeParser';
export type { ParsedPurpose, ParsedPurposeSlot, Density } from './purposeParser';

export { parseLayoutFile } from './compositionParser';
export type { ParsedArchetype, ParsedFlowRegion, ParsedStickyRegion } from './compositionParser';

export type { SlotId, ZoneInsets, TextAlign } from './types';
