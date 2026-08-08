# Starfall Defender

ブラウザだけで遊べる本格派シューティングゲームです。プレイヤーは宇宙船を操作して、敵を撃墜しながら回復アイテムとパワーアップを活用し、ボス戦を突破してスコアランキングに名を残します。

## 追加機能

- 回復アイテムでシールドを回復
- 敵を倒すことでパワーが上がる仕組み
- ステージ進行に合わせた敵増加とボス戦
- ボスのフェーズ分けと専用演出
- Web Audio API を使ったBGMと効果音
- ローカルストレージに保存するセーブ/ロードとスコアランキング
- ステージごとの背景変化と画面揺れ演出

## 操作方法

1. [index.html](index.html) をブラウザで開く
2. ゲーム開始ボタンを押す
3. WASD / 矢印キーで移動し、スペースまたはクリックで射撃
4. S でセーブ、L でロード、R で再スタート

## GitHub への公開方法

このリポジトリは GitHub にそのまま公開できる構成です。

### 1. GitHub へアップロード

```bash
git add .
git commit -m "Initial release"
git push origin main
```

### 2. CI/CD

GitHub Actions を利用して、main ブランチへ push / pull request が来たときに自動チェックを実行します。

- 実行される内容
  - 必須ファイルの存在確認
  - HTML の参照整合性チェック

設定ファイル: [.github/workflows/ci.yml](.github/workflows/ci.yml)

### 3. Windows で使うバッチ

Windows から簡単に GitHub へ反映したい場合は、[deploy.bat](deploy.bat) を使えます。

```bat
deploy.bat
```

実行すると、コミットメッセージを入力して、そのまま `git add / commit / push` まで進めます。

```bat
@echo off
setlocal
set REPO_DIR=%~dp0
cd /d "%REPO_DIR%"

where git >nul 2>nul
if errorlevel 1 (
  echo Git is not installed.
  exit /b 1
)

if not exist .git (
  echo This directory is not a Git repository.
  exit /b 1
)

set /p COMMIT_MSG=Commit message: 
if "%COMMIT_MSG%"=="" (
  set COMMIT_MSG=Update shooting game
)

git add .
git commit -m "%COMMIT_MSG%"
git push origin main

echo.
echo Deployment completed.
```

### 4. すぐ見られるコマンド一覧

```bash
# 変更をコミットして公開
git add .
git commit -m "Update"
git push origin main

# Windows ならこれだけでOK
deploy.bat
```

### 5. CI/CD の流れ

```text
push / pull request → GitHub Actions 起動 → 必須ファイル確認 → HTML 参照確認 → 結果表示
```

## ファイル構成

- [index.html](index.html) - ゲーム画面
- [style.css](style.css) - スタイル
- [game.js](game.js) - ゲームロジック
- [.github/workflows/ci.yml](.github/workflows/ci.yml) - CI 設定
- [deploy.bat](deploy.bat) - GitHub へ反映するためのバッチ
- [README.md](README.md) - ドキュメント

## 開発メモ

- ボスの攻撃パターンや敵の弾幕は、今後さらに増やせます
- 画像アセットや効果音を差し込めば、より完成度の高いゲームにできます
- CI/CD を活用して、公開前後の品質チェックを自動化できます
