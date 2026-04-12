/**
 * Parser for .format canvas format definition files.
 *
 * Strict, line-based format. Every line must match a known pattern or be blank.
 * Throws on parse errors with file name and line number.
 *
 * Units:
 *   - screen: size in px, zone values in px
 *   - print/signage: size in mm (px computed via dpi), zone values in mm (converted to px)
 */

import type { ZoneInsets } from './types';

// ── Parsed types ───────────────────────────────────────────────────────────────

export interface ParsedFormat {
  id: string;
  /** Optional display name (from `name:` key). Falls back to label if not set. */
  name?: string;
  label: string;
  sublabel: string;
  category: 'instagram' | 'linkedin' | 'print' | 'signage';
  // Pixel dimensions (always present — computed from mm+dpi for print/signage)
  widthPx: number;
  heightPx: number;
  // Physical dimensions (print/signage only)
  widthMm?: number;
  heightMm?: number;
  dpi?: number;
  bleedMm?: number;
  // Optional grid override — absent means auto portrait/landscape selection
  grid?: { rows: number; cols: number };
  // Zones — always stored in px (mm values converted during parse)
  danger: ZoneInsets;
  gridCrop: ZoneInsets | null;
  comfort: number;      // px (0 if comfortMm is used)
  comfortMm?: number;   // mm (print/signage)
  /** Capability restrictions from the `no:` field (e.g. ['motion', 'video', 'photo']). */
  restrictions?: string[];
  /** Allowed purpose IDs from the `purposes:` field. Absent = all purposes allowed. */
  purposes?: string[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const ZONE_NONE: ZoneInsets = { top: 0, bottom: 0, left: 0, right: 0 };

function parsePositiveInt(s: string, fileName: string, lineNum: number, field: string): number {
  const n = parseInt(s, 10);
  if (isNaN(n) || n < 0) throw new Error(`${fileName}:${lineNum}: ${field} must be a non-negative integer, got "${s}"`);
  return n;
}

/** Parse inset shorthand into ZoneInsets (CSS-style):
 *  1 value: all sides equal
 *  2 values: top/bottom = v[0], left/right = v[1]
 *  4 values: top right bottom left */
function parseInsets(parts: string[], fileName: string, lineNum: number, field: string): ZoneInsets {
  if (parts.length === 1) {
    const v = parsePositiveInt(parts[0], fileName, lineNum, field);
    return { top: v, right: v, bottom: v, left: v };
  }
  if (parts.length === 2) {
    const v = parsePositiveInt(parts[0], fileName, lineNum, `${field} top/bottom`);
    const h = parsePositiveInt(parts[1], fileName, lineNum, `${field} left/right`);
    return { top: v, right: h, bottom: v, left: h };
  }
  if (parts.length === 4) {
    return {
      top:    parsePositiveInt(parts[0], fileName, lineNum, `${field} top`),
      right:  parsePositiveInt(parts[1], fileName, lineNum, `${field} right`),
      bottom: parsePositiveInt(parts[2], fileName, lineNum, `${field} bottom`),
      left:   parsePositiveInt(parts[3], fileName, lineNum, `${field} left`),
    };
  }
  throw new Error(`${fileName}:${lineNum}: ${field} requires 1, 2, or 4 values (got ${parts.length})`);
}

function mmToPx(mm: number, dpi: number): number {
  return Math.round(mm * dpi / 25.4);
}

function scaleInsets(insets: ZoneInsets, factor: number): ZoneInsets {
  return {
    top:    Math.round(insets.top    * factor),
    right:  Math.round(insets.right  * factor),
    bottom: Math.round(insets.bottom * factor),
    left:   Math.round(insets.left   * factor),
  };
}

// ── Main parser ────────────────────────────────────────────────────────────────

export function parseFormatFile(content: string, fileName: string): ParsedFormat {
  const lines = content.split('\n');

  let id: string | undefined;
  let name: string | undefined;
  let label: string | undefined;
  let sublabel: string | undefined;
  let category: ParsedFormat['category'] | undefined;
  let widthPx: number | undefined;
  let heightPx: number | undefined;
  let widthMm: number | undefined;
  let heightMm: number | undefined;
  let dpi: number | undefined;
  let bleedMm: number | undefined;
  let grid: ParsedFormat['grid'] | undefined;
  let danger: ZoneInsets = ZONE_NONE;
  let gridCrop: ZoneInsets | null = null;
  let comfortRaw: number | undefined;   // px for screen, mm for print/signage
  let comfortIsMm = false;
  let restrictions: string[] | undefined;
  let purposes: string[] | undefined;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i].trim();

    // Blank lines and comments
    if (!line || line.startsWith('#')) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) throw new Error(`${fileName}:${lineNum}: expected "key: value", got "${line}"`);

    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();

    switch (key) {
      case 'id':
        id = value;
        break;

      case 'name':
        name = value;
        break;

      case 'label':
        label = value;
        break;

      case 'sublabel':
        sublabel = value;
        break;

      case 'category':
        if (value !== 'instagram' && value !== 'linkedin' && value !== 'print' && value !== 'signage')
          throw new Error(`${fileName}:${lineNum}: category must be instagram, linkedin, print, or signage, got "${value}"`);
        category = value;
        break;

      case 'size': {
        // "1080 1350" (px) or "594mm 297mm" (mm)
        const parts = value.split(/\s+/);
        if (parts.length !== 2) throw new Error(`${fileName}:${lineNum}: size requires 2 values, got "${value}"`);
        const isMm = parts[0].endsWith('mm');
        if (isMm) {
          widthMm = parseFloat(parts[0]);
          heightMm = parseFloat(parts[1]);
          if (isNaN(widthMm) || isNaN(heightMm) || widthMm <= 0 || heightMm <= 0)
            throw new Error(`${fileName}:${lineNum}: invalid mm dimensions "${value}"`);
          // px computed after dpi is parsed; set flag for now
        } else {
          widthPx = parsePositiveInt(parts[0], fileName, lineNum, 'width');
          heightPx = parsePositiveInt(parts[1], fileName, lineNum, 'height');
          if (widthPx <= 0 || heightPx <= 0)
            throw new Error(`${fileName}:${lineNum}: size values must be positive`);
        }
        break;
      }

      case 'dpi':
        dpi = parseInt(value, 10);
        if (isNaN(dpi) || dpi <= 0) throw new Error(`${fileName}:${lineNum}: dpi must be a positive integer, got "${value}"`);
        break;

      case 'bleed': {
        const raw = value.endsWith('mm') ? parseFloat(value) : parseFloat(value);
        if (isNaN(raw) || raw < 0) throw new Error(`${fileName}:${lineNum}: bleed must be a non-negative number, got "${value}"`);
        bleedMm = raw;
        break;
      }

      case 'grid': {
        const parts = value.split(/\s+/);
        if (parts.length !== 2) throw new Error(`${fileName}:${lineNum}: grid requires "rows cols", got "${value}"`);
        const rows = parseInt(parts[0], 10);
        const cols  = parseInt(parts[1], 10);
        if (isNaN(rows) || rows < 1 || isNaN(cols) || cols < 1)
          throw new Error(`${fileName}:${lineNum}: grid rows and cols must be positive integers`);
        grid = { rows, cols };
        break;
      }

      case 'danger': {
        const parts = value.split(/\s+/);
        danger = parseInsets(parts, fileName, lineNum, 'danger');
        break;
      }

      case 'crop': {
        if (value === 'none') {
          gridCrop = null;
        } else {
          const parts = value.split(/\s+/);
          gridCrop = parseInsets(parts, fileName, lineNum, 'crop');
        }
        break;
      }

      case 'comfort': {
        const isMm = value.endsWith('mm');
        comfortIsMm = isMm;
        comfortRaw = isMm ? parseFloat(value) : parseFloat(value);
        if (isNaN(comfortRaw) || comfortRaw < 0)
          throw new Error(`${fileName}:${lineNum}: comfort must be a non-negative number, got "${value}"`);
        break;
      }

      case 'no': {
        restrictions = value.split(/\s+/).filter(Boolean);
        break;
      }

      case 'purposes': {
        purposes = value.split(/[\s,]+/).filter(Boolean);
        break;
      }

      default:
        throw new Error(`${fileName}:${lineNum}: unknown key "${key}"`);
    }
  }

  // ── Validation ───────────────────────────────────────────────────────────────
  if (!id)       throw new Error(`${fileName}: missing required field "id"`);
  if (!label)    throw new Error(`${fileName}: missing required field "label"`);
  if (!sublabel) throw new Error(`${fileName}: missing required field "sublabel"`);
  if (!category) throw new Error(`${fileName}: missing required field "category"`);

  // ── Resolve px dimensions for mm-based formats ───────────────────────────────
  const effectiveDpi = dpi ?? 300;
  if (widthMm !== undefined && heightMm !== undefined) {
    const pxPerMm = effectiveDpi / 25.4;
    const bleed = bleedMm ?? 0;
    widthPx  = Math.round((widthMm  + 2 * bleed) * pxPerMm);
    heightPx = Math.round((heightMm + 2 * bleed) * pxPerMm);
  }

  if (widthPx === undefined || heightPx === undefined)
    throw new Error(`${fileName}: missing required field "size"`);

  // ── Convert zone insets from mm to px for physical formats ──────────────────────
  if (category === 'print' || category === 'signage') {
    const pxPerMm = effectiveDpi / 25.4;
    danger  = scaleInsets(danger, pxPerMm);
    if (gridCrop) gridCrop = scaleInsets(gridCrop, pxPerMm);
  }

  // ── Resolve comfort ──────────────────────────────────────────────────────────
  let comfort = 0;
  let comfortMm: number | undefined;
  if (comfortRaw !== undefined) {
    if (comfortIsMm || category === 'print' || category === 'signage') {
      comfortMm = comfortRaw;
    } else {
      comfort = Math.round(comfortRaw);
    }
  }

  return {
    id, name, label, sublabel, category,
    widthPx, heightPx,
    widthMm, heightMm,
    dpi: dpi ?? (category === 'print' || category === 'signage' ? effectiveDpi : undefined),
    bleedMm,
    grid,
    danger, gridCrop,
    comfort, comfortMm,
    restrictions,
    purposes,
  };
}
