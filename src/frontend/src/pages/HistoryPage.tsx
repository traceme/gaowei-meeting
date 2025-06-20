import React, { useState, useEffect } from 'react';

interface TranscriptionTask {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  filename: string;
  progress: number;
  result?: {
    text: string;
    segments: Array<{
      start: number;
      end: number;
      text: string;
    }>;
    language: string;
  };
  error?: string;
  createdAt: string;
}

const HistoryPage: React.FC = () => {
  const [tasks, setTasks] = useState<TranscriptionTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'date' | 'filename' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // 获取历史记录
  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3002/api/tasks');
      const data = await response.json();
      setTasks(data.tasks || []);
    } catch (error) {
      console.error('获取历史记录失败:', error);
      // 使用模拟数据作为后备
      setTasks([
        {
          id: '1',
          filename: '产品会议-2024-01-15.mp3',
          status: 'completed',
          progress: 100,
          createdAt: '2024-01-15T10:30:00Z',
          result: {
            text: '今天我们讨论一下新产品的核心功能设计，主要包括用户界面的优化...',
            segments: [
              { start: 0, end: 10, text: '今天我们讨论一下新产品的核心功能设计' },
              { start: 10, end: 20, text: '主要包括用户界面的优化' }
            ],
            language: 'zh-CN'
          }
        },
        {
          id: '2',
          filename: '客户访谈-张总.wav',
          status: 'completed',
          progress: 100,
          createdAt: '2024-01-14T15:20:00Z',
          result: {
            text: '非常感谢您抽时间参与我们的产品访谈，请先介绍一下您的公司背景...',
            segments: [
              { start: 0, end: 15, text: '非常感谢您抽时间参与我们的产品访谈' },
              { start: 15, end: 30, text: '请先介绍一下您的公司背景' }
            ],
            language: 'zh-CN'
          }
        },
        {
          id: '3',
          filename: 'team-standup-meeting.mp3',
          status: 'processing',
          progress: 75,
          createdAt: '2024-01-15T09:00:00Z'
        },
        {
          id: '4',
          filename: '销售培训课程.m4a',
          status: 'error',
          progress: 0,
          createdAt: '2024-01-13T14:10:00Z',
          error: '文件格式不支持'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // 过滤和排序任务
  const filteredAndSortedTasks = tasks
    .filter(task => {
      // 状态过滤
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;
      
      // 搜索过滤
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          task.filename.toLowerCase().includes(searchLower) ||
          task.id.toLowerCase().includes(searchLower) ||
          (task.result?.text || '').toLowerCase().includes(searchLower)
        );
      }
      
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'filename':
          comparison = a.filename.localeCompare(b.filename);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // 批量选择
  const toggleTaskSelection = (taskId: string) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId);
    } else {
      newSelected.add(taskId);
    }
    setSelectedTasks(newSelected);
  };

  const selectAllTasks = () => {
    if (selectedTasks.size === filteredAndSortedTasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(filteredAndSortedTasks.map(task => task.id)));
    }
  };

  // 批量删除（模拟）
  const handleBatchDelete = () => {
    if (selectedTasks.size === 0) return;
    
    if (confirm(`确定要删除选中的 ${selectedTasks.size} 个任务吗？`)) {
      console.log('批量删除任务:', Array.from(selectedTasks));
      // 这里应该调用API删除
      setTasks(prev => prev.filter(task => !selectedTasks.has(task.id)));
      setSelectedTasks(new Set());
      alert('选中的任务已删除');
    }
  };

  // 格式化持续时间
  const formatDuration = (segments: any[]) => {
    if (!segments || segments.length === 0) return '未知';
    const lastSegment = segments[segments.length - 1];
    const totalSeconds = lastSegment?.end || 0;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return '✅ 已完成';
      case 'processing': return '⏳ 处理中';
      case 'error': return '❌ 失败';
      default: return '⏱️ 等待中';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载历史记录中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">历史记录</h1>
          <p className="text-gray-600">查看和管理所有处理过的音频文件和转录记录</p>
        </div>

        {/* 搜索和筛选 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <div className="flex-1 md:mr-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-400">🔍</span>
                </div>
                <input
                  type="text"
                  placeholder="搜索文件名或转录内容..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex space-x-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">全部状态</option>
                <option value="completed">已完成</option>
                <option value="processing">处理中</option>
                <option value="error">失败</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="date">按日期排序</option>
                <option value="filename">按文件名排序</option>
                <option value="status">按状态排序</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 focus:ring-blue-500 focus:border-blue-500"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        </div>

        {/* 批量操作 */}
        {selectedTasks.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center justify-between">
            <span className="text-blue-800">
              已选择 {selectedTasks.size} 个任务
            </span>
            <button
              onClick={handleBatchDelete}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              批量删除
            </button>
          </div>
        )}

        {/* 统计信息 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="text-2xl mr-3">📊</div>
              <div>
                <p className="text-sm text-gray-600">总计文件</p>
                <p className="text-2xl font-bold text-gray-900">{tasks.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="text-2xl mr-3">✅</div>
              <div>
                <p className="text-sm text-gray-600">已完成</p>
                <p className="text-2xl font-bold text-green-600">
                  {tasks.filter(t => t.status === 'completed').length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="text-2xl mr-3">⏳</div>
              <div>
                <p className="text-sm text-gray-600">处理中</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {tasks.filter(t => t.status === 'processing').length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="text-2xl mr-3">❌</div>
              <div>
                <p className="text-sm text-gray-600">失败</p>
                <p className="text-2xl font-bold text-red-600">
                  {tasks.filter(t => t.status === 'error').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 任务列表 */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {filteredAndSortedTasks.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-4xl mb-4">📭</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">暂无记录</h3>
              <p className="text-gray-600">
                {searchTerm || statusFilter !== 'all' 
                  ? '没有找到符合条件的记录' 
                  : '还没有任何转录记录，去上传第一个音频文件吧！'
                }
              </p>
            </div>
          ) : (
            <>
              {/* 表头 */}
              <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                <div className="flex items-center">
                  <div className="flex items-center mr-4">
                    <input
                      type="checkbox"
                      checked={selectedTasks.size === filteredAndSortedTasks.length && filteredAndSortedTasks.length > 0}
                      onChange={selectAllTasks}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-600">全选</span>
                  </div>
                  <div className="text-sm font-medium text-gray-700">
                    共 {filteredAndSortedTasks.length} 条记录
                  </div>
                </div>
              </div>

              {/* 任务列表 */}
              <div className="divide-y divide-gray-200">
                {filteredAndSortedTasks.map((task) => (
                  <div key={task.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start space-x-4">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedTasks.has(task.id)}
                          onChange={() => toggleTaskSelection(task.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <h3 className="text-lg font-medium text-gray-900 truncate">
                              {task.filename}
                            </h3>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                              {getStatusText(task.status)}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500">
                            {formatDate(task.createdAt)}
                          </div>
                        </div>

                        {task.status === 'processing' && (
                          <div className="mt-2">
                            <div className="bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${task.progress}%` }}
                              />
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              处理进度: {task.progress}%
                            </p>
                          </div>
                        )}

                        {task.result && (
                          <div className="mt-3">
                            <p className="text-sm text-gray-600 mb-2">
                              语言: {task.result.language} | 
                              时长: {formatDuration(task.result.segments)}
                            </p>
                            <p className="text-sm text-gray-800 line-clamp-3">
                              {task.result.text.substring(0, 200)}
                              {task.result.text.length > 200 && '...'}
                            </p>
                          </div>
                        )}

                        {task.error && (
                          <div className="mt-3">
                            <p className="text-sm text-red-600">
                              错误: {task.error}
                            </p>
                          </div>
                        )}

                        <div className="mt-4 flex space-x-3">
                          {task.status === 'completed' && (
                            <>
                              <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                                查看详情
                              </button>
                              <button className="text-green-600 hover:text-green-800 text-sm font-medium">
                                下载转录
                              </button>
                            </>
                          )}
                          <button className="text-red-600 hover:text-red-800 text-sm font-medium">
                            删除
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryPage; 