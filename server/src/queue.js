// 排队/名额：每日限量，满则顺延次日；待支付超 30 分钟自动释放（docs/02 边界规则）
const db = require('./db');

const dayStr = (d = new Date()) => d.toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// 确保从今天起 N 天都有名额记录
function ensureDays(n = 7) {
  const ins = db.prepare('INSERT OR IGNORE INTO queue_stats (day, quota) VALUES (?, 3)');
  for (let i = 0; i < n; i++) ins.run(dayStr(addDays(new Date(), i)));
}

// 释放超 30 分钟未支付的占位（惰性触发：下单/管理页读取时调用）
function releaseStale() {
  const stale = db.prepare(`
    SELECT id, queue_date FROM orders
    WHERE status = 'pending_pay'
      AND created_at < datetime('now','localtime','-30 minutes')`).all();
  const rel = db.prepare('UPDATE orders SET queue_date = NULL, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?');
  const dec = db.prepare('UPDATE queue_stats SET used = used - 1 WHERE day = ? AND used > 0');
  for (const o of stale) { rel.run(o.id); dec.run(o.queue_date); }
  return stale.length;
}

// 占下一个名额：返回 {day}；从今天起找到第一个没用满的日子
function reserve() {
  ensureDays();
  const row = db.prepare(`
    SELECT day FROM queue_stats
    WHERE day >= ? AND used < quota ORDER BY day LIMIT 1`).get(dayStr());
  if (!row) return null;
  db.prepare('UPDATE queue_stats SET used = used + 1 WHERE day = ?').run(row.day);
  return { day: row.day };
}

// 首页排队条：今日剩余名额 + 最早可排日期
function overview() {
  ensureDays();
  const today = db.prepare('SELECT quota, used FROM queue_stats WHERE day = ?').get(dayStr());
  const next = db.prepare('SELECT day FROM queue_stats WHERE used < quota AND day >= ? ORDER BY day LIMIT 1').get(dayStr());
  return {
    remaining: Math.max(0, today.quota - today.used),
    earliest: next ? next.day : '名额已满',
  };
}

// 付款成功后：当日排队位（先转 paid 再数，含本单）
function assignPos(order) {
  db.prepare("UPDATE orders SET status = 'paid', paid_at = datetime('now','localtime'), updated_at = datetime('now','localtime') WHERE id = ?").run(order.id);
  const n = db.prepare("SELECT COUNT(*) AS c FROM orders WHERE queue_date = ? AND status != 'pending_pay'").get(order.queue_date).c;
  db.prepare('UPDATE orders SET queue_pos = ? WHERE id = ?').run(n, order.id);
  return n;
}

module.exports = { ensureDays, releaseStale, reserve, overview, assignPos, dayStr };
