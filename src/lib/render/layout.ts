/**
 * Pure text-layout helpers shared by all renderers.
 *
 * These functions take a `MeasureFn` (usually a bound
 * `ctx.measureText(t).width`) instead of a canvas context, so the whole
 * layout pipeline is testable without a DOM.
 */

export type MeasureFn = (text: string) => number;

/** Characters that may end a line in a wrap (word boundary or CJK). */
function tokenize(text: string): string[] {
  // Split into words keeping trailing whitespace out; CJK text has no spaces
  // and will arrive as one long token, handled by splitLongToken below.
  return text.split(/\s+/).filter((w) => w.length > 0);
}

/** Split a token that is wider than maxWidth into max-width chunks. */
function splitLongToken(measure: MeasureFn, token: string, maxWidth: number): string[] {
  const parts: string[] = [];
  let current = '';
  for (const char of token) {
    if (measure(current + char) > maxWidth && current.length > 0) {
      parts.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  if (current) parts.push(current);
  return parts;
}

/** Word-wrap a single paragraph; falls back to char-splitting long tokens. */
export function wrapParagraph(
  measure: MeasureFn,
  paragraph: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let line = '';

  for (const token of tokenize(paragraph)) {
    const tokens =
      measure(token) > maxWidth ? splitLongToken(measure, token, maxWidth) : [token];

    for (const piece of tokens) {
      const candidate = line ? `${line} ${piece}` : piece;
      if (line && measure(candidate) > maxWidth) {
        lines.push(line);
        line = piece;
      } else {
        line = candidate;
      }
    }
  }

  if (line) lines.push(line);
  return lines.length > 0 ? lines : [''];
}

/**
 * Wrap a whole document body. Paragraphs are separated by newlines;
 * empty paragraphs become empty strings in the output (vertical space).
 */
export function wrapText(
  measure: MeasureFn,
  body: string,
  maxWidth: number,
): string[] {
  const paragraphs = body.split('\n');
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    if (paragraph.trim() === '') {
      lines.push('');
    } else {
      lines.push(...wrapParagraph(measure, paragraph, maxWidth));
    }
  }
  return lines;
}

export interface FitResult {
  fontSize: number;
  lines: string[];
}

/**
 * Shrink a font size (from `startSize` down to `minSize`) until the wrapped
 * text fits within `maxHeight`. `setFont` must apply the size to whatever
 * measurement context `measure` uses.
 */
export function fitFontSize(
  setFont: (px: number) => void,
  measure: MeasureFn,
  text: string,
  maxWidth: number,
  maxHeight: number,
  startSize: number,
  minSize: number,
  lineHeight = 1.4,
): FitResult {
  // Binary search: wrapped line count shrinks monotonically as size grows.
  let lo = minSize;
  let hi = startSize;
  let best = minSize;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    setFont(mid);
    const lines = wrapText(measure, text, maxWidth);
    if (lines.length * mid * lineHeight <= maxHeight) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  setFont(best);
  return { fontSize: best, lines: wrapText(measure, text, maxWidth) };
}

/** Truncate text to `maxWidth`, appending an ellipsis when it had to shrink. */
export function truncateToWidth(
  measure: MeasureFn,
  text: string,
  maxWidth: number,
): string {
  if (measure(text) <= maxWidth) return text;
  const ellipsis = '…';
  let out = text;
  while (out.length > 0 && measure(out + ellipsis) > maxWidth) {
    out = out.slice(0, -1);
  }
  return out + ellipsis;
}

/** Fill a canvas background, honoring an optional vertical gradient. */
export function fillBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  color: string,
  gradientTo?: string,
): void {
  if (gradientTo) {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, gradientTo);
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = color;
  }
  ctx.fillRect(0, 0, width, height);
}
