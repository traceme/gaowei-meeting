import React, { useState, useRef } from 'react';

interface AudioUploadProps {
  onAudioUploaded: (transcripts: any[]) => void;
  onUploadStart: () => void;
  onUploadComplete: () => void;
  isProcessing?: boolean;
  language?: string; // 新增语言参数
}

export const AudioUpload: React.FC<AudioUploadProps> = ({
  onAudioUploaded,
  onUploadStart,
  onUploadComplete,
  isProcessing = false,
  language = 'auto' // 默认自动检测
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [isAsyncProcessing, setIsAsyncProcessing] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [statusCheckCount, setStatusCheckCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const checkServerHealth = async (): Promise<boolean> => {
    try {
      const response = await fetch('http://localhost:8178/health', {
        method: 'GET'
      });
      return response.ok;
    } catch (error) {
      console.error('Server health check failed:', error);
      return false;
    }
  };

  const pollTaskStatus = async (taskId: string) => {
    const maxAttempts = 3600; // 60分钟超时 (每秒检查一次)
    let attempts = 0;
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 5;

    setStatusCheckCount(0);

    while (attempts < maxAttempts) {
      try {
        setStatusCheckCount(prev => prev + 1);
        console.log(`Status check #${statusCheckCount + 1} for task ${taskId}`);
        
        const response = await fetch(`http://localhost:8178/status/${taskId}`, {
          method: 'GET'
        });
        
        if (!response.ok) {
          if (response.status === 404) {
            // 任务未找到，可能是服务器重启了
            console.warn(`Task ${taskId} not found on server. Checking server health...`);
            const serverHealthy = await checkServerHealth();
            if (!serverHealthy) {
              throw new Error('Whisper server appears to be down. Please restart the server and try again.');
            }
            throw new Error(`Task ${taskId} not found. The server may have restarted. Please try uploading again.`);
          }
          throw new Error(`Status check failed: ${response.status} ${response.statusText}`);
        }

        const status = await response.json();
        console.log('Task status:', status);

        // 重置连续错误计数
        consecutiveErrors = 0;

        if (status.status === 'processing') {
          const progressMsg = status.progress || 'Processing...';
          const segmentsInfo = status.segments_processed ? ` (${status.segments_processed} segments)` : '';
          setUploadProgress(`${progressMsg}${segmentsInfo}`);
          
          // 根据文件大小调整检查间隔
          const checkInterval = status.file_size_mb > 20 ? 3000 : 1000;
          await new Promise(resolve => setTimeout(resolve, checkInterval));
          attempts++;
          continue;
        } else if (status.status === 'completed') {
          console.log('Processing completed:', status.result);
          
          // 转换结果格式
          let transcripts: any[] = [];
          
          if (status.result && status.result.segments && status.result.segments.length > 0) {
            transcripts = status.result.segments.map((segment: any, index: number) => ({
              id: `uploaded-${Date.now()}-${index}`,
              text: segment.text?.trim() || '',
              timestamp: `${segment.start?.toFixed(1) || 0}s - ${segment.end?.toFixed(1) || 0}s`,
            })).filter((t: any) => t.text.length > 0);
          }

          if (transcripts.length === 0 && status.result && status.result.text?.trim()) {
            transcripts.push({
              id: `uploaded-${Date.now()}`,
              text: status.result.text.trim(),
              timestamp: new Date().toISOString(),
            });
          }

          if (transcripts.length === 0) {
            throw new Error('No transcription text was generated from the audio file');
          }

          console.log(`Successfully processed ${transcripts.length} transcript segments`);
          onAudioUploaded(transcripts);
          setUploadProgress(`Transcription complete! (${transcripts.length} segments)`);
          setIsAsyncProcessing(false);
          setTaskId(null);
          onUploadComplete();
          return;
        } else if (status.status === 'error') {
          throw new Error(status.error || 'Processing failed on server');
        } else {
          console.warn(`Unknown status: ${status.status}`);
          setUploadProgress(`Unknown status: ${status.status}`);
        }
      } catch (error) {
        console.error(`Error checking task status (attempt ${attempts + 1}):`, error);
        consecutiveErrors++;
        
        if (consecutiveErrors >= maxConsecutiveErrors) {
          console.error(`Too many consecutive errors (${consecutiveErrors}). Giving up.`);
          throw new Error(`Failed to check status after ${maxConsecutiveErrors} consecutive attempts. Last error: ${error instanceof Error ? error.message : String(error)}`);
        }
        
        attempts++;
        const waitTime = Math.min(2000 * consecutiveErrors, 10000); // 指数退避，最多10秒
        console.log(`Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    throw new Error('Processing timed out after 60 minutes');
  };

  const handleFile = async (file: File) => {
    // Reset error state
    setUploadError(null);
    setUploadProgress('');
    setIsAsyncProcessing(false);
    setTaskId(null);
    setRetryCount(0);
    setStatusCheckCount(0);
    
    console.log('Processing file:', file.name, 'Type:', file.type, 'Size:', file.size, 'Language:', language);
    
    // Check file type
    const allowedTypes = ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/m4a', 'audio/webm', 'audio/ogg'];
    const allowedExtensions = ['.wav', '.mp3', '.m4a', '.webm', '.ogg', '.mp4'];
    
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    const isValidType = allowedTypes.includes(file.type) || allowedExtensions.includes(fileExtension);
    
    if (!isValidType) {
      setUploadError(`Unsupported file type: ${file.type || 'unknown'}. Please upload an audio file (WAV, MP3, M4A, WebM, or OGG)`);
      return;
    }

    // Check file size (max 100MB)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      setUploadError('File size must be less than 100MB');
      return;
    }

    // 估算文件大小
    const fileSizeMB = file.size / (1024 * 1024);
    
    if (fileSizeMB > 5) {
      setUploadProgress(`Uploading large file (${fileSizeMB.toFixed(1)} MB). This may take a while...`);
    }

    try {
      onUploadStart();
      setUploadProgress('Checking server status...');
      
      // 首先检查服务器健康状态
      const serverHealthy = await checkServerHealth();
      if (!serverHealthy) {
        throw new Error('Whisper server is not responding. Please make sure the server is running on port 8178.');
      }

      setUploadProgress('Uploading to server...');
      
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', file);
      
      // 添加语言参数
      if (language && language !== 'auto') {
        formData.append('language', language);
      }

      console.log('Uploading to Whisper server with language:', language);

      // Upload to Whisper server with shorter initial timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2分钟超时

      const response = await fetch('http://localhost:8178/inference', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log('Response status:', response.status);
      const result = await response.json();
      console.log('Server response:', result);

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}\n${JSON.stringify(result)}`);
      }
      
      if (result.error) {
        throw new Error(result.error);
      }

      // 检查是否是异步处理
      if (result.task_id) {
        console.log('Starting async processing with task ID:', result.task_id);
        setTaskId(result.task_id);
        setIsAsyncProcessing(true);
        const durationText = result.audio_duration_minutes ? `${result.audio_duration_minutes.toFixed(1)} min audio` : `${result.file_size_mb?.toFixed(1) || '?'} MB file`;
        const estimatedText = result.estimated_time_minutes ? `~${result.estimated_time_minutes.toFixed(1)} min` : '?';
        const languageText = language !== 'auto' ? ` (${language})` : '';
        setUploadProgress(`Processing ${durationText}${languageText}. Estimated time: ${estimatedText}...`);
        
        // 开始轮询状态
        await pollTaskStatus(result.task_id);
        return;
      }
      
      // 同步处理结果
      setUploadProgress('Processing transcription...');
      
      // Convert Whisper response to transcript format
      let transcripts: any[] = [];
      
      if (result.segments && result.segments.length > 0) {
        transcripts = result.segments.map((segment: any, index: number) => ({
          id: `uploaded-${Date.now()}-${index}`,
          text: segment.text?.trim() || '',
          timestamp: `${segment.start?.toFixed(1) || 0}s - ${segment.end?.toFixed(1) || 0}s`,
        })).filter((t: any) => t.text.length > 0);
      }

      // If no segments but we have text, create a single transcript
      if (transcripts.length === 0 && result.text?.trim()) {
        transcripts.push({
          id: `uploaded-${Date.now()}`,
          text: result.text.trim(),
          timestamp: new Date().toISOString(),
        });
      }

      if (transcripts.length === 0) {
        throw new Error('No transcription text was generated from the audio file');
      }

      console.log('Generated transcripts:', transcripts);
      const languageInfo = result.language ? ` (detected: ${result.language})` : '';
      setUploadProgress(`Transcription complete!${languageInfo}`);
      
      onAudioUploaded(transcripts);
      onUploadComplete();
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
    } catch (error) {
      console.error('Error uploading audio:', error);
      
      let errorMessage = 'Failed to process audio file';
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Upload timed out. Please try with a smaller file.';
        } else {
          errorMessage = error.message;
        }
      }
      
      setUploadError(errorMessage);
      setIsAsyncProcessing(false);
      setTaskId(null);
      onUploadComplete();
    } finally {
      if (!isAsyncProcessing) {
        setUploadProgress('');
      }
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleCancel = () => {
    setIsAsyncProcessing(false);
    setTaskId(null);
    setUploadProgress('');
    setStatusCheckCount(0);
    onUploadComplete();
  };

  const handleRetry = async () => {
    if (!taskId) return;
    
    setRetryCount(prev => prev + 1);
    setUploadError(null);
    setUploadProgress('Retrying status check...');
    
    try {
      await pollTaskStatus(taskId);
    } catch (error) {
      console.error('Retry failed:', error);
      setUploadError(error instanceof Error ? error.message : 'Retry failed');
    }
  };

  return (
    <div className="w-full">
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragActive
            ? 'border-blue-400 bg-blue-50'
            : uploadError
            ? 'border-red-300 bg-red-50'
            : 'border-gray-300 bg-gray-50 hover:border-gray-400'
        } ${isProcessing || isAsyncProcessing ? 'opacity-50 pointer-events-none' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg"
          onChange={handleChange}
          disabled={isProcessing || isAsyncProcessing}
          className="hidden"
        />
        
        {(isProcessing || isAsyncProcessing) ? (
          <div className="flex flex-col items-center space-y-3">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            <p className="text-sm text-gray-600">
              {uploadProgress || 'Processing audio file...'}
            </p>
            {isAsyncProcessing && taskId && (
              <div className="mt-2 space-y-2">
                <div className="text-xs text-gray-500 space-y-1">
                  <div>Task ID: {taskId}</div>
                  <div>Status checks: {statusCheckCount}</div>
                  {retryCount > 0 && <div>Retries: {retryCount}</div>}
                  {language !== 'auto' && <div>Language: {language}</div>}
                </div>
                <div className="space-x-2">
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-200 rounded-md hover:bg-gray-300"
                  >
                    Stop Checking
                  </button>
                  <button
                    onClick={handleRetry}
                    className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-100 rounded-md hover:bg-blue-200"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-3">
            <svg
              className={`h-12 w-12 ${
                uploadError ? 'text-red-400' : 'text-gray-400'
              }`}
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            
            <div className="space-y-1">
              <p className={`text-sm font-medium ${
                uploadError ? 'text-red-600' : 'text-gray-900'
              }`}>
                {uploadError ? 'Upload Error' : 'Upload audio file'}
              </p>
              <p className={`text-xs ${
                uploadError ? 'text-red-500' : 'text-gray-500'
              }`}>
                {uploadError || 'Drag and drop or click to select (WAV, MP3, M4A, WebM, OGG)'}
              </p>
              {language !== 'auto' && !uploadError && (
                <p className="text-xs text-blue-600">
                  Language: {language}
                </p>
              )}
            </div>
            
            <button
              type="button"
              onClick={onButtonClick}
              disabled={isProcessing || isAsyncProcessing}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Choose File
            </button>
          </div>
        )}
      </div>
      
      {uploadError && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="text-sm text-red-700 font-medium">Error:</div>
          <div className="text-sm text-red-600 mt-1">{uploadError}</div>
          {taskId && (
            <div className="text-xs text-gray-500 mt-2">
              Task ID: {taskId} - You can check status manually at: 
              <br />
              <code className="bg-gray-100 px-1 rounded text-xs">
                http://localhost:8178/status/{taskId}
              </code>
            </div>
          )}
        </div>
      )}
      
      <div className="mt-3 text-xs text-gray-500">
        <p>Supported formats: WAV, MP3, M4A, WebM, OGG</p>
        <p>Maximum file size: 100MB</p>
        <p className="text-blue-600 mt-1">
          ℹ️ Files &gt;10MB or &gt;10min will be processed asynchronously
        </p>
        {language !== 'auto' && (
          <p className="text-green-600 mt-1">
            🌐 Transcription language: {language}
          </p>
        )}
        {statusCheckCount > 0 && (
          <p className="text-green-600 mt-1">
            Status checks performed: {statusCheckCount}
          </p>
        )}
      </div>
    </div>
  );
};