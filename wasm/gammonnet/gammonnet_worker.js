// gammonnet_worker.js
// gammonNet(WASM)をWeb Workerで動かす。wildbg_worker.js と同じ {id,method,args} / {id,ok,value|error} 形式。
// 入力はアプリのXGID文字列(盤面・ダイス・キューブ・スコアを含む)。変換は gammonNet 自身のコーデックに任せる。
import { Evaluator } from './evaluator.mjs';
import factory from './gammonnet-simd.mjs';

let enginePromise;

function loadEngine() {
  enginePromise ??= (async () => {
    const files = await (await fetch('./manifest.json')).json();
    const getBytes = async (name) => new Uint8Array(await (await fetch('./' + name)).arrayBuffer());
    const ev = await Evaluator.create(factory, await getBytes(files.network_fp16));
    ev.loadPrune(await getBytes(files.prune_fp16), files.prune_k);
    return { ev, version: files.version };
  })();
  return enginePromise;
}

// 着手表記(手番側視点) "bar/20 8/5* 6/2(2) 13/7/5" -> [{from,to},...] (25=バー, 0=オフ)
export function parseNotation(notation) {
  const pt = (s) => (s === 'bar' ? 25 : s === 'off' ? 0 : Number(s));
  const moves = [];
  for (const tok of notation.trim().split(/\s+/).filter(Boolean)) {
    const m = tok.match(/^([^()]+?)(?:\((\d)\))?$/);
    if (!m) { throw new Error('着手表記を解釈できません: ' + notation); }
    const pts = m[1].replace(/\*/g, '').split('/').map(pt);
    if (pts.length < 2 || pts.some(Number.isNaN)) { throw new Error('着手表記を解釈できません: ' + notation); }
    for (let r = 0; r < Number(m[2] || 1); r++) {
      for (let i = 0; i + 1 < pts.length; i++) { moves.push({ from: pts[i], to: pts[i + 1] }); }
    }
  }
  return moves;
}

// XGIDから policy() に渡す共通引数を組み立てる。キューブ所有は手番側から見た 0=センター/1=自分/2=相手
function policyContext(ev, xgidstr, opts) {
  const xg = xgidstr.replace(/^(XGID=[^:]*:[^:]*:[^:]*:[^:]*:)D:/, '$100:'); //ダブル提示中("D")を無害なダイスに置換
  const { board, fields: f } = ev.positionFromXgid(xg);
  const t = f.turn; //+1=大文字側, -1=小文字側
  const useMatch = f.matchLength > 0;
  const scMover = (t === 1) ? f.scoreUpper : f.scoreLower;
  const scOpp = (t === 1) ? f.scoreLower : f.scoreUpper;
  return {
    board,
    ctx: {
      d1: f.die1, d2: f.die2,
      cube: 2 ** f.cubePower,
      cubeOwner: f.cubeOwner === 0 ? 0 : (f.cubeOwner === t ? 1 : 2),
      jacoby: !useMatch && !!opts.jacoby,
      useMatch,
      awayOnRoll: useMatch ? f.matchLength - scMover : 0,
      awayOpponent: useMatch ? f.matchLength - scOpp : 0,
      crawford: useMatch && f.flags !== 0,
      level: opts.level || 'normal',
    },
  };
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

self.addEventListener('message', (event) => {
  void (async () => {
    const { id, method, args } = event.data;
    try {
      const { ev, version } = await loadEngine();
      let value;
      switch (method) {
        case 'initialize':
          value = { revision: version };
          break;
        case 'move': { // args: [xgid, opts]  -> {moves:[{from,to}], notation, equity}
          const { board, ctx } = policyContext(ev, args[0], args[1] || {});
          const r = ev.policy(board, { pending: 'move', ...ctx });
          value = { moves: r.play ? parseNotation(r.play.notation) : [], notation: r.play ? r.play.notation : '', equity: r.equityA };
          break;
        }
        case 'cube': { // args: [xgid, opts]  -> {shouldDouble}
          const { board, ctx } = policyContext(ev, args[0], args[1] || {});
          const r = ev.policy(board, { pending: 'cube', ...ctx });
          value = { shouldDouble: r.action === 'double', equityA: r.equityA, equityB: r.equityB };
          break;
        }
        case 'take': { // args: [xgid, opts]  -> {shouldTake}
          // ダブル提示後のXGIDは手番が応答側に切り替わっている。policy('take')は手番側=ダブルした側として
          // 渡す仕様なので、手番を反転してダブルした側の局面にする(キューブ所有もダブルした側から見た値になる)
          const f = args[0].split(':');
          f[3] = String(-Number(f[3]));
          const { board, ctx } = policyContext(ev, f.join(':'), args[1] || {});
          const r = ev.policy(board, { pending: 'take', ...ctx });
          value = { shouldTake: r.action === 'take', equityA: r.equityA, equityB: r.equityB };
          break;
        }
        default:
          throw new Error(`Unknown gammonNet worker method: ${method}`);
      }
      self.postMessage({ id, ok: true, value });
    } catch (error) {
      self.postMessage({ id, ok: false, error: errorMessage(error) });
    }
  })();
});
