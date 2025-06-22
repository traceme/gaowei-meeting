import React, { useState, useRef } from 'react';
import { VidstackAudioPlayer, type AudioSegment } from './VidstackAudioPlayer';

export interface TranscriptionData {
  id: string;
  filename: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  text?: string;
  segments?: AudioSegment[];
  summary?: string;
  keywords?: string[];
  audioUrl?: string;
  createdAt: string;
  duration?: number;
  language?: string;
  confidence?: number;
}

export interface TranscriptionDetailProps {
  transcription: TranscriptionData;
  onBack?: () => void;
  onDelete?: (id: string) => void;
  onExport?: (id: string, format: 'txt' | 'json' | 'srt' | 'vtt') => void;
}

export const TranscriptionDetail: React.FC<TranscriptionDetailProps> = ({
  transcription,
  onBack,
  onDelete,
  onExport,
}) => {
  const [activeTab, setActiveTab] = useState<'transcription' | 'summary' | 'segments'>('transcription');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 格式化时间
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // 复制文本到剪贴板
  const handleCopyText = async () => {
    if (transcription.text) {
      try {
        await navigator.clipboard.writeText(transcription.text);
      } catch (err) {
        console.error('复制失败:', err);
      }
    }
  };

  // 选择全部文本
  const handleSelectAll = () => {
    if (textareaRef.current) {
      textareaRef.current.select();
    }
  };

  // 导出处理
  const handleExport = (format: 'txt' | 'json' | 'srt' | 'vtt') => {
    onExport?.(transcription.id, format);
    setShowExportMenu(false);
  };

  // 删除确认
  const handleDeleteConfirm = () => {
    onDelete?.(transcription.id);
    setShowDeleteConfirm(false);
  };

  // 状态显示
  const getStatusBadge = () => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', text: '等待中', icon: '⏳' },
      processing: { color: 'bg-blue-100 text-blue-800', text: '处理中', icon: '⚡' },
      completed: { color: 'bg-green-100 text-green-800', text: '已完成', icon: '✅' },
      failed: { color: 'bg-red-100 text-red-800', text: '失败', icon: '❌' },
    };

    const config = statusConfig[transcription.status];
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        <span className="mr-1">{config.icon}</span>
        {config.text}
      </span>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* 头部导航 */}
      <div className="flex items-center justify-between bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            返回列表
          </button>
          <div className="h-6 w-px bg-gray-300" />
          <h1 className="text-xl font-semibold text-gray-900 truncate max-w-md">
            {transcription.filename}
          </h1>
          {getStatusBadge()}
        </div>

        <div className="flex items-center space-x-3">
          {/* 导出菜单 */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              disabled={transcription.status !== 'completed'}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              导出
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border z-10">
                <div className="py-1">
                  <button onClick={() => handleExport('txt')} className="flex items-center w-full px-4 py-2 text-sm hover:bg-gray-50">
                    <span className="mr-3 text-gray-400">TXT</span>
                    纯文本格式
                  </button>
                  <button onClick={() => handleExport('json')} className="flex items-center w-full px-4 py-2 text-sm hover:bg-gray-50">
                    <span className="mr-3 text-gray-400">JSON</span>
                    结构化数据
                  </button>
                  <button onClick={() => handleExport('srt')} className="flex items-center w-full px-4 py-2 text-sm hover:bg-gray-50">
                    <span className="mr-3 text-gray-400">SRT</span>
                    字幕文件
                  </button>
                  <button onClick={() => handleExport('vtt')} className="flex items-center w-full px-4 py-2 text-sm hover:bg-gray-50">
                    <span className="mr-3 text-gray-400">VTT</span>
                    WebVTT字幕
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 删除按钮 */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            删除
          </button>
        </div>
      </div>

      {/* 文件信息面板 */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
          </svg>
          文件信息
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600">创建时间</div>
            <div className="text-lg font-medium text-gray-900">
              {new Date(transcription.createdAt).toLocaleString()}
            </div>
          </div>

          {transcription.duration && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">时长</div>
              <div className="text-lg font-medium text-gray-900">
                {formatTime(transcription.duration)}
              </div>
            </div>
          )}

          {transcription.language && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">识别语言</div>
              <div className="text-lg font-medium text-gray-900">
                {transcription.language}
              </div>
            </div>
          )}

          {transcription.confidence && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">置信度</div>
              <div className="text-lg font-medium text-gray-900">
                {Math.round(transcription.confidence * 100)}%
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 音频播放器 */}
      {transcription.audioUrl && transcription.segments && (
        <VidstackAudioPlayer
          audioUrl={transcription.audioUrl}
          segments={transcription.segments}
          className="bg-white rounded-lg shadow-sm border"
        />
      )}

      {/* 内容标签页 */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6 pt-4">
            <button
              onClick={() => setActiveTab('transcription')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'transcription'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              转录文本
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'summary'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              AI摘要
            </button>
            <button
              onClick={() => setActiveTab('segments')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'segments'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              分段详情
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* 转录文本标签页 */}
          {activeTab === 'transcription' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">完整转录文本</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={handleSelectAll}
                    className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                  >
                    全选
                  </button>
                  <button
                    onClick={handleCopyText}
                    className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors"
                  >
                    复制
                  </button>
                </div>
              </div>

              <textarea
                ref={textareaRef}
                value={transcription.text || ''}
                onChange={(e) => {
                  // 实时编辑功能 - 可以在这里添加保存逻辑
                  console.log('转录文本已修改:', e.target.value);
                }}
                className="w-full h-96 p-4 border border-gray-300 rounded-lg resize-none font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="转录文本将在这里显示..."
              />
            </div>
          )}

          {/* AI摘要标签页 */}
          {activeTab === 'summary' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                  </svg>
                  AI智能摘要
                </h3>
                <button
                  onClick={() => {
                    if (transcription.summary) {
                      navigator.clipboard.writeText(transcription.summary);
                    }
                  }}
                  className="px-3 py-1 text-sm bg-purple-100 hover:bg-purple-200 text-purple-700 rounded transition-colors"
                >
                  复制摘要
                </button>
              </div>
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4">
                <div 
                  className="prose prose-sm max-w-none text-gray-700"
                  dangerouslySetInnerHTML={{ 
                    __html: (transcription.summary || '暂无AI摘要内容').replace(/\n/g, '<br/>') 
                  }}
                />
              </div>

              {transcription.keywords && transcription.keywords.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">关键词</h3>
                  <div className="flex flex-wrap gap-2">
                    {transcription.keywords.map((keyword, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 操作按钮 */}
              <div className="flex justify-center space-x-4 pt-4">
                <button
                  onClick={() => {
                    // Markdown导出功能
                    const content = `# 会议转录记录

## 基本信息
- 文件名: ${transcription.filename}
- 转录时间: ${new Date(transcription.createdAt).toLocaleString()}
- 语言: ${transcription.language || '未知'}
${transcription.duration ? `- 时长: ${Math.floor(transcription.duration / 60)}:${Math.floor(transcription.duration % 60).toString().padStart(2, '0')}` : ''}

## 转录内容
${transcription.text || ''}

## AI摘要
${transcription.summary || '暂无摘要'}

${transcription.keywords && transcription.keywords.length > 0 ? `## 关键词
${transcription.keywords.map(keyword => `- ${keyword}`).join('\n')}` : ''}

---
生成时间: ${new Date().toLocaleString()}
`;

                    const blob = new Blob([content], { type: 'text/markdown' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${transcription.filename}_转录记录.md`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  导出Markdown
                </button>
                
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
          )}

          {/* 分段详情标签页 */}
          {activeTab === 'segments' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">分段转录详情</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {transcription.segments?.map((segment, index) => (
                  <div key={index} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            段落 {index + 1}
                          </span>
                          <span className="text-sm text-gray-500">
                            {formatTime(segment.start)} - {formatTime(segment.end)}
                          </span>
                        </div>
                        <p className="text-gray-700 leading-relaxed">{segment.text}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 删除确认对话框 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">确认删除</h3>
                <p className="text-sm text-gray-500 mt-1">
                  您确定要删除转录记录 "{transcription.filename}" 吗？此操作无法撤销。
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TranscriptionDetail; 