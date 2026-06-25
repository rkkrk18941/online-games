/* ============================================================
   mp.js — 静的HTMLゲーム用の小さなリアルタイム同期部品
   ------------------------------------------------------------
   モデル: ホスト権威型 (host-authoritative)
     - 「ホスト」がゲーム状態(state)を1つだけ保持する。
     - 参加者(クライアント)は「アクション」をホストへ送るだけ。
     - ホストがアクションを適用して新しいstateを全員へ配信する。
   これにより、ゲーム本体のロジックはそのまま再利用できる。

   3つの通信方式 (transport):
     'none'      … 同期なし。1台で完結（オフライン/CPU対戦/交代プレイ）
     'broadcast' … 同一PCの別タブ間 (BroadcastChannel)。設定不要・動作確認用
     'firebase'  … 遠隔の友達と (Firebase Realtime Database)。要 firebase-config.js

   使い方:
     MP.create({ room, name, transport })  // ホストになる
     MP.join({ room, name, transport })    // 参加する
     MP.onState(fn)        // fn(state)    … 全員: 最新stateを受信
     MP.pushState(obj)     //              … ホストのみ: stateを配信
     MP.sendAction(obj)    //              … 全員: アクションをホストへ
     MP.onAction(fn)       // fn(action)   … ホストのみ: 受信したアクション
     MP.onPeers(fn)        // fn(peers[])  … 接続中の参加者一覧
     MP.leave()
   公開プロパティ: MP.isHost, MP.clientId, MP.room, MP.transport
   ============================================================ */
(function (global) {
  "use strict";

  const FB_VER = "10.12.2";
  const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 紛らわしい I,O,0,1 を除外

  function randId(n) {
    let s = "";
    for (let i = 0; i < n; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    return s;
  }
  function loadScript(src) {
    return new Promise((res, rej) => {
      const el = document.createElement("script");
      el.src = src; el.onload = res; el.onerror = () => rej(new Error("読み込み失敗: " + src));
      document.head.appendChild(el);
    });
  }

  const MP = {
    isHost: false,
    clientId: randId(8),
    room: null,
    transport: null,
    _stateCb: null,
    _actionCb: null,
    _peersCb: null,
    _impl: null,

    onState(fn)  { this._stateCb = fn;  return this; },
    onAction(fn) { this._actionCb = fn; return this; },
    onPeers(fn)  { this._peersCb = fn;  return this; },

    _emitState(s)  { if (this._stateCb)  this._stateCb(s); },
    _emitAction(a) { if (this.isHost && this._actionCb) this._actionCb(a); },
    _emitPeers(p)  { if (this._peersCb)  this._peersCb(p); },

    async create(opts) { return this._start(opts, true); },
    async join(opts)   { return this._start(opts, false); },

    async _start(opts, asHost) {
      opts = opts || {};
      this.isHost = asHost;
      this.room = (opts.room || randId(4)).toUpperCase();
      this.name = opts.name || "Player";
      this.transport = opts.transport || "none";
      if (this.transport === "firebase")      this._impl = new FirebaseT(this);
      else if (this.transport === "broadcast") this._impl = new BroadcastT(this);
      else                                     this._impl = new NoneT(this);
      await this._impl.start();
      return this.room;
    },

    pushState(obj) { if (this.isHost && this._impl) this._impl.pushState(obj); },
    sendAction(obj) {
      if (!this._impl) return;
      // ホスト自身のアクションは即ローカル処理（自己エコーに依存しない）
      if (this.isHost) { this._emitAction(Object.assign({ _by: this.clientId }, obj)); }
      else { this._impl.sendAction(Object.assign({ _by: this.clientId }, obj)); }
    },
    leave() { if (this._impl) this._impl.stop(); this._impl = null; this.room = null; },
  };

  /* ---- transport: none （単独・同期なし） ---- */
  class NoneT {
    constructor(mp) { this.mp = mp; }
    async start() { this.mp.isHost = true; }
    pushState() {}
    sendAction() {}
    stop() {}
  }

  /* ---- transport: broadcast （同一オリジンのタブ間） ---- */
  class BroadcastT {
    constructor(mp) { this.mp = mp; this.lastState = null; this.peers = {}; }
    async start() {
      this.ch = new BroadcastChannel("mp-" + this.mp.room);
      this.ch.onmessage = (e) => this._onMsg(e.data);
      this._announce();
      this.timer = setInterval(() => this._announce(), 3000);
      // 参加者はホストへ現在のstate要求
      if (!this.mp.isHost) this.ch.postMessage({ kind: "need-state", from: this.mp.clientId });
    }
    _announce() {
      this.ch.postMessage({ kind: "presence", from: this.mp.clientId, name: this.mp.name, host: this.mp.isHost, ts: Date.now() });
      // 古いpeerを掃除
      const now = Date.now(); let changed = false;
      for (const id in this.peers) if (now - this.peers[id].ts > 9000) { delete this.peers[id]; changed = true; }
      if (changed) this.mp._emitPeers(Object.values(this.peers));
    }
    _onMsg(m) {
      if (!m || m.from === this.mp.clientId) return;
      if (m.kind === "presence") {
        this.peers[m.from] = { clientId: m.from, name: m.name, host: m.host, ts: Date.now() };
        this.mp._emitPeers(Object.values(this.peers));
      } else if (m.kind === "state") {
        this.lastState = m.data; this.mp._emitState(m.data);
      } else if (m.kind === "action") {
        if (this.mp.isHost) this.mp._emitAction(m.data);
      } else if (m.kind === "need-state") {
        if (this.mp.isHost && this.lastState != null) this.ch.postMessage({ kind: "state", data: this.lastState });
        this._announce();
      }
    }
    pushState(obj) { this.lastState = obj; this.ch.postMessage({ kind: "state", data: obj }); }
    sendAction(obj) { this.ch.postMessage({ kind: "action", data: obj }); }
    stop() { clearInterval(this.timer); if (this.ch) this.ch.close(); }
  }

  /* ---- transport: firebase （遠隔） ---- */
  class FirebaseT {
    constructor(mp) { this.mp = mp; }
    async start() {
      if (!global.FIREBASE_CONFIG) throw new Error("Firebase未設定です（lib/firebase-config.js）");
      if (!global.firebase) {
        await loadScript(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-app-compat.js`);
        await loadScript(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-database-compat.js`);
      }
      if (!global.firebase.apps.length) global.firebase.initializeApp(global.FIREBASE_CONFIG);
      this.db = global.firebase.database();
      const base = "rooms/" + this.mp.room;
      this.refState = this.db.ref(base + "/state");
      this.refActs  = this.db.ref(base + "/actions");
      this.refPeers = this.db.ref(base + "/peers");
      this.refMe    = this.db.ref(base + "/peers/" + this.mp.clientId);

      // presence（接続が切れたら自動削除）
      this.refMe.set({ name: this.mp.name, host: this.mp.isHost, ts: Date.now() });
      this.refMe.onDisconnect().remove();
      this.peerTimer = setInterval(() => this.refMe.child("ts").set(Date.now()), 5000);
      this.refPeers.on("value", (snap) => this.mp._emitPeers(Object.values(snap.val() || {})));

      // state 受信
      this.refState.on("value", (snap) => { const v = snap.val(); if (v != null) this.mp._emitState(v); });

      // ホストはアクションを順次処理して削除
      if (this.mp.isHost) {
        this.refActs.on("child_added", (snap) => {
          const a = snap.val(); snap.ref.remove();
          if (a) this.mp._emitAction(a);
        });
      }
    }
    pushState(obj) { this.refState.set(obj); }
    sendAction(obj) { this.refActs.push(obj); }
    stop() {
      clearInterval(this.peerTimer);
      if (this.refState) this.refState.off();
      if (this.refActs)  this.refActs.off();
      if (this.refPeers) this.refPeers.off();
      if (this.refMe)    this.refMe.remove();
    }
  }

  MP.randCode = () => randId(4);
  global.MP = MP;
})(window);
