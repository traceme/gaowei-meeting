import express, { type Application } from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { appConfig } from './config/index.js';
import { setupMiddleware, setupErrorHandling } from './middleware/index.js';
import apiRoutes from './routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Application = express();
const server = createServer(app);

// 设置中间件
setupMiddleware(app, appConfig);

// 挂载API路由
app.use('/api', apiRoutes);

// 根路径信息
app.get('/', (req, res) => {
  res.json({
    name: '高维会议AI - 统一API服务',
    version: '2.0.0',
    description: '整合转录、AI摘要和会议管理的统一后端服务',
    architecture: 'Monorepo架构',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      api: '/api',
      health: '/api/health',
      info: '/api/info',
      docs: '/api/info',
    },
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    error: '接口不存在',
    message: `路径 ${req.originalUrl} 未找到`,
    suggestion: '请访问 /api/info 查看可用接口',
    timestamp: new Date().toISOString(),
  });
});

// 设置错误处理中间件
setupErrorHandling(app);

// 启动服务器
const PORT = appConfig.server.port;
const HOST = appConfig.server.host;

server.listen(PORT, HOST, () => {
  console.log(`
🚀 高维会议AI API服务已启动
📍 地址: http://${HOST}:${PORT}
🏗️  架构: Monorepo模块化架构
📊 数据库: SQLite (WAL模式)
🎙️  转录引擎: 本地Whisper + OpenAI
🤖 AI提供商: Ollama + OpenAI + Claude
📝 功能模块:
   - 会议管理: /api/meetings
   - 转录服务: /api/transcription  
   - AI摘要: /api/summary
   - 健康检查: /api/health
   - API信息: /api/info

环境: ${process.env.NODE_ENV || 'development'}
`);
});

// 优雅关闭
const gracefulShutdown = (signal: string) => {
  console.log(`\n📋 收到 ${signal} 信号，开始优雅关闭...`);

  server.close(() => {
    console.log('🔌 HTTP服务器已关闭');
    process.exit(0);
  });

  // 强制关闭超时
  setTimeout(() => {
    console.error('⚠️ 强制关闭超时，直接退出');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { app, server };
