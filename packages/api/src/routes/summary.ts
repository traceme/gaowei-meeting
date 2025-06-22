import { Router, type Request, type Response } from 'express';
import type { IRouter } from 'express';
import { AISummaryGenerator } from '../services/ai-summary.js';
import { MeetingManager } from '../services/meeting.js';
import { appConfig } from '../config/index.js';
import { sendSuccess, sendError } from '../middleware/index.js';

const router: IRouter = Router();
let aiSummaryGenerator: AISummaryGenerator;
let meetingManager: MeetingManager;

// 初始化服务
const initializeServices = () => {
  if (!aiSummaryGenerator) {
    aiSummaryGenerator = new AISummaryGenerator(appConfig);
  }
  if (!meetingManager) {
    meetingManager = new MeetingManager();
  }
  return { aiSummaryGenerator, meetingManager };
};

// AI摘要生成
router.post('/', async (req: Request, res: Response) => {
  try {
    const { aiSummaryGenerator } = initializeServices();
    const { meetingId, text, model } = req.body;

    if (!text) {
      return sendError(res, '转录文本不能为空', 400);
    }

    // 生成摘要
    const summaryResult = await aiSummaryGenerator.generateSummary(text, model);

    // 如果提供了会议ID，更新会议记录
    if (meetingId) {
      await meetingManager.updateMeeting(meetingId, {
        summary: summaryResult,
        status: 'completed',
      });
    }

    sendSuccess(res, {
      summary: {
        keyPoints: [], // 从summaryResult.text中解析，目前使用空数组
        actionItems: [], // 从summaryResult.text中解析，目前使用空数组
        summary: summaryResult.text,
        participants: [], // 从summaryResult.text中解析，目前使用空数组
        model: summaryResult.model,
        provider: summaryResult.provider,
        createdAt: summaryResult.createdAt,
      },
    });
  } catch (error) {
    sendError(
      res,
      error instanceof Error ? error.message : 'AI摘要生成失败',
      500
    );
  }
});

// 获取AI提供商状态
router.get('/providers/status', async (req: Request, res: Response) => {
  try {
    const { aiSummaryGenerator } = initializeServices();
    const status = await aiSummaryGenerator.getProviderStatus();

    sendSuccess(res, { providers: status });
  } catch (error) {
    sendError(
      res,
      error instanceof Error ? error.message : '获取AI提供商状态失败',
      500
    );
  }
});

// 完整处理流程（转录+摘要）
router.post('/process', async (req: Request, res: Response) => {
  try {
    const { meetingManager } = initializeServices();

    if (!req.file) {
      return sendError(res, '未上传文件', 400);
    }

    const { title, description, language, model } = req.body;

    // 创建会议
    const meeting = await meetingManager.createMeeting(
      title || `会议处理 - ${req.file.originalname}`,
      description || `完整处理: ${req.file.originalname}`
    );

    // 创建处理任务
    const processTask = await meetingManager.createProcessTask(meeting.id);

    // 更新会议状态
    await meetingManager.updateMeeting(meeting.id, {
      status: 'transcribing',
      audioPath: req.file.path,
    });

    // 开始异步处理
    processCompleteWorkflowInBackground(
      processTask.id,
      meeting.id,
      req.file.buffer,
      req.file.originalname,
      { language: language as string },
      model as string
    );

    sendSuccess(res, {
      message: '文件上传成功，完整处理已开始',
      meetingId: meeting.id,
      processTaskId: processTask.id,
    });
  } catch (error) {
    sendError(
      res,
      error instanceof Error ? error.message : '完整处理失败',
      500
    );
  }
});

// 处理任务状态查询
router.get('/process/:taskId', async (req: Request, res: Response) => {
  try {
    const { meetingManager } = initializeServices();
    const task = await meetingManager.getProcessTask(req.params.taskId!);

    if (!task) {
      return sendError(res, '处理任务不存在', 404);
    }

    sendSuccess(res, { task });
  } catch (error) {
    sendError(
      res,
      error instanceof Error ? error.message : '获取处理状态失败',
      500
    );
  }
});

// 后台完整处理函数
async function processCompleteWorkflowInBackground(
  processTaskId: string,
  meetingId: string,
  audioBuffer: Buffer,
  filename: string,
  transcriptionOptions: { language?: string },
  summaryModel?: string
) {
  const { aiSummaryGenerator, meetingManager } = initializeServices();

  try {
    // 步骤1: 转录
    await meetingManager.updateProcessTask(processTaskId, {
      status: 'processing',
      progress: 10,
    });

    // 这里需要引入转录功能 - 从其他路由模块获取
    // 为了简化，我们暂时跳过实际转录，直接模拟结果
    console.log(`🎙️ 开始转录文件: ${filename}`);

    // 实际项目中这里应该调用转录服务
    const mockTranscriptionResult = {
      text: '这是一个模拟的转录结果',
      segments: [],
      language: transcriptionOptions.language || 'zh-CN',
    };

    // 更新进度
    await meetingManager.updateProcessTask(processTaskId, {
      progress: 50,
    });

    // 步骤2: 生成摘要
    console.log(`🤖 开始生成AI摘要...`);
    const summaryResult = await aiSummaryGenerator.generateSummary(
      mockTranscriptionResult.text,
      summaryModel
    );

    // 更新最终结果
    await meetingManager.updateProcessTask(processTaskId, {
      status: 'completed',
      progress: 100,
      result: {
        transcription: mockTranscriptionResult,
        summary: summaryResult,
      },
    });

    // 更新会议状态
    await meetingManager.updateMeeting(meetingId, {
      transcription: mockTranscriptionResult,
      summary: summaryResult,
      status: 'completed',
    });

    console.log(`✅ 完整处理任务 ${processTaskId} 完成`);
  } catch (error) {
    // 更新任务状态为失败
    await meetingManager.updateProcessTask(processTaskId, {
      status: 'error',
      error: error instanceof Error ? error.message : '处理失败',
    });

    console.error(`❌ 完整处理任务 ${processTaskId} 失败:`, error);
  }
}

export default router;
