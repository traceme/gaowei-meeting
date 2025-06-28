import React from 'react'
import { getEngineDisplayName } from '../utils/engineUtils'

// 格式化音频时长的工具函数
const formatDuration = (duration: string | number | undefined): string => {
  if (!duration) {
    return '未知时长';
  }
  
  // 如果是数字（秒数），转换为时分秒格式
  if (typeof duration === 'number') {
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = Math.floor(duration % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }
  
  // 如果是字符串，直接返回（已经是时分秒格式）
  if (typeof duration === 'string') {
    return duration;
  }
  
  return '未知时长';
};

// 格式化文件名的工具函数 - 强化版，解决中文显示问题
const formatFilename = (filename: string | undefined): string => {
  if (!filename) {
    return '未知文件';
  }
  
  try {
    // 策略1: 如果已经包含中文字符，可能已经是正确编码
    const chineseRegex = /[\u4e00-\u9fa5]/;
    if (chineseRegex.test(filename)) {
      return filename;
    }
    
    // 策略2: 尝试URL解码（针对前端编码的文件名）
    try {
      const decoded = decodeURIComponent(filename);
      if (decoded !== filename && chineseRegex.test(decoded)) {
        console.log('文件名URL解码成功:', filename, '->', decoded);
        return decoded;
      }
    } catch (e) {
      // URL解码失败，继续下一个策略
    }
    
    // 策略3: 尝试Base64解码（如果文件名看起来像Base64）
    try {
      if (/^[A-Za-z0-9+/]+=*$/.test(filename) && filename.length > 10) {
        const decoded = decodeURIComponent(escape(atob(filename)));
        if (chineseRegex.test(decoded)) {
          console.log('文件名Base64解码成功:', filename, '->', decoded);
          return decoded;
        }
      }
    } catch (e) {
      // Base64解码失败，继续下一个策略
    }
    
    return filename;
  } catch (error) {
    console.warn('文件名解码失败:', error);
    return filename;
  }
};

// 格式化日期时间的工具函数 - 修复Invalid Date问题
const formatDateTime = (dateTime: string | undefined): string => {
  if (!dateTime) {
    console.warn('🕒 formatDateTime: 收到空的日期时间');
    return '未知时间';
  }
  
  console.log('🕒 formatDateTime: 处理日期时间:', dateTime);
  
  try {
    const date = new Date(dateTime);
    
    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      console.warn('🕒 formatDateTime: 无效的日期时间格式:', dateTime);
      return '时间格式错误';
    }
    
    const formatted = date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    console.log('🕒 formatDateTime: 格式化结果:', formatted);
    return formatted;
  } catch (error) {
    console.warn('🕒 formatDateTime: 日期时间解析失败:', error);
    return '时间解析错误';
  }
};

interface TranscriptionProgressProps {
  files: Array<{
    name: string
    size: number
    type: string
  }>
  currentTask?: {
    id: string
    status: 'pending' | 'processing' | 'completed' | 'error'
    filename: string
    progress: number
    createdAt: string
    currentStage?: string
    estimatedTime?: number
    engine?: string
    duration?: string
    elapsedTime?: number
  }
  onRemoveFile: (index: number) => void
  onCancel?: () => void
  onRefresh?: () => void
}

const TranscriptionProgress: React.FC<TranscriptionProgressProps> = ({
  files,
  currentTask,
  onRemoveFile,
  onCancel,
  onRefresh
}) => {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // 根据进度百分比映射到6个处理阶段
  const getProgressMapping = (progress: number) => {
    if (progress < 10) return { stage: 0, stageProgress: 0 }
    if (progress < 25) return { stage: 1, stageProgress: (progress - 10) / 15 * 100 }
    if (progress < 70) return { stage: 2, stageProgress: (progress - 25) / 45 * 100 }
    if (progress < 85) return { stage: 3, stageProgress: (progress - 70) / 15 * 100 }
    if (progress < 95) return { stage: 4, stageProgress: (progress - 85) / 10 * 100 }
    if (progress < 100) return { stage: 5, stageProgress: (progress - 95) / 5 * 100 }
    return { stage: 5, stageProgress: 100 }
  }

  const getStageStatus = (stageIndex: number, progress: number) => {
    const { stage } = getProgressMapping(progress)
    if (stageIndex < stage) return 'completed'
    if (stageIndex === stage) return 'current'
    return 'pending'
  }

  const stages = [
    { name: '文件处理', icon: '📄', desc: '上传并验证文件' },
    { name: '音频分析', icon: '🎵', desc: '分析音频格式和质量' },
    { name: '语音识别', icon: '🎙️', desc: '使用AI进行语音转文字' },
    { name: '文本处理', icon: '📝', desc: '优化和格式化文本' },
    { name: 'AI摘要', icon: '🤖', desc: '生成智能摘要' },
    { name: '完成', icon: '✅', desc: '处理完成，准备导出' }
  ]

  const currentMapping = currentTask ? getProgressMapping(currentTask.progress) : { stage: -1, stageProgress: 0 }
  const currentStageIndex = currentMapping.stage
  
  // 🔧 修复时间估算逻辑 - 基于文件大小和音频时长计算合理的估算时间
  const calculateEstimatedMinutes = () => {
    if (!currentTask) return 2
    
    // 如果后端提供了估算时间，使用后端数据
    if (currentTask.estimatedTime) {
      return Math.ceil(currentTask.estimatedTime / 60)
    }
    
    // 获取音频时长（从任务信息中获取，或根据文件大小粗略估算）
    const getAudioDurationMinutes = (): number => {
      if (!currentTask) return 10 // 默认10分钟
      
      // 如果任务中已有音频时长信息
      if (currentTask.duration) {
        // duration 格式可能是 "3:45" 或 "0:03:45"
        const parts = currentTask.duration.split(':').map(Number)
        if (parts.length === 2) {
          return (parts[0] || 0) + (parts[1] || 0) / 60 // 分:秒
        } else if (parts.length === 3) {
          return (parts[0] || 0) * 60 + (parts[1] || 0) + (parts[2] || 0) / 60 // 时:分:秒
        }
      }
      
      // 如果没有时长信息，根据文件大小粗略估算（1MB ≈ 1分钟音频）
      const file = files.find(f => f.name === currentTask.filename)
      const fileSizeMB = file ? file.size / (1024 * 1024) : 10
      return fileSizeMB * 1.0 // 假设1MB ≈ 1分钟音频
    }
    
    const audioDurationMinutes = getAudioDurationMinutes()
    
    // 根据不同引擎的转录速度比例（相对于音频实际时长）
    const engineSpeedRatio = {
      'faster-whisper': 0.5,  // 转录时间 = 音频时长 × 0.5（比音频快2倍）
      'whisper-cpp': 1.0,     // 转录时间 = 音频时长 × 1.0（与音频等长）
      'openai': 0.3           // 转录时间 = 音频时长 × 0.3（比音频快3倍）
    }
    
    const engine = (currentTask.engine as keyof typeof engineSpeedRatio) || 'faster-whisper'
    const baseMinutes = audioDurationMinutes * engineSpeedRatio[engine]
    
    // 根据当前进度调整剩余时间
    const progress = Math.max(currentTask.progress, 1) // 避免除零
    const totalEstimatedMinutes = Math.max(baseMinutes, 0.5) // 最少30秒
    const remainingProgress = (100 - progress) / 100
    const remainingMinutes = totalEstimatedMinutes * remainingProgress
    
    // 在不同阶段加上额外时间
    let stageExtraTime = 0
    if (currentStageIndex === 4) { // AI摘要阶段
      stageExtraTime += 1 // 额外1分钟
    }
    
    return Math.max(Math.ceil(remainingMinutes + stageExtraTime), 0.5)
  }
  
  const estimatedMinutes = calculateEstimatedMinutes()
  // 🕒 动态显示已用时间，而不是固定的75秒
  const elapsedSeconds = currentTask?.elapsedTime || 0

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6">
      {/* 已选择的文件 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            已选择的文件 ({files.length})
          </h3>
        </div>
        <div className="p-6">
          {files.map((file, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-center space-x-4">
                <div className="text-2xl">🎵</div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">{formatFilename(file.name)}</p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(file.size)} • {file.type}
                  </p>
                </div>
              </div>
              <button
                onClick={() => onRemoveFile(index)}
                className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
              >
                删除
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 实时转录进度 */}
      {currentTask && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">实时转录进度</h3>
              <div className="flex items-center space-x-3">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  正在处理
                </span>
                <div className="flex items-center space-x-3">
                  {onRefresh && (
                    <button
                      onClick={onRefresh}
                      className="text-sm text-blue-500 hover:text-blue-700"
                    >
                      🔄 刷新状态
                    </button>
                  )}
                  {onCancel && (
                    <button
                      onClick={onCancel}
                      className="text-sm text-red-500 hover:text-red-700"
                    >
                      取消处理
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-6">
            {/* 转录进度条 */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700">转录进度</span>
                <span className="text-lg font-bold text-blue-600">{currentTask.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-4 rounded-full transition-all duration-1000 relative overflow-hidden"
                  style={{ width: `${currentTask.progress}%` }}
                >
                  <div className="absolute inset-0 bg-white opacity-20 animate-pulse" />
                </div>
              </div>
            </div>

            {/* 处理步骤 */}
            <div className="mb-8">
              <div className="flex justify-between items-start relative">
                {stages.map((stage, index) => {
                  const status = getStageStatus(index, currentTask.progress)
                  const isCompleted = status === 'completed'
                  const isCurrent = status === 'current'

                  return (
                    <div key={index} className="flex flex-col items-center space-y-3 flex-1 relative">
                      <div
                        className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl border-3 transition-all duration-500 relative z-10 ${
                          isCompleted
                            ? 'bg-green-100 border-green-500 text-green-600'
                            : isCurrent
                            ? 'bg-blue-100 border-blue-500 text-blue-600 ring-4 ring-blue-200 animate-pulse'
                            : 'bg-gray-100 border-gray-300 text-gray-400'
                        }`}
                      >
                        {isCompleted ? '✅' : stage.icon}
                      </div>
                      <div className="text-center">
                        <p
                          className={`text-sm font-medium ${
                            isCompleted || isCurrent ? 'text-gray-900' : 'text-gray-500'
                          }`}
                        >
                          {stage.name}
                        </p>
                        <p className="text-xs text-gray-400 mt-1 max-w-20 leading-tight">
                          {stage.desc}
                        </p>
                      </div>
                    </div>
                  )
                })}
                
                {/* 连接线 - 改为单独的容器 */}
                <div className="absolute top-8 left-0 right-0 flex items-center justify-between px-8 -z-0">
                  {stages.slice(0, -1).map((_, index) => {
                    const isCompleted = getStageStatus(index, currentTask.progress) === 'completed'
                    return (
                      <div 
                        key={index}
                        className={`flex-1 h-0.5 mx-4 transition-colors duration-500 ${
                          isCompleted ? 'bg-green-400' : 'bg-gray-300'
                        }`}
                      />
                    )
                  })}
                </div>
              </div>
            </div>

            {/* 当前阶段信息 */}
            <div className="bg-blue-50 rounded-lg p-6 mb-6 border border-blue-200">
              <div className="flex items-center space-x-4">
                <div className="text-3xl animate-bounce">{stages[currentStageIndex]?.icon || '🎙️'}</div>
                <div>
                  <p className="font-semibold text-blue-900 text-lg">
                    {stages[currentStageIndex]?.name || '语音识别'}进行中...
                  </p>
                  <p className="text-blue-700 mt-1">
                    预计剩余时间: 约 {
                      estimatedMinutes < 1 
                        ? '不到1分钟' 
                        : estimatedMinutes === 1 
                        ? '1分钟' 
                        : `${estimatedMinutes}分钟`
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* 任务详细信息表格 */}
            <div className="bg-gray-50 rounded-lg overflow-hidden">
              <div className="px-6 py-4 bg-gray-100 border-b border-gray-200">
                <h4 className="font-semibold text-gray-900">任务详细信息</h4>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                  <div className="flex">
                    <span className="text-gray-600 w-20">文件名:</span>
                    <span className="font-medium text-gray-900">{formatFilename(currentTask.filename)}</span>
                  </div>
                  <div className="flex">
                    <span className="text-gray-600 w-20">开始时间:</span>
                    <span className="font-medium text-gray-900">
                      {formatDateTime(currentTask.createdAt)}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="text-gray-600 w-20">任务ID:</span>
                    <span className="font-mono text-xs text-gray-700">{currentTask.id}</span>
                  </div>
                  <div className="flex">
                    <span className="text-gray-600 w-20">转录引擎:</span>
                    <span className="font-medium text-green-600">
                      {currentTask.engine ? getEngineDisplayName(currentTask.engine as any) : '本地 Whisper'}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="text-gray-600 w-20">音频时长:</span>
                    <span className="font-medium text-gray-900">{formatDuration(currentTask.duration)}</span>
                  </div>
                  <div className="flex">
                    <span className="text-gray-600 w-20">已用时间:</span>
                    <span className="font-medium text-gray-900">
                      {elapsedSeconds >= 60 
                        ? `${Math.floor(elapsedSeconds / 60)}分${elapsedSeconds % 60}秒`
                        : `${elapsedSeconds}秒`
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 使用提示 */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
        <div className="flex items-start space-x-4">
          <div className="text-2xl">💡</div>
          <div>
            <h4 className="font-semibold text-blue-900 mb-3">使用提示</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-blue-800">
              <div className="flex items-center space-x-2">
                <span className="text-blue-600">•</span>
                <span>支持批量处理多个音频文件</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-blue-600">•</span>
                <span>自动识别中英文混合语音</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-blue-600">•</span>
                <span>支持导出SRT、VTT、TXT格式</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TranscriptionProgress