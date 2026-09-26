import { useNostr } from '@nostrify/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useCurrentUser } from './useCurrentUser';
import { useNostrPublish } from './useNostrPublish';
import { useUploadFile } from './useUploadFile';
import {
  IMAGE_LIBRARY_D,
  encodeItemTags,
  splitLibraryTags,
  type DocPayload,
} from '@/lib/imageLibrary';
import { decryptPrivateTags } from './useImageLibrary';

export interface SaveToLibraryArgs {
  blob: Blob;
  doc: DocPayload | null;
  visibility: 'public' | 'private';
}

/**
 * Uploads a rendered PNG to Blossom and appends it to the user's
 * image-library bookmark set (kind 30003, d=`text-image-app`).
 * `private` items go into the NIP-44-encrypted content field per NIP-51.
 */
export function useSaveToLibrary() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { mutateAsync: uploadFile } = useUploadFile();
  const { mutateAsync: publish } = useNostrPublish();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ blob, doc, visibility }: SaveToLibraryArgs) => {
      if (!user) throw new Error('Must be logged in to save images');
      // Check encryption capability before uploading so a rejected private
      // save does not leave an orphaned blob on the Blossom server.
      if (visibility === 'private' && !user.signer.nip44) {
        throw new Error(
          'この署名方式はNIP-44暗号化に対応していないため、非公開保存できません',
        );
      }

      // 1. Upload the image to the user's Blossom servers.
      const file = new File([blob], 'image.png', { type: 'image/png' });
      const uploadTags = await uploadFile(file);
      const url = uploadTags.find(([name]) => name === 'url')?.[1];
      if (!url) throw new Error('Blossom upload returned no URL');

      // 2. Fetch the current library set (latest wins — it is addressable).
      const [existing] = await nostr.query(
        [
          {
            kinds: [30003],
            authors: [user.pubkey],
            '#d': [IMAGE_LIBRARY_D],
            limit: 1,
          },
        ],
        { signal: AbortSignal.timeout(10_000) },
      );

      const { publicItemTags } = existing
        ? splitLibraryTags(existing)
        : { publicItemTags: [] as string[][] };

      const itemTags = encodeItemTags(url, doc);
      const nextPublic =
        visibility === 'public' ? [...publicItemTags, ...itemTags] : publicItemTags;

      // 3. Republish the set. Public tags go inline; the encrypted content is
      // only touched when appending a private item — a public save carries the
      // existing ciphertext over verbatim, so private items survive even when
      // this signer cannot decrypt them (e.g. NIP-04 ciphertext).
      let content = existing?.content ?? '';
      if (visibility === 'private') {
        const existingPrivate = existing?.content
          ? await decryptPrivateTags(user, existing.content)
          : [];
        if (existingPrivate === null) {
          throw new Error(
            '既存の非公開アイテムを復号できませんでした。保存を中断します',
          );
        }
        content = await user.signer.nip44!.encrypt(
          user.pubkey,
          JSON.stringify([...existingPrivate, ...itemTags]),
        );
      }

      const event = await publish({
        kind: 30003,
        content,
        tags: [
          ['d', IMAGE_LIBRARY_D],
          ['title', 'TextImage Library'],
          ['description', 'Images rendered by the TextImage app'],
          ['alt', 'Bookmark set: images rendered by the TextImage app'],
          ...nextPublic,
        ],
      });

      return { url, event };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['image-library', user?.pubkey ?? ''],
      });
    },
  });
}
