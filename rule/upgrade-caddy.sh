#!/bin/bash
set -e

echo "=== 停止旧版 Caddy 服务 ==="
sudo systemctl stop caddy || true

echo "=== 备份旧版 Caddy ==="
sudo mkdir -p /opt/caddy_backup
[ -f /usr/local/bin/caddy ] && sudo cp /usr/local/bin/caddy /opt/caddy_backup/caddy_v1
[ -d /etc/caddy ] && sudo cp -r /etc/caddy /opt/caddy_backup/caddy_conf_$(date +%Y%m%d%H%M%S)

echo "=== 删除旧版 Caddy v1 ==="
sudo rm -f /usr/local/bin/caddy

echo "=== 添加官方源并安装 Caddy v2 ==="
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo tee /usr/share/keyrings/caddy-stable-archive-keyring.gpg > /dev/null
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy

echo "=== 检查 Caddy 版本 ==="
caddy version

echo "=== 升级完成！Caddy v2 已经安装。 ==="
echo "配置文件路径: /etc/caddy/Caddyfile"
echo "日志查看: journalctl -u caddy -f"
