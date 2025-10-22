#!/bin/bash
set -e

echo "🧹 正在清理旧版本 tls-shunt-proxy..."
sudo systemctl stop tls-shunt-proxy.service 2>/dev/null || true
sudo systemctl disable tls-shunt-proxy.service 2>/dev/null || true
sudo rm -f /etc/systemd/system/tls-shunt-proxy.service
sudo systemctl daemon-reload
sudo userdel -r tls-shunt-proxy 2>/dev/null || true
sudo rm -rf /etc/tls-shunt-proxy /var/log/tls-shunt-proxy /tmp/tls-shunt-proxy* /usr/local/bin/tls-shunt-proxy /usr/bin/tls-shunt-proxy
sudo systemctl reset-failed

echo "✅ 清理完成。"

echo "⬇️ 正在下载并安装最新版 tls-shunt-proxy..."
mkdir -p /tmp/tls-shunt-proxy
cd /tmp/tls-shunt-proxy

# 从官方仓库下载安装脚本
curl -L -O https://github.com/liberal-boy/tls-shunt-proxy/raw/master/dist/install.sh

# 执行安装脚本
bash install.sh

echo "🧩 正在启用服务..."
sudo systemctl daemon-reload
sudo systemctl enable tls-shunt-proxy
sudo systemctl restart tls-shunt-proxy

sleep 2
sudo systemctl status tls-shunt-proxy --no-pager
echo "🎉 安装与启动已完成。"
