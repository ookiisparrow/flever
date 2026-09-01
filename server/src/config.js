// 全局配置：全部从环境变量读，密钥只写路径/变量名不写值（见 .env.example）
module.exports = {
  port: process.env.PORT || 3000,
  host: process.env.HOST || '127.0.0.1', // 只绑回环，公网由 Caddy 反代（docs/04 部署定稿）
  adminPassword: process.env.ADMIN_PASSWORD || 'flora-admin-demo', // 生产必改
  sessionSecret: process.env.SESSION_SECRET || 'flora-dev-secret',
  wecomWebhook: process.env.WECOM_WEBHOOK || '', // 企微群机器人地址；空=占位不真发
  // 支付通道：mock=本地模拟；密钥到手后扩 'jsapi' | 'h5'（见 src/pay.js 接缝）
  payChannel: process.env.PAY_CHANNEL || 'mock',
  dbFile: process.env.DB_FILE || require('path').join(__dirname, '..', 'flora.db'),
  uploadDir: process.env.UPLOAD_DIR || require('path').join(__dirname, '..', 'data', 'uploads'),
  // 套餐档位：3 档名称价格待商家提供（docs/02），先按 v0.8 设计稿两档占位，直接改这里即可
  tiers: [
    { name: '经典', price: 128000, desc: '当季优选花材 · 按选题完整还原', tag: '' },
    { name: '臻选', price: 328000, desc: '稀缺级进口花材 · 进阶工艺', tag: '更深度的演绎' },
  ],
  // 花种/色系选项：待商家提供（docs/02 待提供素材），先占位
  flowers: ['玫瑰', '郁金香', '向日葵', '山茶', '桔梗'],
  colors: ['暖橙', '粉紫', '白绿', '莫兰迪'],
};
