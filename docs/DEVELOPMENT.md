# 开发环境搭建指南 🛠️

## 概述

本指南将帮助您快速搭建高维会议AI的开发环境，包括所有必要的工具、依赖和配置。

## 系统要求

### 基本要求

| 组件 | 最低版本 | 推荐版本 | 说明 |
|------|----------|----------|------|
| **Node.js** | 18.0.0 | 20.0.0+ | JavaScript运行时 |
| **pnpm** | 8.0.0 | 9.0.0+ | 包管理器（必需） |
| **Python** | 3.8.0 | 3.11.0+ | Whisper转录服务 |
| **Git** | 2.30.0+ | 最新版 | 版本控制 |

### 操作系统支持

- ✅ **macOS**: 10.15+ (推荐 macOS 12+)
- ✅ **Linux**: Ubuntu 20.04+, CentOS 8+, Debian 11+
- ✅ **Windows**: Windows 10 1903+, Windows 11

## 安装步骤

### 1. Node.js 安装

#### 方式一：使用 Node Version Manager (推荐)

```bash
# 安装 nvm (macOS/Linux)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 重启终端或执行
source ~/.bashrc

# 安装和使用 Node.js 20
nvm install 20
nvm use 20
nvm alias default 20

# 验证安装
node --version  # 应显示 v20.x.x
```

#### 方式二：直接下载安装

访问 [Node.js官网](https://nodejs.org/) 下载对应系统的LTS版本。

### 2. pnpm 安装

```bash
# 使用 npm 安装 pnpm
npm install -g pnpm

# 或使用 curl 安装
curl -fsSL https://get.pnpm.io/install.sh | sh

# 验证安装
pnpm --version  # 应显示 8.x.x 或更高
```

### 3. Python 环境配置

#### macOS

```bash
# 使用 Homebrew 安装
brew install python@3.11

# 或使用 pyenv 管理版本
brew install pyenv
pyenv install 3.11.0
pyenv global 3.11.0
```

#### Linux (Ubuntu/Debian)

```bash
# 安装 Python 3.11
sudo apt update
sudo apt install python3.11 python3.11-pip python3.11-venv

# 创建符号链接（可选）
sudo ln -sf /usr/bin/python3.11 /usr/bin/python3
```

#### Windows

下载 [Python官方安装器](https://www.python.org/downloads/windows/)，选择 3.11+ 版本。

### 4. 项目克隆和初始化

```bash
# 克隆项目
git clone <repository-url>
cd gaowei-meeting-ai

# 安装依赖
pnpm install

# 验证workspace
pnpm list --depth=0
```

## 环境配置

### 1. 环境变量设置

```bash
# 复制环境变量模板
cp env.example .env

# 编辑环境变量文件
# 使用您喜欢的编辑器
code .env  # VS Code
nano .env  # Nano
vim .env   # Vim
```

### 2. 必需的环境变量

```bash
# 开发环境配置
NODE_ENV=development
PORT=3000
SERVER_HOST=localhost

# AI 提供商 API Keys (至少配置一个)
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
GOOGLE_API_KEY=your_google_api_key_here

# 本地AI配置 (可选)
OLLAMA_BASE_URL=http://localhost:11434/api

# 数据库配置
DATABASE_URL=sqlite:./data/meeting_minutes.db

# 开发配置
DEBUG=false
LOG_LEVEL=info
```

### 3. 可选的AI服务配置

#### Ollama (本地AI)

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.ai/install.sh | sh

# 启动 Ollama 服务
ollama serve

# 下载模型（可选）
ollama pull llama3.2
```

#### Azure OpenAI (企业用户)

```bash
# 添加到 .env 文件
AZURE_OPENAI_API_KEY=your_azure_key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
```

## 开发工具配置

### 1. VS Code 配置 (推荐)

#### 必装扩展

```bash
# 安装推荐扩展包
code --install-extension ms-vscode.vscode-typescript-next
code --install-extension esbenp.prettier-vscode
code --install-extension bradlc.vscode-tailwindcss
code --install-extension ms-vscode.vscode-json
```

#### 工作区配置

在项目根目录创建 `.vscode/settings.json`：

```json
{
  "typescript.preferences.includePackageJsonAutoImports": "on",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.includeCompletionsWithSnippetText": true,
  "typescript.suggest.autoImports": true
}
```

### 2. Git 配置

```bash
# 配置用户信息
git config user.name "Your Name"
git config user.email "your.email@example.com"

# 启用自动换行转换（Windows用户）
git config --global core.autocrlf true

# 验证配置
git config --list
```

## 启动开发环境

### 1. 构建验证

```bash
# 清理并构建所有包
pnpm clean && pnpm build

# 预期输出：
# ✅ @gaowei/shared-types:build: 成功
# ✅ @gaowei/ui:build: 成功  
# ✅ @gaowei/whisper-engine:build: 成功
# ✅ @gaowei/api:build: 成功
# ✅ @gaowei/web:build: 成功
# 🎉 构建时间: ~2-3秒
```

### 2. 启动开发服务

#### 方式一：并发启动（推荐）

```bash
# 同时启动前后端
pnpm dev:full

# 预期输出：
# [api] Server running on http://localhost:3000
# [web] Local: http://localhost:5173
```

#### 方式二：分别启动

```bash
# 终端1：启动API服务
pnpm dev:api

# 终端2：启动Web服务  
pnpm dev:web
```

### 3. 验证安装

```bash
# 检查API服务
curl http://localhost:3000/api/health

# 预期响应：
# {"status":"ok","timestamp":"...","uptime":...}

# 检查Web服务
curl http://localhost:5173

# 浏览器访问：
# http://localhost:5173 - 前端应用
# http://localhost:3000/api/info - API信息
```

## 开发工作流

### 1. 日常开发

```bash
# 拉取最新代码
git pull origin main

# 安装新依赖（如果有package.json更新）
pnpm install

# 启动开发环境
pnpm dev:full

# 代码格式化
pnpm format

# 类型检查
pnpm type-check

# 构建验证
pnpm build
```

### 2. 添加新功能

```bash
# 创建功能分支
git checkout -b feature/new-feature

# 开发功能...

# 提交前检查
pnpm lint:fix
pnpm type-check
pnpm build

# 提交代码（会自动触发pre-commit hooks）
git add .
git commit -m "feat: 添加新功能"
```

### 3. 包管理

```bash
# 添加依赖到特定包
pnpm add --filter @gaowei/api express

# 添加开发依赖
pnpm add -D --filter @gaowei/web @types/react

# 添加workspace依赖
pnpm add --filter @gaowei/web @gaowei/ui

# 更新所有依赖
pnpm update

# 检查过时依赖
pnpm outdated
```

## 故障排除

### 常见问题

#### 1. pnpm 命令不存在

```bash
# 检查pnpm是否正确安装
which pnpm

# 如果未找到，重新安装
npm install -g pnpm

# 或添加到PATH
export PATH=$PATH:~/.local/share/pnpm
```

#### 2. Node版本不兼容

```bash
# 检查Node版本
node --version

# 如果版本过低，使用nvm升级
nvm install 20
nvm use 20
```

#### 3. 端口被占用

```bash
# 查找占用端口的进程
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# 杀死进程
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows
```

#### 4. 构建失败

```bash
# 清理缓存和重新安装
pnpm clean
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install

# 重新构建
pnpm build
```

#### 5. TypeScript错误

```bash
# 清理TypeScript缓存
pnpm clean:ts

# 重新生成类型定义
pnpm build:types

# 检查类型错误
pnpm type-check
```

### 性能优化

#### 1. 加速构建

```bash
# 启用Turbo缓存
export TURBO_TOKEN=your_token  # 如果使用Vercel Turbo

# 并行构建
pnpm build --parallel

# 增量构建
pnpm build --filter="[HEAD^]"
```

#### 2. 内存优化

```bash
# 增加Node.js内存限制
export NODE_OPTIONS="--max-old-space-size=4096"

# 或在package.json中配置
"scripts": {
  "build": "NODE_OPTIONS='--max-old-space-size=4096' turbo build"
}
```

## 调试指南

### 1. VS Code 调试配置

在 `.vscode/launch.json` 中配置：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug API",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/packages/api/src/index.ts",
      "env": {
        "NODE_ENV": "development"
      },
      "runtimeArgs": ["-r", "ts-node/register"]
    }
  ]
}
```

### 2. 日志调试

```bash
# 启用详细日志
DEBUG=* pnpm dev:api

# 只显示特定模块日志
DEBUG=express:* pnpm dev:api
```

## 部署准备

### 1. 生产构建

```bash
# 构建生产版本
pnpm build

# 检查构建产物
ls -la packages/*/dist
```

### 2. 环境检查

```bash
# 运行所有检查
pnpm ci:check

# 等价于
pnpm lint
pnpm type-check  
pnpm test
pnpm build
```

## 团队协作

### 1. 新成员入门

```bash
# 一键设置开发环境
make setup  # 如果有Makefile

# 或手动执行
pnpm install
cp env.example .env
pnpm build
pnpm dev:full
```

### 2. 代码规范

- 提交前必须通过 `pnpm lint` 和 `pnpm type-check`
- 使用语义化提交消息：`feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`, `chore:`
- PR必须通过所有CI检查
- 代码review后才能合并

## 获取帮助

- 📖 查看 [README.md](../README.md) 了解项目概述
- 🐛 遇到问题请创建 [GitHub Issue](../../issues)
- 💬 团队讨论使用 [GitHub Discussions](../../discussions)
- 📧 紧急问题联系维护团队

---

**祝您开发愉快！** 🚀 