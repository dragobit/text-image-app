import { useState } from 'react';
import { useSeoMeta } from '@unhead/react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppSettings, type AppSettings } from '@/hooks/useAppSettings';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';
import { RENDERERS } from '@/lib/render/registry';
import { THEMES } from '@/lib/render/themes';

const Settings = () => {
  useSeoMeta({
    title: '設定 — TextImage',
    description: '既定フォーマット・テーマ・公開範囲などのアプリ設定。',
  });

  const { user } = useCurrentUser();
  const { toast } = useToast();
  const { settings, synced, updateSettings, isSaving } = useAppSettings();
  const [local, setLocal] = useState<AppSettings | null>(null);
  const current = local ?? settings;

  const patch = (update: Partial<AppSettings>) =>
    setLocal({ ...current, ...update });

  const handleSave = async () => {
    try {
      await updateSettings(current);
      setLocal(null);
      toast({
        title: '設定を保存しました',
        description: synced
          ? '暗号化してNostrリレーにも保存しました（kind 30078）。'
          : 'ローカルに保存しました。',
      });
    } catch {
      toast({ title: '設定の保存に失敗しました', variant: 'destructive' });
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">設定</h1>

      <Card>
        <CardHeader>
          <CardTitle>既定値</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>既定フォーマット</Label>
            <Select
              value={current.defaultFormat ?? 'card'}
              onValueChange={(v) => patch({ defaultFormat: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RENDERERS.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>既定テーマ</Label>
            <Select
              value={current.defaultTheme ?? 'paper'}
              onValueChange={(v) => patch({ defaultTheme: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THEMES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>既定の公開範囲</Label>
            <Select
              value={current.defaultVisibility ?? 'private'}
              onValueChange={(v) =>
                patch({ defaultVisibility: v === 'public' ? 'public' : 'private' })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">自分のみ（暗号化）</SelectItem>
                <SelectItem value="public">公開リスト</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSave} disabled={isSaving || local === null}>
            {isSaving && <Loader2 className="size-4 animate-spin" />}
            保存
          </Button>

          <p className="text-sm text-muted-foreground">
            {user
              ? synced
                ? '設定はNIP-44で暗号化し kind 30078 としてリレーにも保存されます。'
                : 'この署名方式は暗号化に非対応のため、設定はローカルのみ保存されます。'
              : '未ログインのため、設定はローカルのみ保存されます。'}
          </p>
        </CardContent>
      </Card>
    </main>
  );
};

export default Settings;
