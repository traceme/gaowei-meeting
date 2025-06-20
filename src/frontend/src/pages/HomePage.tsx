import { Link } from 'react-router-dom'

const HomePage = () => {
  return (
    <div className="max-w-4xl mx-auto">
      {/* 标题区域 */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          欢迎使用高维会议AI
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          基于先进的AI技术，为您提供专业的音频转录、智能摘要和实时同步播放服务
        </p>
      </div>

      {/* 功能卡片区域 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        <Link
          to="/upload"
          className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-200 hover:border-blue-300"
        >
          <div className="text-center">
            <div className="text-4xl mb-4">📤</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">上传音频</h3>
            <p className="text-gray-600">
              支持多种音频格式，拖拽上传，批量处理
            </p>
          </div>
        </Link>

        <Link
          to="/history"
          className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-200 hover:border-blue-300"
        >
          <div className="text-center">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">历史记录</h3>
            <p className="text-gray-600">
              查看所有处理过的音频文件和转录记录
            </p>
          </div>
        </Link>

        <Link
          to="/settings"
          className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-200 hover:border-blue-300"
        >
          <div className="text-center">
            <div className="text-4xl mb-4">⚙️</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">AI设置</h3>
            <p className="text-gray-600">
              配置AI服务提供商，本地或云端模式
            </p>
          </div>
        </Link>
      </div>

      {/* 特性介绍 */}
      <div className="bg-white rounded-lg shadow-md p-8 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          核心特性
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-start space-x-3">
            <div className="text-2xl">🎯</div>
            <div>
              <h4 className="font-semibold text-gray-900">词级精确时间戳</h4>
              <p className="text-gray-600">
                点击任意文字即可跳转到对应音频时间点
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="text-2xl">🔒</div>
            <div>
              <h4 className="font-semibold text-gray-900">隐私保护</h4>
              <p className="text-gray-600">
                支持完全本地化处理，保护数据隐私
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="text-2xl">🤖</div>
            <div>
              <h4 className="font-semibold text-gray-900">智能AI摘要</h4>
              <p className="text-gray-600">
                支持本地LLM和OpenAI等外接API
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="text-2xl">🌐</div>
            <div>
              <h4 className="font-semibold text-gray-900">多语言支持</h4>
              <p className="text-gray-600">
                支持中英文等多种语言自动识别
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 快速开始 */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          快速开始
        </h2>
        <p className="text-gray-600 mb-6">
          只需几个简单步骤，即可开始使用高维会议AI
        </p>
        <Link
          to="/upload"
          className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <span className="mr-2">📤</span>
          立即上传音频文件
        </Link>
      </div>
    </div>
  )
}

export default HomePage 