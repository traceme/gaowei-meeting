import { useState, useCallback, useRef } from 'react';
import type { TranscriptionTask, SummaryResponse } from '@gaowei/shared-types';
import {
  uploadAudioFile,
  processCompleteWorkflow,
  getTranscriptionStatus,
  getProcessStatus,
  generateSummary,
  ApiError,
} from '../services/api';

interface ProcessingState {
  isUploading: boolean;
  isProcessing: boolean;
  uploadProgress: number;
  processingProgress: number;
  error: string | null;
  currentTask: TranscriptionTask | null;
  result: {
    meetingId?: string;
    transcription?: any;
    summary?: SummaryResponse;
  } | null;
}

export function useFileProcessing() {
  const [state, setState] = useState<ProcessingState>({
    isUploading: false,
    isProcessing: false,
    uploadProgress: 0,
    processingProgress: 0,
    error: null,
    currentTask: null,
    result: null,
  });

  const pollIntervalRef = useRef<number | null>(null);

  // 清理轮询
  const clearPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // 重置状态
  const reset = useCallback(() => {
    clearPolling();
    setState({
      isUploading: false,
      isProcessing: false,
      uploadProgress: 0,
      processingProgress: 0,
      error: null,
      currentTask: null,
      result: null,
    });
  }, [clearPolling]);

  // 轮询任务状态
  const pollTaskStatus = useCallback(
    async (taskId: string, isTranscription = true) => {
      try {
        const response = isTranscription
          ? await getTranscriptionStatus(taskId)
          : await getProcessStatus(taskId);

        const task = response.task;

        setState(prev => ({
          ...prev,
          currentTask: isTranscription
            ? (task as TranscriptionTask)
            : prev.currentTask,
          processingProgress: task.progress || 0,
        }));

        // 检查是否完成
        if (task.status === 'completed') {
          clearPolling();
          setState(prev => ({
            ...prev,
            isProcessing: false,
            result: {
              ...prev.result,
              meetingId: prev.result?.meetingId,
              transcription: isTranscription
                ? (task as TranscriptionTask).result
                : prev.result?.transcription,
              summary: !isTranscription
                ? (task as any).summaryResult
                : prev.result?.summary,
            },
          }));
          return true;
        } else if (task.status === 'error') {
          clearPolling();
          setState(prev => ({
            ...prev,
            isProcessing: false,
            error: (task as any).error || '处理失败',
          }));
          return false;
        }

        return false;
      } catch (error) {
        const errorMessage =
          error instanceof ApiError ? error.message : '获取处理状态失败';

        setState(prev => ({
          ...prev,
          error: errorMessage,
        }));

        return false;
      }
    },
    [clearPolling]
  );

  // 开始轮询
  const startPolling = useCallback(
    (taskId: string, isTranscription = true) => {
      clearPolling();

      pollIntervalRef.current = window.setInterval(async () => {
        const completed = await pollTaskStatus(taskId, isTranscription);
        if (completed) {
          clearPolling();
        }
      }, 2000);
    },
    [clearPolling, pollTaskStatus]
  );

  // 仅上传文件
  const uploadFile = useCallback(
    async (file: File, meetingId?: string, language?: string) => {
      try {
        reset();
        setState(prev => ({ ...prev, isUploading: true }));

        const response = await uploadAudioFile(file, meetingId, language);

        setState(prev => ({
          ...prev,
          isUploading: false,
          isProcessing: true,
          result: { meetingId: response.meetingId },
        }));

        // 开始轮询转录状态
        startPolling(response.taskId, true);

        return response;
      } catch (error) {
        const errorMessage =
          error instanceof ApiError ? error.message : '文件上传失败';

        setState(prev => ({
          ...prev,
          isUploading: false,
          error: errorMessage,
        }));

        throw error;
      }
    },
    [reset, startPolling]
  );

  // 完整处理流程（上传+转录+摘要）
  const processComplete = useCallback(
    async (
      file: File,
      title?: string,
      description?: string,
      language?: string,
      model?: string
    ) => {
      try {
        reset();
        setState(prev => ({ ...prev, isUploading: true }));

        const response = await processCompleteWorkflow(
          file,
          title,
          description,
          language,
          model
        );

        setState(prev => ({
          ...prev,
          isUploading: false,
          isProcessing: true,
          result: { meetingId: response.meetingId },
        }));

        // 开始轮询处理状态
        startPolling(response.processTaskId, false);

        return response;
      } catch (error) {
        const errorMessage =
          error instanceof ApiError ? error.message : '处理失败';

        setState(prev => ({
          ...prev,
          isUploading: false,
          error: errorMessage,
        }));

        throw error;
      }
    },
    [reset, startPolling]
  );

  // 生成摘要（独立操作）
  const generateAISummary = useCallback(
    async (meetingId: string, text: string, model?: string) => {
      try {
        setState(prev => ({ ...prev, isProcessing: true, error: null }));

        const response = await generateSummary(meetingId, text, model);

        setState(prev => ({
          ...prev,
          isProcessing: false,
          result: {
            ...prev.result,
            summary: response.summary,
          },
        }));

        return response.summary;
      } catch (error) {
        const errorMessage =
          error instanceof ApiError ? error.message : '生成摘要失败';

        setState(prev => ({
          ...prev,
          isProcessing: false,
          error: errorMessage,
        }));

        throw error;
      }
    },
    []
  );

  // 清除错误
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    uploadFile,
    processComplete,
    generateSummary: generateAISummary,
    reset,
    clearError,
  };
}
