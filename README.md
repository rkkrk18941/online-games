# 🎲 みんなのゲーム置き場

友達とオンラインで遊べる、手作りHTMLゲーム集。
1ファイルのHTMLゲームを置くだけで公開でき、`mp.js` を使えばリアルタイム対戦にもできます。

公開URL（GitHub Pages）: `https://<あなたのユーザー名>.github.io/online-games/`

---

## フォルダ構成

```
online-games/
├─ index.html              トップ（ゲーム一覧）
├─ games/
│   └─ money-lending/index.html   マネー・レンディング（オンライン対応）
├─ lib/
│   ├─ mp.js               再利用するリアルタイム同期部品
│   └─ firebase-config.js  Firebase設定（オンライン対戦に必要）
├─ templates/new-game/     新作の雛形
├─ .nojekyll               GitHub Pages がそのまま配信するための目印
└─ README.md
```

---

## 3つのプレイモード

ゲームはどれも同じ仕組み（`mp.js`）で動き、3モードに対応します。

| モード | 設定 | 用途 |
|---|---|---|
| **オフライン** | 不要 | 1台で交代プレイ・CPU対戦 |
| **ローカル同期** | 不要 | 同じPCの別タブ間。動作確認用 |
| **オンライン** | **不要**（P2P）／任意でFirebase | 遠隔の友達と各自の端末で対戦 |

すべて**設定ゼロで今すぐ動きます**。
オンラインは既定で **Trystero（P2P・アカウント不要）** を使い、友達の端末同士を無料の公開中継経由で直結します。
一部の厳しい回線では繋がりにくいことがあり、その場合は下の **Firebase 設定（任意）** をすると安定し、自動でそちらに切り替わります。

---

## （任意）より安定させたい時：Firebase 設定（無料・1回だけ）

> 既定の Trystero（P2P）で問題なく遊べていれば、この設定は不要です。
> 「誰かが繋がらない」「途中で切れる」場合に設定すると安定し、自動で Firebase 経由に切り替わります。

1. https://console.firebase.google.com/ にアクセスし、Googleでログイン
2. 「プロジェクトを追加」→ 名前を付けて作成（GoogleアナリティクスはオフでOK）
3. 左メニュー **構築 → Realtime Database** → 「データベースを作成」
   - ロケーションは任意（asia-southeast1 など）
   - セキュリティルールは **「テストモードで開始」** を選択
4. 作成後、**ルール** タブを開き、以下を貼って「公開」:
   ```json
   {
     "rules": {
       "rooms": {
         ".read": true,
         ".write": true
       }
     }
   }
   ```
   ※ 友達同士で遊ぶ用途の簡易ルールです。誰でも `rooms` を読み書きできます。
   気になる場合は使う時だけ有効にする運用でOK。
5. 左上「⚙ → プロジェクトの設定」→ 「マイアプリ」で **ウェブアプリ（</>）** を追加
6. 表示される `firebaseConfig` を `lib/firebase-config.js` に貼り付け:
   ```js
   window.FIREBASE_CONFIG = {
     apiKey: "AIza...",
     authDomain: "xxx.firebaseapp.com",
     databaseURL: "https://xxx-default-rtdb.firebaseio.com",  // ← これが必須
     projectId: "xxx",
     appId: "1:...:web:..."
   };
   ```
   - `databaseURL` が無いとオンラインで動きません。Realtime Database のページ上部のURLでもOK。

これで「オンラインで部屋を作る」が使えるようになります。
**この apiKey は秘密鍵ではなく公開前提のID**なので、GitHubに上げて問題ありません。

---

## 公開する（GitHub Pages）

初回セットアップは下の「初回セットアップ」を参照。一度設定すれば、以降の更新は：

```powershell
cd C:\Users\USER\Desktop\online-games
git add -A
git commit -m "ゲーム更新"
git push
```

push の数十秒後に `https://<ユーザー名>.github.io/online-games/` へ反映されます。

---

## 新しいゲームを追加する

1. `templates/new-game/` を `games/＜新ゲーム名＞/` にコピー
2. `index.html` の `initialState` / `applyAction` / `view` を自分のゲームに書き換え
   （`mp.js` の同期・部屋コードはそのまま使える）
3. `index.html`（トップ）の `GAMES` 配列に1行追加:
   ```js
   { dir:"＜新ゲーム名＞", emoji:"🎯", title:"タイトル", desc:"説明", online:true },
   ```
4. `git add -A && git commit -m "新ゲーム追加" && git push`

オンライン不要の単純なゲームなら、`mp.js` を使わず普通のHTMLを置くだけでも一覧に並びます。

---

## 動作確認（ローカル）

ファイルを直接ダブルクリックでも動きますが、`file://` だと一部ブラウザで
読み込み制限が出ることがあります。簡易サーバーで開くのが確実です：

```powershell
cd C:\Users\USER\Desktop\online-games
python -m http.server 8000
# → ブラウザで http://localhost:8000/
```

「ローカル同期」モードは同じPCの**別タブ**で同じ部屋コードを入れて参加すると、2人プレイの動きを確認できます。
