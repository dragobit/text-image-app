import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';

import { useCurrentUser } from './useCurrentUser';
import {
  IMAGE_LIBRARY_D,
  parseLibraryItems,
  type LibraryItem,
} from '@/lib/imageLibrary';

export interface ImageLibrary {
  items: LibraryItem[];
}

/**
 * Reads the user's image-library bookmark set (kind 30003, d=`text-image-app`),
 * including NIP-44-encrypted private items.
 */
export function useImageLibrary() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery<ImageLibrary>({
    queryKey: ['image-library', user?.pubkey ?? ''],
    enabled: Boolean(user),
    queryFn: async (c) => {
      const [event] = await nostr.query(
        [
          {
            kinds: [30003],
            authors: [user!.pubkey],
            '#d': [IMAGE_LIBRARY_D],
            limit: 1,
          },
        ],
        { signal: c.signal },
      );
      if (!event) return { items: [] };

      let privateTags: string[][] = [];
      if (event.content) {
        privateTags = await decryptPrivateTags(user!, event.content);
      }

      return { items: parseLibraryItems(event.tags, privateTags) };
    },
  });
}

/**
 * Decrypt a NIP-51 private-items payload. NIP-44 is preferred; a `?iv=`
 * suffix marks legacy NIP-04 ciphertext, tried when the signer supports it.
 */
export async function decryptPrivateTags(
  user: { signer: { nip44?: { decrypt: (p: string, c: string) => Promise<string> }; nip04?: { decrypt: (p: string, c: string) => Promise<string> } }; pubkey: string },
  ciphertext: string,
): Promise<string[][]> {
  try {
    let plaintext: string;
    if (ciphertext.includes('?iv=')) {
      if (!user.signer.nip04) return [];
      plaintext = await user.signer.nip04.decrypt(user.pubkey, ciphertext);
    } else {
      if (!user.signer.nip44) return [];
      plaintext = await user.signer.nip44.decrypt(user.pubkey, ciphertext);
    }
    const parsed = JSON.parse(plaintext);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
