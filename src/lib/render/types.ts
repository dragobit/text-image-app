/**
 * Core types for the text-to-image rendering pipeline.
 *
 * A renderer takes a plain-text `RenderDocument` and produces
 * self-contained SVG markup (via satori) for the requested size + theme.
 * Preview and export both consume that markup, so there is exactly one
 * rendering path. New formats are added by registering a
 * `DocumentRenderer` in `registry.ts`.
 */

/** The source document produced by the editor. Plain text only. */
export interface RenderDocument {
  /** Optional heading rendered by most formats. May be empty. */
  title: string;
  /** Body text. Paragraphs are separated by blank lines. */
  body: string;
  /** Optional attribution / footer line (author name, source, etc). */
  attribution: string;
}

/** A concrete output size offered by a renderer. */
export interface RenderSize {
  id: string;
  label: string;
  width: number;
  height: number;
}

/** A color palette applied by renderers. */
export interface RenderTheme {
  id: string;
  name: string;
  /** Background color (SVG/CSS color value). */
  background: string;
  /** Optional gradient end color; when set, backgrounds use a vertical gradient. */
  gradientTo?: string;
  foreground: string;
  accent: string;
  muted: string;
}

/** Declarative option a renderer exposes in the editor UI. */
export interface RendererOptionField {
  key: string;
  label: string;
  type: 'select' | 'boolean';
  /** Required when type === 'select'. */
  choices?: { value: string; label: string }[];
  default: string | boolean;
}

/** Everything a renderer needs to draw one image. */
export interface RenderOptions {
  size: RenderSize;
  theme: RenderTheme;
  /** Per-renderer option values keyed by RendererOptionField.key. */
  values: Record<string, string | boolean>;
}

/**
 * A pluggable output format produced as SVG markup.
 *
 * `renderSvg` is the only required method — the shared rasterizer turns
 * that markup into preview and PNG. Renderers whose engine already
 * produces DOM output can additionally provide the optional hooks below
 * to keep preview and export on the engine's own rendering path.
 */
export interface DocumentRenderer {
  id: string;
  name: string;
  description: string;
  sizes: RenderSize[];
  optionFields: RendererOptionField[];
  renderSvg(doc: RenderDocument, options: RenderOptions): Promise<string>;
  /**
   * Optional renderer-provided PNG export (e.g. a library's own
   * rasterizer when its SVG does not carry enough information for the
   * shared SVG→canvas path, such as non-embedded fonts).
   */
  renderPng?(doc: RenderDocument, options: RenderOptions): Promise<Blob>;
  /**
   * Optional live preview: mount the renderer's own DOM output into
   * `container` instead of rasterizing `renderSvg` onto a canvas.
   */
  renderPreview?(
    container: HTMLElement,
    doc: RenderDocument,
    options: RenderOptions,
  ): Promise<void>;
  /**
   * Optional pure check returning user-facing warnings for the current
   * inputs (e.g. text that will be truncated to fit the template).
   */
  getWarnings?(doc: RenderDocument, options: RenderOptions): string[];
}
