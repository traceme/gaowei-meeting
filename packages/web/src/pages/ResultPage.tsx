import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TranscriptionDetail, { type TranscriptionData } from '../components/TranscriptionDetail';
import { PageLoadingSpinner } from '../components/LoadingSpinner';

interface TranscriptionTask {
  id: string;
  meeting_id: string;
  status: 'pending' | 'processing' | 'completed' | 'error' | 'failed';
  filename: string;
  progress: number;
  result?: {
    text: string;
    segments: Array<{
      start: number;
      end: number;
      text: string;
      words?: Array<{
        word: string;
        start: number;
        end: number;
        probability: number;
      }>;
    }>;
    language: string;
    duration: number;
    model: string;
    confidence?: number;
  };
  error?: string;
  created_at: string;
  updated_at: string;
  audio_path?: string;
  summary?: {
    text: string;
    model: string;
    created_at: string;
  };
}

const ResultPage: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<TranscriptionTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId) {
      setError('任务ID不存在');
      setLoading(false);
      return;
    }

    fetchTask();
  }, [taskId]);

  const fetchTask = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:3000/api/transcription/${taskId}`);
      
      if (!response.ok) {
        throw new Error(`获取任务失败: ${response.statusText}`);
      }

      const apiResponse = await response.json();
      
      if (!apiResponse.success || !apiResponse.data.task) {
        throw new Error(apiResponse.error?.message || '任务不存在');
      }

      const taskData = apiResponse.data.task;
      
      if (taskData.status !== 'completed' || !taskData.result) {
        throw new Error('任务尚未完成或结果不可用');
      }

      setTask(taskData);
    } catch (err) {
      console.error('获取任务失败:', err);
      setError(err instanceof Error ? err.message : '获取任务失败');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/history');
  };

  const handleDelete = async () => {
    if (!taskId) return;

    try {
      const response = await fetch(`http://localhost:3000/api/tasks/${taskId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        navigate('/history');
      } else {
        alert('删除失败，请稍后重试');
      }
    } catch (error) {
      console.error('删除任务失败:', error);
      alert('删除失败，请稍后重试');
    }
  };

  const handleExport = (id: string, format: 'txt' | 'json' | 'srt' | 'vtt') => {
    if (!task?.result) return;

    let content = '';
    let filename = `${task.filename}_transcription`;
    let mimeType = 'text/plain';

    switch (format) {
      case 'txt':
        content = `转录文件
====================
文件名: ${task.filename}
任务ID: ${task.id}
语言: ${task.result.language}
时长: ${task.result.duration ? formatDuration(task.result.duration) : '未知'}
模型: ${task.result.model}
创建时间: ${formatDate(task.created_at)}

完整转录内容:
${task.result.text}

分段信息:
${task.result.segments.map(seg => 
  `${formatTime(seg.start)} - ${formatTime(seg.end)}: ${seg.text}`
).join('\n')}
`;
        filename += '.txt';
        break;

      case 'json':
        content = JSON.stringify({
          filename: task.filename,
          taskId: task.id,
          language: task.result.language,
          duration: task.result.duration,
          model: task.result.model,
          createdAt: task.created_at,
          text: task.result.text,
          segments: task.result.segments,
        }, null, 2);
        filename += '.json';
        mimeType = 'application/json';
        break;

      case 'srt':
        content = task.result.segments.map((seg, index) => {
          const startTime = formatSRTTime(seg.start);
          const endTime = formatSRTTime(seg.end);
          return `${index + 1}\n${startTime} --> ${endTime}\n${seg.text}\n`;
        }).join('\n');
        filename += '.srt';
        break;

      case 'vtt':
        content = `WEBVTT

${task.result.segments.map((seg, index) => {
          const startTime = formatVTTTime(seg.start);
          const endTime = formatVTTTime(seg.end);
          return `${startTime} --> ${endTime}\n${seg.text}`;
        }).join('\n\n')}`;
        filename += '.vtt';
        break;
    }

    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 辅助函数
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatSRTTime = (seconds: number) => {
    const totalMs = Math.floor(seconds * 1000);
    const hours = Math.floor(totalMs / 3600000);
    const minutes = Math.floor((totalMs % 3600000) / 60000);
    const secs = Math.floor((totalMs % 60000) / 1000);
    const ms = totalMs % 1000;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  };

  const formatVTTTime = (seconds: number) => {
    const totalMs = Math.floor(seconds * 1000);
    const hours = Math.floor(totalMs / 3600000);
    const minutes = Math.floor((totalMs % 3600000) / 60000);
    const secs = Math.floor((totalMs % 60000) / 1000);
    const ms = totalMs % 1000;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  if (loading) {
    return <PageLoadingSpinner text="加载转录结果中..." />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">加载失败</h1>
          <p className="text-lg text-gray-600 mb-8">{error}</p>
          <button
            onClick={handleBack}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            返回历史记录
          </button>
        </div>
      </div>
    );
  }

  if (!task || !task.result) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">📭</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">任务不存在</h1>
          <p className="text-lg text-gray-600 mb-8">找不到指定的转录任务</p>
          <button
            onClick={handleBack}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            返回历史记录
          </button>
        </div>
      </div>
    );
  }

  // 构建音频URL - 使用实际的文件名而不是原始文件名
  const audioUrl = `/uploads/${task.actual_filename || task.filename}`;

  // 简单的关键词提取函数
  const extractKeywords = (text: string): string[] => {
    if (!text) return [];
    
    // 简单的关键词提取逻辑
    const stopWords = new Set(['的', '是', '在', '有', '和', '对', '为', '以', '及', '等', '了', '个', '要', '我', '他', '她', '这', '那', '会', '能', '可', '就', '都', '也', '还', '只', '很', '更', '最', '非常', '所以', '因为', '如果', '但是', '然后', '现在', '已经', '一直', '一些', '一个', 'one', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those']);
    
    return text
      .split(/[\s\n\r\t\.,;:!?()（），。；：！？]+/)
      .filter(word => word.length > 1 && !stopWords.has(word.toLowerCase()))
      .reduce((acc: string[], word: string) => {
        if (!acc.includes(word) && acc.length < 10) {
          acc.push(word);
        }
        return acc;
      }, []);
  };

  // 将任务数据转换为TranscriptionData格式
  const transcriptionData: TranscriptionData = {
    id: task.id,
    filename: task.filename,
    status: 'completed',
    text: task.result.text,
    segments: task.result.segments.map((seg) => ({
      start: seg.start,
      end: seg.end,
      text: seg.text,
      words: seg.words || []
    })),
    audioUrl,
    createdAt: task.created_at,
    duration: task.result.duration,
    language: task.result.language,
    confidence: task.result.confidence,
    // 修复：传递完整的摘要对象而不是只传递文本
    summary: task.summary ? {
      text: task.summary.text,
      model: task.summary.model,
      created_at: task.summary.created_at
    } : undefined,
    // 修复：从转录文本中提取关键词
    keywords: task.summary ? extractKeywords(task.result.text) : [],
  };

  return (
    <TranscriptionDetail
      transcription={transcriptionData}
      onBack={handleBack}
      onDelete={handleDelete}
      onExport={handleExport}
    />
  );
};

export default ResultPage; 