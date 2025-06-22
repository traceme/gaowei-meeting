import { useState, useEffect, useCallback } from 'react';
import { getHealthStatus, getServicesStatus, ApiError } from '../services/api';

interface ApiStatus {
  isOnline: boolean;
  isLoading: boolean;
  error: string | null;
  services?: {
    transcription: Array<{ name: string; available: boolean }>;
    ai: Array<{ name: string; available: boolean }>;
  };
  statistics?: {
    totalMeetings: number;
    totalTranscriptionTasks: number;
    totalProcessTasks: number;
    completedMeetings: number;
    pendingTasks: number;
  };
  lastCheck: Date | null;
}

export function useApiStatus(interval = 30000) {
  const [status, setStatus] = useState<ApiStatus>({
    isOnline: false,
    isLoading: true,
    error: null,
    lastCheck: null,
  });

  const checkStatus = useCallback(async () => {
    try {
      setStatus(prev => ({ ...prev, isLoading: true, error: null }));

      const [healthResponse, servicesResponse] = await Promise.all([
        getHealthStatus(),
        getServicesStatus(),
      ]);

      setStatus({
        isOnline: true,
        isLoading: false,
        error: null,
        services: servicesResponse,
        statistics: healthResponse.statistics,
        lastCheck: new Date(),
      });
    } catch (error) {
      const errorMessage =
        error instanceof ApiError ? error.message : '连接失败';

      setStatus({
        isOnline: false,
        isLoading: false,
        error: errorMessage,
        lastCheck: new Date(),
      });
    }
  }, []);

  useEffect(() => {
    // 立即检查一次
    checkStatus();

    // 设置定期检查
    const intervalId = setInterval(checkStatus, interval);

    return () => clearInterval(intervalId);
  }, [checkStatus, interval]);

  return {
    ...status,
    refetch: checkStatus,
  };
}
