import { fillBackground, wrapText, type MeasureFn } from '../layout';
import { FONT_STACK } from '../themes';
import type { DocumentRenderer } from '../types';

/**
 * Document page: flowed paragraphs on a page-proportioned canvas.
 * For longer text that would not fit a card. Extra text is clipped at
 * the bottom margin (a multi-page renderer is a future extension point).
 */
export const pageRenderer: DocumentRenderer = {
  id: 'page',
  kind: 'canvas',
  name: 'ページ',
  description: 'A4比率の文書ページ。長文向け',
  sizes: [
    { id: 'a4', label: 'A4縦 (1240×1754)', width: 1240, height: 1754 },
    { id: 'wide', label: '横長ページ (1754×1240)', width: 1754, height: 1240 },
  ],
  optionFields: [
    {
      key: 'bodySize',
      label: '本文サイズ',
      type: 'select',
      choices: [
        { value: 'small', label: '小' },
        { value: 'medium', label: '中' },
        { value: 'large', label: '大' },
      ],
      default: 'medium',
    },
  ],
  render(ctx, doc, { size, theme, values }) {
    const { width, height } = size;
    const padding = Math.round(width * 0.09);
    const contentWidth = width - padding * 2;
    const measure: MeasureFn = (t) => ctx.measureText(t).width;

    fillBackground(ctx, width, height, theme.background, theme.gradientTo);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    let y = padding;

    // Title
    if (doc.title) {
      const titleSize = Math.round(height * 0.036);
      ctx.font = `700 ${titleSize}px ${FONT_STACK}`;
      ctx.fillStyle = theme.foreground;
      for (const line of wrapText(measure, doc.title, contentWidth)) {
        ctx.fillText(line, padding, y);
        y += titleSize * 1.3;
      }
      // Accent rule under the title.
      y += titleSize * 0.4;
      ctx.fillStyle = theme.accent;
      ctx.fillRect(padding, y, Math.min(contentWidth * 0.25, 240), Math.max(3, height * 0.004));
      y += height * 0.035;
    }

    // Body
    const scale = values.bodySize === 'small' ? 0.017 : values.bodySize === 'large' ? 0.024 : 0.02;
    const bodySize = Math.round(height * scale);
    const lineHeight = bodySize * 1.8;
    ctx.font = `400 ${bodySize}px ${FONT_STACK}`;
    const bottom = height - padding;

    for (const line of wrapText(measure, doc.body, contentWidth)) {
      if (y + lineHeight > bottom) break;
      if (line === '') {
        y += lineHeight * 0.6; // paragraph gap
        continue;
      }
      ctx.fillStyle = theme.foreground;
      ctx.fillText(line, padding, y);
      y += lineHeight;
    }

    // Footer: attribution left, page mark right.
    const footerSize = Math.round(height * 0.014);
    ctx.font = `400 ${footerSize}px ${FONT_STACK}`;
    ctx.fillStyle = theme.muted;
    ctx.textBaseline = 'bottom';
    ctx.fillText(doc.attribution || '', padding, height - padding * 0.5);
    ctx.textAlign = 'right';
    ctx.fillText('TextImage', width - padding, height - padding * 0.5);
  },
};
