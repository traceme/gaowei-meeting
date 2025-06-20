import { useState } from 'react'

interface AIProviderConfig {
  type: 'local' | 'openai' | 'claude' | 'gemini'
  name: string
  icon: string
  description: string
  apiKey?: string
  baseUrl?: string
  model?: string
  status: 'connected' | 'disconnected' | 'testing'
}

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState<'ai' | 'system' | 'export' | 'about'>('ai')
  const [isTestingConnection, setIsTestingConnection] = useState(false)

  const [aiProviders, setAiProviders] = useState<AIProviderConfig[]>([
    {
      type: 'local',
      name: 'Ollama (本地)',
      icon: '🖥️',
      description: '本地部署的LLM，完全私有化，无需联网',
      baseUrl: 'http://localhost:11434',
      model: 'phi3',
      status: 'connected'
    },
    {
      type: 'openai',
      name: 'OpenAI GPT-4',
      icon: '🤖',
      description: '强大的云端AI服务，响应速度快，质量高',
      apiKey: '',
      model: 'gpt-4',
      status: 'disconnected'
    }
  ])

  const [selectedProvider, setSelectedProvider] = useState<string>('local')

  const testConnection = async (providerType: string) => {
    setIsTestingConnection(true)
    // 模拟连接测试
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    setAiProviders(prev => prev.map(provider => 
      provider.type === providerType 
        ? { ...provider, status: 'connected' as const }
        : provider
    ))
    setIsTestingConnection(false)
  }

  const tabs = [
    { id: 'ai', label: 'AI 设置', icon: '🤖' },
    { id: 'system', label: '系统设置', icon: '⚙️' },
    { id: 'about', label: '关于', icon: 'ℹ️' }
  ]

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">设置</h1>
        <p className="text-gray-600">
          配置AI服务提供商和系统偏好设置
        </p>
      </div>

      {/* 标签页导航 */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* AI 设置 */}
          {activeTab === 'ai' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  AI 服务提供商配置
                </h3>
                <p className="text-gray-600 mb-6">
                  选择并配置您的AI服务提供商。推荐使用本地Ollama以保护隐私。
                </p>
              </div>

              <div className="space-y-4">
                {aiProviders.map((provider) => (
                  <div
                    key={provider.type}
                    className={`border rounded-lg p-6 transition-colors ${
                      selectedProvider === provider.type
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4">
                        <input
                          type="radio"
                          name="aiProvider"
                          value={provider.type}
                          checked={selectedProvider === provider.type}
                          onChange={(e) => setSelectedProvider(e.target.value)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <span className="text-2xl">{provider.icon}</span>
                            <h4 className="text-lg font-semibold text-gray-900">
                              {provider.name}
                            </h4>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              provider.status === 'connected' 
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {provider.status === 'connected' ? '✅ 已连接' : '❌ 未连接'}
                            </span>
                          </div>
                          <p className="text-gray-600">{provider.description}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => testConnection(provider.type)}
                        disabled={isTestingConnection}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {isTestingConnection ? '测试中...' : '测试连接'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 系统设置 */}
          {activeTab === 'system' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  系统偏好设置
                </h3>
              </div>
              <div className="bg-blue-50 rounded-lg p-6">
                <p className="text-blue-800">系统设置功能正在开发中...</p>
              </div>
            </div>
          )}

          {/* 关于 */}
          {activeTab === 'about' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-6xl mb-4">🤖</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  高维会议AI
                </h3>
                <p className="text-gray-600 mb-4">版本 1.0.0</p>
                <p className="text-gray-600 max-w-2xl mx-auto">
                  基于先进的AI技术，为您提供专业的音频转录、智能摘要和实时同步播放服务。
                  完全本地化部署，保护您的数据隐私。
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SettingsPage 