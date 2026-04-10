/**
 * Parser for .composition definition files.
 *
 * Strict, line-based format. Every line must match a known pattern or be blank.
 * Throws on parse errors with file name and line number.
 *
 * Row names: row 1 = index 0, row 2 = index 1, ..., row 6 = index 5 (1-based in files, 0-based in output)
 * Column names: 1=0, 2=1, 3=2, 4=3, 5=4, 6=5 (1-based in files, 0-based in output)
 */

import type { SlotId } from './types';

// ── Parsed types ──────────────────────────────────────────────────────────────

/** Grid Y keyword — resolved to actual % at layout time using buildGrid(). */
export type GridYKeyword = 'top' | 'center' | 'bottom';

export interface ParsedImageRegion {
  yStart: GridYKeyword;
  yEnd: GridYKeyword;
  colStart?: number;  // 0-based column (undefined = full width)
  colEnd?: number;    // 0-based column (undefined = full width)
}

export interface ParsedComposition {
  /** Programmatic ID (from `id:` line, or fallback from first `#` line). */
  id: string;
  /** Human-readable display name (from `name:` line, or falls back to id). */
  name: string;
  description: string;
  /** Explicit layout mode. 'flow' | 'compose' | null (inferred from structure). */
  mode: 'flow' | 'compose' | null;
  image: 'full' | 'none' | ParsedImageRegion;
  /** Whether `image:` was explicitly written (vs. defaulted to 'full'). */
  imageExplicit: boolean;
  logo: { row: number | GridYKeyword; col: 'left' | 'center' | 'right'; size?: 's' | 'm' | 'l' } | null;
  /** When true, the layout explicitly disallows logos (`logo: none` in .layout). */
  logoNone?: boolean;
  /** Icon slot placement (optional). */
  icon?: { row: number | GridYKeyword; col: 'left' | 'center' | 'right'; size?: 's' | 'm' | 'l' };
  /** Ungrouped slots (empty if composition uses a group or flow). */
  slots: ParsedSlot[];
  /** Grouped layout — legacy syntax (null if composition uses ungrouped slots or flow:). */
  group: ParsedGroup | null;
  /** Sticky regions — composed repetition areas (logo, label). */
  sticky: ParsedStickyRegion[];
  /** Flow regions — content-driven flow areas. */
  flow: ParsedFlowRegion | null;
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
  };
  /** Split: text occupies a fraction from one edge, image fills the rest. */
  split?: {
    edge: 'top' | 'bottom' | 'left' | 'right';
    fraction: number;  // e.g. 0.5 = half, 0.333 = one third
  };
  /** Flow direction (default: vertical). */
  direction: 'vertical' | 'horizontal';
  /** Number of text columns (default: 1). */
  columns?: number;
  /** Gap between columns — spacing token name (default: 'm'). */
  columnGap?: string;
  /** Flow items (same as group items). */
  items: ParsedGroupItem[];
}

export interface ParsedSlot {
  id: SlotId;
  row: number;
  colStart: number;
  colEnd: number;
  textAlign: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'center' | 'bottom';
}

export interface ParsedStandardGroup {
  kind: 'standard';
  yStart: GridYKeyword;
  yEnd: GridYKeyword;
  items: ParsedGroupItem[];
}

export interface ParsedPanelGroup {
  kind: 'panel';
  vPosition: 'top' | 'center' | 'bottom';
  hPosition: 'left' | 'center' | 'right';
  /** Width as fraction of card (default 2/3). */
  widthFraction: number;
  /** Height as fraction of card (default 2/3). */
  heightFraction: number;
  items: ParsedGroupItem[];
}

export type ParsedGroup = ParsedStandardGroup | ParsedPanelGroup;

export interface ParsedFlowIcon {
  type: 'icon';
  align: 'left' | 'center' | 'right';
  /** Size token (s/m/l). Default: 'm'. */
  size: 's' | 'm' | 'l';
}

export type ParsedGroupItem = ParsedGroupSlot | ParsedSpacer | ParsedDivider | ParsedFlowIcon;

export interface ParsedGroupSlot {
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

/** Backward-compat map: band letters A-F → 0-based row indices */
const LEGACY_BAND_MAP: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5 };
const GRID_Y_KEYWORDS = new Set<string>(['top', 'center', 'bottom']);

const VALID_SLOTS = new Set<string>(['primary', 'secondary', 'detail', 'meta', 'cta', 'label']);
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
  let mode: 'flow' | 'compose' | null = null;
  let image: ParsedComposition['image'] | null = null;
  let imageExplicit = false;
  let logo: ParsedComposition['logo'] = null;
  let logoNone = false;
  let icon: ParsedComposition['icon'] | undefined = undefined;
  const slots: ParsedSlot[] = [];
  let group: ParsedGroup | null = null; // deprecated — kept for type compat only
  const sticky: ParsedStickyRegion[] = [];
  let flow: ParsedFlowRegion | null = null;

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
    const line = raw.trim();

    // Blank line
    if (line === '') continue;

    // Comment — ALL # lines go to description now
    if (line.startsWith('#')) {
      const text = line.slice(1).trim();
      if (!firstHashText) firstHashText = text;
      description = description ? `${description} ${text}` : text;
      continue;
    }

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

    // mode: flow | compose
    if (line.startsWith('mode:')) {
      const value = line.slice(5).trim();
      if (value !== 'flow' && value !== 'compose') {
        throw new Error(`${fileName}:${lineNum}: invalid mode "${value}" (expected "flow" or "compose")`);
      }
      mode = value;
      continue;
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

    // grid: is no longer used in layout files (format owns the grid). Silently skip.
    if (line.startsWith('grid:')) {
      console.warn(`${fileName}:${lineNum}: "grid:" in layout files is no longer needed — format defines the grid`);
      continue;
    }

    // Logo: "logo: row N X [size]" or "logo: top/center/bottom X [size]"
    // col: left | center | right
    // size: s | m | l (optional, defaults to m)
    if (line.startsWith('logo:')) {
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
      // Backward compat: "logo: band A [col] X"
      const bandMatch = line.match(/^logo:\s+band\s+([A-F])\s+(?:col\s+)?(left|center|right)(?:\s+(s|m|l))?\s*$/);
      if (bandMatch) {
        const row = LEGACY_BAND_MAP[bandMatch[1]];
        if (row === undefined) throw new Error(`${fileName}:${lineNum}: unknown band "${bandMatch[1]}"`);
        console.warn(`${fileName}:${lineNum}: deprecated "band ${bandMatch[1]}" syntax — use "row ${row + 1}" instead`);
        const col = resolveColKeyword(bandMatch[2], fileName, lineNum);
        logo = { row, col, size: (bandMatch[3] as 's' | 'm' | 'l') ?? undefined };
        continue;
      }
      throw new Error(`${fileName}:${lineNum}: invalid logo line "${line}" (expected "logo: row N left|center|right" or "logo: top/center/bottom left|center|right")`);
    }

    // Icon: "icon: top X [s|m|l]" or "icon: row N X [s|m|l]"
    if (line.startsWith('icon:')) {
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
      const bandMatch = line.match(/^icon:\s+band\s+([A-F])\s+(?:col\s+)?(left|center|right)(?:\s+(s|m|l))?\s*$/);
      if (bandMatch) {
        const row = LEGACY_BAND_MAP[bandMatch[1]];
        if (row === undefined) throw new Error(`${fileName}:${lineNum}: unknown band "${bandMatch[1]}"`);
        console.warn(`${fileName}:${lineNum}: deprecated "band ${bandMatch[1]}" syntax — use "row ${row + 1}" instead`);
        const col = resolveColKeyword(bandMatch[2], fileName, lineNum);
        icon = { row, col, size: (bandMatch[3] as 's' | 'm' | 'l') ?? undefined };
        continue;
      }
      throw new Error(`${fileName}:${lineNum}: invalid icon line "${line}"`);
    }

    // ── New flow DSL: sticky: and flow: blocks ────────────────────────────────

    // Sticky region: "sticky: top [s|m|l]" — size token optional, defaults to 'm'
    if (line.startsWith('sticky:')) {
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
        } else if (VALID_SLOTS.has(parts[0])) {
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
      const value = line.slice(5).trim();
      let panel: ParsedFlowRegion['panel'] = undefined;
      let direction: 'vertical' | 'horizontal' = 'vertical';
      let columns: number | undefined;
      let columnGap: string | undefined;

      let split: ParsedFlowRegion['split'] = undefined;

      if (value.startsWith('panel')) {
        // Parse: "panel <position> [<width>] [<height>]"
        const parts = value.split(/\s+/);
        const pos = parts[1] ?? 'bottom-left';
        const wFrac = parts[2] ? parseFraction(parts[2], `${fileName}:${lineNum}`) : 2 / 3;
        const hFrac = parts[3] ? parseFraction(parts[3], `${fileName}:${lineNum}`) : wFrac;
        panel = { position: pos, widthFraction: wFrac, heightFraction: hFrac };
      } else if (value.startsWith('split')) {
        // Parse: "split <edge> [<fraction>]"  — e.g. "split bottom 1/2"
        const parts = value.split(/\s+/);
        const edge = parts[1] as 'top' | 'bottom' | 'left' | 'right';
        if (!['top', 'bottom', 'left', 'right'].includes(edge)) {
          throw new Error(`${fileName}:${lineNum}: invalid split edge "${edge}" — expected top, bottom, left, right`);
        }
        const fraction = parts[2] ? parseFraction(parts[2], `${fileName}:${lineNum}`) : 0.5;
        split = { edge, fraction };
      }

      const flowItems: ParsedGroupItem[] = [];
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
        // Parse same item syntax as group items
        if (itemStr.startsWith('icon')) {
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
          if (!VALID_SLOTS.has(slotId)) throw new Error(`${fileName}:${i + 1}: unknown slot "${slotId}" in flow block`);
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

      flow = { panel, split, direction, columns, columnGap, items: flowItems };
      continue;
    }

    // ── Removed: group syntax (migrated to flow mode) ────────────────────────

    if (line.startsWith('group:')) {
      throw new Error(`${fileName}:${lineNum}: "group:" syntax is removed — use "flow:" with "split" instead`);
    }

    // Ungrouped slot: "primary  row 3  cols 1--4  left" or "meta  bottom  cols 1--2  left bottom"
    // Alignment: one keyword = horizontal only (vertical defaults to top)
    //            two keywords = horizontal + vertical (e.g. "left bottom", "center center")
    const rowSlotMatch = line.match(/^(\w+)\s+(?:row\s+)?(\d+|top|center|bottom)\s+cols\s+(\S+)\s+(left|center|right)(?:\s+(top|center|bottom))?$/);
    if (rowSlotMatch) {
      const [, slotId, rowStr, colRange, hAlign, vAlign] = rowSlotMatch;
      if (!VALID_SLOTS.has(slotId)) throw new Error(`${fileName}:${lineNum}: unknown slot "${slotId}"`);
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

    // Backward compat: "primary  band D  cols 1--4  left"
    const bandSlotMatch = line.match(/^(\w+)\s+band\s+([A-F])\s+cols\s+(\S+)\s+(left|center|right)$/);
    if (bandSlotMatch) {
      const [, slotId, bandLetter, colRange, align] = bandSlotMatch;
      if (!VALID_SLOTS.has(slotId)) throw new Error(`${fileName}:${lineNum}: unknown slot "${slotId}"`);
      const row = LEGACY_BAND_MAP[bandLetter];
      if (row === undefined) throw new Error(`${fileName}:${lineNum}: unknown band "${bandLetter}"`);
      console.warn(`${fileName}:${lineNum}: deprecated "band ${bandLetter}" syntax — use "row ${row + 1}" instead`);
      const cols = parseColRange(colRange, fileName, lineNum, 12);
      slots.push({
        id: slotId as SlotId,
        row,
        colStart: cols.start,
        colEnd: cols.end,
        textAlign: align as 'left' | 'center' | 'right',
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

  // Validate required fields
  if (!image) image = 'full'; // default to full-bleed image
  if (!logo && !logoNone && !sticky.length) throw new Error(`${fileName}: missing "logo:" line (or use sticky: block)`);
  return { id, name, description, mode, image, imageExplicit, logo, logoNone: logoNone || undefined, icon, slots, group, sticky, flow };
}
