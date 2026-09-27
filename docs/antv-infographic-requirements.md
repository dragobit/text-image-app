# AntV Infographic 導入 要件定義書（v2 — 未決事項反映済み）

対象: `dragobit/text-image-app`
目的: `@antv/infographic` をレンダラとして追加し、テキストからインフォグラフィック画像を生成できるようにする。

---

## 1. 背景

- 現在のアプリは `src/lib/render/` の **satori 単一パイプライン**: `DocumentRenderer.renderSvg()` が SVG 文字列を返し、プレビューと PNG エクスポートが同じ SVG を canvas でラスタライズする。
- 現状のレンダラは `cardRenderer`（中央寄せカード）のみ。
- `@antv/infographic` は宣言的なインフォグラフィック DSL を解釈して高品質な SVG/PNG を出力するエンジン。テンプレート約200種、テーマ機構、SVG/PNG エクスポート API（`toDataURL`）を持つ。

## 2. 調査結果（実装の前提）

| 項目 | 確認結果 |
| --- | --- |
| パッケージ | `@antv/infographic`（MIT、ESM/CJS/UMD、`esm/` エントリあり） |
| 入力 | 独自 DSL 文字列（`infographic <template>` + `data` + `theme` ブロック、2スペースインデント）。自由文は直接解釈しない |
| ブラウザでの描画 | `new Infographic({ container, width, height, ... }).render(dsl)` でコンテナ内に SVG を描画 |
| SVG の取得 | `compose(): SVGSVGElement` で SVG 要素を取得、または `toDataURL({ type: 'svg', embedResources: true })` |
| PNG の取得 | `toDataURL({ type: 'png', ... })` — ブラウザ内でライブラリ自身がラスタライズ |
| SSR | 専用エントリ（`linkedom` 使用）あり。本アプリはブラウザ完結なので不要 |
| フォント | satori のようにグリフ埋め込みはしない。ブラウザ/OSのフォントに依存するため、**描画・プレビュー・PNG化をすべてライブラリ側のブラウザ描画で完結させるのが安全**（§4 FR-3 参照） |
| 外部リソース | テンプレートの一部はアイコン・イラストを CDN 等から読み込む可能性。`embedResources` で SVG 内に埋め込み可能（要検証 V-3） |
| エディタ | `editable: true` で内蔵エディタが有効化できる（本要件ではスコープ外） |

## 3. スコープ

### やること

- `infographic` レンダラを新フォーマットとして追加（satori カードと共存、置き換えではない）。
- 既存のエディタ入力（タイトル・本文・署名）から DSL を機械生成する。
- MVP は**テキストのみのシンプルなテンプレート**（タイトル＋本文＋署名程度の構成が取れるもの）を対象とする。

### やらないこと（今回）

- 本文の構造化（段落→箇条書き項目への分割、ステップ化等）。**本文は1つのテキストブロックとしてそのまま流し込む。**
- AI（LLM）による自然文→DSL 自動生成。
- 内蔵エディタ（`editable`）による二次編集 UI。
- アイコン・イラストを多用する装飾的テンプレート（外部リソース依存を避けるため、まずはテキスト主体のものだけ）。

## 4. 機能要件

| ID | 要件 | 優先度 |
| --- | --- | --- |
| FR-1 | `src/lib/render/renderers/infographic.tsx` に `DocumentRenderer` を実装し `registry.ts` に登録する | Must |
| FR-2 | `RenderDocument` → DSL 変換関数を実装する。MVP のマッピング: `title` → タイトル系フィールド、`body` → **1ブロックの本文**（分割しない）、`attribution` → フッタ/出典フィールド。DSL 生成は DOM 非依存の純粋関数として分離する | Must |
| FR-3 | **PNG 化は共通の SVG→canvas ラスタライズを使わず、ライブラリ自身の `toDataURL({type:'png'})` で行う。** フォントはグリフ埋め込みされないため、プレビュー上の描画とエクスポート結果を一致させるには「ブラウザが実際に描いたものをそのまま PNG 化する」方式が必須。これに伴い `DocumentRenderer` にオプショナルな出力フック（例: `renderPng?(container) : Promise<Blob>`）を追加し、`renderImage.ts` はフックがあればそれを使い、なければ従来の SVG ラスタライズにフォールバックする | Must |
| FR-4 | プレビューは再ラスタライズせず、ライブラリが生成した SVG をプレビュー領域に直接マウントする（= プレビューと PNG が同一描画系になり、フォント差異が構造的に起きない）。`DocumentRenderer` にプレビュー用の描画フック（例: `renderPreview?(container)`）を追加するか、生成済み `SVGSVGElement` をそのまま `appendChild` する設計とする | Must |
| FR-5 | `RenderTheme`（background/foreground/accent/muted/gradientTo）を AntV の `theme` / `themeConfig` にマッピングする。少なくとも背景色とアクセント色は既存テーマ選択を反映する | Must |
| FR-6 | `optionFields` でテンプレート内のバリエーション（レイアウト向き、配置など対象テンプレートが持つもの）を選べるようにする。テンプレート自体は MVP では 1〜2 種のシンプルなテキスト型に絞る | Should |
| FR-7 | `sizes` は既存4サイズ（正方形 1080² / 横長 1200×675 / 縦長 1080×1350 / ストーリー 1080×1920）を提供し、`width`/`height` 指定で描画する | Should |
| FR-8 | 本文が長い場合のはみ出し制御（文字数上限＋警告、またはテンプレート側の自動縮小機能の利用）を行う | Should |
| FR-9 | `@antv/infographic` は dynamic import で遅延ロードし、非選択時の初期バンドルを増やさない | Must |
| FR-10 | Nostr ライブラリ保存時、元データ（`RenderDocument` + renderer id + option values）を再編集可能な形で保持する | Should |

## 5. 非機能要件

- **NFR-1**: 初回レンダー < 3 秒（遅延ロード込み）、再レンダー < 1 秒。
- **NFR-2**: 初期 JS バンドルを増やさない（チャンク分割）。gzip サイズを `vite build` 出力で記録。
- **NFR-3 オフライン**: テキスト主体テンプレートは外部リソースなしで描画できることを採用条件とする。
- **NFR-4 国際化**: 日本語（CJK）の描画・折返しが正常であること。PNG 化後に豆腐化しないこと（ライブラリ側 PNG 化でブラウザフォントが使われるため、利用環境のフォントに依存する点は許容）。
- **NFR-5 テスト**: DSL 生成ロジック（FR-2/FR-8）は純粋関数として Vitest でカバー。`npm run test`（tsc + eslint + vitest + build）が通ること。

## 6. セキュリティ要件

- **SEC-1**: CSP（`script-src 'self'`, `default-src 'none'`）を緩めない。ライブラリが `eval`/`new Function` を使わないことを確認。ライブラリ生成 DOM をマウントする際、`foreignObject` 内スクリプト等の混入がないことを検証する。
- **SEC-2**: 外部リソースを読み込むテンプレートは採用しない（`img-src`/`connect-src` の追加を避ける）。
- **SEC-3**: ユーザー入力を DSL に展開する際、インデントやブロック構造を壊す文字列（改行+`data`等）をエスケープ/バリデートする。

## 7. 要検証事項（実装前 PoC）

| ID | 検証内容 |
| --- | --- |
| V-1 | `compose()` 返却の SVG / `toDataURL({type:'svg'})` でクリーンな SVG が取れるか |
| V-2 | `toDataURL({type:'png'})` で日本語を含む PNG が正しく出力されるか（フォント解決・解像度オプション） |
| V-3 | 採用候補テンプレートが外部リソース（アイコン CDN 等）を要求しないか、CSP 下で動くか |
| V-4 | 任意 `width`/`height` 指定時にテキスト型テンプレートのレイアウトが崩れないか |
| V-5 | jsdom（vitest）で `renderSvg` が動かない場合、canvas 同様の early-throw でテストを安全にスキップできるか |

## 8. 受け入れ基準

- エディタでフォーマット「インフォグラフィック」を選ぶと、タイトル/本文/署名がシンプルなインフォグラフィックとしてプレビューに直接描画される。
- PNG ダウンロード / SVG ダウンロード / コピー / Nostr 保存が既存フォーマットと同じ導線で動作する。
- プレビューと PNG 出力でフォント・レイアウトに差異がない。
- 日本語を含む入力で文字化け・はみ出しがない。
- `npm run test` パス。CSP 変更不要（外部リソース依存なし）。

## 9. 確定事項（ユーザー回答済み）

- 入力の粒度: **本文は1ブロックのまま**。段落分割・項目化はしない。まずはシンプルなテキストのみ。
- テンプレート: **テキストのみのシンプルなもの**を最初の対象とする。
- AI 生成: 対象外。
- 追加方式: satori カードと共存する新フォーマット。
- PNG 化: **ライブラリ側で行い、SVG→PNG の共通ラスタライズは使わない**（フォント整合のため）。
