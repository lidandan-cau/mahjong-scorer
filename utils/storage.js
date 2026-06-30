// utils/storage.js  本地存储封装 v2
const KEYS = {
  PLAYERS:          'mj_players',
  SETTINGS:         'mj_settings',
  CURRENT_ROUND:    'mj_round',
  ZHUANG_JIA_ID:    'mj_zhuang',
  LIAN_ZHUANG:      'mj_lian',
  OP_STACK:         'mj_op_stack',
  HISTORY:          'mj_history',
};

function loadAllData() {
  const zhuangRaw = wx.getStorageSync(KEYS.ZHUANG_JIA_ID);
  const lianRaw   = wx.getStorageSync(KEYS.LIAN_ZHUANG);
  return {
    players:         wx.getStorageSync(KEYS.PLAYERS)       || null,
    settings:        wx.getStorageSync(KEYS.SETTINGS)      || null,
    currentRound:    wx.getStorageSync(KEYS.CURRENT_ROUND) || null,
    zhuangJiaId:     (zhuangRaw === '' || zhuangRaw == null) ? null : zhuangRaw,
    lianZhuangCount: (lianRaw   === '' || lianRaw   == null) ? null : lianRaw,
    operationStack:  wx.getStorageSync(KEYS.OP_STACK)      || null,
    history:         wx.getStorageSync(KEYS.HISTORY)       || null,
  };
}

function saveAllData(d) {
  wx.setStorageSync(KEYS.PLAYERS,       d.players);
  wx.setStorageSync(KEYS.SETTINGS,      d.settings);
  wx.setStorageSync(KEYS.CURRENT_ROUND, d.currentRound);
  wx.setStorageSync(KEYS.ZHUANG_JIA_ID, d.zhuangJiaId != null ? d.zhuangJiaId : 0);
  wx.setStorageSync(KEYS.LIAN_ZHUANG,   d.lianZhuangCount != null ? d.lianZhuangCount : 0);
  wx.setStorageSync(KEYS.OP_STACK,      d.operationStack);
  wx.setStorageSync(KEYS.HISTORY,       d.history);
}

function clearAllData() {
  Object.values(KEYS).forEach(k => wx.removeStorageSync(k));
}

module.exports = { loadAllData, saveAllData, clearAllData };
