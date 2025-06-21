import React, { useState, useCallback } from 'react';
import { Button, Card, LoadingSpinner, AudioPlayer } from '@gaowei/ui';
import { useMeetings } from '../hooks/useMeetings';
import type { Meeting } from '@gaowei/shared-types';

export function HistoryPage() {
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const {
    meetings,
    isLoading,
    error,
    deleteMeeting,
    fetchMeeting,
    clearError,
  } = useMeetings();

  // 查看会议详情
  const handleViewMeeting = useCallback(async (meetingId: string) => {
    try {
      const meeting = await fetchMeeting(meetingId);
      setSelectedMeeting(meeting);
    } catch (error) {
      console.error('获取会议详情失败:', error);
    }
  }, [fetchMeeting]);

  // 删除会议
  const handleDeleteMeeting = useCallback(async (meetingId: string) => {
    try {
      await deleteMeeting(meetingId);
      setShowDeleteConfirm(null);
      if (selectedMeeting?.id === meetingId) {
        setSelectedMeeting(null);
      }
    } catch (error) {
      console.error('删除会议失败:', error);
    }
  }, [deleteMeeting, selectedMeeting]);

  // 格式化日期
  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  // 渲染会议列表
  const renderMeetingList = () => {
    if (isLoading) {
      return (
        <LoadingSpinner 
          size="lg" 
          message="正在加载会议记录..." 
          className="py-12" 
        />
      );
    }

    if (meetings.length === 0) {
      return (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📝</div>
          <div className="text-xl font-medium text-gray-900 mb-2">
            暂无会议记录
          </div>
          <div className="text-gray-600 mb-6">
            上传您的第一个音频文件开始使用
          </div>
          <Button onClick={() => window.location.href = '/'}>
            立即上传
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {meetings.map((meeting) => (
          <Card key={meeting.id} className="p-6 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {meeting.title}
                </h3>
                <div className="text-sm text-gray-600 mb-2">
                  创建时间：{formatDate(meeting.created_at)}
                </div>
                <div className="text-sm text-gray-600 mb-4">
                  ID：{meeting.id}
                </div>
                
                {/* 转录状态 */}
                <div className="flex items-center space-x-4 mb-4">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    <span className="text-sm text-gray-600">
                      转录：{meeting.transcripts?.length || 0} 条记录
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewMeeting(meeting.id)}
                >
                  查看详情
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(meeting.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  删除
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  };

  // 渲染会议详情
  const renderMeetingDetail = () => {
    if (!selectedMeeting) return null;

    // 转换转录记录为音频播放器的segments格式
    const audioSegments = selectedMeeting.transcripts?.map((transcript, index) => ({
      start: index * 10, // 假设每段10秒，实际应该使用真实时间戳
      end: (index + 1) * 10,
      text: transcript.text || '',
      t0: index * 10,
      t1: (index + 1) * 10,
    })) || [];

    return (
      <Card className="p-6">
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            会议详情
          </h2>
          <Button
            variant="outline"
            onClick={() => setSelectedMeeting(null)}
          >
            返回列表
          </Button>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              基本信息
            </h3>
            <Card className="p-4 bg-gray-50">
              <div className="space-y-2">
                <div>
                  <span className="font-medium">标题：</span>
                  {selectedMeeting.title}
                </div>
                <div>
                  <span className="font-medium">创建时间：</span>
                  {formatDate(selectedMeeting.created_at)}
                </div>
                <div>
                  <span className="font-medium">最后更新：</span>
                  {formatDate(selectedMeeting.updated_at)}
                </div>
                <div>
                  <span className="font-medium">会议ID：</span>
                  {selectedMeeting.id}
                </div>
              </div>
            </Card>
          </div>

          {/* 音频播放器 */}
          {selectedMeeting.transcripts && selectedMeeting.transcripts.length > 0 && selectedMeeting.transcripts[0]?.audio_url && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                音频播放
              </h3>
              <Card className="p-4">
                <AudioPlayer
                  audioUrl={selectedMeeting.transcripts[0].audio_url}
                  segments={audioSegments}
                  showTranscript={true}
                />
              </Card>
            </div>
          )}

          {/* 转录记录 */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              转录记录 ({selectedMeeting.transcripts?.length || 0} 条)
            </h3>
            {selectedMeeting.transcripts && selectedMeeting.transcripts.length > 0 ? (
              <div className="space-y-4">
                {selectedMeeting.transcripts.map((transcript, index) => (
                  <Card key={transcript.id} className="p-4 bg-gray-50">
                    <div className="mb-3">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">转录 #{index + 1}</span>
                        <span className="text-sm text-gray-600">
                          {formatDate(transcript.timestamp)}
                        </span>
                      </div>
                    </div>
                    
                    {transcript.text && (
                      <div className="mb-4">
                        <h4 className="font-medium mb-2">转录文本：</h4>
                        <Card className="p-3 bg-white">
                          <div className="text-sm text-gray-700 max-h-32 overflow-y-auto">
                            {transcript.text}
                          </div>
                        </Card>
                      </div>
                    )}

                    {transcript.summary && (
                      <div>
                        <h4 className="font-medium mb-2">AI摘要：</h4>
                        <Card className="p-3 bg-blue-50">
                          <div className="text-sm text-gray-700">
                            {transcript.summary}
                          </div>
                        </Card>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center bg-gray-50">
                <div className="text-gray-500">
                  暂无转录记录
                </div>
              </Card>
            )}
          </div>
        </div>
      </Card>
    );
  };

  // 渲染删除确认对话框
  const renderDeleteConfirm = () => {
    if (!showDeleteConfirm) return null;

    const meeting = meetings.find(m => m.id === showDeleteConfirm);
    if (!meeting) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <Card className="max-w-md w-full p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            确认删除会议
          </h3>
          <p className="text-gray-600 mb-6">
            确定要删除会议 "{meeting.title}" 吗？此操作无法撤销。
          </p>
          <div className="flex space-x-4">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(null)}
              className="flex-1"
            >
              取消
            </Button>
            <Button
              onClick={() => handleDeleteMeeting(showDeleteConfirm)}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              删除
            </Button>
          </div>
        </Card>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          会议历史
        </h1>
        <p className="text-lg text-gray-600">
          查看和管理您的所有会议记录
        </p>
      </div>

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

      {/* 主要内容 */}
      {selectedMeeting ? renderMeetingDetail() : renderMeetingList()}

      {/* 删除确认对话框 */}
      {renderDeleteConfirm()}
    </div>
  );
} 