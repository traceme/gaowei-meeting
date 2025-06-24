// 会议管理服务 - 整合所有会议相关操作
import { SummaryResult } from './ai-summary.js';
import { DatabaseManager, type SearchFilters } from '../database/index.js';
import type {
  Meeting,
  TranscriptionTask,
  ProcessTask,
  TranscriptionResult,
} from '@gaowei/shared-types';
import { AISummaryGenerator } from './ai-summary.js';
import { appConfig } from '../config/index.js';

export interface MeetingData {
  id: string;
  title: string;
  description?: string;
  audioPath?: string;
  transcription?: TranscriptionResult;
  summary?: SummaryResult;
  status: 'pending' | 'transcribing' | 'summarizing' | 'completed' | 'error';
  createdAt: string;
  updatedAt: string;
  error?: string;
}

// 会议管理器 - 基于SQLite数据库
export class MeetingManager {
  private db: DatabaseManager;
  private aiSummaryGenerator: AISummaryGenerator;

  constructor(dbPath?: string) {
    this.db = new DatabaseManager(dbPath);
    // 初始化AI摘要生成器
    this.aiSummaryGenerator = new AISummaryGenerator(appConfig);
    console.log('📊 MeetingManager 已初始化并连接到数据库');
    console.log('🤖 AI摘要生成器已初始化');
  }

  // 会议管理
  async createMeeting(
    title: string,
    description?: string
  ): Promise<MeetingData> {
    const meeting = this.db.createMeeting(title, description);
    console.log(`📝 创建会议: ${title} (ID: ${meeting.id})`);

    return {
      id: meeting.id,
      title: meeting.title!,
      description: meeting.description,
      status: (meeting.status as any) || 'pending',
      createdAt: meeting.created_at!,
      updatedAt: meeting.updated_at!,
      audioPath: meeting.audio_path,
      transcription: meeting.transcription
        ? JSON.parse(meeting.transcription)
        : undefined,
      summary: meeting.summary ? JSON.parse(meeting.summary) : undefined,
      error: meeting.error,
    };
  }

  async getMeeting(id: string): Promise<MeetingData | null> {
    const meeting = this.db.getMeeting(id);
    if (!meeting) return null;

    return {
      id: meeting.id,
      title: meeting.title!,
      description: meeting.description,
      status: (meeting.status as any) || 'pending',
      createdAt: meeting.created_at!,
      updatedAt: meeting.updated_at!,
      audioPath: meeting.audio_path,
      transcription: meeting.transcription
        ? JSON.parse(meeting.transcription)
        : undefined,
      summary: meeting.summary ? JSON.parse(meeting.summary) : undefined,
      error: meeting.error,
    };
  }

  async updateMeeting(
    id: string,
    updates: Partial<MeetingData>
  ): Promise<MeetingData | null> {
    const meeting = this.db.getMeeting(id);
    if (!meeting) return null;

    // 转换更新数据到数据库格式
    const dbUpdates: Partial<Meeting> = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined)
      dbUpdates.description = updates.description;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.audioPath !== undefined)
      dbUpdates.audio_path = updates.audioPath;
    if (updates.transcription !== undefined)
      dbUpdates.transcription = JSON.stringify(updates.transcription);
    if (updates.summary !== undefined)
      dbUpdates.summary = JSON.stringify(updates.summary);
    if (updates.error !== undefined) dbUpdates.error = updates.error;

    const success = this.db.updateMeeting(id, dbUpdates);
    if (!success) return null;

    console.log(`📝 更新会议: ${meeting.title} (ID: ${id})`);
    return this.getMeeting(id);
  }

  async listMeetings(limit = 50, offset = 0): Promise<MeetingData[]> {
    const meetings = this.db.getAllMeetings({ limit, offset });

    return meetings.map(meeting => ({
      id: meeting.id,
      title: meeting.title!,
      description: meeting.description,
      status: (meeting.status as any) || 'pending',
      createdAt: meeting.created_at!,
      updatedAt: meeting.updated_at!,
      audioPath: meeting.audio_path,
      transcription: meeting.transcription
        ? JSON.parse(meeting.transcription)
        : undefined,
      summary: meeting.summary ? JSON.parse(meeting.summary) : undefined,
      error: meeting.error,
    }));
  }

  async deleteMeeting(id: string): Promise<boolean> {
    const meeting = this.db.getMeeting(id);
    if (!meeting) return false;

    const success = this.db.deleteMeeting(id);
    if (success) {
      console.log(`🗑️ 删除会议: ${meeting.title} (ID: ${id})`);
    }
    return success;
  }

  // 转录任务管理
  async createTranscriptionTask(
    meetingId: string,
    filename: string
  ): Promise<TranscriptionTask> {
    const task = this.db.createTranscriptionTask(meetingId, filename);
    console.log(`🎙️ 创建转录任务: ${filename} (任务ID: ${task.id})`);
    return task;
  }

  async getTranscriptionTask(id: string): Promise<TranscriptionTask | null> {
    return this.db.getTranscriptionTask(id);
  }

  async getAllTranscriptionTasks(filters?: {
    status?: string;
    title?: string;
    limit?: number;
    offset?: number;
  }): Promise<TranscriptionTask[]> {
    return this.db.getAllTranscriptionTasks(filters);
  }

  async deleteTask(taskId: string): Promise<boolean> {
    try {
      // 获取任务信息
      const task = this.db.getTranscriptionTask(taskId);
      if (!task) {
        console.log(`❌ 任务 ${taskId} 不存在`);
        return false;
      }

      // 删除转录任务
      const deleted = this.db.deleteTranscriptionTask(taskId);
      
      if (deleted) {
        console.log(`🗑️ 成功删除转录任务: ${taskId}`);
        
        // 可选：如果这是会议的唯一任务，也可以考虑删除会议记录
        // 这里我们保留会议记录，只删除转录任务
        
        return true;
      } else {
        console.log(`❌ 删除转录任务失败: ${taskId}`);
        return false;
      }
    } catch (error) {
      console.error(`删除任务 ${taskId} 时出错:`, error);
      return false;
    }
  }

  async updateTranscriptionTask(
    id: string,
    updates: Partial<TranscriptionTask>
  ): Promise<TranscriptionTask | null> {
    const task = this.db.getTranscriptionTask(id);
    if (!task) return null;

    // 转换更新数据格式，包括summary字段
    const dbUpdates: Partial<TranscriptionTask> = {};
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.progress !== undefined) dbUpdates.progress = updates.progress;
    if (updates.result !== undefined) dbUpdates.result = updates.result;
    if (updates.summary !== undefined) dbUpdates.summary = updates.summary;
    if (updates.error !== undefined) dbUpdates.error = updates.error;

    const success = this.db.updateTranscriptionTask(id, dbUpdates);
    if (!success) return null;

    // 如果转录完成，自动生成AI摘要并更新会议数据
    const updatedTask = this.db.getTranscriptionTask(id);
    if (updatedTask?.status === 'completed' && updatedTask.result && updatedTask.result.text) {
      // 异步生成AI摘要，不阻塞主流程
      this.generateAndSaveSummary(id, updatedTask.result.text).catch(error => {
        console.error(`为任务 ${id} 生成AI摘要失败:`, error);
      });

      // 更新会议数据
      await this.updateMeeting(task.meeting_id, {
        transcription: updatedTask.result,
        status: 'completed',
      });
    }

    return updatedTask;
  }

  // 生成并保存AI摘要的私有方法
  private async generateAndSaveSummary(taskId: string, transcriptText: string): Promise<void> {
    try {
      console.log(`🤖 开始为任务 ${taskId} 生成AI摘要...`);
      
      // 生成AI摘要
      const summaryResult = await this.aiSummaryGenerator.generateSummary(transcriptText);
      
      // 构造摘要对象
      const summary = {
        text: summaryResult.text,
        model: summaryResult.model,
        created_at: summaryResult.createdAt,
      };

      // 保存摘要到数据库
      const updateSuccess = this.db.updateTranscriptionTask(taskId, { summary });
      
      if (updateSuccess) {
        console.log(`✅ 任务 ${taskId} 的AI摘要已生成并保存`);
      } else {
        console.error(`❌ 保存任务 ${taskId} 的AI摘要失败`);
      }
    } catch (error) {
      console.error(`生成AI摘要失败:`, error);
      // 可以考虑保存错误信息到数据库
    }
  }

  async listTranscriptionTasks(
    meetingId?: string
  ): Promise<TranscriptionTask[]> {
    // Note: DatabaseManager doesn't have a direct method to list transcription tasks by meeting_id
    // For now, we'll return an empty array and this can be extended later
    console.warn('listTranscriptionTasks: 方法待实现');
    return [];
  }

  // 处理任务管理（转录+摘要）
  async createProcessTask(meetingId: string): Promise<ProcessTask> {
    const task = this.db.createProcessTask(meetingId);
    console.log(`⚡ 创建处理任务 (会议ID: ${meetingId}, 任务ID: ${task.id})`);
    return task;
  }

  async getProcessTask(id: string): Promise<ProcessTask | null> {
    return this.db.getProcessTask(id);
  }

  async updateProcessTask(
    id: string,
    updates: Partial<ProcessTask>
  ): Promise<ProcessTask | null> {
    const task = this.db.getProcessTask(id);
    if (!task) return null;

    // 转换更新数据格式
    const dbUpdates: Partial<ProcessTask> = {};
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.progress !== undefined) dbUpdates.progress = updates.progress;
    if (updates.result !== undefined) dbUpdates.result = updates.result;
    if (updates.error !== undefined) dbUpdates.error = updates.error;

    const success = this.db.updateProcessTask(id, dbUpdates);
    if (!success) return null;

    // 如果处理完成，更新会议数据
    const updatedTask = this.db.getProcessTask(id);
    if (updatedTask?.status === 'completed' && updatedTask.result) {
      await this.updateMeeting(task.meeting_id, {
        transcription: updatedTask.result.transcription,
        summary: updatedTask.result.summary,
        status: 'completed',
      });
    }

    return updatedTask;
  }

  async listProcessTasks(meetingId?: string): Promise<ProcessTask[]> {
    // Note: DatabaseManager doesn't have a direct method to list process tasks by meeting_id
    // For now, we'll return an empty array and this can be extended later
    console.warn('listProcessTasks: 方法待实现');
    return [];
  }

  // 存储转录结果
  async saveTranscript(
    meetingId: string,
    text: string,
    model: string,
    modelName: string,
    chunkSize?: number,
    overlap?: number
  ): Promise<void> {
    const meeting = await this.getMeeting(meetingId);
    if (!meeting) {
      throw new Error(`会议 ${meetingId} 不存在`);
    }

    // 保存转录数据到数据库
    this.db.saveTranscript(
      meetingId,
      text,
      model,
      modelName,
      chunkSize,
      overlap
    );

    const transcription: TranscriptionResult = {
      text,
      segments: [], // 基础实现，可以后续扩展
      language: 'unknown',
    };

    await this.updateMeeting(meetingId, {
      transcription,
      status: 'completed',
    });

    console.log(
      `💾 保存转录结果到会议 ${meetingId}, 文本长度: ${text.length}字符`
    );
  }

  // 模型配置存储
  async saveModelConfig(
    provider: string,
    model: string,
    whisperModel: string
  ): Promise<void> {
    this.db.saveModelConfig(provider, model, whisperModel);
    console.log(
      `⚙️ 保存模型配置: ${provider}/${model}, Whisper: ${whisperModel}`
    );
  }

  async getModelConfig(): Promise<any> {
    const config = this.db.getModelConfig();
    return (
      config || {
        provider: 'ollama',
        model: 'llama3.2:1b',
        whisperModel: 'base',
      }
    );
  }

  async saveApiKey(apiKey: string, provider: string): Promise<void> {
    this.db.saveApiKey(apiKey, provider);
    console.log(`🔑 保存API密钥: ${provider}`);
  }

  async getApiKey(provider: string): Promise<string | null> {
    return this.db.getApiKey(provider);
  }

  // 获取统计信息
  async getStatistics(): Promise<{
    totalMeetings: number;
    totalTranscriptionTasks: number;
    totalProcessTasks: number;
    completedMeetings: number;
    pendingTasks: number;
  }> {
    const dbStats = this.db.getStatistics();

    return {
      totalMeetings: dbStats.totalMeetings,
      totalTranscriptionTasks: dbStats.totalTranscripts, // 使用转录数量作为替代
      totalProcessTasks: dbStats.totalProcesses,
      completedMeetings: 0, // 需要在DatabaseManager中添加具体实现
      pendingTasks: 0, // 需要在DatabaseManager中添加具体实现
    };
  }

  // 健康检查
  async healthCheck(): Promise<{
    status: string;
    timestamp: string;
    database: string;
    statistics: any;
  }> {
    try {
      const statistics = await this.getStatistics();

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'connected',
        statistics,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: 'error',
        statistics: {
          error: error instanceof Error ? error.message : '未知错误',
        },
      };
    }
  }
}
