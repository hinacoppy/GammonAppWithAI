// BgKifu_class.js
'use strict';

class BgKifu {
  constructor(gameobj, appModeFlag = true) {
    this.gameobj = gameobj;
    this.appModeFlag = appModeFlag; //T=gammonAppWithAI, F=bgKifuViewerEditor
    this.clearKifuXgid();
  }

  clearKifuXgid() {
    this.xgidarray = [];
    this.kifuDirtyFlg = false;
  }
  pushKifuXgid(xgid) {
    this.xgidarray.push(xgid);
    this.kifuDirtyFlg = true;
  }
  popKifuXgid() {
    return this.xgidarray.pop();
  }
  ZZZpeepKifuXgid(offset = 0) {
    const idx = this.xgidarray.length - 1 - offset;
    return idx < 0 ? null : this.xgidarray[idx];
  }

  ZZZisDirty() {
    return this.kifuDirtyFlg;
  }

  downloadKifuAction(filename = null) {
    this.setGameOption();
    this.convertKifu();
    this.downloadKifu(filename);
    this.kifuDirtyFlg = false;
  }

  makeDownloadFilename(filename) {
    const gammonAppKifuFile = `kifu_${this.player1}_vs_${this.player2}_${this.date8}.txt`; //gammonAppWithAI用のファイル名
    return (filename === null) ? gammonAppKifuFile : filename;
  }

  downloadKifu(filename = null) {
    const kifu = this.kifumat.join('\n') + '\n'; //最後に改行を入れる
    const xgidlist = "; " + this.xgidarray.join('\n; ') + '\n';
//    const blob = new Blob([ kifu ], { "type":"text/plain" }); //production mode
    const blob = new Blob([ kifu, xgidlist ], { "type":"text/plain" }); //debug mode
    const downloadanchor = document.getElementById("downloadkifu");
    const dlfilenam = this.makeDownloadFilename(filename);
    downloadanchor.href = window.URL.createObjectURL(blob);
    downloadanchor.download = dlfilenam;
    downloadanchor.click();
  }

  convertKifu() {
    this.kifumat = [];
    this.makeHeader();

    let gamenum = 1;
    let xgiddata = [];
    for (const line of this.xgidarray) {
      if (line != '') { //空行がゲームの区切り
        xgiddata.push(line);
      } else {
        this.game2kifu(xgiddata, gamenum);
        xgiddata = [];
        gamenum += 1;
      }
    }
    this.game2kifu(xgiddata, gamenum); //最後のゲームを書き出す
  }

  game2kifu(xgiddata, gamenum) {
    if (xgiddata.length == 0) { return; } //データがなければ何もしない

    const untrim = ((str, num) => { //str文字列の後ろにnum文字数になるまで空白を追加。trim()の逆処理
      return (str + ' '.repeat(num)).substring(0, num);
    });

    const replaceandtrim = ((str) => {
      const str2 = str.replace("ILLEGAL?", "????????");
      this.kifumat.push(str2.trimEnd());
    });

    const firstxg = new Xgid(xgiddata[0]); //XGIDの一つ目を見て、スコアを取得
    const score1 = firstxg.get_sc_me();
    const score2 = firstxg.get_sc_yu();
    this.score = [0, score1, score2];

    //ゲームごとのヘッダを出力
    replaceandtrim(' Game ' + gamenum);
    const p2 = untrim(' ' + this.player2 + ' : ' + score2, 39);
    const p1 =  ' ' + this.player1 + ' : ' + score1;
    replaceandtrim(p2 + p1);

    const actionlist = this.parse_xgidlist(xgiddata);
    for (let i = 0; i < actionlist.length; i += 2) {
      let line = ('  ' + Math.trunc(i / 2 + 1) + ') ').slice(-5);
      line += untrim(actionlist[i], 35);
      line += untrim((actionlist[i+1] || ''), 35); //データがないかもしれないので対策
      replaceandtrim(line);
    }
    replaceandtrim('');
  }

  parse_xgidlist(xgidlist) {
    let actionlist = [];
    let doubledflg = false;
    let takedflg = false;
    let action;
    let offset = 0;
    for (let idx = 0; idx < xgidlist.length; idx++) {
      const xgbf = new Xgid(xgidlist[idx]);
      if (idx == 0 && xgbf.turn == 1) { //自分番から始まるときは空を挟む
        actionlist.push(' ');
        offset = 1;
      }

      const xgafstr = xgidlist[idx + 1] //次のポジションを確認
      if (xgafstr === undefined) { break; } //No more XGID == Game End
      const xgaf = new Xgid(xgafstr);

      if (xgbf.get_dice(0) != '00') { //Roll Dice;
        doubledflg = false; //このフラグをオフにするのは次のロールで
        takedflg = false;
        action = this.make_moveaction(xgbf, xgaf);
      } else if (xgbf.dbloffer) { //Double;
        action = ' Doubles => ' + Math.pow(2, xgbf.cube + 1);
        doubledflg = true;
        takedflg = (xgbf.cube != xgaf.cube); //Takeするかどうかはここで確認
      } else if (doubledflg == true) { //Take or Drop
        action = takedflg ? ' Takes' : ' Drops';
      } else { //Resign or Error
        action = this.makeResignAction(xgbf);
      }
      actionlist.push(action);
    }

    //Game End
    const xglast = new Xgid(xgidlist[xgidlist.length - 1]);
    const scoreinfo = this.getScoreInfo(xglast); //得点情報を編集

    if ((xgidlist.length + offset) % 2 == 0) { //xgidlistのlengthと、初手の手番で調整する
      actionlist.push(' ');
    }
    if (!doubledflg) { //Dropでないときは空を挟む
      actionlist.push(' ');
      actionlist.push(' ');
    }
    if (xglast.turn == 1) {
      actionlist.push(' '); //勝者が自分の場合は右側に表示のために空を挟む
    }
    actionlist.push(scoreinfo);

    return actionlist;
  }

  getScoreInfo(xglast) {
    const delta1 = xglast.get_sc_me() - this.score[1];
    const delta2 = xglast.get_sc_yu() - this.score[2];
    const getscr = Math.max(delta1, delta2);
    const winner = (delta1 > delta2) ? 1 : -1;
    const winnerscr = (winner == 1) ? xglast.get_sc_me() : xglast.get_sc_yu();
    const notmatched = (xglast.matchsc == 0 || winnerscr < xglast.matchsc);
    const scoreinfo = notmatched ? ' Wins ' + getscr + ' point'
                                 : ' Wins ' + winnerscr + ' point and the match';
    return scoreinfo;
  }

  makeResignAction(xglast) {
    const delta1 = xglast.get_sc_me() - this.score[1];
    const delta2 = xglast.get_sc_yu() - this.score[2];
    const getscr = Math.max(delta1, delta2);
    const cubeval = BgUtil.calcCubeVal(xglast.cube);
    const resignval = getscr / cubeval;
    const resign = ["", "Single", "Gammon", "BackGammon"];
    const resignaction = " Resign " + resign[resignval];
    return resignaction;
  }

  make_moveaction(xgbf, xgaf) {
    //xgbf = XGID=-b-BBACCA---bB-b-b-cca---A:0:0:1:44:3:1:0:5:0
    //xgaf = XGID=ab-BCACC-B--b--b-b-ccA----:0:0:-1:25:3:1:0:5:0
    //dicelist = [4, 4, 4, 4]
    //frlist = [[25, true], [13, true], [13, true], [8, true]]
    //tolist = [[21, true], [9, true], [9, true], [4, true]]
    //hitlist = [21]
    //movelist = [[25, 21, true], [13, 9, true], [13, 9, true], [8, 4, true]]   //[[FromPt, ToPt, NotIllegalFlg], ... ]
    //return = "44: Bar/21* 13/9(2) 8/4"

    //この関数内で使う関数定数を定義
    const parse_position = ((xg, turn) => {
      let posary = [];
      for (let p = 0; p < 26; p++) {
        const ckr = parseInt(xg.get_ptno(p) * xg.get_ptcol(p) * turn);
        posary.push(ckr);
      }
      return (turn == 1) ? posary : posary.reverse();
    });

    const parse_dice = ((xg) => {
      const dice1 = xg.get_dice(1);
      const dice2 = xg.get_dice(2);
      const dicelist = (xg.zorome) ? [dice1, dice1, dice1, dice1] : [dice1, dice2];
      return dicelist;
    });

    const make_normalmove = (() => {
      //ダイスの目通りのムーブ
      for (let fridx = 0; fridx < frlist.length; fridx++) {
        const [frpt, frflg] = frlist[fridx];
        if (frflg == false) { //動かせる駒だけを対象に
          continue;
        }

        //frptとダイスの目から、toptに動かせる駒を見つける
        let tofind = [];
        for (const dice of dicelist) {
          for (let toidx = 0; toidx < tolist.length; toidx++) {
            const [topt, toflg] = tolist[toidx];
            if (frpt - dice == topt && toflg == true) {
              tofind.push([topt, dice, toidx]);
            }
          }
        }

        if (tofind.length >= 1) {
          const [topt, dicex, toidx] = tofind[0];
          tolist[toidx] = [topt, false]; //動かした駒にチェックを付ける
          frlist[fridx] = [frpt, false];
          const diceidx = dicelist.indexOf(dicex);
          dicelist.splice(diceidx, 1); //使ったダイスは消す
          movelist.push([frpt, topt, true]);
        }
      }

      //ピップを余らせたベアオフ;
      for (let fridx = 0; fridx < frlist.length; fridx++) {
        const [frpt, frflg] = frlist[fridx];
        if (frflg == false) {
            continue;
        }

        let tofind = [];
        for (const dice of dicelist) {
          for (let toidx = 0; toidx < tolist.length; toidx++) {
            const [topt, toflg] = tolist[toidx];
            if (frpt - dice < 0 && topt == 0 && toflg == true) {
              tofind.push([topt, dice, toidx]);
            }
          }
        }

        if (tofind.length >= 1) {
          const [topt, dicex, toidx] = tofind[0];
          tolist[toidx] = [topt, false];
          frlist[fridx] = [frpt, false];
          const diceidx = dicelist.indexOf(dicex);
          dicelist.splice(diceidx, 1);
          movelist.push([frpt, topt, true]);
        }
      }
    }); //end of function make_normalmove()

    const make_irregalmove = (() => {
      let fr = [];
      let to = [];
      for (let fridx = 0; fridx < frlist.length; fridx++) {
        if (frlist[fridx][1] == true) {
          fr.push(frlist[fridx][0]);
        }
      }
      for (let toidx = 0; toidx < tolist.length; toidx++) {
        if (tolist[toidx][1] == true) {
          to.push(tolist[toidx][0]);
        }
      }
      for (let i = 0; i < fr.length; i++) {
          movelist.push([fr[i], to[i], false]);
      }
    }); //end of function make_irregalmove()

    //ここから処理が始まる
    const posarybf = parse_position(xgbf, xgbf.turn);
    const posaryaf = parse_position(xgaf, xgbf.turn);
    var dicelist = parse_dice(xgbf);
    var frlist = [];
    var tolist = [];
    var hitlist = [];
    var movelist = [];

    for (let p = 0; p < 26; p++) {
      const af = posaryaf[p];
      const bf = posarybf[p];
      if (p == 0) { //OnTheBarでは何もしない
        continue;
      }
      if (af < bf) { //駒が減っていれば
        for (let i = 0; i < (bf-af); i++) {
          frlist.push([p, true]);
        }
      }
      const bff = (bf < 0) ? 0 : bf; //相手駒は数えないで、
      if (af > bff) { //駒が増えていれば
        for (let i = 0; i < (af-bff); i++) {
          tolist.push([p, true]);
        }
      }
      if (bf < 0) {  //元々そこに相手駒があれば
        hitlist.push(p);
        if (af == 0) { //ひき逃げのとき
          frlist.push([p, true]);
          tolist.push([p, true]);
        }
      }
    }
    const boff = frlist.length - tolist.length; //前後の駒数が合わない分はベアオフ
    for (let i = 0; i < boff; i++) {
      tolist.push([0, true]);
    }

    dicelist.sort((a, b) => (b - a)); //降順(大きい目から使う)
    frlist.sort((a, b) => (b[0] - a[0])); //降順(後ろから使う)
    tolist.sort((a, b) => (a[0] - b[0])); //昇順(遠い方から使う)

    //ダイスの目をそのまま使うとき;
    make_normalmove();

    //ダイスの目を組み合わせて使うとき;
    while (dicelist.length >= 2) {
      const d1 = dicelist.shift();
      const d2 = dicelist.shift();
      dicelist.unshift(d1 + d2); //新しいダイスの目を一番前に作る(以前の２つの目と交換)
      make_normalmove();
    }

    //イリーガルムーブ;
    make_irregalmove();

    const dice = xgbf.dice;
    const movestr = this.movelist2movestr(movelist, hitlist);

    return dice + ": " + movestr;
  }

  movelist2movestr(movelist, hitlist) {
    //movelist = [[8,2,False], [8,3,True], [6,1,True], [6,1,True]]
    //hitlist = [1]
    //wrk1   = [['8/2',False,False], ['8/3',False,True], ['6/1',True,True], ['6/1',False,True]]
    //wrk2   = ['8/2', '8/3', '6/1', '6/1']
    //wrk4   = {'8/2': 1, '8/3': 1, '6/1': 2}
    //wrk5   = [['8/2', 1, False, False], ['8/3', 1, False, True], ['6/1', 2, True, True]]
    //return = '8/2 ILLEGAL? 8/3 6/2*(2)'

    if (movelist.length == 0) {
      return 'Cannot Move';
    }

    movelist.sort((a, b) => { //frptの降順、toptの降順にソート
      if (b[0] != a[0]) {
        return b[0] - a[0];
      } else {
        return b[1] - a[1];
      }
    });

    const isHitted = ((topt, hitlist) => { //関数変数定義
      for (let idx = 0; idx < hitlist.length; idx++) {
        if (topt == hitlist[idx]) {
          return [true, idx];
        }
      }
      return [false, 0];
    });

    let wrk1 = [];
    let wrk2 = [];
    for (const w of movelist) {
      const [hitflg, idx] = isHitted(w[1], hitlist);
      if (hitflg) {
        hitlist.splice(idx, 1);
      }
      const movestr = w[0] + '/' + w[1];
      wrk1.push([movestr, hitflg, w[2]]); //ヒットしたムーブをマーク
      wrk2.push(movestr);
    }

    let wrk4 = {};
    for (const elm of wrk2) { //ムーブの数を数える
      wrk4[elm] = wrk4[elm] ? wrk4[elm] + 1 : 1; // wrk4[elm] = (wrk4[elm] || 0) + 1;
    }

    let wrk5 = [];
    for (const key in wrk4) {
      const elm = [key, wrk4[key], wrk1[wrk2.indexOf(key)][1], wrk1[wrk2.indexOf(key)][2]];
      wrk5.push(elm);
    }

    let movestr = '';
    for (const w of wrk5) {
      const movs = w[0].replace(/25\//g, 'Bar/').replace(/\/0/g, '/Off');
      const hitf = (w[2] == false) ? '' : '*';
      const tims = (w[1] == 1) ? '' : '(' + w[1] + ')';
      const illf = (w[3] == true) ? '' : ' ILLEGAL?';
      movestr += movs + hitf + tims + illf + ' ';
    }

    return movestr.trim();
  }

  makeHeader() {
    this.kifumat.push('; [Site "' + this.site + '"]');
    this.kifumat.push('; [Match ID ""]');
    this.kifumat.push('; [Player 1 "' + this.player1 + '"]');
    this.kifumat.push('; [Player 2 "' + this.player2 + '"]');
    this.kifumat.push('; [Player 1 Elo "1600.00/0"]');
    this.kifumat.push('; [Player 2 Elo "1600.00/0"]');
    this.kifumat.push('; [EventDate "' + this.date + '"]');
    this.kifumat.push('; [EventTime "00:00"]');
    this.kifumat.push('; [Variation "Backgammon"]');
    this.kifumat.push('; [Unrated "Off"]');
    this.kifumat.push('; [Crawford "On"]');
    this.kifumat.push('; [CubeLimit "1024"]');
    this.kifumat.push('');
    const matchlengthinfo = this.matchlen == 0 ? 'unlimited game' : this.matchlen + ' point match';
    //★実際のunlimitedのMATファイルを確認すること★
    this.kifumat.push(matchlengthinfo);
    this.kifumat.push('');
  }

  setGameOption() {
   if (this.appModeFlag) {
      this.site     = "Backgammon App";
      this.date     = this.getToday();
      this.player1  = "You";
      this.player2  = "AI";
      this.matchlen = this.gameobj.matchLength;
      this.date8    = this.date.replace(/\//g, ""); //2023/05/17 -> 20230517
    } else {
      this.site     = this.gameobj.site.value;
      this.date     = this.gameobj.date.value;
      this.player1  = this.gameobj.player1inp.value;
      this.player2  = this.gameobj.player2inp.value;
      this.matchlen = this.gameobj.matchlen.value;
      this.date8    = this.date.replace(/\//g, ""); //2023/05/17 -> 20230517
    }
  }

  getToday() {
    const date = new Date();
    const year = date.getFullYear();
    const month = ("0" + (date.getMonth() + 1)).slice(-2);
    const day = ("0" + date.getDate()).slice(-2);
    const datestr = year + "/" + month + "/" + day;
    return datestr;
  }

  getActionStr(xgidbf, xgidaf) {
    const xgbf = new Xgid(xgidbf);
    const xgaf = new Xgid(xgidaf);
    const action = this.make_moveaction(xgbf, xgaf); //このルーチンに入るのはムーブアクションのみ
    return action;
  }

  getActionStr2(xgidbf, xgidaf) {
    const action1 = this.getActionStr(xgidbf, xgidaf);
    const action2 = action1.split(":")[1]; //ダイス情報を削除
    const action3 = action2.trim();
    return action3;
  }

}
