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
