import { useNavigate } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { Download, Lock, Pencil } from 'lucide-react';

import { LoginArea } from '@/components/auth/LoginArea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useImageLibrary } from '@/hooks/useImageLibrary';
import { useToast } from '@/hooks/useToast';
import { draftFromDoc, loadDraft, saveDraft } from '@/lib/draft';
import { isHttpsUrl, type LibraryItem } from '@/lib/imageLibrary';

const Library = () => {
  useSeoMeta({
    title: 'ライブラリ — TextImage',
    description: 'Nostrブックマークリストに保存した画像の一覧。',
  });

  const { user } = useCurrentUser();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data, isLoading } = useImageLibrary();

  const openInEditor = (item: LibraryItem) => {
    const base = loadDraft();
    saveDraft({
      title: '',
      body: '',
      attribution: '',
      format: 'card',
      size: '',
      theme: 'paper',
      values: {},
      ...base,
      ...(item.doc ? draftFromDoc(item.doc) : {}),
      visibility: item.visibility,
    });
    navigate('/');
  };

  const download = async (item: LibraryItem) => {
    try {
      const res = await fetch(item.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `textimage-${item.url.split('/').pop() ?? 'image'}.png`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast({ title: 'ダウンロードに失敗しました', variant: 'destructive' });
    }
  };

  if (!user) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Card className="border-dashed">
          <CardContent className="py-12 px-8 text-center space-y-4">
            <p className="text-muted-foreground">
              ライブラリを表示するにはNostrログインが必要です。
            </p>
            <LoginArea className="max-w-60 mx-auto" />
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">ライブラリ</h1>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <Skeleton className="aspect-video w-full rounded" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && (data?.items.length ?? 0) === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 px-8 text-center">
            <p className="text-muted-foreground max-w-sm mx-auto">
              保存済みの画像はまだありません。エディタで画像を生成し、「Nostrライブラリに保存」するとここに表示されます。
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.items.map((item) => (
          <Card key={`${item.visibility}-${item.url}`} className="overflow-hidden">
            <a href={item.url} target="_blank" rel="noopener noreferrer">
              <img
                src={item.url}
                alt={item.doc?.t ?? '保存済み画像'}
                className="aspect-video w-full object-cover"
                loading="lazy"
              />
            </a>
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="truncate text-base">
                  {item.doc?.t || '無題'}
                </CardTitle>
                {item.visibility === 'private' ? (
                  <Badge variant="secondary">
                    <Lock className="size-3" />
                    非公開
                  </Badge>
                ) : (
                  <Badge variant="outline">公開</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex gap-2">
              {item.doc && isHttpsUrl(item.url) && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => openInEditor(item)}
                >
                  <Pencil className="size-4" />
                  エディタで開く
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => download(item)}>
                <Download className="size-4" />
                ダウンロード
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
};

export default Library;
