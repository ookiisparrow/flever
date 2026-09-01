// flever 花艺定制 · 后端入口（Express 服务端渲染多页，docs/04 定稿）
const express = require('express');
const path = require('path');
const db = require('./db');
const config = require('./config');
const queue = require('./queue');
const { STATUS_LABELS } = db;

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', '..', 'pages', 'views'));
app.locals.STATUS_LABELS = STATUS_LABELS; // 模板里直接用
app.use(express.static(path.join(__dirname, '..', '..', 'pages', 'public')));
app.use(require('express-session')({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 12 * 3600 * 1000 },
}));

// 首页：v0.8 结构复刻，排队条用真实名额数据
app.get('/', (req, res) => {
  queue.releaseStale();
  res.render('home', { ...queue.overview(), tiers: config.tiers });
});

app.use(require('./routes/order'));
app.use(require('./routes/admin'));

app.use((err, req, res, next) => { // 统一兜底（multer 超限等）
  if (err && err.code === 'LIMIT_FILE_SIZE') return res.status(400).send('参考图超 10MB');
  if (err) return res.status(400).send(err.message || '请求有误');
  next();
});
app.use((req, res) => res.status(404).send('页面不存在'));

app.listen(config.port, config.host, () => console.log(`flever server → http://${config.host}:${config.port}（支付通道：${config.payChannel}）`));
