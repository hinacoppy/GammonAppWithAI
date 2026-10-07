# GammonAppWithAI

バックギャモンを AI と対戦するブラウザアプリ(PWA)。AI はすべてブラウザ内で動きます。
起動してしまえばネットワークアクセスはありません。

## AI エンジン

設定画面の「AI engine」で選ぶことができます。

| エンジン | 内容 | ライセンス |
|---|---|---|
| [wildbg](https://github.com/carsten-wenderdel/wildbg) | 既定(速いが弱い) | Apache-2.0 / MIT |
| [gammonNet](https://github.com/kevung/gammonNet) | ポイントマッチができる | MIT |
| [gnubg](https://github.com/hwatheod/gnubg-web) | GNU Backgammon の WASM 版 | **GPL-3.0**(`wasm/gnubg/LICENSE`) |

## 使い方

PCのブラウザ上で動かすことができます。
スマホでも動かすことができます。その際は「ホーム画面に追加」して、全画面表示のアプリとして使ってください。

## ライセンス

MIT License(`LICENSE`)。ただし `wasm/gnubg/` 内の gnubg は GPL-3.0 で、`wasm/gnubg/LICENSE` に従います。

## 構成

- `index.html` ゲーム画面
- `js/` ゲーム本体と AI 呼び出し
- `wasm/` 各AIエンジンの WASM と Worker

