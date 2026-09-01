# flever 后端（第一批：骨架 + 本地跑通）

技术栈：Node 22 + Express + SQLite + EJS 服务端渲染（docs/04 定稿）。

## 本地跑
```bash
cd server
cp .env.example .env   # 改 ADMIN_PASSWORD
npm install
npm start              # http://localhost:3000
```

## 结构
- `src/index.js` 入口（首页路由在此）
- `src/routes/order.js` 顾客流：表单→确认→下单→mock支付→成功/查单
- `src/routes/admin.js` 后台：登录/订单列表改状态/每日名额
- `src/db.js` 四表（orders/form_submissions/uploads/queue_stats）+ 状态标签
- `src/queue.js` 每日限量排队；待支付 30 分钟惰性释放
- `src/pay.js` 可插拔支付接缝：本轮仅 mock；jsapi/h5 按 `docs/03` 后补
- `src/wecom.js` 企微群机器人 webhook 通知（未配置=只打日志）
- 页面模板在 `../pages/views/`，样式 `../pages/public/style.css`（v0.8 设计 tokens 复用）

## 演示路径
首页 → 预定 → 分步表单（花种/色系/参考图/套餐+手机号）→ 确认 → 模拟支付 → 成功页（订单号+排队位）
后台 `/admin`：看订单、改状态、调名额。我的订单 `/orders?phone=手机号`。
