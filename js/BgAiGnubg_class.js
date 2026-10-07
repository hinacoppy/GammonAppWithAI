// BgAiGnubg_class.js
// GNU Backgammon(gnubg-web WASM)版のAI。BgAiWildbgと同じインターフェース(ready/bestPlay/shouldDouble/shouldTake)を持つ。
// gnubgはXGID文字列を直接受け取るので、盤面配列(第1引数)は無視し、最後の引数 xgidstr を使う。
// gnubg.js は通常スクリプトのため、Worker は classic(type指定なし)で起動する。
'use strict';

class BgAiGnubg {
  constructor(workerUrl = 'wasm/gnubg/gnubg_worker.js', opts = {}) {
    this.opts = opts; // {jacoby: bool, level: 'instant'|'normal'|'thorough'}
    this.seq = 0;
    this.pending = new Map();
    this.worker = new Worker(workerUrl);
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

  async bestPlay(board, die1, die2, xgidstr) {
    return (await this.call('move', xgidstr, this.opts)).moves;
  }

  async shouldDouble(board, xgidstr) {
    return (await this.call('cube', xgidstr, this.opts)).shouldDouble;
  }

  // xgidstr: ダブル提示後(手番が応答側に切り替わった後)のXGID。ダブルした側への反転はWorker側で行う
  async shouldTake(board, xgidstr) {
    return (await this.call('take', xgidstr, this.opts)).shouldTake;
  }
}
