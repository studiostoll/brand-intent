/**
 * Parser for .composition definition files.
 *
 * Strict, line-based format. Every line must match a known pattern or be blank.
 * Throws on parse errors with file name and line number.
 *
 * Row names: row 1 = index 0, row 2 = index 1, ..., row 6 = index 5 (1-based in files, 0-based in output)
 * Column names: 1=0, 2=1, 3=2, 4=3, 5=4, 6=5 (1-based in files, 0-based in output)
 */

import { isSlotIdShape, isReservedSlotName, type SlotId } from './types';

// ── Parsed types ──────────────────────────────────────────────────────────────

/** Grid Y keyword — resolved to actual % at layout time using buildGrid(). */
export type GridYKeyword = 'top' | 'center' | 'bottom';

export interface ParsedImageRegion {
  yStart: GridYKeyword;
  yEnd: GridYKeyword;
  colStart?: number;  // 0-based column (undefined = full width)
  colEnd?: number;    // 0-based column (undefined = full width)
}

/** Anchor keywords for illustration placement. */
export type IllustrationAnchor =
  | 'top-left' | 'top-center' | 'top-right'
  | 'center-left' | 'center' | 'center-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

/** Parsed illustration placement from `illustration:` line. */
export interface ParsedIllustration {
  anchor: IllustrationAnchor;
  fit: 'width' | 'height';
  /** Scale as fraction 0–1 (e.g. 0.9 = 90% of canvas dimension). */
  scale: number;
  /** Offset from anchor position in % of canvas [x, y]. Positive = right/down. */
  offset?: [number, number];
}

const ILLUSTRATION_ANCHORS = new Set<string>([
  'top-left', 'top-center', 'top-right',
  'center-left', 'center', 'center-right',
  'bottom-left', 'bottom-center', 'bottom-right',
]);

/** One `place:` line of a region: a slot on the region's top or bottom edge, across columns `cols` (1-based). */
export interface ParsedRegionPlace { slot: SlotId; edge: 'top' | 'bottom'; side: 'left' | 'right'; cols: [number, number] }

/** A region of a printed piece: a run of the format's fields, top to bottom (`mode: regions`). */
export interface ParsedRegion {
  id: string;
  /** The fields the region spans, 1-based, inclusive; or `content`: as many whole fields as what it holds needs, at
   *  least one, decided when the piece is laid out; or `rest`: the fields the other regions leave. */
  fields: [number, number] | 'content' | 'rest' | 'line';
  /** A line without fields of its own (`line: 2x`, `fields` is then `line`): its height in x. It stands on the edge
   *  of the fields next to it, those of the region above (the first region: below), and takes its height from them. */
  lineX?: number;
  /** The region's slots in an outlined box (`box: 7-12 0.5mm 0.75x`): the columns it spans, its line, the space
   *  between line and text. As tall as what it holds, on the region's bottom edge. */
  box?: { cols: [number, number]; lineMm: number; padX: number };
  /** The page's photo across columns A to B and the region's height (`photo: 9-12`), on one side of the region: the
   *  slots stand on the other columns. */
  photo?: [number, number];
  logo?: { v: 'top' | 'bottom'; h: 'left' | 'right' };
  places: ParsedRegionPlace[];
  group?: SlotId[];
  stack?: { field: number } | { neighbour: true; gapX?: number };
  baseline?: SlotId[];
  fit?: SlotId[];
  /** Slot → the height of its capitals in x, as a role counts. */
  sizes?: Record<string, number>;
}

export interface ParsedComposition {
  /** Programmatic ID (from `id:` line, or fallback from first `#` line). */
  id: string;
  /** Human-readable display name (from `name:` line, or falls back to id). */
  name: string;
  description: string;
  /** Explicit layout mode. 'flow' | 'grid' | null (inferred from structure). */
  mode: 'flow' | 'grid' | 'regions' | null;
  image: 'full' | 'none' | ParsedImageRegion;
  /** Whether `image:` was explicitly written (vs. defaulted to 'full'). */
  imageExplicit: boolean;
  logo: { row: number | GridYKeyword; col: 'left' | 'center' | 'right'; size?: 's' | 'm' | 'l' } | null;
  /** When true, the layout explicitly disallows logos (`logo: none` in .layout). */
  logoNone?: boolean;
  /** Icon slot placement (optional). */
  icon?: { row: number | GridYKeyword; col: 'left' | 'center' | 'right'; size?: 's' | 'm' | 'l' };
  /** Standalone slots (empty if composition uses flow:). */
  slots: ParsedSlot[];
  /** Sticky regions — composed repetition areas (logo, label). */
  sticky: ParsedStickyRegion[];
  /** Flow regions — content-driven flow areas. */
  flow: ParsedFlowRegion | null;
  /** Illustration placement (grid mode only for now). */
  illustration?: ParsedIllustration;
  /** The regions of a printed piece (`mode: regions` only), top to bottom. */
  regions?: ParsedRegion[];
}

/** A sticky (repetition) region — composed elements that don't participate in flow. */
export interface ParsedStickyRegion {
  position: 'top' | 'bottom' | 'left' | 'right';
  /** Size token — determines bar height and logo/label sizing. Default: 'm'. */
  size: 's' | 'm' | 'l';
  items: ParsedStickyItem[];
}

export interface ParsedStickyItem {
  type: 'logo' | 'slot' | 'icon';
  /** For logo: alignment. For slot: slot ID. */
  id?: string;
  align: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'center' | 'bottom';
  size?: 's' | 'm' | 'l';
}

/** A flow region — where content flows. */
export interface ParsedFlowRegion {
  /** Panel positioning (null = fill remaining space). */
  panel?: {
    position: string;  // e.g. 'bottom-left', 'top-right'
    widthFraction: number;
    heightFraction: number;
    /** `inset`: the box keeps its size, its outer edges sit on the safe-area lines, equal padding inside. */
    inset?: boolean;
  };
  /** Split: text occupies a fraction from one edge, image fills the rest. */
  split?: {
    edge: 'top' | 'bottom' | 'left' | 'right';
    fraction: number;  // e.g. 0.5 = half, 0.333 = one third
  };
  /** Width: the flow's content takes this share of the flow's width (e.g. 0.75), on the side its first slot's text is aligned to. No surface behind it. */
  width?: number;
  /** Flow direction (default: vertical). */
  direction: 'vertical' | 'horizontal';
  /** Number of text columns (default: 1). */
  columns?: number;
  /** Gap between columns — spacing token name (default: 'm'). */
  columnGap?: string;
  items: ParsedFlowItem[];
}

export interface ParsedSlot {
  id: SlotId;
  row: number;
  colStart: number;
  colEnd: number;
  textAlign: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'center' | 'bottom';
}

export interface ParsedFlowIcon {
  type: 'icon';
  align: 'left' | 'center' | 'right';
  /** Size token (s/m/l). Default: 'm'. */
  size: 's' | 'm' | 'l';
}

/** The page photo as a flow item: its width is a share of the flow's width, its height follows the photo. */
export interface ParsedFlowPhoto {
  type: 'photo';
  align: 'left' | 'center' | 'right';
  /** Size token (s/m/l = 1/3, 1/2, 2/3 of the flow width). Default: 'm'. */
  size: 's' | 'm' | 'l';
}

export type ParsedFlowItem = ParsedFlowSlot | ParsedSpacer | ParsedDivider | ParsedFlowIcon | ParsedFlowPhoto;

export interface ParsedFlowSlot {
  type: 'slot';
  id: SlotId;
  textAlign: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'center' | 'bottom';
  /** Number of text columns for this slot (default: 1). */
  columns?: number;
  /** Gap between columns — spacing token name. */
  columnGap?: string;
}

export interface ParsedSpacer {
  type: 'spacer';
  /** Token name from figma-tokens.json spacing (e.g. 's', 'm', 'l', 'xl') or 'auto'. */
  size: string;
}

export interface ParsedDivider {
  type: 'divider';
  /** 'ruler' (thick, accent color) or 'hairline' (thin, muted). */
  variant: 'ruler' | 'hairline';
}

// ── Constants ─────────────────────────────────────────────────────────────────

const GRID_Y_KEYWORDS = new Set<string>(['top', 'center', 'bottom']);

/** Throws when `id` can't name a slot in a composition; returns whether it is a slot id at all. */
function checkSlotName(id: string, where: string): boolean {
  if (!isSlotIdShape(id)) return false;
  if (isReservedSlotName(id)) {
    throw new Error(`${where}: "${id}" can't name a slot, the composition language reads it as a keyword`);
  }
  return true;
}
// Spacer names: 'auto' + any key from figma-tokens.json spacing (s, m, l, xl, etc.)
// Parser accepts any alphanumeric name — validation against actual tokens happens at render time.

// ── Column parsing ────────────────────────────────────────────────────────────

/** Parse a column value: "1"--N (mapped to 0-based). */
function parseCol(value: string, fileName: string, lineNum: number, maxCol = 12): number {
  const n = parseInt(value, 10);
  if (isNaN(n) || n < 1 || n > maxCol) {
    throw new Error(`${fileName}:${lineNum}: invalid column "${value}" (expected 1--${maxCol})`);
  }
  return n - 1; // 1-based → 0-based
}

/** Parse a column range "A--B" where A and B are column values. */
function parseColRange(range: string, fileName: string, lineNum: number, maxCol = 12): { start: number; end: number } {
  const parts = range.split('--');
  if (parts.length !== 2) {
    throw new Error(`${fileName}:${lineNum}: invalid column range "${range}" (expected "A--B")`);
  }
  const start = parseCol(parts[0].trim(), fileName, lineNum, maxCol);
  const end = parseCol(parts[1].trim(), fileName, lineNum, maxCol);
  return { start, end };
}

/** Validate a logo/icon col keyword (must be left, center, or right). */
function resolveColKeyword(raw: string, fileName: string, lineNum: number): 'left' | 'center' | 'right' {
  if (raw === 'left' || raw === 'center' || raw === 'right') return raw;
  throw new Error(`${fileName}:${lineNum}: invalid col keyword "${raw}" (expected left, center, or right)`);
}

// ── Main parser ───────────────────────────────────────────────────────────────

export function parseCompositionFile(content: string, fileName: string): ParsedComposition {
  const lines = content.split('\n');

  let id = '';
  let name = '';
  let description = '';
  let mode: 'flow' | 'grid' | 'regions' | null = null;
  const regions: ParsedRegion[] = [];
  let region: ParsedRegion | null = null;
  const regionLines = new Map<ParsedRegion, number>();
  /** Regions whose "fields:" line was read. */
  const fieldsSet = new Set<ParsedRegion>();
  const stackLines = new Map<ParsedRegion, number>();
  const groupLines = new Map<ParsedRegion, number>();
  const placed = new Set<string>();
  let logoRegionLine = 0;
  let foreign: { line: number; what: string } | null = null;
  const noteForeign = (lineNum: number, what: string) => { if (!foreign) foreign = { line: lineNum, what }; };
  let image: ParsedComposition['image'] | null = null;
  let imageExplicit = false;
  let logo: ParsedComposition['logo'] = null;
  let logoNone = false;
  let icon: ParsedComposition['icon'] | undefined = undefined;
  const slots: ParsedSlot[] = [];
  const sticky: ParsedStickyRegion[] = [];
  let flow: ParsedFlowRegion | null = null;
  let illustration: ParsedIllustration | undefined = undefined;

  /** Parse a fraction string like "2/3" → 0.667. */
  function parseFraction(s: string, ctx: string): number {
    const parts = s.split('/');
    if (parts.length !== 2) throw new Error(`${ctx}: invalid fraction "${s}" (expected "N/M")`);
    const num = parseInt(parts[0], 10);
    const den = parseInt(parts[1], 10);
    if (isNaN(num) || isNaN(den) || den === 0) throw new Error(`${ctx}: invalid fraction "${s}"`);
    return num / den;
  }
  // For backward compat: track first # line text for fallback id
  let firstHashText = '';

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const raw = lines[i];
    const fullLine = raw.trim();

    // Blank line
    if (fullLine === '') continue;

    // Comment — ALL # lines go to description now
    if (fullLine.startsWith('#')) {
      const text = fullLine.slice(1).trim();
      if (!firstHashText) firstHashText = text;
      description = description ? `${description} ${text}` : text;
      continue;
    }

    // Inline comments after a value are allowed; a composition has no free text that could hold "#"
    const line = fullLine.replace(/\s+#.*$/, '');

    // id: field
    if (line.startsWith('id:')) {
      id = line.slice(3).trim();
      continue;
    }

    // name: field
    if (line.startsWith('name:')) {
      name = line.slice(5).trim();
      continue;
    }

    // mode: flow | grid (accepts legacy "compose" as alias for "grid")
    if (line.startsWith('mode:')) {
      const raw = line.slice(5).trim();
      const value = raw === 'compose' ? 'grid' : raw;
      if (value !== 'flow' && value !== 'grid' && value !== 'regions') {
        throw new Error(`${fileName}:${lineNum}: invalid mode "${value}" (expected "flow", "grid" or "regions")`);
      }
      mode = value;
      continue;
    }


    // Regions mode: "region ID" opens a block, its keys follow until the next region
    const regionHead = line.match(/^region(?:\s+(.*))?$/);
    if (regionHead) {
      const at = `${fileName}:${lineNum}`;
      const rid = (regionHead[1] ?? '').trim();
      if (!/^[a-z][a-z0-9-]*$/.test(rid)) throw new Error(`${at}: invalid region id "${rid}" (expected lowercase letters, digits and hyphens)`);
      if (regions.some(r => r.id === rid)) throw new Error(`${at}: more than one region "${rid}"`);
      if (mode !== null && mode !== 'regions') throw new Error(`${at}: "region" needs "mode: regions" (this composition is in ${mode} mode)`);
      region = { id: rid, fields: [0, 0], places: [] };
      regionLines.set(region, lineNum);
      regions.push(region);
      continue;
    }
    if (region) {
      const key = line.match(/^([a-z][a-z-]*):\s*(.*)$/);
      const REGION_KEYS = ['fields', 'line', 'box', 'photo', 'logo', 'place', 'group', 'stack', 'baseline', 'fit', 'size'];
      if (key && !['id', 'name', 'mode', 'image', 'illustration', 'grid', 'icon', 'sticky', 'flow'].includes(key[1]) && !REGION_KEYS.includes(key[1])) {
        throw new Error(`${fileName}:${lineNum}: unknown region key "${key[1]}" in region "${region.id}" (expected ${REGION_KEYS.join(', ')})`);
      }
      if (key && REGION_KEYS.includes(key[1])) {
        const at = `${fileName}:${lineNum}`;
        const value = key[2].trim();
        const words = value ? value.split(/\s+/) : [];
        const slotName = (w: string) => {
          if (!checkSlotName(w, at)) throw new Error(`${at}: "${w}" is no slot name (expected lowercase letters, digits and hyphens)`);
          return w as SlotId;
        };
        const slotList = (): SlotId[] => {
          if (!words.length) throw new Error(`${at}: ${key[1]}: needs at least one slot`);
          return words.map(slotName);
        };
        const rangeOf = (v: string, what: string): [number, number] => {
          const m = v.match(/^(\d+)(?:-(\d+))?$/);
          if (!m) throw new Error(`${at}: invalid ${what} "${v}" (expected "A-B" or "A")`);
          const a = parseInt(m[1], 10);
          const b = m[2] === undefined ? a : parseInt(m[2], 10);
          if (a < 1 || b < a) throw new Error(`${at}: invalid ${what} "${v}" (counted from 1, ascending)`);
          return [a, b];
        };
        const xOf = (v: string, what: string): number => {
          const m = v.match(/^(\d+(?:\.\d+)?)x$/);
          if (!m || parseFloat(m[1]) <= 0) throw new Error(`${at}: invalid ${what} "${v}" (expected a number of x, e.g. "4x" or "1.5x")`);
          return parseFloat(m[1]);
        };
        const once = (have: unknown) => { if (have) throw new Error(`${at}: "${key[1]}:" twice in region "${region!.id}"`); };
        switch (key[1]) {
          case 'fields': {
            if (region.fields === 'line') throw new Error(`${at}: region "${region.id}" is a line, it has no fields`);
            once(fieldsSet.has(region));
            fieldsSet.add(region);
            if (words.length !== 1) throw new Error(`${at}: invalid fields "${value}" (expected "A-B", "A", "content" or "rest")`);
            region.fields = words[0] === 'content' || words[0] === 'rest' ? words[0] : rangeOf(words[0], 'fields');
            break;
          }
          case 'line': {
            if (fieldsSet.has(region)) throw new Error(`${at}: region "${region.id}" has its fields, a line has none ("fields:" or "line:")`);
            fieldsSet.add(region);
            if (words.length !== 1) throw new Error(`${at}: invalid line "${value}" (expected its height in x, e.g. "2x")`);
            region.fields = 'line';
            region.lineX = xOf(words[0], 'line');
            break;
          }
          case 'box': {
            once(region.box);
            const mm = words[1]?.match(/^(\d+(?:\.\d+)?)mm$/);
            if (words.length !== 3 || !mm || parseFloat(mm[1]) <= 0) throw new Error(`${at}: invalid box "${value}" (expected its columns, its line and its padding, e.g. "7-12 0.5mm 0.75x")`);
            region.box = { cols: rangeOf(words[0], 'box columns'), lineMm: parseFloat(mm[1]), padX: xOf(words[2], 'box padding') };
            break;
          }
          case 'photo': {
            once(region.photo);
            if (words.length !== 1) throw new Error(`${at}: invalid photo "${value}" (expected its columns, e.g. "9-12")`);
            region.photo = rangeOf(words[0], 'photo columns');
            if (region.photo[0] !== 1 && region.photo[0] === region.photo[1]) throw new Error(`${at}: invalid photo "${value}" (expected at least two columns)`);
            break;
          }
          case 'logo': {
            once(region.logo);
            if (words.length !== 2 || !['top', 'bottom'].includes(words[0]) || !['left', 'right'].includes(words[1])) {
              throw new Error(`${at}: invalid region logo "${value}" (expected "top|bottom left|right")`);
            }
            if (logoRegionLine) throw new Error(`${at}: only one region may have a logo (see line ${logoRegionLine})`);
            logoRegionLine = lineNum;
            region.logo = { v: words[0] as 'top' | 'bottom', h: words[1] as 'left' | 'right' };
            break;
          }
          case 'place': {
            const edgeAt = words.findIndex(w => w === 'top' || w === 'bottom');
            const bad = `${at}: invalid place "${value}" (expected "SLOT top|bottom [left|right] A-B")`;
            if (edgeAt !== 1 || words.length < 3 || words.length > 4) throw new Error(bad);
            const side = words.length === 4 ? words[2] : 'left';
            if (side !== 'left' && side !== 'right') throw new Error(bad);
            const slot = slotName(words[0]);
            if (placed.has(slot)) throw new Error(`${at}: slot "${slot}" is placed twice in this composition`);
            placed.add(slot);
            region.places.push({ slot, edge: words[1] as 'top' | 'bottom', side, cols: rangeOf(words[words.length - 1], 'columns') });
            break;
          }
          case 'group': {
            once(region.group);
            region.group = slotList();
            groupLines.set(region, lineNum);
            break;
          }
          case 'stack': {
            once(region.stack);
            stackLines.set(region, lineNum);
            if (words[0] === 'field' && words.length === 2 && /^\d+$/.test(words[1]) && parseInt(words[1], 10) >= 1) {
              region.stack = { field: parseInt(words[1], 10) };
            } else if (words[0] === 'neighbour' && words.length === 1) {
              region.stack = { neighbour: true };
            } else if (words[0] === 'neighbour' && words.length === 2) {
              region.stack = { neighbour: true, gapX: xOf(words[1], 'stack distance') };
            } else {
              throw new Error(`${at}: invalid stack "${value}" (expected "field N" or "neighbour [Nx]")`);
            }
            break;
          }
          case 'baseline': { once(region.baseline); region.baseline = slotList(); break; }
          case 'fit': { once(region.fit); region.fit = slotList(); break; }
          case 'size': {
            if (words.length !== 2) throw new Error(`${at}: invalid size "${value}" (expected "SLOT Nx")`);
            const slot = slotName(words[0]);
            region.sizes ??= {};
            if (slot in region.sizes) throw new Error(`${at}: size of "${slot}" twice in region "${region.id}"`);
            region.sizes[slot] = xOf(words[1], 'size');
            break;
          }
        }
        continue;
      }
    }

    // Image region: "full", "none", "top--center", "top--center cols 1--2"
    if (line.startsWith('image:')) {
      const value = line.slice(6).trim();
      imageExplicit = true;
      if (value === 'none') {
        image = 'none';
        continue;
      }
      if (value === 'full') {
        image = 'full';
      } else {
        // Parse "yStart--yEnd" with optional "cols N--M"
        const match = value.match(/^(\w+)--(\w+)(?:\s+cols\s+(\S+))?$/);
        if (!match) throw new Error(`${fileName}:${lineNum}: invalid image region "${value}" (expected "full" or "keyword--keyword [cols N--M]")`);
        const [, yStartStr, yEndStr, colRangeStr] = match;
        if (!GRID_Y_KEYWORDS.has(yStartStr)) throw new Error(`${fileName}:${lineNum}: unknown grid keyword "${yStartStr}" (expected top, center, bottom)`);
        if (!GRID_Y_KEYWORDS.has(yEndStr)) throw new Error(`${fileName}:${lineNum}: unknown grid keyword "${yEndStr}" (expected top, center, bottom)`);
        const parsed: ParsedImageRegion = { yStart: yStartStr as GridYKeyword, yEnd: yEndStr as GridYKeyword };
        if (colRangeStr) {
          const cols = parseColRange(colRangeStr, fileName, lineNum);
          if (typeof cols.start !== 'number') throw new Error(`${fileName}:${lineNum}: image cols cannot use dynamic expressions`);
          parsed.colStart = cols.start;
          parsed.colEnd = cols.end;
        }
        image = parsed;
      }
      continue;
    }

    // Illustration placement: "illustration: bottom-center fit-width 90%"
    if (line.startsWith('illustration:')) {
      const parts = line.slice(13).trim().split(/\s+/);
      if (parts.length < 3) throw new Error(`${fileName}:${lineNum}: invalid illustration line — expected "illustration: <anchor> <fit-width|fit-height> <N%>"`);
      const anchor = parts[0];
      if (!ILLUSTRATION_ANCHORS.has(anchor)) throw new Error(`${fileName}:${lineNum}: invalid illustration anchor "${anchor}" (expected ${[...ILLUSTRATION_ANCHORS].join(', ')})`);
      const fitStr = parts[1];
      if (fitStr !== 'fit-width' && fitStr !== 'fit-height') throw new Error(`${fileName}:${lineNum}: invalid illustration fit "${fitStr}" (expected fit-width or fit-height)`);
      const scaleStr = parts[2];
      const scaleMatch = scaleStr.match(/^(\d+(?:\.\d+)?)%$/);
      if (!scaleMatch) throw new Error(`${fileName}:${lineNum}: invalid illustration scale "${scaleStr}" (expected e.g. "90%")`);
      const scale = parseFloat(scaleMatch[1]) / 100;
      if (scale <= 0 || scale > 2) throw new Error(`${fileName}:${lineNum}: illustration scale out of range (expected 1%–200%)`);
      const illu: ParsedIllustration = { anchor: anchor as IllustrationAnchor, fit: fitStr === 'fit-width' ? 'width' : 'height', scale };
      // Optional: "offset X Y" in % of canvas (positive = right/down)
      if (parts.length >= 5 && parts[3] === 'offset') {
        const ox = parseFloat(parts[4]);
        const oy = parts.length >= 6 ? parseFloat(parts[5]) : 0;
        if (!isNaN(ox) && !isNaN(oy)) illu.offset = [ox, oy];
      }
      illustration = illu;
      continue;
    }

    // grid: is no longer used in layout files (format owns the grid). Silently skip.
    if (line.startsWith('grid:')) {
      console.warn(`${fileName}:${lineNum}: "grid:" in layout files is no longer needed — format defines the grid`);
      continue;
    }

    // Logo: "logo: row N X [size]" or "logo: top/center/bottom X [size]"
    // col: left | center | right
    // size: s | m | l (optional, defaults to m)
    if (line.startsWith('logo:')) {
      noteForeign(lineNum, 'logo:');
      const logoValue = line.slice(5).trim();
      if (logoValue === 'none') {
        logo = null;
        logoNone = true;
        continue;
      }
      // Grid keyword form: "logo: top/center/bottom [col] X [s|m|l]"
      const kwMatch = line.match(/^logo:\s+(top|center|bottom)\s+(?:col\s+)?(left|center|right)(?:\s+(s|m|l))?\s*$/);
      if (kwMatch) {
        const col = resolveColKeyword(kwMatch[2], fileName, lineNum);
        logo = { row: kwMatch[1] as GridYKeyword, col, size: (kwMatch[3] as 's' | 'm' | 'l') ?? undefined };
        continue;
      }
      // Row number form: "logo: row N [col] X [s|m|l]"
      const rowMatch = line.match(/^logo:\s+row\s+(\d+)\s+(?:col\s+)?(left|center|right)(?:\s+(s|m|l))?\s*$/);
      if (rowMatch) {
        const col = resolveColKeyword(rowMatch[2], fileName, lineNum);
        logo = { row: parseInt(rowMatch[1], 10) - 1, col, size: (rowMatch[3] as 's' | 'm' | 'l') ?? undefined };
        continue;
      }
      throw new Error(`${fileName}:${lineNum}: invalid logo line "${line}" (expected "logo: row N left|center|right" or "logo: top/center/bottom left|center|right")`);
    }

    // Icon: "icon: top X [s|m|l]" or "icon: row N X [s|m|l]"
    if (line.startsWith('icon:')) {
      noteForeign(lineNum, 'icon:');
      const kwMatch = line.match(/^icon:\s+(top|center|bottom)\s+(?:col\s+)?(left|center|right)(?:\s+(s|m|l))?\s*$/);
      if (kwMatch) {
        const col = resolveColKeyword(kwMatch[2], fileName, lineNum);
        icon = { row: kwMatch[1] as GridYKeyword, col, size: (kwMatch[3] as 's' | 'm' | 'l') ?? undefined };
        continue;
      }
      const rowMatch = line.match(/^icon:\s+row\s+(\d+)\s+(?:col\s+)?(left|center|right)(?:\s+(s|m|l))?\s*$/);
      if (rowMatch) {
        const col = resolveColKeyword(rowMatch[2], fileName, lineNum);
        icon = { row: parseInt(rowMatch[1], 10) - 1, col, size: (rowMatch[3] as 's' | 'm' | 'l') ?? undefined };
        continue;
      }
      throw new Error(`${fileName}:${lineNum}: invalid icon line "${line}"`);
    }

    // ── New flow DSL: sticky: and flow: blocks ────────────────────────────────

    // Sticky region: "sticky: top [s|m|l]" — size token optional, defaults to 'm'
    if (line.startsWith('sticky:')) {
      noteForeign(lineNum, 'sticky:');
      const stickyParts = line.slice(7).trim().split(/\s+/);
      const position = stickyParts[0] as 'top' | 'bottom' | 'left' | 'right';
      if (!['top', 'bottom', 'left', 'right'].includes(position)) {
        throw new Error(`${fileName}:${lineNum}: invalid sticky position "${position}" (expected top, bottom, left, right)`);
      }
      const stickySize = (stickyParts[1] as 's' | 'm' | 'l') ?? 'm';
      if (!['s', 'm', 'l'].includes(stickySize)) {
        throw new Error(`${fileName}:${lineNum}: invalid sticky size "${stickyParts[1]}" (expected s, m, l)`);
      }
      const stickyItems: ParsedStickyItem[] = [];
      // Read indented items (| prefix) — skip blank lines within the block
      while (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (nextLine === '') { i++; continue; }
        if (!nextLine.startsWith('|')) break;
        i++;
        const itemStr = nextLine.slice(1).trim();
        // Parse: "logo <align> [size]" or "<slotId> <align>"
        const parts = itemStr.split(/\s+/);
        // Parse optional vertical alignment: "meta left bottom" or "logo right" or "logo left s"
        const VALIGNS = ['top', 'center', 'bottom'];
        const parseVAlign = (p: string | undefined) => VALIGNS.includes(p ?? '') ? p as 'top' | 'center' | 'bottom' : undefined;
        if (parts[0] === 'logo') {
          // logo <align> [top|center|bottom] [s|m|l]
          const vAlign = parseVAlign(parts[2]);
          const sizeIdx = vAlign ? 3 : 2;
          stickyItems.push({
            type: 'logo',
            align: (parts[1] as 'left' | 'center' | 'right') ?? 'left',
            verticalAlign: vAlign,
            size: parts[sizeIdx] as 's' | 'm' | 'l' | undefined,
          });
        } else if (parts[0] === 'icon') {
          stickyItems.push({
            type: 'icon',
            align: (parts[1] as 'left' | 'center' | 'right') ?? 'left',
            verticalAlign: parseVAlign(parts[2]),
          });
        } else if (checkSlotName(parts[0], `${fileName}:${i + 1}`)) {
          stickyItems.push({
            type: 'slot',
            id: parts[0],
            align: (parts[1] as 'left' | 'center' | 'right') ?? 'left',
            verticalAlign: parseVAlign(parts[2]),
          });
        } else {
          throw new Error(`${fileName}:${i + 1}: unknown sticky item "${parts[0]}"`);
        }
      }
      sticky.push({ position, size: stickySize, items: stickyItems });
      continue;
    }

    // Flow region: "flow:" / "flow: panel bottom-left 2/3 1/1"
    if (line.startsWith('flow:')) {
      noteForeign(lineNum, 'flow:');
      const value = line.slice(5).trim();
      let panel: ParsedFlowRegion['panel'] = undefined;
      let direction: 'vertical' | 'horizontal' = 'vertical';
      let columns: number | undefined;
      let columnGap: string | undefined;

      let split: ParsedFlowRegion['split'] = undefined;
      let width: number | undefined;

      if (value.startsWith('panel')) {
        // Parse: "panel <position> [<width>] [<height>] [inset]"
        const all = value.split(/\s+/);
        const inset = all.includes('inset');
        const parts = all.filter(p => p !== 'inset');
        const pos = parts[1] ?? 'bottom-left';
        const wFrac = parts[2] ? parseFraction(parts[2], `${fileName}:${lineNum}`) : 2 / 3;
        const hFrac = parts[3] ? parseFraction(parts[3], `${fileName}:${lineNum}`) : wFrac;
        if (parts.length > 4) throw new Error(`${fileName}:${lineNum}: unexpected "${parts.slice(4).join(' ')}" in panel (expected: panel <position> [<width>] [<height>] [inset])`);
        panel = { position: pos, widthFraction: wFrac, heightFraction: hFrac, ...(inset ? { inset: true } : {}) };
      } else if (value.startsWith('split')) {
        // Parse: "split <edge> [<fraction>]"  — e.g. "split bottom 1/2"
        const parts = value.split(/\s+/);
        const edge = parts[1] as 'top' | 'bottom' | 'left' | 'right';
        if (!['top', 'bottom', 'left', 'right'].includes(edge)) {
          throw new Error(`${fileName}:${lineNum}: invalid split edge "${edge}" — expected top, bottom, left, right`);
        }
        const fraction = parts[2] ? parseFraction(parts[2], `${fileName}:${lineNum}`) : 0.5;
        split = { edge, fraction };
      } else if (value.startsWith('width')) {
        // Parse: "width <fraction>"  — e.g. "width 3/4"
        const parts = value.split(/\s+/);
        if (parts.length !== 2) throw new Error(`${fileName}:${lineNum}: invalid flow width "${value}" (expected: width N/M)`);
        width = parseFraction(parts[1], `${fileName}:${lineNum}`);
        if (width <= 0 || width > 1) throw new Error(`${fileName}:${lineNum}: flow width "${parts[1]}" must be above 0 and at most 1/1`);
      } else if (value) {
        throw new Error(`${fileName}:${lineNum}: unknown flow type "${value}" (expected panel, split or width)`);
      }

      const flowItems: ParsedFlowItem[] = [];
      // Read indented items (| prefix or "direction:" property) — skip blank lines within the block
      while (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (nextLine === '') { i++; continue; }
        if (nextLine.startsWith('direction:')) {
          i++;
          const dir = nextLine.slice(10).trim();
          if (dir === 'horizontal') direction = 'horizontal';
          else if (dir === 'vertical') direction = 'vertical';
          else throw new Error(`${fileName}:${i + 1}: invalid direction "${dir}" (expected vertical, horizontal)`);
          continue;
        }
        if (nextLine.startsWith('columns:')) {
          i++;
          const n = parseInt(nextLine.slice(8).trim(), 10);
          if (isNaN(n) || n < 1 || n > 6) throw new Error(`${fileName}:${i + 1}: invalid columns "${nextLine.slice(8).trim()}" (expected 1–6)`);
          columns = n;
          continue;
        }
        if (nextLine.startsWith('column-gap:')) {
          i++;
          columnGap = nextLine.slice(11).trim();
          continue;
        }
        if (!nextLine.startsWith('|')) break;
        i++;
        const itemStr = nextLine.slice(1).trim();
        // Parse flow item syntax
        if (itemStr === 'photo' || itemStr.startsWith('photo ')) {
          const photoParts = itemStr.split(/\s+/);
          const align = photoParts[1] ?? 'center';
          const size = photoParts[2] ?? 'm';
          if (!['left', 'center', 'right'].includes(align)) throw new Error(`${fileName}:${i + 1}: invalid photo align "${align}" (expected left, center, right)`);
          if (!['s', 'm', 'l'].includes(size)) throw new Error(`${fileName}:${i + 1}: invalid photo size "${size}" (expected s, m, l)`);
          if (photoParts.length > 3) throw new Error(`${fileName}:${i + 1}: unexpected "${photoParts.slice(3).join(' ')}" after photo (expected: photo ALIGN [SIZE])`);
          if (flowItems.some(it => it.type === 'photo')) throw new Error(`${fileName}:${i + 1}: a flow has one photo at most`);
          flowItems.push({ type: 'photo', align: align as ParsedFlowPhoto['align'], size: size as ParsedFlowPhoto['size'] });
        } else if (itemStr === 'icon' || itemStr.startsWith('icon ')) {
          const iconParts = itemStr.split(/\s+/);
          const align = (iconParts[1] as 'left' | 'center' | 'right') ?? 'center';
          const size = (iconParts[2] as 's' | 'm' | 'l') ?? 'm';
          flowItems.push({ type: 'icon', align, size });
        } else if (itemStr.startsWith('spacer-')) {
          const size = itemStr.slice(7);
          flowItems.push({ type: 'spacer', size });
        } else if (itemStr.startsWith('divider-')) {
          const variant = itemStr.slice(8) as 'ruler' | 'hairline';
          flowItems.push({ type: 'divider', variant });
        } else {
          // Slot: "primary left [top|center|bottom] [columns:N] [gap:M]"
          const parts = itemStr.split(/\s+/);
          const slotId = parts[0];
          if (!checkSlotName(slotId, `${fileName}:${i + 1}`)) throw new Error(`${fileName}:${i + 1}: unknown slot "${slotId}" in flow block`);
          const align = (parts[1] as 'left' | 'center' | 'right') ?? 'left';
          const VALIGNS = ['top', 'center', 'bottom'];
          let vAlign: 'top' | 'center' | 'bottom' | undefined;
          let slotCols: number | undefined;
          let slotGap: string | undefined;
          for (let p = 2; p < parts.length; p++) {
            if (VALIGNS.includes(parts[p])) {
              vAlign = parts[p] as 'top' | 'center' | 'bottom';
            } else if (parts[p].startsWith('columns:')) {
              slotCols = parseInt(parts[p].slice(8), 10);
              if (isNaN(slotCols) || slotCols < 1 || slotCols > 6) throw new Error(`${fileName}:${i + 1}: invalid columns "${parts[p].slice(8)}"`);
            } else if (parts[p].startsWith('gap:')) {
              slotGap = parts[p].slice(4);
            }
          }
          flowItems.push({ type: 'slot', id: slotId as SlotId, textAlign: align, verticalAlign: vAlign, columns: slotCols, columnGap: slotGap });
        }
      }

      flow = { panel, split, ...(width !== undefined ? { width } : {}), direction, columns, columnGap, items: flowItems };
      continue;
    }

    // ── Removed: group syntax (migrated to flow mode) ────────────────────────

    if (line.startsWith('group:')) {
      throw new Error(`${fileName}:${lineNum}: "group:" syntax is removed — use "flow:" with "split" instead`);
    }

    // Ungrouped slot: "primary  row 3  cols 1--4  left" or "meta  bottom  cols 1--2  left bottom"
    // Alignment: one keyword = horizontal only (vertical defaults to top)
    //            two keywords = horizontal + vertical (e.g. "left bottom", "center center")
    const rowSlotMatch = line.match(/^([a-z][a-z0-9-]*)\s+(?:row\s+)?(\d+|top|center|bottom)\s+cols\s+(\S+)\s+(left|center|right)(?:\s+(top|center|bottom))?$/);
    if (rowSlotMatch) {
      const [, slotId, rowStr, colRange, hAlign, vAlign] = rowSlotMatch;
      checkSlotName(slotId, `${fileName}:${lineNum}`);
      noteForeign(lineNum, `slot line "${slotId}"`);
      // Keyword rows use negative sentinels (same convention as logo): top=-1, center=-2, bottom=-3
      const rowNum = rowStr === 'top' ? -1 : rowStr === 'center' ? -2 : rowStr === 'bottom' ? -3 : parseInt(rowStr, 10) - 1;
      const cols = parseColRange(colRange, fileName, lineNum, 12);
      slots.push({
        id: slotId as SlotId,
        row: rowNum,
        colStart: cols.start,
        colEnd: cols.end,
        textAlign: hAlign as 'left' | 'center' | 'right',
        ...(vAlign ? { verticalAlign: vAlign as 'top' | 'center' | 'bottom' } : {}),
      });
      continue;
    }

    // Unknown line
    throw new Error(`${fileName}:${lineNum}: unexpected "${line}"`);
  }

  // Backward compat: if no id: line but we have a first # line, use it as id
  if (!id) {
    if (firstHashText) {
      console.warn(`${fileName}: deprecated — add "id: ${firstHashText}" line (first # line used as fallback id)`);
      id = firstHashText;
    } else {
      throw new Error(`${fileName}: missing composition id (add "id:" line)`);
    }
  }

  // Derive display name if not provided
  if (!name) {
    name = id;
  }

  // Regions mode: inferred from the blocks when no mode line says otherwise
  if (regions.length && mode === null) mode = 'regions';
  if (mode === 'regions') {
    if (!regions.length) throw new Error(`${fileName}: "mode: regions" needs at least one "region" block`);
    if (foreign) throw new Error(`${fileName}:${(foreign as { line: number }).line}: ${(foreign as { what: string }).what} is not allowed in regions mode (a region places its slots itself)`);
    let next = 1;
    const numbered = regions.filter(r => Array.isArray(r.fields)), rests = regions.filter(r => r.fields === 'rest'), lines = regions.filter(r => r.fields === 'line');
    for (const r of regions) if (!fieldsSet.has(r)) throw new Error(`${fileName}:${regionLines.get(r)}: region "${r.id}" needs "fields:" (or "line:")`);
    if (lines.length === regions.length) throw new Error(`${fileName}:${regionLines.get(regions[0])}: a line stands on the edge of fields, at least one region needs "fields:"`);
    for (const r of lines) if (r.stack && 'field' in r.stack) throw new Error(`${fileName}:${stackLines.get(r)}: region "${r.id}" is a line, its stack has no field to stand on`);
    if (numbered.length && numbered.length < regions.length - lines.length) throw new Error(`${fileName}:${regionLines.get(regions.find(r => r.fields === 'content' || r.fields === 'rest')!)}: fields by number and "content"/"rest" don't mix in one composition`);
    if (!numbered.length && rests.length !== 1) throw new Error(`${fileName}:${regionLines.get(rests[1] ?? regions[0])}: a composition with "content" regions has one "rest" region, ${rests.length ? 'not two' : 'none here'}`);
    for (const r of regions) {
      const at = `${fileName}:${regionLines.get(r)}`;
      if (Array.isArray(r.fields)) {
        if (r.fields[0] !== next) throw new Error(`${at}: region "${r.id}" starts at field ${r.fields[0]}, expected ${next} (regions run top to bottom without gaps or overlap, from field 1)`);
        next = r.fields[1] + 1;
      }
      if (r.group && !r.stack) throw new Error(`${fileName}:${groupLines.get(r)}: region "${r.id}": "group:" needs "stack:"`);
      if (r.stack && !r.group) throw new Error(`${fileName}:${stackLines.get(r)}: region "${r.id}": "stack:" needs "group:"`);
      // A stack's field counts from the region's first
      if (r.stack && 'field' in r.stack && Array.isArray(r.fields) && r.stack.field > r.fields[1] - r.fields[0] + 1) {
        throw new Error(`${fileName}:${stackLines.get(r)}: region "${r.id}": stack field ${r.stack.field}, the region has ${r.fields[1] - r.fields[0] + 1} fields`);
      }
      if (r.stack && 'field' in r.stack && r.fields === 'content') throw new Error(`${fileName}:${stackLines.get(r)}: region "${r.id}": a "content" region is as tall as what it holds, its stack stands on its neighbour ("stack: neighbour")`);
    }
  } else if (regions.length) {
    throw new Error(`${fileName}:${regionLines.get(regions[0])}: "region" needs "mode: regions"`);
  }

  // Validate required fields
  if (flow?.items.some(it => it.type === 'photo')) {
    // The flow photo is the page's image: there is no background photo
    if (imageExplicit) throw new Error(`${fileName}: "image:" and a "| photo" flow item can't be combined (the flow photo is the page's image)`);
    if (flow.panel || flow.split) throw new Error(`${fileName}: "| photo" is only allowed in a plain "flow:" (not in a panel or split)`);
  }
  if (!image) image = 'full'; // default to full-bleed image
  if (mode !== 'regions' && !logo && !logoNone && !sticky.length) throw new Error(`${fileName}: missing "logo:" line (or use sticky: block)`);
  return { id, name, description, mode, image, imageExplicit, logo, logoNone: logoNone || undefined, icon, slots, sticky, flow, illustration, ...(mode === 'regions' ? { regions } : {}) };
}
