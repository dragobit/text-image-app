import { describe, expect, it } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';

import {
  encodeItemTags,
  parseLibraryItems,
  splitLibraryTags,
} from './imageLibrary';

describe('encodeItemTags', () => {
  it('emits an r tag plus a doc tag when a doc payload is given', () => {
    const tags = encodeItemTags('https://b.example/x.png', { t: 'hi' });
    expect(tags[0]).toEqual(['r', 'https://b.example/x.png']);
    expect(tags[1][0]).toBe('doc');
    expect(tags[1][1]).toBe('https://b.example/x.png');
    expect(JSON.parse(tags[1][2])).toEqual({ t: 'hi' });
  });

  it('emits only the r tag without a doc', () => {
    expect(encodeItemTags('https://b.example/x.png', null)).toEqual([
      ['r', 'https://b.example/x.png'],
    ]);
  });
});

describe('parseLibraryItems', () => {
  it('pairs doc payloads to their r-tag URL and marks visibility', () => {
    const docJson = JSON.stringify({ t: 'title', f: 'card' });
    const items = parseLibraryItems(
      [
        ['r', 'https://b.example/pub.png'],
        ['doc', 'https://b.example/pub.png', docJson],
      ],
      [
        ['r', 'https://b.example/priv.png'],
        ['doc', 'https://b.example/priv.png', docJson],
      ],
    );
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      url: 'https://b.example/pub.png',
      visibility: 'public',
    });
    expect(items[0].doc?.t).toBe('title');
    expect(items[1].visibility).toBe('private');
  });

  it('ignores non-https r tags and malformed doc payloads', () => {
    const items = parseLibraryItems(
      [
        ['r', 'javascript:alert(1)'],
        ['r', 'https://b.example/a.png'],
        ['doc', 'https://b.example/a.png', '{not json'],
      ],
      [],
    );
    expect(items).toHaveLength(1);
    expect(items[0].doc).toBeNull();
  });
});

describe('splitLibraryTags', () => {
  it('separates meta tags from item tags', () => {
    const event = {
      tags: [
        ['d', 'text-image-app'],
        ['title', 'TextImage Library'],
        ['r', 'https://b.example/a.png'],
        ['doc', 'https://b.example/a.png', '{}'],
        ['e', 'some-event-id'],
      ],
    } as NostrEvent;
    const { metaTags, publicItemTags } = splitLibraryTags(event);
    expect(metaTags.map((t) => t[0])).toEqual(['d', 'title']);
    expect(publicItemTags.map((t) => t[0])).toEqual(['r', 'doc', 'e']);
  });
});
