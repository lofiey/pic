#!/bin/bash
set -e

echo "=== TLS-Shunt-Proxy 一键安装脚本 ==="

# 1. 安装依赖
echo "[1/6] 安装依赖 unzip wget ..."
if command -v apt >/dev/null 2>&1; then
    apt update && apt install -y wget unzip
elif command -v yum >/dev/null 2>&1; then
    yum install -y wget unzip
fi

# 2. 下载最新 release
echo "[2/6] 下载 tls-shunt-proxy ..."
TMP_DIR=/tmp/tls-shunt-proxy
mkdir -p $TMP_DIR
cd $TMP_DIR
wget -q https://github.com/liberal-boy/tls-shunt-proxy/releases/latest/download/tls-shunt-proxy-linux-amd64.zip -O tls-shunt-proxy.zip

# 3. 解压并安装
echo "[3/6] 安装到 /usr/local/bin/ ..."
unzip -o tls-shunt-proxy.zip
mv -f tls-shunt-proxy /usr/local/bin/
chmod +x /usr/local/bin/tls-shunt-proxy

# 4. 创建用户和目录
echo "[4/6] 创建用户和配置目录 ..."
id tls-shunt-proxy >/dev/null 2>&1 || useradd -r -s /bin/false tls-shunt-proxy
mkdir -p /etc/tls-shunt-proxy
chown -R tls-shunt-proxy:tls-shunt-proxy /etc/tls-shunt-proxy

# 5. 写入 systemd service
echo "[5/6] 写入 systemd 配置 ..."
cat >/etc/systemd/system/tls-shunt-proxy.service <<EOF
[Unit]
Description=TLS Shunt Proxy Service
After=network.target

[Service]
User=tls-shunt-proxy
Group=tls-shunt-proxy
ExecStart=/usr/local/bin/tls-shunt-proxy -c /etc/tls-shunt-proxy/config.yaml
Restart=on-failure
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

# 6. 启动服务
echo "[6/6] 启动并设置开机自启 ..."
systemctl daemon-reexec
systemctl daemon-reload
systemctl enable tls-shunt-proxy
systemctl start tls-shunt-proxy

echo "=== 安装完成 ==="
echo "配置文件路径: /etc/tls-shunt-proxy/config.yaml"
echo "查看运行状态: systemctl status tls-shunt-proxy"
