import { fitFontSize, fillBackground, type MeasureFn } from '../layout';
import { FONT_STACK } from '../themes';
import type { DocumentRenderer } from '../types';

/**
 * Quote/statement card: a single block of text centered on a colored
 * canvas, auto-sized to fit. Best for short passages, quotes and
 * announcements.
 */
export const cardRenderer: DocumentRenderer = {
  id: 'card',
  name: 'カード',
  description: '短文・名言向けの中央寄せカード',
  sizes: [
    { id: 'square', label: '正方形 (1080×1080)', width: 1080, height: 1080 },
    { id: 'wide', label: '横長 (1200×675)', width: 1200, height: 675 },
    { id: 'tall', label: '縦長 (1080×1350)', width: 1080, height: 1350 },
    { id: 'story', label: 'ストーリー (1080×1920)', width: 1080, height: 1920 },
  ],
  optionFields: [
    {
      key: 'align',
      label: '配置',
      type: 'select',
      choices: [
        { value: 'center', label: '中央揃え' },
        { value: 'left', label: '左揃え' },
      ],
      default: 'center',
    },
  ],
  render(ctx, doc, { size, theme, values }) {
    const { width, height } = size;
    const align = values.align === 'left' ? 'left' : 'center';
    const padding = Math.round(Math.min(width, height) * 0.09);
    const contentWidth = width - padding * 2;

    fillBackground(ctx, width, height, theme.background, theme.gradientTo);

    const x = align === 'left' ? padding : width / 2;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';

    // Accent bar along the top edge.
    ctx.fillStyle = theme.accent;
    ctx.fillRect(0, 0, width, Math.max(6, Math.round(height * 0.01)));

    const attributionHeight = doc.attribution ? Math.round(height * 0.09) : 0;

    // Title sits near the top margin; the body centers in what remains.
    let bodyTop = padding;
    if (doc.title) {
      const titleSize = Math.round(height * 0.055);
      ctx.font = `600 ${titleSize}px ${FONT_STACK}`;
      ctx.fillStyle = theme.accent;
      ctx.fillText(doc.title, x, bodyTop + titleSize / 2);
      bodyTop += titleSize * 2;
    }

    // Body fitted into remaining space
    const available = height - padding - attributionHeight - bodyTop;
    const startSize = Math.round(height * (align === 'left' ? 0.085 : 0.1));
    const minSize = Math.round(height * 0.022);
    const measure: MeasureFn = (t) => ctx.measureText(t).width;
    const { fontSize, lines } = fitFontSize(
      (px) => {
        ctx.font = `500 ${px}px ${FONT_STACK}`;
      },
      measure,
      doc.body,
      contentWidth,
      available,
      startSize,
      minSize,
    );

    const lineHeight = fontSize * 1.4;
    const blockHeight = lines.length * lineHeight;
    let y = bodyTop + Math.max(0, (available - blockHeight) / 2) + lineHeight / 2;
    ctx.fillStyle = theme.foreground;
    for (const line of lines) {
      ctx.fillText(line, x, y);
      y += lineHeight;
    }

    // Attribution
    if (doc.attribution) {
      const size = Math.round(height * 0.028);
      ctx.font = `400 ${size}px ${FONT_STACK}`;
      ctx.fillStyle = theme.muted;
      ctx.fillText(doc.attribution, x, height - padding + size / 2);
    }
  },
};
