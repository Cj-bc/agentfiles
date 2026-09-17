---
profile_id: typescript-node
markers: ["package.json"]
---

# プロファイル: TypeScript / JavaScript（Node・ブラウザ）

## 規約ファイル候補

- `CLAUDE.md` / `AGENTS.md` / `CONTRIBUTING.md` / `README.md`
- `.cursor/rules/**` / `.github/copilot-instructions.md`
- `eslint.config.*` / `.eslintrc*` / `biome.json` / `.prettierrc*`
  — **lint 設定は規約の実体**。ここで許可されている書き方を「規約違反」と呼ばない。
- `tsconfig.json`（`strict` が off なら型の緩さを一律に責めない）

## テスト（既定値）

- 命名: `*.test.ts` / `*.spec.ts` / `__tests__/**` / `test/` / `tests/`
- 実行: `package.json` の `scripts.test`（jest / vitest / node --test など）
- レビュワーに実行させるか: 依存が既にインストール済みで軽いなら可。
  **`npm install` 等の依存取得は禁止**（ネットワーク・ロックファイル変更を伴う）。

## 生成物パターン

- `node_modules/` `dist/` `build/` `.next/` `coverage/` `*.tsbuildinfo` `.turbo/`
- `.env` / `.env.*`（**混入は 🔴。秘密情報として扱う**）

## digest 対象（巨大な機械生成テキスト）

- `package-lock.json` `pnpm-lock.yaml` `yarn.lock`
  — 抜き出す情報: 追加・削除・更新されたトップレベル依存とバージョン範囲
- 生成された型定義・API クライアント（`*.gen.ts` `openapi*.ts` `schema.graphql` など）

## 機械チェック（監督がフェーズ 1-4 で実行する）

1. **lock ファイルの同伴**: `package.json` の依存が変わったのに lock ファイルが
   更新されていない（逆も同様） → `WARNING: dependency/lockfile mismatch`
2. **`.env` / 認証情報の混入**: 追加パスに `.env` 系、または追加行に `PRIVATE KEY`。
3. **`any` / `@ts-ignore` / `eslint-disable` の新規追加**を件数と位置で列挙
   （良し悪しはレビュワーが判断する。監督は場所を渡すだけ）。
4. **`console.log` / `debugger` の新規追加**（本番コード側のみ）。

## レビュー観点（`{{ECOSYSTEM_CHECKS}}` に流し込む本文）

- `any` / `as` によるキャスト、`@ts-ignore` / `@ts-expect-error` の新規追加。
  型で表現できるものを黙らせていないか。
- `Promise` の握り潰し: `await` 忘れ、`.catch` の無い浮いた Promise、
  `forEach` 内の `async`（待たれない）。
- `try/catch` で `unknown` を握り潰す、エラーを `null` に変換して呼び出し側が気付けない。
- キャンセル: `AbortSignal` を受け取る API に渡していない / 中断時のクリーンアップが無い。
- リソース解放: `addEventListener` に対する `removeEventListener`、
  `setInterval` の `clear`、`subscribe` の `unsubscribe`。
  React なら `useEffect` のクリーンアップ、依存配列の過不足。
- 例外安全でない非同期の順序（並行実行に変えたことでの競合、`Promise.all` の部分失敗）。
- 入力バリデーション: 外部入力を型アサーションだけで信用していないか
  （zod 等のスキーマ検証を通しているか）。
- Node と ブラウザの環境差（`process.env` / `window` の直接参照）。
- 破壊的変更: エクスポートされた API のシグネチャ変更に対する呼び出し側の追随。

## このエコシステム由来の典型的な偽陽性

- lock ファイルの巨大 diff そのもの。中身の行数は指摘対象ではない。
- `strict: false` のプロジェクトで `strictNullChecks` 前提の指摘をする。
- lint 設定で明示的に off にされているルール違反を「規約違反」として報告する。
- CommonJS / ESM の書き分けを、`package.json` の `type` を見ずに指摘する。
