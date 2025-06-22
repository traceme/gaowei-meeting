# API文档 📡

## 概述

高维会议AI提供了完整的RESTful API，支持音频转录、AI摘要、会议管理等核心功能。API采用统一的响应格式，支持错误处理和状态追踪。

## 基础信息

- **Base URL**: `http://localhost:3000/api`
- **API版本**: v2.0.0
- **认证方式**: 环境变量配置（开发阶段）
- **数据格式**: JSON
- **字符编码**: UTF-8

## 通用响应格式

### 成功响应

```json
{
  "success": true,
  "data": {
    // 响应数据
  },
  "timestamp": "2025-06-22T08:30:00.000Z"
}
```

### 错误响应

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "timestamp": "2025-06-22T08:30:00.000Z"
  },
  "timestamp": "2025-06-22T08:30:00.000Z"
}
```

## 核心端点

### 1. 系统信息

#### 获取健康状态

```http
GET /api/health
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2025-06-22T08:30:00.000Z",
    "uptime": 3600,
    "memory": {
      "rss": 50331648,
      "heapTotal": 29360128,
      "heapUsed": 20971520,
      "external": 1843712
    },
    "environment": "development"
  }
}
```

#### 获取系统信息

```http
GET /api/info
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "name": "高维会议AI API",
    "version": "2.0.0",
    "description": "统一的会议AI后端服务 - Monorepo架构",
    "features": [
      "多引擎音频转录（本地Whisper + OpenAI）",
      "多提供商AI摘要（Ollama + OpenAI + Claude）",
      "完整会议生命周期管理",
      "实时任务进度跟踪",
      "容错和降级机制",
      "模块化路由架构"
    ],
    "endpoints": {
      "health": "/api/health",
      "info": "/api/info",
      "meetings": "/api/meetings",
      "transcription": "/api/transcription",
      "summary": "/api/summary"
    },
    "architecture": {
      "type": "monorepo",
      "packages": ["api", "web", "ui", "shared-types", "whisper-engine"],
      "database": "SQLite with WAL mode",
      "services": ["meetings", "transcription", "ai-summary"]
    }
  }
}
```

### 2. 会议管理

#### 获取会议列表

```http
GET /api/meetings
```

**查询参数**：
- `status` (可选): 会议状态过滤 (`pending`, `transcribing`, `completed`, `error`)
- `limit` (可选): 结果数量限制 (默认: 50)
- `offset` (可选): 分页偏移 (默认: 0)

**响应示例**：
```json
{
  "success": true,
  "data": {
    "meetings": [
      {
        "id": "uuid-string",
        "title": "会议标题",
        "description": "会议描述",
        "status": "completed",
        "audioPath": "/uploads/audio.mp3",
        "summary": {
          "keyPoints": ["要点1", "要点2"],
          "actionItems": ["行动项1", "行动项2"],
          "summary": "会议摘要文本",
          "participants": ["参与者1", "参与者2"]
        },
        "createdAt": "2025-06-22T08:00:00.000Z",
        "updatedAt": "2025-06-22T08:30:00.000Z"
      }
    ],
    "total": 10,
    "limit": 50,
    "offset": 0
  }
}
```

#### 创建会议

```http
POST /api/meetings
```

**请求体**：
```json
{
  "title": "会议标题",
  "description": "会议描述（可选）"
}
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "meeting": {
      "id": "uuid-string",
      "title": "会议标题",
      "description": "会议描述",
      "status": "pending",
      "createdAt": "2025-06-22T08:30:00.000Z"
    }
  }
}
```

#### 获取特定会议

```http
GET /api/meetings/{meetingId}
```

**路径参数**：
- `meetingId`: 会议UUID

**响应示例**：同创建会议响应格式

#### 更新会议

```http
PUT /api/meetings/{meetingId}
```

**请求体**：
```json
{
  "title": "新标题（可选）",
  "description": "新描述（可选）",
  "status": "completed（可选）"
}
```

#### 删除会议

```http
DELETE /api/meetings/{meetingId}
```

### 3. 音频转录

#### 上传音频文件

```http
POST /api/transcription/upload
```

**请求格式**: `multipart/form-data`

**表单字段**：
- `file` (必需): 音频文件
- `meetingId` (可选): 关联的会议ID
- `language` (可选): 语言代码 (默认: `zh-CN`)

**支持的音频格式**：
- MP3, WAV, M4A, AIFF, FLAC
- 最大文件大小: 100MB
- 最大时长: 3小时

**响应示例**：
```json
{
  "success": true,
  "data": {
    "message": "文件上传成功，转录已开始",
    "meetingId": "uuid-string",
    "taskId": "task-uuid"
  }
}
```

#### 获取转录任务状态

```http
GET /api/transcription/{taskId}
```

**路径参数**：
- `taskId`: 转录任务ID

**响应示例**：
```json
{
  "success": true,
  "data": {
    "task": {
      "id": "task-uuid",
      "status": "completed",
      "progress": 100,
      "result": {
        "text": "转录文本内容",
        "segments": [
          {
            "start": 0.0,
            "end": 5.2,
            "text": "第一段文本",
            "words": [
              {
                "word": "第一",
                "start": 0.0,
                "end": 1.0,
                "confidence": 0.95
              }
            ]
          }
        ],
        "language": "zh-CN",
        "duration": 120.5
      },
      "createdAt": "2025-06-22T08:00:00.000Z",
      "updatedAt": "2025-06-22T08:05:00.000Z"
    }
  }
}
```

**任务状态**：
- `pending`: 等待处理
- `processing`: 转录中
- `completed`: 完成
- `error`: 错误

#### 获取转录引擎状态

```http
GET /api/transcription/engines/status
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "engines": [
      {
        "name": "local-whisper",
        "available": true,
        "type": "local",
        "version": "v1.5.4",
        "supportedLanguages": ["zh", "en", "ja", "ko"],
        "maxFileSize": "100MB",
        "maxDuration": "3h"
      }
    ]
  }
}
```

### 4. AI摘要

#### 生成摘要

```http
POST /api/summary
```

**请求体**：
```json
{
  "meetingId": "uuid-string（可选）",
  "text": "会议转录文本",
  "model": "gpt-3.5-turbo（可选）"
}
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "summary": {
      "keyPoints": [
        "讨论了项目进度和里程碑",
        "确定了下一阶段的工作重点"
      ],
      "actionItems": [
        "张三负责完成API文档",
        "李四负责前端界面优化"
      ],
      "summary": "本次会议主要讨论了项目的整体进展...",
      "participants": ["张三", "李四", "王五"],
      "model": "gpt-3.5-turbo",
      "provider": "openai",
      "createdAt": "2025-06-22T08:30:00.000Z"
    }
  }
}
```

#### 获取AI提供商状态

```http
GET /api/summary/providers/status
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "providers": [
      {
        "name": "ollama",
        "available": false,
        "error": "服务未启动"
      },
      {
        "name": "openai",
        "available": true,
        "models": ["gpt-3.5-turbo", "gpt-4"],
        "rateLimit": {
          "requests": 3000,
          "tokens": 90000,
          "period": "1m"
        }
      },
      {
        "name": "claude",
        "available": true,
        "models": ["claude-3-haiku-20240307"],
        "rateLimit": {
          "requests": 1000,
          "tokens": 25000,
          "period": "1m"
        }
      }
    ],
    "fallbackChain": ["ollama", "openai", "claude"]
  }
}
```

#### 完整处理流程

```http
POST /api/summary/process
```

一站式接口，包含音频上传、转录和摘要生成。

**请求格式**: `multipart/form-data`

**表单字段**：
- `file` (必需): 音频文件
- `title` (可选): 会议标题
- `description` (可选): 会议描述
- `language` (可选): 转录语言
- `model` (可选): AI摘要模型

**响应示例**：
```json
{
  "success": true,
  "data": {
    "message": "文件上传成功，完整处理已开始",
    "meetingId": "uuid-string",
    "processTaskId": "process-task-uuid"
  }
}
```

#### 获取处理任务状态

```http
GET /api/summary/process/{taskId}
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "task": {
      "id": "process-task-uuid",
      "status": "completed",
      "progress": 100,
      "result": {
        "transcription": {
          "text": "转录文本",
          "segments": [],
          "language": "zh-CN"
        },
        "summary": {
          "keyPoints": [],
          "actionItems": [],
          "summary": "摘要文本",
          "participants": []
        }
      },
      "createdAt": "2025-06-22T08:00:00.000Z",
      "updatedAt": "2025-06-22T08:10:00.000Z"
    }
  }
}
```

## 错误代码

| 错误代码 | HTTP状态码 | 描述 |
|----------|------------|------|
| `GENERIC_ERROR` | 500 | 通用服务器错误 |
| `VALIDATION_ERROR` | 400 | 请求参数验证失败 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `FILE_TOO_LARGE` | 413 | 文件过大 |
| `UNSUPPORTED_FORMAT` | 415 | 不支持的文件格式 |
| `TRANSCRIPTION_FAILED` | 500 | 转录失败 |
| `AI_SERVICE_UNAVAILABLE` | 503 | AI服务不可用 |
| `RATE_LIMIT_EXCEEDED` | 429 | 请求频率超限 |

## 使用示例

### cURL 示例

#### 上传音频文件

```bash
curl -X POST http://localhost:3000/api/transcription/upload \
  -F "file=@/path/to/audio.mp3" \
  -F "language=zh-CN"
```

#### 检查转录状态

```bash
curl http://localhost:3000/api/transcription/task-uuid
```

#### 生成摘要

```bash
curl -X POST http://localhost:3000/api/summary \
  -H "Content-Type: application/json" \
  -d '{
    "text": "会议转录文本内容...",
    "model": "gpt-3.5-turbo"
  }'
```

### JavaScript 示例

#### 上传文件

```javascript
const formData = new FormData();
formData.append('file', audioFile);
formData.append('language', 'zh-CN');

const response = await fetch('/api/transcription/upload', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log(result);
```

#### 轮询任务状态

```javascript
async function pollTaskStatus(taskId) {
  const response = await fetch(`/api/transcription/${taskId}`);
  const result = await response.json();
  
  if (result.data.task.status === 'completed') {
    console.log('转录完成:', result.data.task.result);
  } else if (result.data.task.status === 'processing') {
    setTimeout(() => pollTaskStatus(taskId), 1000);
  }
}
```

### Python 示例

```python
import requests

# 上传音频文件
with open('audio.mp3', 'rb') as f:
    files = {'file': f}
    data = {'language': 'zh-CN'}
    response = requests.post(
        'http://localhost:3000/api/transcription/upload',
        files=files,
        data=data
    )
    print(response.json())

# 生成摘要
summary_data = {
    'text': '会议转录文本...',
    'model': 'gpt-3.5-turbo'
}
response = requests.post(
    'http://localhost:3000/api/summary',
    json=summary_data
)
print(response.json())
```

## 实时更新

对于长时间运行的任务（转录、摘要生成），建议使用轮询方式检查状态：

1. **轮询间隔**: 建议1-2秒
2. **超时处理**: 设置合理的超时时间（如5分钟）
3. **错误重试**: 网络错误时进行重试

## 性能考虑

- **文件大小限制**: 单个音频文件最大100MB
- **并发处理**: 同时处理的任务数量有限制
- **缓存机制**: 相同文件的转录结果会被缓存
- **资源清理**: 临时文件会定期清理

## 安全注意事项

- 所有上传的文件都会进行格式验证
- 敏感信息（API密钥）通过环境变量管理
- 文件上传路径经过安全检查
- 定期清理临时文件和过期数据

---

**API版本**: v2.0.0  
**最后更新**: 2025-06-22  
**联系方式**: 技术支持团队 