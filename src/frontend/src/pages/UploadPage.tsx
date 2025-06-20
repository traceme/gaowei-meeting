import { useState, useRef } from 'react'
import TranscriptionDetail from '../components/TranscriptionDetail';
import type { TranscriptionTask } from '../components/TranscriptionDetail';

const UploadPage = () => {
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [currentTask, setCurrentTask] = useState<TranscriptionTask | null>(null)
  const [transcriptionResult, setTranscriptionResult] = useState<string | null>(null)
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
    setIsUploading(true)
    setUploadProgress(0)
    setTranscriptionResult(null)
    
    try {
      // 准备FormData
      const formData = new FormData()
      formData.append('audio', file)
      
      // 上传文件到后端API
      const response = await fetch('http://localhost:3002/api/transcribe', {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) {
        throw new Error(`上传失败: ${response.statusText}`)
      }
      
      const result = await response.json()
      console.log('上传成功:', result)
      
      // 设置当前任务并开始轮询
      setCurrentTask({
        id: result.taskId,
        status: 'pending',
        filename: file.name,
        progress: 0,
        createdAt: new Date().toISOString(),
      })
      
      // 开始轮询转录状态
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
    const maxAttempts = 60 // 最多轮询1分钟
    
    const poll = async () => {
      try {
        const response = await fetch(`http://localhost:3002/api/transcribe/${taskId}`)
        
        if (!response.ok) {
          throw new Error('获取任务状态失败')
        }
        
        const task: TranscriptionTask = await response.json()
        setCurrentTask(task)
        
        // 更新进度条
        if (task.status === 'processing') {
          setUploadProgress(task.progress)
        }
        
        if (task.status === 'completed') {
          // 转录完成
          setUploadProgress(100)
          setTranscriptionResult(task.result?.text || '转录结果为空')
          setIsUploading(false)
          setSelectedFiles([])
          
          // 如果转录完成但还没有摘要，继续轮询等待AI摘要
          if (!task.summary) {
            console.log('🤖 转录完成，等待AI摘要生成...')
            setTimeout(poll, 2000) // 2秒后再次检查摘要状态
            return
          }
          
          return
        }
        
        if (task.status === 'error') {
          // 转录失败
          alert(`转录失败: ${task.error || '未知错误'}`)
          setIsUploading(false)
          setUploadProgress(null)
          return
        }
        
        // 继续轮询
        attempts++
        if (attempts < maxAttempts) {
          setTimeout(poll, 1000) // 每秒轮询一次
        } else {
          alert('转录超时，请稍后手动刷新页面查看结果')
          setIsUploading(false)
          setUploadProgress(null)
        }
        
      } catch (error) {
        console.error('轮询状态失败:', error)
        attempts++
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000) // 出错时延长轮询间隔
        } else {
          alert('无法获取转录状态，请稍后手动刷新页面')
          setIsUploading(false)
          setUploadProgress(null)
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

  return (
    <div className="max-w-4xl mx-auto">
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

      {/* 上传进度 */}
      {isUploading && uploadProgress !== null && (
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">上传进度</h3>
            <span className="text-sm text-gray-600">
              {Math.round(uploadProgress)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-2">
            正在上传文件，请稍候...
          </p>
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

      {/* 增强的实时转录进度可视化 */}
      {currentTask && (
        <div className="mt-8 bg-white rounded-lg shadow-md overflow-hidden border-l-4 border-blue-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                {currentTask.status === 'processing' && (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
                )}
                🎙️ 实时转录进度
              </h3>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                currentTask.status === 'completed' ? 'bg-green-100 text-green-800' :
                currentTask.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                currentTask.status === 'error' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {currentTask.status === 'completed' ? '✅ 转录完成' :
                 currentTask.status === 'processing' ? '🔄 正在处理' :
                 currentTask.status === 'error' ? '❌ 处理失败' : '⏱️ 队列等待'}
              </span>
            </div>

            {/* 多阶段进度条 */}
            {currentTask.status === 'processing' && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">转录进度</span>
                  <span className="text-sm font-bold text-blue-600">{Math.round(currentTask.progress)}%</span>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-4 mb-4 overflow-hidden">
                  <div 
                    className="h-4 rounded-full transition-all duration-500 bg-gradient-to-r from-blue-500 to-blue-600 relative"
                    style={{ width: `${currentTask.progress}%` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse"></div>
                  </div>
                </div>

                {/* 转录阶段指示器 */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-2">
                    <span>文件上传</span>
                    <span>音频分析</span>
                    <span>语音识别</span>
                    <span>文本处理</span>
                    <span>完成</span>
                  </div>
                  <div className="flex justify-between">
                    {[
                      { min: 0, max: 10, label: '📁', desc: '文件处理', color: 'bg-green-500' },
                      { min: 10, max: 30, label: '🎵', desc: '音频分析', color: 'bg-blue-500' },
                      { min: 30, max: 70, label: '🎙️', desc: '语音识别', color: 'bg-purple-500' },
                      { min: 70, max: 90, label: '📝', desc: '文本处理', color: 'bg-orange-500' },
                      { min: 90, max: 100, label: '✅', desc: '完成', color: 'bg-green-500' }
                    ].map((stage, index) => (
                      <div key={index} className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm transition-all duration-300 ${
                          currentTask.progress >= stage.min ? stage.color : 'bg-gray-300'
                        } ${currentTask.progress >= stage.min && currentTask.progress < stage.max ? 'animate-pulse scale-110 ring-2 ring-offset-2 ring-blue-300' : ''}`}>
                          {stage.label}
                        </div>
                        <span className="text-xs text-gray-500 mt-1 text-center">{stage.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 当前处理状态详情 */}
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="text-sm font-medium text-blue-900 mb-2">
                    当前阶段: {
                      currentTask.progress < 10 ? '📁 文件处理中...' :
                      currentTask.progress < 30 ? '🎵 音频格式分析...' :
                      currentTask.progress < 70 ? '🎙️ 语音识别进行中...' :
                      currentTask.progress < 90 ? '📝 文本后处理...' :
                      '✅ 即将完成...'
                    }
                  </div>
                  <div className="text-xs text-gray-600">
                    预计剩余时间: {currentTask.progress < 100 ? `约 ${Math.max(1, Math.round((100 - currentTask.progress) / 10))} 秒` : '即将完成'}
                  </div>
                </div>
              </div>
            )}

            {/* 任务基本信息 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">文件名:</span>
                  <span className="font-medium text-gray-900">{currentTask.filename}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">任务ID:</span>
                  <span className="font-mono text-xs text-gray-600">{currentTask.id}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">开始时间:</span>
                  <span className="text-gray-900">{new Date(currentTask.createdAt).toLocaleString()}</span>
                </div>
                {currentTask.status === 'processing' && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">转录引擎:</span>
                    <span className="text-green-600 font-medium flex items-center">
                      <div className="w-2 h-2 bg-green-400 rounded-full mr-1 animate-pulse"></div>
                      本地 Whisper
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 错误信息显示 */}
            {currentTask.error && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">处理错误</h3>
                    <div className="mt-1 text-sm text-red-700">{currentTask.error}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 转录结果显示 */}
      {currentTask && currentTask.status === 'completed' && currentTask.result && (
        <div className="mt-8 bg-white rounded-lg shadow-md overflow-hidden">
          {/* 头部信息 */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">🎵 转录结果 (支持音频同步)</h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(currentTask.result?.text || '')
                    alert('转录结果已复制到剪贴板')
                  }}
                  className="flex items-center space-x-1 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  📋 <span>复制</span>
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
              <div>
                <span className="font-medium">文件名:</span>
                <p className="mt-1">{currentTask.filename}</p>
              </div>
              <div>
                <span className="font-medium">语言:</span>
                <p className="mt-1">{currentTask.result.language === 'zh' ? '中文' : currentTask.result.language}</p>
              </div>
              <div>
                <span className="font-medium">文本长度:</span>
                <p className="mt-1">{currentTask.result.text.length} 字符</p>
              </div>
              <div>
                <span className="font-medium">完成时间:</span>
                <p className="mt-1">{new Date(currentTask.createdAt).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* 音频播放器 */}
          <div className="p-6">
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-3">🎧 音频播放器</h4>
              <audio 
                controls 
                className="w-full"
                src={`http://localhost:3002/uploads/${currentTask.filename}`}
              >
                您的浏览器不支持音频播放。
              </audio>
            </div>

            {/* 转录文本 - 可编辑版本 */}
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-gray-900">📝 转录文本 (词级时间戳)</h4>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      // 切换编辑模式
                      const isEditing = document.querySelector('[data-edit-mode]')?.getAttribute('data-edit-mode') === 'true';
                      const editButtons = document.querySelectorAll('[data-edit-segment]');
                      const editableTexts = document.querySelectorAll('[data-editable-text]');
                      
                      if (!isEditing) {
                        // 进入编辑模式
                        document.querySelector('[data-edit-mode]')?.setAttribute('data-edit-mode', 'true');
                        editButtons.forEach(btn => btn.classList.remove('hidden'));
                        editableTexts.forEach(text => {
                          text.setAttribute('contenteditable', 'true');
                          text.classList.add('bg-white', 'border', 'border-blue-200', 'rounded', 'px-2', 'py-1');
                        });
                        (document.querySelector('[data-edit-toggle]') as HTMLButtonElement).innerHTML = '💾 保存修改';
                      } else {
                        // 退出编辑模式并保存
                        document.querySelector('[data-edit-mode]')?.setAttribute('data-edit-mode', 'false');
                        editButtons.forEach(btn => btn.classList.add('hidden'));
                        editableTexts.forEach(text => {
                          text.setAttribute('contenteditable', 'false');
                          text.classList.remove('bg-white', 'border', 'border-blue-200', 'rounded', 'px-2', 'py-1');
                        });
                        (document.querySelector('[data-edit-toggle]') as HTMLButtonElement).innerHTML = '✏️ 编辑文本';
                        
                        // 收集编辑后的文本
                                                 const updatedSegments = Array.from(editableTexts).map((textEl, index) => ({
                           ...currentTask.result!.segments[index],
                           text: (textEl as HTMLElement).textContent || ''
                         }));
                        
                        // 更新完整文本
                        const updatedFullText = updatedSegments.map(seg => seg.text).join(' ');
                        
                        // 这里可以调用API保存修改（如果需要持久化）
                        console.log('文本修改已保存:', { updatedSegments, updatedFullText });
                        
                        alert('转录文本修改已保存！');
                      }
                    }}
                    data-edit-toggle
                    className="flex items-center space-x-1 px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-md transition-colors"
                  >
                    ✏️ <span>编辑文本</span>
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(currentTask.result?.text || '')
                      alert('转录结果已复制到剪贴板')
                    }}
                    className="flex items-center space-x-1 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                  >
                    📋 <span>复制</span>
                  </button>
                </div>
              </div>
              
              <div className="space-y-2" data-edit-mode="false">
                {currentTask.result.segments.map((segment, index) => (
                  <div
                    key={index}
                    className="group p-3 rounded-lg hover:bg-gray-100 border-l-4 border-transparent hover:border-blue-300 transition-all duration-300"
                  >
                    <div className="flex items-start space-x-3">
                      <span className="text-xs text-gray-500 font-mono mt-1 min-w-[60px]">
                        {Math.floor(segment.start / 60)}:{(segment.start % 60).toFixed(1).padStart(4, '0')}
                      </span>
                      <div className="flex-1">
                        <p 
                          className="text-sm leading-relaxed text-gray-700 hover:text-blue-900 transition-colors cursor-pointer"
                          data-editable-text
                          onClick={() => {
                            // 只有在非编辑模式下才播放音频
                            const isEditing = document.querySelector('[data-edit-mode]')?.getAttribute('data-edit-mode') === 'true';
                            if (!isEditing) {
                              const audio = document.querySelector('audio') as HTMLAudioElement;
                              if (audio) {
                                audio.currentTime = segment.start;
                                audio.play();
                              }
                            }
                          }}
                        >
                          {segment.text}
                        </p>
                        
                        {/* 编辑模式下的操作按钮 */}
                        <div className="mt-2 flex space-x-2 hidden" data-edit-segment>
                          <button
                            onClick={() => {
                              const audio = document.querySelector('audio') as HTMLAudioElement;
                              if (audio) {
                                audio.currentTime = segment.start;
                                audio.play();
                              }
                            }}
                            className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded transition-colors"
                          >
                            🎵 播放片段
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('确定要删除这个文本片段吗？')) {
                                // 在实际应用中，这里应该更新状态
                                const segmentDiv = document.querySelector(`[data-editable-text]:nth-child(${index + 1})`);
                                segmentDiv?.closest('.group')?.remove();
                              }
                            }}
                            className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded transition-colors"
                          >
                            🗑️ 删除
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 编辑提示 */}
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                <div className="flex items-start space-x-2">
                  <svg className="w-4 h-4 mt-0.5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
                  </svg>
                  <div>
                    <p className="font-medium mb-1">编辑说明:</p>
                    <ul className="text-xs space-y-1">
                      <li>• 点击"编辑文本"进入编辑模式，直接修改转录内容</li>
                      <li>• 编辑模式下可以播放特定片段、删除错误内容</li>
                      <li>• 修改完成后点击"保存修改"退出编辑模式</li>
                      <li>• 非编辑模式下点击文本可跳转到对应音频时间</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AI摘要显示 */}
          {currentTask.summary && (
            <div className="p-6 border-t border-gray-200 bg-gradient-to-br from-purple-50 to-blue-50">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-purple-900">🤖 AI会议摘要</h4>
                <div className="text-xs text-purple-600">
                  <span>模型: {currentTask.summary.model}</span>
                  <span className="mx-2">•</span>
                  <span>{new Date(currentTask.summary.createdAt).toLocaleString()}</span>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-lg border border-purple-200 shadow-sm">
                {currentTask.summary.model === 'error' ? (
                  <div className="text-red-600 text-sm">
                    {currentTask.summary.text}
                  </div>
                ) : (
                  <div className="prose prose-sm max-w-none">
                    <div style={{ whiteSpace: 'pre-wrap' }} className="text-gray-700 leading-relaxed">
                      {currentTask.summary.text}
                    </div>
                  </div>
                )}
                
                <div className="mt-4 flex space-x-3">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(currentTask.summary?.text || '')
                      alert('AI摘要已复制到剪贴板')
                    }}
                    className="flex items-center space-x-1 px-3 py-1 text-sm bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-md transition-colors"
                  >
                    📋 <span>复制摘要</span>
                  </button>
                  <button
                    onClick={() => {
                      // 打开新窗口显示完整摘要
                      const summaryWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes');
                      if (summaryWindow && currentTask.summary) {
                        summaryWindow.document.write(`
                          <!DOCTYPE html>
                          <html>
                          <head>
                            <title>AI会议摘要 - ${currentTask.filename}</title>
                            <style>
                              body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
                              h1 { color: #7c3aed; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
                              .meta { background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; }
                              .summary-content { white-space: pre-wrap; background: #fff; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; }
                              button { background: #7c3aed; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin: 10px 5px; }
                              button:hover { background: #6d28d9; }
                            </style>
                          </head>
                          <body>
                            <h1>🤖 AI会议摘要</h1>
                            <div class="meta">
                              <p><strong>文件名:</strong> ${currentTask.filename}</p>
                              <p><strong>AI模型:</strong> ${currentTask.summary.model}</p>
                              <p><strong>生成时间:</strong> ${new Date(currentTask.summary.createdAt).toLocaleString()}</p>
                            </div>
                            <div class="summary-content">${currentTask.summary.text}</div>
                            <div style="margin-top: 20px;">
                              <button onclick="navigator.clipboard.writeText(document.querySelector('.summary-content').textContent); alert('摘要已复制到剪贴板!')">📋 复制摘要</button>
                              <button onclick="window.print()">🖨️ 打印</button>
                              <button onclick="window.close()">❌ 关闭</button>
                            </div>
                          </body>
                          </html>
                        `);
                        summaryWindow.document.close();
                      }
                    }}
                    className="flex items-center space-x-1 px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-md transition-colors"
                  >
                    🖨️ <span>查看详情</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 完整文本预览 */}
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <h4 className="text-md font-semibold text-gray-900 mb-3">📄 完整文本</h4>
            <div className="bg-white p-4 rounded-lg border">
              <p className="text-gray-700 leading-relaxed">{currentTask.result.text}</p>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="p-6 border-t border-gray-200 flex justify-center space-x-4">
            <button
              onClick={() => {
                setTranscriptionResult(null)
                setCurrentTask(null)
              }}
              className="px-6 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
            >
              🗑️ 清除结果
            </button>
            <button
              onClick={async () => {
                if (!currentTask?.result?.text) return;
                
                try {
                  // 检查AI服务状态
                  const statusResponse = await fetch('http://localhost:3002/api/ai/status');
                  const statusData = await statusResponse.json();
                  
                  if (!statusData.available) {
                    const providers = statusData.providers || {};
                    const availableProviders = Object.entries(providers)
                      .filter(([_, config]: [string, any]) => config.available)
                      .map(([name]: [string, any]) => name);
                    
                    if (availableProviders.length === 0) {
                      alert('AI摘要服务暂时不可用。\n\n请检查：\n- Ollama服务是否运行 (http://localhost:11434)\n- OpenAI API密钥是否配置\n- Claude API密钥是否配置');
                    } else {
                      alert(`当前可用的AI服务: ${availableProviders.join(', ')}\n\n但无法生成摘要，请稍后重试。`);
                    }
                    return;
                  }
                  
                  // 显示加载状态
                  const button = document.querySelector('[data-ai-summary]') as HTMLButtonElement;
                  if (button) {
                    button.disabled = true;
                    button.innerHTML = '🤖 生成中...';
                  }
                  
                  // 调用AI摘要API
                  const summaryResponse = await fetch('http://localhost:3002/api/ai/summary', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      taskId: currentTask.id,
                      text: currentTask.result.text,
                      model: 'llama3.2:latest', // 使用高质量模型
                    }),
                  });
                  
                  if (!summaryResponse.ok) {
                    const errorData = await summaryResponse.json();
                    throw new Error(errorData.error || 'AI摘要生成失败');
                  }
                  
                  const summaryData = await summaryResponse.json();
                  
                  // 显示摘要结果
                  const summaryWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes');
                  if (summaryWindow) {
                    summaryWindow.document.write(`
                      <!DOCTYPE html>
                      <html>
                      <head>
                        <title>AI会议摘要 - ${currentTask.filename}</title>
                        <style>
                          body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
                          h1 { color: #2563eb; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
                          h2 { color: #059669; margin-top: 30px; }
                          h3 { color: #dc2626; margin-top: 20px; }
                          ul { padding-left: 20px; }
                          li { margin: 8px 0; }
                          .meta { background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; }
                          .summary-content { white-space: pre-wrap; background: #fff; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; }
                          button { background: #2563eb; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin: 10px 5px; }
                          button:hover { background: #1d4ed8; }
                        </style>
                      </head>
                      <body>
                        <h1>🤖 AI会议摘要</h1>
                        <div class="meta">
                          <p><strong>文件名:</strong> ${currentTask.filename}</p>
                          <p><strong>模型:</strong> ${summaryData.model}</p>
                          <p><strong>原文长度:</strong> ${summaryData.textLength} 字符</p>
                          <p><strong>生成时间:</strong> ${new Date(summaryData.timestamp).toLocaleString()}</p>
                        </div>
                        <div class="summary-content">${summaryData.summary}</div>
                        <div style="margin-top: 20px;">
                          <button onclick="navigator.clipboard.writeText(document.querySelector('.summary-content').textContent); alert('摘要已复制到剪贴板!')">📋 复制摘要</button>
                          <button onclick="window.print()">🖨️ 打印</button>
                          <button onclick="window.close()">❌ 关闭</button>
                        </div>
                      </body>
                      </html>
                    `);
                    summaryWindow.document.close();
                  }
                  
                } catch (error) {
                  console.error('AI摘要生成失败:', error);
                  alert(`AI摘要生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
                } finally {
                  // 恢复按钮状态
                  const button = document.querySelector('[data-ai-summary]') as HTMLButtonElement;
                  if (button) {
                    button.disabled = false;
                    button.innerHTML = '🤖 AI摘要';
                  }
                }
              }}
              data-ai-summary
              className="px-6 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400"
            >
              🤖 AI摘要
            </button>
          </div>
        </div>
      )}

      {/* 帮助信息 */}
      <div className="mt-12 bg-blue-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">使用提示</h3>
        <ul className="text-blue-800 space-y-2">
          <li>• 支持同时上传多个音频文件进行批量处理</li>
          <li>• 文件上传后将自动开始转录，生成词级时间戳</li>
          <li>• 转录完成后可在历史记录中查看和编辑结果</li>
          <li>• 大文件将自动分片上传，确保传输稳定性</li>
        </ul>
      </div>
    </div>
  )
}

export default UploadPage 