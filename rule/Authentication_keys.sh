#!/bin/bash

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查是否有sudo权限
if ! sudo -n true 2>/dev/null; then
    echo -e "${YELLOW}此脚本需要sudo权限来修改SSH配置${NC}"
    echo -e "${YELLOW}请输入密码：${NC}"
    sudo -v || { echo -e "${RED}无法获取sudo权限，退出${NC}"; exit 1; }
fi

# 检查系统兼容性
SSH_VERSION=$(ssh -V 2>&1 | grep -oP 'OpenSSH_\K[0-9]+\.[0-9]+')
SSH_CONFIG_DIR="/etc/ssh/sshd_config.d"
if [[ ! -d "$SSH_CONFIG_DIR" ]]; then
    echo -e "${YELLOW}未检测到 $SSH_CONFIG_DIR 目录，可能是较旧的SSH版本${NC}"
    echo -e "${YELLOW}将直接修改主配置文件${NC}"
    USE_CONFIG_DIR=0
else
    USE_CONFIG_DIR=1
fi

# 创建 .ssh 目录并设置权限
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# 创建 authorized_keys 文件并设置权限
touch ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# 确保文件所有权正确
if [ "$(whoami)" != "$(stat -c '%U' ~/.ssh)" ]; then
    echo -e "${YELLOW}修正 ~/.ssh 目录所有权${NC}"
    sudo chown -R $(whoami): ~/.ssh
fi

echo -e "${YELLOW}请输入你的 SSH 公钥（以 ssh-rsa 或 ssh-ed25519 开头）：${NC}"
read -r pubkey

# 验证公钥格式
if [[ ! $pubkey =~ ^(ssh-rsa|ssh-ed25519)\ [A-Za-z0-9+/]+[=]{0,3}(\ .*)?$ ]]; then
    echo -e "${RED}警告：输入的不像是有效的 SSH 公钥${NC}"
    echo -e "${YELLOW}是否继续？(y/n)${NC}"
    read -r confirm
    if [[ ! $confirm =~ ^[Yy]$ ]]; then
        echo "操作已取消"
        exit 1
    fi
fi

# 检查重复公钥
if grep -q "^$pubkey$" ~/.ssh/authorized_keys; then
    echo -e "${YELLOW}此公钥已存在于authorized_keys中${NC}"
else
    # 添加公钥
    echo "$pubkey" >> ~/.ssh/authorized_keys
    echo -e "${GREEN}公钥已添加${NC}"
fi

# 备份SSH配置
BACKUP_FILE="/etc/ssh/sshd_config.bak.$(date +%Y%m%d%H%M%S)"
sudo cp /etc/ssh/sshd_config $BACKUP_FILE
echo -e "${GREEN}原始配置已备份至: $BACKUP_FILE${NC}"

# 修改 SSH 配置
echo -e "${YELLOW}正在设置SSH，禁用密码登录...${NC}"

# 设置安全配置
SSH_SECURITY_CONFIG="# 安全配置 - 禁用密码登录
# 基础认证设置
# 是否允许秘钥登录
PubkeyAuthentication yes
# 是否允许密码登录
PasswordAuthentication no
# 是否允许空密码
PermitEmptyPasswords no
# 最大身份验证尝试次数
MaxAuthTries 6

# 禁用交互式认证（非常重要，防止绕过密码禁用）
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
# 注意：ChallengeResponseAuthentication 在新版本中已由 KbdInteractiveAuthentication 取代
# 如果你的版本仍识别它，可以加上，但在 Debian 12 中通常只写上面那个即可

# 根用户限制，root用户仅允许使用秘钥登录
PermitRootLogin prohibit-password

# 会话保持
ClientAliveInterval 300
ClientAliveCountMax 2

# 认证方法强制（可选）
# 如果启用这行，必须使用公钥才能登录
AuthenticationMethods publickey

# 特别说明
UsePAM yes
# 建议保持开启，因为它负责会话管理（如 limits.conf），
# 只要上面禁用了密码和交互式认证，PAM 不会允许密码登录。

# 关于 Protocol 2：
# 现代 OpenSSH 仅支持协议 2，显式写出 Protocol 2 可能会在某些版本导致警告，可以不写。
# Protocol 2
"

if [ $USE_CONFIG_DIR -eq 1 ]; then
    # 使用配置目录
    CUSTOM_CONFIG_FILE="$SSH_CONFIG_DIR/99-disable-password-auth.conf"
    echo -e "${YELLOW}创建配置文件: $CUSTOM_CONFIG_FILE${NC}"
    echo "$SSH_SECURITY_CONFIG" | sudo tee $CUSTOM_CONFIG_FILE > /dev/null
else
    # 直接修改主配置文件
    echo -e "${YELLOW}修改主配置文件${NC}"
    
    # 禁用密码认证
    sudo sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
    sudo sed -i 's/^#*ChallengeResponseAuthentication.*/ChallengeResponseAuthentication no/' /etc/ssh/sshd_config
    sudo sed -i 's/^#*KbdInteractiveAuthentication.*/KbdInteractiveAuthentication no/' /etc/ssh/sshd_config
    sudo sed -i 's/^#*PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config
    sudo sed -i 's/^#*PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
    
    # 添加缺失的配置项
    if ! grep -q "^AuthenticationMethods" /etc/ssh/sshd_config; then
        echo "AuthenticationMethods publickey" | sudo tee -a /etc/ssh/sshd_config > /dev/null
    fi
    
    if ! grep -q "^Protocol" /etc/ssh/sshd_config; then
        echo "Protocol 2" | sudo tee -a /etc/ssh/sshd_config > /dev/null
    fi
fi

# 检查配置文件有效性
echo -e "${YELLOW}检查SSH配置有效性...${NC}"
sudo sshd -t
if [ $? -ne 0 ]; then
    echo -e "${RED}SSH配置存在错误，还原备份...${NC}"
    sudo cp $BACKUP_FILE /etc/ssh/sshd_config
    [ $USE_CONFIG_DIR -eq 1 ] && sudo rm -f $CUSTOM_CONFIG_FILE
    echo -e "${RED}操作失败，已还原配置${NC}"
    exit 1
fi

# 重启 SSH 服务
echo -e "${YELLOW}重启SSH服务...${NC}"
sudo systemctl restart sshd
if [ $? -ne 0 ]; then
    echo -e "${RED}SSH服务重启失败，还原配置...${NC}"
    sudo cp $BACKUP_FILE /etc/ssh/sshd_config
    [ $USE_CONFIG_DIR -eq 1 ] && sudo rm -f $CUSTOM_CONFIG_FILE
    sudo systemctl restart sshd
    echo -e "${RED}操作失败，已还原配置${NC}"
    exit 1
fi

# 生成恢复脚本
RESTORE_SCRIPT=~/restore_ssh_password_auth.sh
cat > $RESTORE_SCRIPT << EOF
#!/bin/bash
# 恢复SSH密码登录的脚本
sudo cp $BACKUP_FILE /etc/ssh/sshd_config
[ -f $CUSTOM_CONFIG_FILE ] && sudo rm -f $CUSTOM_CONFIG_FILE
sudo systemctl restart sshd
echo "已恢复SSH密码登录"
EOF
chmod +x $RESTORE_SCRIPT

echo -e "${GREEN}SSH 密钥登录配置完成！所有密码登录已禁用！${NC}"
echo -e "${YELLOW}重要提示：${NC}"
echo -e "1. ${YELLOW}请保持当前会话开启，新开一个终端测试密钥登录是否正常${NC}"
echo -e "2. ${YELLOW}如果需要恢复密码登录，请执行：${GREEN}$RESTORE_SCRIPT${NC}"
echo -e "3. ${YELLOW}原始配置备份在：${GREEN}$BACKUP_FILE${NC}"
