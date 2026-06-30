// app.js  全局应用入口 v2.0
const { loadAllData, saveAllData, clearAllData } = require('./utils/storage');

const DEFAULT_PLAYERS = [
  { id: 0, name: '东家', totalScore: 0, roundScore: 0, hidden: false },
  { id: 1, name: '南家', totalScore: 0, roundScore: 0, hidden: false },
  { id: 2, name: '西家', totalScore: 0, roundScore: 0, hidden: false },
  { id: 3, name: '北家', totalScore: 0, roundScore: 0, hidden: false },
];

const DEFAULT_SETTINGS = {
  baseScore:            1,      // 底分
  globalMultiplier:     1,      // 全局倍数
  maxScore:             0,      // 单次封顶（0=不限）
  minTotalScore:        0,      // 最低负分（0=不限）
  dianpaoMultiplier:    1,      // 点炮倍数
  zimoMultiplier:       1,      // 自摸倍数
  gangHuaMultiplier:    1,      // 杠上开花胡牌部分倍数
  gangPaoMultiplier:    1,      // 杠上炮胡牌部分倍数
  qiangGangMultiplier:  1,      // 抢杠胡倍数
  mingGangScore:        1,      // 明杠每人支付
  buGangScore:          1,      // 补杠每人支付
  anGangScore:          2,      // 暗杠每人支付
  zhuangEnabled:        true,   // 庄家倍率开关
  zhuangRate:           2,      // 庄家倍率
  lianZhuangEnabled:    true,   // 连庄加成开关
  lianZhuangMax:        0,      // 连庄倍率上限（0=不限）
  liuJuEnabled:         true,   // 允许流局操作
  liuJuDeductBase:      false,  // 流局是否扣底分
  liuJuKeepZhuang:      true,   // 流局是否保留庄家
  liuJuResetLianZhuang: false,  // 流局是否清零连庄数
  fanTypes: [
    { id: 'pengpeng',  name: '碰碰胡', rate: 2, enabled: true },
    { id: 'qingyise',  name: '清一色', rate: 4, enabled: true },
    { id: 'xiaoqidui', name: '小七对', rate: 2, enabled: true },
    { id: 'longqidui', name: '龙七对', rate: 4, enabled: true },
    { id: 'tianhu',    name: '天胡',   rate: 8, enabled: true },
    { id: 'dihu',      name: '地胡',   rate: 4, enabled: true },
    { id: 'qinglong',  name: '清龙',   rate: 2, enabled: true },
  ],
};

App({
  globalData: {
    players:        [],
    settings:       {},
    currentRound:   1,
    zhuangJiaId:    0,
    lianZhuangCount:0,   // 连庄次数（0=首次坐庄，1=第1次连庄...）
    operationStack: [],
    history:        [],
  },

  onLaunch() { this.loadData(); },

  loadData() {
    const s = loadAllData();

    // 玩家数据：补全 hidden 字段（兼容旧版本）
    const rawPlayers = s.players || JSON.parse(JSON.stringify(DEFAULT_PLAYERS));
    this.globalData.players = rawPlayers.map(p => ({
      ...p,
      hidden: p.hidden || false,
    }));

    // 设置：合并默认值（新增字段不丢失）
    this.globalData.settings = Object.assign(
      {},
      JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
      s.settings || {}
    );
    // 确保 fanTypes 完整
    if (!Array.isArray(this.globalData.settings.fanTypes) ||
        this.globalData.settings.fanTypes.length === 0) {
      this.globalData.settings.fanTypes = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.fanTypes));
    }

    this.globalData.currentRound    = s.currentRound    || 1;
    this.globalData.zhuangJiaId     = s.zhuangJiaId     != null ? s.zhuangJiaId : 0;
    this.globalData.lianZhuangCount = s.lianZhuangCount != null ? s.lianZhuangCount : 0;
    this.globalData.operationStack  = s.operationStack  || [];
    this.globalData.history         = s.history         || [];
  },

  saveData() {
    saveAllData({
      players:         this.globalData.players,
      settings:        this.globalData.settings,
      currentRound:    this.globalData.currentRound,
      zhuangJiaId:     this.globalData.zhuangJiaId,
      lianZhuangCount: this.globalData.lianZhuangCount,
      operationStack:  this.globalData.operationStack,
      history:         this.globalData.history,
    });
  },

  clearAll() {
    clearAllData();
    this.globalData.players         = JSON.parse(JSON.stringify(DEFAULT_PLAYERS));
    this.globalData.settings        = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    this.globalData.currentRound    = 1;
    this.globalData.zhuangJiaId     = 0;
    this.globalData.lianZhuangCount = 0;
    this.globalData.operationStack  = [];
    this.globalData.history         = [];
  },

  getDefaultPlayers()  { return JSON.parse(JSON.stringify(DEFAULT_PLAYERS)); },
  getDefaultSettings() { return JSON.parse(JSON.stringify(DEFAULT_SETTINGS)); },
});
