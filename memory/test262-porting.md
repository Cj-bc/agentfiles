---
name: test262-porting
description: test262 の Temporal テストを java.time 流の API へ移植するときの読み替え — overflow オプションは無い、Duration は年月→日の順、著作権表記は元ファイルからそのまま写す、除外リストの glob が移植済みのファイルまで含んでいないか確かめる
type: reference
---

paranoid-time.flix で `Temporal.PlainDate` のテストを `LocalDate`（java.time 準拠）へ移植したときの知見。

## 読み替え
- **`overflow` オプション**: java.time には無い。`plusMonths` / `plusYears` / `withYear` / `withMonth` は常に月末へ丸める（constrain）。
  constrain 側だけを移植し、`{ overflow: "reject" }` で例外を投げる側は対応物なしとして外す。
  逆に `withMonth(13)` や `withDayOfMonth(31)`（11月）は java.time では例外。Temporal の `with` は constrain するので、ここは reject 側の主張として移植する。
- **単位の混ざった Duration**: Temporal も java.time の `Period` も「年と月をまとめて足して月末に丸め、その後で週と日を足す」。
  `plusYears` → `plusMonths` と別々に足すと結果が変わる（2020-02-29 に 1 年足すと、先に 2021-02-28 に丸められる）。
  harness に `tryAddDuration(d, y, m, w, d)` = `plusMonths(12y + m)` → `plusDays(7w + d)` を置いた。
- **年の文字列表現**: Temporal は 0〜9999 以外の年を符号付き6桁（`-000001`）、java.time は符号付き4桁以上（`-0001`、`+10000`）。
- 名前に `overflow` を含むファイルでも、中身は範囲の端のテスト（`overflow-adding-months-to-max-year.js` など）のことがある。

## 移植ファイルの著作権表記は、元ファイルの1行目をそのまま写す
BSD ライセンスは表記をそのまま残すことを求める。シェル関数で `printf '// Copyright %s. All rights reserved.'` のように組み立て、
引数を `"(C) 2022 Igalia, S.L."` で渡したら、末尾のピリオドが重なって `S.L..` になった（オーナーが後で直した）。
**組み立てず、`head -1` で元ファイルから取る。** 書式に区切り文字を足す関数は、引数側の末尾と重ならないか確かめる。

## 除外リストは、移植済みのファイルと突き合わせる
「`overflow-*.js` は移植しない」「`from/` は移植しない」のように glob やディレクトリ単位で書くと、移植済みのファイルまで含んでしまう。
書いたら、移植済みのファイル一覧と照らして例外を名前で書く。逆に、property bag を使う `from/` でも `{year, month, day}` だけのケース
（`out-of-range.js` など）はコンストラクタにそのまま読み替えられ、後から移植することになった（paranoid-time.flix#21）。
