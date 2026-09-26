import { fillBackground, wrapText, type MeasureFn } from '../layout';
import { FONT_STACK } from '../themes';
import type { DocumentRenderer } from '../types';

/**
 * OGP/share image: fixed 1200×630, left-aligned title and excerpt.
 * Suitable for link previews and article headers.
 */
export const ogpRenderer: DocumentRenderer = {
  id: 'ogp',
  name: 'OGP / シェア画像',
  description: '1200×630 のリンクプレビュー形式',
  sizes: [{ id: 'ogp', label: 'OGP (1200×630)', width: 1200, height: 630 }],
  optionFields: [],
  render(ctx, doc, { size, theme }) {
    const { width, height } = size;
    const padding = 72;
    const measure: MeasureFn = (t) => ctx.measureText(t).width;

    fillBackground(ctx, width, height, theme.background, theme.gradientTo);

    // Left accent stripe.
    ctx.fillStyle = theme.accent;
    ctx.fillRect(0, 0, 16, height);

    // Title (up to 2 lines, fixed-ish size with mild shrink)
    const titleSize = height * 0.115;
    ctx.font = `700 ${titleSize}px ${FONT_STACK}`;
    ctx.fillStyle = theme.foreground;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const bodyLines = doc.body.split('\n');
    const firstIdx = bodyLines.findIndex((l) => l.trim());
    const titleText = doc.title || (firstIdx >= 0 ? bodyLines[firstIdx] : '');
    const titleLines = wrapText(measure, titleText, width - padding * 2).slice(0, 2);
    let y = padding;
    for (const line of titleLines) {
      ctx.fillText(line, padding, y);
      y += titleSize * 1.25;
    }

    // Body excerpt (up to 4 lines)
    const bodyText = doc.title
      ? doc.body
      : bodyLines.slice(firstIdx + 1).join('\n');
    const bodySize = height * 0.052;
    ctx.font = `400 ${bodySize}px ${FONT_STACK}`;
    ctx.fillStyle = theme.muted;
    const excerptLines = wrapText(measure, bodyText, width - padding * 2);
    const clipped = excerptLines.slice(0, 4);
    if (excerptLines.length > 4) {
      clipped[3] = clipped[3].replace(/\s*\S*$/, '') + '…';
    }
    y += height * 0.04;
    for (const line of clipped) {
      ctx.fillText(line, padding, y);
      y += bodySize * 1.5;
    }

    // Footer: attribution or app mark.
    const footerSize = height * 0.038;
    ctx.font = `500 ${footerSize}px ${FONT_STACK}`;
    ctx.fillStyle = theme.accent;
    ctx.textBaseline = 'bottom';
    ctx.fillText(doc.attribution || 'TextImage', padding, height - padding + footerSize);
  },
};


