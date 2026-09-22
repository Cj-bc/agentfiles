---
name: github-actions-yaml-frontmatter
description: awk で YAML frontmatter を生成する GitHub Actions の罠 — 閉じ `---` の外に出る挿入行、`[...]` の未クォート、org-modeタイムスタンプ形式の取り違え
type: reference
---

## 挿入行は「閉じ `---` を print する前」に置く
`/^---$/` にマッチさせて、その行を `print` した*後*に追加行を `print` すると、
追加行は frontmatter の外（Markdown 本文側）に出てしまう。

```awk
# NG: publishDate/modDatetime が閉じ `---` の後、本文側に漏れる
/^---$/ { print; print "publishDate: [" dt "]"; next }
```

frontmatter 内に既に埋めるべき空フィールド（例: `date: `）があるなら、
閉じ `---` を待たずにそのフィールド自体にマッチして置き換えるほうが安全。

```awk
# OK: 空の `date:` 行を見つけて、その場で他のフィールドごと埋める
/^date: *$/ {
  print "date: \"[" dt "]\""
  print "publishDate: \"[" dt "]\""
  print "modDatetime: \"[" dt "]\""
  next
}
```

## YAML の `[...]` はクォートしないと配列(flow sequence)になる
frontmatter の値に `[2026-09-18 Fri 00:46]` のような角括弧付き文字列をそのまま書くと、
YAML パーサーはそれを配列として解釈してしまう。文字列として使いたいときは
`"[...]"` のように必ずクォートする。

## org-mode タイムスタンプ形式は `[YYYY-MM-DD Day HH:MM]`
秒やタイムゾーンオフセットを含む ISO 8601 (`[2026-09-18 00:46:54+00:00]`) ではなく、
曜日の省略形を含み秒を持たない `[2026-09-18 Fri 00:46]` が org-mode の正しい形式。
`date` コマンドでは `date +'%Y-%m-%d %a %H:%M'` で生成できる。

---

背景: `Cj-bc/blog` の `new-post-from-issues.yaml` が Issue から生成した post で、
上記3つの不具合が同時に発生し、Cj-bc が手動で4コミットかけて直した
（[blog#134](https://github.com/Cj-bc/blog/pull/134)）。その修正内容をワークフロー側に
反映したのが [blog#135](https://github.com/Cj-bc/blog/pull/135)。
