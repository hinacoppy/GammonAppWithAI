// BgGame_class.js
'use strict';

class BgGame {
  constructor(gametype) {
    this.gametype = gametype;
    const gameparam = BgUtil.getGametypeParam(this.gametype);
    this.ckrnum = gameparam[1]; //chequer num
    this.param0 = gameparam[0]; //my inner point = point num of one area
    this.param1 = this.param0 * 4 + 1; //array param of XGID position
    this.param2 = this.param0 * 4 + 2; //boff1
    this.param3 = this.param0 * 4 + 3; //boff2
    this.dicemx = gameparam[2]; //dice pip max

    this.player = false; //true=player1, false=player2
    this.humanPlayer = true;  //人間は常に下側(player1)
    this.aiPlayer = false;    //AIは上側(player2)
    this.aiReady = false;
    this.gameSeq = 0; //新規ゲーム/投了で進めて、進行中のAI処理を中断するための通し番号
    this.gamescore = [];
    this.matchLength = 5;
    this.score = [0,0,0];
    this.matchwinflg = false;
    this.cubeValue = 1; // =2^0
    this.crawford = false;
    this.xgid = new Xgid(null, this.gametype);
    this.board = new BgBoard("#board"); //ベアオフは右側固定
    this.kifuobj = new BgKifu(this, true);
    this.undoStack = [];
    this.animDelay = 800;
    this.aiMoveDelay = 500; //AIが駒を1つ動かすアニメーションの時間(ms)
    this.gameFinished = true;
    this.settingVars = {}; //設定内容を保持するオブジェクト
    this.outerDragFlag = false; //駒でない部分をタップしてドラッグを始めたら true

    this.setDomNames();
    this.setEventHandler();
    this.setChequerDraggable();

    this.aiEngine = this.loadAiEngine(); //'wildbg' | 'gammonnet' | 'gnubg'
    this.ai = this.createAi(this.aiEngine);
    this.setAiEngineRadio(this.aiEngine);

    this.initGameOption();
    this.beginNewGame(true); //スコアをリセットして新規ゲームを始める
    this.watchAiReady();
  } //end of constructor()

  loadAiEngine() {
    try {
      const e = localStorage.getItem("aiEngine");
      return (e === "gammonnet" || e === "gnubg") ? e : "wildbg";
    } catch (e) {
      return "wildbg"; //localStorageが使えない場合は既定のエンジン
    }
  }

  getAiEngineRadio() {
    return document.querySelector("[name=aiengine]:checked").value;
  }

  setAiEngineRadio(engine) {
    document.querySelector(`[name=aiengine][value=${engine}]`).checked = true;
  }

  createAi(engine) {
    //AIの思考レベル
    // gammonnet: 'instant' | 'normal'(2-ply+枝刈り) | 'thorough'
    // gnubg    : 'instant'(0-ply) | 'normal'(1-ply) | 'thorough'(2-ply)
    // wildbg   : レベルなし

    let settings;
    switch(engine) {
    case "gammonnet":
      settings = { jacoby: this.jacobyflg, level: "normal" };
      return new BgAiGammonNet('wasm/gammonnet/gammonnet_worker.js', settings);
   case "gnubg":
      settings = { jacoby: this.jacobyflg, level: "normal" };
      return new BgAiGnubg('wasm/gnubg/gnubg_worker.js', settings);
    case "wildbg":
    default:
      return new BgAiWildbg('wasm/wildbg/wildbg_worker.js');
    }
  }

  watchAiReady() {
    const ai = this.ai;
    ai.ready
      .then(() => {
        if (ai !== this.ai) { return; } //エンジン切替で古くなったAIの通知は無視する
        this.aiReady = true;
        this.openrollbtn.disabled = false;
        this.hideAiStatus();
      })
      .catch((err) => {
        if (ai !== this.ai) { return; }
        this.showAiStatus("AI load error: " + err.message);
      });
  }

  //設定画面で選んだAIエンジンに切り替える(新しいゲーム開始時に呼ぶ)
  switchAiEngine() {
    const engine = this.getAiEngineRadio();
    if (engine === this.aiEngine) { return; }
    this.ai.worker.terminate();
    this.aiEngine = engine;
    try { localStorage.setItem("aiEngine", engine); } catch (e) { /* 保存できなくても動作は続ける */ }
    this.aiReady = false;
    this.ai = this.createAi(engine);
    this.watchAiReady();
  }

  setDomNames() {
    const byId = (id) => document.getElementById(id);
    //button
    this.rollbtn       = byId("rollbtn");
    this.doublebtn     = byId("doublebtn");
    this.resignbtn     = byId("resignbtn");
    this.takebtn       = byId("takebtn");
    this.dropbtn       = byId("dropbtn");
    this.donebtn       = byId("donebtn");
    this.undobtn       = byId("undobtn");
    this.forcedbtn     = byId("forcedbtn");
    this.newgamebtn    = byId("newgamebtn");
    this.cancelbtn     = byId("cancelbtn");
    this.settingbtn    = byId("settingbtn");
    this.dlkifubtn     = byId("downloadkifubtn");
    this.openrollbtn   = byId("openingroll");
    this.passbtn       = byId("passbtn");
    this.gameendnextbtn= byId("gameendnextbtn");
    this.gameendokbtn  = byId("gameendokbtn");
    this.diceAsBtn     = document.querySelectorAll("#dice10,#dice11,#dice20,#dice21");
    this.pointTriangle = document.querySelectorAll(".point");

    //infos
    this.playerinfo    = [undefined, byId("playerinfo1"), byId("playerinfo2")];
    this.scoreinfo     = [undefined, byId("score1"), byId("score2")];
    this.pipinfo       = [undefined, byId("pip1"), byId("pip2")];
    this.matchinfo     = byId("matchinfo");

    //panel
    this.panelholder   = byId("panelholder");
    this.allpanel      = document.querySelectorAll(".panel");
    this.aistatus      = byId("aistatus");
    this.rolldouble    = byId("rolldouble");
    this.takedrop      = byId("takedrop");
    this.doneundo      = byId("doneundo");
    this.gameend       = byId("gameend");
    this.hideAllPanel(); //font awesome が描画するのを待つ必要がある
    this.showEl(this.panelholder);

    //settings and valiables
    this.settings      = byId("settings");
    this.showpipflg    = document.querySelector("[name=showpip]").checked;
    this.flashflg      = document.querySelector("[name=flashdest]").checked; //ドラッグ開始時に移動可能なポイントを光らせる
    this.jacobyflg     = document.querySelector("[name=jacoby]").checked;
    this.matchlen      = byId("matchlen");

    //chequer
    this.chequerall    = document.querySelectorAll(".chequer");
  }

  //要素(またはNodeList)に、複数のイベントタイプのリスナーを登録する
  addEvents(target, types, handler) {
    const elems = (target instanceof Element || target === window || target === document) ? [target] : target;
    for (const el of elems) {
      for (const type of types) {
        el.addEventListener(type, handler, { passive: false });
      }
    }
  }

  //jQueryの.show()相当。CSSで非表示(display:none)の要素はblockで表示する
  showEl(el) {
    BgDomUtil.show(el);
    if (getComputedStyle(el).display === "none") { el.style.display = "block"; }
  }

  setEventHandler() {
    const clickEventType = ['click', 'touchstart']; //(( window.ontouchstart !== null ) ? 'click':'touchstart');
    //Button Click Event
    this.addEvents(this.rollbtn,        clickEventType, (e) => { e.preventDefault(); this.rollAction(false); });
    this.addEvents(this.doublebtn,      clickEventType, (e) => { e.preventDefault(); this.doubleAction(); });
    this.addEvents(this.resignbtn,      clickEventType, (e) => { e.preventDefault(); this.resignAction(); });
    this.addEvents(this.takebtn,        clickEventType, (e) => { e.preventDefault(); this.takeAction(); });
    this.addEvents(this.dropbtn,        clickEventType, (e) => { e.preventDefault(); this.dropAction(); });
    this.addEvents(this.donebtn,        clickEventType, (e) => { e.preventDefault(); this.doneAction(); });
    this.addEvents(this.undobtn,        clickEventType, (e) => { e.preventDefault(); this.undoAction(); });
    this.addEvents(this.openrollbtn,    clickEventType, (e) => { e.preventDefault(); this.rollAction(true); });
    this.addEvents(this.passbtn,        clickEventType, (e) => { e.preventDefault(); this.passAction(); });
    this.addEvents(this.gameendnextbtn, clickEventType, (e) => { e.preventDefault(); this.gameendNextAction(); });
    this.addEvents(this.gameendokbtn,   clickEventType, (e) => { e.preventDefault(); this.gameendOkAction(); });
    this.addEvents(this.diceAsBtn,      clickEventType, (e) => { e.preventDefault(); this.diceAsDoneAction(e); });
    this.addEvents(this.diceAsBtn,      ['contextmenu'],(e) => { e.preventDefault(); this.undoAction(); });
    this.addEvents(this.settingbtn,     clickEventType, (e) => { e.preventDefault(); this.showSettingPanelAction(); });
    this.addEvents(this.newgamebtn,     clickEventType, (e) => { e.preventDefault(); this.newGameAction(); });
    this.addEvents(this.cancelbtn,      clickEventType, (e) => { e.preventDefault(); this.cancelSettingPanelAction(); });
    this.addEvents(this.forcedbtn,      clickEventType, (e) => { e.preventDefault(); this.forcedMoveAction(); }),
    this.addEvents(this.dlkifubtn,      clickEventType, (e) => { e.preventDefault(); this.kifuobj.downloadKifuAction(); }),
    this.addEvents(this.pointTriangle,  ['touchstart', 'mousedown'], (e) => { e.preventDefault(); this.pointTouchStartAction(e); });
    this.addEvents(window,              ['resize'],     (e) => { e.preventDefault(); this.redrawAction(); });
    this.addEvents(document,            ['contextmenu'],(e) => { e.preventDefault(); });
  }

  initGameOption() {
    this.showpipflg  = document.querySelector("[name=showpip]").checked;
    this.flashflg    = document.querySelector("[name=flashdest]").checked;
    this.jacobyflg   = document.querySelector("[name=jacoby]").checked;

    this.matchLength = this.matchlen.value;
    const matchinfotxt = (this.matchLength == 0) ? "$" : this.matchLength;
    this.matchinfo.textContent = matchinfotxt;
    this.score = [0,0,0];
    this.scoreinfo[1].textContent = 0;
    this.scoreinfo[2].textContent = 0;
    document.querySelectorAll(".pip").forEach((el) => BgDomUtil.toggle(el, this.showpipflg));
  }

  beginNewGame(newmatch = false) {
    const initpos = this.getInitPos(this.gametype);
    this.xgid.initialize(initpos, newmatch, this.matchLength);
    this.board.showBoard2(this.xgid);
    this.showPipInfo();
    this.swapChequerDraggable(true, true);
    this.hideAllPanel();
    this.gameSeq += 1; //進行中のAI処理を無効にする
    this.showOpenRollPanel();
    this.openrollbtn.disabled = !this.aiReady;
    if (!this.aiReady) { this.showAiStatus("AI loading..."); }
  }

  getInitPos(gametype) {
    return "-b----E-C---eE---c-e----B-";
  }

  async rollAction(openroll = false) {
    this.hideAllPanel();
    this.undoStack = [];
    const dice = BgUtil.randomdice(this.dicemx, openroll);
    this.xgid.dice = dice[2];
    this.makeDiceList(dice[2]);
    this.xgid.usabledice = true;
    this.board.showBoard2(this.xgid);
    await this.board.animateDice(this.animDelay);
    if (openroll) {
      this.player = (dice[0] > dice[1]);
      this.xgid.turn = BgUtil.cvtTurnGm2Xg(this.player);
      this.gameFinished = false;
    }
    this.kifuobj.pushKifuXgid(this.xgid.xgidstr);
    if (this.player == this.aiPlayer) {
      this.swapChequerDraggable(true, true); //AIの手番では人間は駒を動かせない
      await this.aiMoveAction();
      return;
    }
    this.swapChequerDraggable(this.player);
    this.pushXgidPosition();
    this.forcedflg = this.xgid.isForcedMove(); //rewindAction()時にも呼ばれるため、rollAction()ではなくここで確認
    BgDomUtil.toggle(this.forcedbtn, this.forcedflg);
    this.forcedbtn.disabled = this.xgid.moveFinished();
    this.showDoneUndoPanel(this.player, openroll);
  }

  undoAction() {
    //ムーブ前のボードを再表示
    if (this.undoStack.length == 0) { return; }
    const xgidstr = this.popXgidPosition();
    this.xgid = new Xgid(xgidstr, this.gametype);
    this.xgid.usabledice = true;
    this.makeDiceList(this.xgid.dice);
    this.donebtn.disabled = (!this.xgid.moveFinished() && this.flashflg);
    this.forcedflg = this.xgid.isForcedMove();
    BgDomUtil.toggle(this.forcedbtn, this.forcedflg);
    this.forcedbtn.disabled = this.xgid.moveFinished();
    this.pushXgidPosition();
    this.board.showBoard2(this.xgid);
    this.swapChequerDraggable(this.player);
  }

  doneAction() {
    if (this.donebtn.disabled) { return; }
    if (this.gameFinished) { return; }
    this.hideAllPanel();
    this.swapTurn();
    this.xgid.dice = "00";
    this.swapXgTurn();
    this.showPipInfo();
    this.board.showBoard2(this.xgid);
    this.swapChequerDraggable(true, true);
    if (this.player == this.aiPlayer) {
      this.aiRollDoubleAction();
    } else {
      this.showRollDoublePanel(this.humanPlayer);
    }
  }

  forcedMoveAction() {
    this.donebtn.disabled = false;
    this.forcedbtn.disabled = true;
    const afterxgidstr = this.xgid.getForcedMovedXgid();
    this.xgid = new Xgid(afterxgidstr);
    this.board.showBoard2(this.xgid);
    const turn = BgUtil.cvtTurnGm2Xg(this.player);
    if (this.xgid.get_boff(turn) == this.ckrnum) { this.bearoffAllAction(); }
  }

  resignAction() {
    this.cancelSettingPanelAction();
    if (this.gameFinished) { return; }
    this.gameSeq += 1;
    this.hideAllPanel();
    this.swapTurn();
    this.xgid.dice = "00";
    this.calcScore(this.player);
    this.board.showBoard2(this.xgid);
    this.kifuobj.pushKifuXgid(this.xgid.xgidstr); //リザイン時のXGID(棋譜ではResignの判定に使う)
    this.pushGameEndKifuXgid();
    this.showGameEndPanel(this.player);
    this.gameFinished = true;
  }

  pushGameEndKifuXgid() { //棋譜用に、勝者を手番にしたゲーム終了のXGIDを追加する(BgKifuEditorと同じ形式)
    const endxgid = new Xgid(this.xgid.xgidstr, this.gametype);
    endxgid.turn = BgUtil.cvtTurnGm2Xg(this.player); //this.player is winner
    endxgid.dice = "00";
    endxgid.dbloffer = false;
    this.kifuobj.pushKifuXgid(endxgid.xgidstr);
  }

  async doubleAction() {
    if (this.doublebtn.disabled) { return; }
    this.hideAllPanel();
    this.swapTurn();
    this.xgid.dbloffer = true;
    this.board.showBoard2(this.xgid); //double offer
    await this.board.animateCube(this.animDelay); //キューブを揺すのはshowBoard()の後
    this.kifuobj.pushKifuXgid(this.xgid.xgidstr);
    this.swapXgTurn(); //XGのturnを変えるのは棋譜用XGID出力後
    if (this.player == this.aiPlayer) {
      this.aiTakeDropAction();
    } else {
      this.showTakeDropPanel(this.humanPlayer);
    }
  }

  takeAction() {
    this.hideAllPanel();
    this.swapTurn();
    this.xgid.dice = "00";
    this.xgid.cube += 1;
    this.xgid.cubepos = this.xgid.turn;
    this.board.showBoard2(this.xgid);
    this.kifuobj.pushKifuXgid(this.xgid.xgidstr);
    this.swapXgTurn(); //XGのturnを変えるのは棋譜用XGID出力後
    if (this.player == this.aiPlayer) {
      this.aiRollDoubleAction();
    } else {
      this.showRollDoublePanel(this.humanPlayer);
    }
  }

  dropAction() {
    this.hideAllPanel();
    this.swapTurn();
    this.calcScore(this.player); //dblofferフラグをリセットする前に計算する必要あり
    this.xgid.dbloffer = false;
    this.board.showBoard2(this.xgid);
    this.kifuobj.pushKifuXgid(this.xgid.xgidstr);
    this.pushGameEndKifuXgid();
    this.showGameEndPanel(this.player);
    this.gameFinished = true;
  }

  gameendNextAction() {
    this.hideAllPanel();
    this.showScoreInfo();
    this.kifuobj.pushKifuXgid(''); //空行
    this.beginNewGame(false);
  }

  gameendOkAction() {
    this.hideAllPanel();
    this.showScoreInfo();
  }

  bearoffAllAction() {
    this.hideAllPanel();
    this.calcScore(this.player); // this.player is winner
    this.kifuobj.pushKifuXgid(this.xgid.xgidstr);
    this.showGameEndPanel(this.player);
    this.gameFinished = true;
  }

  diceAsDoneAction(e) {
    if (BgUtil.cvtTurnGm2Bd(this.player) != e.currentTarget.id.substring(4, 5)) { return; } //ex. id="dice10"
    this.doneAction();
  }

  showSettingPanelAction() {
    if (this.settingbtn.disabled) { return; }
    BgDomUtil.setPos(this.settings, this.calcCenterPosition("S", this.settings));
    this.showEl(this.settings); //画面表示
    this.saveSettingVars(); //設定情報を退避しておく
    this.setButtonEnabled(this.settingbtn, false);
  }

  cancelSettingPanelAction() {
    BgDomUtil.hide(this.settings); //画面を消す
    this.loadSettingVars(); //設定情報を戻す
    this.setButtonEnabled(this.settingbtn, true);
  }

  newGameAction() {
    BgDomUtil.hide(this.settings); //画面を消す
    this.settingbtn.disabled = false;
    this.initGameOption();
    this.switchAiEngine();
    if (this.ai.opts) { this.ai.opts.jacoby = this.jacobyflg; }
    this.kifuobj.clearKifuXgid();
    this.beginNewGame(true);
  }

  resetScoreAction() {
    this.score = [0,0,0];
    this.scoreinfo[1].textContent = 0;
    this.scoreinfo[2].textContent = 0;
  }

  passAction() {
    this.xgid.dice = "66";
    this.kifuobj.pushKifuXgid(this.xgid.xgidstr);
    this.doneAction();
  }

  makeDiceList(dice) {
    const dice1 = Number(dice.slice(0, 1));
    const dice2 = Number(dice.slice(1, 2));
    if      (dice1 == dice2) { this.dicelist = [dice1, dice1, dice1, dice1]; }
    else if (dice1 <  dice2) { this.dicelist = [dice2, dice1]; } //大きい順
    else                     { this.dicelist = [dice1, dice2]; }
  }

  showPipInfo() {
    this.pipinfo[1].textContent = this.xgid.get_pip(+1);
    this.pipinfo[2].textContent = this.xgid.get_pip(-1);
  }

  showScoreInfo() {
    this.scoreinfo[1].textContent = this.xgid.sc_me;
    this.scoreinfo[2].textContent = this.xgid.sc_yu;
  }

  calcScore(player) {
    let [cubeprice, gammonprice] = this.xgid.get_gamesc( BgUtil.cvtTurnGm2Xg(player) );
    if (this.jacobyflg && this.matchLength == 0 && cubeprice == 1) {
      gammonprice = 1;
    }
    this.gamescore = [cubeprice, gammonprice];
    const w = BgUtil.cvtTurnGm2Bd( player);
    const l = BgUtil.cvtTurnGm2Bd(!player);
    const scr = this.gamescore[0] * this.gamescore[1];
    this.xgid.crawford = this.xgid.checkCrawford(this.score[w], scr, this.score[l]);
    this.score[w] += scr;
    this.xgid.sc_me = this.score[1];
    this.xgid.sc_yu = this.score[2];
    this.matchwinflg = (this.matchLength != 0) && (this.score[w] >= this.matchLength);
  }

  canDouble(player) {
    return !this.xgid.crawford && (this.xgid.cubepos == 0) || (this.xgid.cubepos == this.xgid.turn);
  }

  showOpenRollPanel() {
    this.showElement(this.openrollbtn, 'R', true);
  }

  showTakeDropPanel(player) {
    if (player) {
      this.showElement(this.takedrop, 'R', player);
    } else {
      this.showElement(this.takedrop, 'L', player);
    }
  }

  showRollDoublePanel(player) {
    this.doublebtn.disabled = !this.canDouble(player);
    const closeout = this.isCloseout(player);
    BgDomUtil.toggle(this.rollbtn, !closeout); //rollボタンかpassボタンのどちらかを表示
    BgDomUtil.toggle(this.passbtn,  closeout);
    if (player) {
      this.showElement(this.rolldouble, 'R', player);
    } else {
      this.showElement(this.rolldouble, 'L', player);
    }
  }

  showDoneUndoPanel(player, opening = false) {
    this.donebtn.disabled = (!this.xgid.moveFinished() && this.flashflg);
    //常にダイスの下に表示(opening変数は使わなくなった)
    if (player) {
      this.showElement(this.doneundo, 'R', player, 12);
    } else {
      this.showElement(this.doneundo, 'L', player, -12);
    }
  }

  makeGameEndPanal(player) {
    const humanwin = (player == this.humanPlayer);
    const mes1 = (humanwin ? "You WIN" : "You LOSE") + ((this.matchwinflg) ? " the MATCH" : "");
    this.gameend.querySelector(":scope > .mes1").textContent = mes1;

    const winlevel = ["", "SINGLE", "GAMMON", "BACK GAMMON"];
    const res = winlevel[this.gamescore[1]];
    const mes2 = (humanwin ? "Get " : "AI gets ") + this.gamescore[0] * this.gamescore[1] + "pt (" + res + ")";
    this.gameend.querySelector(":scope > .mes2").textContent = mes2;

    const huscr = this.score[BgUtil.cvtTurnGm2Bd(this.humanPlayer)]; //人間 - AI の順に表示する
    const aiscr = this.score[BgUtil.cvtTurnGm2Bd(this.aiPlayer)];
    const matchinfo = (this.matchLength == 0) ? "" : "&emsp;(" +this.matchLength + "pt)";
    const mes3 = "You " + huscr + " - " + aiscr + " " + this.aiEngine + matchinfo;
    this.gameend.querySelector(":scope > .mes3").innerHTML = mes3;
  }

  showGameEndPanel(player) {
    this.makeGameEndPanal(player);
    BgDomUtil.toggle(this.gameendnextbtn, !this.matchwinflg);
    BgDomUtil.toggle(this.gameendokbtn, this.matchwinflg);
    this.showElement(this.gameend, "B", player);
  }

  hideAllPanel() {
    this.allpanel.forEach((el) => BgDomUtil.hide(el));
  }

  showElement(elem, pos, player, yoffset=0) {
    this.showEl(elem);
    elem.classList.toggle('turn1', !!player);
    elem.classList.toggle('turn2', !player);
    BgDomUtil.setPos(elem, this.calcCenterPosition(pos, elem, yoffset));
  }

  calcCenterPosition(pos, elem, yoffset=0) {
    let p_top, p_left, p_width, p_height;
    switch (pos) {
    case 'L': //left area
      p_top = 0;
      p_left = 0;
      p_width = 36 * this.board.getVw();
      p_height = 100 * this.board.getVh();
      break;
    case 'R': //right area
      p_top = 0;
      p_left = 42 * this.board.getVw();
      p_width = 36 * this.board.getVw();
      p_height = 100 * this.board.getVh();
      break;
    case 'B': //board area
      p_top = 0;
      p_left = 0;
      p_width = 78 * this.board.getVw();
      p_height = 100 * this.board.getVh();
      break;
    case 'S': //screen (default)
    default:
      p_top = 0;
      p_left = 0;
      p_width = 100 * this.board.getVw();
      p_height = 100 * this.board.getVh();
      break;
    }
    const dy = yoffset * this.board.getVh();
    const wx = p_left + (p_width - BgDomUtil.outerWidth(elem, true)) / 2;
    const wy = p_top + (p_height - BgDomUtil.outerHeight(elem, true)) / 2 + dy;

    return {left:wx, top:wy};
  }

  // ---- AI(wildbg) ----
  showAiStatus(msg) {
    this.aistatus.textContent = msg;
    this.showElement(this.aistatus, 'L', this.aiPlayer,  12); //yoffsetを設定しダイスに重ねない
  }

  hideAiStatus() {
    BgDomUtil.hide(this.aistatus);
  }

  getAiBoard(turn) {
    return BgAiWildbg.xgidPosToBoard(this.xgid.get_position(), turn);
  }

  //AIの手番開始(ロール前): ダブルするか、ロールする
  async aiRollDoubleAction() {
    const seq = this.gameSeq;
    this.hideAllPanel();
    try {
      await this.ai.ready;
      const minWait = BgUtil.sleep(500); //最低待ち時間。ダブル判断と並行して待つ
      const turn = BgUtil.cvtTurnGm2Xg(this.aiPlayer);
      const closeout = this.isCloseout(this.aiPlayer);
      let doDouble = false;
      if (!closeout && this.canDouble(this.aiPlayer) && this.xgid.cube < 6) {
        this.showAiStatus("Cube thinking..."); //ダブルするかどうかを考えている
        doDouble = await this.ai.shouldDouble(this.getAiBoard(turn), this.xgid.xgidstr);
      }
      await minWait;
      if (seq != this.gameSeq) { return; }
      if (doDouble) {
        this.showAiStatus("Double");
        await BgUtil.sleep(700);
        if (seq != this.gameSeq) { return; }
        this.doublebtn.disabled = false;
        await this.doubleAction();
        return;
      }
      this.hideAiStatus();
      await this.rollAction(false);
    } catch (err) {
      this.showAiStatus("AI error: " + err.message);
    }
  }

  //人間がダブルしたとき: AIがテイクかドロップかを決める
  async aiTakeDropAction() {
    const seq = this.gameSeq;
    this.hideAllPanel();
    try {
      await this.ai.ready;
      await BgUtil.sleep(700);
      if (seq != this.gameSeq) { return; }
      const doublerTurn = BgUtil.cvtTurnGm2Xg(this.humanPlayer);
      const take = await this.ai.shouldTake(this.getAiBoard(doublerTurn), this.xgid.xgidstr);
      if (seq != this.gameSeq) { return; }
      this.showAiStatus(take ? "Take" : "Pass");
      await BgUtil.sleep(500);
      if (seq != this.gameSeq) { return; }
      if (take) { this.takeAction(); } else { this.dropAction(); }
    } catch (err) {
      this.showAiStatus("AI error: " + err.message);
    }
  }

  //AIの着手(ロール後): 最善手を1手ずつ盤面に反映し、最後に手番を渡す
  async aiMoveAction() {
    const seq = this.gameSeq;
    try {
      this.showAiStatus("Move thinking...");
      const turn = BgUtil.cvtTurnGm2Xg(this.aiPlayer);
      const board = this.getAiBoard(turn);
      const play = await this.ai.bestPlay(board, this.xgid.get_dice(1), this.xgid.get_dice(2), this.xgid.xgidstr);
      const pt = (n) => (n == 25 ? "bar" : (n == 0 ? "off" : n));
      const movestr = play.length ? play.map(m => pt(m.from) + "/" + pt(m.to) + (this.xgid.isHitted(m.to) ? "*" : "")).join(" ")
                                  : "No move";
      this.showAiStatus(movestr);
      for (const m of play) {
        //await BgUtil.sleep(500); //チェッカームーブはアニメーションするのでウェイトは入れない
        //known bug: チェッカーアニメーションの際に異なるチェッカーをつかんで動かすことがある
        if (seq != this.gameSeq) { return; }
        const hit = this.xgid.isHitted(m.to);
        if (hit) {
          await this.board.animateChequer(this.xgid, m.to + "/" + this.param1, this.aiMoveDelay); //ヒット(相手をバーへ)
        }
        await this.board.animateChequer(this.xgid, m.from + "/" + m.to, this.aiMoveDelay); //駒を動かす
        if (seq != this.gameSeq) { return; }
        if (hit) {
          this.xgid = this.xgid.moveChequer2(m.to + "/" + this.param1);
        }
        this.xgid = this.xgid.moveChequer2(m.from + "/" + m.to);
        this.board.showBoard2(this.xgid);
        this.showPipInfo();
      }
      await BgUtil.sleep(600);
      if (seq != this.gameSeq) { return; }
      this.hideAiStatus();
      if (this.xgid.get_boff(turn) == this.ckrnum) { this.bearoffAllAction(); return; }
      this.donebtn.disabled = false;
      this.doneAction();
    } catch (err) {
      this.showAiStatus("AI error: " + err.message);
    }
  }

  pushXgidPosition() {
   this.undoStack.push(this.xgid.xgidstr);
  }

  popXgidPosition() {
    return this.undoStack.pop();
  }

  swapTurn() {
    this.player = !this.player;
  }

  swapXgTurn() {
    this.xgid.turn = -1 * this.xgid.turn;
  }

  isCloseout(player) {
    const xgturn = BgUtil.cvtTurnGm2Xg(!player); //クローズアウトを確認するのは相手側
    return this.xgid.isCloseout(xgturn);
  }

  setChequerDraggable() {
    //関数内広域変数
    var x;//要素内のクリックされた位置
    var y;
    var dragobj; //ドラッグ中のオブジェクト
    var zidx; //ドラッグ中のオブジェクトのzIndexを保持

    //ドラッグ開始時のコールバック関数
    const evfn_dragstart = ((origevt) => {
      origevt.preventDefault();
      dragobj = origevt.currentTarget; //dragする要素を取得し、広域変数に格納
      if (!dragobj.classList.contains("draggable")) {
        //相手チェッカーのときはそこにポイントオンする(できるときは)
        const position = { //オブジェクトの位置
              left: dragobj.offsetLeft,
              top:  dragobj.offsetTop
            };
        //オブジェクト(チェッカー)の位置からポイント番号を得る
        const point = this.board.getDragEndPoint(position, 1); //下側プレイヤーから見たポイント番号
        this.makeBlockPointAction(point); //そこにブロックポイントを作る
        return;
      }

      dragobj.classList.add("dragging"); //drag中フラグ(クラス追加/削除で制御)
      zidx = dragobj.style.zIndex;
      dragobj.style.zIndex = 999;

      //マウスイベントとタッチイベントの差異を吸収
      const event = (origevt.type === "mousedown") ? origevt : origevt.changedTouches[0];

      //要素内の相対座標を取得
      x = event.pageX - dragobj.offsetLeft;
      y = event.pageY - dragobj.offsetTop;

      //イベントハンドラを登録
      document.body.addEventListener("mousemove",  evfn_drag,    {passive:false});
      document.body.addEventListener("mouseleave", evfn_dragend, false);
      dragobj.      addEventListener("mouseup",    evfn_dragend, false);
      document.body.addEventListener("touchmove",  evfn_drag,    {passive:false});
      document.body.addEventListener("touchleave", evfn_dragend, false);
      document.body.addEventListener("touchend",   evfn_dragend, false);

      const position = { //dragStartAction()に渡すオブジェクトを作る
                   left: dragobj.offsetLeft,
                   top:  dragobj.offsetTop
                 };
      this.dragStartAction(origevt, position);
    });

    //ドラッグ中のコールバック関数
    const evfn_drag = ((origevt) => {
      origevt.preventDefault(); //フリックしたときに画面を動かさないようにデフォルト動作を抑制

      //マウスイベントとタッチイベントの差異を吸収
      const event = (origevt.type === "mousemove") ? origevt : origevt.changedTouches[0];

      //マウスが動いた場所に要素を動かす
      dragobj.style.top  = event.pageY - y + "px";
      dragobj.style.left = event.pageX - x + "px";
    });

    //ドラッグ終了時のコールバック関数
    const evfn_dragend = ((origevt) => {
      origevt.preventDefault();
      dragobj.classList.remove("dragging"); //drag中フラグを削除
      dragobj.style.zIndex = zidx;

      //イベントハンドラの削除
      document.body.removeEventListener("mousemove",  evfn_drag,    false);
      document.body.removeEventListener("mouseleave", evfn_dragend, false);
      dragobj.      removeEventListener("mouseup",    evfn_dragend, false);
      document.body.removeEventListener("touchmove",  evfn_drag,    false);
      document.body.removeEventListener("touchleave", evfn_dragend, false);
      document.body.removeEventListener("touchend",   evfn_dragend, false);

      const position = { //dragStopAction()に渡すオブジェクトを作る
                   left: dragobj.offsetLeft,
                   top:  dragobj.offsetTop
                 };
      this.dragStopAction(position);
    });

    //dragできるオブジェクトにdragstartイベントを設定
    for(const elm of this.chequerall) {
      elm.addEventListener("mousedown",  evfn_dragstart, false);
      elm.addEventListener("touchstart", evfn_dragstart, false);
    }
  }

  dragStartAction(event, position) {
    this.mouseRbtnFlg = (event.button != 0); //主ボタン(左)のときだけfalse
    this.dragObject = event.currentTarget; //dragStopAction()で使うがここで取り出しておかなければならない
    const id = event.currentTarget.id;
    this.dragStartPt = this.board.getDragStartPoint(id, BgUtil.cvtTurnGm2Bd(this.player));
    if (!this.outerDragFlag) { this.dragStartPos = position; }
    this.outerDragFlag = false;
    this.flashOnMovablePoint(this.dragStartPt);
  }

  checkDragEndPt(xg, dragstartpt, dragendpt) {
    let endpt = dragendpt;
    let ok = false;

    if (dragstartpt == dragendpt) {
      //同じ位置にドロップ(＝クリック)したときは、ダイスの目を使ったマスに動かす
      if (this.mouseRbtnFlg) { this.dicelist.reverse(); }　//右クリックのときは小さい目から使う
      for (let i = 0; i < this.dicelist.length; i++) {
        //ダイス目でピッタリに上がれればその目を使って上げる
        const endptwk = this.dicelist.includes(dragstartpt) ? dragstartpt - this.dicelist[i]
                                                            : Math.max(dragstartpt - this.dicelist[i], 0);
        if (xg.isMovable(dragstartpt, endptwk)) {
          this.dicelist.splice(i, 1);
          endpt = endptwk;
          ok = true;
          break;
        }
      }
      if (this.mouseRbtnFlg) { this.dicelist.reverse(); } //元に戻す
    } else {
      if (this.flashflg) {
        //ドロップされた位置が前後 1pt の範囲であれば OK とする。せっかちな操作に対応
        const ok0 = xg.isMovable(dragstartpt, dragendpt);
        const ok1 = xg.isMovable(dragstartpt, dragendpt + 1);
        const ok2 = xg.isMovable(dragstartpt, dragendpt - 1);
        if      (ok0)         { endpt = dragendpt;     ok = true; } //ちょうどの目にドロップ
        else if (ok1 && !ok2) { endpt = dragendpt + 1; ok = true; } //前後が移動可能な時は進めない
        else if (ok2 && !ok1) { endpt = dragendpt - 1; ok = true; } //ex.24の目で3にドロップしたときは進めない
      } else {
        //イリーガルムーブを許可したとき
        endpt = dragendpt;
        ok = (dragstartpt > dragendpt) && !this.xgid.isBlocked(dragendpt); //掴んだマスより前でブロックポイントでなければtrue
      }
      //D&Dで動かした後クリックで動かせるようにダイスリストを調整しておく
      //known bug:ダイス組み合わせの位置に動かしたときは、次のクリックムーブが正しく動かないことがある
      for (let i = 0; i < this.dicelist.length; i++) {
        if (this.dicelist[i] == (dragstartpt - endpt)) {
          this.dicelist.splice(i, 1);
          break;
        }
      }
    }
    return [endpt, ok];
  }

  dragStopAction(position, animflag = true) {
    this.flashOffMovablePoint();
    const dragendpt = this.board.getDragEndPoint(position, BgUtil.cvtTurnGm2Bd(this.player));

    const xg = this.xgid;
    let ok;
    [this.dragEndPt, ok] = this.checkDragEndPt(xg, this.dragStartPt, dragendpt);
    const hit = xg.isHitted(this.dragEndPt);

    if (ok) {
      if (hit) {
        const movestr = this.dragEndPt + "/" + this.param1;
        this.xgid = this.xgid.moveChequer2(movestr);
        const oppoplayer = BgUtil.cvtTurnGm2Bd(!this.player);
        const oppoChequer = this.board.getChequerHitted(this.dragEndPt, oppoplayer);
        const barPt = this.board.getBarPos(oppoplayer);
        if (oppoChequer && animflag) {
          BgDomUtil.animatePos(oppoChequer.dom, barPt, 300).then(() => { this.board.showBoard2(this.xgid); });
        }
      }
      const movestr = this.dragStartPt + "/" + this.dragEndPt;
      this.xgid = this.xgid.moveChequer2(movestr);
      if (!hit) {
        this.board.showBoard2(this.xgid);
      }
    } else {
      if (this.dragObject) { BgDomUtil.animatePos(this.dragObject, this.dragStartPos, 300); }
    }
    this.swapChequerDraggable(this.player);
    this.donebtn.disabled = (!this.xgid.moveFinished() && this.flashflg);
    const turn = BgUtil.cvtTurnGm2Xg(this.player);
    if (this.xgid.get_boff(turn) == this.ckrnum) { this.bearoffAllAction(); }
  }

  swapChequerDraggable(player, init = false) {
    this.chequerall.forEach((el) => el.classList.remove("draggable"));
    if (init) { return; }
    const plyr = BgUtil.cvtTurnGm2Bd(player);
    for (let i = 0; i < this.ckrnum; i++) {
      const pt = this.board.chequer[plyr][i].point;
      if (pt == this.param2 || pt == this.param3) { continue; }
      this.board.chequer[plyr][i].dom.classList.add("draggable");
    }
  }

  flashOnMovablePoint(startpt) {
    if (!this.flashflg) { return; }
    let dest2 = [];
    const destpt = this.xgid.movablePoint(this.dragStartPt, this.flashflg);
    if (this.player) { dest2 = destpt; }
    else {
      for (const p of destpt) {
        const pt = (p == 0) ? 0 : this.param1 - p;
        dest2.push(pt);
      }
    }
    this.board.flashOnMovablePoint(dest2, BgUtil.cvtTurnGm2Bd(this.player));
  }

  flashOffMovablePoint() {
    this.board.flashOffMovablePoint();
  }

  pointTouchStartAction(origevt) {
    if (this.player == this.aiPlayer) { return; } //AIの手番では操作できない
    const id = origevt.currentTarget.id;
    const pt = parseInt(id.substring(2));
    const chker = this.board.getChequerOnDragging(pt, BgUtil.cvtTurnGm2Bd(this.player));
    const evttypeflg = (origevt.type === "mousedown")
    const event = (evttypeflg) ? origevt : origevt.changedTouches[0];

    if (chker) { //そのポイントにチェッカーがあればそれを動かす
      const chkerdom = chker.dom;
      if (chkerdom.classList.contains("draggable")) {
        this.outerDragFlag = true;
        this.dragStartPos = {left: parseFloat(chkerdom.style.left),
                             top:  parseFloat(chkerdom.style.top) };
        const offset = this.board.pieceWidth / 2; //チェッカーの真ん中をつかむ
        BgDomUtil.setPos(chkerdom, {left: event.clientX - offset,
                                    top:  event.clientY - offset});
        let delegateEvent;
        if (evttypeflg) {
          delegateEvent = new MouseEvent("mousedown", {clientX:event.clientX, clientY:event.clientY});
        } else {
          const touchobj = new Touch({identifier: 12345,
                                      target: chkerdom,
                                      clientX: event.clientX,
                                      clientY: event.clientY,
                                      pageX: event.pageX,
                                      pageY: event.pageY});
          delegateEvent = new TouchEvent("touchstart", {changedTouches:[touchobj]});
        }
        chkerdom.dispatchEvent(delegateEvent);
      }
    } else { //そのポイントにチェッカーがなければ
      this.makeBlockPointAction(pt); //そこに向かって動かせる2枚を使ってブロックポイントを作る
    }
  }

  makeBlockPointAction(pointto) {
    if (this.player == this.aiPlayer || this.gameFinished) { return; }
    if (this.dicelist.length < 2) {
      return; //使えるダイスが２個以上なければ何もしない
    }

    const pointfr1 = this.player ? (pointto + this.dicelist[0]) : (pointto - this.dicelist[0]);
    const pointfr2 = this.player ? (pointto + this.dicelist[1]) : (pointto - this.dicelist[1]);

    const ptno1  = this.xgid.get_ptno (pointfr1);
    const ptcol1 = this.xgid.get_ptcol(pointfr1);
    const ptno2  = this.xgid.get_ptno (pointfr2);
    const ptcol2 = this.xgid.get_ptcol(pointfr2);
    const ptno3  = this.xgid.get_ptno (pointto);
    const ptcol3 = this.xgid.get_ptcol(pointto);
    const chkrnum = this.dicelist[0] == this.dicelist[1] ? 2 : 1; //ゾロ目のときは元ポイントに2個以上なければならない
    const ismovablefr = (ptno1 >= chkrnum && ptcol1 == BgUtil.cvtTurnGm2Xg(this.player) &&
                         ptno2 >= chkrnum && ptcol2 == BgUtil.cvtTurnGm2Xg(this.player)); //動かせるチェッカーがあるかどうか
    const ismovableto = (ptno3 == 0 || (ptno3 == 1 && ptcol3 == BgUtil.cvtTurnGm2Xg(!this.player))); //空かブロットかどうか

    if (!(ismovablefr && ismovableto)) {
      return; //動かせるチェッカーが２つない、または、動かし先が空あるいはブロットでなければ何もしない
    }

    //１つ目のチェッカーを動かす
    const chker1 = this.board.getChequerOnDragging(pointfr1, BgUtil.cvtTurnGm2Bd(this.player));
    this.moveCheckerAction(chker1);

    //２つ目のチェッカーを動かす
    const chker2 = this.board.getChequerOnDragging(pointfr2, BgUtil.cvtTurnGm2Bd(this.player));
    this.moveCheckerAction(chker2);
  }

  moveCheckerAction(checker) {
    const checkerdom = checker.dom;
    const position = { //dragStopAction()に渡すオブジェクトを作る
            left: parseInt(checkerdom.style.left),
            top:  parseInt(checkerdom.style.top)
          };
    this.dragObject = null; //ヒットしたチェッカーを戻すアニメーションは不要
    this.dragStartPt = this.board.getDragEndPoint(position, BgUtil.cvtTurnGm2Bd(this.player));
    this.dragStopAction(position, false); //ヒット時のアニメーションをしない
  }

  setButtonEnabled(button, enable) {
    button.disabled = !enable;
  }

  saveSettingVars() {
    this.settingVars.matchlen    = document.getElementById("matchlen").value;
    this.settingVars.showpip     = document.getElementById("showpip").checked;
    this.settingVars.flashdest   = document.getElementById("flashdest").checked;
    this.settingVars.jacoby      = document.getElementById("jacoby").checked;
    this.settingVars.aiengine    = this.getAiEngineRadio();
  }

  loadSettingVars() {
    if (this.settingVars.matchlen === undefined) { return; } //一度も退避していなければ何もしない
    document.getElementById("matchlen").value      = this.settingVars.matchlen;
    document.getElementById("showpip").checked     = this.settingVars.showpip;
    document.getElementById("flashdest").checked   = this.settingVars.flashdest;
    document.getElementById("jacoby").checked      = this.settingVars.jacoby;
    this.setAiEngineRadio(this.settingVars.aiengine);
  }

  redrawAction() {
    this.board.redraw();
  }

} //end of class BgGame
