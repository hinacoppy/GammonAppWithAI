// BgAiGammonNet_class.js
// gammonNet(WASM)版のAI。BgAiWildbgと同じインターフェース(ready/bestPlay/shouldDouble/shouldTake)を持つ。
// gammonNetはXGID文字列を直接受け取るので、盤面配列(第1引数)は無視し、最後の引数 xgidstr を使う。
'use strict';

class BgAiGammonNet {
  constructor(workerUrl = 'wasm/gammonnet/gammonnet_worker.js', opts = {}) {
    this.opts = opts; // {jacoby: bool, level: 'instant'|'normal'|'thorough'}
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
