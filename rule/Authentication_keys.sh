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

# ================= 新增：自动生成密钥及命名功能 =================
echo -e "${YELLOW}请输入要生成的 SSH 密钥名称 (直接回车默认命名为: my_server_key): ${NC}"
read -r key_name
key_name=${key_name:-my_server_key}
key_path="$HOME/.ssh/$key_name"

if [ -f "$key_path" ]; then
    echo -e "${YELLOW}检测到密钥 $key_path 已存在，将直接使用现有的密钥。${NC}"
else
    echo -e "${YELLOW}正在自动生成 ed25519 类型的 SSH 密钥...${NC}"
    # 自动生成密钥，密码为空(-N "")，注释为密钥名(-C)
    ssh-keygen -t ed25519 -f "$key_path" -N "" -C "$key_name"
    if [ $? -ne 0 ]; then
        echo -e "${RED}密钥生成失败，退出脚本${NC}"
        exit 1
    fi
    echo -e "${GREEN}密钥生成成功！${NC}"
fi

# 读取生成的公钥
pubkey=$(cat "${key_path}.pub")

# 检查重复公钥并添加
if grep -q "^$pubkey$" ~/.ssh/authorized_keys; then
    echo -e "${YELLOW}此公钥已存在于 authorized_keys 中${NC}"
else
    echo "$pubkey" >> ~/.ssh/authorized_keys
    echo -e "${GREEN}公钥已自动添加到 authorized_keys${NC}"
fi

# ================= 极其重要：展示私钥并强制确认 =================
echo -e "\n${RED}======================== 极其重要 ========================${NC}"
echo -e "${RED}因为即将禁用密码登录，请务必立即复制下方的私钥内容，并保存到你的本地电脑！${NC}"
echo -e "${RED}如果丢失此私钥，你将永远无法再次登录此服务器！${NC}"
echo -e "${RED}==========================================================${NC}\n"

cat "$key_path"

echo -e "\n${RED}==========================================================${NC}"
echo -e "${YELLOW}请确认你已经将上面的私钥内容完整复制并保存到了安全的地方。(y/n)${NC}"
read -r saved_confirm
if [[ ! $saved_confirm =~ ^[Yy]$ ]]; then
    echo -e "${RED}操作已取消。为防止你被锁在服务器外，SSH 配置未做任何修改退出。${NC}"
    exit 1
fi
# ================================================================

# 备份SSH配置
BACKUP_FILE="/etc/ssh/sshd_config.bak.$(date +%Y%m%d%H%M%S)"
sudo cp /etc/ssh/sshd_config $BACKUP_FILE
echo -e "${GREEN}原始配置已备份至: $BACKUP_FILE${NC}"

# 修改 SSH 配置
echo -e "${YELLOW}正在设置SSH，禁用密码登录...${NC}"

# 设置安全配置
SSH_SECURITY_CONFIG="# 安全配置 - 禁用密码登录
# 基础认证设置
PubkeyAuthentication yes
PasswordAuthentication no
PermitEmptyPasswords no
MaxAuthTries 6

# 禁用交互式认证
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no

# 根用户限制，root用户仅允许使用秘钥登录
PermitRootLogin prohibit-password

# 会话保持
ClientAliveInterval 300
ClientAliveCountMax 2

# 认证方法强制
AuthenticationMethods publickey

UsePAM yes
"

if [ $USE_CONFIG_DIR -eq 1 ]; then
    CUSTOM_CONFIG_FILE="$SSH_CONFIG_DIR/99-disable-password-auth.conf"
    echo -e "${YELLOW}创建配置文件: $CUSTOM_CONFIG_FILE${NC}"
    echo "$SSH_SECURITY_CONFIG" | sudo tee $CUSTOM_CONFIG_FILE > /dev/null
else
    echo -e "${YELLOW}修改主配置文件${NC}"
    sudo sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
    sudo sed -i 's/^#*ChallengeResponseAuthentication.*/ChallengeResponseAuthentication no/' /etc/ssh/sshd_config
    sudo sed -i 's/^#*KbdInteractiveAuthentication.*/KbdInteractiveAuthentication no/' /etc/ssh/sshd_config
    sudo sed -i 's/^#*PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config
    sudo sed -i 's/^#*PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
    
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
sudo cp $BACKUP_FILE /etc/ssh/sshd_config
[ -f $CUSTOM_CONFIG_FILE ] && sudo rm -f $CUSTOM_CONFIG_FILE
sudo systemctl restart sshd
echo "已恢复SSH密码登录"
EOF
chmod +x $RESTORE_SCRIPT

echo -e "${GREEN}SSH 密钥登录配置完成！所有密码登录已禁用！${NC}"
echo -e "${YELLOW}重要提示：${NC}"
echo -e "1. ${YELLOW}请保持当前会话开启，新开一个终端测试刚才保存的私钥是否能成功登录${NC}"
echo -e "2. ${YELLOW}如果需要恢复密码登录，请执行：${GREEN}$RESTORE_SCRIPT${NC}"
echo -e "3. ${YELLOW}自动生成的私钥位于服务器的：${GREEN}$key_path ${YELLOW}（请确保本地已备份）${NC}"
