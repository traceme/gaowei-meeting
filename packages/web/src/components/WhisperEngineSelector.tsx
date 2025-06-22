import React, { useState, useEffect } from 'react';
import type { WhisperEngineType, WhisperEngineConfig } from '@gaowei/shared-types';

interface WhisperEngineSelectorProps {
  selectedEngine: WhisperEngineType;
  onEngineChange: (engine: WhisperEngineType) => void;
  disabled?: boolean;
  className?: string;
}

export const WhisperEngineSelector: React.FC<WhisperEngineSelectorProps> = ({
  selectedEngine,
  onEngineChange,
  disabled = false,
  className = '',
}) => {
  const [engineStatus, setEngineStatus] = useState<Record<WhisperEngineType, 'checking' | 'available' | 'unavailable'>>({
    'faster-whisper': 'checking',
    'whisper-cpp': 'checking',
    'openai': 'checking',
  });

  // 引擎配置
  const engineConfigs: Record<WhisperEngineType, WhisperEngineConfig> = {
    'faster-whisper': {
      type: 'faster-whisper',
      port: 8178,
      enabled: true,
      description: 'Python版本，支持GPU加速，功能丰富',
      features: {
        realTimeProgress: true,
        multiLanguage: true,
        gpu: true,
        performance: 'high',
        memoryUsage: 'medium',
      },
    },
    'whisper-cpp': {
      type: 'whisper-cpp',
      port: 8081,
      enabled: true,
      description: 'C++原生实现，高性能，低内存消耗',
      features: {
        realTimeProgress: false,
        multiLanguage: true,
        gpu: false,
        performance: 'high',
        memoryUsage: 'low',
      },
    },
    'openai': {
      type: 'openai',
      enabled: false, // 默认禁用，需要API key
      description: 'OpenAI官方API，需要API密钥',
      features: {
        realTimeProgress: false,
        multiLanguage: true,
        gpu: true,
        performance: 'high',
        memoryUsage: 'low',
      },
    },
  };

  useEffect(() => {
    // 检查引擎可用性
    checkEngineAvailability();
    // 获取当前选择的引擎
    getCurrentEngine();
  }, []);

  const getCurrentEngine = async () => {
    try {
      const response = await fetch('/api/engine/current');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.engine) {
          onEngineChange(data.data.engine);
        }
      }
    } catch (error) {
      console.warn('Failed to get current engine:', error);
    }
  };

  const handleEngineSelection = async (engine: WhisperEngineType) => {
    try {
      const response = await fetch('/api/engine/select', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ engine }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          onEngineChange(engine);
          console.log('Engine switched to:', engine);
        } else {
          console.error('Failed to switch engine:', data.error);
        }
      } else {
        console.error('Failed to switch engine:', response.status);
      }
    } catch (error) {
      console.error('Error switching engine:', error);
      // 如果API调用失败，仍然更新本地状态
      onEngineChange(engine);
    }
  };

    const checkEngineAvailability = async () => {
    try {
      // 使用API获取引擎状态
      const response = await fetch('/api/engine/status');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.statuses) {
          setEngineStatus(data.data.statuses);
          return;
        }
      }
    } catch (error) {
      console.warn('Failed to get engine status from API, falling back to direct check:', error);
    }

    // 如果API调用失败，回退到直接检查
    const checkPromises = Object.keys(engineConfigs).map(async (engine) => {
      const engineType = engine as WhisperEngineType;
      const config = engineConfigs[engineType];
      
      if (!config.enabled) {
        return [engine, 'unavailable'];
      }

      try {
        // 检查服务是否可用
        if (config.port) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          
          const response = await fetch(`http://localhost:${config.port}/`, {
            method: 'GET',
            signal: controller.signal,
          }).catch(() => null);
          
          clearTimeout(timeoutId);
          return [engine, response?.ok ? 'available' : 'unavailable'];
        }
        
        return [engine, 'available'];
      } catch {
        return [engine, 'unavailable'];
      }
    });

    const results = await Promise.all(checkPromises);
    const newStatus: Record<WhisperEngineType, 'checking' | 'available' | 'unavailable'> = {
      'faster-whisper': 'checking',
      'whisper-cpp': 'checking', 
      'openai': 'checking',
    };

    results.forEach(([engine, status]) => {
      newStatus[engine as WhisperEngineType] = status as 'available' | 'unavailable';
    });

    setEngineStatus(newStatus);
  };

  const getStatusIcon = (engine: WhisperEngineType) => {
    const status = engineStatus[engine];
    switch (status) {
      case 'checking':
        return '🔄';
      case 'available':
        return '✅';
      case 'unavailable':
        return '❌';
    }
  };

  const getStatusText = (engine: WhisperEngineType) => {
    const status = engineStatus[engine];
    switch (status) {
      case 'checking':
        return '检查中...';
      case 'available':
        return '可用';
      case 'unavailable':
        return '不可用';
    }
  };

  const getPerformanceIcon = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'low':
        return '🐌';
      case 'medium':
        return '🚗';
      case 'high':
        return '🚀';
    }
  };

  const getMemoryIcon = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'low':
        return '💾';
      case 'medium':
        return '🗄️';
      case 'high':
        return '🏢';
    }
  };

  return (
    <div className={`whisper-engine-selector ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          选择转录引擎
        </h3>
        <p className="text-sm text-gray-600">
          选择最适合您需求的转录引擎。不同引擎有不同的性能特点。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(Object.keys(engineConfigs) as WhisperEngineType[])
          .filter(engine => engineConfigs[engine].enabled)
          .map((engine) => {
            const config = engineConfigs[engine];
            const isSelected = selectedEngine === engine;
            const isAvailable = engineStatus[engine] === 'available';
            const isDisabled = disabled || !isAvailable;

            return (
              <div
                key={engine}
                className={`
                  relative border-2 rounded-lg p-4 cursor-pointer transition-all duration-200
                  ${isSelected 
                    ? 'border-blue-500 bg-blue-50' 
                    : isAvailable 
                      ? 'border-gray-200 hover:border-gray-300' 
                      : 'border-gray-100 bg-gray-50'
                  }
                  ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                onClick={() => {
                  if (!isDisabled) {
                    handleEngineSelection(engine);
                  }
                }}
              >
                {/* 选中指示器 */}
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                  </div>
                )}

                {/* 引擎标题 */}
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-900">
                    {engine === 'faster-whisper' && 'Faster-Whisper'}
                    {engine === 'whisper-cpp' && 'Whisper.cpp'}
                    {engine === 'openai' && 'OpenAI Whisper'}
                  </h4>
                  <div className="flex items-center space-x-1">
                    <span className="text-lg">{getStatusIcon(engine)}</span>
                    <span className="text-xs text-gray-500">
                      {getStatusText(engine)}
                    </span>
                  </div>
                </div>

                {/* 引擎描述 */}
                <p className="text-sm text-gray-600 mb-3">
                  {config.description}
                </p>

                {/* 特性标签 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">性能:</span>
                    <span className="flex items-center space-x-1">
                      <span>{getPerformanceIcon(config.features.performance)}</span>
                      <span className="capitalize">{config.features.performance}</span>
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">内存占用:</span>
                    <span className="flex items-center space-x-1">
                      <span>{getMemoryIcon(config.features.memoryUsage)}</span>
                      <span className="capitalize">{config.features.memoryUsage}</span>
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1 mt-2">
                    {config.features.gpu && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                        🔥 GPU
                      </span>
                    )}
                    {config.features.realTimeProgress && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                        📊 实时进度
                      </span>
                    )}
                    {config.features.multiLanguage && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-800">
                        🌍 多语言
                      </span>
                    )}
                  </div>
                </div>

                {/* 不可用提示 */}
                {!isAvailable && (
                  <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700">
                    {engine === 'whisper-cpp' 
                      ? '需要编译C++服务器才能使用'
                      : engine === 'openai'
                      ? '需要配置OpenAI API密钥'
                      : '服务不可用，请检查服务状态'
                    }
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* 刷新按钮 */}
      <div className="mt-4 flex justify-center">
        <button
          onClick={checkEngineAvailability}
          disabled={disabled}
          className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
        >
          🔄 刷新状态
        </button>
      </div>
    </div>
  );
}; 