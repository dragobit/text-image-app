import { useNostr } from '@nostrify/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { useCurrentUser } from './useCurrentUser';
import { useLocalStorage } from './useLocalStorage';
import { useNostrPublish } from './useNostrPublish';
import { SETTINGS_D } from '@/lib/imageLibrary';

const AppSettingsSchema = z.object({
  defaultFormat: z.string().optional(),
  defaultTheme: z.string().optional(),
  defaultVisibility: z.enum(['public', 'private']).optional(),
});

export type AppSettings = z.infer<typeof AppSettingsSchema>;

const LOCAL_KEY = 'text-image:settings';

/**
 * App settings handler. Settings persist to localStorage always, and —
 * when the logged-in signer supports NIP-44 — additionally to a NIP-78
 * app-data event (kind 30078, d=`text-image-app`) with encrypted content,
 * so they follow the user across devices.
 */
export function useAppSettings() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { mutateAsync: publish } = useNostrPublish();
  const queryClient = useQueryClient();

  const [local, setLocal] = useLocalStorage<AppSettings>(LOCAL_KEY, {}, {
    serialize: JSON.stringify,
    deserialize: (value: string) => {
      const parsed = AppSettingsSchema.safeParse(JSON.parse(value));
      return parsed.success ? parsed.data : {};
    },
  });

  const remote = useQuery<AppSettings>({
    queryKey: ['app-settings', user?.pubkey ?? ''],
    enabled: Boolean(user?.signer.nip44),
    queryFn: async (c) => {
      const [event] = await nostr.query(
        [
          {
            kinds: [30078],
            authors: [user!.pubkey],
            '#d': [SETTINGS_D],
            limit: 1,
          },
        ],
        { signal: c.signal },
      );
      if (!event?.content) return {};
      try {
        const plaintext = await user!.signer.nip44!.decrypt(user!.pubkey, event.content);
        const parsed = AppSettingsSchema.safeParse(JSON.parse(plaintext));
        return parsed.success ? parsed.data : {};
      } catch {
        return {};
      }
    },
  });

  const settings: AppSettings = { ...local, ...remote.data };

  const mutation = useMutation({
    mutationFn: async (next: AppSettings) => {
      setLocal(next);
      if (user?.signer.nip44) {
        const ciphertext = await user.signer.nip44.encrypt(
          user.pubkey,
          JSON.stringify(next),
        );
        await publish({
          kind: 30078,
          content: ciphertext,
          tags: [
            ['d', SETTINGS_D],
            ['alt', 'App data: TextImage user settings'],
          ],
        });
      }
      return next;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-settings', user?.pubkey ?? ''] });
    },
  });

  return {
    settings,
    /** True once the remote lookup has settled (or there is no remote). */
    loaded: remote.isFetched || !user?.signer.nip44,
    /** True when settings are synced to Nostr (encrypted kind 30078). */
    synced: Boolean(user?.signer.nip44),
    updateSettings: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}
