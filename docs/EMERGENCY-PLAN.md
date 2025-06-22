# 应急预案文档 🚨

本文档提供高维会议AI项目的应急处理指南，包括快速回滚、故障排除和灾难恢复方案。

## 📋 目录

- [快速响应清单](#快速响应清单)
- [备份和回滚机制](#备份和回滚机制)
- [常见故障排除](#常见故障排除)
- [灾难恢复方案](#灾难恢复方案)
- [联系信息](#联系信息)

## 🆘 快速响应清单

### 服务中断应急处理

**⏱️ 响应时间目标: 5分钟内开始处理，15分钟内初步恢复**

#### 第一步：快速诊断 (2分钟)

```bash
# 1. 检查服务状态
curl -f http://localhost:3000/api/health
pnpm health

# 2. 检查进程状态
docker-compose ps
pm2 status

# 3. 检查系统资源
df -h          # 磁盘空间
free -h        # 内存使用
top            # CPU使用
```

#### 第二步：快速恢复尝试 (3分钟)

```bash
# 选项1: 重启服务
pnpm docker:stop && pnpm docker:prod
# 或
pm2 restart all

# 选项2: 快速重新部署
./scripts/deploy.sh production

# 选项3: 重新构建
pnpm clean && pnpm install && pnpm build && pnpm start
```

#### 第三步：如果快速恢复失败 - 执行回滚 (10分钟)

```bash
# 查看可用备份
./scripts/rollback.sh --list

# 回滚到最近的备份
./scripts/rollback.sh backups/full-LATEST.tar.gz

# 验证恢复
pnpm health
```

### 数据损坏应急处理

```bash
# 1. 立即停止写入操作
pnpm docker:stop

# 2. 备份当前状态（即使已损坏）
./scripts/backup.sh data "Emergency backup before data recovery"

# 3. 恢复数据库
./scripts/rollback.sh backups/data-LATEST.tar.gz data

# 4. 验证数据完整性
sqlite3 data/meetings.db "PRAGMA integrity_check;"
```

## 🔄 备份和回滚机制

### 自动备份策略

```bash
# 每日自动备份（建议在 crontab 中设置）
0 2 * * * cd /path/to/project && ./scripts/backup.sh full "Daily backup"

# 每周完整备份
0 2 * * 0 cd /path/to/project && ./scripts/backup.sh full "Weekly backup"

# 部署前自动备份
./scripts/backup.sh full "Before deployment $(date)"
```

### 备份类型说明

| 备份类型 | 用途 | 恢复时间 | 大小 |
|---------|------|----------|------|
| **Quick** | 代码快速备份 | ~2分钟 | ~50MB |
| **Data** | 数据文件备份 | ~1分钟 | ~20MB |
| **Full** | 完整项目备份 | ~5分钟 | ~100MB |

### 回滚操作指南

```bash
# 1. 列出可用备份
./scripts/rollback.sh --list

# 2. 验证备份文件
./scripts/rollback.sh --verify backups/full-20241222_120000.tar.gz

# 3. 执行回滚
./scripts/rollback.sh backups/full-20241222_120000.tar.gz full

# 4. 部分回滚选项
./scripts/rollback.sh backups/backup.tar.gz code      # 仅代码
./scripts/rollback.sh backups/backup.tar.gz data      # 仅数据
./scripts/rollback.sh backups/backup.tar.gz taskmaster # 仅任务数据
```

## 🔧 常见故障排除

### 1. 应用无法启动

**症状**: `pnpm dev:full` 或 `pnpm start` 失败

**解决方案**:

```bash
# 步骤1: 清理缓存和依赖
pnpm clean
rm -rf node_modules packages/*/node_modules
pnpm install

# 步骤2: 检查端口冲突
lsof -i :3000  # API端口
lsof -i :5173  # 前端端口

# 步骤3: 检查环境变量
cat .env | grep -v '^#' | grep -v '^$'

# 步骤4: 重新构建
pnpm build

# 步骤5: 如果仍然失败，回滚
./scripts/rollback.sh backups/full-LATEST.tar.gz
```

### 2. 数据库锁定或损坏

**症状**: SQLite database is locked 错误

**解决方案**:

```bash
# 步骤1: 停止所有服务
pnpm docker:stop
pm2 stop all

# 步骤2: 检查数据库
sqlite3 data/meetings.db "PRAGMA integrity_check;"

# 步骤3: 如果损坏，从备份恢复
./scripts/backup.sh data "Before database recovery"
./scripts/rollback.sh backups/data-LATEST.tar.gz data

# 步骤4: 重新启动服务
pnpm start
```

### 3. Docker容器问题

**症状**: Docker服务无法启动或运行异常

**解决方案**:

```bash
# 步骤1: 检查Docker状态
docker system df
docker system prune -f

# 步骤2: 重新构建镜像
docker-compose down --remove-orphans
docker-compose build --no-cache
docker-compose up -d

# 步骤3: 检查容器日志
docker-compose logs app

# 步骤4: 如果持续问题，切换到本地运行
pnpm docker:stop
pnpm dev:full
```

### 4. 内存不足

**症状**: 系统变慢，进程被杀死

**解决方案**:

```bash
# 步骤1: 检查内存使用
free -h
ps aux --sort=-%mem | head -10

# 步骤2: 重启资源密集的服务
pm2 restart all
docker-compose restart

# 步骤3: 增加swap空间（临时解决）
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 步骤4: 优化配置
export NODE_OPTIONS="--max-old-space-size=2048"
```

### 5. 网络连接问题

**症状**: API调用失败，外部服务不可用

**解决方案**:

```bash
# 步骤1: 检查网络连接
curl -I https://api.openai.com
curl -I https://api.anthropic.com

# 步骤2: 检查防火墙设置
sudo ufw status

# 步骤3: 切换到离线模式
# 编辑 .env 文件，禁用外部AI服务
OPENAI_API_KEY=""
ANTHROPIC_API_KEY=""

# 步骤4: 重启服务
pnpm restart
```

## 🏥 灾难恢复方案

### 完全系统失效恢复

**场景**: 服务器宕机、磁盘损坏、完全数据丢失

**恢复步骤**:

#### 第一阶段: 环境重建 (30分钟)

```bash
# 1. 在新服务器上安装基础环境
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 2. 安装 Node.js 和 pnpm
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
npm install -g pnpm@8

# 3. 克隆项目（如果Git仓库可用）
git clone <repository-url>
cd gaowei-meeting-ai
```

#### 第二阶段: 数据恢复 (15分钟)

```bash
# 1. 恢复最新备份
# 从云存储/网络位置下载备份文件
wget <backup-download-url> -O latest-backup.tar.gz

# 2. 解压并恢复
tar -xzf latest-backup.tar.gz
cp -r backup-contents/* .

# 3. 恢复权限
chmod +x scripts/*.sh
```

#### 第三阶段: 服务启动 (10分钟)

```bash
# 1. 安装依赖
pnpm install

# 2. 构建应用
pnpm build

# 3. 启动服务
./scripts/deploy.sh production

# 4. 验证恢复
pnpm health
```

### 数据中心切换方案

**场景**: 主数据中心不可用，需要切换到备用数据中心

```bash
# 1. 在备用数据中心部署应用
./scripts/deploy.sh production

# 2. 同步最新数据
rsync -avz primary-dc:/app/data/ /app/data/
rsync -avz primary-dc:/app/uploads/ /app/uploads/

# 3. 更新DNS记录（手动操作）
# 将域名指向新的IP地址

# 4. 验证服务
curl -f https://your-domain.com/api/health
```

## 📞 联系信息

### 紧急联系人

| 角色 | 姓名 | 电话 | 邮箱 | 可用时间 |
|------|------|------|------|----------|
| 主要负责人 | [姓名] | [电话] | [邮箱] | 24/7 |
| 技术负责人 | [姓名] | [电话] | [邮箱] | 工作时间 |
| 运维负责人 | [姓名] | [电话] | [邮箱] | 7x24 |

### 外部服务联系方式

| 服务 | 支持页面 | 紧急联系 |
|------|----------|----------|
| 云服务商 | [链接] | [电话/邮箱] |
| AI服务商 | [链接] | [支持页面] |
| 监控服务 | [链接] | [支持邮箱] |

## 📋 应急检查清单

### 日常检查项目 (每日)

- [ ] 服务健康状态检查
- [ ] 磁盘空间检查 (>20% 可用)
- [ ] 内存使用检查 (<80%)
- [ ] 备份文件完整性验证
- [ ] 日志文件大小检查

### 周度检查项目

- [ ] 完整备份执行和验证
- [ ] 回滚流程测试
- [ ] 监控告警测试
- [ ] 安全补丁更新
- [ ] 性能指标回顾

### 月度检查项目

- [ ] 灾难恢复演练
- [ ] 应急预案更新
- [ ] 联系信息验证
- [ ] 容量规划评估
- [ ] 安全审计

## 🔄 应急预案版本控制

| 版本 | 日期 | 修改内容 | 修改人 |
|------|------|----------|--------|
| v1.0 | 2024-12-22 | 初始版本 | AI Assistant |
| v1.1 | [日期] | [修改内容] | [修改人] |

---

**⚠️ 重要提醒**:
- 本文档应定期更新和测试
- 所有团队成员应熟悉应急流程
- 备份策略应定期验证
- 联系信息应保持最新

**📱 快速联系**: 发生紧急情况时，请立即联系主要负责人并抄送技术团队。 