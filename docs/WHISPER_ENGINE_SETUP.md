# Whisper引擎选择指南

高维会议AI现在支持多种Whisper转录引擎，您可以根据需求选择最适合的引擎。

## 支持的引擎

### 1. Faster-Whisper (推荐)
- **描述**: Python版本，功能完整，支持GPU加速
- **优势**: 功能丰富、支持实时进度显示、GPU加速、多语言支持
- **资源要求**: 中等内存占用，需要Python环境
- **默认端口**: 8178

### 2. Whisper.cpp (高性能)
- **描述**: C++原生实现，高性能，低内存消耗
- **优势**: 原生性能、低内存占用、快速启动、无Python依赖
- **限制**: 暂不支持实时进度显示，GPU支持有限
- **默认端口**: 8081

### 3. OpenAI Whisper (云端)
- **描述**: OpenAI官方API，需要API密钥
- **优势**: 无需本地资源、最新模型、高精度
- **要求**: 需要网络连接和API密钥

## 快速设置

### 1. 选择引擎
1. 启动应用程序
2. 进入 **设置** → **Whisper 引擎** 页面
3. 查看可用引擎状态
4. 选择您想要的引擎

### 2. Faster-Whisper (默认已配置)
Faster-Whisper默认已经配置好，如果服务运行正常，应该显示为"可用"状态。

### 3. 设置Whisper.cpp

#### 编译Whisper.cpp服务器
```bash
# 运行编译脚本
./packages/whisper-engine/scripts/build-whisper-cpp.sh

# 或者手动编译
cd packages/whisper-engine/src/whisper-cpp-server
make
cd examples/server
make server
```

#### 下载模型文件
```bash
# 创建模型目录
mkdir -p packages/whisper-engine/src/whisper-cpp-server/models

# 下载base模型 (推荐)
curl -L "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin" \
     -o packages/whisper-engine/src/whisper-cpp-server/models/ggml-base.bin
```

#### 启动Whisper.cpp服务器
```bash
cd packages/whisper-engine/src/whisper-cpp-server
./whisper-server --port 8081 --model models/ggml-base.bin
```

### 4. 设置OpenAI Whisper
1. 获取OpenAI API密钥
2. 在环境变量中设置: `OPENAI_API_KEY=your_api_key`
3. 重启应用程序

## 引擎对比

| 特性 | Faster-Whisper | Whisper.cpp | OpenAI |
|------|----------------|-------------|---------|
| 性能 | 高 | 高 | 高 |
| 内存占用 | 中等 | 低 | 低 |
| GPU支持 | ✅ | 有限 | ✅ |
| 实时进度 | ✅ | ❌ | ❌ |
| 多语言 | ✅ | ✅ | ✅ |
| 本地化 | ✅ | ✅ | ❌ |
| 配置难度 | 低 | 中 | 低 |

## 故障排除

### Whisper.cpp编译问题
1. **缺少编译工具**:
   - Ubuntu/Debian: `sudo apt install build-essential`
   - macOS: 安装XCode Command Line Tools
   - Windows: 安装Visual Studio Build Tools

2. **编译失败**:
   ```bash
   cd packages/whisper-engine/src/whisper-cpp-server
   make clean
   make
   ```

### 服务连接问题
1. **检查端口占用**:
   ```bash
   # 检查8178端口 (Faster-Whisper)
   lsof -i :8178
   
   # 检查8081端口 (Whisper.cpp)
   lsof -i :8081
   ```

2. **检查服务状态**:
   - 在设置页面点击"刷新状态"按钮
   - 查看浏览器控制台是否有错误信息

### 模型下载问题
1. **网络问题**: 使用代理或镜像站点
2. **磁盘空间**: 确保有足够的存储空间
3. **权限问题**: 检查目录写入权限

## 性能优化建议

### 对于GPU用户
- 选择 **Faster-Whisper** 以充分利用GPU加速
- 确保安装了CUDA支持的PyTorch

### 对于CPU用户
- 选择 **Whisper.cpp** 以获得最佳CPU性能
- 考虑使用较小的模型 (tiny, base) 以提高速度

### 对于云端用户
- 选择 **OpenAI Whisper** 如果不想占用本地资源
- 注意API调用费用和网络延迟

## API文档

### 获取当前引擎
```
GET /api/engine/current
```

### 切换引擎
```
POST /api/engine/select
Content-Type: application/json

{
  "engine": "faster-whisper" | "whisper-cpp" | "openai"
}
```

### 获取引擎状态
```
GET /api/engine/status
```

## 贡献

如果您想添加新的引擎支持或改进现有功能，请:
1. Fork项目
2. 创建功能分支
3. 提交Pull Request

## 支持

如有问题或建议，请在GitHub上创建Issue。 