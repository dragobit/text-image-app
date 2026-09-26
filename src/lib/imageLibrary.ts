import type { NostrEvent } from '@nostrify/nostrify';

/**
 * Image library storage on Nostr (see NIP.md for the schema).
 *
 * Saved images live in a dedicated NIP-51 bookmark set:
 *   kind 30003, d-tag `text-image-app`
 * Each item contributes:
 *   ["r",   <image url>]                 — the image itself
 *   ["doc", <image url>, <json string>]  — the source document, for re-editing
 * Public items are plain tags; private items use the same tag schema inside
 * the NIP-44-encrypted `content` array (NIP-51 private list items).
 */

export const IMAGE_LIBRARY_D = 'text-image-app';
export const SETTINGS_D = 'text-image-app';

/** Compact source-document payload embedded in `doc` tags. */
export interface DocPayload {
  t?: string; // title
  b?: string; // body
  a?: string; // attribution
  f?: string; // renderer id
  s?: string; // size id
  h?: string; // theme id
  v?: Record<string, string | boolean>; // renderer option values
}

export interface LibraryItem {
  url: string;
  doc: DocPayload | null;
  visibility: 'public' | 'private';
}

export function encodeItemTags(url: string, doc: DocPayload | null): string[][] {
  const tags: string[][] = [['r', url]];
  if (doc) tags.push(['doc', url, JSON.stringify(doc)]);
  return tags;
}

/**
 * Split an event's tag list into image-library items. `privateTags` are the
 * already-decrypted tags from the event's `content` field.
 */
export function parseLibraryItems(
  publicTags: string[][],
  privateTags: string[][],
): LibraryItem[] {
  const items: LibraryItem[] = [];

  for (const [tags, visibility] of [
    [publicTags, 'public'],
    [privateTags, 'private'],
  ] as const) {
    const docs = new Map<string, DocPayload>();
    for (const tag of tags) {
      if (tag[0] === 'doc' && tag[1] && tag[2]) {
        try {
          docs.set(tag[1], JSON.parse(tag[2]) as DocPayload);
        } catch {
          // ignore malformed doc payloads
        }
      }
    }
    for (const tag of tags) {
      if (tag[0] === 'r' && isHttpsUrl(tag[1])) {
        items.push({ url: tag[1], doc: docs.get(tag[1]) ?? null, visibility });
      }
    }
  }

  return items;
}

/**
 * Split the raw tags of an existing library event into the meta tags (`d`,
 * `title`, ...) and the public item tags, so a republish preserves
 * unrelated entries other clients may have written.
 */
export function splitLibraryTags(event: NostrEvent): {
  metaTags: string[][];
  publicItemTags: string[][];
} {
  const metaTags: string[][] = [];
  const publicItemTags: string[][] = [];
  for (const tag of event.tags) {
    if (tag[0] === 'd' || tag[0] === 'title' || tag[0] === 'description' || tag[0] === 'image' || tag[0] === 'client') {
      metaTags.push(tag);
    } else {
      publicItemTags.push(tag);
    }
  }
  return { metaTags, publicItemTags };
}

export function isHttpsUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}
