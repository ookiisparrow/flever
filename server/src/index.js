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

// 首页：v0.8 结构复刻，排队条用真实名额数据；选题优先读库（Obsidian 同步），无则用内置占位
const FALLBACK_TOPICS = [
  { name: '「山茶与雾」', phil: '静', idea: '克制的美，不需要喧哗', desc: '以山茶的沉稳为骨，雾灰色的桔梗作烟。适合安静、内敛的表达。', img: null },
  { name: '「夏日尽头」', phil: '烈', idea: '把季节留住给一个人', desc: '向日葵与狗尾草的野趣混搭，浓烈又松弛，像夏天最后一场傍晚。', img: null },
  { name: '「月白」', phil: '素', idea: '留白即言语', desc: '白绿为主，枝叶留出大量呼吸感。叶是主角，花只是月光落下的位置。', img: null },
];
app.get('/', (req, res) => {
  queue.releaseStale();
  const topics = db.prepare('SELECT name, phil, idea, desc, img FROM topics ORDER BY pos').all();
  res.render('home', { ...queue.overview(), tiers: config.tiers, topics: topics.length ? topics : FALLBACK_TOPICS });
});
// 选题绘画笔记图片（sync-topics.js 落盘）
app.use('/topic-img', express.static(config.uploadDir.replace(/uploads$/, 'topic-img')));

app.use(require('./routes/admin'));

app.use((err, req, res, next) => { // 统一兜底（multer 超限等）
  if (err && err.code === 'LIMIT_FILE_SIZE') return res.status(400).send('参考图超 10MB');
  if (err) return res.status(400).send(err.message || '请求有误');
  next();
});
app.use((req, res) => res.status(404).send('页面不存在'));

app.listen(config.port, config.host, () => console.log(`flever server → http://${config.host}:${config.port}（支付通道：${config.payChannel}）`));
