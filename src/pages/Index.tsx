import { useEffect, useMemo, useRef, useState } from 'react';
import { useSeoMeta } from '@unhead/react';
import { Copy, Download, Loader2, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useSaveToLibrary } from '@/hooks/useSaveToLibrary';
import { useToast } from '@/hooks/useToast';
import { loadDraft, saveDraft, type DraftState } from '@/lib/draft';
import {
  copyBlobToClipboard,
  downloadBlob,
  renderToBlob,
  renderToImage,
} from '@/lib/render/renderImage';
import { defaultOptionValues, getRenderer, RENDERERS } from '@/lib/render/registry';
import { getTheme, THEMES } from '@/lib/render/themes';
import type { DocPayload } from '@/lib/imageLibrary';

const Index = () => {
  useSeoMeta({
    title: 'TextImage — テキストを画像に',
    description: 'テキスト文書を指定フォーマットの画像に変換。Nostr連携で保存・再利用できます。',
  });

  const { toast } = useToast();
  const { user } = useCurrentUser();
  const { settings, synced, loaded } = useAppSettings();
  const saveToLibrary = useSaveToLibrary();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewHostRef = useRef<HTMLDivElement>(null);
  const renderSeq = useRef(0);
  const appliedSettings = useRef(false);
  const [previewError, setPreviewError] = useState(false);

  const [draft, setDraft] = useState<DraftState>(
    () =>
      loadDraft() ?? {
        title: '',
        body: '',
        attribution: '',
        format: 'card',
        size: '',
        theme: 'paper',
        visibility: 'private',
        values: {},
      },
  );

  // Apply synced defaults once, only when no draft exists yet.
  useEffect(() => {
    if (!loaded || appliedSettings.current) return;
    appliedSettings.current = true;
    setDraft((current) => {
      if (current.body) return current;
      return {
        ...current,
        format: settings.defaultFormat ?? current.format,
        theme: settings.defaultTheme ?? current.theme,
        visibility: settings.defaultVisibility ?? current.visibility,
      };
    });
  }, [loaded, settings]);

  const renderer = getRenderer(draft.format);
  const size =
    renderer.sizes.find((s) => s.id === draft.size) ?? renderer.sizes[0];
  const theme = getTheme(draft.theme);
  const values = useMemo(
    () => ({ ...defaultOptionValues(renderer), ...draft.values }),
    [renderer, draft.values],
  );

  const patch = (update: Partial<DraftState>) => {
    const next = { ...draft, ...update };
    saveDraft(next);
    setDraft(next);
  };

  const renderDoc = useMemo(
    () => ({
      title: draft.title,
      body: draft.body,
      attribution: draft.attribution,
    }),
    [draft.title, draft.body, draft.attribution],
  );

  const warnings = useMemo(
    () => renderer.getWarnings?.(renderDoc, { size, theme, values }) ?? [],
    [renderer, renderDoc, size, theme, values],
  );

  // Re-render the preview (debounced) on any input change. Renderers with
  // a `renderPreview` hook mount their own DOM output (same path as
  // export); others rasterize the satori SVG offscreen, then blit it into
  // the canvas — either way, preview and output share one render path.
  useEffect(() => {
    const timer = setTimeout(() => {
      const seq = ++renderSeq.current;
      void (async () => {
        try {
          if (renderer.renderPreview) {
            const host = previewHostRef.current;
            if (!host) return;
            await renderer.renderPreview(host, renderDoc, {
              size,
              theme,
              values,
            });
            if (seq !== renderSeq.current) return;
            setPreviewError(false);
            return;
          }
          const canvas = canvasRef.current;
          if (!canvas) return;
          const off = await renderToImage(renderer, renderDoc, {
            size,
            theme,
            values,
          });
          if (seq !== renderSeq.current) return;
          canvas.width = off.width;
          canvas.height = off.height;
          canvas.getContext('2d')?.drawImage(off, 0, 0);
          setPreviewError(false);
        } catch {
          if (seq === renderSeq.current) {
            const canvas = canvasRef.current;
            if (canvas) {
              canvas.width = size.width;
              canvas.height = size.height;
              canvas.getContext('2d')?.clearRect(0, 0, size.width, size.height);
            }
            previewHostRef.current?.replaceChildren();
            setPreviewError(true);
          }
          // Canvas 2D is unavailable in some environments (e.g. jsdom tests),
          // and SVG font fetching may fail offline.
        }
      })();
    }, 150);
    return () => clearTimeout(timer);
  }, [renderDoc, renderer, size, theme, values]);

  const hasContent = draft.body.trim().length > 0 || draft.title.trim().length > 0;

  const docPayload = (): DocPayload => ({
    t: draft.title || undefined,
    b: draft.body || undefined,
    a: draft.attribution || undefined,
    f: renderer.id,
    s: size.id,
    h: theme.id,
    v: values,
  });

  const render = () => renderToBlob(renderer, renderDoc, { size, theme, values });

  const handleDownload = async () => {
    try {
      const blob = await render();
      downloadBlob(blob, `textimage-${renderer.id}-${size.id}.png`);
    } catch (error) {
      toast({ title: 'PNGの生成に失敗しました', variant: 'destructive' });
      console.error(error);
    }
  };

  const handleDownloadSvg = async () => {
    try {
      const blob = await renderToBlob(
        renderer,
        renderDoc,
        { size, theme, values },
        'image/svg+xml',
      );
      downloadBlob(blob, `textimage-${renderer.id}-${size.id}.svg`);
    } catch (error) {
      toast({ title: 'SVGの生成に失敗しました', variant: 'destructive' });
      console.error(error);
    }
  };

  const handleCopy = async () => {
    try {
      const blob = await render();
      await copyBlobToClipboard(blob);
      toast({ title: 'クリップボードにコピーしました' });
    } catch {
      toast({ title: 'コピーに失敗しました', variant: 'destructive' });
    }
  };

  const handleSave = async () => {
    try {
      const blob = await render();
      const { url } = await saveToLibrary.mutateAsync({
        blob,
        doc: docPayload(),
        visibility: draft.visibility,
      });
      toast({
        title: 'ライブラリに保存しました',
        description: url,
      });
    } catch (error) {
      toast({
        title: '保存に失敗しました',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input */}
        <Card>
          <CardHeader>
            <CardTitle>テキスト入力</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">タイトル</Label>
              <Input
                id="title"
                value={draft.title}
                onChange={(e) => patch({ title: e.target.value })}
                placeholder="任意"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body">本文</Label>
              <Textarea
                id="body"
                value={draft.body}
                onChange={(e) => patch({ body: e.target.value })}
                placeholder={'画像化するテキストを入力…\n空行で段落が分かれます'}
                className="min-h-48"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="attribution">署名 / 出典</Label>
              <Input
                id="attribution"
                value={draft.attribution}
                onChange={(e) => patch({ attribution: e.target.value })}
                placeholder="任意"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>フォーマット</Label>
                <Select
                  value={renderer.id}
                  onValueChange={(format) =>
                    patch({ format, size: '', values: {} })
                  }
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
                <Label>サイズ</Label>
                <Select
                  value={size.id}
                  onValueChange={(sizeId) => patch({ size: sizeId })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {renderer.sizes.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>テーマ</Label>
                <Select
                  value={theme.id}
                  onValueChange={(themeId) => patch({ theme: themeId })}
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
              {renderer.optionFields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label>{field.label}</Label>
                  <Select
                    value={String(values[field.key] ?? field.default)}
                    onValueChange={(v) =>
                      patch({ values: { ...values, [field.key]: v } })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(field.choices ?? []).map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">{renderer.description}</p>
          </CardContent>
        </Card>

        {/* Preview & actions */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>プレビュー</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center rounded-lg border bg-muted/40 p-4">
                {renderer.renderPreview ? (
                  <div
                    ref={previewHostRef}
                    role="img"
                    aria-label="生成画像プレビュー"
                    className="w-full overflow-hidden rounded [&>svg]:h-auto [&>svg]:w-full [&>svg]:max-w-full"
                  />
                ) : (
                  <canvas
                    ref={canvasRef}
                    className="h-auto max-w-full rounded shadow"
                    aria-label="生成画像プレビュー"
                  />
                )}
              </div>
              {previewError && (
                <p className="mt-2 text-sm text-destructive">
                  プレビューの生成に失敗しました。
                </p>
              )}
              {warnings.map((warning) => (
                <p key={warning} className="mt-2 text-sm text-muted-foreground">
                  {warning}
                </p>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleDownload} disabled={!hasContent}>
                  <Download className="size-4" />
                  PNGをダウンロード
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleDownloadSvg}
                  disabled={!hasContent}
                >
                  <Download className="size-4" />
                  SVGをダウンロード
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleCopy}
                  disabled={!hasContent}
                >
                  <Copy className="size-4" />
                  コピー
                </Button>
              </div>

              <div className="space-y-3 border-t pt-4">
                <RadioGroup
                  value={draft.visibility}
                  onValueChange={(v) =>
                    patch({ visibility: v === 'public' ? 'public' : 'private' })
                  }
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="public" id="vis-public" />
                    <Label htmlFor="vis-public">公開リストに保存</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="private" id="vis-private" />
                    <Label htmlFor="vis-private">自分のみ（リストは暗号化）</Label>
                  </div>
                </RadioGroup>
                <p className="text-xs text-muted-foreground">
                  画像ファイル自体はBlossom上でURLを知る人のみ閲覧可能な状態で保存されます。暗号化されるのはブックマークの一覧です。
                </p>
                <Button
                  variant="outline"
                  onClick={handleSave}
                  disabled={!user || !hasContent || saveToLibrary.isPending}
                >
                  {saveToLibrary.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Nostrライブラリに保存
                </Button>
                {!user && (
                  <p className="text-sm text-muted-foreground">
                    保存にはNostrログインが必要です。
                  </p>
                )}
                {user && !synced && (
                  <p className="text-sm text-muted-foreground">
                    この署名方式は暗号化非対応のため、公開保存のみ利用できます。
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
};

export default Index;
