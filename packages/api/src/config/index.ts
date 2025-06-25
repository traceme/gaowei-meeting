import { config } from 'dotenv';
import { join, resolve } from 'path';

// 加载环境变量
config();

// 路径解析助手函数
const resolveUploadDir = (): string => {
  if (process.env.UPLOAD_DIR) {
    return resolve(process.env.UPLOAD_DIR);
  }
  
  // 默认路径：从API包目录向上两级到项目根目录的uploads文件夹
  return resolve(process.cwd(), '../../uploads');
};

export interface AppConfig {
  env: string;
  server: {
    port: number;
    host: string;
  };
  cors: {
    origin: (string | RegExp)[];
    credentials: boolean;
  };
  database: {
    path: string;
  };
  upload: {
    maxSize: number;
    allowedTypes: string[];
    uploadDir: string;
  };
  ai: {
    providers: {
      openai?: {
        apiKey: string;
        baseUrl?: string;
      };
      anthropic?: {
        apiKey: string;
      };
      groq?: {
        apiKey: string;
      };
      ollama?: {
        apiKey?: string;
        baseUrl: string;
        model?: string;
      };
    };
  };
  whisper: {
    serverUrl: string;
    serverPort: number;
    model: string;
    modelSize: string;
    timeout: {
      calculateTimeout: (fileSizeMB: number, engineMultiplier: number) => number;
      engines: {
        'faster-whisper': number;
        'whisper-cpp': number;
        'openai': number;
      };
      min: number;
      max: number;
    };
  };
}

export const appConfig: AppConfig = {
  env: process.env.NODE_ENV || 'development',
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.SERVER_HOST || 'localhost',
  },
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://10.2.0.16:5173',
      'http://0.0.0.0:5173',
      // 允许本地网络的所有IP访问
      /^http:\/\/(\d{1,3}\.){3}\d{1,3}:5173$/,
      /^http:\/\/localhost:\d+$/,
      /^http:\/\/127\.0\.0\.1:\d+$/
    ],
    credentials: true,
  },
  database: {
    path:
      process.env.DB_PATH || join(process.cwd(), 'data', 'meeting_minutes.db'),
  },
  upload: {
    maxSize: parseInt(process.env.MAX_UPLOAD_SIZE || '100', 10) * 1024 * 1024, // MB to bytes
    allowedTypes: [
      'audio/mp3',
      'audio/mpeg', // 标准MP3 MIME类型
      'audio/wav',
      'audio/wave',
      'audio/x-wav',
      'audio/m4a',
      'audio/mp4',
      'audio/aac',
      'audio/ogg',
      'audio/flac',
      'audio/webm',
      'audio/aiff',
      'audio/x-aiff',
      'application/octet-stream', // 兼容一些音频文件被识别为此类型
    ],
    uploadDir: resolveUploadDir(),
  },
  ai: {
    providers: {
      ...(process.env.OPENAI_API_KEY && {
        openai: {
          apiKey: process.env.OPENAI_API_KEY,
          baseUrl: process.env.OPENAI_BASE_URL,
        },
      }),
      ...(process.env.ANTHROPIC_API_KEY && {
        anthropic: {
          apiKey: process.env.ANTHROPIC_API_KEY,
        },
      }),
      ...(process.env.GROQ_API_KEY && {
        groq: {
          apiKey: process.env.GROQ_API_KEY,
        },
      }),
      // 总是初始化 ollama 配置，因为它是默认的本地服务
      ollama: {
        apiKey: process.env.OLLAMA_API_KEY,
        baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
        model: process.env.OLLAMA_MODEL || 'phi4:14b-q4_K_M',
      },
    },
  },
  whisper: {
    serverUrl: process.env.WHISPER_SERVER_URL || 'http://localhost:8178',
    serverPort: parseInt(process.env.WHISPER_SERVER_PORT || '8178', 10),
    model: process.env.WHISPER_MODEL || 'small',
    modelSize:
      process.env.WHISPER_MODEL_SIZE || process.env.WHISPER_MODEL || 'small',
    timeout: {
      calculateTimeout: (fileSizeMB: number, engineMultiplier: number = 1): number => {
        const estimatedMinutes = Math.max(fileSizeMB / 2, 1); // 假设每2MB约1分钟音频
        const transcriptionMinutes = Math.max(estimatedMinutes * engineMultiplier, 10); // 至少10分钟
        return Math.min(transcriptionMinutes * 60, 120 * 60); // 秒数，最大120分钟
      },
      engines: {
        'faster-whisper': 1.0,    // Python faster-whisper
        'whisper-cpp': 2.0,       // C++ 版本可能更慢
        'openai': 0.3,            // OpenAI API 最快
      },
      min: 10,
      max: 120,
    },
  },
};

export default appConfig;
