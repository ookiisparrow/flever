// 可插拔支付接缝：本轮只实现 mock；商户号密钥到手后按同一接口补 jsapi（主）/h5（备）通道即可
// 接口约定：createPayment(order) → { type, payUrl }；confirmPay(order) → { tradeNo }
const crypto = require('crypto');

const mock = {
  createPayment(order) {
    // 本地模拟：跳转到站内模拟收银台，不产生真实资金流
    return { type: 'mock', payUrl: `/pay/mock/${order.order_no}` };
  },
  confirmPay() {
    return { tradeNo: 'MOCK' + crypto.randomBytes(6).toString('hex').toUpperCase() };
  },
};

// TODO(jsapi)：微信支付 JSAPI 通道（复用小程序商户号，docs/03）——密钥到手后实现：
//   createPayment: 调官方 SDK 统一下单拿 prepay_id → 前端 wx.chooseWXPay 唤起
//   confirmPay: 回调验签后返回微信流水号
const channels = { mock };

module.exports = {
  getChannel: (name) => channels[name] || mock,
};
