import { useState, useRef, useEffect } from 'react'
import { VidstackAudioPlayer } from '../components/VidstackAudioPlayer'
import TranscriptionDetail, { type TranscriptionData } from '../components/TranscriptionDetail'
import TranscriptionProgress from '../components/TranscriptionProgress'
import type { WhisperEngineType } from '@gaowei/shared-types'

interface TranscriptionTask {
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
  result?: {
    text: string
    language: string
    duration?: number
    confidence?: number
    segments: Array<{
      start: number
      end: number
      text: string
    }>
  }
  summary?: {
    text: string
    model: string
    createdAt: string
  }
  error?: string
}

const UploadPage = () => {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [currentTask, setCurrentTask] = useState<TranscriptionTask | null>(null)
  const [showProgress, setShowProgress] = useState(false)
  const [currentEngine, setCurrentEngine] = useState<WhisperEngineType>('faster-whisper') // 默认引擎
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 获取当前选择的引擎
  useEffect(() => {
    const fetchCurrentEngine = async () => {
      try {
        const response = await fetch('/api/engine/current')
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.data?.engine) {
            setCurrentEngine(data.data.engine)
            console.log('当前选择的引擎:', data.data.engine)
          }
        }
      } catch (error) {
        console.warn('获取当前引擎失败，使用默认引擎:', error)
      }
    }
    
    fetchCurrentEngine()
  }, [])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    handleFiles(files)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      handleFiles(files)
    }
  }

  const handleFiles = (files: File[]) => {
    const audioFiles = files.filter(file => 
      file.type.startsWith('audio/') || 
      ['mp3', 'wav', 'm4a', 'webm', 'ogg', 'flac'].some(ext => 
        file.name.toLowerCase().endsWith(`.${ext}`)
      )
    )
    setSelectedFiles(prev => [...prev, ...audioFiles])
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return
    
    const file = selectedFiles[0] // 目前只处理第一个文件
    if (!file) return // 确保文件存在
    
    console.log('🚀 开始上传文件:', file.name, file.size, 'bytes')
    console.log('🔧 使用引擎:', currentEngine)
    
    setIsUploading(true)
    setShowProgress(true)
    
    try {
      // 准备FormData
      const formData = new FormData()
      formData.append('file', file)
      formData.append('language', 'zh-cn') // 明确指定使用简体中文
      
      console.log('📤 发送上传请求到 /api/transcription/upload (language: zh-cn)')
      
      // 上传文件到后端API
      const response = await fetch('/api/transcription/upload', {
        method: 'POST',
        body: formData,
      })
      
      console.log('📨 收到响应:', response.status, response.statusText)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ 上传响应错误:', errorText)
        throw new Error(`上传失败 (${response.status}): ${response.statusText}`)
      }
      
      const result = await response.json()
      console.log('✅ 上传成功，响应数据:', result)
      
      // 检查响应数据结构
      const taskId = result.data?.taskId || result.taskId
      if (!taskId) {
        console.error('❌ 响应中缺少 taskId:', result)
        throw new Error('服务器响应格式错误：缺少任务ID')
      }
      
      // 设置当前任务并开始轮询，包含引擎信息
      setCurrentTask({
        id: taskId,
        status: 'pending',
        filename: file.name,
        progress: 0,
        createdAt: new Date().toISOString(),
        engine: currentEngine, // 包含当前选择的引擎
      })
      
      console.log('🔄 开始轮询转录状态, taskId:', taskId)
      
      // 开始轮询转录状态
      pollTranscriptionStatus(taskId)
      
    } catch (error) {
      console.error('❌ 上传失败:', error)
      alert(`上传失败: ${error instanceof Error ? error.message : '未知错误'}`)
      setIsUploading(false)
      setShowProgress(false)
    }
  }
  
  const pollTranscriptionStatus = async (taskId: string) => {
    let attempts = 0
    const maxAttempts = 18000 // 最多轮询300分钟（18000秒）
    
    console.log(`🔄 开始轮询任务状态: ${taskId}`)
    
    const poll = async () => {
      try {
        console.log(`📊 轮询尝试 ${attempts + 1}/${maxAttempts}: /api/transcription/${taskId}`)
        
        const response = await fetch(`/api/transcription/${taskId}`)
        
        console.log(`📨 轮询响应:`, response.status, response.statusText)
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error(`❌ 轮询错误响应:`, errorText)
          throw new Error(`获取任务状态失败 (${response.status}): ${response.statusText}`)
        }
        
        const result = await response.json()
        console.log(`📋 轮询结果:`, result)
        
        // 检查响应数据结构
        const task = result.data?.task || result.task || result
        if (!task) {
          console.error('❌ 响应中缺少 task 数据:', result)
          throw new Error('服务器响应格式错误：缺少任务数据')
        }
        
        console.log(`📈 任务状态: ${task.status}, 进度: ${task.progress}%`)
        
        // 更新任务状态，保留引擎信息
        setCurrentTask(prevTask => ({
          ...task,
          engine: prevTask?.engine || currentEngine // 保留之前的引擎信息或使用当前引擎
        }))
        
        // 更新进度条
        if (task.status === 'processing') {
          setShowProgress(true)
        }
        
        if (task.status === 'completed') {
          // 转录完成，自动生成AI摘要
          console.log('✅ 转录完成，开始生成AI摘要...')
          
          if (task.result?.text) {
            try {
              setCurrentTask(prev => prev ? { 
                ...prev, 
                currentStage: 'AI摘要生成中...',
                progress: 90, // 设置为90%，表示进入AI摘要阶段
                engine: prev.engine || currentEngine // 确保引擎信息被保留
              } : prev)
              
              // 调用AI摘要API
              const summaryResponse = await fetch('/api/summary', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  text: task.result.text,
                  model: 'default' // 使用默认模型
                })
              })
              
              if (summaryResponse.ok) {
                const summaryResult = await summaryResponse.json()
                console.log('🤖 AI摘要生成成功:', summaryResult)
                
                // 更新任务，添加摘要并完成进度
                setCurrentTask(prev => prev ? {
                  ...prev,
                  progress: 100, // 完成所有处理
                  engine: prev.engine || currentEngine, // 确保引擎信息被保留
                  summary: {
                    text: summaryResult.data.summary.summary || summaryResult.summary?.summary,
                    model: summaryResult.data.summary.model || 'default',
                    createdAt: new Date().toISOString()
                  }
                } : prev)
              } else {
                console.warn('⚠️ AI摘要生成失败，但转录成功')
              }
            } catch (error) {
              console.error('❌ AI摘要生成错误:', error)
            }
          }
          
          setShowProgress(false)
          console.log('✅ 处理完成，显示结果')
          return
        }
        
        if (task.status === 'error') {
          // 转录失败
          alert(`转录失败: ${task.error || '未知错误'}`)
          setIsUploading(false)
          setShowProgress(false)
          return
        }
        
        // 继续轮询
        attempts++
        if (attempts < maxAttempts) {
          setTimeout(poll, 1000) // 每秒轮询一次
        } else {
          alert('转录超时（300分钟），请稍后手动刷新页面查看结果')
          setIsUploading(false)
          setShowProgress(false)
        }
        
      } catch (error) {
        console.error('轮询状态失败:', error)
        attempts++
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000) // 出错时延长轮询间隔
        } else {
          alert('无法获取转录状态，请稍后手动刷新页面')
          setIsUploading(false)
          setShowProgress(false)
        }
      }
    }
    
    // 开始轮询
    setTimeout(poll, 1000)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleCancelProcessing = () => {
    setIsUploading(false)
    setShowProgress(false)
    setCurrentTask(null)
  }

  const handleRefreshStatus = async () => {
    if (!currentTask) return
    
    try {
      console.log('🔄 手动刷新任务状态:', currentTask.id)
      const response = await fetch(`/api/transcription/${currentTask.id}`)
      
      if (!response.ok) {
        throw new Error(`获取任务状态失败 (${response.status})`)
      }
      
      const result = await response.json()
      const task = result.data?.task || result.task || result
      
      if (task) {
        setCurrentTask(task)
        
        if (task.status === 'completed') {
          // 检查是否需要生成AI摘要
          if (task.result?.text && !task.summary) {
            console.log('🤖 检测到转录完成但缺少AI摘要，自动生成...')
            
            try {
              setCurrentTask(prev => prev ? { 
                ...prev, 
                currentStage: 'AI摘要生成中...',
                progress: 90
              } : prev)
              
              const summaryResponse = await fetch('/api/summary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  text: task.result.text,
                  model: 'default'
                })
              })
              
              if (summaryResponse.ok) {
                const summaryResult = await summaryResponse.json()
                setCurrentTask(prev => prev ? {
                  ...prev,
                  progress: 100,
                  summary: {
                    text: summaryResult.data.summary.summary || summaryResult.summary?.summary,
                    model: summaryResult.data.summary.model || 'default',
                    createdAt: new Date().toISOString()
                  }
                } : prev)
                console.log('✅ AI摘要补充完成')
              }
            } catch (error) {
              console.warn('⚠️ 补充AI摘要失败:', error)
            }
          }
          
          setShowProgress(false)
          console.log('✅ 转录已完成')
        } else if (task.status === 'error') {
          alert(`转录失败: ${task.error || '未知错误'}`)
          setIsUploading(false)
          setShowProgress(false)
        }
      }
    } catch (error) {
      console.error('❌ 手动刷新失败:', error)
      alert(`刷新失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  // 如果正在显示进度，只显示转录进度组件
  if (showProgress && currentTask) {
    return (
      <TranscriptionProgress
        files={selectedFiles.map(file => ({
          name: file.name,
          size: file.size,
          type: file.type || '音频文件'
        }))}
        currentTask={currentTask}
        onRemoveFile={removeFile}
        onCancel={handleCancelProcessing}
        onRefresh={handleRefreshStatus}
      />
    )
  }

  // 如果显示转录结果，直接渲染TranscriptionDetail（不受上传页面容器约束）
  if (currentTask && currentTask.status === 'completed' && currentTask.result) {
    // 将转录数据转换为TranscriptionData格式
    const transcriptionData: TranscriptionData = {
      id: currentTask.id,
      filename: currentTask.filename,
      status: 'completed',
      text: currentTask.result.text,
      segments: currentTask.result.segments?.map((seg: any) => ({
        start: seg.start || seg.t0 || 0,
        end: seg.end || seg.t1 || 0,
        text: seg.text
      })) || [],
      audioUrl: selectedFiles[0] ? URL.createObjectURL(selectedFiles[0]) : undefined,
      createdAt: currentTask.createdAt,
      duration: currentTask.result.duration || undefined,
      language: currentTask.result.language,
      confidence: currentTask.result.confidence || undefined,
      summary: currentTask.summary?.text || undefined,
    };

    return (
      <TranscriptionDetail
        transcription={transcriptionData}
        onBack={() => {
          setCurrentTask(null)
          setSelectedFiles([])
          setShowProgress(false)
          // 清理URL对象
          if (transcriptionData.audioUrl) {
            URL.revokeObjectURL(transcriptionData.audioUrl)
          }
        }}
        onDelete={() => {
          setCurrentTask(null)
          setSelectedFiles([])
          setShowProgress(false)
          // 清理URL对象
          if (transcriptionData.audioUrl) {
            URL.revokeObjectURL(transcriptionData.audioUrl)
          }
        }}
        onExport={(id, format) => {
          // 导出功能实现
          console.log(`导出转录结果: ${id}, 格式: ${format}`)
          
          let content = '';
          let filename = `${transcriptionData.filename}_transcription`;
          let mimeType = 'text/plain';

          switch (format) {
            case 'txt':
              content = transcriptionData.text || '';
              filename += '.txt';
              break;
            case 'json':
              content = JSON.stringify(transcriptionData, null, 2);
              filename += '.json';
              mimeType = 'application/json';
              break;
            case 'srt':
              // 生成SRT字幕格式
              content = transcriptionData.segments?.map((seg, index) => {
                const formatSRTTime = (seconds: number) => {
                  const hours = Math.floor(seconds / 3600);
                  const minutes = Math.floor((seconds % 3600) / 60);
                  const secs = Math.floor(seconds % 60);
                  const ms = Math.floor((seconds % 1) * 1000);
                  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
                };
                return `${index + 1}\n${formatSRTTime(seg.start)} --> ${formatSRTTime(seg.end)}\n${seg.text}\n`;
              }).join('\n') || '';
              filename += '.srt';
              break;
            case 'vtt':
              // 生成VTT字幕格式
              const formatVTTTime = (seconds: number) => {
                const hours = Math.floor(seconds / 3600);
                const minutes = Math.floor((seconds % 3600) / 60);
                const secs = seconds % 60;
                return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toFixed(3).padStart(6, '0')}`;
              };
              content = 'WEBVTT\n\n' + (transcriptionData.segments?.map((seg, index) => {
                return `${index + 1}\n${formatVTTTime(seg.start)} --> ${formatVTTTime(seg.end)}\n${seg.text}\n`;
              }).join('\n') || '');
              filename += '.vtt';
              break;
          }

          // 创建并下载文件
          const blob = new Blob([content], { type: mimeType });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">上传音频文件</h1>
        <p className="text-gray-600">
          支持 WAV、MP3、M4A、WebM、OGG、FLAC 格式，单文件最大 500MB
        </p>
      </div>

      {/* 上传区域 */}
      <div
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
          isDragOver
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="text-6xl mb-4">📁</div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          拖拽音频文件到此处上传
        </h3>
        <p className="text-gray-600 mb-6">
          或者点击下方按钮选择文件
        </p>
        <div className="flex justify-center space-x-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            选择文件
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            📋 批量上传
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg,.flac"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* 选中文件列表 */}
      {selectedFiles.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            已选择的文件 ({selectedFiles.length})
          </h3>
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {selectedFiles.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between p-4 border-b border-gray-200 last:border-b-0"
              >
                <div className="flex items-center space-x-3">
                  <div className="text-2xl">🎵</div>
                  <div>
                    <p className="font-medium text-gray-900">{file.name}</p>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(file.size)} • {file.type || '音频文件'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                >
                  ❌
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      {selectedFiles.length > 0 && !isUploading && (
        <div className="mt-8 flex justify-center space-x-4">
          <button
            onClick={handleUpload}
            className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            🚀 开始上传处理
          </button>
          <button
            onClick={() => setSelectedFiles([])}
            className="px-8 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            清空列表
          </button>
        </div>
      )}
    </div>
  )
}

export default UploadPage 