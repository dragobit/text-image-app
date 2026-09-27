import type {
  BaseItemProps,
  BaseStructureProps,
  ComponentType,
  Infographic,
  JSXElement,
} from '@antv/infographic';
type InfographicModule = typeof import('@antv/infographic');

/** Constructor options (object form) of the library's Infographic class. */
type InfographicInitOptions = Exclude<
  ConstructorParameters<InfographicModule['Infographic']>[0],
  string
>;

import { loadSatoriFonts } from '../satoriEngine';
import type { DocumentRenderer, RenderDocument, RenderOptions } from '../types';
import {
  buildInfographicDsl,
  INFOGRAPHIC_FONT_FAMILY,
  infographicWarnings,
} from './infographicDsl';

/**
 * AntV Infographic renderer (`infographic`).
 *
 * Unlike the satori-based renderers this output is produced by AntV's own
 * SVG engine, so:
 *  - the preview mounts the library-generated <svg> element directly
 *    (`renderPreview`), and
 *  - PNG export goes through the library's `toDataURL({ type: 'png' })`
 *    (`renderPng`), which rasterizes that same DOM node — preview and
 *    export can never diverge.
 *
 * CSP safety: the library ships five CDN-hosted fonts
 * (assets.antv.antgroup.com) which it injects as <link> tags on every
 * render. We overwrite all of them with URL-less registry entries so no
 * external request is ever made; the composed SVG uses the app's own font
 * stack. For export, the Noto Sans JP binaries already fetched for satori
 * are inlined as @font-face data: URIs so the PNG rasterizer sees the
 * exact same glyphs as the preview.
 */

type TextSlot = 'label' | 'desc' | 'value';

interface TextItemProps extends BaseItemProps {
  slot?: TextSlot;
  fontSize?: number;
  fontWeight?: number | string;
  lineHeight?: number;
  align?: 'left' | 'center' | 'right';
  maxHeight?: number;
}

interface StackProps extends BaseStructureProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  gap?: number;
  justify?: 'flex-start' | 'center';
}

/** Built-in CDN font families shipped by the library (all neutralized). */
const CDN_FONT_FAMILIES = [
  'Alibaba PuHuiTi',
  'Source Han Sans',
  'Source Han Serif',
  'LXGW WenKai',
  '851tegakizatsu',
];

const RENDER_TIMEOUT_MS = 20000;

let modulePromise: Promise<InfographicModule> | null = null;
let fontFaceCssPromise: Promise<string> | null = null;

/**
 * Measure the wrapped block height of `text` exactly the way the
 * library's foreignObject span renders it (pre-wrap + break-word within
 * the given pixel width).
 */
function measureBlockHeight(
  text: string,
  width: number,
  fontSize: number,
  lineHeight: number,
  fontWeight?: number | string,
): number {
  const span = document.createElement('span');
  span.style.position = 'absolute';
  span.style.visibility = 'hidden';
  span.style.pointerEvents = 'none';
  span.style.left = '-99999px';
  span.style.top = '0';
  span.style.whiteSpace = 'pre-wrap';
  span.style.wordBreak = 'break-word';
  span.style.overflowWrap = 'break-word';
  span.style.width = `${width}px`;
  span.style.fontSize = `${fontSize}px`;
  span.style.lineHeight = String(lineHeight);
  span.style.fontFamily = INFOGRAPHIC_FONT_FAMILY;
  if (fontWeight !== undefined) span.style.fontWeight = String(fontWeight);
  span.textContent = text;
  document.body.appendChild(span);
  const height = span.getBoundingClientRect().height;
  span.remove();
  return height;
}

function datumText(datum: BaseItemProps['datum'], slot: TextSlot): string {
  const value = (datum as Record<string, unknown>)[slot];
  if (value === undefined || value === null) return '';
  return String(value);
}

function elementTypeFor(slot: TextSlot): string {
  return slot === 'label'
    ? 'item-label'
    : slot === 'value'
      ? 'item-value'
      : 'item-desc';
}

/**
 * Load the library once (dynamic import keeps it out of the initial
 * bundle) and register our CSP-safe setup: custom item (`ti-text`),
 * vertical stacker (`ti-stack`) and the `ti-card` template named by the
 * generated DSL.
 */
function loadInfographic(): Promise<InfographicModule> {
  modulePromise ??= import('@antv/infographic').then((mod) => {
    // Replace the CDN font registry entries so loadFonts() emits no
    // <link> tags (empty URL list → early return) and the font exporter
    // finds nothing to fetch.
    for (const family of CDN_FONT_FAMILIES) {
      mod.registerFont({
        fontFamily: family,
        name: family,
        baseUrl: '',
        fontWeight: {},
      });
    }

    /**
     * One wrapping text block item. Width comes from the structure; the
     * measured DOM height feeds layout. If the height exceeds the
     * maxHeight budget the font shrinks stepwise until it fits.
     */
    const TextItem: ComponentType<TextItemProps> = (props) => {
      const {
        indexes,
        datum,
        width = 0,
        x = 0,
        y = 0,
        slot = 'desc',
        fontSize = 18,
        fontWeight,
        lineHeight = 1.5,
        align = 'left',
        maxHeight = 0,
        themeColors,
      } = props;
      const text = datumText(datum, slot);
      if (!text || width <= 0) {
        return mod.jsx(mod.Group, { x, y, width, height: 0 });
      }

      let size = fontSize;
      let textHeight = measureBlockHeight(
        text,
        width,
        size,
        lineHeight,
        fontWeight,
      );
      const minSize = Math.max(10, Math.floor(fontSize * 0.45));
      while (maxHeight > 0 && textHeight > maxHeight && size > minSize) {
        size = Math.max(minSize, Math.floor(size * 0.9));
        textHeight = measureBlockHeight(
          text,
          width,
          size,
          lineHeight,
          fontWeight,
        );
      }

      // Accent rule under the title, colored by the theme's primary.
      const isTitle = slot === 'label';
      const accentGap = isTitle ? Math.max(6, Math.round(size * 0.22)) : 0;
      const accentHeight = isTitle ? Math.max(4, Math.round(size * 0.08)) : 0;
      const accentWidth = isTitle
        ? Math.min(width * 0.35, Math.round(size * 2.2))
        : 0;
      const accentX =
        align === 'center'
          ? (width - accentWidth) / 2
          : align === 'right'
            ? width - accentWidth
            : 0;
      const height = textHeight + accentGap + accentHeight;

      const children: JSXElement[] = [
        mod.jsx(mod.Text, {
          x: 0,
          y: 0,
          width,
          height: textHeight,
          fontSize: size,
          fontWeight,
          lineHeight,
          alignHorizontal: align,
          wordWrap: true,
          fill: themeColors.colorText,
          'data-element-type': elementTypeFor(slot),
          'data-indexes': indexes,
          children: text,
        }),
      ];
      if (isTitle) {
        children.push(
          mod.jsx(mod.Rect, {
            x: accentX,
            y: textHeight + accentGap,
            width: accentWidth,
            height: accentHeight,
            rx: accentHeight / 2,
            ry: accentHeight / 2,
            fill: themeColors.colorPrimary,
            'data-element-type': 'shape',
          }),
        );
      }
      return mod.jsx(mod.Group, { x, y, width, height, children });
    };

    /**
     * Vertical stacker. Unlike the built-in list-column — which gives
     * every row the first item's height — each child keeps its own
     * measured height, so title/body/source can differ in size.
     */
    const Stack: ComponentType<StackProps> = (props) => {
      const { data, Items, Item, gap = 24, justify = 'flex-start' } = props;
      const { x = 0, y = 0, width = 0, height = 0 } = props;
      const items = data.items ?? [];
      return mod.jsx(mod.FlexLayout, {
        x,
        y,
        width,
        height,
        flexDirection: 'column',
        justifyContent: justify,
        alignItems: 'flex-start',
        gap,
        children: items.map((datum, i) =>
          mod.jsx(Items[i] ?? Item, {
            indexes: [i],
            datum,
            data,
            width,
            positionV: 'normal',
            positionH: 'normal',
          }),
        ),
      });
    };

    mod.registerItem('ti-text', { component: TextItem, composites: ['desc'] });
    mod.registerStructure('ti-stack', {
      component: Stack,
      composites: ['item'],
    });
    mod.registerTemplate('ti-card', {
      design: {
        structure: { type: 'ti-stack' },
        item: { type: 'ti-text' },
      },
    });
    return mod;
  });
  return modulePromise;
}

/** Fail fast where the render path cannot work (jsdom: no Canvas 2D). */
function assertBrowserRender(): void {
  if (
    typeof document === 'undefined' ||
    !document.createElement('canvas').getContext('2d')
  ) {
    throw new Error('Canvas 2D is unavailable');
  }
}

/**
 * @font-face CSS embedding the Noto Sans JP binaries the app already
 * fetches for satori, so PNG/SVG export uses the same glyphs as the
 * preview instead of whatever system font the rasterizer falls back to.
 * Cached: the base64 encode happens once per session.
 */
function loadFontFaceCss(): Promise<string> {
  fontFaceCssPromise ??= loadSatoriFonts()
    .then((fonts) =>
      fonts
        .map((font) => {
          const bytes = new Uint8Array(font.data);
          let binary = '';
          const CHUNK = 0x8000;
          for (let i = 0; i < bytes.length; i += CHUNK) {
            binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
          }
          return (
            `@font-face{font-family:'${font.name}';font-style:${font.style};` +
            `font-weight:${font.weight};` +
            `src:url(data:font/ttf;base64,${btoa(binary)}) format('truetype');}`
          );
        })
        .join(''),
    )
    .catch(() => {
      // Offline / FontFace unavailable — export falls back to system
      // fonts; keep the failure non-fatal and retryable.
      fontFaceCssPromise = null;
      return '';
    });
  return fontFaceCssPromise;
}

async function embedFontsInSvg(svg: SVGSVGElement): Promise<void> {
  const css = await loadFontFaceCss();
  if (!css) return;
  const style = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'style',
  );
  style.textContent = css;
  svg.prepend(style);
}

interface RenderedInfographic {
  node: SVGSVGElement;
  toDataURL(options: { type: 'png'; dpr?: number }): Promise<string>;
  destroy(): void;
}

/**
 * Render the DSL into `container` (the visible preview host or an
 * offscreen element) and resolve once the library has mounted the SVG.
 */
function renderIntoContainer(
  mod: InfographicModule,
  container: HTMLElement,
  dsl: string,
  width: number,
  height: number,
): Promise<{ infographic: Infographic; node: SVGSVGElement }> {
  return new Promise((resolve, reject) => {
    // viewBox is read from parsed options at render time (rest-options
    // pass-through) but missing from the public InfographicOptions type.
    const infographic = new mod.Infographic({
      container,
      width,
      height,
      // Fixed viewBox: the output canvas is exactly size × size; content
      // letterboxes inside it (centered by the structure's flex layout).
      viewBox: `0 0 ${width} ${height}`,
    } as InfographicInitOptions & { viewBox?: string });
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      infographic.destroy();
      reject(new Error('Infographic render timed out'));
    }, RENDER_TIMEOUT_MS);
    const onLoaded = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      infographic.off('error', onError);
      const svg = container.querySelector('svg');
      if (!svg) {
        infographic.destroy();
        reject(new Error('Infographic render produced no SVG'));
        return;
      }
      resolve({ infographic, node: svg as SVGSVGElement });
    };
    const onError = (err: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      infographic.destroy();
      const detail = Array.isArray(err)
        ? err
            .map((e) => (e instanceof Error ? e.message : String(e)))
            .join('; ')
        : err instanceof Error
          ? err.message
          : String(err);
      reject(new Error(`Infographic render failed: ${detail}`));
    };
    infographic.on('loaded', onLoaded);
    infographic.on('error', onError);
    try {
      infographic.render(dsl);
    } catch (err) {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        infographic.destroy();
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    }
  });
}

/** Offscreen but attached: the exporters measure the live DOM. */
function createOffscreenContainer(): { el: HTMLElement; cleanup(): void } {
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  el.style.position = 'fixed';
  el.style.left = '-100000px';
  el.style.top = '0';
  el.style.width = '0';
  el.style.height = '0';
  el.style.overflow = 'hidden';
  el.style.pointerEvents = 'none';
  document.body.appendChild(el);
  return { el, cleanup: () => el.remove() };
}

/** data:*;base64,... → Blob (no fetch: connect-src lacks data:). */
function dataUrlToBlob(dataUrl: string, mime: string): Blob {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function renderOffscreen(
  mod: InfographicModule,
  doc: RenderDocument,
  options: RenderOptions,
): Promise<RenderedInfographic & { cleanup(): void }> {
  const { el, cleanup } = createOffscreenContainer();
  try {
    const { dsl } = buildInfographicDsl(doc, options);
    const { infographic, node } = await renderIntoContainer(
      mod,
      el,
      dsl,
      options.size.width,
      options.size.height,
    );
    return {
      node,
      toDataURL: (opts) => infographic.toDataURL(opts),
      destroy: () => infographic.destroy(),
      cleanup,
    };
  } catch (err) {
    cleanup();
    throw err;
  }
}

// Per-container sequence + instance handles so a superseded render
// drops its listeners and removes its stale SVG.
const previewSeq = new WeakMap<HTMLElement, number>();
const previewInstances = new WeakMap<HTMLElement, { destroy(): void }>();

export const infographicRenderer: DocumentRenderer = {
  id: 'infographic',
  name: 'インフォグラフィック',
  description: 'AntV Infographicによるテキストカード（自動フォント調整）',
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
    {
      key: 'valign',
      label: '縦位置',
      type: 'select',
      choices: [
        { value: 'center', label: '中央' },
        { value: 'top', label: '上寄せ' },
      ],
      default: 'center',
    },
  ],

  getWarnings: infographicWarnings,

  /**
   * Mount the library-generated SVG directly into the preview host —
   * the exact same rendering path PNG export uses.
   */
  async renderPreview(
    container: HTMLElement,
    doc: RenderDocument,
    options: RenderOptions,
  ) {
    assertBrowserRender();
    const mod = await loadInfographic();
    const { dsl } = buildInfographicDsl(doc, options);
    const seq = (previewSeq.get(container) ?? 0) + 1;
    previewSeq.set(container, seq);
    previewInstances.get(container)?.destroy();
    previewInstances.delete(container);
    const rendered = await renderIntoContainer(
      mod,
      container,
      dsl,
      options.size.width,
      options.size.height,
    );
    if (previewSeq.get(container) !== seq) {
      rendered.infographic.destroy();
      return;
    }
    previewInstances.set(container, {
      destroy: () => rendered.infographic.destroy(),
    });
  },

  /** SVG markup for download — same compose path as preview. */
  async renderSvg(doc: RenderDocument, options: RenderOptions) {
    assertBrowserRender();
    const mod = await loadInfographic();
    const rendered = await renderOffscreen(mod, doc, options);
    try {
      await embedFontsInSvg(rendered.node);
      return new XMLSerializer().serializeToString(rendered.node);
    } finally {
      rendered.destroy();
      rendered.cleanup();
    }
  },

  /** PNG export via the library's own toDataURL (font embedding). */
  async renderPng(doc: RenderDocument, options: RenderOptions) {
    assertBrowserRender();
    const mod = await loadInfographic();
    const rendered = await renderOffscreen(mod, doc, options);
    try {
      await embedFontsInSvg(rendered.node);
      // dpr=1: the exported PNG is exactly the selected pixel size, same
      // contract as the satori rasterization path.
      const dataUrl = await rendered.toDataURL({ type: 'png', dpr: 1 });
      return dataUrlToBlob(dataUrl, 'image/png');
    } finally {
      rendered.destroy();
      rendered.cleanup();
    }
  },
};
