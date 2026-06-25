/* ============================================================
   Firebase 設定（オンライン対戦に必要）
   ------------------------------------------------------------
   ここに自分の Firebase プロジェクトの設定を貼り付けると、
   遠隔の友達と「オンライン」モードで遊べるようになります。

   設定が空（null）のままでも、
   「オフライン」「ローカル同期」モードは動きます。

   ★ 設定の取り方は README.md の「Firebase を用意する」を参照。
   ★ この apiKey は秘密鍵ではありません（Web公開前提の公開IDです）。
      アクセス制御は Realtime Database のルールで行います。
   ============================================================ */
window.FIREBASE_CONFIG = null;

/* 取得後はこの形に置き換える（例）:
window.FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com",
  projectId: "your-project",
  appId: "1:1234567890:web:abcdef"
};
*/
