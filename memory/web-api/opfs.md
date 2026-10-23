---
name: opfs
description: ブラウザの OPFS（Origin Private File System）の罠 — 書き込みは createWritable → write → close（Safari は最近まで未対応）、存在しないものは NotFoundError、persist() で退避されにくくする、Playwright で中身を確かめる手順
type: reference
---

## 読み書き（2026-10-20）
- `createWritable()` → `write()` → `close()` で書く。`close()` するまで元の内容は置き換わらない。
  `createWritable()` は Safari では最近まで使えなかった（古い Safari では Worker の中で sync access handle を使う必要がある）。Chromium でしか確かめていない。
- 存在しないファイルやディレクトリは `NotFoundError` で reject される。読み込みでは null に、削除では無視に変換する。
- `navigator.storage.persist()` を呼んでおくと、ストレージが逼迫しても退避されにくくなる（失敗は無視してよい）。
- Kotlin/Wasm から呼ぶ方法は [../kotlin-wasm.md](../kotlin-wasm.md) を参照。

## OPFS に保存されたファイルを Playwright で確かめる
`page.evaluate` の中で `navigator.storage.getDirectory()` から `entries()` を再帰的にたどれば、ファイルの中身をすべて取り出せる。
同じ context の中なら、リロードしても OPFS は残る。`http://127.0.0.1` は secure context なので OPFS が使える。
移行を確かめるときは、最初のページで `localStorage` に旧データを入れ、OPFS のディレクトリを `removeEntry(name, { recursive: true })` で消してからリロードする。
このとき最初のページの wasm の読み込みが中断され、`WebAssembly compilation aborted` の pageerror が出るが、無視してよい。
Playwright の起動手順は [../cloud-session.md](../cloud-session.md) の「Kotlin/Wasm を webpack なしで Chromium に出す」を参照。
