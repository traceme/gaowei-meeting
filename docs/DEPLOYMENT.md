# 部署指南

本文档介绍高维会议AI项目的部署流程，包括本地开发、测试环境和生产环境的部署方法。

## 📋 目录

- [环境要求](#环境要求)
- [部署方式概览](#部署方式概览)
- [Docker部署](#docker部署)
- [传统部署](#传统部署)
- [CI/CD自动化](#cicd自动化)
- [监控和日志](#监控和日志)
- [故障排除](#故障排除)

## 🔧 环境要求

### 基础环境

- **操作系统**: Linux (Ubuntu 20.04+/CentOS 8+), macOS 10.15+, Windows 10+
- **CPU**: 2核心+ (推荐4核心)
- **内存**: 4GB+ (推荐8GB)
- **存储**: 20GB+ 可用空间
- **网络**: 稳定的互联网连接

### 运行时环境

| 组件 | 版本要求 | 说明 |
|------|----------|------|
| **Node.js** | 20.0+ | JavaScript运行时 |
| **pnpm** | 8.0+ | 包管理器 |
| **Python** | 3.8+ | Whisper转录引擎 |
| **Docker** | 24.0+ | 容器化部署（可选） |
| **Docker Compose** | 2.20+ | 多容器编排（可选） |

### AI服务（可选）

- **Ollama**: 本地AI推理服务
- **OpenAI API**: 云端AI服务
- **Claude API**: Anthropic AI服务
- **Gemini API**: Google AI服务

## 🚀 部署方式概览

### 1. 本地开发部署

```bash
# 克隆项目
git clone <repository-url>
cd gaowei-meeting-ai

# 安装依赖
pnpm install

# 环境配置
cp env.example .env
# 编辑.env文件

# 启动开发环境
pnpm dev:full
```

### 2. Docker容器化部署（推荐）

```bash
# 生产环境部署
./scripts/deploy.sh production

# 开发环境部署
./scripts/deploy.sh development
```

### 3. 传统服务器部署

```bash
# 构建生产版本
pnpm build

# 启动生产服务
pnpm start
```

## 🐳 Docker部署

### 快速启动

```bash
# 1. 准备环境变量
cp env.example .env
# 编辑.env文件，配置必要的API密钥

# 2. 启动服务
docker-compose up -d

# 3. 验证部署
curl http://localhost:3000/api/health
```

### 开发环境

```bash
# 启动开发环境（包含热重载）
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# 查看日志
docker-compose logs -f app
```

### 生产环境

```bash
# 使用部署脚本（推荐）
./scripts/deploy.sh production latest

# 或手动部署
docker-compose up -d

# 检查服务状态
docker-compose ps
```

### 自定义配置

创建 `docker-compose.override.yml` 文件来覆盖默认配置：

```yaml
version: '3.8'

services:
  app:
    environment:
      - CUSTOM_VAR=value
    ports:
      - "8080:3000"  # 自定义端口映射
    volumes:
      - ./custom-config:/app/config
```

## 💻 传统部署

### 系统准备

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nodejs npm python3 python3-pip ffmpeg

# CentOS/RHEL
sudo yum install nodejs npm python3 python3-pip ffmpeg

# macOS
brew install node python ffmpeg
```

### 应用部署

```bash
# 1. 克隆并进入项目目录
git clone <repository-url>
cd gaowei-meeting-ai

# 2. 安装pnpm
npm install -g pnpm@8

# 3. 安装依赖
pnpm install

# 4. 配置环境变量
cp env.example .env
# 编辑.env文件

# 5. 构建应用
pnpm build

# 6. 启动服务
# 开发环境
pnpm dev:full

# 生产环境
pnpm start
```

### 进程管理（生产环境）

使用PM2进行进程管理：

```bash
# 安装PM2
npm install -g pm2

# 创建PM2配置文件
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: 'gaowei-meeting-ai-api',
      script: 'packages/api/dist/index.js',
      cwd: './packages/api',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
EOF

# 启动应用
pm2 start ecosystem.config.js

# 保存PM2配置
pm2 save
pm2 startup
```

## 🔄 CI/CD自动化

### GitHub Actions

项目已配置GitHub Actions工作流（`.github/workflows/ci.yml`），包括：

- 代码质量检查
- TypeScript类型检查
- 单元测试
- 构建验证
- 自动部署（staging/production）

### 环境配置

在GitHub仓库设置中配置以下Secrets：

```
# 必需的Secrets
DOCKER_REGISTRY          # Docker镜像仓库地址
CODECOV_TOKEN            # 代码覆盖率报告token

# AI服务API密钥（根据需要配置）
OPENAI_API_KEY
ANTHROPIC_API_KEY
GOOGLE_API_KEY
PERPLEXITY_API_KEY
```

### 自动部署流程

1. **开发分支**: 推送到`develop`分支自动部署到staging环境
2. **生产分支**: 推送到`main`分支自动部署到生产环境
3. **Pull Request**: 运行完整的CI检查和性能分析

## 📊 监控和日志

### 应用监控

使用Docker Compose启动完整的监控栈：

```bash
# 启动包含监控的完整服务
docker-compose up -d app prometheus grafana

# 访问监控面板
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3001 (admin/admin123)
```

### 日志管理

```bash
# 查看应用日志
docker-compose logs -f app

# 查看特定时间段的日志
docker-compose logs --since="2024-01-01T00:00:00Z" app

# 导出日志
docker-compose logs app > app.log
```

### 健康检查

```bash
# API健康检查
curl http://localhost:3000/api/health

# 系统信息检查
curl http://localhost:3000/api/info

# 转录引擎状态
curl http://localhost:3000/api/transcription/engines/status

# AI提供商状态
curl http://localhost:3000/api/summary/providers/status
```

## 🔧 故障排除

### 常见问题

#### 1. 构建失败

```bash
# 清理缓存重新构建
pnpm clean
pnpm install
pnpm build
```

#### 2. 端口冲突

```bash
# 检查端口占用
lsof -i :3000
lsof -i :5173

# 修改端口配置
export PORT=3001
export VITE_DEV_PORT=5174
```

#### 3. 数据库问题

```bash
# 检查数据库文件权限
ls -la data/meetings.db

# 重新初始化数据库
rm data/meetings.db
pnpm dev:api  # 自动创建新数据库
```

#### 4. Docker内存不足

```bash
# 增加Docker内存限制
# Docker Desktop -> Settings -> Resources -> Memory: 4GB+

# 清理Docker缓存
docker system prune -a
```

### 日志分析

#### API服务日志

```bash
# 实时查看API日志
docker-compose logs -f app

# 搜索错误日志
docker-compose logs app | grep ERROR

# 查看数据库相关日志
docker-compose logs app | grep -i database
```

#### 前端构建日志

```bash
# Vite构建详细日志
VITE_LOG_LEVEL=info pnpm dev:web

# 构建分析
pnpm analyze
```

### 性能调优

#### 内存优化

```bash
# 增加Node.js内存限制
export NODE_OPTIONS="--max-old-space-size=4096"

# 查看内存使用
docker stats

# 监控进程内存
pm2 monit
```

#### 存储优化

```bash
# 清理上传文件
find uploads/ -type f -mtime +30 -delete

# 压缩日志文件
gzip logs/*.log

# 数据库优化
sqlite3 data/meetings.db "VACUUM;"
```

## 🛡️ 安全配置

### 环境变量保护

```bash
# 设置文件权限
chmod 600 .env

# 检查敏感信息泄露
grep -r "api_key\|password\|secret" . --exclude-dir=node_modules
```

### 网络安全

```bash
# 防火墙配置（示例）
ufw allow 80/tcp
ufw allow 443/tcp
ufw deny 3000/tcp  # 仅内部访问
```

### SSL/TLS配置

参考 `nginx.conf` 配置HTTPS：

```nginx
server {
    listen 443 ssl;
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    location / {
        proxy_pass http://app:3000;
    }
}
```

## 📞 支持与维护

### 定期维护任务

```bash
# 每周执行
./scripts/deploy.sh production latest  # 更新应用
docker system prune                    # 清理Docker缓存

# 每月执行
# 更新依赖包
pnpm update

# 备份数据
cp data/meetings.db backups/meetings_$(date +%Y%m%d).db
```

### 监控指标

关注以下关键指标：

- **应用响应时间**: < 500ms
- **内存使用率**: < 80%
- **磁盘使用率**: < 90%
- **API成功率**: > 99%
- **转录成功率**: > 95%

---

需要更多帮助？请查看：
- [开发指南](./DEVELOPMENT.md)
- [API文档](./API.md)
- [组件文档](./COMPONENTS.md) 