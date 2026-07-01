# 🀄 麻将计分器

> 微信小程序 · 4人麻将 · 纯前端本地计分 · 无需后端/登录/联网

![license](https://img.shields.io/badge/license-MIT-blue)
![platform](https://img.shields.io/badge/platform-WeChat%20MiniProgram-brightgreen)

---

## 功能概览

- **5种胡牌**：点炮胡、自摸胡、杠上开花、杠上炮、抢杠胡
- **3种杠牌**：明杠、补杠、暗杠（分值独立配置）
- **番型系统**：碰碰胡、清一色、小七对、龙七对等，多选累乘
- **庄家倍率 + 连庄叠加**：连续坐庄倍率递增
- **流局机制**：可配置是否扣底分、是否换庄
- **手动调分**：兜底补充，适配各地民间约定
- **一键撤销**：支持跨局撤回
- **历史记录**：5种筛选，倍率明细展开查看
- **本地持久化**：关闭微信/重启手机，数据不丢失

## 计分公式

```
最终分 = 底分 × 操作倍率 × 全局倍数
       × 番型倍率（累乘）× 庄家倍率 × 连庄倍率 × 大胡加倍
```

四人得失之和恒为 0，账目绝对平衡。

## 快速上手

1. 克隆仓库
```bash
git clone https://github.com/lidandan-cau/mahjong-scorer.git
```

2. 打开**微信开发者工具** → 导入项目 → 选择项目根目录

3. 在 `project.config.json` 中将 `appid` 替换为自己的 AppID

4. 点击「编译」即可运行

## 文档

- [📖 完整操作说明](docs/操作说明.md)
- [✍️ 开发过程文章](docs/麻将计分器_开发过程篇.md)
- [🐛 踩坑实录 + 完整提示词](docs/麻将计分器_提示词与踩坑篇.md)

## 项目结构

```
├── app.js / app.json / app.wxss   全局配置
├── utils/
│   ├── calc.js                    核心计分引擎
│   └── storage.js                 本地缓存封装
├── pages/
│   ├── index/                     首页（核心计分）
│   ├── settings/                  设置页
│   └── history/                   历史记录
└── docs/                          文档
```

## License

MIT
