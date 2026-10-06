// BgAppBoard_class.js
'use strict';

class BgBoard {
  constructor(boardid = "#board") {
    this.xgidstr = "XGID=--------------------------:0:0:0:00:0:0:0:0:0";
    //ベアオフは右側固定。左側にベアオフエリアは設けず、ポイントは左端から並べる
    this.mainBoard = document.querySelector(boardid); //need to define before bgBoardConfig()
    this.bgBoardConfig();
    this.prepareSvgDice();
    this.prepareBoardBase(); //固定部品(bar, offtray, point triangle)をSVGで準備
    this.updateBoardBase(); //座標を計算して反映(初期表示分)
    this.prepareActiveObjects(); //アプリ内で使用する動的オブジェクトを準備
  } //end of constructor()

  prepareSvgDice() {
    this.svgDice = [];
    this.svgDice[0]  = '';
    this.svgDice[1]  = '<svg class="dice-one" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180">';
    this.svgDice[1] += '<rect x="7" y="7" rx="30" width="166" height="166" stroke-width="1"/>';
    this.svgDice[1] += '<circle cx="90" cy="90" r="8" stroke-width="18"/>';
    this.svgDice[1] += '</svg>';
    this.svgDice[2]  = '<svg class="dice-two" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180">';
    this.svgDice[2] += '<rect x="7" y="7" rx="30" width="166" height="166" stroke-width="1"/>';
    this.svgDice[2] += '<circle cx="50" cy="130" r="8" stroke-width="18"/>';
    this.svgDice[2] += '<circle cx="130" cy="50" r="8" stroke-width="18"/>';
    this.svgDice[2] += '</svg>';
    this.svgDice[3]  = '<svg class="dice-three" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180">';
    this.svgDice[3] += '<rect x="7" y="7" rx="30" width="166" height="166" stroke-width="1"/>';
    this.svgDice[3] += '<circle cx="48" cy="132" r="8" stroke-width="18"/>';
    this.svgDice[3] += '<circle cx="90" cy="90" r="8" stroke-width="18"/>';
    this.svgDice[3] += '<circle cx="132" cy="48" r="8" stroke-width="18" />';
    this.svgDice[3] += '</svg>';
    this.svgDice[4]  = '<svg class="dice-four" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180">';
    this.svgDice[4] += '<rect x="7" y="7" rx="30" width="166" height="166" stroke-width="1"/>';
    this.svgDice[4] += '<circle cx="48" cy="48" r="8" stroke-width="18"/>';
    this.svgDice[4] += '<circle cx="48" cy="132" r="8" stroke-width="18"/>';
    this.svgDice[4] += '<circle cx="132" cy="48" r="8" stroke-width="18"/>';
    this.svgDice[4] += '<circle cx="132" cy="132" r="8" stroke-width="18"/>';
    this.svgDice[4] += '</svg>';
    this.svgDice[5]  = '<svg class="dice-five" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180">';
    this.svgDice[5] += '<rect x="7" y="7" rx="30" width="166" height="166" stroke-width="1"/>';
    this.svgDice[5] += '<circle cx="48" cy="48" r="8" stroke-width="18"/>';
    this.svgDice[5] += '<circle cx="48" cy="132" r="8" stroke-width="18"/>';
    this.svgDice[5] += '<circle cx="90" cy="90" r="8" stroke-width="18"/>';
    this.svgDice[5] += '<circle cx="132" cy="48" r="8" stroke-width="18"/>';
    this.svgDice[5] += '<circle cx="132" cy="132" r="8" stroke-width="18"/>';
    this.svgDice[5] += '</svg>';
    this.svgDice[6]  = '<svg class="dice-six" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180">';
    this.svgDice[6] += '<rect x="7" y="7" rx="30" width="166" height="166" stroke-width="1"/>';
    this.svgDice[6] += '<circle cx="48" cy="48" r="8" stroke-width="18"/>';
    this.svgDice[6] += '<circle cx="48" cy="132" r="8" stroke-width="18"/>';
    this.svgDice[6] += '<circle cx="48" cy="90" r="8" stroke-width="18"/>';
    this.svgDice[6] += '<circle cx="132" cy="48" r="8" stroke-width="18"/>';
    this.svgDice[6] += '<circle cx="132" cy="90" r="8" stroke-width="18"/>';
    this.svgDice[6] += '<circle cx="132" cy="132" r="8" stroke-width="18"/>';
    this.svgDice[6] += '</svg>';
  }

  prepareBoardBase() {
    //盤面の固定部品(bar, offtray, point triangle)は、初期表示とredraw()の時にだけ座標が決まり、
    //それ以外では動かないため、1つのSVG(boardBase)にまとめる。
    //要素自体はredraw()でも作り直さず、座標(属性)だけを書き換える
    //(作り直すとpointに貼ったクリック用イベントリスナーが失われるため)
    const svgns = "http://www.w3.org/2000/svg";
    this.boardBase = document.createElementNS(svgns, "svg");
    this.boardBase.setAttribute("class", "boardBase");
    this.boardBase.setAttribute("preserveAspectRatio", "none");
    this.mainBoard.appendChild(this.boardBase);

    //bar
    this.bar = this.createSvgChild(svgns, "rect", "bar")
    this.boardBase.appendChild(this.bar);

    //offtray
    this.offtray = this.createSvgChild(svgns, "rect", "offtray");
    this.offtrayDiv = this.createSvgChild(svgns, "rect", "offdiv");
    this.offtrayMid = this.createSvgChild(svgns, "rect", "offmid");
    this.offtrayRight = this.createSvgChild(svgns, "rect", "offright");
    this.boardBase.appendChild(this.offtray);
    this.boardBase.appendChild(this.offtrayDiv);
    this.boardBase.appendChild(this.offtrayMid);
    this.boardBase.appendChild(this.offtrayRight);

    //point triangles: 偶数/奇数で色が決まる(上下半分での違いはなし)ため<g>でグループ化してfillをまとめる
    this.point = [];
    const gEvn = this.createSvgChild(svgns, "g");
    gEvn.style.fill = "var(--triangle-evn)";
    const gOdd = this.createSvgChild(svgns, "g");
    gOdd.style.fill = "var(--triangle-odd)";
    this.boardBase.appendChild(gEvn);
    this.boardBase.appendChild(gOdd);
    for (let i = 1; i < 25; i++) {
      const polygon = this.createSvgChild(svgns, "polygon", "pt" + i);
      polygon.setAttribute("class", "point");
      ((i % 2 === 0) ? gEvn : gOdd).appendChild(polygon);
      this.point[i] = polygon;
    }
    this.pointAll = document.querySelectorAll(".point");
  }

  prepareActiveObjects() {
    //アプリ内で使用する動的オブジェクトを準備
    let xh;
    //cube
    xh  = '<div id="cube" class="cube">64</div>';
    this.mainBoard.insertAdjacentHTML("beforeend", xh);
    this.cube = document.getElementById('cube');
    BgDomUtil.setPos(this.cube, this.getPosObj(this.cubeX, this.cubeY[0]));

    //dice
    xh  = '<div id="dice10" class="dice"></div>';
    xh += '<div id="dice11" class="dice"></div>';
    xh += '<div id="dice20" class="dice"></div>';
    xh += '<div id="dice21" class="dice"></div>';
    this.mainBoard.insertAdjacentHTML("beforeend", xh);
    this.dice = [[], [document.getElementById('dice10'), document.getElementById('dice11')],
                     [document.getElementById('dice20'), document.getElementById('dice21')]];
    BgDomUtil.setPos(this.dice[1][0], this.getPosObj(this.dice10X, this.diceY));
    BgDomUtil.setPos(this.dice[1][1], this.getPosObj(this.dice11X, this.diceY));
    BgDomUtil.setPos(this.dice[2][0], this.getPosObj(this.dice20X, this.diceY));
    BgDomUtil.setPos(this.dice[2][1], this.getPosObj(this.dice21X, this.diceY));

    //stack counter
    this.stacks = [];
    for (let i = 0; i < 28; i++) {
      const xh = '<div id="st' + i + '" class="stack"></div>';
      this.mainBoard.insertAdjacentHTML("beforeend", xh);
      this.stacks[i] = document.getElementById('st' + i);
    }

    //Chequer
    this.chequer = [[],[],[]];
    for (let j = 1; j < 3; j++) {
      for (let i = 0; i < 15; i++) {
        this.chequer[j][i] = new Chequer(j, i);
        const xh = this.chequer[j][i].domhtml;
        this.mainBoard.insertAdjacentHTML("beforeend", xh);
        this.chequer[j][i].dom = true;
      }
    }
  }

  resetBoard() {
    this.showBoard("XGID=--------------------------:0:0:0:00:0:0:0:0:0");
  }

  showBoard(xgidstr) { // input for XGID string
    this.showBoard2( new Xgid(xgidstr) );
  }

  showBoard2(xg) { // input for XGID object
    this.xgidstr = xg.xgidstr;
    if (xg.get_boff(0) < 0 || xg.get_boff(1) < 0) {
      alert("Invalid XGID!!\n" + xg.xgidstr + "\nbearoff(0)=" + xg.get_boff(0) + "\nbearoff(1)=" + xg.get_boff(1));
    }
    this.showPosition(xg);
    this.showDiceAll(xg.get_turn(), xg.get_dice(1), xg.get_dice(2));
    this.showCube(xg);
  }

  showCube(xg){
    const offer = xg.get_dbloffer();
    const pos = offer ?  -1 * xg.get_turn() : xg.get_cubepos();
    const val = offer ? xg.get_cube() + 1 : xg.get_cube();
    const crawford = xg.get_crawford();
    const cubepos = BgUtil.cvtTurnXg2Bd(pos);
    const cubeval = BgUtil.calcCubeDisp(val, crawford, pos);
    const cubePosClass = ["cubepos0", "cubepos1", "cubepos2"];
    const cubePosJoin = cubePosClass.join(" ");
    this.cube.textContent = cubeval;
    BgDomUtil.setPos(this.cube, this.getPosObj(this.cubeX, this.cubeY[cubepos]));
    BgDomUtil.removeClass(this.cube, cubePosJoin);
    BgDomUtil.addClass(this.cube, cubePosClass[cubepos]);
    this.cube.classList.toggle("cubeoffer", offer);
  }

  showDiceAll(turn, d1, d2) {
    switch( BgUtil.cvtTurnXg2Bd(turn) ) {
    case 0:
      this.showDice(1, d1, 0);
      this.showDice(2, 0, d2);
      break;
    case 1:
      this.showDice(1, d1, d2);
      this.showDice(2, 0,  0);
      break;
    case 2:
      this.showDice(1, 0,  0);
      this.showDice(2, d1, d2);
      break;
    }
  }

  showDice(turn, d0, d1) {
    const dicefaceClass = ["", "diceface1", "diceface2"];
    this.dice[turn][0].innerHTML = this.svgDice[d0];
    this.dice[turn][1].innerHTML = this.svgDice[d1];
    const svg0 = this.dice[turn][0].querySelector("svg"); //d0が0のときはsvgDiceが空文字列のためsvgが存在しない
    const svg1 = this.dice[turn][1].querySelector("svg");
    if (svg0 && dicefaceClass[turn]) { svg0.classList.add(dicefaceClass[turn]); }
    if (svg1 && dicefaceClass[turn]) { svg1.classList.add(dicefaceClass[turn]); }
    (d0 == 0) ? BgDomUtil.hide(this.dice[turn][0]) : BgDomUtil.show(this.dice[turn][0]);
    (d1 == 0) ? BgDomUtil.hide(this.dice[turn][1]) : BgDomUtil.show(this.dice[turn][1]);
  }

  showPosition(xg) {
    //XGIDから各ポイントの駒を数える
    let piecePointer = [0, 0, 0];
    for (let pt = 0; pt <= 25; pt++) {
      const num = xg.get_ptno(pt);
      const player = BgUtil.cvtTurnXg2Bd(xg.get_ptcol(pt));
      for (let j = 0; j < num; j++) {
        this.chequer[player][piecePointer[player]].point = pt;
        this.chequer[player][piecePointer[player]].stack = num;
        piecePointer[player] += 1;
      }
    }

    //XGIDにでてこない駒は上がっている駒
    for (let player = 1; player <= 2; player++) {
      for (let i = piecePointer[player]; i < 15; i++) {
        const pt = (player == 1) ? 26 : 27;
        this.chequer[player][i].point = pt;
        this.chequer[player][i].stack = 15 - piecePointer[player];
      }
    }

    //駒をボードに並べる
    let ex, ey, ty, sf, bf;
    let ptStack = Array(28);
    ptStack.fill(0);
    for (let player = 1; player <= 2; player++) {
      for (let i = 0; i < 15; i++) {
        const pt = this.chequer[player][i].point;
        const st = this.chequer[player][i].stack;
        bf = false;

        if (pt == 26 || pt == 27) { //bear off
          bf = true;
          ex = this.pointX[26];
          sf = false;
          ey = (player == 1) ? this.offY[player] - (ptStack[pt] * this.boffHeight)
                             : this.offY[player] + (ptStack[pt] * this.boffHeight); //player==2
        } else if (pt == 0 || pt == 25) { //on the bar
          ex = this.pointX[pt];
          sf = (st > this.barStackThreshold + 1);
          ty = (ptStack[pt] > this.barStackThreshold) ? this.barStackThreshold : ptStack[pt];
          ey = (pt == 0) ? this.barY[player] + (ty * this.pieceHeight)
                         : this.barY[player] - (ty * this.pieceHeight); //pt==25
        } else { //in field
          ex = this.pointX[pt];
          sf = (st > this.pointStackThreshold + 1);
          ty = (ptStack[pt] > this.pointStackThreshold) ? this.pointStackThreshold : ptStack[pt];
          ey = (pt > 12) ? this.yupper + (ty * this.pieceHeight)
                         : this.ylower - (ty * this.pieceHeight);
        }
        ptStack[pt] += 1;
        const position = this.getPosObj(ex, ey);
        const zindex = 10 + ptStack[pt];
        this.chequer[player][i].stackidx = ptStack[pt];
        const dom = this.chequer[player][i].dom;
        BgDomUtil.setPos(dom, position);
        dom.style.zIndex = zindex;
        dom.classList.toggle("bearoff", bf);
        this.showStackInfo(sf, pt, st, position, player);
      }
    }

  }

  showStackInfo(stackflag, pt, num, position, player) {
    const stackColorClass = ["", "stackcol1", "stackcol2"];
    this.stacks[pt].textContent = "";
    BgDomUtil.removeClass(this.stacks[pt], stackColorClass.join(" "));
    if (stackflag) {
      this.stacks[pt].textContent = num;
      BgDomUtil.setPos(this.stacks[pt], position);
      BgDomUtil.addClass(this.stacks[pt], stackColorClass[player]);
    }
  }

  animateChequer(xg, move, delay) {
    const fromto = move.split("/");
    const frpt = parseInt(fromto[0]);
    const topt = parseInt(fromto[1]);
    const player = BgUtil.cvtTurnXg2Bd(xg.turn);
    const hitflag = (topt == 25); // or (frpt < topt);

    const p2move = this.findFromPointChequer(player, frpt, hitflag); //動かす駒を探す
    const idx = p2move.idx;

    const aftPosObj = this.calcAftPosition(player, topt); //動かす先の情報を得る
    const toPosition = aftPosObj[0];
    const sf         = aftPosObj[1];
    const num        = aftPosObj[2];
    const toabs      = aftPosObj[3];
    const ckerowner  = aftPosObj[4];
    const duration = (hitflag) ? delay/2 : delay;
    this.chequer[ckerowner][idx].point = toabs;
    this.chequer[ckerowner][idx].stackidx = num;
    p2move.dom.style.zIndex = 50 + num;
    const promise = BgDomUtil.animatePos(p2move.dom, toPosition, duration);
    this.showStackInfo(sf, toabs, num, toPosition, ckerowner);

    return promise;
  }

  findFromPointChequer(player, frpt, hitflag) {
    const frabs = (player == 1) ? frpt : 25 - frpt;
    const ckerowner = (hitflag) ? BgUtil.getBdOppo(player) : player;

    const frPtChkers = this.chequer[ckerowner].filter(elem => (elem.point === frabs)); //ポイントの駒を得る
    const stackidxmax = Math.max(...frPtChkers.map(elem => elem.stackidx)); //一番上に積まれた駒番号を得て、
    const p2move = frPtChkers.find(elem => (elem.stackidx === stackidxmax)); //その駒オブジェクトを返す
    return p2move;
  }

  countToPointChequer(player, toabs) {
    const ckerowner = (toabs == 0 || toabs == 25) ? BgUtil.getBdOppo(player) : player;
    const toPtChkers = this.chequer[ckerowner].filter(elem => (elem.point === toabs)); //移動先の駒を数える
    return toPtChkers.length;
  }

  calcAftPosition(player, topt) {
    const ckerowner = (topt == 25) ? BgUtil.getBdOppo(player) : player;

    let toabs;
    if (topt == 0)       { toabs = (player == 1) ? 26 : 27; } //bear off
    else if (topt == 25) { toabs = (player == 1) ? 0 : 25; } //to bar
    else                 { toabs = (player == 1) ? topt : 25 - topt; } //in field

    const num = this.countToPointChequer(player, toabs);

    //動かす先の駒の位置を計算
    let ty, ey, ex, st, sf;
    if (toabs == 26 || toabs == 27) { //bear off
      ex = this.pointX[26];
      sf = false;
      ey = (ckerowner == 1) ? this.offY[ckerowner] - (num * this.boffHeight)
                            : this.offY[ckerowner] + (num * this.boffHeight); //player==2
    } else if (toabs == 0 || toabs == 25) { //on the bar
      ex = this.pointX[topt];
      sf = (num > this.barStackThreshold + 1);
      ty = (num > this.barStackThreshold) ? this.barStackThreshold : num;
      ey = (toabs == 0) ? this.barY[ckerowner] + (ty * this.pieceHeight)
                        : this.barY[ckerowner] - (ty * this.pieceHeight); //topt==25
    } else { //in field
      ex = this.pointX[toabs];
      sf = (num > this.pointStackThreshold + 1);
      ty = (num > this.pointStackThreshold) ? this.pointStackThreshold : num;
      ey = (toabs > 12) ? this.yupper + (ty * this.pieceHeight)
                        : this.ylower - (ty * this.pieceHeight);
    }

    const toPosition = this.getPosObj(ex, ey);
    return [toPosition, sf, num + 1, toabs, ckerowner];
  }

  animateDice(msec) {
    const diceanimclass = "faa-shake animated"; //ダイスを揺らすアニメーション
    BgDomUtil.addClass(this.dice[1][0], diceanimclass);
    BgDomUtil.addClass(this.dice[1][1], diceanimclass);
    BgDomUtil.addClass(this.dice[2][0], diceanimclass); //見せないダイスも一緒に揺らす
    BgDomUtil.addClass(this.dice[2][1], diceanimclass);

    return new Promise((resolve) => {
      setTimeout(() => { //msec秒待ってアニメーションを止める
        BgDomUtil.removeClass(this.dice[1][0], diceanimclass);
        BgDomUtil.removeClass(this.dice[1][1], diceanimclass);
        BgDomUtil.removeClass(this.dice[2][0], diceanimclass);
        BgDomUtil.removeClass(this.dice[2][1], diceanimclass);
        resolve();
      }, msec);
    });
  }

  animateCube(msec) {
    const cubeanimclass = "faa-tada animated faa-fast"; //キューブオファーのアニメーション
    BgDomUtil.addClass(this.cube, cubeanimclass);

    return new Promise((resolve) => {
      setTimeout(() => { //msec秒待ってアニメーションを止める
        BgDomUtil.removeClass(this.cube, cubeanimclass);
        resolve();
      }, msec);
    });
  }

  bgBoardConfig() {
    //CSSで定義された数値情報を取得
    const style = getComputedStyle(document.documentElement);
    const boardHeightNum   = parseFloat(style.getPropertyValue('--boardHeightNum'));
    const boardWidthNum    = parseFloat(style.getPropertyValue('--boardWidthNum'));
    const pointWidthNum    = parseFloat(style.getPropertyValue('--pointWidthNum'));
    const cubeSizeNum      = parseFloat(style.getPropertyValue('--cubeSizeNum'));
    const offtrayMarginNum = parseFloat(style.getPropertyValue('--offtrayMarginNum'));

    //ボード表示のための位置と大きさの定数を計算
    this.mainBoardHeight = BgDomUtil.contentHeight(this.mainBoard); //.boardのborderを含まない内側のサイズ
    this.mainBoardWidth = BgDomUtil.contentWidth(this.mainBoard);

    this.vw = this.mainBoardWidth / boardWidthNum;
    this.vh = this.mainBoardHeight / boardHeightNum;

    this.pointWidth = pointWidthNum * this.vw;
    //bgStaticBoard.cssの--point-height(=boardHeightNum*unit/2.3)は、board-heightと同じunit(vminまたは
    //メディアクエリ次第でvw)を使うため、比率は常にmainBoardHeightの1/2.3になる(--board-height-maxによる
    //上限(*0.48)は1/2.3(≒0.435)より大きいため実際には効かない)
    this.pointHeight = this.mainBoardHeight / 2.3;
    this.cubeSize = cubeSizeNum * this.vw;
    this.pieceWidth = this.pointWidth;
    const phr = this.mainBoardHeight / 13 / this.pieceWidth;
    const pieceHeightRatio = (phr > 1) ? 1 : phr;
    this.pieceHeight = this.pieceWidth * pieceHeightRatio;
    this.boffHeight = this.pieceWidth / 4 ;  //ベアオフの駒は立てたように表示
    this.offtrayMargin = offtrayMarginNum;

    //ポイントの横位置(ポイント幅単位)。index=ポイント番号、0と25はバー、26はベアオフ
    this.pointX = [6,12,11,10, 9, 8, 7, 5, 4, 3, 2, 1, 0, 0, 1, 2, 3, 4, 5, 7, 8, 9,10,11,12, 6,13];
    for (let i = 0; i < this.pointX.length; i++) {
      this.pointX[i] *= this.pointWidth;
    }

    this.yupper = 0;
    this.ylower = this.mainBoardHeight - this.pieceWidth;

    const tray2Y = -0.4 * this.pieceHeight;
    const tray1Y = this.mainBoardHeight - this.pieceWidth - tray2Y;
    this.offY = [null, tray1Y, tray2Y];

    this.diceSize = this.pointWidth;
    this.diceY = this.mainBoardHeight / 2 - this.diceSize / 2;
    this.dice10X = this.pointX[3];
    this.dice11X = this.pointX[4];
    this.dice20X = this.pointX[9];
    this.dice21X = this.pointX[10];

    this.pointStackThreshold = 5;
    this.barStackThreshold = 3;

    this.cubeX = this.pointX[0] + 0.1 * this.vw; // cube class widthを加味
    const cubeY0 = Math.round(this.mainBoardHeight / 2 - this.cubeSize / 2);
    const cubeY2 = 5;
    const cubeY1 = this.mainBoardHeight - this.cubeSize - cubeY2;
    this.cubeY = [cubeY0, cubeY1, cubeY2];

    const bar1Y = this.mainBoardHeight / 2 - (this.pieceHeight * 2);
    const bar2Y = this.mainBoardHeight / 2 + this.pieceHeight;
    this.barY = [null, bar1Y, bar2Y];

    this.rightSideOff = this.mainBoardWidth - this.pieceWidth + this.offtrayMargin / 2;
    this.pointX[26] = this.rightSideOff;
  }

  updateBoardBase() {
    //盤面の固定部品(bar, offtray, point triangle)の座標計算
    this.boardBase.setAttribute("viewBox", `0 0 ${this.mainBoardWidth} ${this.mainBoardHeight}`);

    //bar
    this.setSvgRect(this.bar, this.pointX[0], 0, this.pointWidth, this.mainBoardHeight, "var(--board-frame)");

    //offtray
    const offtrayWidth = Math.max(0, this.pointWidth - this.offtrayMargin); //負値にならないようMath.maxでガード
    const offstartX = 13 * this.pointWidth + this.offtrayMargin;
    this.setSvgRect(this.offtray, offstartX, 0, offtrayWidth, this.mainBoardHeight, "var(--offtray-color)");

    //offtrayDivider offtrayの左右にdividerを描画。上下のプレイヤーのトレイを分けるdividerも中央に描画
    this.setSvgRect(this.offtrayDiv, 13 * this.pointWidth, 0, this.offtrayMargin, this.mainBoardHeight, "var(--board-frame)");
    this.setSvgRect(this.offtrayRight, this.mainBoardWidth - this.offtrayMargin, 0, this.offtrayMargin, this.mainBoardHeight, "var(--board-frame)");
    this.setSvgRect(this.offtrayMid, offstartX, (this.mainBoardHeight - this.offtrayMargin) / 2, offtrayWidth, this.offtrayMargin, "var(--board-frame)");

    //point triangle
    for (let i = 1; i < 25; i++) {
      const upper = (i > 12);
      const x0 = this.pointX[i];
      const x1 = this.pointX[i] + this.pointWidth;
      const xm = this.pointX[i] + this.pointWidth / 2;
      const pointheightnegative = this.mainBoardHeight - this.pointHeight;
      //上半分は下向き(頂点がy=pointHeight)、下半分は上向き(頂点がy=mainBoardHeight-pointHeight)の三角形
      const points = upper ? `${x0},0 ${x1},0 ${xm},${this.pointHeight}`
                           : `${x0},${this.mainBoardHeight} ${x1},${this.mainBoardHeight} ${xm},${pointheightnegative}`;
      this.point[i].setAttribute("points", points);
    }
  }

  setSvgRect(rect, x, y, width, height, fill) {
    rect.setAttribute("x", x);
    rect.setAttribute("y", y);
    rect.setAttribute("width", width);
    rect.setAttribute("height", height);
    rect.style.fill = fill;
  }

  createSvgChild(svgns, tagName, id) {
    const el = document.createElementNS(svgns, tagName);
    if (id) { el.setAttribute("id", id); }
    return el;
  }

  getPosObj(x, y) {
    return {left:x, top:y}
  }

  getVw() {
    return this.vw;
  }
  getVh() {
    return this.vh;
  }

  getBarPos(player) {
    return this.getPosObj(this.pointX[25], this.barY[player]);
  }

  getDragEndPoint(pos, player) {
    //上段14列、下段14列(列=ポイント幅単位の位置、最右列はベアオフ)
    const pos2ptz = [13,14,15,16,17,18,25,19,20,21,22,23,24,0, 12,11,10, 9, 8, 7,25, 6, 5, 4, 3, 2, 1,0];
    const px = Math.floor(pos.left / this.pointWidth + 0.5);
    const py = Math.floor(pos.top / this.mainBoardHeight * 2);
    const pt = pos2ptz[px + py * 14];

    if (pt == 0 || pt == 25) { return pt; }
    else {
      return (player == 1) ? pt : 25 - pt;
    }
  }

  getDragStartPoint(id, player) {
    const chker = this.chequer[player].find(elem => elem.domid === id);
    const pt = chker.point;
    const p = (player == 1) ? pt : 25 - pt;
    return p;
  }

  getChequerOnDragging(pt, player) {
    const aryreverse = [...this.chequer[player]].reverse(); // コピーして逆順化
    const chker = aryreverse.find(elem => elem.point === pt); //一番上の(最後の)チェッカーを返す
    return chker;
  }

  getChequerHitted(ptt, player) {
    const pt = (player == 1) ? 25 - ptt : ptt;
    const chker = this.chequer[player].find(elem => elem.point === pt);
    return chker;
  }

  flashOnMovablePoint(destpt, player) {
    for (const dp of destpt) {
      if (dp == 0) {
        BgDomUtil.addClass(this.offtray, "flash");
      } else {
        BgDomUtil.addClass(this.point[dp], "flash");
      }
    }
  }

  flashOffMovablePoint() {
    this.pointAll.forEach((el) => BgDomUtil.removeClass(el, "flash"));
    BgDomUtil.removeClass(this.offtray, "flash");
  }

  redraw() {
    this.bgBoardConfig();

    this.updateBoardBase(); //バー・オフトレイ・ポイント三角形(固定部品)の座標を更新
    //dice
    BgDomUtil.setPos(this.dice[1][0], this.getPosObj(this.dice10X, this.diceY));
    BgDomUtil.setPos(this.dice[1][1], this.getPosObj(this.dice11X, this.diceY));
    BgDomUtil.setPos(this.dice[2][0], this.getPosObj(this.dice20X, this.diceY));
    BgDomUtil.setPos(this.dice[2][1], this.getPosObj(this.dice21X, this.diceY));

    this.showBoard(this.xgidstr);
  }

} //class BgBoard
