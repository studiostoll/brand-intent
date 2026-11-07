// Brand Intent — reference parser
// All parsers are pure functions:
// they take a string (file content) and filename, return a parsed object.

export { parseIdentityFile } from './identityParser';
export type { ParsedIdentity, ParsedVoice, ParsedReplacement, ParsedPillars, ParsedAudience, ParsedAntiAudience, ParsedValue, ParsedImagery, ParsedImageTheme, ParsedGoal, ParsedReview } from './identityParser';

export { parseBrandFile, checkBrand } from './brandParser';
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
export type { ParsedBrand, ParsedFontDef, ParsedTypographyDef, ParsedDividerDef, BrandColorPrintSpec, ParsedAssetDef, ParsedBadgeStyle, LogoAlign, ParsedCounterDef, CounterFormat, CounterShape, ParsedFramingDef, ParsedCameraDef, ParsedLocationDef, ParsedPhotoLookDef, PhotoLookKey } from './brandParser';

export { parseDateWindowRanges, isInDateWindow, SAMPLE_WINDOW_MARKER } from './dateWindows';
export type { DateWindowRange } from './dateWindows';

export { parseIconRef, parseIconSource, resolveIconRef, parseListItem, splitLabelledItem, phosphorName, PHOSPHOR_WEIGHTS } from './icons';
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

export { parsePurposeFile, checkPurpose } from './purposeParser';
export type { ParsedPurpose, ParsedPurposeSlot, ParsedExample, CountRange, Density, ListMarker } from './purposeParser';

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

export { parseStoryFile, checkStory, storyPlace, storyTextVariables, STORY_VARIABLES } from './storyParser';
export { parsePlaceFile, addressStreet, isOpenYet, weekdayOf, weekOpeningDays, parseDays, WEEKDAYS } from './placeParser';
export type { ParsedPlace, OpeningRange, OpeningDays, PlaceCapacity, Weekday } from './placeParser';
export { parseTimeFile, timeEntry, timeEntryNames, seasonForDate, isInSeason, yearsSince, isMonthDay, isDate, isDateOrYear } from './timeParser';
export type { ParsedTime, ParsedSeason, ParsedWeekly, ParsedDate, ParsedDailyMoment, TimeSpan, TimeEntry } from './timeParser';
export { parsePersonFile, personLabel, isWithdrawn, hasSomethingToShow } from './personParser';
export type { ParsedPerson } from './personParser';
export type { ParsedStory, ParsedStoryPage, ParsedStoryExample, ParsedStoryExamplePage, StoryVariable } from './storyParser';

export type { SlotId, ZoneInsets, TextAlign } from './types';
export { SLOT_IDS } from './types';
