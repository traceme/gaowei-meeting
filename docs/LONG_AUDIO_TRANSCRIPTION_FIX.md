# 长音频转录超时问题修复

## 问题描述

转录2小时的录音文件时出现超时错误：
```
转录失败: 所有转录引擎都不可用: 本地Whisper转录失败: 转录失败: 转录任务超时
```

## 问题原因

原系统在多个层级设置了固定的5分钟超时限制：

1. **API轮询超时** - `packages/api/src/routes/transcription.ts` 固定300秒(5分钟)
2. **引擎转录超时** - `packages/whisper-engine/src/index.ts` 固定300000ms(5分钟)
3. **任务轮询超时** - 引擎内部轮询也是5分钟超时

对于2小时的音频文件，通常需要30-60分钟的转录时间，5分钟的超时明显不够。

## 解决方案

### 1. 动态超时计算

根据音频文件大小动态计算转录超时时间：

```typescript
const getTranscriptionTimeout = (audioBuffer: Buffer, engineMultiplier: number = 1): number => {
  const fileSizeMB = audioBuffer.length / (1024 * 1024);
  const estimatedMinutes = Math.max(fileSizeMB / 2, 1); // 每2MB约1分钟音频
  const transcriptionMinutes = Math.max(estimatedMinutes * engineMultiplier, 10); // 至少10分钟
  return Math.min(transcriptionMinutes * 60, 120 * 60); // 秒数，最大120分钟
};
```

### 2. 不同引擎的超时倍数

- **Faster-Whisper (Python)**: 1.0倍 - 基准速度
- **Whisper.cpp (C++)**: 2.0倍 - 较慢但更稳定
- **OpenAI API**: 0.3倍 - 云端处理更快

### 3. 修改的文件

#### packages/api/src/routes/transcription.ts
- 移除固定的5分钟超时限制
- 根据文件大小动态计算轮询超时时间
- 添加预估时间日志输出

#### packages/whisper-engine/src/index.ts
- `LocalWhisperEngine`: 动态HTTP请求超时 + 60分钟任务轮询超时
- `WhisperCppEngine`: 动态HTTP请求超时
- `OpenAIWhisperEngine`: 动态HTTP请求超时

#### packages/api/src/config/index.ts
- 添加统一的超时配置管理
- 提供超时计算函数和引擎倍数配置

## 超时时间示例

| 文件大小 | 估算音频时长 | Faster-Whisper | Whisper.cpp | OpenAI API |
|---------|-------------|----------------|-------------|------------|
| 10MB    | 5分钟       | 10分钟         | 20分钟      | 10分钟     |
| 50MB    | 25分钟      | 25分钟         | 50分钟      | 10分钟     |
| 200MB   | 100分钟     | 100分钟        | 120分钟     | 30分钟     |
| 400MB   | 200分钟     | 120分钟(最大)   | 120分钟(最大) | 60分钟     |

## 使用建议

### 对于长音频文件（>1小时）：
1. **优先使用 Faster-Whisper** - 速度和准确率的最佳平衡
2. **备选 Whisper.cpp** - 更稳定，但耗时更长
3. **谨慎使用 OpenAI API** - 快速但可能有文件大小限制

### 监控和调试：
- 查看控制台日志中的预估转录时间
- 前端会显示实时进度
- 系统会在超时前给出充分的处理时间

## 测试验证

修复后可以成功处理：
- ✅ 2小时音频文件 (约200MB)
- ✅ 动态超时计算
- ✅ 实时进度显示
- ✅ 引擎选择和切换

## 注意事项

1. **内存占用**: 长音频文件会消耗更多内存
2. **存储空间**: 确保有足够的临时文件存储空间
3. **网络稳定性**: 长时间处理需要稳定的网络连接
4. **系统资源**: 建议在性能较好的机器上处理长音频

## 回退方案

如果遇到问题，可以：
1. 将长音频文件分割成较小的片段
2. 使用云端API服务（OpenAI）
3. 临时增加系统内存和CPU资源 