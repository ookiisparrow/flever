// 顾客侧流程：分步表单 → 套餐确认 → 支付 → 结果/查单
const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const db = require('../db');
const config = require('../config');
const queue = require('../queue');
const pay = require('../pay');
const { notifyOrderPaid } = require('../wecom');

const router = express.Router();

// 参考图：最多 2 张、单张 ≤10MB、jpg/png/webp（docs/02 已确认规则）
const upload = multer({
  storage: multer.diskStorage({
    destination: config.uploadDir,
    filename: (_, f, cb) => cb(null, Date.now() + '-' + crypto.randomBytes(4).toString('hex') + path.extname(f.originalname).toLowerCase()),
  }),
  limits: { files: 2, fileSize: 10 * 1024 * 1024 },
  fileFilter: (_, f, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(f.mimetype)),
});

router.get('/order/new', (req, res) => {
  res.render('form', {
    flowers: config.flowers, colors: config.colors, tiers: config.tiers,
    topic: (req.query.topic || '「山茶与雾」').slice(0, 40),
  });
});

// 草稿自动保存（docs/02：填一半退出可续填，建议存 7 天）
router.post('/api/draft', express.json(), (req, res) => {
  const { draftKey, phone, flower, color, note } = req.body || {};
  const key = String(draftKey || '').slice(0, 64) || crypto.randomBytes(8).toString('hex');
  db.prepare(`INSERT INTO form_submissions (draft_key, phone, flower, color, note, status)
              VALUES (?, ?, ?, ?, ?, 'draft')
              ON CONFLICT(draft_key) DO UPDATE SET phone=excluded.phone, flower=excluded.flower,
                color=excluded.color, note=excluded.note, updated_at=datetime('now','localtime')`)
    .run(key, phone || null, flower || null, color || null, note || null);
  res.json({ ok: true, draftKey: key });
});

// 表单提交 → 确认页（recap）
router.post('/order/confirm', upload.array('refs', 2), (req, res) => {
  const { flower, color, note, phone, topic } = req.body;
  const tier = config.tiers.find(t => t.name === req.body.tier);
  if (!tier || !/^1\d{10}$/.test(phone || '') || !config.flowers.includes(flower) || !config.colors.includes(color)) {
    return res.status(400).send('表单不完整或格式有误，请返回检查');
  }
  const form = db.prepare(`INSERT INTO form_submissions (phone, flower, color, note, status)
                           VALUES (?, ?, ?, ?, 'submitted')`)
    .run(phone, flower, color, (note || '').slice(0, 500));
  for (const f of req.files || []) {
    db.prepare('INSERT INTO uploads (form_id, filename, original_name, size, mime) VALUES (?, ?, ?, ?, ?)')
      .run(form.lastInsertRowid, f.filename, f.originalname, f.size, f.mimetype);
  }
  res.render('confirm', {
    topic: topic || '（未选选题）', tier, formId: form.lastInsertRowid, phone,
    schedule: queue.overview().earliest,
  });
});

// 确认下单：占名额 + 建 pending_pay 订单 → 跳支付
router.post('/order/create', express.urlencoded({ extended: false }), (req, res) => {
  const form = db.prepare("SELECT * FROM form_submissions WHERE id = ? AND status = 'submitted'").get(req.body.formId);
  if (!form) return res.status(400).send('表单不存在或已过期，请重新填写');
  const tier = config.tiers.find(t => t.name === req.body.tier);
  if (!tier) return res.status(400).send('套餐无效');
  const slot = queue.reserve();
  if (!slot) return res.status(409).send('近期名额已满，请稍后再试');
  const no = 'FL' + queue.dayStr().replace(/-/g, '') + '-' + String(db.prepare(
    "SELECT COUNT(*) c FROM orders WHERE order_no LIKE ?").get('FL' + queue.dayStr().replace(/-/g, '') + '-%').c + 1).padStart(4, '0');
  db.prepare(`INSERT INTO orders (order_no, phone, topic, flower, color, tier, price, status, queue_date)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_pay', ?)`)
    .run(no, form.phone, req.body.topic || '（未选）', form.flower, form.color, tier.name, tier.price, slot.day);
  db.prepare('UPDATE form_submissions SET order_id = ? WHERE id = ?').run(
    db.prepare('SELECT id FROM orders WHERE order_no = ?').get(no).id, form.id);
  res.redirect(pay.getChannel(config.payChannel).createPayment({ order_no: no }).payUrl);
});

// —— mock 收银台（可插拔接缝，见 src/pay.js；jsapi 到手替换此段路由）——
router.get('/pay/mock/:no', (req, res) => {
  const o = db.prepare("SELECT * FROM orders WHERE order_no = ?").get(req.params.no);
  if (!o || o.status !== 'pending_pay') return res.redirect('/pay/success/' + req.params.no);
  res.render('pay-mock', { o });
});
router.post('/pay/mock/:no/confirm', async (req, res) => {
  const o = db.prepare("SELECT * FROM orders WHERE order_no = ? AND status = 'pending_pay'").get(req.params.no);
  if (!o) return res.redirect('/pay/success/' + req.params.no);
  const { tradeNo } = pay.getChannel('mock').confirmPay();
  db.prepare('UPDATE orders SET pay_channel = ?, pay_trade_no = ? WHERE id = ?').run('mock', tradeNo, o.id);
  const pos = queue.assignPos(o);
  try { await notifyOrderPaid({ ...o, queue_pos: pos }); } catch (e) { console.error('[wecom] 通知失败(不影响下单):', e.message); }
  res.redirect('/pay/success/' + o.order_no);
});

// 支付成功页：订单号 + 排队位
router.get('/pay/success/:no', (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE order_no = ?').get(req.params.no);
  if (!o) return res.status(404).send('订单不存在');
  res.render('pay-success', { o });
});

// 我的订单：凭手机号回看（docs/02，无需注册）
router.get('/orders', (req, res) => {
  const phone = (req.query.phone || '').trim();
  const list = /^1\d{10}$/.test(phone)
    ? db.prepare('SELECT * FROM orders WHERE phone = ? ORDER BY id DESC LIMIT 50').all(phone)
    : [];
  res.render('orders', { phone, list });
});

module.exports = router;
