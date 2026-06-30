// utils/calc.js  核心计分计算模块
// 所有分数计算均在此处完成，确保账目平衡（四人总和恒为0）
//
// ── 倍率叠加公式 ────────────────────────────────────────────
//  最终分值 = 底分 × 操作倍数 × 全局倍数
//              × 番型倍率(累乘)
//              × 庄家倍率(若胡/杠牌者是庄家)
//              × 连庄倍率(若庄家连续胡牌)
//              × 大胡加倍(×2)
//  各倍率互相独立，叠加无冲突
// ────────────────────────────────────────────────────────────

// ─── 连庄倍率 ────────────────────────────────────────────────
/**
 * 连庄倍率规则：
 *   lianCount = 0  →  首次坐庄，×1
 *   lianCount = 1  →  第1次连庄，×2
 *   lianCount = N  →  第N次连庄，×(N+1)
 * 可通过 lianZhuangMax 设置上限（0=不限）
 */
function calcLianRate(lianCount, cfg) {
  if (!cfg.lianZhuangEnabled || lianCount <= 0) return 1;
  const rate = 1 + lianCount;
  return cfg.lianZhuangMax > 0 ? Math.min(rate, cfg.lianZhuangMax) : rate;
}

// ─── 番型总倍率 ──────────────────────────────────────────────
/**
 * 所有选中番型的倍率累乘
 * @param {string[]} ids      选中的番型 id 列表
 * @param {Array}    fanTypes settings.fanTypes
 */
function calcFanRate(ids, fanTypes) {
  if (!ids || ids.length === 0) return 1;
  const list = fanTypes || [];
  return ids.reduce((acc, id) => {
    const f = list.find(x => x.id === id && x.enabled);
    return f ? acc * (f.rate || 1) : acc;
  }, 1);
}

// ─── 庄家倍率 ────────────────────────────────────────────────
function calcZhuangRate(actorId, zhuangJiaId, cfg) {
  if (!cfg.zhuangEnabled || actorId !== zhuangJiaId) return 1;
  return cfg.zhuangRate || 2;
}

// ─── 杠牌分数（独立函数，可被多个操作类型复用） ──────────────
/**
 * 计算纯杠牌得失
 *  gangerId 赢得三份，其余三人各付一份 → 总和 = 0 ✓
 *  庄家开杠：每份 × 庄家倍率
 */
function calcGangDeltas(gangerId, gangType, cfg, zhuangJiaId) {
  const d = [0, 0, 0, 0];
  const scoreMap = { ming: cfg.mingGangScore, bu: cfg.buGangScore, an: cfg.anGangScore };
  const raw = scoreMap[gangType];
  if (raw == null || gangerId < 0) return d;

  const zRate = calcZhuangRate(gangerId, zhuangJiaId, cfg);
  const pay   = Math.round(raw * zRate * (cfg.globalMultiplier || 1));

  d[gangerId] = +pay * 3;
  for (let i = 0; i < 4; i++) { if (i !== gangerId) d[i] = -pay; }
  return d;
}

// ─── 主计算入口 ──────────────────────────────────────────────
/**
 * 计算四人分数变化
 *
 * @param {Object} p  参数对象：
 *   opType         - 操作类型（见下方常量）
 *   winnerId       - 胡/杠牌者 id（0-3，-1=未选）
 *   shooterId      - 点炮者 id（点炮系操作有效）
 *   gangerId       - 开杠者 id（杠上系操作有效）
 *   gangType       - 杠类型 'ming'|'bu'|'an'
 *   selectedFanIds - 选中番型 id 数组
 *   isDouble       - 大胡加倍
 *   cfg            - settings
 *   zhuangJiaId    - 当前庄家 id
 *   lianCount      - 连庄次数
 *
 * @returns {{ deltas: number[], breakdown: Object }}
 *   deltas[i]  第 i 位玩家本次得失（四者之和 = 0）
 *   breakdown  倍率明细（用于结算弹窗）
 */
function calcOperation(p) {
  const {
    opType, winnerId = -1, shooterId = -1,
    gangerId = -1, gangType = 'ming',
    selectedFanIds = [], isDouble = false,
    cfg, zhuangJiaId, lianCount = 0,
  } = p;

  const deltas   = [0, 0, 0, 0];
  const fanRate   = calcFanRate(selectedFanIds, cfg.fanTypes);
  const doubleR   = isDouble ? 2 : 1;

  // 胡牌者决定庄家/连庄倍率；杠操作中 gangerId 即操作者
  const actor     = (winnerId >= 0) ? winnerId : gangerId;
  const zhuangR   = (actor >= 0) ? calcZhuangRate(actor, zhuangJiaId, cfg) : 1;
  const lianR     = (actor === zhuangJiaId) ? calcLianRate(lianCount, cfg) : 1;

  // 倍率明细对象（供 breakdown 展示）
  const bk = {
    fanRate, zhuangRate: zhuangR, lianRate: lianR, doubleRate: doubleR,
    fanNames: selectedFanIds.map(id => {
      const f = (cfg.fanTypes || []).find(x => x.id === id);
      return f ? f.name : id;
    }),
    gangBase: 0, winBase: 0,
  };

  /** 内部：构建一份胡牌计算（点炮 / 自摸 两种模式） */
  function applyWin(mulKey, winMode) {
    // winMode: 'zimo' | 'dianpao'
    let base = cfg.baseScore * (cfg[mulKey] || 1) * (cfg.globalMultiplier || 1);
    base *= fanRate * zhuangR * lianR * doubleR;
    if (cfg.maxScore > 0) base = Math.min(base, cfg.maxScore);
    base = Math.round(base);
    bk.winBase = base;

    if (winMode === 'zimo') {
      // 胡牌者收三份，其余各付一份 → 总和 = 0 ✓
      deltas[winnerId] += +base * 3;
      for (let i = 0; i < 4; i++) { if (i !== winnerId) deltas[i] += -base; }
    } else {
      // 点炮：胡牌者 +base，点炮者 -base，其余不变 → 总和 = 0 ✓
      const sid = (winMode === 'dianpao') ? shooterId : gangerId;
      if (sid < 0) return;
      deltas[winnerId] += +base;
      deltas[sid]       += -base;
    }
  }

  switch (opType) {

    // ── 普通点炮胡 ─────────────────────────────────────────
    case 'dianpao':
      if (winnerId < 0 || shooterId < 0) break;
      applyWin('dianpaoMultiplier', 'dianpao');
      break;

    // ── 普通自摸胡 ─────────────────────────────────────────
    case 'zimo':
      if (winnerId < 0) break;
      applyWin('zimoMultiplier', 'zimo');
      break;

    // ── 杠上开花 ──────────────────────────────────────────
    // 同一人先开杠，再摸牌胡 → Phase1 结算杠分 + Phase2 结算自摸胡
    // 注意：Phase1/2 都乘庄家/连庄倍率
    case 'gangHua': {
      if (winnerId < 0) break;
      // Phase1: 杠分
      const gd1 = calcGangDeltas(winnerId, gangType, cfg, zhuangJiaId);
      for (let i = 0; i < 4; i++) deltas[i] += gd1[i];
      bk.gangBase = gd1[winnerId] / 3;  // 每人付的杠分
      // Phase2: 自摸胡
      applyWin('gangHuaMultiplier', 'zimo');
      break;
    }

    // ── 杠上炮 ────────────────────────────────────────────
    // gangerId 开杠后打出牌，winnerId 胡牌
    // Phase1: 结算杠分（gangerId 受益）
    // Phase2: 结算点炮（gangerId 作为点炮者赔付）
    // 总和：Phase1 sum=0，Phase2 sum=0 → 整体 sum=0 ✓
    case 'gangPao': {
      if (winnerId < 0 || gangerId < 0) break;
      // Phase1: 杠分（庄家倍率以 gangerId 为准）
      const gd2 = calcGangDeltas(gangerId, gangType, cfg, zhuangJiaId);
      for (let i = 0; i < 4; i++) deltas[i] += gd2[i];
      bk.gangBase = Math.abs(gd2[(gangerId + 1) % 4] || 0);
      // Phase2: 胡牌（庄家倍率以 winnerId 为准）
      applyWin('gangPaoMultiplier', 'gangpao');
      break;
    }

    // ── 抢杠胡 ────────────────────────────────────────────
    // gangerId 试图 补杠，winnerId 抢胡
    // 仅 gangerId 赔付，不结算杠分，另外两人不变
    case 'qiangGang': {
      if (winnerId < 0 || gangerId < 0) break;
      applyWin('qiangGangMultiplier', 'gangpao');
      break;
    }

    // ── 明杠 ─────────────────────────────────────────────
    case 'mingGang': {
      const gd = calcGangDeltas(winnerId, 'ming', cfg, zhuangJiaId);
      for (let i = 0; i < 4; i++) deltas[i] = gd[i];
      bk.gangBase = gd[winnerId] / 3;
      break;
    }

    // ── 补杠 ─────────────────────────────────────────────
    case 'buGang': {
      const gd = calcGangDeltas(winnerId, 'bu', cfg, zhuangJiaId);
      for (let i = 0; i < 4; i++) deltas[i] = gd[i];
      bk.gangBase = gd[winnerId] / 3;
      break;
    }

    // ── 暗杠 ─────────────────────────────────────────────
    case 'anGang': {
      const gd = calcGangDeltas(winnerId, 'an', cfg, zhuangJiaId);
      for (let i = 0; i < 4; i++) deltas[i] = gd[i];
      bk.gangBase = gd[winnerId] / 3;
      break;
    }

    // ── 流局 ─────────────────────────────────────────────
    // 若设置扣底分，庄家收三份，闲家各付一份（与自摸同结构）
    case 'liuJu': {
      if (cfg.liuJuDeductBase) {
        const base = Math.round(cfg.baseScore * (cfg.globalMultiplier || 1));
        const zid  = zhuangJiaId;
        deltas[zid] = +base * 3;
        for (let i = 0; i < 4; i++) { if (i !== zid) deltas[i] = -base; }
        bk.winBase = base;
      }
      break;
    }
  }

  // 校验：四人总和必须为 0
  const sum = deltas.reduce((a, b) => a + b, 0);
  if (sum !== 0) {
    // 理论上不应出现，作为兜底修正记录日志
    console.error('[calc] 账目不平衡! sum =', sum, 'opType =', opType, 'deltas =', deltas);
  }

  return { deltas, breakdown: bk };
}

// ─── 工具函数 ────────────────────────────────────────────────

/** 分数带符号格式化 */
function fmtScore(n) { return n > 0 ? '+' + n : String(n); }

/** 时间戳格式化 */
function fmtTime(ts) {
  const d = new Date(ts);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 轮换庄家：跳过已隐藏的玩家 */
function nextZhuang(curId, players) {
  for (let i = 1; i <= 4; i++) {
    const next = (curId + i) % 4;
    if (!players[next].hidden) return next;
  }
  return curId;
}

/** 操作类型中文名 */
const OP_LABELS = {
  dianpao:  '点炮胡',
  zimo:     '自摸胡',
  gangHua:  '杠上开花',
  gangPao:  '杠上炮',
  qiangGang:'抢杠胡',
  mingGang: '明杠',
  buGang:   '补杠',
  anGang:   '暗杠',
  liuJu:    '流局',
  manual:   '手动调分',
};

/** 杠类型中文名 */
const GANG_LABELS = { ming: '明杠', bu: '补杠', an: '暗杠' };

/** 是否是胡牌操作（结束本局） */
function isWinOp(opType) {
  return ['dianpao', 'zimo', 'gangHua', 'gangPao', 'qiangGang'].includes(opType);
}

/** 是否是纯杠操作（不结束本局） */
function isGangOp(opType) {
  return ['mingGang', 'buGang', 'anGang'].includes(opType);
}

module.exports = {
  calcOperation, calcGangDeltas, calcLianRate, calcFanRate,
  fmtScore, fmtTime, nextZhuang,
  OP_LABELS, GANG_LABELS, isWinOp, isGangOp,
};
