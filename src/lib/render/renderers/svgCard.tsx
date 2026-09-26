import { renderSatori, SATORI_FONT } from '../satoriEngine';
import type { DocumentRenderer } from '../types';

/**
 * Quote/statement card rendered as SVG via satori. The layout mirrors the
 * canvas `card` renderer, but text is laid out by satori (flexbox + CJK
 * line breaking) and the output is a self-contained, scalable SVG that
 * can also be downloaded directly.
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
    const background = theme.gradientTo
      ? `linear-gradient(${theme.background}, ${theme.gradientTo})`
      : theme.background;

    return renderSatori(
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background,
          fontFamily: SATORI_FONT,
        }}
      >
        <div
          style={{
            height: Math.max(6, Math.round(height * 0.01)),
            background: theme.accent,
          }}
        />
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
                fontSize: Math.round(height * 0.055),
                fontWeight: 700,
                lineHeight: 1.3,
                marginBottom: Math.round(height * 0.04),
              }}
            >
              {doc.title}
            </div>
          ) : null}
          <div
            style={{
              display: 'flex',
              color: theme.foreground,
              fontSize: Math.round(height * 0.06),
              fontWeight: 400,
              lineHeight: 1.4,
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
