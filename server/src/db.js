// SQLite 初始化：四表结构（docs/04 定稿：orders / form_submissions / uploads / queue_stats）
const Database = require('better-sqlite3');
const config = require('./config');
const fs = require('fs');

fs.mkdirSync(config.uploadDir, { recursive: true });

const db = new Database(config.dbFile);
db.pragma('journal_mode = WAL');

db.exec(`
-- 订单主表
CREATE TABLE IF NOT EXISTS orders (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no     TEXT UNIQUE NOT NULL,             -- 订单号 FLyyyymmdd-XXXX
  phone        TEXT NOT NULL,                    -- 顾客手机号（查单凭据）
  topic        TEXT NOT NULL,                    -- 选题名（如「山茶与雾」）
  flower       TEXT,                             -- 花种
  color        TEXT,                             -- 色系
  tier         TEXT NOT NULL,                    -- 套餐名
  price        INTEGER NOT NULL,                 -- 套餐价，单位分（避免浮点误差）
  status       TEXT NOT NULL DEFAULT 'pending_pay', -- pending_pay待支付/paid已付排队/making制作中/delivered已完成/refunded已退款
  queue_date   TEXT,                             -- 制作日 YYYY-MM-DD
  queue_pos    INTEGER,                          -- 当日排队位（付款后定）
  pay_channel  TEXT,                             -- mock/jsapi/h5
  pay_trade_no TEXT,                             -- 渠道流水号
  paid_at      TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 表单详情（草稿与提交）
CREATE TABLE IF NOT EXISTS form_submissions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER REFERENCES orders(id),     -- 下单成功后回填
  phone      TEXT,
  draft_key  TEXT UNIQUE,                       -- 草稿键（匿名续填用）
  flower     TEXT,
  color      TEXT,
  note       TEXT,                              -- 顾客备注
  status     TEXT NOT NULL DEFAULT 'draft',     -- draft草稿/submitted已提交
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 参考图记录（最多 2 张 / 张 ≤10MB / jpg·png·webp，docs/02）
CREATE TABLE IF NOT EXISTS uploads (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  form_id       INTEGER NOT NULL REFERENCES form_submissions(id),
  filename      TEXT NOT NULL,                  -- 落盘文件名
  original_name TEXT,
  size          INTEGER,
  mime          TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 每日名额（上限后台可调，docs/02 排队规则）
CREATE TABLE IF NOT EXISTS queue_stats (
  day        TEXT PRIMARY KEY,                  -- YYYY-MM-DD
  quota      INTEGER NOT NULL DEFAULT 3,        -- 当日接单上限
  used       INTEGER NOT NULL DEFAULT 0         -- 已占名额
);
`);

// 订单状态中文标签（顾客页/后台共用）
const STATUS_LABELS = {
  pending_pay: '待支付',
  paid: '已付 · 排队中',
  making: '制作中',
  delivered: '已完成',
  refunded: '已退款',
};

module.exports = Object.assign(db, { STATUS_LABELS });
