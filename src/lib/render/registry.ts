import { cardRenderer } from './renderers/card';
import type { DocumentRenderer } from './types';

/**
 * All registered output formats. To add a format, implement
 * `DocumentRenderer` in `renderers/` and append it here — the editor UI,
 * settings defaults and preview pick it up automatically.
 */
export const RENDERERS: DocumentRenderer[] = [cardRenderer];

export function getRenderer(id: string): DocumentRenderer {
  return RENDERERS.find((r) => r.id === id) ?? RENDERERS[0];
}

export function defaultOptionValues(
  renderer: DocumentRenderer,
): Record<string, string | boolean> {
  return Object.fromEntries(renderer.optionFields.map((f) => [f.key, f.default]));
}
