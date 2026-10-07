// gnubg_worker.js
// GNU Backgammon(gnubg-web の WASM ビルド)を Web Worker で動かす。GPL-3.0(NOTICE 参照)。
// gammonnet_worker.js と同じ {id,method,args} / {id,ok,value|error} 形式。入力はアプリの XGID 文字列。
// gnubg は状態を持つ CLI なので、判断のたびに "set xgid" で局面を設定してから "hint" の出力を読む。
// gnubg.js は通常スクリプト(module worker では動かない)なので、本 Worker は classic Worker として起動する。
'use strict';

const NOISE = ['falling back to ArrayBuffer instantiation', 'wasm streaming compile failed', 'file packager has copied file data into memory'];
let outBuf = [];
let cmdBuf = 0;
let enginePromise;
const G = globalThis; //ブラウザでは self と同一。Node(selfplay)のWorkerシムでは self が別物なので、gnubg.js が見るグローバルは globalThis で扱う

function loadEngine() {
  enginePromise ??= new Promise((resolve, reject) => {
    const onLine = (s) => { if (!NOISE.some((n) => s.startsWith(n))) { outBuf.push(s); } };
    G.Module = {
      print: onLine,
      printErr: onLine,
      //Node(selfplay)では globalThis.__GNUBG_DIR にファイルのあるディレクトリが入る
      locateFile: (p) => (typeof G.__GNUBG_DIR === 'string') ? G.__GNUBG_DIR + '/' + p : new URL(p, self.location.href).href,
      preRun: [() => { G.FS.init(() => null, null, null); }], //確認プロンプトに備えて標準入力は空にする
      onRuntimeInitialized: () => {
        try {
          G.Module._start();
          for (const c of ['set confirm new off', 'set confirm save off', 'set output mwc off', 'set automatic game on']) { runCmd(c); }
          resolve({ version: (runCmd('show version')[0] || '').trim() });
        } catch (e) { reject(e); }
      },
    };
    fetch('gnubg.js') //Worker のURL基準の相対パス
      .then((r) => { if (!r.ok) { throw new Error('gnubg.js fetch failed: ' + r.status); } return r.text(); })
      .then((src) => { (0, eval)(src); })
      .catch(reject);
  });
  return enginePromise;
}

function runCmd(text) {
  const M = G.Module;
  outBuf = [];
  if (!cmdBuf) { cmdBuf = M._malloc(4096); }
  const n = Math.min(text.length, 4095);
  for (let i = 0; i < n; i++) { M.setValue(cmdBuf + i, text.charCodeAt(i) & 0x7f, 'i8'); }
  M.setValue(cmdBuf + n, 0, 'i8');
  M._run_command(cmdBuf);
  return outBuf.slice();
}

// level: instant=0-ply / normal=1-ply / thorough=2-ply
const PLIES = { instant: 0, normal: 1, thorough: 2 };

// gnubg の "set xgid" は turn=-1 だとプロセスが終了してしまうため、盤面を鏡像にして turn=+1 に正規化する。
// (位置文字列を逆順+大小文字反転、キューブ所有の符号反転、スコア入替。ダイス・マッチ長などはそのまま)
// 着手のポイント番号は手番側視点の相対番号なので、鏡像にしても結果の解釈は変わらない。
function normalizeXgid(xgidstr) {
  const f = xgidstr.split(':');
  if (Number(f[3]) !== -1) { return xgidstr; }
  const pos = f[0].slice('XGID='.length);
  const mirrored = Array.from(pos, (ch, i) => {
    const c = pos[25 - i];
    return c === '-' ? c : (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase());
  }).join('');
  f[0] = 'XGID=' + mirrored;
  f[2] = String(-Number(f[2]) || 0);
  f[3] = '1';
  [f[5], f[6]] = [f[6], f[5]];
  return f.join(':');
}

// 局面を設定する。ダブル提示中("D")は set xgid が受け付けないため、呼び出し側が事前に変換しておくこと
function setPosition(xgidstr, opts) {
  const plies = PLIES[opts.level || 'normal'] ?? 1;
  runCmd(`set evaluation chequerplay evaluation plies ${plies}`);
  runCmd(`set evaluation cubedecision evaluation plies ${plies}`);
  const f = xgidstr.split(':');
  runCmd(`set jacoby ${(Number(f[8]) === 0 && opts.jacoby) ? 'on' : 'off'}`); //Jacoby は money game のときだけ
  const out = runCmd('set xgid ' + normalizeXgid(xgidstr));
  if (out.some((l) => /illegal|cannot|unknown/i.test(l))) { throw new Error('gnubg set xgid failed: ' + out.join(' ')); }
}

// XGIDの位置文字列から、手番側の各ポイントの駒数を数える(手番側視点: index 1..24=ポイント, 25=バー)
function ownCounts(xgidstr) {
  const s = xgidstr.split(':');
  const pos = s[0].slice('XGID='.length);
  const turn = Number(s[3]);
  const own = new Array(26).fill(0);
  for (let i = 0; i < 26; i++) {
    const ch = pos[i];
    if (ch === '-') { continue; }
    const isUpper = ch === ch.toUpperCase();
    if (isUpper !== (turn === 1)) { continue; } //相手の駒
    own[turn === 1 ? i : 25 - i] = ch.charCodeAt(0) & 31;
  }
  return own;
}

// 相手駒の数(手番側視点の点番号: index 1..24)。中間点がブロックされているかの判定に使う
function oppCounts(xgidstr) {
  const s = xgidstr.split(':');
  const pos = s[0].slice('XGID='.length);
  const turn = Number(s[3]);
  const opp = new Array(26).fill(0);
  for (let i = 0; i < 26; i++) {
    const ch = pos[i];
    if (ch === '-') { continue; }
    const isUpper = ch === ch.toUpperCase();
    if (isUpper === (turn === 1)) { continue; } //自分の駒
    opp[turn === 1 ? i : 25 - i] = ch.charCodeAt(0) & 31;
  }
  return opp;
}

// gnubg は両ダイスを使う1駒の動きを中間点を省いて書く("bar/14" = 6-5)。アプリは1ダイスずつの手が必要なので分解する。
// 1ダイスで足りる手(距離=ダイス目、またはオフでダイス目以下)を先に消費し、残りのダイスで複合の手を分解する。
function splitHops(moves, d1, d2, opp) {
  const pool = d1 === d2 ? [d1, d1, d1, d1] : [d1, d2];
  const take = (d) => { const i = pool.indexOf(d); if (i >= 0) { pool.splice(i, 1); return true; } return false; };
  const direct = (m) => (m.to === 0 ? pool.some((d) => d >= m.from) : pool.includes(m.from - m.to));
  const single = [], multi = [];
  for (const m of moves) { (direct(m) ? single : multi).push(m); }
  const out = new Map();
  for (const m of single) {
    if (m.to === 0) { // オフ: 距離ちょうどのダイスがあればそれ、無ければ大きい方で最小のダイスを使う
      const d = pool.includes(m.from) ? m.from : Math.min(...pool.filter((x) => x >= m.from));
      take(d);
    } else { take(m.from - m.to); }
    out.set(m, [m]);
  }
  for (const m of multi) {
    const dist = m.from - m.to; //オフの複合は想定しない(その場合はそのまま返す)
    let hops = null;
    if (m.to > 0) {
      const tryOrder = pool.length >= 2 && pool[0] + pool[1] === dist ? [pool[0], pool[1]] : null;
      const orders = tryOrder ? [[pool[0], pool[1]], [pool[1], pool[0]]] : [];
      if (!orders.length && pool.length >= 2) { // ゾロ目: dist をダイス目の連続で分解
        const d = pool[0]; const n = dist / d;
        if (Number.isInteger(n) && n <= pool.length) { orders.push(new Array(n).fill(d)); }
      }
      for (const ord of orders) {
        let p = m.from; const hs = []; let ok = true;
        for (const d of ord) { const np = p - d; if (np !== m.to && opp[np] >= 2) { ok = false; break; } hs.push({ from: p, to: np }); p = np; }
        if (ok) { hops = hs; for (const d of ord) { take(d); } break; }
      }
    }
    out.set(m, hops || [m]);
  }
  return moves.flatMap((m) => out.get(m));
}

// 着手表記は実行順ではないことがあるので、実行可能な順に並べ替える(gammonnet_worker.js と同じ)
function orderMoves(moves, own) {
  const cnt = own.slice();
  const rest = moves.slice();
  const out = [];
  while (rest.length) {
    let i = rest.findIndex((m) => cnt[m.from] > 0);
    if (i < 0) { i = 0; }
    const [m] = rest.splice(i, 1);
    cnt[m.from]--;
    if (m.to > 0) { cnt[m.to]++; }
    out.push(m);
  }
  return out;
}

// 着手表記(手番側視点) "bar/20 8/5* 6/2(2) 13/7/5" -> [{from,to},...] (25=バー, 0=オフ)
function parseNotation(notation, own) {
  const pt = (s) => (s === 'bar' ? 25 : s === 'off' ? 0 : Number(s));
  const moves = [];
  for (const tok of notation.trim().split(/\s+/).filter(Boolean)) {
    const m = tok.match(/^([^()]+?)(?:\((\d)\))?$/);
    if (!m) { throw new Error('Cannot parse move: ' + notation); }
    const pts = m[1].replace(/\*/g, '').split('/').map(pt);
    if (pts.length < 2 || pts.some(Number.isNaN)) { throw new Error('Cannot parse move: ' + notation); }
    for (let r = 0; r < Number(m[2] || 1); r++) {
      for (let i = 0; i + 1 < pts.length; i++) { moves.push({ from: pts[i], to: pts[i + 1] }); }
    }
  }
  return own ? orderMoves(moves, own) : moves;
}

const HINT_MOVE_RE = /^\s*1\.\s+(?:Cubeful|Cubeless)\s+\S+\s+(.+?)\s+(?:Eq\.|MWC):\s*([-+]?\d*\.?\d+)/;
const CUBE_OPT_RE = /^\s*\d+\.\s+((?:Re)?[Dd]ouble, (?:take|pass))\s+([-+]?\d*\.?\d+)/;

function cubeHint(lines) {
  let proper = '';
  const eq = {};
  for (const l of lines) {
    const o = CUBE_OPT_RE.exec(l);
    if (o) { eq[/take/.test(o[1]) ? 'take' : 'pass'] = parseFloat(o[2]); }
    const p = /Proper cube action:\s*(.+?)\s*(?:\(.*)?$/.exec(l);
    if (p) { proper = p[1].trim(); }
  }
  return { proper, eq };
}

function errorMessage(error) {
  if (error instanceof Error) { return error.message; }
  return (error && error.message) ? String(error.message) : String(error);
}

self.addEventListener('message', (event) => {
  void (async () => {
    const { id, method, args } = event.data;
    try {
      const { version } = await loadEngine();
      let value;
      switch (method) {
        case 'initialize':
          value = { revision: version };
          break;
        case 'move': { // args: [xgid, opts] -> {moves:[{from,to}], notation, equity}
          setPosition(args[0], args[1] || {});
          const out = runCmd('hint 1');
          const m = out.map((l) => HINT_MOVE_RE.exec(l)).find(Boolean);
          const dice = args[0].split(':')[4];
          const raw = m ? parseNotation(m[1]) : [];
          value = m ? { moves: orderMoves(splitHops(raw, Number(dice[0]), Number(dice[1]), oppCounts(args[0])), ownCounts(args[0])), notation: m[1], equity: parseFloat(m[2]) }
                    : { moves: [], notation: '', equity: 0 }; //合法手なし
          break;
        }
        case 'cube': { // args: [xgid, opts] -> {shouldDouble}
          setPosition(args[0], args[1] || {});
          const h = cubeHint(runCmd('hint'));
          value = { shouldDouble: /^(?:Re)?[Dd]ouble,/.test(h.proper), proper: h.proper };
          break;
        }
        case 'take': { // args: [xgid, opts] -> {shouldTake}
          // ダブル提示後のXGIDは手番が応答側。gnubgはD局面を読めないので、手番をダブルした側に戻し、
          // ダイスを 00 にした局面で "Double, take" と "Double, pass"(ダブラー視点の値)を比べる
          const f = args[0].split(':');
          f[3] = String(-Number(f[3]));
          f[4] = '00';
          setPosition(f.join(':'), args[1] || {});
          const raw = runCmd('hint');
          const h = cubeHint(raw);
          // マッチで「これ以上ダブルできない(ダイスキューブが死んでいる)」局面。wildbg など非マッチ対応側が提示することがある。
          // このときダブルは得点を変えず、パスすれば負け確定なので、テイクが常に正しい
          if (raw.some((l) => /cannot double/i.test(l))) {
            value = { shouldTake: true, proper: 'dead cube: take' };
            break;
          }
          if (h.eq.take === undefined || h.eq.pass === undefined) { throw new Error('gnubg take decision unavailable: ' + f.join(':') + ' => ' + raw.join(' | ')); }
          value = { shouldTake: h.eq.take <= h.eq.pass, proper: h.proper, takeEq: h.eq.take, passEq: h.eq.pass };
          break;
        }
        default:
          throw new Error(`Unknown gnubg worker method: ${method}`);
      }
      self.postMessage({ id, ok: true, value });
    } catch (error) {
      self.postMessage({ id, ok: false, error: errorMessage(error) });
    }
  })();
});
