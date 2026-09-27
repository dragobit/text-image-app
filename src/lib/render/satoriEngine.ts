import type { ReactNode } from 'react';
import satori from 'satori';
import type { RenderSize } from './types';

/**
 * satori engine: converts a JSX element tree into SVG markup.
 *
 * satori needs real font binaries for text measurement and glyph
 * embedding (`embedFont` is on by default, so output SVG is
 * self-contained). satori does not support WOFF2, so we fetch static
 * TTF builds of Noto Sans JP — which covers both Latin and CJK — once
 * per session and cache them.
 */

type FontWeight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

interface SatoriFont {
  name: string;
  data: ArrayBuffer;
  weight: FontWeight;
  style: 'normal';
}

const FONT_BASE =
  'https://cdn.jsdelivr.net/npm/@expo-google-fonts/noto-sans-jp@0.4.3';

const FONT_FILES: { weight: FontWeight; path: string }[] = [
  { weight: 400, path: '400Regular/NotoSansJP_400Regular.ttf' },
  { weight: 700, path: '700Bold/NotoSansJP_700Bold.ttf' },
];

/** Font family name to use inside satori element trees. */
export const SATORI_FONT = 'Noto Sans JP';

let fontCache: Promise<SatoriFont[]> | null = null;

async function fetchFont(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Font fetch failed: ${url} (${res.status})`);
  }
  return res.arrayBuffer();
}

async function fetchFonts(): Promise<SatoriFont[]> {
  const fonts = await Promise.all(
    FONT_FILES.map(async ({ weight, path }) => ({
      name: SATORI_FONT,
      data: await fetchFont(`${FONT_BASE}/${path}`),
      weight,
      style: 'normal' as const,
    })),
  );
  // Register the fetched fonts on the document so canvas measureText uses
  // the same metrics satori does (needed for font auto-fitting).
  try {
    await Promise.all(
      fonts.map(async (f) => {
        const face = new FontFace(f.name, f.data, { weight: String(f.weight) });
        await face.load();
        document.fonts.add(face);
      }),
    );
  } catch {
    // FontFace/document.fonts unavailable (e.g. jsdom) — measurement falls back.
  }
  return fonts;
}

/** Fetch (once) the font set shared by all satori renderers. */
export function loadSatoriFonts(): Promise<SatoriFont[]> {
  // A failed fetch is not cached — the next call retries from scratch.
  fontCache ??= fetchFonts().catch((error) => {
    fontCache = null;
    throw error;
  });
  return fontCache;
}

/** Render a JSX element tree to SVG markup at the given output size. */
export async function renderSatori(
  element: ReactNode,
  size: RenderSize,
): Promise<string> {
  const fonts = await loadSatoriFonts();
  return satori(element, { width: size.width, height: size.height, fonts });
}
