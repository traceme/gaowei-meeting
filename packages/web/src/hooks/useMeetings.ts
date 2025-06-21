import { useState, useEffect, useCallback } from 'react';
import type { Meeting } from '@gaowei/shared-types';
import { getMeetings, createMeeting, getMeeting, deleteMeeting, ApiError } from '../services/api';

interface UseMeetingsState {
  meetings: Meeting[];
  isLoading: boolean;
  error: string | null;
  selectedMeeting: Meeting | null;
}

export function useMeetings() {
  const [state, setState] = useState<UseMeetingsState>({
    meetings: [],
    isLoading: false,
    error: null,
    selectedMeeting: null,
  });

  // 获取所有会议
  const fetchMeetings = useCallback(async (limit = 50, offset = 0) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await getMeetings(limit, offset);
      
      setState(prev => ({
        ...prev,
        meetings: response.meetings,
        isLoading: false,
      }));
      
      return response.meetings;
    } catch (error) {
      const errorMessage = error instanceof ApiError 
        ? error.message 
        : '获取会议列表失败';
        
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      
      throw error;
    }
  }, []);

  // 创建新会议
  const handleCreateMeeting = useCallback(async (title: string, description?: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await createMeeting(title, description);
      
      setState(prev => ({
        ...prev,
        meetings: [response.meeting, ...prev.meetings],
        isLoading: false,
      }));
      
      return response.meeting;
    } catch (error) {
      const errorMessage = error instanceof ApiError 
        ? error.message 
        : '创建会议失败';
        
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      
      throw error;
    }
  }, []);

  // 获取单个会议详情
  const fetchMeeting = useCallback(async (id: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await getMeeting(id);
      
      setState(prev => ({
        ...prev,
        selectedMeeting: response.meeting,
        isLoading: false,
      }));
      
      return response.meeting;
    } catch (error) {
      const errorMessage = error instanceof ApiError 
        ? error.message 
        : '获取会议详情失败';
        
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      
      throw error;
    }
  }, []);

  // 删除会议
  const handleDeleteMeeting = useCallback(async (id: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      await deleteMeeting(id);
      
      setState(prev => ({
        ...prev,
        meetings: prev.meetings.filter(meeting => meeting.id !== id),
        selectedMeeting: prev.selectedMeeting?.id === id ? null : prev.selectedMeeting,
        isLoading: false,
      }));
      
      return true;
    } catch (error) {
      const errorMessage = error instanceof ApiError 
        ? error.message 
        : '删除会议失败';
        
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      
      throw error;
    }
  }, []);

  // 清除错误
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // 清除选中的会议
  const clearSelectedMeeting = useCallback(() => {
    setState(prev => ({ ...prev, selectedMeeting: null }));
  }, []);

  // 初始化时加载会议列表
  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  return {
    ...state,
    fetchMeetings,
    createMeeting: handleCreateMeeting,
    fetchMeeting,
    deleteMeeting: handleDeleteMeeting,
    clearError,
    clearSelectedMeeting,
  };
} 