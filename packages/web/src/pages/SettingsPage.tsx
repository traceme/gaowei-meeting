import React, { useState, useCallback, useEffect } from 'react';
import { Button, Card, LoadingSpinner } from '@gaowei/ui';
import { useApiStatus } from '../hooks/useApiStatus';

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'status' | 'api' | 'models' | 'about'>('status');
  const [apiKeys, setApiKeys] = useState({
    openai: '',
    anthropic: '',
    ollama: '',
    groq: '',
  });

  const { 
    isOnline, 
    isLoading, 
    error, 
    services, 
    statistics, 
    lastCheck, 
    refetch 
  } = useApiStatus();

  // 从本地存储加载API密钥状态
  useEffect(() => {
    const savedKeys = localStorage.getItem('api-keys-display');
    if (savedKeys) {
      try {
        const parsed = JSON.parse(savedKeys);
        setApiKeys(parsed);
      } catch (error) {
        console.error('Failed to parse saved API keys:', error);
      }
    }
  }, []);

  // 更新API密钥显示状态
  const updateApiKey = useCallback((provider: string, value: string) => {
    const newKeys = { ...apiKeys, [provider]: value };
    setApiKeys(newKeys);
    
    // 仅保存是否已配置的标识，不保存实际密钥
    const keyStatus = Object.fromEntries(
      Object.entries(newKeys).map(([key, val]) => [key, val ? '已配置' : ''])
    );
    localStorage.setItem('api-keys-display', JSON.stringify(keyStatus));
  }, [apiKeys]);

  // Tab按钮
  const TabButton = ({ id, label, active, onClick }: {
    id: string;
    label: string;
    active: boolean;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        active
          ? 'bg-blue-100 text-blue-700 border border-blue-300'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
      }`}
    >
      {label}
    </button>
  );

  // 渲染服务状态
  const renderServiceStatus = () => (
    <div className="space-y-6">
      {/* API连接状态 */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">API连接状态</h3>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={refetch}
            disabled={isLoading}
          >
            {isLoading ? '检查中...' : '重新检查'}
          </Button>
        </div>
        
        <div className="flex items-center mb-4">
          <div className={`w-3 h-3 rounded-full mr-3 ${
            isOnline ? 'bg-green-500' : 'bg-red-500'
          }`}></div>
          <span className="font-medium text-lg">
            {isOnline ? '✅ 服务正常' : '❌ 服务异常'}
          </span>
        </div>
        
        {error && (
          <Card className="p-4 bg-red-50 border-red-200 mb-4">
            <div className="text-red-800 text-sm">
              <strong>错误详情：</strong> {error}
            </div>
          </Card>
        )}
        
        {lastCheck && (
          <div className="text-sm text-gray-600">
            最后检查时间：{lastCheck.toLocaleString('zh-CN')}
          </div>
        )}
      </Card>

      {/* 统计信息 */}
      {statistics && (
        <Card className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-6">使用统计</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {statistics.totalMeetings}
              </div>
              <div className="text-sm text-gray-600">总会议数</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">
                {statistics.completedMeetings}
              </div>
              <div className="text-sm text-gray-600">已完成</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600 mb-2">
                {statistics.pendingTasks}
              </div>
              <div className="text-sm text-gray-600">处理中</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">
                {statistics.totalTranscriptionTasks}
              </div>
              <div className="text-sm text-gray-600">转录任务</div>
            </div>
          </div>
        </Card>
      )}

      {/* 服务状态详情 */}
      {services && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* 转录服务 */}
          <Card className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">转录服务状态</h3>
            <div className="space-y-3">
              {services.transcription.map((service, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-800">{service.name}</span>
                  <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full mr-2 ${
                      service.available ? 'bg-green-500' : 'bg-red-500'
                    }`}></div>
                    <span className={`text-sm font-medium ${
                      service.available ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {service.available ? '可用' : '不可用'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* AI服务 */}
          <Card className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">AI服务状态</h3>
            <div className="space-y-3">
              {services.ai.map((service, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-800">{service.name}</span>
                  <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full mr-2 ${
                      service.available ? 'bg-green-500' : 'bg-red-500'
                    }`}></div>
                    <span className={`text-sm font-medium ${
                      service.available ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {service.available ? '可用' : '不可用'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );

  // 渲染API配置
  const renderApiConfig = () => (
    <div className="space-y-6">
      <Card className="p-6 bg-amber-50 border-amber-200">
        <div className="flex items-start">
          <div className="text-amber-600 mr-3 text-xl">⚠️</div>
          <div>
            <h3 className="text-lg font-medium text-amber-900 mb-2">重要提示</h3>
            <div className="text-sm text-amber-800 space-y-2">
              <p>
                API密钥需要在服务器端环境变量中配置，此处仅用于显示配置状态。
              </p>
              <p>
                请联系系统管理员在服务器环境中配置以下环境变量：
                <code className="bg-amber-100 px-1 py-0.5 rounded text-xs ml-1">
                  OPENAI_API_KEY, ANTHROPIC_API_KEY, OLLAMA_BASE_URL
                </code>
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6">API密钥配置状态</h3>
        <div className="space-y-6">
          {/* OpenAI */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                OpenAI API Key
              </label>
              <span className={`text-xs px-2 py-1 rounded ${
                apiKeys.openai 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {apiKeys.openai ? '已配置' : '未配置'}
              </span>
            </div>
            <input
              type="password"
              value={apiKeys.openai}
              onChange={(e) => updateApiKey('openai', e.target.value)}
              placeholder="sk-..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="text-xs text-gray-500 mt-1">
              用于GPT模型的转录和AI摘要生成
            </div>
          </div>

          {/* Anthropic */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Anthropic API Key
              </label>
              <span className={`text-xs px-2 py-1 rounded ${
                apiKeys.anthropic 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {apiKeys.anthropic ? '已配置' : '未配置'}
              </span>
            </div>
            <input
              type="password"
              value={apiKeys.anthropic}
              onChange={(e) => updateApiKey('anthropic', e.target.value)}
              placeholder="sk-ant-..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="text-xs text-gray-500 mt-1">
              用于Claude模型的AI摘要生成
            </div>
          </div>

          {/* Groq */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Groq API Key
              </label>
              <span className={`text-xs px-2 py-1 rounded ${
                apiKeys.groq 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {apiKeys.groq ? '已配置' : '未配置'}
              </span>
            </div>
            <input
              type="password"
              value={apiKeys.groq}
              onChange={(e) => updateApiKey('groq', e.target.value)}
              placeholder="gsk_..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="text-xs text-gray-500 mt-1">
              用于快速语音转录服务
            </div>
          </div>

          {/* Ollama */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Ollama Base URL
              </label>
              <span className={`text-xs px-2 py-1 rounded ${
                apiKeys.ollama 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {apiKeys.ollama ? '已配置' : '默认配置'}
              </span>
            </div>
            <input
              type="text"
              value={apiKeys.ollama}
              onChange={(e) => updateApiKey('ollama', e.target.value)}
              placeholder="http://localhost:11434"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="text-xs text-gray-500 mt-1">
              本地Ollama服务地址，用于私有化AI模型
            </div>
          </div>
        </div>
      </Card>
    </div>
  );

  // 渲染模型配置
  const renderModelConfig = () => (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">推荐模型配置</h3>
        
        <div className="space-y-6">
          {/* 转录模型 */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">语音转录模型</h4>
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="p-4 border border-green-200 bg-green-50">
                <div className="flex items-center mb-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  <span className="font-medium">Whisper (本地)</span>
                </div>
                <div className="text-sm text-gray-600 mb-2">
                  高精度离线转录，保护隐私
                </div>
                <div className="text-xs text-green-700">
                  推荐：准确度高，数据安全
                </div>
              </Card>
              
              <Card className="p-4 border border-blue-200 bg-blue-50">
                <div className="flex items-center mb-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                  <span className="font-medium">OpenAI Whisper</span>
                </div>
                <div className="text-sm text-gray-600 mb-2">
                  云端转录，支持多语言
                </div>
                <div className="text-xs text-blue-700">
                  需要API密钥
                </div>
              </Card>
            </div>
          </div>

          {/* AI摘要模型 */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">AI摘要模型</h4>
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="p-4 border border-purple-200 bg-purple-50">
                <div className="flex items-center mb-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                  <span className="font-medium text-sm">GPT-4</span>
                </div>
                <div className="text-xs text-gray-600 mb-2">
                  最高质量摘要
                </div>
                <div className="text-xs text-purple-700">
                  OpenAI API
                </div>
              </Card>
              
              <Card className="p-4 border border-orange-200 bg-orange-50">
                <div className="flex items-center mb-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mr-2"></div>
                  <span className="font-medium text-sm">Claude 3</span>
                </div>
                <div className="text-xs text-gray-600 mb-2">
                  长文本处理强
                </div>
                <div className="text-xs text-orange-700">
                  Anthropic API
                </div>
              </Card>
              
              <Card className="p-4 border border-gray-200 bg-gray-50">
                <div className="flex items-center mb-2">
                  <div className="w-2 h-2 bg-gray-500 rounded-full mr-2"></div>
                  <span className="font-medium text-sm">Llama 3</span>
                </div>
                <div className="text-xs text-gray-600 mb-2">
                  本地部署选项
                </div>
                <div className="text-xs text-gray-700">
                  Ollama本地
                </div>
              </Card>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );

  // 渲染关于信息
  const renderAbout = () => (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">关于高维会议AI</h3>
        <div className="space-y-4">
          <div>
            <div className="font-medium text-gray-900 mb-2">版本信息</div>
            <div className="text-sm text-gray-600">
              版本：v1.0.0<br />
              构建时间：{new Date().toLocaleDateString('zh-CN')}<br />
              技术栈：React 19 + TypeScript + Vite + Express + Monorepo
            </div>
          </div>
          
          <div>
            <div className="font-medium text-gray-900 mb-2">功能特性</div>
            <div className="text-sm text-gray-600 space-y-1">
              <div>✅ 多格式音频文件转录支持</div>
              <div>✅ 本地Whisper引擎保护隐私</div>
              <div>✅ 多AI模型智能摘要生成</div>
              <div>✅ 实时处理进度显示</div>
              <div>✅ 会议记录管理和搜索</div>
              <div>✅ 响应式现代化界面</div>
            </div>
          </div>
          
          <div>
            <div className="font-medium text-gray-900 mb-2">技术架构</div>
            <div className="text-sm text-gray-600">
              采用现代化Monorepo架构，包含Web前端、API后端、共享UI组件库、
              类型定义包和独立的Whisper转录引擎，提供完整的端到端音频处理解决方案。
            </div>
          </div>
        </div>
      </Card>
      
      <Card className="p-6 text-center bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="text-2xl mb-2">🎵</div>
        <div className="font-medium text-gray-900 mb-2">
          让AI为您的会议增添智慧
        </div>
        <div className="text-sm text-gray-600">
          高效、智能、安全的会议转录与摘要平台
        </div>
      </Card>
    </div>
  );

  if (isLoading && !services) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <LoadingSpinner size="lg" message="正在加载设置..." />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          系统设置
        </h1>
        <p className="text-lg text-gray-600">
          查看系统状态、配置API和管理模型设置
        </p>
      </div>

      {/* Tab导航 */}
      <div className="flex space-x-2 mb-6 bg-gray-100 p-1 rounded-lg">
        <TabButton
          id="status"
          label="系统状态"
          active={activeTab === 'status'}
          onClick={() => setActiveTab('status')}
        />
        <TabButton
          id="api"
          label="API配置"
          active={activeTab === 'api'}
          onClick={() => setActiveTab('api')}
        />
        <TabButton
          id="models"
          label="模型配置"
          active={activeTab === 'models'}
          onClick={() => setActiveTab('models')}
        />
        <TabButton
          id="about"
          label="关于"
          active={activeTab === 'about'}
          onClick={() => setActiveTab('about')}
        />
      </div>

      {/* Tab内容 */}
      <div>
        {activeTab === 'status' && renderServiceStatus()}
        {activeTab === 'api' && renderApiConfig()}
        {activeTab === 'models' && renderModelConfig()}
        {activeTab === 'about' && renderAbout()}
      </div>
    </div>
  );
} 