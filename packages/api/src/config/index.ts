import { config } from 'dotenv';
import { join } from 'path';

// 加载环境变量
config();

export interface AppConfig {
  port: number;
  env: string;
  cors: {
    origin: string[];
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
      };
    };
  };
  whisper: {
    serverUrl: string;
    serverPort: number;
    model: string;
    modelSize: string;
  };
}

export const appConfig: AppConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  env: process.env.NODE_ENV || 'development',
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
    credentials: true,
  },
  database: {
    path: process.env.DB_PATH || join(process.cwd(), 'data', 'meeting_minutes.db'),
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
    ],
    uploadDir: process.env.UPLOAD_DIR || join(process.cwd(), 'data', 'uploads'),
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
      ...(process.env.OLLAMA_BASE_URL && {
        ollama: {
          apiKey: process.env.OLLAMA_API_KEY,
          baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
        },
      }),
    },
  },
  whisper: {
    serverUrl: process.env.WHISPER_SERVER_URL || 'http://localhost:8178',
    serverPort: parseInt(process.env.WHISPER_SERVER_PORT || '8178', 10),
    model: process.env.WHISPER_MODEL || 'small',
    modelSize: process.env.WHISPER_MODEL_SIZE || process.env.WHISPER_MODEL || 'small',
  },
};

export default appConfig; 