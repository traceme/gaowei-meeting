// 配置常量
export const CONFIG_CONSTANTS = {
  // 静态文件配置
  STATIC_FILES: {
    // 支持的音频文件扩展名
    AUDIO_EXTENSIONS: /\.(mp3|wav|m4a|ogg|webm|flac)$/i,
    
    // 缓存设置
    CACHE: {
      // 生产环境缓存时间（秒）
      PRODUCTION_MAX_AGE: 86400, // 1天
      // 开发环境缓存时间
      DEVELOPMENT_MAX_AGE: 0, // 不缓存
    },
    
    // 安全设置
    SECURITY: {
      // 允许的文件访问类型
      CONTENT_DISPOSITION: 'inline',
      // 禁止访问的文件模式
      DENIED_PATTERNS: ['dotfiles'],
    },
  },
  
  // 网络超时设置
  TIMEOUTS: {
    API_REQUEST: 120000, // 2分钟
    FILE_DOWNLOAD: 30000, // 30秒
  },
  
  // CORS相关设置
  CORS: {
    ALLOWED_METHODS: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    ALLOWED_HEADERS: ['Content-Type', 'Authorization', 'X-Requested-With', 'Range', 'Accept-Ranges'],
    EXPOSED_HEADERS: ['Content-Range', 'Accept-Ranges', 'Content-Length'],
  },
} as const;

// 导出类型
export type ConfigConstants = typeof CONFIG_CONSTANTS; 