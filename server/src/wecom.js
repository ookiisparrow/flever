// 企微群机器人通知：下单成功 POST webhook（地址是配置项）
// webhook 未配置（占位）时只打日志不真发——密钥类信息不入库不入 git
const config = require('./config');

async function notifyOrderPaid(order) {
  const text = `🌸 flora 新订单 ${order.order_no}\n套餐：${order.tier}（¥${order.price / 100}）\n选题：${order.topic}\n排期：${order.queue_date} 第 ${order.queue_pos} 位`;
  if (!config.wecomWebhook || config.wecomWebhook.includes('placeholder')) {
    console.log(`[wecom] 占位未配置，跳过真实发送：\n${text}`);
    return false;
  }
  const res = await fetch(config.wecomWebhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ msgtype: 'text', text: { content: text } }),
  });
  if (!res.ok) throw new Error(`wecom webhook ${res.status}`);
  return true;
}

module.exports = { notifyOrderPaid };
