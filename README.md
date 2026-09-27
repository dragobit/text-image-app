# text-image-app

**テキスト文書をフォーマット済み画像に変換する Web アプリ。** Nostr 連携で画像の保存・再利用ができます。

[mkstack-devin](https://github.com/dragobit/mkstack-devin)（MKStack テンプレート）をベースに構築: React 19 / TailwindCSS 4 / Vite / shadcn/ui / Nostrify。

## 機能

- **テキスト → 画像変換**: タイトル・本文・署名を入力し、フォーマット・サイズ・テーマを選んで描画。PNG / SVG ダウンロード／クリップボードコピー。
- **satori 単一レンダーパス**: 全フォーマットが satori で JSX→SVG を生成し、プレビューも PNG エクスポートも同じ SVG をラスタライズするため、保存画像とプレビューのずれは構造的に起こり得ない。`src/lib/render/` に `DocumentRenderer` を実装して `registry.ts` に登録するだけで新フォーマットを追加可能。文字計測は `layout.ts` の純粋関数（折返し・フォント自動調整）で分離。
- **Nostr ライブラリ**: 生成画像を Blossom にアップロードし、専用ブックマークセット（kind 30003, `d=text-image-app`）に保存。公開 or NIP-44 暗号化の「自分のみ」を選択可。ライブラリから元文書をエディタに読み戻して再編集できます。
- **設定の永続化**: 既定フォーマット/テーマ/公開範囲を NIP-78（kind 30078, NIP-44 暗号化）に保存。未ログイン時は localStorage にフォールバック。

カスタムスキーマの詳細は `NIP.md` を参照。

## 開発

```bash
npm run dev     # dev server (port 8080)
npm run test    # tsc + eslint + vitest + build（CI と同一）
npm run build   # vite build -> dist/
npm run deploy  # NIP-5A nsite へデプロイ
```

## ルーティング

- `/` — エディタ（テキスト入力 → プレビュー → エクスポート/保存）
- `/library` — 保存済み画像の一覧（公開/非公開バッジ、再編集、ダウンロード）
- `/settings` — アプリ設定
- `/:nip19` — NIP-19 識別子ルート（テンプレート由来）
