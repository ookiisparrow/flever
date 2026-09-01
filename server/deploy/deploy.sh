#!/usr/bin/env bash
# flora 后端部署脚本（服务器上跑；从本机 ssh server-public 'bash -s' < deploy.sh 亦可）
# 真源：docs/04-技术方案.md 部署节 + 档案室/flora花艺定制/总览.md 服务器现状节
# 形态：systemd 常驻 + Caddy 反代（见 caddy-site.conf），端口只绑 127.0.0.1，SQLite 数据在 /var/lib/flora
# 复跑安全：幂等，重复执行只刷新代码+重启服务。
set -euo pipefail

REPO="git@github.com:ookiisparrow/flora-custom.git"
BRANCH="${BRANCH:-dev-flora}"
CODE=/srv/flora            # 代码目录（git）
DATA=/var/lib/flora        # 数据目录（db+uploads，独立于代码，升级不动数据）
PORT="${PORT:-3000}"

[[ $EUID -eq 0 ]] || { echo "需要 root（sudo bash $0）"; exit 1; }

# 1) 代码
if [[ -d $CODE/.git ]]; then
  git -C "$CODE" fetch origin && git -C "$CODE" checkout "$BRANCH" && git -C "$CODE" reset --hard "origin/$BRANCH"
else
  git clone -b "$BRANCH" "$REPO" "$CODE"
fi
chown -R ubuntu:ubuntu "$CODE"

# 2) 依赖（不装 dev）
cd "$CODE/server" && sudo -u ubuntu npm ci --omit=dev

# 3) 数据目录 + .env（首次生成，已存在不覆盖）
mkdir -p "$DATA/uploads" && chown -R ubuntu:ubuntu "$DATA"
if [[ ! -f $CODE/server/.env ]]; then
  ADMIN_PW="$(head -c 18 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 16)"
  SESSION_PW="$(head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 32)"
  cat > "$CODE/server/.env" <<EOF
PORT=$PORT
HOST=127.0.0.1
ADMIN_PASSWORD=$ADMIN_PW
SESSION_SECRET=$SESSION_PW
WECOM_WEBHOOK=
PAY_CHANNEL=mock
DB_FILE=$DATA/flora.db
UPLOAD_DIR=$DATA/uploads
EOF
  chown ubuntu:ubuntu "$CODE/server/.env" && chmod 600 "$CODE/server/.env"
  echo ">>> 已生成 .env（管理密码=$ADMIN_PW，请存好）"
fi

# 4) systemd
cp "$CODE/server/deploy/flora.service" /etc/systemd/system/flora.service
systemctl daemon-reload && systemctl enable --now flora.service
sleep 1
systemctl is-active flora.service

echo "部署完成：systemd flora.service（端口 127.0.0.1:$PORT）"
echo "Caddy 站点配置见 server/deploy/caddy-site.conf，别忘了 caddy validate + reload"
