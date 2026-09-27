import { fitFontSize, wrapText, type MeasureFn } from '../layout';
import type { RenderDocument, RenderOptions } from '../types';

/**
 * Pure mapping from RenderDocument to the AntV Infographic DSL.
 *
 * The DSL is line-based with no quoting or escaping mechanism: each
 * `key value` line carries its value verbatim to end-of-line, and `#`/`//`
 * start comments only at the beginning of a line. Every user string is
 * therefore normalized to a single whitespace-collapsed line before being
 * embedded, which makes DSL breakout structurally impossible.
 *
 * Field mapping:
 *   title       → item datum `label` (rendered as `item-label`, accent)
 *   body        → item datum `desc`  (one undivided wrapping block —
 *                                  never paragraph-split or itemized)
 *   attribution → item datum `value` (source line, muted color)
 */

/** Font stack shared by measurement, preview and PNG export. */
export const INFOGRAPHIC_FONT_FAMILY =
  "'Noto Sans JP', 'Inter Variable', system-ui, sans-serif";

/** Hard cap on input length before fitting is even attempted. */
export const MAX_TITLE_CHARS = 200;
export const MAX_BODY_CHARS = 2000;
export const MAX_ATTRIBUTION_CHARS = 200;

export type InfographicAlign = 'left' | 'center';
export type InfographicVAlign = 'top' | 'center';

/**
 * Escape a user string for a DSL value position. The grammar has no
 * quoting, so all whitespace (including newlines and tabs) collapses to
 * single spaces — a value can never span a second line and therefore can
 * never forge new DSL structure.
 */
export function sanitizeDslValue(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Conservative width estimate for `text` at `fontSize`, biased high: all
 * non-ASCII glyphs (CJK, emoji, accented Latin) count as a full em and
 * ASCII glyphs wider than usual, so the pure fitting pass never picks a
 * font size that overflows when the real renderer wraps the text.
 */
export function estimatedWidth(text: string, fontSize: number): number {
  let width = 0;
  for (const ch of text) {
    width += ch.charCodeAt(0) > 0x7f ? fontSize : fontSize * 0.62;
  }
  return width;
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

export const LINE_HEIGHTS = {
  title: 1.3,
  body: 1.65,
  attribution: 1.4,
} as const;

function estimateMeasure(fontSize: number): MeasureFn {
  return (text) => estimatedWidth(text, fontSize);
}

/**
 * Estimated rendered height of `text` wrapped at `width` for the given
 * font metrics, using the conservative estimator.
 */
export function estimateBlockHeight(
  text: string,
  width: number,
  fontSize: number,
  lineHeight: number,
): number {
  if (!text) return 0;
  const lines = wrapText(estimateMeasure(fontSize), text, width);
  return lines.length * fontSize * lineHeight;
}

/**
 * Largest font size in `[min, start]` whose estimated wrapped height fits
 * `maxHeight` (binary search over the estimator — same contract as
 * `fitFontSize` but without a caller-provided measure context).
 */
function fitEstimated(
  text: string,
  maxWidth: number,
  maxHeight: number,
  start: number,
  min: number,
  lineHeight: number,
): number {
  let size = start;
  return fitFontSize(
    (px) => {
      size = px;
    },
    (t) => estimatedWidth(t, size),
    text,
    maxWidth,
    maxHeight,
    start,
    min,
    lineHeight,
  ).fontSize;
}

/** Truncate `text` to `maxChars`, preferring a word boundary + ellipsis. */
function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  const trimmed = lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${trimmed.trimEnd()}…`;
}

interface DslItem {
  /** DSL field name on the item datum (label | desc | value). */
  field: 'label' | 'desc' | 'value';
  text: string;
  fontSize: number;
  fontWeight?: number;
  lineHeight: number;
  /** Height budget; the item component shrinks the font if exceeded. */
  maxHeight: number;
}

export interface InfographicBuild {
  /** Complete DSL source, ready for `Infographic.render(dsl)`. */
  dsl: string;
  /** User-facing warnings (e.g. truncated body). Empty when none. */
  warnings: string[];
}

/**
 * Build the AntV Infographic DSL for a document + render options.
 *
 * Pure: no DOM access and no I/O, so it is fully unit-testable. Font
 * fitting uses the conservative estimator above; the item component
 * re-measures with real DOM metrics at render time and shrinks the font
 * further if the estimate was optimistic.
 */
export function buildInfographicDsl(
  doc: RenderDocument,
  options: RenderOptions,
): InfographicBuild {
  const { width, height } = options.size;
  const theme = options.theme;
  const align: InfographicAlign =
    options.values.align === 'left' ? 'left' : 'center';
  const justify = options.values.valign === 'top' ? 'flex-start' : 'center';

  const warnings: string[] = [];
  const minSide = Math.min(width, height);
  const padding = Math.round(minSide * 0.09);
  const contentWidth = width - padding * 2;
  const contentHeight = height - padding * 2;
  const gap = Math.round(minSide * 0.035);

  const title = truncate(sanitizeDslValue(doc.title), MAX_TITLE_CHARS);
  const attribution = truncate(
    sanitizeDslValue(doc.attribution),
    MAX_ATTRIBUTION_CHARS,
  );
  let body = sanitizeDslValue(doc.body);
  if (body.length > MAX_BODY_CHARS) {
    body = truncate(body, MAX_BODY_CHARS);
    warnings.push('本文が長すぎるため、末尾を省略しました');
  }

  const titleBase = clamp(Math.round(height * 0.05), 30, 120);
  const attributionFontSize = clamp(Math.round(height * 0.024), 16, 44);
  const bodyStart = clamp(Math.round(height * 0.042), 24, 72);
  const bodyMin = 18;

  const items: DslItem[] = [];

  let titleHeight = 0;
  if (title) {
    const maxTitleHeight = Math.round(height * 0.22);
    const titleFontSize = fitEstimated(
      title,
      contentWidth,
      maxTitleHeight,
      titleBase,
      24,
      LINE_HEIGHTS.title,
    );
    titleHeight = estimateBlockHeight(
      title,
      contentWidth,
      titleFontSize,
      LINE_HEIGHTS.title,
    );
    items.push({
      field: 'label',
      text: title,
      fontSize: titleFontSize,
      fontWeight: 700,
      lineHeight: LINE_HEIGHTS.title,
      maxHeight: maxTitleHeight,
    });
  }

  const attributionHeight = attribution
    ? estimateBlockHeight(
        attribution,
        contentWidth,
        attributionFontSize,
        LINE_HEIGHTS.attribution,
      )
    : 0;

  const bodyAvailable =
    contentHeight -
    (title ? titleHeight + gap : 0) -
    (attribution ? attributionHeight + gap : 0);

  if (body) {
    const bodyFontSize = fitEstimated(
      body,
      contentWidth,
      bodyAvailable,
      bodyStart,
      bodyMin,
      LINE_HEIGHTS.body,
    );
    // The estimator is conservative but approximate — if even the
    // minimum size cannot fit, drop characters until the block does.
    if (
      bodyFontSize === bodyMin &&
      estimateBlockHeight(body, contentWidth, bodyFontSize, LINE_HEIGHTS.body) >
        bodyAvailable
    ) {
      let lo = 0;
      let hi = body.length;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        const candidate = truncate(body, mid);
        if (
          estimateBlockHeight(
            candidate,
            contentWidth,
            bodyFontSize,
            LINE_HEIGHTS.body,
          ) <= bodyAvailable
        ) {
          lo = mid;
        } else {
          hi = mid - 1;
        }
      }
      body = truncate(body, lo);
      if (!warnings.length) {
        warnings.push('本文が長すぎるため、末尾を省略しました');
      }
    }
    items.push({
      field: 'desc',
      text: body,
      fontSize: bodyFontSize,
      lineHeight: LINE_HEIGHTS.body,
      maxHeight: Math.max(bodyAvailable, bodyMin * LINE_HEIGHTS.body),
    });
  }

  if (attribution) {
    items.push({
      field: 'value',
      text: attribution,
      fontSize: attributionFontSize,
      lineHeight: LINE_HEIGHTS.attribution,
      maxHeight: Math.max(
        attributionHeight,
        attributionFontSize * LINE_HEIGHTS.attribution,
      ),
    });
  }

  if (items.length === 0) {
    // The renderer requires at least one datum; an invisible placeholder
    // (zero-width space) keeps the DSL valid for an empty document.
    items.push({
      field: 'desc',
      text: '​',
      fontSize: bodyMin,
      lineHeight: LINE_HEIGHTS.body,
      maxHeight: contentHeight,
    });
  }

  const lines: string[] = [
    'infographic ti-card',
    'data',
    '  items',
    ...items.map((item) => `    - ${item.field} ${item.text}`),
    'theme',
    `  colorBg ${theme.background}`,
    `  colorPrimary ${theme.accent}`,
    `  palette ${theme.accent}`,
    '  base',
    '    text',
    `      font-family ${INFOGRAPHIC_FONT_FAMILY}`,
    `      fill ${theme.foreground}`,
    '  item',
    '    label',
    `      fill ${theme.accent}`,
    '    desc',
    `      fill ${theme.foreground}`,
    '    value',
    `      fill ${theme.muted}`,
    'design',
    '  structure',
    '    type ti-stack',
    `    x ${padding}`,
    `    y ${padding}`,
    `    width ${contentWidth}`,
    `    height ${contentHeight}`,
    `    gap ${gap}`,
    `    justify ${justify}`,
    '  items',
    ...items.flatMap((item) => [
      '    - ti-text',
      `      slot ${item.field}`,
      `      fontSize ${item.fontSize}`,
      `      lineHeight ${item.lineHeight}`,
      `      align ${align}`,
      `      maxHeight ${Math.round(item.maxHeight)}`,
      ...(item.fontWeight ? [`      fontWeight ${item.fontWeight}`] : []),
    ]),
    `width ${width}`,
    `height ${height}`,
  ];

  return { dsl: lines.join('\n'), warnings };
}

/** Warnings for the current inputs, without building the DSL output. */
export function infographicWarnings(
  doc: RenderDocument,
  options: RenderOptions,
): string[] {
  return buildInfographicDsl(doc, options).warnings;
}
