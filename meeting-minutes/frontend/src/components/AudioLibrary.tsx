'use client';

import { useState, useEffect } from 'react';

interface AudioTask {
  id: string;
  filename: string;
  status: 'processing' | 'completed' | 'error';
  created_at: string;
  completed_at?: string;
  progress?: string;
  segments_processed?: number;
  total_text_length?: number;
  file_size_mb?: number;
  estimated_minutes?: number;
  error?: string;
}

interface AudioLibraryProps {
  onTaskSelect: (task: AudioTask) => void;
  onClose: () => void;
}

export function AudioLibrary({ onTaskSelect, onClose }: AudioLibraryProps) {
  const [tasks, setTasks] = useState<AudioTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTasks = async () => {
    try {
      console.log('🔍 AudioLibrary: Fetching tasks from http://localhost:8178/tasks');
      
      // 获取任务列表
      const tasksResponse = await fetch('http://localhost:8178/tasks');
      console.log('📡 Tasks response status:', tasksResponse.status);
      
      if (!tasksResponse.ok) {
        throw new Error(`Failed to fetch tasks: ${tasksResponse.status}`);
      }
      
      const tasksData = await tasksResponse.json();
      console.log('📊 Tasks data:', tasksData);
      
      // 获取每个任务的详细信息
      const taskDetails: AudioTask[] = [];
      
      for (const [taskId, status] of Object.entries(tasksData.tasks)) {
        try {
          console.log(`🔍 Fetching details for task: ${taskId}`);
          const detailResponse = await fetch(`http://localhost:8178/status/${taskId}`);
          
          if (detailResponse.ok) {
            const detail = await detailResponse.json();
            console.log(`📋 Task ${taskId} details:`, detail);
            
            taskDetails.push({
              id: taskId,
              filename: detail.filename || 'Unknown',
              status: detail.status || status,
              created_at: detail.created_at,
              completed_at: detail.completed_at,
              progress: detail.progress,
              segments_processed: detail.segments_processed,
              total_text_length: detail.total_text_length,
              file_size_mb: detail.file_size_mb,
              estimated_minutes: detail.estimated_minutes,
              error: detail.error
            });
          }
        } catch (err) {
          console.error(`❌ Failed to fetch details for task ${taskId}:`, err);
        }
      }
      
      // 按创建时间排序（最新的在前）
      taskDetails.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      console.log('✅ Final task details:', taskDetails);
      setTasks(taskDetails);
      setError(null);
    } catch (err) {
      console.error('❌ Failed to fetch tasks:', err);
      setError(err instanceof Error ? err.message : 'Failed to load audio files');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    console.log('🚀 AudioLibrary component mounted');
    fetchTasks();
  }, []);

  const handleRefresh = () => {
    console.log('🔄 Refreshing tasks');
    setRefreshing(true);
    fetchTasks();
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return 'Unknown';
    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    return `${hours}h ${remainingMinutes}m`;
  };

  const formatFileSize = (mb?: number) => {
    if (!mb) return 'Unknown';
    if (mb < 1) return `${Math.round(mb * 1024)} KB`;
    return `${mb.toFixed(1)} MB`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return '✅';
      case 'processing':
        return '🔄';
      case 'error':
        return '❌';
      default:
        return '⚪';
    }
  };

  console.log('🎨 AudioLibrary render - loading:', loading, 'error:', error, 'tasks:', tasks.length);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 shadow-xl max-h-[80vh] overflow-hidden">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
              <p className="text-gray-600">Loading audio library...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-6xl w-full mx-4 shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <h3 className="text-xl font-semibold text-gray-900">🎵 Audio Library (Debug)</h3>
            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-sm">
              {tasks.length} files
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
            >
              {refreshing ? '🔄 Refreshing...' : '🔄 Refresh'}
            </button>
            <button
              onClick={onClose}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-red-100 rounded-md hover:bg-red-200"
            >
              ❌ Close
            </button>
          </div>
        </div>

        {/* Debug Info */}
        <div className="mb-4 p-3 bg-gray-100 rounded-md text-sm">
          <strong>Debug Info:</strong><br />
          Loading: {loading ? 'true' : 'false'}<br />
          Error: {error || 'none'}<br />
          Tasks count: {tasks.length}<br />
          Refreshing: {refreshing ? 'true' : 'false'}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <p className="text-red-600 font-medium text-lg">❌ Failed to load audio library</p>
                <p className="text-gray-600 text-sm mt-1">{error}</p>
                <button
                  onClick={handleRefresh}
                  className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <p className="text-gray-600 font-medium text-lg">📂 No audio files found</p>
                <p className="text-gray-500 text-sm mt-1">Upload an audio file to get started</p>
                <button
                  onClick={handleRefresh}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  🔄 Refresh
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => task.status === 'completed' && onTaskSelect(task)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {/* File name and status */}
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="text-lg font-medium text-gray-900 truncate">
                          📄 {task.filename}
                        </h4>
                        <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(task.status)}`}>
                          <span>{getStatusIcon(task.status)}</span>
                          <span className="capitalize">{task.status}</span>
                        </span>
                      </div>

                      {/* Details grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="font-medium text-gray-700">Created:</span>
                          <br />
                          {formatDate(task.created_at)}
                        </div>
                        
                        {task.completed_at && (
                          <div>
                            <span className="font-medium text-gray-700">Completed:</span>
                            <br />
                            {formatDate(task.completed_at)}
                          </div>
                        )}
                        
                        {task.file_size_mb && (
                          <div>
                            <span className="font-medium text-gray-700">Size:</span>
                            <br />
                            {formatFileSize(task.file_size_mb)}
                          </div>
                        )}
                        
                        {task.estimated_minutes && (
                          <div>
                            <span className="font-medium text-gray-700">Duration:</span>
                            <br />
                            {formatDuration(task.estimated_minutes)}
                          </div>
                        )}
                      </div>

                      {/* Progress or results */}
                      {task.status === 'processing' && task.progress && (
                        <div className="mt-3 p-2 bg-blue-50 rounded-md">
                          <p className="text-sm text-blue-700">
                            🔄 {task.progress}
                            {task.segments_processed && ` (${task.segments_processed} segments)`}
                          </p>
                        </div>
                      )}

                      {task.status === 'completed' && task.total_text_length && (
                        <div className="mt-3 p-2 bg-green-50 rounded-md">
                          <p className="text-sm text-green-700">
                            ✅ Transcribed {task.segments_processed} segments, {task.total_text_length.toLocaleString()} characters
                          </p>
                        </div>
                      )}

                      {task.status === 'error' && task.error && (
                        <div className="mt-3 p-2 bg-red-50 rounded-md">
                          <p className="text-sm text-red-700">
                            ❌ {task.error}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Action button */}
                    {task.status === 'completed' && (
                      <div className="ml-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log('🎯 Selecting task:', task.id);
                            onTaskSelect(task);
                          }}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                          👁️ View Transcript
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}