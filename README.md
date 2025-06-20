# 高维会议AI - 企业级本地化会议记录AI助手

## 📋 项目概述

高维会议AI是一个企业级本地化会议记录AI助手，采用transcript-seeker + meeting-minutes融合方案，从桌面应用转向Web优先设计，支持AI服务路由器（本地Ollama + 外接OpenAI/Claude/Gemini API）。

## 🏗️ 技术架构

- **前端**: React 19 + TypeScript + Vite + Tailwind CSS + React Router DOM
- **后端**: Node.js + Express + TypeScript + SQLite + dotenv
- **AI服务**: 本地Ollama + OpenAI API + Claude API（多提供商容错）
- **音频处理**: faster-whisper（端口8178）+ HTML5音频播放器
- **开发工具**: TypeScript + ESLint + Prettier + pnpm

## ✨ 核心功能

### 🎯 已完成功能
- ✅ **音频转录**: 支持多种格式（MP3、WAV、AIFF、M4A），精确到词级的时间戳
- ✅ **AI摘要**: 自动生成结构化会议摘要（关键要点、重要决策、行动项）
- ✅ **多AI容错**: Ollama → OpenAI → Claude 智能降级机制
- ✅ **音频播放器**: 专业的HTML5播放器，支持时间戳同步跳转
- ✅ **实时进度**: 转录和AI处理进度实时显示
- ✅ **可编辑文本**: 转录结果可实时编辑和修改
- ✅ **导出功能**: 支持文本复制和Markdown格式导出

### 🔧 技术特性
- **本地优先**: 支持完全本地化部署，数据安全可控
- **多模态AI**: 同时支持本地和云端AI模型
- **响应式设计**: 现代化Web界面，支持移动端
- **TypeScript**: 全栈类型安全，提高开发效率

## 🚀 快速开始

### 环境要求
- Node.js 18+
- pnpm 8+
- Python 3.8+ (用于faster-whisper服务)
- Ollama (可选，用于本地AI)

### 安装步骤

1. **克隆项目**
```bash
git clone <repository-url>
cd gaowei-meeting-ai
```

2. **安装依赖**
```bash
pnpm install
```

3. **环境配置**
```bash
# 复制环境变量模板
cp .env.example .env

# 编辑.env文件，添加必要的API密钥
# OPENAI_API_KEY=your_openai_key
# ANTHROPIC_API_KEY=your_claude_key
```

4. **启动faster-whisper服务**
```bash
# 在meeting-minutes目录下启动转录服务
cd meeting-minutes
python -m uvicorn main:app --host 0.0.0.0 --port 8178
```

5. **启动后端服务**
```bash
# 回到项目根目录
cd ..
pnpm dev:backend
```

6. **启动前端服务**
```bash
# 新终端窗口
cd src/frontend
pnpm dev
```

## 🌐 服务端口

- **前端**: http://localhost:5173
- **后端API**: http://localhost:3002
- **转录服务**: http://localhost:8178
- **Ollama**: http://localhost:11434 (可选)

## 📚 API文档

### 核心接口

| 接口 | 方法 | 描述 |
|-----|-----|------|
| `/health` | GET | 服务健康检查 |
| `/api/ai/status` | GET | AI服务状态 |
| `/api/transcribe` | POST | 音频文件上传转录 |
| `/api/transcribe/:id` | GET | 查询转录任务状态 |
| `/api/ai/summary` | POST | 生成AI摘要 |
| `/api/tasks` | GET | 获取任务列表 |

### AI服务状态示例
```json
{
  "available": true,
  "providers": {
    "ollama": {"available": true, "models": ["llama3.2:latest"]},
    "openai": {"available": true, "model": "gpt-3.5-turbo"},
    "claude": {"available": true, "model": "claude-3-haiku-20240307"}
  }
}
```

## 🧪 功能测试

### 后端服务测试 (全部通过 ✅)
```bash
# 健康检查
curl http://localhost:3002/health

# AI服务状态
curl http://localhost:3002/api/ai/status

# 转录引擎状态  
curl http://localhost:3002/api/engines

# 任务列表
curl http://localhost:3002/api/tasks
```

### 测试结果总结
- ✅ 后端服务状态: 正常运行 (端口3002)
- ✅ AI服务状态: 全部可用 (Ollama + OpenAI + Claude)
- ✅ 转录引擎: local-whisper和openai-whisper可用
- ✅ AI摘要功能: 正常工作 (中文摘要生成)
- ✅ 静态文件服务: 正常访问音频文件
- ✅ faster-whisper服务: 运行正常 (端口8178)

## 📁 项目结构

```
gaowei-meeting-ai/
├── src/
│   ├── frontend/          # React前端应用
│   │   ├── src/
│   │   │   ├── components/    # React组件
│   │   │   ├── pages/        # 页面组件
│   │   │   └── App.tsx       # 主应用
│   │   └── package.json
│   ├── backend/           # Node.js后端
│   │   └── index.ts       # Express服务器
│   └── shared/            # 共享类型定义
├── meeting-minutes/       # 转录服务 (外部依赖)
├── uploads/              # 上传文件存储
├── .env                  # 环境变量配置
└── package.json          # 项目配置
```

## 🔒 数据安全

- **本地存储**: 音频文件和转录结果本地存储
- **API密钥**: 环境变量安全管理
- **CORS保护**: 跨域请求安全控制
- **文件验证**: 上传文件类型和大小限制

## 🚧 开发路线图

### 即将实现
- [ ] 用户身份验证
- [ ] 会议记录管理
- [ ] 批量处理功能
- [ ] 数据库持久化
- [ ] 更多AI模型支持

### 未来计划
- [ ] 实时转录功能
- [ ] 多语言界面
- [ ] 企业级部署指南
- [ ] API文档自动生成

## 🤝 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📞 联系方式

- 项目维护者: [您的姓名]
- 邮箱: [您的邮箱]
- 项目链接: [项目GitHub链接]

---

**注意**: 确保在生产环境中妥善配置所有API密钥和安全设置。 