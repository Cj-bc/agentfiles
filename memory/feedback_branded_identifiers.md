---
name: Wrap primitive identifiers in their own types
description: 識別子を文字列や数値などのプリミティブで持つときは、専用の型（branded type）で包む
type: feedback
---

ID や名前など、何かを識別するための値を `String` や `Int` などのプリミティブで持つときは、
そのまま使わずに専用の型で包む。Flix なら `pub enum ModelId with Eq, ToString { case ModelId(String) }` のようにする。

**Why:** 2026-11-04、flix-agent の PR で `AssistantMessage.model: String` について、
ユーザーから「識別子として文字列や数値などのプリミティブを用いる場合は、branded type にするようにしてください」と指示された。
種類の違う識別子（モデル ID とツール呼び出しの ID など）を取り違えても、型で検出できるようにするため。

**How to apply:** 新しく型を定義するときに、フィールドが識別子かどうかを確かめる。
識別子なら、その種類ごとに専用の型を作る（`ModelId`、`ToolCallId`、`ToolName` など）。
URL や本文など、識別子でない値はプリミティブのままでよい。
