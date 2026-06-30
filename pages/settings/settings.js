// pages/settings/settings.js  计分规则设置页
const app = getApp();

// 完整默认设置（与 app.js 保持一致，但在这里用于兜底展示）
const DEFAULT_SETTINGS = {
  baseScore: 1,
  globalMultiplier: 1,
  maxScore: 0,
  minTotalScore: 0,
  dianpaoMultiplier: 1,
  zimoMultiplier: 1,
  gangHuaMultiplier: 1,
  gangPaoMultiplier: 1,
  qiangGangMultiplier: 1,
  mingGangScore: 1,
  buGangScore: 1,
  anGangScore: 2,
  zhuangEnabled: true,
  zhuangRate: 2,
  lianZhuangEnabled: true,
  lianZhuangMax: 0,
  liuJuEnabled: true,
  liuJuDeductBase: false,
  liuJuKeepZhuang: true,
  liuJuResetLianZhuang: false,
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

Page({
  data: {
    settings: {},   // 当前设置副本
    changed:  false,
  },

  onLoad() { this._loadSettings(); },
  onShow() { this._loadSettings(); },

  _loadSettings() {
    // 深拷贝，避免直接操作 globalData
    const raw = app.globalData.settings || {};
    // 确保 fanTypes 存在（老数据兜底）
    const merged = Object.assign({}, JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), JSON.parse(JSON.stringify(raw)));
    if (!Array.isArray(merged.fanTypes) || merged.fanTypes.length === 0) {
      merged.fanTypes = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.fanTypes));
    }
    this.setData({ settings: merged, changed: false });
  },

  // 需要取整的字段
  _intFields: [
    'baseScore', 'globalMultiplier', 'maxScore', 'minTotalScore',
    'dianpaoMultiplier', 'zimoMultiplier',
    'gangHuaMultiplier', 'gangPaoMultiplier', 'qiangGangMultiplier',
    'mingGangScore', 'buGangScore', 'anGangScore',
    'zhuangRate', 'lianZhuangMax',
  ],
  // 最小值为 1 的字段
  _minOneFields: [
    'baseScore', 'globalMultiplier',
    'dianpaoMultiplier', 'zimoMultiplier',
    'gangHuaMultiplier', 'gangPaoMultiplier', 'qiangGangMultiplier',
    'mingGangScore', 'buGangScore', 'anGangScore',
    'zhuangRate',
  ],

  // ── 实时输入（不强制最小值） ──────────────────────────────
  onInput(e) {
    const key = e.currentTarget.dataset.key;
    const raw = e.detail.value;
    if (raw === '') {
      this.setData({ changed: true });
      return;
    }
    const val = parseFloat(raw);
    if (isNaN(val)) return;
    const newSettings = { ...this.data.settings, [key]: val };
    this.setData({ settings: newSettings, changed: true });
  },

  // ── 失焦时校验并补回最小值 ────────────────────────────────
  onBlur(e) {
    const key = e.currentTarget.dataset.key;
    let val = parseFloat(e.detail.value);
    if (isNaN(val) || val < 0) val = 0;
    if (this._intFields.includes(key))    val = Math.floor(val);
    if (this._minOneFields.includes(key) && val < 1) val = 1;
    const newSettings = { ...this.data.settings, [key]: val };
    this.setData({ settings: newSettings });
  },

  // ── 通用 boolean 字段切换，data-key="fieldName" ───────────
  onToggle(e) {
    const key = e.currentTarget.dataset.key;
    const newVal = !this.data.settings[key];
    const newSettings = { ...this.data.settings, [key]: newVal };
    this.setData({ settings: newSettings, changed: true });
  },

  // ── 番型：切换 enabled ────────────────────────────────────
  onFanToggle(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const fanTypes = JSON.parse(JSON.stringify(this.data.settings.fanTypes));
    fanTypes[idx].enabled = !fanTypes[idx].enabled;
    this.setData({ ['settings.fanTypes']: fanTypes, changed: true });
  },

  // ── 番型：修改 rate（输入时） ─────────────────────────────
  onFanRateInput(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const raw = e.detail.value;
    if (raw === '') { this.setData({ changed: true }); return; }
    const val = parseFloat(raw);
    if (isNaN(val)) return;
    const fanTypes = JSON.parse(JSON.stringify(this.data.settings.fanTypes));
    fanTypes[idx].rate = val;
    this.setData({ ['settings.fanTypes']: fanTypes, changed: true });
  },

  // ── 番型：rate 失焦校验（最小为1） ───────────────────────
  onFanRateBlur(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    let val = parseFloat(e.detail.value);
    if (isNaN(val) || val < 1) val = 1;
    val = Math.floor(val);
    const fanTypes = JSON.parse(JSON.stringify(this.data.settings.fanTypes));
    fanTypes[idx].rate = val;
    this.setData({ ['settings.fanTypes']: fanTypes });
  },

  // ── 保存设置 ──────────────────────────────────────────────
  onSave() {
    app.globalData.settings = JSON.parse(JSON.stringify(this.data.settings));
    app.saveData();
    this.setData({ changed: false });
    wx.showToast({ title: '设置已保存', icon: 'success' });
  },

  // ── 恢复默认 ──────────────────────────────────────────────
  onRestoreDefault() {
    wx.showModal({
      title:       '恢复默认',
      content:     '确认将所有计分参数恢复为默认值？',
      confirmText: '确认',
      confirmColor:'#C0392B',
      success: res => {
        if (!res.confirm) return;
        const def = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        // 同步写回 app（兼容 app.js 可能无 getDefaultSettings 方法的情况）
        if (typeof app.getDefaultSettings === 'function') {
          const appDef = app.getDefaultSettings();
          Object.assign(def, appDef);
          // 确保 fanTypes 存在
          if (!Array.isArray(def.fanTypes) || def.fanTypes.length === 0) {
            def.fanTypes = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.fanTypes));
          }
        }
        app.globalData.settings = JSON.parse(JSON.stringify(def));
        app.saveData();
        this.setData({ settings: JSON.parse(JSON.stringify(def)), changed: false });
        wx.showToast({ title: '已恢复默认', icon: 'success' });
      },
    });
  },

  // ── 清空全部缓存 ──────────────────────────────────────────
  onClearAllCache() {
    wx.showModal({
      title:       '清空全部缓存',
      content:     '将清除所有玩家数据、历史记录、操作记录，恢复出厂状态。此操作不可恢复！',
      confirmText: '确认清空',
      confirmColor:'#C0392B',
      success: res => {
        if (!res.confirm) return;
        app.clearAll();
        app.saveData();
        const newSettings = Object.assign(
          {},
          JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
          JSON.parse(JSON.stringify(app.globalData.settings))
        );
        if (!Array.isArray(newSettings.fanTypes) || newSettings.fanTypes.length === 0) {
          newSettings.fanTypes = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.fanTypes));
        }
        this.setData({ settings: newSettings, changed: false });
        wx.showToast({ title: '已清空所有数据', icon: 'success' });
      },
    });
  },

  goBack() { wx.navigateBack(); },
});
