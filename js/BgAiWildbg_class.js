// BgAiWildbg_class.js
// wildbg(WASM)をWeb Workerで動かし、XGIDの局面と相互変換して着手・キューブ判断を返す
'use strict';

class BgAiWildbg {
  constructor(workerUrl = 'wasm/wildbg/wildbg_worker.js') {
    this.seq = 0;
    this.pending = new Map();
    this.worker = new Worker(workerUrl, { type: 'module' });
    this.worker.onmessage = (e) => {
      const p = this.pending.get(e.data.id);
      this.pending.delete(e.data.id);
      if (p) { e.data.ok ? p.resolve(e.data.value) : p.reject(new Error(e.data.error)); }
    };
    this.worker.onerror = (e) => {
      for (const p of this.pending.values()) { p.reject(new Error(e.message)); }
      this.pending.clear();
    };
    this.ready = this.call('initialize');
  }

  call(method, ...args) {
    return new Promise((resolve, reject) => {
      const id = ++this.seq;
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, method, args });
    });
  }

  // 手番側の最善手 [{from,to}, ...] (手番側視点のポイント番号。25=バー, 0=オフ)
  async bestPlay(board, die1, die2) {
    const r = await this.call('analyze', board, die1, die2, false);
    return r.moves.length ? r.moves[0].play : [];
  }

  // 手番側が今ダブルすべきか
  async shouldDouble(board) {
    return (await this.call('cube_info', board)).should_double;
  }

  // 手番側(=ダブルを出す側)の盤面から、相手がテイクすべきか
  async shouldTake(doublerBoard) {
    return (await this.call('cube_info', doublerBoard)).should_take;
  }

  // XGID位置文字列(26文字)をwildbg盤面(手番側が正, 手番側視点)に変換する
  // XGID: 大文字=turn+1側, 小文字=turn-1側, 'A'=1..'O'=15, '-'=0
  //   index0=小文字側のバー, 1..24=ポイント, 25=大文字側のバー
  static xgidPosToBoard(pos, turn) {
    const board = new Array(26).fill(0);
    for (let i = 0; i < 26; i++) {
      const ch = pos[i];
      if (ch === '-') { continue; }
      const upper = (ch === ch.toUpperCase());
      const n = ch.charCodeAt(0) & 31;
      if (turn === 1) { board[i] = upper ? n : -n; }
      else            { board[25 - i] = upper ? -n : n; }
    }
    return board;
  }

  static boardToXgidPos(board, turn) {
    const out = new Array(26).fill('-');
    for (let b = 0; b < 26; b++) {
      const v = board[b];
      if (!v) { continue; }
      const upper = (turn === 1) ? (v > 0) : (v < 0);
      const ch = String.fromCharCode(64 + Math.abs(v));
      out[(turn === 1) ? b : 25 - b] = upper ? ch : ch.toLowerCase();
    }
    return out.join('');
  }
}
