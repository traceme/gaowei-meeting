import React, { useState } from 'react';
import { type AudioSegment } from './VidstackAudioPlayer';
import LoadingSpinner from './LoadingSpinner';

export interface TranscriptionResultProps {
  id: string;
  filename: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  text?: string;
  segments?: AudioSegment[];
  summary?: string;
  keywords?: string[];
  progress?: number;
  error?: string;
  onRetry?: (id: string) => void;
  onDelete?: (id: string) => void;
  onViewDetails?: (id: string) => void;
  onDownload?: (id: string, format: 'txt' | 'json' | 'srt') => void;
}

export const TranscriptionResult: React.FC<TranscriptionResultProps> = ({
  id,
  filename,
  status,
  text,
  segments,
  summary,
  keywords,
  progress = 0,
  error,
  onRetry,
  onDelete,
  onViewDetails,
  onDownload,
}) => {
  const [showPreview, setShowPreview] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<'txt' | 'json' | 'srt'>('txt');

  // 状态配置
  const statusConfig = {
    pending: {
      color: 'bg-yellow-50 border-yellow-200',
      badgeColor: 'bg-yellow-100 text-yellow-800',
      icon: '⏳',
      text: '等待处理',
    },
    processing: {
      color: 'bg-blue-50 border-blue-200',
      badgeColor: 'bg-blue-100 text-blue-800',
      icon: '⚡',
      text: '处理中',
    },
    completed: {
      color: 'bg-green-50 border-green-200',
      badgeColor: 'bg-green-100 text-green-800',
      icon: '✅',
      text: '已完成',
    },
    failed: {
      color: 'bg-red-50 border-red-200',
      badgeColor: 'bg-red-100 text-red-800',
      icon: '❌',
      text: '失败',
    },
  };

  const config = statusConfig[status];

  // 截取预览文本
  const getPreviewText = () => {
    if (!text) return '无转录内容';
    return text.length > 200 ? text.substring(0, 200) + '...' : text;
  };

  // 处理下载
  const handleDownload = () => {
    onDownload?.(id, downloadFormat);
  };

  return (
    <div className={`border rounded-lg p-6 transition-all hover:shadow-md ${config.color}`}>
      {/* 头部信息 */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-3 mb-2">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {filename}
            </h3>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.badgeColor}`}>
              <span className="mr-1">{config.icon}</span>
              {config.text}
            </span>
          </div>

          {/* 进度条（处理中状态） */}
          {status === 'processing' && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                <span>转录进度</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* 错误信息 */}
          {status === 'failed' && error && (
            <div className="mb-3 p-3 bg-red-100 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center space-x-2 ml-4">
          {status === 'completed' && (
            <>
              <button
                onClick={() => onViewDetails?.(id)}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                查看详情
              </button>
              
              {/* 下载按钮 */}
              <div className="relative">
                <select
                  value={downloadFormat}
                  onChange={(e) => setDownloadFormat(e.target.value as 'txt' | 'json' | 'srt')}
                  className="absolute opacity-0 inset-0"
                />
                <button
                  onClick={handleDownload}
                  className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  下载 {downloadFormat.toUpperCase()}
                </button>
              </div>
            </>
          )}

          {status === 'failed' && (
            <button
              onClick={() => onRetry?.(id)}
              className="px-3 py-1.5 text-sm bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
            >
              重试
            </button>
          )}

          <button
            onClick={() => onDelete?.(id)}
            className="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
          >
            删除
          </button>
        </div>
      </div>

      {/* 处理中的加载动画 */}
      {status === 'processing' && (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="lg" text="正在转录音频..." />
        </div>
      )}

      {/* 待处理状态 */}
      {status === 'pending' && (
        <div className="text-center py-8 text-gray-600">
          <div className="text-2xl mb-2">⏳</div>
          <p>任务已加入队列，等待处理...</p>
        </div>
      )}

      {/* 完成状态的内容 */}
      {status === 'completed' && (
        <div className="space-y-4">
          {/* 统计信息 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {text && (
              <div className="bg-white p-3 rounded-lg border">
                <div className="text-xs text-gray-500">字符数</div>
                <div className="text-lg font-semibold text-gray-900">{text.length}</div>
              </div>
            )}
            
            {segments && (
              <div className="bg-white p-3 rounded-lg border">
                <div className="text-xs text-gray-500">分段数</div>
                <div className="text-lg font-semibold text-gray-900">{segments.length}</div>
              </div>
            )}

            {keywords && (
              <div className="bg-white p-3 rounded-lg border">
                <div className="text-xs text-gray-500">关键词</div>
                <div className="text-lg font-semibold text-gray-900">{keywords.length}</div>
              </div>
            )}
          </div>

          {/* 预览内容 */}
          <div className="bg-white p-4 rounded-lg border">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-900">转录预览</h4>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                {showPreview ? '收起' : '展开'}
              </button>
            </div>

            <div className={`text-sm text-gray-700 leading-relaxed ${showPreview ? '' : 'line-clamp-3'}`}>
              {showPreview ? text : getPreviewText()}
            </div>
          </div>

          {/* AI摘要 */}
          {summary && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="text-sm font-medium text-blue-900 mb-2 flex items-center">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                AI智能摘要
              </h4>
              <p className="text-sm text-blue-800">{summary}</p>
            </div>
          )}

          {/* 关键词标签 */}
          {keywords && keywords.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">关键词</h4>
              <div className="flex flex-wrap gap-2">
                {keywords.slice(0, 10).map((keyword, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                  >
                    {keyword}
                  </span>
                ))}
                {keywords.length > 10 && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    +{keywords.length - 10} 更多
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TranscriptionResult; 