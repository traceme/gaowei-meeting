import type { WhisperEngineType } from '@gaowei/shared-types'

/**
 * 获取引擎的用户友好显示名称
 */
export function getEngineDisplayName(engineType: WhisperEngineType): string {
  switch (engineType) {
    case 'faster-whisper':
      return 'Faster-Whisper (Python)'
    case 'whisper-cpp':
      return 'Whisper.cpp (C++)'
    case 'openai':
      return 'OpenAI Whisper API'
    default:
      return '本地 Whisper'
  }
}

/**
 * 获取引擎的简短名称
 */
export function getEngineShortName(engineType: WhisperEngineType): string {
  switch (engineType) {
    case 'faster-whisper':
      return 'Faster-Whisper'
    case 'whisper-cpp':
      return 'Whisper.cpp'
    case 'openai':
      return 'OpenAI'
    default:
      return '本地引擎'
  }
}

/**
 * 获取引擎的特性描述
 */
export function getEngineDescription(engineType: WhisperEngineType): string {
  switch (engineType) {
    case 'faster-whisper':
      return '功能丰富，支持 GPU 加速，实时进度显示'
    case 'whisper-cpp':
      return '高性能 C++ 实现，低内存占用，快速启动'
    case 'openai':
      return '云端处理，高精度，需要 API 密钥'
    default:
      return '本地转录引擎'
  }
} 