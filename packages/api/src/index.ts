import express, { type Application } from 'express'
import { createServer } from 'http'
import path from 'path'
import { fileURLToPath } from 'url'
import { appConfig } from './config/index.js'
import { setupMiddleware, setupErrorHandling } from './middleware/index.js'
import { DatabaseManager } from './database/index.js'
import { TranscriptionRouter, TranscriptionOptions } from './services/transcription.js'
import { AISummaryGenerator } from './services/ai-summary.js'
import { MeetingManager } from './services/meeting.js'
import type { TranscriptionResult } from '@gaowei/shared-types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app: Application = express()
const server = createServer(app)

// 初始化服务
const db = new DatabaseManager()
const transcriptionRouter = new TranscriptionRouter(appConfig)
const aiSummaryGenerator = new AISummaryGenerator(appConfig)
const meetingManager = new MeetingManager()

// 设置中间件
setupMiddleware(app, appConfig)

// 基础路由
app.get('/api/health', async (req, res) => {
  try {
    const healthData = await meetingManager.healthCheck()
    const transcriptionStatus = await transcriptionRouter.getEngineStatus()
    const aiStatus = await aiSummaryGenerator.getProviderStatus()
    
    res.json({
      ...healthData,
      services: {
        transcription: transcriptionStatus,
        ai: aiStatus
      }
    })
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : '未知错误'
    })
  }
})

app.get('/api/info', (req, res) => {
  res.json({
    name: '高维会议AI - 统一API服务',
    version: '1.0.0',
    description: '整合转录、AI摘要和会议管理的统一后端服务',
    features: [
      '多引擎音频转录（本地Whisper + OpenAI）',
      '多提供商AI摘要（Ollama + OpenAI + Claude）',
      '完整会议生命周期管理',
      '实时任务进度跟踪',
      '容错和降级机制'
    ],
    endpoints: {
      transcription: '/api/transcribe',
      summary: '/api/summary',
      meetings: '/api/meetings',
      upload: '/api/upload'
    }
  })
})

// 会议管理路由
app.get('/api/meetings', async (req: any, res: any) => {
  try {
    const { limit = 50, offset = 0 } = req.query
    const meetings = await meetingManager.listMeetings(
      parseInt(limit as string),
      parseInt(offset as string)
    )
    res.json({ meetings })
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : '获取会议列表失败'
    })
  }
})

app.post('/api/meetings', async (req: any, res: any) => {
  try {
    const { title, description } = req.body
    if (!title) {
      return res.status(400).json({ error: '会议标题不能为空' })
    }
    
    const meeting = await meetingManager.createMeeting(title, description)
    res.json({ meeting })
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : '创建会议失败'
    })
  }
})

app.get('/api/meetings/:id', async (req: any, res: any) => {
  try {
    const meeting = await meetingManager.getMeeting(req.params.id!)
    if (!meeting) {
      return res.status(404).json({ error: '会议不存在' })
    }
    res.json({ meeting })
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : '获取会议失败'
    })
  }
})

app.delete('/api/meetings/:id', async (req: any, res: any) => {
  try {
    const success = await meetingManager.deleteMeeting(req.params.id)
    if (!success) {
      return res.status(404).json({ error: '会议不存在' })
    }
    res.json({ message: '会议删除成功' })
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : '删除会议失败'
    })
  }
})

// 文件上传和转录路由
app.post('/api/upload', async (req: any, res: any) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未上传文件' })
    }

    const { meetingId, language } = req.body
    let currentMeetingId = meetingId

    // 如果没有提供会议ID，创建新会议
    if (!currentMeetingId) {
      const meeting = await meetingManager.createMeeting(
        `会议转录 - ${req.file.originalname}`,
        `上传文件: ${req.file.originalname}`
      )
      currentMeetingId = meeting.id
    }

    // 创建转录任务
    const task = await meetingManager.createTranscriptionTask(
      currentMeetingId,
      req.file.originalname
    )

    // 更新会议状态
    await meetingManager.updateMeeting(currentMeetingId, {
      status: 'transcribing',
      audioPath: req.file.path
    })

    // 开始异步转录
    processTranscriptionInBackground(task.id, req.file.buffer, req.file.originalname, {
      language: language as string
    })

    res.json({
      message: '文件上传成功，转录已开始',
      meetingId: currentMeetingId,
      taskId: task.id
    })
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : '文件上传失败'
    })
  }
})

// 转录状态查询
app.get('/api/transcription/:taskId', async (req: any, res: any) => {
  try {
    const task = await meetingManager.getTranscriptionTask(req.params.taskId)
    if (!task) {
      return res.status(404).json({ error: '转录任务不存在' })
    }
    res.json({ task })
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : '获取转录状态失败'
    })
  }
})

// AI摘要生成路由
app.post('/api/summary', async (req: any, res: any) => {
  try {
    const { meetingId, text, model } = req.body
    
    if (!text) {
      return res.status(400).json({ error: '转录文本不能为空' })
    }

    // 如果提供了会议ID，更新会议状态
    if (meetingId) {
      await meetingManager.updateMeeting(meetingId, {
        status: 'summarizing'
      })
    }

    const summary = await aiSummaryGenerator.generateSummary(text, model)
    
    // 如果提供了会议ID，保存摘要到会议
    if (meetingId) {
      await meetingManager.updateMeeting(meetingId, {
        summary,
        status: 'completed'
      })
    }

    res.json({ summary })
  } catch (error) {
    // 如果提供了会议ID，更新错误状态
    if (req.body.meetingId) {
      await meetingManager.updateMeeting(req.body.meetingId, {
        status: 'error',
        error: error instanceof Error ? error.message : '摘要生成失败'
      })
    }
    
    res.status(500).json({
      error: error instanceof Error ? error.message : '摘要生成失败'
    })
  }
})

// 完整处理流程路由（转录+摘要）
app.post('/api/process', async (req: any, res: any) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未上传文件' })
    }

    const { title, description, language, model } = req.body

    // 创建会议
    const meeting = await meetingManager.createMeeting(
      title || `完整处理 - ${req.file.originalname}`,
      description
    )

    // 创建处理任务
    const processTask = await meetingManager.createProcessTask(meeting.id)

    // 更新会议状态
    await meetingManager.updateMeeting(meeting.id, {
      status: 'transcribing',
      audioPath: req.file.path
    })

    // 开始异步处理
    processCompleteWorkflowInBackground(
      processTask.id,
      meeting.id,
      req.file.buffer,
      req.file.originalname,
      { language: language as string },
      model
    )

    res.json({
      message: '处理已开始',
      meetingId: meeting.id,
      processTaskId: processTask.id
    })
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : '处理失败'
    })
  }
})

// 处理任务状态查询
app.get('/api/process/:taskId', async (req: any, res: any) => {
  try {
    const task = await meetingManager.getProcessTask(req.params.taskId)
    if (!task) {
      return res.status(404).json({ error: '处理任务不存在' })
    }
    res.json({ task })
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : '获取处理状态失败'
    })
  }
})

// 服务状态路由
app.get('/api/services/status', async (req: any, res: any) => {
  try {
    const transcriptionStatus = await transcriptionRouter.getEngineStatus()
    const aiStatus = await aiSummaryGenerator.getProviderStatus()
    const stats = await meetingManager.getStatistics()
    
    res.json({
      transcription: transcriptionStatus,
      ai: aiStatus,
      statistics: stats
    })
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : '获取服务状态失败'
    })
  }
})

// 异步转录处理
async function processTranscriptionInBackground(
  taskId: string,
  audioBuffer: Buffer,
  filename: string,
  options: TranscriptionOptions
) {
  try {
    await meetingManager.updateTranscriptionTask(taskId, {
      status: 'processing',
      progress: 10
    })

    const result = await transcriptionRouter.transcribe(audioBuffer, filename, options)

    await meetingManager.updateTranscriptionTask(taskId, {
      status: 'completed',
      progress: 100,
      result
    })

    console.log(`✅ 转录任务 ${taskId} 完成`)
  } catch (error) {
    await meetingManager.updateTranscriptionTask(taskId, {
      status: 'error',
      progress: 0,
      error: error instanceof Error ? error.message : '转录失败'
    })

    console.error(`❌ 转录任务 ${taskId} 失败:`, error)
  }
}

// 异步完整处理流程
async function processCompleteWorkflowInBackground(
  processTaskId: string,
  meetingId: string,
  audioBuffer: Buffer,
  filename: string,
  transcriptionOptions: TranscriptionOptions,
  summaryModel?: string
) {
  try {
    // 阶段1：转录
    await meetingManager.updateProcessTask(processTaskId, {
      status: 'processing',
      progress: 10
    })

    const transcription = await transcriptionRouter.transcribe(audioBuffer, filename, transcriptionOptions)
    
    await meetingManager.updateProcessTask(processTaskId, {
      progress: 50
    })

    await meetingManager.updateMeeting(meetingId, {
      transcription,
      status: 'summarizing'
    })

    // 阶段2：摘要
    const summary = await aiSummaryGenerator.generateSummary(transcription.text, summaryModel)

    await meetingManager.updateProcessTask(processTaskId, {
      status: 'completed',
      progress: 100,
      result: {
        transcription,
        summary
      }
    })

    console.log(`✅ 完整处理任务 ${processTaskId} 完成`)
  } catch (error) {
    await meetingManager.updateProcessTask(processTaskId, {
      status: 'error',
      progress: 0,
      error: error instanceof Error ? error.message : '处理失败'
    })

    await meetingManager.updateMeeting(meetingId, {
      status: 'error',
      error: error instanceof Error ? error.message : '处理失败'
    })

    console.error(`❌ 完整处理任务 ${processTaskId} 失败:`, error)
  }
}

// 设置错误处理中间件（必须在所有路由之后）
setupErrorHandling(app)

// 启动服务器
const port = appConfig.port
server.listen(port, () => {
  console.log(`🚀 高维会议AI - 统一API服务启动成功`)
  console.log(`📡 服务地址: http://localhost:${port}`)
  console.log(`🔍 健康检查: http://localhost:${port}/api/health`)
  console.log(`📖 API信息: http://localhost:${port}/api/info`)
  console.log(`⚡ 功能特性:`)
  console.log(`   • 多引擎音频转录`)
  console.log(`   • 多提供商AI摘要`)
  console.log(`   • 完整会议管理`)
  console.log(`   • 实时进度跟踪`)
  console.log(`   • 容错降级机制`)
})

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('\n🛑 接收到 SIGTERM 信号，开始优雅关闭...')
  server.close(() => {
    console.log('✅ HTTP 服务器已关闭')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('\n🛑 接收到 SIGINT 信号，开始优雅关闭...')
  server.close(() => {
    console.log('✅ HTTP 服务器已关闭')
    process.exit(0)
  })
})

export default app 