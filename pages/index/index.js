// pages/index/index.js  核心计分页 v2.0
const app = getApp();
const { calcOperation, fmtScore, fmtTime, nextZhuang, OP_LABELS, GANG_LABELS, isWinOp, isGangOp } = require('../../utils/calc');

// 需要两步选人的操作（第0步选胡/杠，第1步选点炮/开杠者）
const TWO_STEP_OPS = { dianpao: 1, gangPao: 1, qiangGang: 1 };
// 需要选杠类型的操作
const NEED_GANG_TYPE = { gangHua: 1, gangPao: 1 };

Page({
  data: {
    players:         [],
    settings:        {},
    currentRound:    1,
    zhuangJiaId:     0,
    lianZhuangCount: 0,
    canUndo:         false,

    // ── 操作面板 ─────────────────────────────────────────────
    panelVisible:  false,
    opType:        '',
    opStep:        0,
    selWinnerId:   -1,   // 胡/杠牌者
    selShooterId:  -1,   // 点炮者
    selGangerId:   -1,   // 开杠者（gangPao/qiangGang）
    selGangType:   '',   // 'ming'|'bu'|'an'
    isDouble:      false,
    selectedFanIds:    [],
    selectedFanNamesStr: '', // 已选番型名称，用"+"拼接，直接展示
    panelTitle:    '',
    panelHint:     '',
    previewDeltas: [0,0,0,0],
    showGangTypeSel: false, // 是否展示杠类型选择行

    // 番型选择弹窗（嵌在面板内，滑出）
    fanListVisible: false,

    // ── 结算弹窗 ─────────────────────────────────────────────
    settlementVisible:  false,
    settlement:         null,
    showZhuangChoice:   false, // 是否显示连庄/换庄选择

    // ── 手动加减分 ────────────────────────────────────────────
    manualVisible:   false,
    manualPlayerId:  -1,
    manualAmountStr: '',
    manualAmountN:   0,

    // ── 改名弹窗 ─────────────────────────────────────────────
    renameVisible: false,
    renameId:      -1,
    renameTmp:     '',

    // ── 流局弹窗 ─────────────────────────────────────────────
    liuJuVisible: false,
  },

  onLoad()  { this._refresh(); },
  onShow()  { this._refresh(); },

  // ── 刷新全部状态 ────────────────────────────────────────────
  _refresh() {
    const { players, settings, currentRound, operationStack, zhuangJiaId, lianZhuangCount } = app.globalData;
    this.setData({
      players:         this._rp(players, zhuangJiaId),
      settings,
      currentRound,
      zhuangJiaId,
      lianZhuangCount,
      canUndo: operationStack.length > 0,
    });
  },

  /** 渲染玩家数组：附加显示用字段 */
  _rp(players, zid) {
    return players.map(p => ({
      ...p,
      isZhuang:      p.id === zid,
      roundScoreStr: fmtScore(p.roundScore),
      totalScoreStr: fmtScore(p.totalScore),
      roundScoreCls: p.roundScore > 0 ? 'score-pos' : p.roundScore < 0 ? 'score-neg' : 'score-zero',
      totalScoreCls: p.totalScore > 0 ? 'score-pos' : p.totalScore < 0 ? 'score-neg' : 'score-zero',
    }));
  },

  /** 实时预计算分数预览 */
  _updatePreview() {
    const { opType, selWinnerId, selShooterId, selGangerId, selGangType, isDouble, selectedFanIds, settings, zhuangJiaId, lianZhuangCount } = this.data;
    if (selWinnerId === -1 && selGangerId === -1) {
      this.setData({ previewDeltas: [0,0,0,0] }); return;
    }
    const { deltas } = calcOperation({
      opType, winnerId: selWinnerId, shooterId: selShooterId,
      gangerId: selGangerId, gangType: selGangType || 'ming',
      selectedFanIds, isDouble, cfg: settings, zhuangJiaId, lianCount: lianZhuangCount,
    });
    this.setData({ previewDeltas: deltas });
  },

  // ════════════════════════════════════════════════════════════
  //  操作面板 —— 打开
  // ════════════════════════════════════════════════════════════
  onOpBtnTap(e) {
    const type = e.currentTarget.dataset.type;
    const hints = {
      dianpao:'请选择 胡牌者', zimo:'请选择 自摸者',
      gangHua:'请选择 开花者', gangPao:'请选择 胡牌者',
      qiangGang:'请选择 胡牌者',
      mingGang:'请选择 明杠者', buGang:'请选择 补杠者', anGang:'请选择 暗杠者',
    };
    const needGangType = !!NEED_GANG_TYPE[type];
    this.setData({
      panelVisible: true,
      opType: type,
      opStep: 0,
      selWinnerId: -1, selShooterId: -1,
      selGangerId: -1, selGangType: '',
      isDouble: false, selectedFanIds: [], selectedFanNamesStr: '',
      panelTitle: OP_LABELS[type] || type,
      panelHint:  hints[type] || '请选择玩家',
      showGangTypeSel: needGangType,
      previewDeltas: [0,0,0,0],
      fanListVisible: false,
    });
  },

  onClosePanel() { this.setData({ panelVisible: false, fanListVisible: false }); },

  // ── 玩家选择 ────────────────────────────────────────────────
  onPanelPlayerTap(e) {
    const id = Number(e.currentTarget.dataset.id);
    const { opType, opStep, selWinnerId, settings, zhuangJiaId, lianZhuangCount, selGangType, isDouble, selectedFanIds } = this.data;

    let newState = {};

    if (opType === 'dianpao') {
      if (opStep === 0) {
        newState = { selWinnerId: id, opStep: 1, panelHint: '请选择 点炮者' };
      } else {
        if (id === selWinnerId) { wx.showToast({ title: '不能选同一人', icon: 'none' }); return; }
        newState = { selShooterId: id };
      }
    } else if (opType === 'gangPao') {
      if (opStep === 0) {
        newState = { selWinnerId: id, opStep: 1, panelHint: '请选择 开杠者（被点炮方）' };
      } else {
        if (id === selWinnerId) { wx.showToast({ title: '不能选同一人', icon: 'none' }); return; }
        newState = { selGangerId: id };
      }
    } else if (opType === 'qiangGang') {
      if (opStep === 0) {
        newState = { selWinnerId: id, opStep: 1, panelHint: '请选择 被抢杠者' };
      } else {
        if (id === selWinnerId) { wx.showToast({ title: '不能选同一人', icon: 'none' }); return; }
        newState = { selGangerId: id };
      }
    } else {
      // 自摸、杠上开花、明/补/暗杠：只选一人
      newState = { selWinnerId: id };
    }

    this.setData(newState, () => this._updatePreview());
  },

  // ── 杠类型选择 ──────────────────────────────────────────────
  onSelectGangType(e) {
    const gt = e.currentTarget.dataset.gangtype;
    this.setData({ selGangType: gt }, () => this._updatePreview());
  },

  // ── 大胡加倍 ────────────────────────────────────────────────
  onToggleDouble() {
    this.setData({ isDouble: !this.data.isDouble }, () => this._updatePreview());
  },

  // ── 番型列表 ─────────────────────────────────────────────────
  onOpenFanList()  { this.setData({ fanListVisible: true }); },
  onCloseFanList() { this.setData({ fanListVisible: false }); },

  onToggleFan(e) {
    const id  = e.currentTarget.dataset.fanid;
    const ids = [...this.data.selectedFanIds];
    const idx = ids.indexOf(id);
    if (idx >= 0) ids.splice(idx, 1); else ids.push(id);
    // 计算已选番型名称字符串，用"+"拼接
    const namesStr = ids.map(fid => {
      const f = (this.data.settings.fanTypes || []).find(x => x.id === fid);
      return f ? f.name : fid;
    }).join('+');
    this.setData({ selectedFanIds: ids, selectedFanNamesStr: namesStr }, () => this._updatePreview());
  },

  // ── 确认操作 ─────────────────────────────────────────────────
  onConfirmOp() {
    const { opType, selWinnerId, selShooterId, selGangerId, selGangType,
            isDouble, selectedFanIds, settings, currentRound,
            zhuangJiaId, lianZhuangCount } = this.data;

    // ── 校验完整性 ───────────────────────────────────────────
    if (selWinnerId === -1 && selGangerId === -1) {
      wx.showToast({ title: '请先选择玩家', icon: 'none' }); return;
    }
    if (opType === 'dianpao' && selShooterId === -1) {
      wx.showToast({ title: '请选择点炮者', icon: 'none' }); return;
    }
    if ((opType === 'gangPao' || opType === 'qiangGang') && selGangerId === -1) {
      wx.showToast({ title: '请选择对应玩家', icon: 'none' }); return;
    }
    if (NEED_GANG_TYPE[opType] && !selGangType) {
      wx.showToast({ title: '请选择杠的类型', icon: 'none' }); return;
    }

    const { deltas, breakdown } = calcOperation({
      opType, winnerId: selWinnerId, shooterId: selShooterId,
      gangerId: selGangerId, gangType: selGangType || 'ming',
      selectedFanIds, isDouble, cfg: settings,
      zhuangJiaId, lianCount: lianZhuangCount,
    });

    const roundEnd = isWinOp(opType) || opType === 'liuJu';

    // ── 更新玩家分数 ─────────────────────────────────────────
    const newPlayers = app.globalData.players.map((p, i) => ({
      ...p,
      roundScore: p.roundScore + deltas[i],
      totalScore: p.totalScore + deltas[i],
    }));

    // ── 入操作栈 ─────────────────────────────────────────────
    const winnerId = selWinnerId >= 0 ? selWinnerId : selGangerId;
    const isWinnerZhuang = isWinOp(opType) && (winnerId === zhuangJiaId);
    const opRec = {
      type: opType, deltas, isRoundEnd: roundEnd, settled: false,
      roundNumber: currentRound, winnerId, shooterId: selShooterId,
      gangerId: selGangerId, gangType: selGangType,
      zhuangJiaId, lianZhuangCount,
      isWinnerZhuang, selectedFanIds, isDouble, breakdown,
      timestamp: Date.now(),
    };
    const newStack = [...app.globalData.operationStack, opRec];

    app.globalData.players        = newPlayers;
    app.globalData.operationStack = newStack;

    this.setData({ panelVisible: false, fanListVisible: false });

    if (roundEnd) {
      // ── 构建结算数据 ─────────────────────────────────────
      const fanNames = (selectedFanIds || []).map(id => {
        const f = (settings.fanTypes || []).find(x => x.id === id);
        return f ? f.name : id;
      });
      const opLabel = OP_LABELS[opType]
        + (isWinnerZhuang ? '（庄家）' : '')
        + (fanNames.length ? `【${fanNames.join('+')}】` : '')
        + (isDouble ? '（大胡×2）' : '');

      const histRec = {
        id: opRec.timestamp, round: currentRound,
        timeStr: fmtTime(opRec.timestamp),
        opType, opLabel,
        isWinnerZhuang,
        winnerName:  winnerId >= 0 ? newPlayers[winnerId].name : '',
        shooterName: selShooterId >= 0 ? newPlayers[selShooterId].name : '',
        gangerName:  selGangerId >= 0 ? newPlayers[selGangerId].name : '',
        zhuangName:  newPlayers[zhuangJiaId].name,
        lianZhuangCount,
        breakdown,
        items: newPlayers.map((p, i) => ({
          name: p.name, delta: fmtScore(deltas[i]),
          total: fmtScore(p.totalScore), deltaN: deltas[i],
        })),
      };
      app.globalData.history.unshift(histRec);
      app.saveData();

      const settlement = {
        round: currentRound, opLabel,
        winnerName:  histRec.winnerName,
        shooterName: histRec.shooterName,
        breakdown,
        items: newPlayers.map((p, i) => ({
          name: p.name, delta: fmtScore(deltas[i]),
          total: fmtScore(p.totalScore),
          deltaCls: deltas[i] > 0 ? 'score-pos' : deltas[i] < 0 ? 'score-neg' : 'score-zero',
          totalCls: p.totalScore > 0 ? 'score-pos' : p.totalScore < 0 ? 'score-neg' : 'score-zero',
        })),
      };

      this.setData({
        players:           this._rp(newPlayers, zhuangJiaId),
        canUndo:           newStack.length > 0,
        settlementVisible: true,
        settlement,
        // 只有胡牌操作才显示连庄/换庄选择（流局走另套逻辑）
        showZhuangChoice:  isWinOp(opType) && isWinnerZhuang,
      });
    } else {
      // 纯杠牌，直接更新，不弹结算
      app.saveData();
      const actor = selWinnerId >= 0 ? newPlayers[selWinnerId].name : newPlayers[selGangerId].name;
      const gangLabel = (opType === 'mingGang') ? '明杠' : (opType === 'buGang') ? '补杠' : '暗杠';
      const isZhuangKong = (selWinnerId >= 0 ? selWinnerId : selGangerId) === zhuangJiaId && settings.zhuangEnabled;
      wx.showToast({
        title: `${actor}${gangLabel}${isZhuangKong ? '（庄）' : ''} ${fmtScore(deltas[selWinnerId >= 0 ? selWinnerId : selGangerId])}`,
        icon: 'none', duration: 2000,
      });
      this.setData({ players: this._rp(newPlayers, zhuangJiaId), canUndo: newStack.length > 0 });
    }
  },

  // ════════════════════════════════════════════════════════════
  //  结算弹窗 —— 连庄 / 换庄 / 流局
  // ════════════════════════════════════════════════════════════

  /** 庄家胡牌选择连庄 */
  onChooseLianZhuang() {
    const stack = app.globalData.operationStack;
    if (stack.length > 0) stack[stack.length - 1].settled = true;
    const newRound   = app.globalData.currentRound + 1;
    const newLian    = app.globalData.lianZhuangCount + 1;
    const newPlayers = app.globalData.players.map(p => ({ ...p, roundScore: 0 }));
    app.globalData.players         = newPlayers;
    app.globalData.currentRound    = newRound;
    app.globalData.lianZhuangCount = newLian;
    app.saveData();
    this.setData({
      players:           this._rp(newPlayers, this.data.zhuangJiaId),
      currentRound:      newRound,
      lianZhuangCount:   newLian,
      settlementVisible: false, settlement: null,
    });
    wx.showToast({ title: `🎉 连庄第${newLian}次！`, icon: 'none', duration: 2000 });
  },

  /** 换庄（胡牌后轮到下一家，或手动换庄） */
  onChooseHuanZhuang() {
    const stack = app.globalData.operationStack;
    if (stack.length > 0) stack[stack.length - 1].settled = true;
    const newRound   = app.globalData.currentRound + 1;
    const newZhuang  = nextZhuang(app.globalData.zhuangJiaId, app.globalData.players);
    const newPlayers = app.globalData.players.map(p => ({ ...p, roundScore: 0 }));
    app.globalData.players         = newPlayers;
    app.globalData.currentRound    = newRound;
    app.globalData.zhuangJiaId     = newZhuang;
    app.globalData.lianZhuangCount = 0;
    app.saveData();
    this.setData({
      players:           this._rp(newPlayers, newZhuang),
      currentRound:      newRound,
      zhuangJiaId:       newZhuang,
      lianZhuangCount:   0,
      settlementVisible: false, settlement: null,
    });
    wx.showToast({ title: `${app.globalData.players[newZhuang].name} 坐庄`, icon: 'none', duration: 1800 });
  },

  /** 非庄家胡牌时的「确认」（自动换庄） */
  onConfirmSettlement() { this.onChooseHuanZhuang(); },

  // ════════════════════════════════════════════════════════════
  //  流局
  // ════════════════════════════════════════════════════════════

  onLiuJuTap() {
    if (!this.data.settings.liuJuEnabled) {
      wx.showToast({ title: '流局功能未开启', icon: 'none' }); return;
    }
    this.setData({ liuJuVisible: true });
  },

  onCloseLiuJu() { this.setData({ liuJuVisible: false }); },

  onConfirmLiuJu() {
    const { settings, currentRound, zhuangJiaId, lianZhuangCount } = this.data;
    const { deltas } = calcOperation({
      opType: 'liuJu', winnerId: -1, shooterId: -1, gangerId: -1,
      gangType: 'ming', selectedFanIds: [], isDouble: false,
      cfg: settings, zhuangJiaId, lianCount: lianZhuangCount,
    });

    const newPlayers = app.globalData.players.map((p, i) => ({
      ...p, roundScore: p.roundScore + deltas[i], totalScore: p.totalScore + deltas[i],
    }));

    const opRec = {
      type: 'liuJu', deltas, isRoundEnd: true, settled: true,
      roundNumber: currentRound, winnerId: -1, timestamp: Date.now(),
    };
    app.globalData.operationStack.push(opRec);

    // 历史记录
    const histRec = {
      id: opRec.timestamp, round: currentRound,
      timeStr: fmtTime(opRec.timestamp), opType: 'liuJu', opLabel: '流局',
      isWinnerZhuang: false, winnerName: '', shooterName: '',
      zhuangName: newPlayers[zhuangJiaId].name, lianZhuangCount,
      breakdown: {}, items: newPlayers.map((p, i) => ({
        name: p.name, delta: fmtScore(deltas[i]), total: fmtScore(p.totalScore), deltaN: deltas[i],
      })),
    };
    app.globalData.history.unshift(histRec);

    // 流局换庄/保留庄家规则
    const newRound  = currentRound + 1;
    let newZhuang   = zhuangJiaId;
    let newLian     = lianZhuangCount;
    if (!settings.liuJuKeepZhuang) {
      newZhuang = nextZhuang(zhuangJiaId, app.globalData.players);
      newLian   = 0;
    }
    if (settings.liuJuResetLianZhuang) newLian = 0;

    const freshPlayers = newPlayers.map(p => ({ ...p, roundScore: 0 }));
    app.globalData.players         = freshPlayers;
    app.globalData.currentRound    = newRound;
    app.globalData.zhuangJiaId     = newZhuang;
    app.globalData.lianZhuangCount = newLian;
    app.saveData();

    this.setData({
      players:         this._rp(freshPlayers, newZhuang),
      currentRound:    newRound,
      zhuangJiaId:     newZhuang,
      lianZhuangCount: newLian,
      liuJuVisible:    false,
      canUndo:         app.globalData.operationStack.length > 0,
    });
    wx.showToast({ title: '流局结束', icon: 'none' });
  },

  // ════════════════════════════════════════════════════════════
  //  撤销
  // ════════════════════════════════════════════════════════════

  onUndo() {
    const stack = app.globalData.operationStack;
    if (stack.length === 0) { wx.showToast({ title: '暂无可撤销操作', icon: 'none' }); return; }
    const last    = stack[stack.length - 1];
    const newStack = stack.slice(0, -1);

    let newPlayers = app.globalData.players.map((p, i) => ({
      ...p, totalScore: p.totalScore - last.deltas[i],
    }));

    let newRound = app.globalData.currentRound;
    let newZhuang = app.globalData.zhuangJiaId;
    let newLian   = app.globalData.lianZhuangCount;

    if (last.isRoundEnd && last.settled) {
      // 撤回已结算的局：还原局数、庄家、连庄
      newRound  = last.roundNumber;
      newZhuang = last.zhuangJiaId;
      newLian   = last.lianZhuangCount;
      const idx = app.globalData.history.findIndex(h => h.id === last.timestamp);
      if (idx >= 0) app.globalData.history.splice(idx, 1);
    }

    // 重算本局 roundScore
    const rs = [0, 0, 0, 0];
    newStack.forEach(op => {
      if (op.roundNumber === newRound) op.deltas.forEach((d, i) => { rs[i] += d; });
    });
    newPlayers = newPlayers.map((p, i) => ({ ...p, roundScore: rs[i] }));

    app.globalData.players         = newPlayers;
    app.globalData.operationStack  = newStack;
    app.globalData.currentRound    = newRound;
    app.globalData.zhuangJiaId     = newZhuang;
    app.globalData.lianZhuangCount = newLian;
    app.saveData();

    this.setData({
      players: this._rp(newPlayers, newZhuang),
      currentRound: newRound, zhuangJiaId: newZhuang,
      lianZhuangCount: newLian, canUndo: newStack.length > 0,
    });
    wx.showToast({ title: '已撤销上一步', icon: 'success' });
  },

  // ════════════════════════════════════════════════════════════
  //  三档重置
  // ════════════════════════════════════════════════════════════

  onClearRound() {
    wx.showModal({
      title: '清空本局', content: '确认清空本局所有操作？', confirmText: '确认', confirmColor: '#C0392B',
      success: res => {
        if (!res.confirm) return;
        const { currentRound } = app.globalData;
        const np = app.globalData.players.map(p => ({
          ...p, totalScore: p.totalScore - p.roundScore, roundScore: 0,
        }));
        const ns = app.globalData.operationStack.filter(op => op.roundNumber !== currentRound);
        app.globalData.players = np; app.globalData.operationStack = ns; app.saveData();
        this.setData({ players: this._rp(np, this.data.zhuangJiaId), canUndo: ns.length > 0 });
        wx.showToast({ title: '本局已清空', icon: 'success' });
      },
    });
  },

  onResetScores() {
    wx.showModal({
      title: '重置总分', content: '将所有玩家总分归零，从第1局开始。历史记录保留。', confirmText: '确认', confirmColor: '#C0392B',
      success: res => {
        if (!res.confirm) return;
        const np = app.globalData.players.map(p => ({ ...p, totalScore: 0, roundScore: 0 }));
        app.globalData.players = np; app.globalData.currentRound = 1;
        app.globalData.operationStack = []; app.saveData();
        this.setData({ players: this._rp(np, this.data.zhuangJiaId), currentRound: 1, canUndo: false });
        wx.showToast({ title: '总分已重置', icon: 'success' });
      },
    });
  },

  onResetAll() {
    wx.showModal({
      title: '清空全部数据', content: '将清除所有分数、历史记录、操作记录，完全重置。', confirmText: '确认清空', confirmColor: '#C0392B',
      success: res => {
        if (!res.confirm) return;
        app.clearAll(); app.saveData();
        this.setData({
          players: this._rp(app.globalData.players, 0),
          currentRound: 1, zhuangJiaId: 0, lianZhuangCount: 0, canUndo: false,
        });
        wx.showToast({ title: '已完全重置', icon: 'success' });
      },
    });
  },

  // ════════════════════════════════════════════════════════════
  //  手动加减分
  // ════════════════════════════════════════════════════════════

  onManualTap() {
    this.setData({ manualVisible: true, manualPlayerId: -1, manualAmountStr: '', manualAmountN: 0 });
  },

  onCloseManual() { this.setData({ manualVisible: false }); },

  onManualSelectPlayer(e) {
    this.setData({ manualPlayerId: Number(e.currentTarget.dataset.id) });
  },

  onManualInput(e) {
    const raw = e.detail.value;
    const n   = parseFloat(raw);
    this.setData({ manualAmountStr: raw, manualAmountN: isNaN(n) ? 0 : n });
  },

  onManualSetAmount(e) {
    const v = Number(e.currentTarget.dataset.val);
    this.setData({ manualAmountStr: String(v), manualAmountN: v });
  },

  onConfirmManual() {
    const { manualPlayerId, manualAmountN } = this.data;
    if (manualPlayerId < 0) { wx.showToast({ title: '请选择玩家', icon: 'none' }); return; }
    if (manualAmountN === 0) { wx.showToast({ title: '金额不能为0', icon: 'none' }); return; }
    const np = app.globalData.players.map(p =>
      p.id === manualPlayerId ? { ...p, totalScore: p.totalScore + manualAmountN } : p
    );
    app.globalData.players = np; app.saveData();
    // 手动加减分不进撤销栈
    this.setData({ players: this._rp(np, this.data.zhuangJiaId), manualVisible: false });
    wx.showToast({ title: `${np[manualPlayerId].name} ${fmtScore(manualAmountN)}分`, icon: 'none', duration: 2000 });
  },

  // ════════════════════════════════════════════════════════════
  //  庄家切换
  // ════════════════════════════════════════════════════════════

  onSetZhuang(e) {
    const id = Number(e.currentTarget.dataset.id);
    app.globalData.zhuangJiaId     = id;
    app.globalData.lianZhuangCount = 0;
    app.saveData();
    this.setData({
      zhuangJiaId: id, lianZhuangCount: 0,
      players: this._rp(app.globalData.players, id),
    });
    wx.showToast({ title: `${app.globalData.players[id].name} 坐庄`, icon: 'none', duration: 1500 });
  },

  // ════════════════════════════════════════════════════════════
  //  玩家隐藏/显示
  // ════════════════════════════════════════════════════════════

  onToggleHide(e) {
    const id = Number(e.currentTarget.dataset.id);
    const np = app.globalData.players.map(p =>
      p.id === id ? { ...p, hidden: !p.hidden } : p
    );
    app.globalData.players = np; app.saveData();
    this.setData({ players: this._rp(np, this.data.zhuangJiaId) });
  },

  // ════════════════════════════════════════════════════════════
  //  改名 / 重置单人分数
  // ════════════════════════════════════════════════════════════

  onPlayerNameTap(e) {
    const id = Number(e.currentTarget.dataset.id);
    this.setData({ renameVisible: true, renameId: id, renameTmp: app.globalData.players[id].name });
  },
  onRenameInput(e) { this.setData({ renameTmp: e.detail.value }); },
  onConfirmRename() {
    const { renameId, renameTmp } = this.data;
    const name = renameTmp.trim();
    if (!name) { wx.showToast({ title: '昵称不能为空', icon: 'none' }); return; }
    const np = app.globalData.players.map(p => p.id === renameId ? { ...p, name } : p);
    app.globalData.players = np; app.saveData();
    this.setData({ players: this._rp(np, this.data.zhuangJiaId), renameVisible: false, renameId: -1, renameTmp: '' });
  },
  onCancelRename() { this.setData({ renameVisible: false, renameId: -1, renameTmp: '' }); },

  onResetPlayerScore(e) {
    const id = Number(e.currentTarget.dataset.id);
    wx.showModal({
      title: '重置玩家分数', content: `确认将「${app.globalData.players[id].name}」分数归零？`, confirmText: '确认', confirmColor: '#C0392B',
      success: res => {
        if (!res.confirm) return;
        const np = app.globalData.players.map(p => p.id === id ? { ...p, totalScore: 0, roundScore: 0 } : p);
        app.globalData.players = np; app.saveData();
        this.setData({ players: this._rp(np, this.data.zhuangJiaId) });
        wx.showToast({ title: '已重置', icon: 'success' });
      },
    });
  },

  // ════════════════════════════════════════════════════════════
  //  导航
  // ════════════════════════════════════════════════════════════
  goSettings() { wx.navigateTo({ url: '/pages/settings/settings' }); },
  goHistory()  { wx.navigateTo({ url: '/pages/history/history' }); },
});
