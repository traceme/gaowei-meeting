import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { mkdirSync, existsSync } from 'fs';
import Database from 'better-sqlite3';
import type {
  Meeting,
  Transcript,
  SummaryProcess,
  TranscriptChunk,
  ModelConfig,
  TranscriptionTask,
  ProcessTask,
} from '@gaowei/shared-types';

export interface DatabaseStats {
  totalMeetings: number;
  totalTranscripts: number;
  totalProcesses: number;
  recentActivity: string;
}

export interface SearchFilters {
  title?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export class DatabaseManager {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath: string = 'data/meeting_minutes.db') {
    this.dbPath = dbPath;
    this.ensureDirectoryExists();
    this.db = new Database(this.dbPath);
    this.initializeDatabase();
    console.log(`✅ 数据库初始化完成: ${this.dbPath}`);
  }

  private ensureDirectoryExists(): void {
    const dir = dirname(this.dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  private initializeDatabase(): void {
    // 开启 WAL 模式提升并发性能
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 1000');
    // 确保UTF-8编码
    this.db.pragma('encoding = "UTF-8"');

    // 创建会议表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meetings (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'pending',
        audio_path TEXT,
        transcription TEXT,
        summary TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // 创建转录表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS transcripts (
        id TEXT PRIMARY KEY,
        meeting_id TEXT NOT NULL,
        transcript TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        summary TEXT DEFAULT '',
        action_items TEXT DEFAULT '',
        key_points TEXT DEFAULT '',
        FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
      )
    `);

    // 创建转录任务表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS transcription_tasks (
        id TEXT PRIMARY KEY,
        meeting_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        progress INTEGER DEFAULT 0,
        result TEXT,
        summary TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
      )
    `);

    // 创建处理任务表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS process_tasks (
        id TEXT PRIMARY KEY,
        meeting_id TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        progress INTEGER DEFAULT 0,
        result TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
      )
    `);

    // 创建摘要处理表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS summary_processes (
        meeting_id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        error TEXT,
        result TEXT,
        start_time TEXT,
        end_time TEXT,
        chunk_count INTEGER DEFAULT 0,
        processing_time REAL DEFAULT 0.0,
        metadata TEXT,
        FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
      )
    `);

    // 创建转录块表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS transcript_chunks (
        meeting_id TEXT PRIMARY KEY,
        meeting_name TEXT,
        transcript_text TEXT NOT NULL,
        model TEXT NOT NULL,
        model_name TEXT NOT NULL,
        chunk_size INTEGER,
        overlap INTEGER,
        created_at TEXT NOT NULL,
        FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
      )
    `);

    // 数据库迁移：添加音频时长字段到 transcription_tasks 表
    try {
      this.db.exec(`
        ALTER TABLE transcription_tasks 
        ADD COLUMN duration TEXT
      `);
      console.log('✅ 数据库迁移: 添加 duration 字段到 transcription_tasks');
    } catch (error) {
      // 字段可能已存在，忽略错误
    }

    try {
      this.db.exec(`
        ALTER TABLE transcription_tasks 
        ADD COLUMN duration_seconds INTEGER
      `);
      console.log('✅ 数据库迁移: 添加 duration_seconds 字段到 transcription_tasks');
    } catch (error) {
      // 字段可能已存在，忽略错误
    }

    // 创建设置表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        whisperModel TEXT NOT NULL,
        api_keys TEXT
      )
    `);

    // 创建索引以提升查询性能
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_meetings_created_at ON meetings(created_at);
      CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
      CREATE INDEX IF NOT EXISTS idx_meetings_title ON meetings(title);
      CREATE INDEX IF NOT EXISTS idx_transcripts_meeting_id ON transcripts(meeting_id);
      CREATE INDEX IF NOT EXISTS idx_transcription_tasks_meeting_id ON transcription_tasks(meeting_id);
      CREATE INDEX IF NOT EXISTS idx_process_tasks_meeting_id ON process_tasks(meeting_id);
    `);

    // 插入默认设置
    const defaultSettings = this.db.prepare(`
      INSERT OR IGNORE INTO settings (id, provider, model, whisperModel, api_keys)
      VALUES (?, ?, ?, ?, ?)
    `);
    defaultSettings.run('default', 'openai', 'gpt-3.5-turbo', 'small', '{}');

    // 数据库迁移：为transcription_tasks表添加summary字段（如果不存在）
    try {
      this.db.exec(`
        ALTER TABLE transcription_tasks ADD COLUMN summary TEXT;
      `);
      console.log('✅ 已为transcription_tasks表添加summary字段');
    } catch (error: any) {
      // 字段已存在或其他错误，忽略
      if (!error.message?.includes('duplicate column name')) {
        console.warn('迁移警告:', error.message);
      }
    }
  }

  // ===== 会议管理 =====

  createMeeting(title: string, description?: string): Meeting {
    const now = new Date().toISOString();
    const id = `meeting_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const stmt = this.db.prepare(`
      INSERT INTO meetings (id, title, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(id, title, description || '', now, now);

    return {
      id,
      title,
      description,
      status: 'pending',
      created_at: now,
      updated_at: now,
    } as Meeting;
  }

  getMeeting(meetingId: string): Meeting | null {
    const stmt = this.db.prepare(`
      SELECT * FROM meetings WHERE id = ?
    `);
    return stmt.get(meetingId) as Meeting | null;
  }

  updateMeeting(meetingId: string, updates: Partial<Meeting>): boolean {
    const now = new Date().toISOString();
    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) return false;

    fields.push('updated_at = ?');
    values.push(now, meetingId);

    const stmt = this.db.prepare(`
      UPDATE meetings SET ${fields.join(', ')} WHERE id = ?
    `);

    const result = stmt.run(...values);
    return result.changes > 0;
  }

  getAllMeetings(filters: SearchFilters = {}): Meeting[] {
    let query = 'SELECT * FROM meetings WHERE 1=1';
    const params: any[] = [];

    if (filters.title) {
      query += ' AND title LIKE ?';
      params.push(`%${filters.title}%`);
    }

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.dateFrom) {
      query += ' AND created_at >= ?';
      params.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      query += ' AND created_at <= ?';
      params.push(filters.dateTo);
    }

    query += ' ORDER BY created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as Meeting[];
  }

  deleteMeeting(meetingId: string): boolean {
    const stmt = this.db.prepare('DELETE FROM meetings WHERE id = ?');
    const result = stmt.run(meetingId);
    return result.changes > 0;
  }

  searchMeetings(query: string, limit: number = 10): Meeting[] {
    const stmt = this.db.prepare(`
      SELECT * FROM meetings 
      WHERE title LIKE ? OR description LIKE ?
      ORDER BY created_at DESC 
      LIMIT ?
    `);
    return stmt.all(`%${query}%`, `%${query}%`, limit) as Meeting[];
  }

  // ===== 转录任务管理 =====

  createTranscriptionTask(
    meetingId: string, 
    filename: string, 
    duration?: string,
    durationSeconds?: number
  ): TranscriptionTask {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    // 确保文件名正确存储UTF-8编码
    let safeFilename: string;
    try {
      // 验证和处理文件名编码
      safeFilename = Buffer.from(filename, 'utf8').toString('utf8');
      console.log(`📁 数据库存储文件名: ${safeFilename}`);
    } catch (error) {
      console.warn('文件名编码处理失败，使用安全名称:', error);
      safeFilename = `音频文件_${Date.now()}`;
    }

    const stmt = this.db.prepare(`
      INSERT INTO transcription_tasks (
        id, meeting_id, filename, status, progress, created_at, updated_at, duration, duration_seconds
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      taskId, 
      meetingId, 
      safeFilename,  // 使用处理过的安全文件名
      'pending', 
      0, 
      now, 
      now,
      duration || null,
      durationSeconds || null
    );

    console.log(`📊 转录任务已创建: ${safeFilename} (任务ID: ${taskId})`);

    return {
      id: taskId,
      meeting_id: meetingId,
      filename: safeFilename,
      status: 'pending',
      progress: 0,
      created_at: now,
      updated_at: now,
      duration,
      duration_seconds: durationSeconds,
    };
  }

  updateTranscriptionTask(
    taskId: string, 
    updates: Partial<TranscriptionTask>
  ): boolean {
    const now = new Date().toISOString();
    const fields: string[] = [];
    const values: any[] = [];

    // 构建动态更新查询
    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'created_at' && value !== undefined) {
        if (key === 'result' || key === 'summary') {
          // JSON字段需要序列化
          fields.push(`${key} = ?`);
          values.push(typeof value === 'string' ? value : JSON.stringify(value));
        } else if (key === 'filename') {
          // 直接使用传入的文件名，应该已经是正确的UTF-8编码
          fields.push(`${key} = ?`);
          values.push(value as string);
        } else {
          fields.push(`${key} = ?`);
          values.push(value);
        }
      }
    });

    if (fields.length === 0) return false;

    fields.push('updated_at = ?');
    values.push(now, taskId);

    const stmt = this.db.prepare(`
      UPDATE transcription_tasks SET ${fields.join(', ')} WHERE id = ?
    `);

    const result = stmt.run(...values);
    const success = result.changes > 0;
    
    if (success) {
      console.log(`📊 转录任务已更新: ${taskId}`);
    }
    
    return success;
  }

  deleteTranscriptionTask(taskId: string): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM transcription_tasks WHERE id = ?
    `);
    
    const result = stmt.run(taskId);
    const success = result.changes > 0;
    
    if (success) {
      console.log(`🗑️ 转录任务已删除: ${taskId}`);
    }
    
    return success;
  }

  getTranscriptionTask(taskId: string): TranscriptionTask | null {
    const stmt = this.db.prepare(`
      SELECT * FROM transcription_tasks WHERE id = ?
    `);
    const task = stmt.get(taskId) as TranscriptionTask | null;
    
    if (task) {
      // 解析result字段
      if (task.result && typeof task.result === 'string') {
        try {
          task.result = JSON.parse(task.result);
        } catch (error) {
          console.warn(`Failed to parse result JSON for task ${taskId}:`, error);
        }
      }
      
      // 解析summary字段
      if (task.summary && typeof task.summary === 'string') {
        try {
          task.summary = JSON.parse(task.summary as unknown as string);
        } catch (error) {
          console.warn(`Failed to parse summary JSON for task ${taskId}:`, error);
        }
      }
    }
    
    return task;
  }

  getAllTranscriptionTasks(filters: SearchFilters = {}): TranscriptionTask[] {
    let query = `
      SELECT * FROM transcription_tasks
    `;
    const conditions: string[] = [];
    const params: any[] = [];

    // 状态过滤
    if (filters.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }

    // 文件名搜索
    if (filters.title) {
      conditions.push('filename LIKE ?');
      params.push(`%${filters.title}%`);
    }

    // 日期过滤
    if (filters.dateFrom) {
      conditions.push('created_at >= ?');
      params.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      conditions.push('created_at <= ?');
      params.push(filters.dateTo);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    // 排序：最新的在前
    query += ' ORDER BY created_at DESC';

    // 分页
    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }

    const stmt = this.db.prepare(query);
    const tasks = stmt.all(...params) as TranscriptionTask[];

    // 解析JSON字段
    return tasks.map(task => ({
      ...task,
      result: task.result ? JSON.parse(task.result as unknown as string) : undefined,
      summary: task.summary ? JSON.parse(task.summary as unknown as string) : undefined,
    }));
  }

  updateTranscriptionTask(
    taskId: string,
    updates: Partial<TranscriptionTask>
  ): boolean {
    const now = new Date().toISOString();
    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = ?`);
        values.push(typeof value === 'object' ? JSON.stringify(value) : value);
      }
    });

    if (fields.length === 0) return false;

    fields.push('updated_at = ?');
    values.push(now, taskId);

    const stmt = this.db.prepare(`
      UPDATE transcription_tasks SET ${fields.join(', ')} WHERE id = ?
    `);

    const result = stmt.run(...values);
    return result.changes > 0;
  }

  deleteTranscriptionTask(taskId: string): boolean {
    try {
      const stmt = this.db.prepare(`
        DELETE FROM transcription_tasks WHERE id = ?
      `);

      const result = stmt.run(taskId);
      return result.changes > 0;
    } catch (error) {
      console.error('删除转录任务失败:', error);
      return false;
    }
  }

  // ===== 处理任务管理 =====

  createProcessTask(meetingId: string): ProcessTask {
    const now = new Date().toISOString();
    const id = `process_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const stmt = this.db.prepare(`
      INSERT INTO process_tasks (id, meeting_id, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(id, meetingId, now, now);

    return {
      id,
      meeting_id: meetingId,
      status: 'pending',
      progress: 0,
      created_at: now,
      updated_at: now,
    };
  }

  getProcessTask(taskId: string): ProcessTask | null {
    const stmt = this.db.prepare(`
      SELECT * FROM process_tasks WHERE id = ?
    `);
    return stmt.get(taskId) as ProcessTask | null;
  }

  updateProcessTask(taskId: string, updates: Partial<ProcessTask>): boolean {
    const now = new Date().toISOString();
    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = ?`);
        values.push(typeof value === 'object' ? JSON.stringify(value) : value);
      }
    });

    if (fields.length === 0) return false;

    fields.push('updated_at = ?');
    values.push(now, taskId);

    const stmt = this.db.prepare(`
      UPDATE process_tasks SET ${fields.join(', ')} WHERE id = ?
    `);

    const result = stmt.run(...values);
    return result.changes > 0;
  }

  // ===== 转录管理 =====

  saveMeetingTranscript(
    meetingId: string,
    transcript: string,
    timestamp: string,
    summary: string = '',
    actionItems: string = '',
    keyPoints: string = ''
  ): void {
    const transcriptId = `${meetingId}_${Date.now()}`;
    const stmt = this.db.prepare(`
      INSERT INTO transcripts (id, meeting_id, transcript, timestamp, summary, action_items, key_points)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      transcriptId,
      meetingId,
      transcript,
      timestamp,
      summary,
      actionItems,
      keyPoints
    );
  }

  saveTranscript(
    meetingId: string,
    transcriptText: string,
    model: string,
    modelName: string,
    chunkSize?: number,
    overlap?: number
  ): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO transcript_chunks 
      (meeting_id, transcript_text, model, model_name, chunk_size, overlap, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      meetingId,
      transcriptText,
      model,
      modelName,
      chunkSize || null,
      overlap || null,
      now
    );
  }

  getTranscriptData(meetingId: string): TranscriptChunk | null {
    const stmt = this.db.prepare(`
      SELECT * FROM transcript_chunks WHERE meeting_id = ?
    `);
    return stmt.get(meetingId) as TranscriptChunk | null;
  }

  updateMeetingName(meetingId: string, meetingName: string): void {
    const now = new Date().toISOString();

    // 更新会议表
    const updateMeeting = this.db.prepare(`
      UPDATE meetings SET title = ?, updated_at = ? WHERE id = ?
    `);
    updateMeeting.run(meetingName, now, meetingId);

    // 更新转录块表
    const updateChunk = this.db.prepare(`
      UPDATE transcript_chunks SET meeting_name = ? WHERE meeting_id = ?
    `);
    updateChunk.run(meetingName, meetingId);
  }

  // ===== 摘要处理管理 =====

  createProcess(meetingId: string): string {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO summary_processes 
      (meeting_id, status, created_at, updated_at, start_time)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(meetingId, 'PENDING', now, now, now);
    return meetingId;
  }

  updateProcess(
    meetingId: string,
    status: string,
    result?: object,
    error?: string,
    chunkCount?: number,
    processingTime?: number,
    metadata?: object
  ): void {
    const now = new Date().toISOString();
    const fields = ['status = ?', 'updated_at = ?'];
    const values: any[] = [status, now];

    if (result) {
      fields.push('result = ?');
      values.push(JSON.stringify(result));
    }
    if (error) {
      fields.push('error = ?');
      values.push(error);
    }
    if (chunkCount !== undefined) {
      fields.push('chunk_count = ?');
      values.push(chunkCount);
    }
    if (processingTime !== undefined) {
      fields.push('processing_time = ?');
      values.push(processingTime);
    }
    if (metadata) {
      fields.push('metadata = ?');
      values.push(JSON.stringify(metadata));
    }
    if (status === 'COMPLETED' || status === 'FAILED') {
      fields.push('end_time = ?');
      values.push(now);
    }

    values.push(meetingId);

    const stmt = this.db.prepare(`
      UPDATE summary_processes SET ${fields.join(', ')} WHERE meeting_id = ?
    `);

    stmt.run(...values);
  }

  // ===== 设置管理 =====

  getModelConfig(): ModelConfig | null {
    const stmt = this.db.prepare(`
      SELECT * FROM settings WHERE id = 'default'
    `);
    const result = stmt.get() as any;
    return result
      ? {
          id: result.id,
          provider: result.provider,
          model: result.model,
          whisperModel: result.whisperModel,
        }
      : null;
  }

  saveModelConfig(provider: string, model: string, whisperModel: string): void {
    const stmt = this.db.prepare(`
      UPDATE settings SET provider = ?, model = ?, whisperModel = ? WHERE id = 'default'
    `);
    stmt.run(provider, model, whisperModel);
  }

  // ===== API密钥管理 =====

  saveApiKey(apiKey: string, provider: string): void {
    // 从数据库获取当前API密钥配置
    const stmt = this.db.prepare(
      `SELECT api_keys FROM settings WHERE id = 'default'`
    );
    const result = stmt.get() as any;

    let apiKeys: Record<string, string> = {};
    if (result?.api_keys) {
      try {
        apiKeys = JSON.parse(result.api_keys);
      } catch (e) {
        // 忽略解析错误，使用空对象
      }
    }

    // 更新指定提供商的API密钥
    apiKeys[provider] = apiKey;

    // 保存回数据库
    const updateStmt = this.db.prepare(`
      UPDATE settings SET api_keys = ? WHERE id = 'default'
    `);
    updateStmt.run(JSON.stringify(apiKeys));
  }

  getApiKey(provider: string): string | null {
    // 优先从环境变量获取
    const keyMap: Record<string, string> = {
      groq: 'GROQ_API_KEY',
      openai: 'OPENAI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      ollama: 'OLLAMA_API_KEY',
    };

    const envKey = keyMap[provider];
    if (envKey && process.env[envKey]) {
      return process.env[envKey]!;
    }

    // 从数据库获取
    const stmt = this.db.prepare(
      `SELECT api_keys FROM settings WHERE id = 'default'`
    );
    const result = stmt.get() as any;

    if (result?.api_keys) {
      try {
        const apiKeys = JSON.parse(result.api_keys);
        return apiKeys[provider] || null;
      } catch (e) {
        return null;
      }
    }

    return null;
  }

  deleteApiKey(provider: string): void {
    const stmt = this.db.prepare(
      `SELECT api_keys FROM settings WHERE id = 'default'`
    );
    const result = stmt.get() as any;

    if (result?.api_keys) {
      try {
        const apiKeys = JSON.parse(result.api_keys);
        delete apiKeys[provider];

        const updateStmt = this.db.prepare(`
          UPDATE settings SET api_keys = ? WHERE id = 'default'
        `);
        updateStmt.run(JSON.stringify(apiKeys));
      } catch (e) {
        // 忽略错误
      }
    }
  }

  // ===== 统计和分析 =====

  getStatistics(): DatabaseStats {
    const totalMeetings = this.db
      .prepare('SELECT COUNT(*) as count FROM meetings')
      .get() as any;
    const totalTranscripts = this.db
      .prepare('SELECT COUNT(*) as count FROM transcripts')
      .get() as any;
    const totalProcesses = this.db
      .prepare('SELECT COUNT(*) as count FROM summary_processes')
      .get() as any;
    const recentActivity = this.db
      .prepare(
        `
      SELECT created_at FROM meetings 
      ORDER BY created_at DESC 
      LIMIT 1
    `
      )
      .get() as any;

    return {
      totalMeetings: totalMeetings.count,
      totalTranscripts: totalTranscripts.count,
      totalProcesses: totalProcesses.count,
      recentActivity: recentActivity?.created_at || 'N/A',
    };
  }

  // ===== 数据备份和恢复 =====

  backup(backupPath: string): boolean {
    try {
      const backup = this.db.backup(backupPath);
      backup.step(-1);
      backup.finish();
      console.log(`✅ 数据库备份完成: ${backupPath}`);
      return true;
    } catch (error) {
      console.error(`❌ 数据库备份失败:`, error);
      return false;
    }
  }

  restore(backupPath: string): boolean {
    try {
      this.close();
      // 复制备份文件到当前数据库路径
      const fs = require('fs');
      fs.copyFileSync(backupPath, this.dbPath);

      // 重新初始化数据库连接
      this.db = new Database(this.dbPath);
      console.log(`✅ 数据库恢复完成: ${backupPath}`);
      return true;
    } catch (error) {
      console.error(`❌ 数据库恢复失败:`, error);
      return false;
    }
  }

  // ===== 清理和关闭 =====

  close(): void {
    if (this.db) {
      this.db.close();
      console.log('✅ 数据库连接已关闭');
    }
  }

  vacuum(): void {
    this.db.exec('VACUUM');
    console.log('✅ 数据库已优化');
  }
}

export default DatabaseManager;
