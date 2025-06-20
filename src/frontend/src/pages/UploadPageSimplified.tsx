import { useState, useRef } from 'react'
import TranscriptionDetail from '../components/TranscriptionDetail'
import type { TranscriptionTask } from '../components/TranscriptionDetail'

const UploadPageSimplified = () => {
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [currentTask, setCurrentTask] = useState<TranscriptionTask | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      ['mp3', 'wav', 'm4a', 'webm', 'ogg', 'flac', 'aiff'].some(ext => 
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
    
    const file = selectedFiles[0]
    setIsUploading(true)
    setUploadProgress(0)
    
    try {
      const formData = new FormData()
      formData.append('audio', file)
      
      const response = await fetch('http://localhost:3002/api/transcribe', {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) {
        throw new Error(`上传失败: ${response.statusText}`)
      }
      
      const result = await response.json()
      console.log('上传成功:', result)
      
      setCurrentTask({
        id: result.taskId,
        status: 'pending',
        filename: file.name,
        progress: 0,
        createdAt: new Date().toISOString(),
      })
      
      pollTranscriptionStatus(result.taskId)
      
    } catch (error) {
      console.error('上传失败:', error)
      alert(`上传失败: ${error instanceof Error ? error.message : '未知错误'}`)
      setIsUploading(false)
      setUploadProgress(null)
    }
  }
  
  const pollTranscriptionStatus = async (taskId: string) => {
    let attempts = 0
    const maxAttempts = 120 // 最多轮询2分钟
    
    const poll = async () => {
      try {
        const response = await fetch(`http://localhost:3002/api/transcribe/${taskId}`)
        
        if (!response.ok) {
          throw new Error('获取任务状态失败')
        }
        
        const task: TranscriptionTask = await response.json()
        setCurrentTask(task)
        
        if (task.status === 'processing') {
          setUploadProgress(task.progress)
        }
        
        if (task.status === 'completed') {
          setUploadProgress(100)
          setIsUploading(false)
          setSelectedFiles([])
          
          // 如果转录完成但还没有摘要，继续轮询等待AI摘要
          if (!task.summary) {
            console.log('🤖 转录完成，等待AI摘要生成...')
            setTimeout(poll, 2000)
            return
          }
          return
        }
        
        if (task.status === 'error') {
          alert(`转录失败: ${task.error || '未知错误'}`)
          setIsUploading(false)
          setUploadProgress(null)
          return
        }
        
        attempts++
        if (attempts < maxAttempts) {
          setTimeout(poll, 1000)
        } else {
          alert('转录超时，请稍后手动刷新页面查看结果')
          setIsUploading(false)
          setUploadProgress(null)
        }
        
      } catch (error) {
        console.error('轮询状态失败:', error)
        attempts++
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000)
        } else {
          alert('无法获取转录状态，请稍后手动刷新页面')
          setIsUploading(false)
          setUploadProgress(null)
        }
      }
    }
    
    setTimeout(poll, 1000)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 页面头部 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">🎙️ 音频转录上传</h1>
          <p className="text-gray-600">支持多种音频格式，本地AI处理，快速生成转录文本和智能摘要</p>
        </div>

        {/* 文件上传区域 */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-8">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragOver
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="space-y-4">
              <div className="text-4xl">🎵</div>
              <div>
                <p className="text-lg font-medium text-gray-900">
                  拖拽音频文件到此处，或点击选择文件
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  支持 MP3、WAV、M4A、WEBM、OGG、FLAC、AIFF 格式
                </p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                📁 选择音频文件
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg,.flac,.aiff"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>

          {/* 已选择的文件列表 */}
          {selectedFiles.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">已选择的文件</h3>
              <div className="space-y-3">
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">🎵</div>
                      <div>
                        <p className="font-medium text-gray-900">{file.name}</p>
                        <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className="text-red-600 hover:text-red-800 p-2"
                    >
                      ❌
                    </button>
                  </div>
                ))}
              </div>

              {/* 上传按钮 */}
              <div className="mt-6 text-center">
                <button
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="inline-flex items-center px-8 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
                >
                  {isUploading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      处理中...
                    </>
                  ) : (
                    <>🚀 开始转录</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 转录进度显示 */}
        {currentTask && currentTask.status === 'processing' && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">🎙️ 转录处理中</h3>
              <p className="text-gray-600 mb-4">文件：{currentTask.filename}</p>
              
              <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                <div 
                  className="h-3 rounded-full bg-blue-600 transition-all duration-500"
                  style={{ width: `${currentTask.progress}%` }}
                ></div>
              </div>
              
              <p className="text-sm text-gray-500">
                进度：{Math.round(currentTask.progress)}%
              </p>
            </div>
          </div>
        )}

        {/* 转录结果显示 - 使用新的专业组件 */}
        {currentTask && currentTask.status === 'completed' && currentTask.result && (
          <div className="mb-8">
            <TranscriptionDetail
              task={currentTask}
              audioUrl={`http://localhost:3002/uploads/${currentTask.filename}`}
              onRefresh={() => {
                if (currentTask.id) {
                  pollTranscriptionStatus(currentTask.id)
                }
              }}
            />
            
            {/* 清除结果按钮 */}
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => {
                  setCurrentTask(null)
                }}
                className="inline-flex items-center px-6 py-3 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
                开始新的转录任务
              </button>
            </div>
          </div>
        )}

        {/* 错误状态显示 */}
        {currentTask && currentTask.status === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
            <div className="flex items-center">
              <div className="text-red-400 text-2xl mr-3">❌</div>
              <div>
                <h3 className="text-lg font-medium text-red-800">转录失败</h3>
                <p className="text-red-700 mt-1">{currentTask.error || '未知错误'}</p>
                <button
                  onClick={() => setCurrentTask(null)}
                  className="mt-3 inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
                >
                  重新开始
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 帮助信息 */}
        <div className="bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">✨ 功能特色</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-blue-800">
            <div className="space-y-2">
              <p>🎵 <strong>专业音频播放器</strong> - 支持时间戳跳转</p>
              <p>📝 <strong>可编辑转录文本</strong> - 支持实时修改</p>
              <p>🤖 <strong>多AI摘要生成</strong> - Ollama + OpenAI + Claude</p>
            </div>
            <div className="space-y-2">
              <p>⚡ <strong>本地处理</strong> - 数据安全，响应快速</p>
              <p>📋 <strong>一键复制导出</strong> - 支持Markdown格式</p>
              <p>🎯 <strong>词级时间戳</strong> - 精确到每个词语</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UploadPageSimplified 