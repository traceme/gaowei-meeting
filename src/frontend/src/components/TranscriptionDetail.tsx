import React, { useState } from 'react';
import VidstackAudioPlayer from './VidstackAudioPlayer';
import type { AudioSegment } from './VidstackAudioPlayer';

export interface TranscriptionTask {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  filename: string;
  progress: number;
  createdAt: string;
  result?: {
    text: string;
    segments: AudioSegment[];
    language: string;
  };
  summary?: {
    text: string;
    model: string;
    createdAt: string;
  };
  error?: string;
}

interface TranscriptionDetailProps {
  task: TranscriptionTask;
  audioUrl: string;
  onRefresh?: () => void;
}

export const TranscriptionDetail: React.FC<TranscriptionDetailProps> = ({
  task,
  audioUrl,
  onRefresh,
}) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [editableText, setEditableText] = useState(task.result?.text || '');

  // 复制文本到剪贴板
  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(type);
      setTimeout(() => setCopiedText(null), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  // 导出功能
  const exportTranscription = () => {
    const content = `# 会议转录记录
    
## 基本信息
- 文件名: ${task.filename}
- 转录时间: ${new Date(task.createdAt).toLocaleString()}
- 语言: ${task.result?.language || '未知'}

## 转录内容
${editableText}

## AI摘要
${task.summary?.text || '暂无摘要'}

---
生成时间: ${new Date().toLocaleString()}
`;

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${task.filename}_转录记录.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!task.result) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">转录处理中，请稍候...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 音频播放器与时间戳同步 */}
      <VidstackAudioPlayer
        audioUrl={audioUrl}
        segments={task.result.segments}
        onTimeUpdate={setCurrentTime}
        onSegmentClick={(segment) => {
          console.log('点击了段落:', segment);
        }}
      />

      {/* 转录结果编辑区 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <svg className="w-5 h-5 mr-2 text-green-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            转录文本 (可编辑)
          </h3>
          
          <div className="flex space-x-2">
            <button
              onClick={() => copyToClipboard(editableText, 'transcription')}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {copiedText === 'transcription' ? (
                <>
                  <svg className="w-4 h-4 mr-1 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  已复制
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                  </svg>
                  复制
                </>
              )}
            </button>
            
            <button
              onClick={exportTranscription}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              导出
            </button>
          </div>
        </div>

        <textarea
          value={editableText}
          onChange={(e) => setEditableText(e.target.value)}
          className="w-full h-40 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          placeholder="转录文本将显示在这里..."
        />

        <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
          <span>语言: {task.result.language}</span>
          <span>字符数: {editableText.length}</span>
        </div>
      </div>

      {/* AI摘要区域 */}
      {task.summary && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <svg className="w-5 h-5 mr-2 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
              </svg>
              AI智能摘要
              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                {task.summary.model}
              </span>
            </h3>
            
            <button
              onClick={() => copyToClipboard(task.summary?.text || '', 'summary')}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
            >
              {copiedText === 'summary' ? (
                <>
                  <svg className="w-4 h-4 mr-1 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  已复制
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                  </svg>
                  复制摘要
                </>
              )}
            </button>
          </div>

          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-4 border border-purple-200">
            <div 
              className="prose prose-sm max-w-none text-gray-700"
              dangerouslySetInnerHTML={{ 
                __html: task.summary.text.replace(/\n/g, '<br/>') 
              }}
            />
          </div>

          <div className="mt-3 text-sm text-gray-500">
            生成时间: {new Date(task.summary.createdAt).toLocaleString()}
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex justify-center space-x-4">
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            刷新状态
          </button>
        )}
        
        <button
          onClick={() => window.print()}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
        >
          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
          </svg>
          打印记录
        </button>
      </div>
    </div>
  );
};

export default TranscriptionDetail; 