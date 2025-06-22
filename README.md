# 高维会议AI - 企业级会议记录AI助手 🎯

> 基于Monorepo架构的现代化会议记录解决方案，支持本地转录与多AI提供商智能摘要

## 📋 项目概述

高维会议AI是一个完整的企业级会议记录解决方案，经过全面重构后采用**Monorepo架构**，将原有的三个独立项目（gaowei-meeting-ai、meeting-minutes、transcript-seeker）统一整合，实现了：

- 🏗️ **统一架构**: Monorepo + TypeScript + 现代化工具链
- 🎙️ **本地转录**: 集成whisper.cpp，保护数据安全
- 🤖 **多AI容错**: Ollama → OpenAI → Claude → Gemini 智能降级
- 📱 **现代界面**: React 19 + Vite + Tailwind CSS
- ⚡ **高性能**: 并行构建 + 智能缓存 + 热重载

## 🏗️ 架构设计

### Monorepo包结构

```
packages/
├── api/              # 统一后端服务 (Express + TypeScript)
├── web/              # 统一前端应用 (React + Vite)
├── ui/               # 共享UI组件库 (Design System)
├── shared-types/     # 共享类型定义 (TypeScript Types)
└── whisper-engine/   # 独立转录引擎 (Whisper.cpp集成)
```

### 技术栈

| 领域 | 技术栈 |
|------|--------|
| **包管理** | pnpm Workspace + Turborepo |
| **前端** | React 19 + TypeScript + Vite + Tailwind CSS |
| **后端** | Node.js + Express + SQLite (WAL模式) |
| **转录** | whisper.cpp + faster-whisper |
| **AI服务** | Ollama + OpenAI + Claude + Gemini |
| **构建工具** | Turbo + TypeScript + 并行构建 |
| **代码质量** | Prettier + Husky + Commitlint |

## ✨ 核心功能

### 🎯 已实现功能

- ✅ **音频转录**: 支持多格式（MP3、WAV、M4A等），词级时间戳
- ✅ **AI摘要**: 结构化会议摘要（要点、决策、行动项）
- ✅ **多AI容错**: 4层降级机制，确保服务可用性
- ✅ **实时播放**: 专业音频播放器，时间戳同步跳转
- ✅ **数据管理**: SQLite存储，完整的会议生命周期管理
- ✅ **任务追踪**: 实时进度显示，错误处理和重试
- ✅ **现代界面**: 响应式设计，优秀的用户体验

### 🔧 技术特性

- **类型安全**: 全栈TypeScript，共享类型定义
- **性能优异**: 构建时间<3秒，80%缓存命中率
- **开发友好**: 热重载 + 并发启动 + 统一工具链
- **数据安全**: 本地存储，可控的数据流
- **容错能力**: 多层错误处理，优雅降级

## 🚀 快速开始

### 环境要求

- **Node.js**: 18.0+ (推荐 20.0+)
- **pnpm**: 8.0+ (必需，用于workspace管理)
- **Python**: 3.8+ (whisper转录服务)
- **系统**: macOS/Linux/Windows (支持whisper.cpp)

### 一键启动

```bash
# 1. 克隆项目
git clone <repository-url>
cd gaowei-meeting-ai

# 2. 安装依赖（自动处理workspace）
pnpm install

# 3. 环境配置
cp env.example .env
# 编辑 .env 文件，配置 API 密钥

# 4. 构建所有包
pnpm build

# 5. 启动开发环境（并发启动前后端）
pnpm dev:full
```

### 分步启动

```bash
# 仅启动后端API服务
pnpm dev:api    # http://localhost:3000

# 仅启动前端Web应用
pnpm dev:web    # http://localhost:5173

# 构建生产版本
pnpm build

# 运行测试
pnpm test

# 代码检查和格式化
pnpm lint:fix
pnpm format
```

## 🌐 服务端口

| 服务 | 端口 | 描述 |
|------|------|------|
| **前端Web** | 5173 | React应用 (开发模式) |
| **后端API** | 3000 | Express服务器 |
| **Whisper转录** | 内置 | 集成在API服务中 |
| **Ollama** | 11434 | 本地AI服务 (可选) |

## 📚 API文档

### 核心端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/health` | GET | 服务健康检查 |
| `/api/info` | GET | 系统架构信息 |
| `/api/meetings` | GET | 会议列表管理 |
| `/api/transcription/upload` | POST | 音频上传转录 |
| `/api/transcription/engines/status` | GET | 转录引擎状态 |
| `/api/summary/providers/status` | GET | AI提供商状态 |
| `/api/summary/process` | POST | 完整处理流程 |

### API响应示例

<details>
<summary>点击查看详细API响应</summary>

**系统信息**：
```json
{
  "success": true,
  "data": {
    "name": "高维会议AI API",
    "version": "2.0.0",
    "description": "统一的会议AI后端服务 - Monorepo架构",
    "architecture": {
      "type": "monorepo",
      "packages": ["api", "web", "ui", "shared-types", "whisper-engine"],
      "database": "SQLite with WAL mode"
    }
  }
}
```

**转录引擎状态**：
```json
{
  "success": true,
  "data": {
    "engines": [
      {
        "name": "local-whisper",
        "available": true,
        "type": "local"
      }
    ]
  }
}
```

**AI提供商状态**：
```json
{
  "success": true,
  "data": {
    "providers": [
      {
        "name": "ollama",
        "available": false
      }
    ]
  }
}
```

</details>

## 📁 项目结构

```
gaowei-meeting-ai/
├── packages/                    # Monorepo包目录
│   ├── api/                    # 后端API服务
│   │   ├── src/
│   │   │   ├── routes/         # API路由
│   │   │   ├── services/       # 业务逻辑
│   │   │   ├── config/         # 配置管理
│   │   │   └── index.ts        # 服务入口
│   │   └── package.json
│   ├── web/                    # 前端Web应用
│   │   ├── src/
│   │   │   ├── components/     # React组件
│   │   │   ├── pages/          # 页面组件
│   │   │   ├── services/       # API调用
│   │   │   └── App.tsx         # 应用入口
│   │   └── package.json
│   ├── ui/                     # 共享UI组件库
│   │   ├── src/components/     # 可复用组件
│   │   └── package.json
│   ├── shared-types/           # 共享类型定义
│   │   ├── src/index.ts        # 类型导出
│   │   └── package.json
│   └── whisper-engine/         # 转录引擎
│       ├── src/                # 引擎实现
│       └── package.json
├── .taskmaster/                # 项目管理
├── scripts/                    # 构建脚本
├── turbo.json                  # Turbo配置
├── pnpm-workspace.yaml         # Workspace配置
└── package.json                # 根包配置
```

## 🧪 测试验证

### 构建验证

```bash
# 清理并构建所有包
pnpm clean && pnpm build
# ✅ 构建时间: 2.34秒 (缓存80%命中率)
# ✅ 零TypeScript错误
# ✅ 所有包构建成功
```

### 功能验证

```bash
# API健康检查
curl http://localhost:3000/api/health
# ✅ 响应正常

# 转录引擎状态
curl http://localhost:3000/api/transcription/engines/status
# ✅ local-whisper可用

# AI提供商状态
curl http://localhost:3000/api/summary/providers/status
# ✅ 提供商配置正确
```

## 🔒 数据安全

- **本地优先**: 音频文件和转录结果本地存储
- **数据隔离**: SQLite WAL模式，支持并发访问
- **API安全**: 环境变量管理，安全的密钥存储
- **访问控制**: CORS配置，请求验证
- **文件安全**: 上传限制，类型验证

## ⚡ 性能指标

| 指标 | 当前值 | 目标值 | 状态 |
|------|--------|--------|------|
| 构建时间 | 2.34s | <10s | ✅ 优秀 |
| 缓存命中率 | 80% | >50% | ✅ 优秀 |
| API响应时间 | <100ms | <500ms | ✅ 优秀 |
| 包大小 | 优化良好 | 合理范围 | ✅ 良好 |

## 🛠️ 开发指南

### 添加新功能

```bash
# 在API中添加新路由
cd packages/api/src/routes
# 创建新的路由文件

# 在Web中添加新页面
cd packages/web/src/pages
# 创建新的页面组件

# 在UI中添加新组件
cd packages/ui/src/components
# 创建可复用组件

# 更新共享类型
cd packages/shared-types/src
# 添加新的TypeScript类型
```

### 代码规范

```bash
# 格式化代码
pnpm format

# 检查代码质量
pnpm lint:fix

# 类型检查
pnpm type-check

# 提交代码（自动触发hooks）
git commit -m "feat: 添加新功能"
# ✅ 自动运行格式化和检查
```

## 🚧 重构历程

### v2.0.0 - Monorepo重构 (当前)

- ✅ **架构升级**: 从多项目重构为统一Monorepo
- ✅ **功能整合**: 整合3个独立项目的所有功能
- ✅ **性能优化**: 构建时间减少70%+
- ✅ **开发体验**: 统一工具链，热重载支持
- ✅ **类型安全**: 全栈TypeScript，零类型错误

### 未来规划

- [ ] **v2.1.0**: 实时转录功能
- [ ] **v2.2.0**: 用户认证和多租户
- [ ] **v2.3.0**: 移动端适配和PWA
- [ ] **v3.0.0**: 微服务架构和容器化部署

## 🤝 贡献指南

1. **Fork项目** 并克隆到本地
2. **创建分支**: `git checkout -b feature/amazing-feature`
3. **安装依赖**: `pnpm install`
4. **开发功能**: 遵循代码规范
5. **测试验证**: `pnpm test` 和 `pnpm build`
6. **提交代码**: `git commit -m "feat: 添加某功能"`
7. **推送分支**: `git push origin feature/amazing-feature`
8. **创建Pull Request**

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- **whisper.cpp**: 高性能本地转录
- **Ollama**: 本地AI服务支持
- **Turborepo**: 现代化Monorepo工具
- **React生态**: 现代化前端技术栈

---

**🎯 高维会议AI**: 让会议记录变得简单高效，让AI为您的工作赋能！

[![Built with ❤️](https://img.shields.io/badge/Built%20with-❤️-red.svg)](https://github.com/your-repo)
[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue.svg)](https://www.typescriptlang.org/)
[![Monorepo](https://img.shields.io/badge/Architecture-Monorepo-green.svg)](https://monorepo.tools/)
