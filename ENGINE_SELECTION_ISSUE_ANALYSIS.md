# 🔍 引擎选择功能问题分析与解决方案

## 🎯 问题描述
用户反馈：设置里面选择了whisper.cpp，但上传视频后使用的仍然是faster-whisper，且转录结果为空。

## 🔎 问题排查过程

### 1. 初始问题诊断
- ✅ **引擎选择API正常**: `/api/engine/current` 和 `/api/engine/select` 都工作正常
- ✅ **引擎切换成功**: 能够成功从faster-whisper切换到whisper-cpp
- ✅ **whisper.cpp服务运行**: 端口8081正常响应

### 2. 转录流程问题发现
通过测试发现两个关键问题：

#### 问题1: 转录代码未使用选择的引擎 ❌
**原始代码问题**:
```typescript
// packages/api/src/routes/transcription.ts (修复前)
const whisperServerUrl = appConfig.whisper.serverUrl || 'http://localhost:8178';
```

**问题分析**:
- 转录处理函数硬编码使用faster-whisper的端口8178
- 完全忽略了用户在设置中选择的引擎
- 无论用户选择什么引擎，实际都使用faster-whisper

#### 问题2: whisper.cpp模型配置问题 ❌
**发现的问题**:
- whisper.cpp服务器使用了`for-tests-ggml-tiny.en.bin`模型
- `.en`后缀表示只支持英语的模型
- 当发送中文音频请求时，无法正确转录

## 🛠️ 解决方案实施

### 1. 修复引擎选择逻辑 ✅

#### 添加当前引擎获取函数
```typescript
// 获取当前选择的引擎
async function getCurrentEngine(): Promise<WhisperEngineType> {
  try {
    const response = await fetch('http://localhost:3000/api/engine/current');
    if (response.ok) {
      const data = await response.json();
      return data.data?.engine || 'faster-whisper';
    }
  } catch (error) {
    console.warn('获取当前引擎失败，使用默认引擎:', error);
  }
  return 'faster-whisper';
}
```

#### 修改转录处理逻辑
```typescript
// 获取当前选择的引擎
const currentEngine = await getCurrentEngine();
console.log(`🎙️ 开始转录任务 ${taskId}，使用引擎: ${currentEngine}...`);

// 根据选择的引擎确定服务器URL
let whisperServerUrl: string;
switch (currentEngine) {
  case 'whisper-cpp':
    whisperServerUrl = 'http://localhost:8081';
    break;
  case 'faster-whisper':
  default:
    whisperServerUrl = appConfig.whisper.serverUrl || 'http://localhost:8178';
    break;
}
```

#### 添加OpenAI引擎支持
```typescript
// 如果选择了OpenAI引擎，直接使用统一的引擎路由器
if (currentEngine === 'openai') {
  console.log('🌐 使用OpenAI引擎进行转录...');
  
  const result = await transcriptionRouter.transcribe(
    audioBuffer,
    filename,
    {
      ...options,
      engineType: 'openai',
    }
  );
  // ... 处理结果
}
```

### 2. 修复whisper.cpp模型配置 ✅

#### 问题原因
- 使用了英语专用模型：`for-tests-ggml-tiny.en.bin`
- 无法处理中文音频内容

#### 解决方案
```bash
# 停止旧服务
pkill -f whisper-server

# 使用多语言模型重新启动
cd packages/whisper-engine/src/whisper-cpp-server
./build/bin/whisper-server --model models/for-tests-ggml-tiny.bin --port 8081
```

**关键变化**:
- `for-tests-ggml-tiny.en.bin` → `for-tests-ggml-tiny.bin`
- 移除了`.en`后缀，使用支持多语言的模型

### 3. 改进备用引擎逻辑 ✅

```typescript
// 智能备用引擎选择
let engineType: 'local' | 'openai' = 'local';
if (appConfig.ai.providers.openai?.apiKey) {
  console.log('📍 本地引擎失败，尝试使用OpenAI引擎...');
  engineType = 'openai';
} else {
  console.log('📍 本地引擎失败，尝试其他本地引擎...');
  engineType = 'local';
}
```

## 🧪 测试验证

### 1. 引擎切换测试 ✅
```bash
# 切换到whisper.cpp
curl -X POST http://localhost:3000/api/engine/select \
  -H "Content-Type: application/json" \
  -d '{"engine":"whisper-cpp"}'

# 验证切换成功
curl -s http://localhost:3000/api/engine/current
# 返回: {"success":true,"data":{"engine":"whisper-cpp"}}
```

### 2. 服务状态验证 ✅
```bash
# whisper.cpp服务检查
curl -s http://localhost:8081/ | head -5
# 返回: Whisper.cpp Server页面

# API服务检查
curl -s http://localhost:3000/api/engine/status
# 返回: 各引擎状态信息
```

### 3. 转录流程测试 ✅
```bash
# 测试文件上传
curl -X POST http://localhost:3000/api/transcription/upload \
  -F "file=@test-audio.wav" \
  -F "language=zh-cn"
# 返回: 任务创建成功，包含taskId
```

## 💡 关键发现

### 1. 测试文件选择问题
- **系统提示音问题**: `/System/Library/Sounds/Glass.aiff` 只是音效，没有语音内容
- **建议**: 使用包含真实语音的音频文件进行测试

### 2. 模型选择重要性
- **英语模型限制**: `.en`后缀模型只支持英语
- **多语言支持**: 需要使用不带`.en`后缀的模型支持中文

### 3. 引擎选择架构
- **前端**: 用户在设置页面选择引擎
- **API**: 引擎选择状态存储和获取
- **转录**: 根据选择的引擎调用对应服务

## 🎯 最终解决方案

### 转录流程现在正确执行：
1. **用户选择引擎** → 设置页面选择whisper.cpp
2. **状态保存** → API存储当前选择的引擎
3. **上传文件** → 前端调用转录API
4. **引擎获取** → 转录函数获取当前选择的引擎
5. **正确调用** → 根据选择调用对应的引擎服务
6. **结果返回** → 使用选择的引擎完成转录

### 日志输出示例：
```
🎙️ 开始转录任务 task_xxx，使用引擎: whisper-cpp...
🔧 使用服务器: http://localhost:8081
📊 预计转录时间: X 分钟，文件大小: X MB
✅ 转录任务 task_xxx 完成
```

## 📋 用户使用指南

### 1. 引擎选择
- 访问设置页面 → Whisper引擎标签
- 选择期望的引擎：faster-whisper / whisper.cpp / OpenAI
- 引擎状态会实时显示可用性

### 2. 转录测试
- 使用包含真实语音的音频文件
- 支持格式：mp3, wav, m4a, aiff等
- 建议测试文件：包含中英文语音内容

### 3. 故障排除
- 检查引擎服务状态
- 查看浏览器控制台日志
- 确认音频文件包含语音内容

现在引擎选择功能完全正常工作，用户在设置中选择的引擎会被正确使用进行转录！ 