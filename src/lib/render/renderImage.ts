import type { DocumentRenderer, RenderDocument, RenderOptions } from './types';

/** Rasterize SVG markup onto a canvas context (used for preview + PNG export). */
async function drawSvg(
  ctx: CanvasRenderingContext2D,
  svg: string,
  width: number,
  height: number,
): Promise<void> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    const loaded = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to rasterize SVG'));
    });
    img.src = url;
    await loaded;
    ctx.drawImage(img, 0, 0, width, height);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Draw into an existing canvas element (used for the live preview). */
export async function renderToCanvas(
  canvas: HTMLCanvasElement,
  renderer: DocumentRenderer,
  doc: RenderDocument,
  options: RenderOptions,
): Promise<void> {
  canvas.width = options.size.width;
  canvas.height = options.size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  if (renderer.kind === 'canvas') {
    renderer.render(ctx, doc, options);
  } else {
    const svg = await renderer.renderSvg(doc, options);
    await drawSvg(ctx, svg, options.size.width, options.size.height);
  }
}

/**
 * Render offscreen and return a blob (used for download/copy/save).
 * SVG renderers additionally support 'image/svg+xml' output.
 */
export async function renderToBlob(
  renderer: DocumentRenderer,
  doc: RenderDocument,
  options: RenderOptions,
  mimeType: 'image/png' | 'image/svg+xml' = 'image/png',
): Promise<Blob> {
  if (mimeType === 'image/svg+xml') {
    if (renderer.kind !== 'svg') {
      throw new Error('このフォーマットはSVG出力に対応していません');
    }
    const svg = await renderer.renderSvg(doc, options);
    return new Blob([svg], { type: 'image/svg+xml' });
  }
  const canvas = document.createElement('canvas');
  await renderToCanvas(canvas, renderer, doc, options);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode PNG'))),
      'image/png',
    );
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function copyBlobToClipboard(blob: Blob): Promise<void> {
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}
