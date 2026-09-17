---
profile_id: python
markers: ["pyproject.toml", "setup.py", "requirements.txt"]
---

# プロファイル: Python

## 規約ファイル候補

- `CLAUDE.md` / `AGENTS.md` / `CONTRIBUTING.md` / `README.md`
- `pyproject.toml`（`[tool.ruff]` / `[tool.mypy]` / `[tool.pytest.ini_options]` は規約の実体）
- `setup.cfg` / `.pre-commit-config.yaml` / `mypy.ini` / `tox.ini`

## テスト（既定値）

- 命名: `tests/**` / `test_*.py` / `*_test.py`
- 実行: `pytest`（`pyproject.toml` / `tox.ini` の設定を優先）
- レビュワーに実行させるか: 仮想環境が用意済みで軽いなら可。
  **依存のインストール（`pip install`）は禁止。**

## 生成物パターン

- `__pycache__/` `*.pyc` `.venv/` `venv/` `.mypy_cache/` `.pytest_cache/`
  `dist/` `build/` `*.egg-info/` `.ipynb_checkpoints/`
- `.env`（**混入は 🔴**）

## digest 対象（巨大な機械生成テキスト）

- `poetry.lock` `uv.lock` `Pipfile.lock` `requirements*.txt`（生成されたもの）
  — 抜き出す情報: 追加・削除・更新された直接依存
- `*.ipynb` — 抜き出す情報: 変更されたセルの位置と種類、出力セルの有無
  （**出力セルの混入は指摘対象**。秘密情報や巨大な base64 が混ざる）
- 生成コード（protobuf `*_pb2.py`、Alembic のマイグレーション等）

## 機械チェック（監督がフェーズ 1-4 で実行する）

1. **依存と lock の同伴**: `pyproject.toml` の依存が変わったのに lock が未更新（逆も）。
2. **`.env` / 認証情報の混入**、`*.ipynb` の出力セル残存。
3. **`# type: ignore` / `# noqa` の新規追加**を位置付きで列挙。
4. **`print` / `breakpoint()` / `pdb` の新規追加**（ライブラリ・本番コード側のみ）。

## レビュー観点（`{{ECOSYSTEM_CHECKS}}` に流し込む本文）

- 可変デフォルト引数（`def f(x=[])`）、クラス変数とインスタンス変数の取り違え。
- 例外: 裸の `except:` / `except Exception` での握り潰し、
  `raise ... from e` を欠いた再送出（原因の消失）。
- リソース: `open` / ソケット / DB 接続に `with` を使っていない、
  `contextlib` のクリーンアップ漏れ。
- 非同期: `async def` 内のブロッキング呼び出し、`await` 忘れ、
  `asyncio.create_task` の参照を保持せず GC で消える、
  `CancelledError` を `except Exception` で飲み込む。
- 型: `Optional` の扱い、`Any` への逃げ、実行時に効かない型注釈への依存。
- 変更に対する後方互換（公開関数のシグネチャ、キーワード引数の名前）。
- ループ内の I/O・N+1 クエリ、不要な list 化（ジェネレータで済む箇所）。

## このエコシステム由来の典型的な偽陽性

- 型注釈が無い箇所を一律に指摘する（`mypy` 設定が緩いプロジェクトでは規約ではない）。
- lint 設定で off にされているスタイル規則（行長・import 順）を「規約違反」と呼ぶ。
- 動的属性・メタプログラミングを「未定義」と誤認する
  （`getattr` / `__getattr__` / プラグイン機構）。
