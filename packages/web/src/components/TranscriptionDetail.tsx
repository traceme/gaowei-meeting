import React, { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { VidstackAudioPlayer, type VidstackAudioPlayerRef } from './VidstackAudioPlayer';
import type { AudioSegment as BaseAudioSegment } from '@gaowei/shared-types';

export interface AudioSegment extends BaseAudioSegment {
  words?: Array<{
    word: string;
    start: number;
    end: number;
    probability?: number;
  }>;
}

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

interface SummaryData {
  summary?: {
    text: string;
    model: string;
    created_at: string;
  };
  keywords?: string[];
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
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summaryData, setSummaryData] = useState<SummaryData>({
    summary: transcription.summary ? {
      text: transcription.summary,
      model: 'unknown',
      created_at: new Date().toISOString()
    } : undefined,
    keywords: transcription.keywords,
  });
  const [expandedSegment, setExpandedSegment] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const audioPlayerRef = useRef<VidstackAudioPlayerRef>(null);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return hours > 0 
      ? `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
      : `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatPreciseTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = (seconds % 60).toFixed(2);
    return `${minutes}:${remainingSeconds.padStart(5, '0')}`;
  };

  // 跳转到指定时间
  const handleTimeJump = (time: number) => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.seekTo(time);
    }
  };

  const generateAISummary = async () => {
    if (!transcription.text || isGeneratingSummary) return;
    
    setIsGeneratingSummary(true);
    try {
      const response = await fetch(`/api/transcription/${transcription.id}/summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error(`生成摘要失败: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success && result.data) {
        setSummaryData({
          summary: result.data.summary,
          keywords: result.data.keywords,
        });
      }
    } catch (error) {
      console.error('生成AI摘要失败:', error);
      alert('生成AI摘要失败，请稍后重试');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(transcription.text || '');
      alert('转录文本已复制到剪贴板');
    } catch (error) {
      console.error('复制失败:', error);
      alert('复制失败，请手动选择文本复制');
    }
  };

  const handleSelectAll = () => {
    if (textareaRef.current) {
      textareaRef.current.select();
    }
  };

  const handleExport = (format: 'txt' | 'json' | 'srt' | 'vtt') => {
    onExport?.(transcription.id, format);
  };

  const handleDeleteConfirm = () => {
    onDelete?.(transcription.id);
    setShowDeleteConfirm(false);
  };

  const getStatusBadge = () => {
    switch (transcription.status) {
      case 'completed':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">✅ 已完成</span>;
      case 'processing':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">⏳ 处理中</span>;
      case 'pending':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">⏱️ 等待中</span>;
      case 'failed':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">❌ 失败</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">❓ 未知</span>;
    }
  };

  const getWordTimestampsCount = () => {
    return transcription.segments?.reduce((total, segment) => {
      return total + (segment.words?.length || 0);
    }, 0) || 0;
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {onBack && (
            <button
              onClick={onBack}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              ← 返回列表
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{transcription.filename}</h1>
            <div className="flex items-center space-x-2 mt-1">
              {getStatusBadge()}
              <span className="text-sm text-gray-500">
                创建于 {new Date(transcription.createdAt).toLocaleString('zh-CN')}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {transcription.status === 'completed' && (
            <>
              <div className="relative">
                <select
                  onChange={(e) => handleExport(e.target.value as any)}
                  value=""
                  className="appearance-none bg-white border border-gray-300 rounded-md px-4 py-2 pr-8 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <option value="">📄 导出选项</option>
                  <option value="txt">📝 纯文本 (.txt)</option>
                  <option value="json">🔧 JSON格式 (.json)</option>
                  <option value="srt">🎬 SRT字幕 (.srt)</option>
                  <option value="vtt">🌐 WebVTT (.vtt)</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                  </svg>
                </div>
              </div>
              
              {onDelete && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex items-center px-3 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  🗑️ 删除
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* 文件信息区域 */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">文件信息</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600">文件名</div>
            <div className="text-lg font-medium text-gray-900 truncate">
              {transcription.filename}
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

          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600">词级时间戳</div>
            <div className="text-lg font-medium text-gray-900">
              {getWordTimestampsCount()} 个词
            </div>
          </div>
        </div>
      </div>

      {/* 音频播放器 */}
      {transcription.audioUrl && transcription.segments && (
        <VidstackAudioPlayer
          ref={audioPlayerRef}
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
              {!summaryData.summary && (
                <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                  新
                </span>
              )}
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
              <span className="ml-1 text-xs text-gray-500">
                ({transcription.segments?.length || 0})
              </span>
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
                <div className="flex space-x-2">
                  {/* 如果没有摘要，显示生成按钮 */}
                  {!summaryData.summary && (
                    <button
                      onClick={generateAISummary}
                      disabled={isGeneratingSummary || !transcription.text}
                      className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md ${
                        isGeneratingSummary || !transcription.text
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-purple-600 text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500'
                      }`}
                    >
                      {isGeneratingSummary ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          生成中...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                          </svg>
                          生成AI摘要
                        </>
                      )}
                    </button>
                  )}
                  {/* 如果有摘要，显示复制和重新生成按钮 */}
                  {summaryData.summary && (
                    <>
                      <button
                        onClick={generateAISummary}
                        disabled={isGeneratingSummary || !transcription.text}
                        className={`inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md ${
                          isGeneratingSummary || !transcription.text
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500'
                        }`}
                        title="重新生成AI摘要"
                      >
                        {isGeneratingSummary ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            重新生成中...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                            </svg>
                            重新生成
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => navigator.clipboard.writeText(summaryData.summary?.text || '')}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                        title="复制摘要内容"
                      >
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                        </svg>
                        复制
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* 摘要内容 */}
              {summaryData.summary ? (
                <div className="space-y-4">
                  {/* 关键词标签 */}
                  {summaryData.keywords && summaryData.keywords.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">🏷️ 关键词</h4>
                      <div className="flex flex-wrap gap-2">
                        {summaryData.keywords.map((keyword, index) => (
                          <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 摘要文本 */}
                  <div className="prose prose-sm max-w-none">
                    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border-l-4 border-purple-400 p-4 rounded-r-lg">
                      <ReactMarkdown 
                        components={{
                          h1: ({children}) => <h1 className="text-lg font-semibold text-gray-800 mb-3">{children}</h1>,
                          h2: ({children}) => <h2 className="text-base font-semibold text-gray-800 mb-2">{children}</h2>,
                          h3: ({children}) => <h3 className="text-sm font-semibold text-gray-800 mb-2">{children}</h3>,
                          p: ({children}) => <p className="mb-3 text-gray-700 leading-relaxed">{children}</p>,
                          ul: ({children}) => <ul className="mb-3 space-y-1 ml-4">{children}</ul>,
                          ol: ({children}) => <ol className="mb-3 space-y-1 ml-4">{children}</ol>,
                          li: ({children}) => <li className="text-gray-700 leading-relaxed list-disc">{children}</li>,
                          strong: ({children}) => <strong className="font-semibold text-gray-800">{children}</strong>,
                          em: ({children}) => <em className="italic text-gray-700">{children}</em>,
                          blockquote: ({children}) => (
                            <blockquote className="border-l-2 border-purple-300 pl-3 italic text-gray-600 mb-3">
                              {children}
                            </blockquote>
                          ),
                          code: ({children}) => (
                            <code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono text-gray-800">
                              {children}
                            </code>
                          ),
                        }}
                      >
                        {summaryData.summary.text}
                      </ReactMarkdown>
                    </div>
                  </div>

                  {/* 摘要元信息 */}
                  <div className="text-xs text-gray-500 border-t border-gray-200 pt-4">
                    模型: {summaryData.summary.model} | 生成时间: {new Date(summaryData.summary.created_at).toLocaleString('zh-CN')}
                  </div>

                  {/* 导出按钮 */}
                  <div className="flex space-x-2 pt-4">
                    <button
                      onClick={() => {
                        const content = `# ${transcription.filename} - AI摘要\n\n## 🏷️ 关键词\n${summaryData.keywords?.map(k => `- ${k}`).join('\n') || '无'}\n\n## 📋 摘要内容\n${summaryData.summary?.text || ''}\n\n---\n*生成时间: ${new Date().toLocaleString('zh-CN')}*\n*模型: ${summaryData.summary?.model || 'unknown'}*`;
                        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `${transcription.filename.replace(/\.[^/.]+$/, '')}_摘要.md`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
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
              ) : (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">暂无AI摘要</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    点击上方"生成AI摘要"按钮开始智能分析
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 分段详情标签页 */}
          {activeTab === 'segments' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">分段转录详情</h3>
                <div className="text-sm text-gray-500">
                  共 {transcription.segments?.length || 0} 个段落
                </div>
              </div>
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
                          <span className="text-xs text-gray-400">
                            ({(segment.end - segment.start).toFixed(1)}秒)
                          </span>
                          <button
                            onClick={() => handleTimeJump(segment.start)}
                            className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors"
                          >
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z"/>
                            </svg>
                            播放
                          </button>
                          {segment.words && segment.words.length > 0 && (
                            <button
                              onClick={() => setExpandedSegment(expandedSegment === index ? null : index)}
                              className="text-xs text-blue-600 hover:text-blue-800"
                            >
                              {expandedSegment === index ? '收起' : '展开'} {segment.words.length} 个词
                            </button>
                          )}
                        </div>
                        <p className="text-gray-700 leading-relaxed">{segment.text}</p>
                        
                        {/* 词级时间戳展开显示 */}
                        {expandedSegment === index && segment.words && segment.words.length > 0 && (
                          <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <h4 className="text-sm font-medium text-blue-900 mb-2">词级时间戳</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                              {segment.words.map((word, wordIndex) => (
                                <button
                                  key={wordIndex}
                                  onClick={() => handleTimeJump(word.start)}
                                  className="flex items-center justify-between p-2 bg-white rounded border hover:bg-blue-50 hover:border-blue-300 transition-colors cursor-pointer"
                                >
                                  <span className="font-mono text-gray-800">{word.word}</span>
                                  <div className="text-right">
                                    <div className="text-gray-600">
                                      {formatPreciseTime(word.start)} - {formatPreciseTime(word.end)}
                                    </div>
                                    {word.probability && (
                                      <div className="text-gray-500">
                                        {Math.round(word.probability * 100)}%
                                      </div>
                                    )}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
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