// pages/history/history.js  历史记录页
const app = getApp();

// 操作类型标签映射
const OP_LABELS = {
  zimo:      '自摸',
  dianpao:   '点炮',
  gangHua:   '杠上开花',
  gangPao:   '杠上炮',
  qiangGang: '抢杠胡',
  mingGang:  '明杠',
  buGang:    '补杠',
  anGang:    '暗杠',
  liuju:     '流局',
};

Page({
  data: {
    history:     [],    // 展示列表（已过滤）
    expandedId:  -1,    // 当前展开详情的记录 id
    isEmpty:     false,
    filterType:  'all', // 'all' | 'zimo' | 'dianpao' | 'gang' | 'zhuang'
    filterTabs: [
      { type: 'all',     label: '全部' },
      { type: 'zimo',    label: '自摸' },
      { type: 'dianpao', label: '点炮' },
      { type: 'gang',    label: '杠牌' },
      { type: 'zhuang',  label: '庄家局' },
    ],
  },

  onLoad()  { this._load(); },
  onShow()  { this._load(); },

  _load() {
    const allHist = app.globalData.history || [];
    const filterType = this.data.filterType;
    let list;

    if (filterType === 'all') {
      list = allHist;
    } else if (filterType === 'zimo') {
      list = allHist.filter(r => r.opType === 'zimo' || r.opType === 'gangHua');
    } else if (filterType === 'dianpao') {
      list = allHist.filter(r =>
        r.opType === 'dianpao' || r.opType === 'gangPao' || r.opType === 'qiangGang'
      );
    } else if (filterType === 'gang') {
      list = allHist.filter(r =>
        r.opType === 'mingGang' || r.opType === 'buGang' || r.opType === 'anGang'
      );
    } else if (filterType === 'zhuang') {
      list = allHist.filter(r => r.isWinnerZhuang === true);
    } else {
      list = allHist;
    }

    // 补充 opLabel（如果历史记录未存储该字段则动态补）
    list = list.map(r => ({
      ...r,
      opLabel: r.opLabel || OP_LABELS[r.opType] || r.opType || '未知操作',
    }));

    this.setData({
      history: list,
      isEmpty: list.length === 0,
    });
  },

  /** 切换筛选 tab */
  onFilterChange(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ filterType: type, expandedId: -1 }, () => {
      this._load();
    });
  },

  /** 展开/收起某条记录 */
  onToggleItem(e) {
    const id = Number(e.currentTarget.dataset.id);
    this.setData({
      expandedId: this.data.expandedId === id ? -1 : id,
    });
  },

  /** 删除单条记录 */
  onDeleteItem(e) {
    const id = Number(e.currentTarget.dataset.id);
    wx.showModal({
      title:       '删除记录',
      content:     '确认删除这条对局记录？',
      confirmText: '删除',
      confirmColor:'#C0392B',
      success: res => {
        if (!res.confirm) return;
        const idx = app.globalData.history.findIndex(h => h.id === id);
        if (idx !== -1) {
          app.globalData.history.splice(idx, 1);
          app.saveData();
        }
        this._load();
        wx.showToast({ title: '已删除', icon: 'success' });
      },
    });
  },

  /** 清空全部历史 */
  onClearAll() {
    if ((app.globalData.history || []).length === 0) {
      wx.showToast({ title: '暂无记录', icon: 'none' }); return;
    }
    wx.showModal({
      title:       '清空历史',
      content:     '确认清空全部历史对局记录？此操作不可恢复。',
      confirmText: '确认清空',
      confirmColor:'#C0392B',
      success: res => {
        if (!res.confirm) return;
        app.globalData.history = [];
        app.saveData();
        this._load();
        wx.showToast({ title: '已清空', icon: 'success' });
      },
    });
  },
});
