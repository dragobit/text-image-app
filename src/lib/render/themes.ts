import type { RenderTheme } from './types';

/**
 * Named palettes shared by all renderers. The first entry is the default.
 * `foreground`/`background` pairs are chosen to keep WCAG AA contrast for
 * large display text.
 */
export const THEMES: RenderTheme[] = [
  {
    id: 'paper',
    name: 'Paper',
    background: '#faf7f2',
    gradientTo: '#f0ebe1',
    foreground: '#1c1917',
    accent: '#b45309',
    muted: '#78716c',
  },
  {
    id: 'night',
    name: 'Night',
    background: '#0f172a',
    gradientTo: '#1e293b',
    foreground: '#f1f5f9',
    accent: '#38bdf8',
    muted: '#94a3b8',
  },
  {
    id: 'mono',
    name: 'Mono',
    background: '#ffffff',
    foreground: '#111111',
    accent: '#111111',
    muted: '#6b7280',
  },
  {
    id: 'indigo',
    name: 'Indigo',
    background: '#eef2ff',
    gradientTo: '#e0e7ff',
    foreground: '#1e1b4b',
    accent: '#4f46e5',
    muted: '#6366f1',
  },
  {
    id: 'forest',
    name: 'Forest',
    background: '#052e16',
    gradientTo: '#14532d',
    foreground: '#ecfdf5',
    accent: '#4ade80',
    muted: '#86efac',
  },
];

export function getTheme(id: string): RenderTheme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
