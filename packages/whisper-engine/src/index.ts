import type { TranscriptionResult, TranscriptionEngineType } from '@gaowei/shared-types'
import { spawn, ChildProcess } from 'child_process'
import axios from 'axios'
import FormData from 'form-data'
import { v4 as uuidv4 } from 'uuid'
import * as path from 'path'
import * as fs from 'fs'

// Whisper服务接口
export interface WhisperService {
  transcribe(audioBuffer: Buffer, options?: WhisperTranscriptionOptions): Promise<TranscriptionResult>
  isHealthy(): Promise<boolean>
  start(): Promise<void>
  stop(): Promise<void>
}

// 转录选项（重命名避免冲突）
export interface WhisperTranscriptionOptions {
  language?: string
  model?: string
  temperature?: number
  maxTokens?: number
  filename?: string
}

// 异步任务状态
export interface WhisperTaskStatus {
  task_id: string
  status: 'processing' | 'completed' | 'error'
  progress?: number
  progress_text?: string
  result?: TranscriptionResult
  error?: string
}

// 本地Whisper引擎实现
class LocalWhisperEngine implements WhisperService {
  private readonly serverUrl: string
  private readonly serverPort: number
  private readonly modelPath: string
  private pythonProcess: ChildProcess | null = null
  private isRunning = false
  private startPromise: Promise<void> | null = null

  constructor(options: {
    serverUrl?: string
    serverPort?: number
    modelPath?: string
  } = {}) {
    this.serverPort = options.serverPort || 8178
    this.serverUrl = options.serverUrl || `http://localhost:${this.serverPort}`
    this.modelPath = options.modelPath || 'small'
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return
    }

    if (this.startPromise) {
      return this.startPromise
    }

    this.startPromise = this._startPythonService()
    return this.startPromise
  }

  private async _startPythonService(): Promise<void> {
    return new Promise((resolve, reject) => {
      const pythonScript = path.join(__dirname, '..', 'src', 'python', 'app.py')
      
      console.log(`Starting Whisper Python service: ${pythonScript}`)
      console.log(`Port: ${this.serverPort}, Model: ${this.modelPath}`)

      // 检查Python脚本是否存在
      if (!fs.existsSync(pythonScript)) {
        reject(new Error(`Python script not found: ${pythonScript}`))
        return
      }

      this.pythonProcess = spawn('python', [
        pythonScript,
        '--port', this.serverPort.toString(),
        '--model-path', this.modelPath
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      })

      let isResolved = false

      this.pythonProcess.stdout?.on('data', (data) => {
        const output = data.toString()
        console.log(`Whisper service: ${output.trim()}`)
        
        // 检查服务是否启动成功
        if (output.includes('Starting Whisper service on') && !isResolved) {
          isResolved = true
          this.isRunning = true
          // 等待一下让服务完全启动
          setTimeout(() => resolve(), 2000)
        }
      })

      this.pythonProcess.stderr?.on('data', (data) => {
        const error = data.toString()
        console.error(`Whisper service error: ${error.trim()}`)
      })

      this.pythonProcess.on('error', (error) => {
        console.error('Failed to start Whisper service:', error)
        if (!isResolved) {
          isResolved = true
          reject(error)
        }
      })

      this.pythonProcess.on('exit', (code) => {
        console.log(`Whisper service exited with code ${code}`)
        this.isRunning = false
        this.pythonProcess = null
      })

      // 超时处理
      setTimeout(() => {
        if (!isResolved) {
          isResolved = true
          reject(new Error('Whisper service start timeout'))
        }
      }, 30000) // 30秒超时
    })
  }

  async stop(): Promise<void> {
    if (this.pythonProcess) {
      this.pythonProcess.kill('SIGTERM')
      
      // 等待进程结束
      await new Promise<void>((resolve) => {
        if (this.pythonProcess) {
          this.pythonProcess.on('exit', () => resolve())
          // 5秒后强制结束
          setTimeout(() => {
            if (this.pythonProcess) {
              this.pythonProcess.kill('SIGKILL')
            }
            resolve()
          }, 5000)
        } else {
          resolve()
        }
      })
    }
    
    this.isRunning = false
    this.pythonProcess = null
    this.startPromise = null
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.serverUrl}/health`, {
        timeout: 5000
      })
      return response.status === 200 && response.data.status === 'ok'
    } catch {
      return false
    }
  }

  async transcribe(audioBuffer: Buffer, options?: WhisperTranscriptionOptions): Promise<TranscriptionResult> {
    // 确保服务正在运行
    if (!this.isRunning) {
      await this.start()
    }

    // 再次检查健康状态
    const healthy = await this.isHealthy()
    if (!healthy) {
      throw new Error('Whisper服务不可用')
    }

    const startTime = Date.now()

    try {
      // 准备FormData
      const formData = new FormData()
      formData.append('file', audioBuffer, {
        filename: options?.filename || `audio_${Date.now()}.wav`,
        contentType: 'audio/wav'
      })

      if (options?.language) {
        formData.append('language', options.language)
      }

      // 发送转录请求
      const response = await axios.post(`${this.serverUrl}/transcribe`, formData, {
        headers: {
          ...formData.getHeaders(),
        },
        timeout: 300000, // 5分钟超时
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      })

      const data = response.data

      // 处理异步任务
      if (data.task_id) {
        return await this.waitForTaskCompletion(data.task_id)
      }

      // 处理同步结果
      return {
        text: data.text || '',
        language: data.language || 'unknown',
        confidence: 0.95, // Python服务没有返回confidence，使用默认值
        duration: (Date.now() - startTime) / 1000,
        segments: data.segments || [],
        model: this.modelPath
      }

    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error || error.message
        throw new Error(`转录失败: ${message}`)
      }
      throw new Error(`转录失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private async waitForTaskCompletion(taskId: string): Promise<TranscriptionResult> {
    const maxWaitTime = 300000 // 5分钟
    const pollInterval = 2000   // 2秒
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const response = await axios.get(`${this.serverUrl}/status/${taskId}`)
        const status: WhisperTaskStatus = response.data

        if (status.status === 'completed' && status.result) {
          return {
            text: status.result.text || '',
            language: status.result.language || 'unknown',
            confidence: 0.95,
            duration: status.result.duration || 0,
            segments: status.result.segments || [],
            model: this.modelPath
          }
        }

        if (status.status === 'error') {
          throw new Error(`转录任务失败: ${status.error}`)
        }

        // 继续等待
        await new Promise(resolve => setTimeout(resolve, pollInterval))

      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          throw new Error('转录任务未找到')
        }
        // 其他错误继续重试
        await new Promise(resolve => setTimeout(resolve, pollInterval))
      }
    }

    throw new Error('转录任务超时')
  }
}

// OpenAI Whisper引擎（通过API调用）
class OpenAIWhisperEngine implements WhisperService {
  private readonly apiKey: string
  private readonly baseURL: string

  constructor(apiKey: string, baseURL = 'https://api.openai.com/v1') {
    this.apiKey = apiKey
    this.baseURL = baseURL
  }

  async start(): Promise<void> {
    // OpenAI API不需要启动服务
  }

  async stop(): Promise<void> {
    // OpenAI API不需要停止服务
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseURL}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        timeout: 5000
      })
      return response.status === 200
    } catch {
      return false
    }
  }

  async transcribe(audioBuffer: Buffer, options?: WhisperTranscriptionOptions): Promise<TranscriptionResult> {
    const startTime = Date.now()

    try {
      const formData = new FormData()
      formData.append('file', audioBuffer, {
        filename: options?.filename || 'audio.wav',
        contentType: 'audio/wav'
      })
      formData.append('model', options?.model || 'whisper-1')
      
      if (options?.language) {
        formData.append('language', options.language)
      }

      const response = await axios.post(
        `${this.baseURL}/audio/transcriptions`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${this.apiKey}`
          },
          timeout: 120000 // 2分钟超时
        }
      )

      return {
        text: response.data.text || '',
        language: response.data.language || options?.language || 'unknown',
        confidence: 0.95,
        duration: (Date.now() - startTime) / 1000,
        segments: [], // OpenAI API默认不返回segments
        model: options?.model || 'whisper-1'
      }

    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error?.message || error.message
        throw new Error(`OpenAI转录失败: ${message}`)
      }
      throw new Error(`OpenAI转录失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

// 工厂函数
export function createWhisperEngine(
  type: TranscriptionEngineType = 'local',
  options?: {
    apiKey?: string
    serverUrl?: string
    serverPort?: number
    modelPath?: string
  }
): WhisperService {
  switch (type) {
    case 'local':
    case 'whisper-local':
      return new LocalWhisperEngine({
        serverUrl: options?.serverUrl,
        serverPort: options?.serverPort,
        modelPath: options?.modelPath
      })
    
    case 'openai-whisper':
    case 'whisper-openai':
      if (!options?.apiKey) {
        throw new Error('OpenAI API key is required')
      }
      return new OpenAIWhisperEngine(options.apiKey)
    
    default:
      throw new Error(`不支持的转录引擎类型: ${type}`)
  }
}

// 默认导出
export default createWhisperEngine

// 导出类
export { LocalWhisperEngine, OpenAIWhisperEngine } 