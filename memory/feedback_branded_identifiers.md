---
name: Wrap primitive identifiers in their own types
description: 識別子を文字列や数値などのプリミティブで持つときは、専用の型（branded type）で包む
type: feedback
---

ID や名前など、何かを識別するための値を `String` や整数などのプリミティブで持つときは、
そのまま使わずに専用の型で包む。Flix なら `pub enum ModelId with Eq, ToString { case ModelId(String) }` のようにする。

**Why:** 2026-11-04、flix-agent の PR で `AssistantMessage.model: String` について、
ユーザーから「識別子として文字列や数値などのプリミティブを用いる場合は、branded typeにするようにしてください」と指示された。
狙いは、種類の違う識別子（モデル ID とツール呼び出しの ID など）を取り違えたときに、型で検出できるようにすること。

**How to apply:** 識別子が出てくる場所はすべて対象にする。レコードや enum のフィールドだけでなく、
関数の引数と戻り値、`Map` のキーなどのコレクションの要素も含む。新しく書くコードだけでなく、変更するコードにも当てはめる。
識別子なら、その種類ごとに専用の型を作る（`ModelId`、`ToolCallId`、`ToolName` など）。
URL や本文など、識別子でない値はプリミティブのままでよい。
