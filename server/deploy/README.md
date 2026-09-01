# flora 部署手册（一页复跑）

真源：docs/04-技术方案.md「部署方案」节 + 档案室/项目/flora花艺定制/总览.md「服务器现状」。

## 形态（2026-09-01 首部署）

- 服务器：腾讯云 Ubuntu（ssh 别名 `server-public`，ubuntu@124.220.4.201）
- 代码：`/srv/flora`（git clone，分支 dev-flora，deploy key 专用 `~/.ssh/id_ed25519_flora` + ssh 别名 `github.com-flora`）
- 数据：`/var/lib/flora`（flora.db + uploads，独立于代码，升级不动数据）
- 进程：systemd `flora.service`（Restart=always，User=ubuntu，读 `/srv/flora/server/.env`）
- 入口：Caddy `:80` 按 Host 分流——`luckyducky.cloud` → 127.0.0.1:3000；IP 直访 → /var/www/default 占位页（不动）
- 管理密码 / 会话密钥：只在服务器 `/srv/flora/server/.env`（600，ubuntu），查看：`ssh server-public cat /srv/flora/server/.env`

## 复跑（更新代码后）

```bash
ssh server-public 'sudo bash /srv/flora/server/deploy/deploy.sh'   # 幂等：fetch+reset → npm ci → enable --now
```

Caddy 不用动（除非 caddy-site.conf 变了）：
```bash
ssh server-public 'sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy'
```

## 验收六条（跑过的命令）

1. 常驻自愈：`ssh server-public 'sudo systemctl restart flora && systemctl is-active flora'` → active
2. 公网首页：`curl -sw %{http_code} http://luckyducky.cloud/` → 200（经 Caddy 反代）
3. 下单全链：POST /order/confirm → POST /order/create（得 FL 单号）→ /pay/mock/:no → POST confirm → /pay/success/:no 200 → /orders?phone= 可查（2026-09-01 实测 FL20260901-0001 全绿）
4. 管理页：/admin 200；错密码 401；对密码 302→/admin/orders 200
5. 无损：IP 直访占位页 200；`ss -tlnp` 公网监听仅 22/80/22000（syncthing），无 3000
6. 本文档在库：server/deploy/README.md

## 待办（下批）

- HTTPS：域名备案核实后，把 Caddy `:80` 换成域名站点块自动签发；flora 子域 DNS 加记录后取消注释切换
- 真支付密钥接入（PAY_CHANNEL=jsapi）；企微 webhook 填 .env
- SQLite 定时备份（cron，见 docs/04 遗留小项）
