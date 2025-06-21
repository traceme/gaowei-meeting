import React, { useState, useCallback } from 'react';
import { Button, Card, FileUpload, ProgressBar, LoadingSpinner } from '@gaowei/ui';
import { useFileProcessing } from '../hooks/useFileProcessing';
import { useApiStatus } from '../hooks/useApiStatus';

export function HomePage() {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    language: 'zh',
    model: '',
  });
  
  const { isOnline, error: apiError } = useApiStatus();
  
  const {
    isUploading,
    isProcessing,
    processingProgress,
    error,
    result,
    processComplete,
    reset,
    clearError,
  } = useFileProcessing();

  // 处理文件选择
  const handleFileSelect = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    
    const file = files[0];
    if (!file) return;
    
    try {
      clearError();
      
      await processComplete(
        file,
        formData.title || undefined,
        formData.description || undefined,
        formData.language,
        formData.model || undefined
      );
    } catch (error) {
      console.error('文件处理失败:', error);
    }
  }, [clearError, processComplete, formData]);

  // 处理错误
  const handleError = useCallback((error: string) => {
    console.error('文件上传错误:', error);
  }, []);

  // 表单数据更新
  const updateFormData = useCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // 重新开始
  const handleReset = useCallback(() => {
    reset();
    setFormData({
      title: '',
      description: '',
      language: 'zh',
      model: '',
    });
  }, [reset]);

  // 渲染处理进度
  const renderProgress = () => {
    if (!isUploading && !isProcessing) return null;

    return (
      <Card className="p-6 mt-6">
        <div className="text-center">
          <div className="text-lg font-medium mb-4">
            {isUploading ? '正在上传文件...' : '正在处理...'}
          </div>
          
          <ProgressBar
            value={isUploading ? 50 : processingProgress}
            color="blue"
            showLabel={true}
            label={isUploading 
              ? '文件上传中，请稍候...' 
              : `处理进度: ${processingProgress}%`
            }
          />
        </div>
      </Card>
    );
  };

  // 渲染结果
  const renderResult = () => {
    if (!result) return null;

    return (
      <Card className="p-6 mt-6">
        <div className="text-center">
          <div className="text-lg font-medium text-green-600 mb-4">
            🎉 处理完成！
          </div>
          
          {result.meetingId && (
            <div className="text-sm text-gray-600 mb-4">
              会议 ID: {result.meetingId}
            </div>
          )}
          
          <div className="space-y-2">
            <Button 
              onClick={() => window.location.href = `/meeting/${result.meetingId}`}
              className="mr-2"
            >
              查看会议详情
            </Button>
            <Button variant="outline" onClick={handleReset}>
              处理新文件
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          高维会议AI
        </h1>
        <p className="text-lg text-gray-600">
          上传音频文件，获得智能转录和AI摘要
        </p>
      </div>

      {/* API状态提示 */}
      {!isOnline && (
        <Card className="p-4 mb-6 bg-red-50 border-red-200">
          <div className="text-red-800 text-center">
            ⚠️ API服务不可用：{apiError}
          </div>
        </Card>
      )}

      {/* 错误提示 */}
      {error && (
        <Card className="p-4 mb-6 bg-red-50 border-red-200">
          <div className="text-red-800 text-center">
            ❌ {error}
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-2"
              onClick={clearError}
            >
              关闭
            </Button>
          </div>
        </Card>
      )}

      {/* 配置表单 */}
      <Card className="p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">会议设置</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              会议标题 (可选)
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => updateFormData('title', e.target.value)}
              placeholder="输入会议标题"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              disabled={isUploading || isProcessing}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              语言设置
            </label>
            <select
              value={formData.language}
              onChange={(e) => updateFormData('language', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              disabled={isUploading || isProcessing}
            >
              <option value="zh">中文</option>
              <option value="en">English</option>
              <option value="auto">自动检测</option>
            </select>
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              会议描述 (可选)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => updateFormData('description', e.target.value)}
              placeholder="输入会议描述或备注"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              disabled={isUploading || isProcessing}
            />
          </div>
        </div>
      </Card>

      {/* 文件上传 */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">上传音频文件</h2>
        
        <FileUpload
          accept="audio/*"
          maxSize={100}
          onFilesSelect={handleFileSelect}
          onError={handleError}
          disabled={isUploading || isProcessing || !isOnline}
          allowedTypes={['mp3', 'wav', 'm4a', 'flac', 'ogg', 'webm']}
        >
          <div className="text-center py-12">
            <div className="text-4xl mb-4">🎵</div>
            <div className="text-lg font-medium text-gray-900 mb-2">
              点击上传或拖拽音频文件到此处
            </div>
            <div className="text-sm text-gray-600 mb-4">
              支持 MP3, WAV, M4A, FLAC, OGG, WebM 格式，最大 100MB
            </div>
            <Button 
              disabled={isUploading || isProcessing || !isOnline}
              variant="outline"
            >
              选择文件
            </Button>
          </div>
        </FileUpload>
        
        <div className="mt-4 text-xs text-gray-500 text-center">
          <div className="mb-1">
            ✅ 支持常见音频格式 • 🔒 本地处理保护隐私 • ⚡ AI智能摘要
          </div>
          <div>
            💡 提示：清晰的录音质量将获得更好的转录效果
          </div>
        </div>
      </Card>

      {/* 处理进度 */}
      {renderProgress()}

      {/* 处理结果 */}
      {renderResult()}

      {/* 功能介绍 */}
      {!isUploading && !isProcessing && !result && (
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 text-center">
            <div className="text-3xl mb-3">🎯</div>
            <h3 className="text-lg font-semibold mb-2">智能转录</h3>
            <p className="text-gray-600 text-sm">
              采用先进的语音识别技术，支持多种语言，准确率高达95%
            </p>
          </Card>
          
          <Card className="p-6 text-center">
            <div className="text-3xl mb-3">🤖</div>
            <h3 className="text-lg font-semibold mb-2">AI摘要</h3>
            <p className="text-gray-600 text-sm">
              自动提取关键信息，生成结构化摘要，快速了解会议要点
            </p>
          </Card>
          
          <Card className="p-6 text-center">
            <div className="text-3xl mb-3">📊</div>
            <h3 className="text-lg font-semibold mb-2">历史管理</h3>
            <p className="text-gray-600 text-sm">
              完整的会议记录管理，支持搜索、分类和导出功能
            </p>
          </Card>
        </div>
      )}
    </div>
  );
} 