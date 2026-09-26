import type { DocPayload } from './imageLibrary';

/**
 * Editor draft shared between the editor and the library's
 * "open in editor" action. Persisted to localStorage.
 */
export interface DraftState {
  title: string;
  body: string;
  attribution: string;
  format: string;
  size: string;
  theme: string;
  visibility: 'public' | 'private';
  values: Record<string, string | boolean>;
}

export const DRAFT_KEY = 'text-image:draft';

export function loadDraft(): DraftState | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DraftState>;
    if (typeof parsed !== 'object' || parsed === null) return null;
    return {
      title: typeof parsed.title === 'string' ? parsed.title : '',
      body: typeof parsed.body === 'string' ? parsed.body : '',
      attribution: typeof parsed.attribution === 'string' ? parsed.attribution : '',
      format: typeof parsed.format === 'string' ? parsed.format : 'card',
      size: typeof parsed.size === 'string' ? parsed.size : '',
      theme: typeof parsed.theme === 'string' ? parsed.theme : 'paper',
      visibility: parsed.visibility === 'public' ? 'public' : 'private',
      values: typeof parsed.values === 'object' && parsed.values !== null ? parsed.values : {},
    };
  } catch {
    return null;
  }
}

export function saveDraft(draft: DraftState): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // storage may be unavailable (private mode etc.) — non-fatal
  }
}

/** Convert a saved library doc payload back into an editor draft. */
export function draftFromDoc(doc: DocPayload): Partial<DraftState> {
  return {
    title: doc.t ?? '',
    body: doc.b ?? '',
    attribution: doc.a ?? '',
    format: doc.f ?? 'card',
    size: doc.s ?? '',
    theme: doc.h ?? 'paper',
    values: doc.v ?? {},
  };
}
