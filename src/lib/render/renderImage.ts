import type { DocumentRenderer, RenderDocument, RenderOptions } from './types';

/**
 * Single rendering path: every renderer produces SVG markup via
 * `renderer.renderSvg`. By default the preview rasterizes that markup
 * onto a canvas, and PNG export rasterizes the same markup at the target
 * pixel size — there is no second code path that could diverge from the
 * preview. A renderer may instead supply its own preview (`renderPreview`)
 * or PNG export (`renderPng`) when its engine needs to own those paths
 * (e.g. a library that rasterizes its own DOM output).
 */

/** Rasterize SVG markup into a canvas at the given pixel size. */
async function rasterizeSvg(
  svg: string,
  width: number,
  height: number,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is unavailable');
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
  return canvas;
}

/** Render the document into an offscreen canvas (used for the live preview). */
export async function renderToImage(
  renderer: DocumentRenderer,
  doc: RenderDocument,
  options: RenderOptions,
): Promise<HTMLCanvasElement> {
  // Fail fast where Canvas 2D is unavailable (e.g. jsdom) — before the
  // satori render, which fetches font binaries.
  if (!document.createElement('canvas').getContext('2d')) {
    throw new Error('Canvas 2D is unavailable');
  }
  const svg = await renderer.renderSvg(doc, options);
  return rasterizeSvg(svg, options.size.width, options.size.height);
}

/**
 * Render the document and return a blob (used for download/copy/save).
 * 'image/png' rasterizes the renderer's SVG at the selected size;
 * 'image/svg+xml' returns the same markup verbatim.
 */
export async function renderToBlob(
  renderer: DocumentRenderer,
  doc: RenderDocument,
  options: RenderOptions,
  mimeType: 'image/png' | 'image/svg+xml' = 'image/png',
): Promise<Blob> {
  // Renderers with their own rasterizer take the PNG hook; everyone
  // else rasterizes the renderSvg markup as before.
  if (mimeType === 'image/png' && renderer.renderPng) {
    return renderer.renderPng(doc, options);
  }
  const svg = await renderer.renderSvg(doc, options);
  if (mimeType === 'image/svg+xml') {
    return new Blob([svg], { type: 'image/svg+xml' });
  }
  const canvas = await rasterizeSvg(svg, options.size.width, options.size.height);
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
