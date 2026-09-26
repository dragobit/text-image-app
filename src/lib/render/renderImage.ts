import type { DocumentRenderer, RenderDocument, RenderOptions } from './types';

/** Draw into an existing canvas element (used for the live preview). */
export function renderToCanvas(
  canvas: HTMLCanvasElement,
  renderer: DocumentRenderer,
  doc: RenderDocument,
  options: RenderOptions,
): void {
  canvas.width = options.size.width;
  canvas.height = options.size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  renderer.render(ctx, doc, options);
}

/** Render offscreen and return a PNG blob (used for download/copy/save). */
export async function renderToBlob(
  renderer: DocumentRenderer,
  doc: RenderDocument,
  options: RenderOptions,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  renderToCanvas(canvas, renderer, doc, options);
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
