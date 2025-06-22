import type {
  Meeting,
  TranscriptionTask,
  SummaryResponse,
} from '@gaowei/shared-types';

const API_BASE = '/api';

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// 通用请求函数
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      message: response.statusText,
    }));

    throw new ApiError(
      errorData.error?.message || errorData.message || '请求失败',
      response.status,
      errorData.error?.code
    );
  }

  return response.json();
}

// 健康检查
export async function getHealthStatus() {
  return request<{
    status: string;
    timestamp: string;
    database: string;
    statistics: {
      totalMeetings: number;
      totalTranscriptionTasks: number;
      totalProcessTasks: number;
      completedMeetings: number;
      pendingTasks: number;
    };
    services: {
      transcription: Array<{ name: string; available: boolean }>;
      ai: Array<{ name: string; available: boolean }>;
    };
  }>('/health');
}

// API信息
export async function getApiInfo() {
  return request<{
    name: string;
    version: string;
    description: string;
    features: string[];
    endpoints: Record<string, string>;
  }>('/info');
}

// 会议管理
export async function getMeetings(limit = 50, offset = 0) {
  return request<{ meetings: Meeting[] }>(
    `/meetings?limit=${limit}&offset=${offset}`
  );
}

export async function createMeeting(title: string, description?: string) {
  return request<{ meeting: Meeting }>('/meetings', {
    method: 'POST',
    body: JSON.stringify({ title, description }),
  });
}

export async function getMeeting(id: string) {
  return request<{ meeting: Meeting }>(`/meetings/${id}`);
}

export async function deleteMeeting(id: string) {
  return request<{ message: string }>(`/meetings/${id}`, {
    method: 'DELETE',
  });
}

// 文件上传和转录
export async function uploadAudioFile(
  file: File,
  meetingId?: string,
  language?: string
): Promise<{
  message: string;
  meetingId: string;
  taskId: string;
}> {
  const formData = new FormData();
  formData.append('file', file);

  if (meetingId) {
    formData.append('meetingId', meetingId);
  }

  if (language) {
    formData.append('language', language);
  }

  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      message: response.statusText,
    }));

    throw new ApiError(
      errorData.error || errorData.message || '上传失败',
      response.status
    );
  }

  return response.json();
}

// 转录状态查询
export async function getTranscriptionStatus(taskId: string) {
  return request<{ task: TranscriptionTask }>(`/transcription/${taskId}`);
}

// AI摘要生成
export async function generateSummary(
  meetingId: string,
  text: string,
  model?: string
) {
  return request<{
    summary: {
      keyPoints: string[];
      actionItems: string[];
      summary: string;
      participants?: string[];
    };
  }>('/summary', {
    method: 'POST',
    body: JSON.stringify({ meetingId, text, model }),
  });
}

// 完整处理流程
export async function processCompleteWorkflow(
  file: File,
  title?: string,
  description?: string,
  language?: string,
  model?: string
): Promise<{
  message: string;
  meetingId: string;
  processTaskId: string;
}> {
  const formData = new FormData();
  formData.append('file', file);

  if (title) {
    formData.append('title', title);
  }

  if (description) {
    formData.append('description', description);
  }

  if (language) {
    formData.append('language', language);
  }

  if (model) {
    formData.append('model', model);
  }

  const response = await fetch(`${API_BASE}/process`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      message: response.statusText,
    }));

    throw new ApiError(
      errorData.error || errorData.message || '处理失败',
      response.status
    );
  }

  return response.json();
}

// 处理任务状态查询
export async function getProcessStatus(taskId: string) {
  return request<{
    task: {
      id: string;
      status: string;
      progress: number;
      transcriptionTask?: TranscriptionTask;
      summaryResult?: SummaryResponse;
      error?: string;
      created_at: Date;
    };
  }>(`/process/${taskId}`);
}

// 服务状态
export async function getServicesStatus() {
  return request<{
    transcription: Array<{ name: string; available: boolean }>;
    ai: Array<{ name: string; available: boolean }>;
    statistics: {
      totalMeetings: number;
      totalTranscriptionTasks: number;
      totalProcessTasks: number;
      completedMeetings: number;
      pendingTasks: number;
    };
  }>('/services/status');
}

export { ApiError };
