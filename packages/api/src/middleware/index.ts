import express, {
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import multer from 'multer';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import type { ApiResponse, ApiError } from '@gaowei/shared-types';
import { appConfig } from '../config/index.js';
import { CONFIG_CONSTANTS } from '../config/constants.js';

// 确保上传目录存在
if (!existsSync(appConfig.upload.uploadDir)) {
  mkdirSync(appConfig.upload.uploadDir, { recursive: true });
}

// CORS中间件
export const corsMiddleware = cors({
  origin: appConfig.cors.origin,
  credentials: appConfig.cors.credentials,
  methods: [...CONFIG_CONSTANTS.CORS.ALLOWED_METHODS],
  allowedHeaders: [...CONFIG_CONSTANTS.CORS.ALLOWED_HEADERS],
  exposedHeaders: [...CONFIG_CONSTANTS.CORS.EXPOSED_HEADERS],
});

// 安全中间件
export const securityMiddleware = helmet({
  contentSecurityPolicy: false, // 开发时关闭，生产环境可以启用
});

// 压缩中间件
export const compressionMiddleware: RequestHandler = compression();

// 日志中间件
export const loggingMiddleware = morgan(
  appConfig.env === 'production' ? 'combined' : 'dev'
);

// JSON解析中间件
export const jsonMiddleware: RequestHandler = express.json({ limit: '10mb' });

// URL编码解析中间件
export const urlencodedMiddleware: RequestHandler = express.urlencoded({
  extended: true,
  limit: '10mb',
});

// 文件上传中间件
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, appConfig.upload.uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    // 修复：保留中文字符，只替换可能引起文件系统问题的特殊字符
    // 确保文件名正确处理UTF-8编码
    let safeName: string;
    try {
      // 确保originalname是UTF-8编码的字符串
      const originalName = Buffer.isBuffer(file.originalname) 
        ? file.originalname.toString('utf8') 
        : file.originalname;
      
      // 只替换文件系统不支持的特殊字符，保留中文字符
      safeName = originalName.replace(/[<>:"/\\|?*]/g, '_');
      
      // 验证UTF-8编码
      Buffer.from(safeName, 'utf8');
    } catch (error) {
      console.warn('文件名编码处理失败:', error);
      safeName = `audio_${timestamp}`;
    }
    
    const finalName = `${timestamp}_${safeName}`;
    console.log(`📁 保存文件: ${file.originalname} -> ${finalName}`);
    cb(null, finalName);
  },
});

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: appConfig.upload.maxSize,
  },
  fileFilter: (req, file, cb) => {
    if (appConfig.upload.allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型: ${file.mimetype}`));
    }
  },
});

// API响应辅助函数
export const sendSuccess = <T>(
  res: Response,
  data?: T,
  message?: string,
  statusCode = 200
): void => {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  };
  res.status(statusCode).json(response);
};

export const sendError = (
  res: Response,
  error: string | ApiError,
  statusCode = 400,
  details?: any
): void => {
  const apiError: ApiError =
    typeof error === 'string'
      ? {
          code: 'GENERIC_ERROR',
          message: error,
          timestamp: new Date().toISOString(),
          details,
        }
      : error;

  const response: ApiResponse = {
    success: false,
    error: apiError,
    timestamp: new Date().toISOString(),
  };

  res.status(statusCode).json(response);
};

// 错误处理中间件
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('API Error:', error);

  // Multer错误处理
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      sendError(res, '文件大小超过限制', 413);
      return;
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      sendError(res, '文件数量超过限制', 413);
      return;
    }
  }

  // JSON解析错误
  if (error instanceof SyntaxError && 'body' in error) {
    sendError(res, '无效的JSON格式', 400);
    return;
  }

  // 验证错误
  if (error.name === 'ValidationError') {
    sendError(res, error.message, 400, error);
    return;
  }

  // 数据库错误
  if (error.message.includes('SQLITE')) {
    sendError(res, '数据库操作失败', 500);
    return;
  }

  // 默认错误
  sendError(
    res,
    appConfig.env === 'production' ? '服务器内部错误' : error.message,
    500,
    appConfig.env === 'development' ? error.stack : undefined
  );
};

// 404处理中间件
export const notFoundHandler = (req: Request, res: Response): void => {
  sendError(res, `路由 ${req.originalUrl} 未找到`, 404);
};

// 请求日志中间件
export const requestLogger: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`
    );
  });

  next();
};

// 验证JSON中间件
export const validateJson: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.is('application/json') && Object.keys(req.body).length === 0) {
    sendError(res, '请求体不能为空', 400);
    return;
  }
  next();
};

// 静态文件服务配置
export const createStaticFileMiddleware = (uploadDir: string): RequestHandler => {
  const isProduction = process.env.NODE_ENV === 'production';
  const cacheMaxAge = isProduction 
    ? CONFIG_CONSTANTS.STATIC_FILES.CACHE.PRODUCTION_MAX_AGE 
    : CONFIG_CONSTANTS.STATIC_FILES.CACHE.DEVELOPMENT_MAX_AGE;

  return express.static(uploadDir, {
    dotfiles: 'deny',
    index: false,
    redirect: false,
    maxAge: isProduction ? '1d' : 0,
    setHeaders: (res: Response, path: string) => {
      // 为音频文件设置适当的headers
      if (path.match(CONFIG_CONSTANTS.STATIC_FILES.AUDIO_EXTENSIONS)) {
        res.set('Accept-Ranges', 'bytes');
        res.set('Content-Disposition', CONFIG_CONSTANTS.STATIC_FILES.SECURITY.CONTENT_DISPOSITION);
        res.set('Cache-Control', `public, max-age=${cacheMaxAge}`);
      }
    }
  });
};

// 设置所有中间件的便捷函数
export const setupMiddleware = (
  app: express.Application,
  config: typeof appConfig
): void => {
  // 基础中间件
  app.use(corsMiddleware);
  app.use(securityMiddleware);
  app.use(compressionMiddleware);
  app.use(loggingMiddleware);
  app.use(requestLogger);

  // 解析中间件
  app.use(jsonMiddleware);
  app.use(urlencodedMiddleware);

  // 静态文件服务 - 提供上传的音频文件访问
  app.use('/uploads', createStaticFileMiddleware(config.upload.uploadDir));

  // 文件上传中间件（仅对特定路由）
  app.use('/api/upload', uploadMiddleware.single('file'));
  app.use('/api/process', uploadMiddleware.single('file'));
  app.use('/api/transcription/upload', uploadMiddleware.single('file'));
  app.use('/api/summary/process', uploadMiddleware.single('file'));
};

// 设置错误处理中间件（应该在所有路由之后调用）
export const setupErrorHandling = (app: express.Application): void => {
  // 404处理中间件
  app.use(notFoundHandler);
  // 错误处理中间件
  app.use(errorHandler);
};
