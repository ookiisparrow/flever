// 管理后台：密码登录 → 订单列表（筛选/改状态）→ 名额调整（docs/04 第 7 节：一期最简版）
const express = require('express');
const db = require('../db');
const config = require('../config');
const queue = require('../queue');
const { STATUS_LABELS } = require('../db');

function requireAdmin(req, res, next) {
  if (req.session && req.session.admin) return next();
  res.redirect('/admin');
}

const CHANGEABLE = ['paid', 'making', 'delivered', 'refunded']; // pending_pay 由支付/超时流转，不手动改

module.exports = express.Router()
  .get('/admin', (req, res) => {
    if (req.session && req.session.admin) return res.redirect('/admin/orders');
    res.render('admin-login', { error: null });
  })
  .post('/admin/login', express.urlencoded({ extended: false }), (req, res) => {
    if (req.body.password === config.adminPassword) {
      req.session.admin = true;
      return res.redirect('/admin/orders');
    }
    res.status(401).render('admin-login', { error: '密码不对' });
  })
  .post('/admin/logout', (req, res) => { req.session.destroy(() => res.redirect('/admin')); })
  .get('/admin/orders', requireAdmin, (req, res) => {
    queue.releaseStale();
    const status = req.query.status;
    const list = Object.prototype.hasOwnProperty.call(STATUS_LABELS, status)
      ? db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY id DESC LIMIT 200').all(status)
      : db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 200').all();
    res.render('admin-orders', {
      list, status: status || '', STATUS_LABELS, CHANGEABLE,
      days: db.prepare('SELECT * FROM queue_stats WHERE day >= ? ORDER BY day LIMIT 7').all(queue.dayStr()),
      saved: req.query.saved === '1',
    });
  })
  .post('/admin/orders/:id/status', requireAdmin, express.urlencoded({ extended: false }), (req, res) => {
    if (CHANGEABLE.includes(req.body.status)) {
      db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now','localtime') WHERE id = ?")
        .run(req.body.status, req.params.id);
    }
    res.redirect('/admin/orders');
  })
  .post('/admin/quota', requireAdmin, express.urlencoded({ extended: false }), (req, res) => {
    const quota = parseInt(req.body.quota, 10);
    if (quota >= 0 && quota <= 999) {
      db.prepare('UPDATE queue_stats SET quota = ? WHERE day = ?').run(quota, req.body.day);
    }
    res.redirect('/admin/orders');
  });
