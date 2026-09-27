import { fitFontSize, type MeasureFn } from '../layout';
import { loadSatoriFonts, renderSatori, SATORI_FONT } from '../satoriEngine';
import type { DocumentRenderer } from '../types';

/**
 * Quote/statement card rendered as SVG via satori. The layout mirrors the
 * canvas `card` renderer: fonts are auto-fitted by measuring with the same
 * Noto Sans JP satori embeds, and the output is a self-contained,
 * scalable SVG that can also be downloaded directly.
 */
export const svgCardRenderer: DocumentRenderer = {
  id: 'svg-card',
  kind: 'svg',
  name: 'カード (SVG)',
  description: 'satoriで生成する中央寄せカード。SVGダウンロード可',
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
  async renderSvg(doc, { size, theme, values }) {
    const { width, height } = size;
    const align = values.align === 'left' ? 'left' : 'center';
    const padding = Math.round(Math.min(width, height) * 0.09);
    const contentWidth = width - padding * 2;
    const accentBar = Math.max(6, Math.round(height * 0.01));
    const background = theme.gradientTo
      ? `linear-gradient(${theme.background}, ${theme.gradientTo})`
      : theme.background;

    // Auto-fit title/body by measuring with the same font satori embeds
    // (registered on the document by loadSatoriFonts). Falls back to the
    // base sizes when canvas measurement is unavailable.
    await loadSatoriFonts();
    const measureCtx =
      typeof document !== 'undefined'
        ? document.createElement('canvas').getContext('2d')
        : null;
    const measure: MeasureFn | undefined = measureCtx
      ? (t) => measureCtx.measureText(t).width
      : undefined;

    let titleSize = Math.round(height * 0.055);
    let titleHeight = 0;
    if (doc.title) {
      const titleMaxHeight = Math.round(height * 0.16);
      if (measureCtx && measure) {
        titleSize = fitFontSize(
          (px) => {
            measureCtx.font = `700 ${px}px '${SATORI_FONT}', sans-serif`;
          },
          measure,
          doc.title,
          contentWidth,
          titleMaxHeight,
          titleSize,
          Math.round(height * 0.028),
          1.3,
        ).fontSize;
      }
      titleHeight = Math.min(titleMaxHeight, titleSize * 1.3) +
        Math.round(height * 0.04);
    }

    const attributionHeight = doc.attribution
      ? Math.round(height * 0.028 * 1.5 + padding * 0.5)
      : 0;
    const bodyAvailable =
      height - accentBar - padding * 2 - titleHeight - attributionHeight;

    let bodySize = Math.round(height * 0.06);
    if (measureCtx && measure && doc.body) {
      bodySize = fitFontSize(
        (px) => {
          measureCtx.font = `400 ${px}px '${SATORI_FONT}', sans-serif`;
        },
        measure,
        doc.body,
        contentWidth,
        bodyAvailable,
        Math.round(height * 0.08),
        Math.round(height * 0.02),
        1.4,
      ).fontSize;
    }

    return renderSatori(
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background,
          fontFamily: SATORI_FONT,
          overflow: 'hidden',
        }}
      >
        <div style={{ height: accentBar, background: theme.accent }} />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flexGrow: 1,
            padding,
            justifyContent: 'center',
            alignItems: align === 'left' ? 'flex-start' : 'center',
            textAlign: align,
          }}
        >
          {doc.title ? (
            <div
              style={{
                color: theme.accent,
                fontSize: titleSize,
                fontWeight: 700,
                lineHeight: 1.3,
                marginBottom: Math.round(height * 0.04),
                whiteSpace: 'pre-line',
              }}
            >
              {doc.title}
            </div>
          ) : null}
          <div
            style={{
              display: 'flex',
              color: theme.foreground,
              fontSize: bodySize,
              fontWeight: 400,
              lineHeight: 1.4,
              whiteSpace: 'pre-line',
            }}
          >
            {doc.body}
          </div>
        </div>
        {doc.attribution ? (
          <div
            style={{
              paddingLeft: padding,
              paddingRight: padding,
              paddingBottom: padding,
              color: theme.muted,
              fontSize: Math.round(height * 0.028),
              textAlign: align,
            }}
          >
            {doc.attribution}
          </div>
        ) : null}
      </div>,
      size,
    );
  },
};
