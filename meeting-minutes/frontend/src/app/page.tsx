'use client';

import { useState, useEffect, useContext, useCallback } from 'react';
import { Transcript, Summary, SummaryResponse } from '@/types';
import { EditableTitle } from '@/components/EditableTitle';
import { TranscriptView } from '@/components/TranscriptView';
import { RecordingControls } from '@/components/RecordingControls';
import { AISummary } from '@/components/AISummary';
import { AudioUpload } from '@/components/AudioUpload';
import { AudioLibrary } from '@/components/AudioLibrary';
import { useSidebar } from '@/components/Sidebar/SidebarProvider';
import { listen } from '@tauri-apps/api/event';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { downloadDir } from '@tauri-apps/api/path';
import { useNavigation } from '@/hooks/useNavigation';
import { useRouter } from 'next/navigation';
import type { CurrentMeeting } from '@/components/Sidebar/SidebarProvider';

interface TranscriptUpdate {
  text: string;
  timestamp: string;
  source: string;
}

interface ModelConfig {
  provider: 'ollama' | 'groq' | 'claude' | 'openai';
  model: string;
  whisperModel: string;
  whisperLanguage: string; // 新增语言设置
}

type SummaryStatus = 'idle' | 'processing' | 'summarizing' | 'regenerating' | 'completed' | 'error';

interface OllamaModel {
  name: string;
  id: string;
  size: string;
  modified: string;
}

interface AudioTask {
  id: string;
  filename: string;
  status: 'processing' | 'completed' | 'error';
  created_at: string;
  completed_at?: string;
  progress?: string;
  segments_processed?: number;
  total_text_length?: number;
  file_size_mb?: number;
  estimated_minutes?: number;
  error?: string;
  result?: {
    text: string;
    segments: Array<{
      start: number;
      end: number;
      text: string;
      t0: number;
      t1: number;
    }>;
  };
}

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryStatus, setSummaryStatus] = useState<SummaryStatus>('idle');
  const [barHeights, setBarHeights] = useState(['58%', '76%', '58%']);
  const [meetingTitle, setMeetingTitle] = useState('+ New Call');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [aiSummary, setAiSummary] = useState<Summary | null>({
    key_points: { title: "Key Points", blocks: [] },
    action_items: { title: "Action Items", blocks: [] },
    decisions: { title: "Decisions", blocks: [] },
    main_topics: { title: "Main Topics", blocks: [] }
  });
  const [summaryResponse, setSummaryResponse] = useState<SummaryResponse | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [modelConfig, setModelConfig] = useState<ModelConfig>({
    provider: 'openai',
    model: 'gpt-4o-mini',
    whisperModel: 'large-v3',
    whisperLanguage: 'zh-cn'
  });
  const [originalTranscript, setOriginalTranscript] = useState<string>('');
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [error, setError] = useState<string>('');
  const [showModelSettings, setShowModelSettings] = useState(false);
  const [isUploadProcessing, setIsUploadProcessing] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showAudioLibrary, setShowAudioLibrary] = useState(false);

  const { setCurrentMeeting, setMeetings, meetings, isMeetingActive, setIsMeetingActive} = useSidebar();
  const handleNavigation = useNavigation('', ''); // Initialize with empty values
  const router = useRouter();

  const modelOptions = {
    openai: ['gpt-4o-mini', 'gpt-4o', 'o1-preview', 'o1-mini', 'gpt-3.5-turbo'],
    ollama: models.map(model => model.name),
    claude: ['claude-3-5-sonnet-latest'],
    groq: ['llama-3.3-70b-versatile'],
  };

  useEffect(() => {
    if (models.length > 0 && modelConfig.provider === 'ollama') {
      setModelConfig(prev => ({
        ...prev,
        model: models[0].name
      }));
    }
  }, [models]);

  const whisperModels = [
    'tiny',
    'tiny.en',
    'tiny-q5_1',
    'tiny.en-q5_1',
    'tiny-q8_0',
    'base',
    'base.en',
    'base-q5_1',
    'base.en-q5_1',
    'base-q8_0',
    'small',
    'small.en',
    'small.en-tdrz',
    'small-q5_1',
    'small.en-q5_1',
    'small-q8_0',
    'medium',
    'medium.en',
    'medium-q5_0',
    'medium.en-q5_0',
    'medium-q8_0',
    'large-v1',
    'large-v2',
    'large-v2-q5_0',
    'large-v2-q8_0',
    'large-v3',
    'large-v3-q5_0',
    'large-v3-turbo',
    'large-v3-turbo-q5_0',
    'large-v3-turbo-q8_0'
  ];

  // 支持的语言列表
  const whisperLanguages = [
    { code: 'auto', name: '自动检测 (Auto)' },
    { code: 'zh-cn', name: '中文简体 (Simplified Chinese)' },
    { code: 'zh', name: '中文繁体 (Traditional Chinese)' }, 
    { code: 'en', name: '英语 (English)' },
    { code: 'yue', name: '粤语 (Cantonese)' },
    { code: 'ja', name: '日语 (Japanese)' },
    { code: 'ko', name: '韩语 (Korean)' },
    { code: 'es', name: '西班牙语 (Spanish)' },
    { code: 'fr', name: '法语 (French)' },
    { code: 'de', name: '德语 (German)' },
    { code: 'ru', name: '俄语 (Russian)' },
    { code: 'pt', name: '葡萄牙语 (Portuguese)' },
    { code: 'it', name: '意大利语 (Italian)' },
    { code: 'ar', name: '阿拉伯语 (Arabic)' },
    { code: 'hi', name: '印地语 (Hindi)' },
    { code: 'th', name: '泰语 (Thai)' },
    { code: 'vi', name: '越南语 (Vietnamese)' }
  ];

  useEffect(() => {
    setCurrentMeeting({ id: 'intro-call', title: meetingTitle });
  }, [meetingTitle, setCurrentMeeting]);

  useEffect(() => {
    const checkRecordingState = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const isCurrentlyRecording = await invoke('is_recording');
        
        if (isCurrentlyRecording && !isRecording) {
          console.log('Recording is active in backend but not in UI, synchronizing state...');
          setIsRecording(true);
          setIsMeetingActive(true);
        } else if (!isCurrentlyRecording && isRecording) {
          console.log('Recording is inactive in backend but active in UI, synchronizing state...');
          setIsRecording(false);
        }
      } catch (error) {
        console.error('Failed to check recording state:', error);
      }
    };

    checkRecordingState();
    
    // Set up a polling interval to periodically check recording state
    const interval = setInterval(checkRecordingState, 5000); // Check every 5 seconds
    
    return () => clearInterval(interval);
  }, [isRecording, setIsMeetingActive]);

  useEffect(() => {
    if (isRecording) {
      const interval = setInterval(() => {
        setBarHeights(prev => {
          const newHeights = [...prev];
          newHeights[0] = Math.random() * 20 + 10 + 'px';
          newHeights[1] = Math.random() * 20 + 10 + 'px';
          newHeights[2] = Math.random() * 20 + 10 + 'px';
          return newHeights;
        });
      }, 300);

      return () => clearInterval(interval);
    }
  }, [isRecording]);

  useEffect(() => {
    let unlistenFn: (() => void) | undefined;
    let transcriptCounter = 0;  // Counter for unique IDs

    const setupListener = async () => {
      try {
        console.log('Setting up transcript listener...');
        unlistenFn = await listen<TranscriptUpdate>('transcript-update', (event) => {
          console.log('Received transcript update:', event.payload);
          const newTranscript = {
            id: `${Date.now()}-${transcriptCounter++}`,  // Combine timestamp with counter for uniqueness
            text: event.payload.text,
            timestamp: event.payload.timestamp,
          };
          setTranscripts(prev => {
            // Check if this transcript already exists
            const exists = prev.some(
              t => t.text === event.payload.text && t.timestamp === event.payload.timestamp
            );
            if (exists) {
              console.log('Duplicate transcript, skipping:', newTranscript);
              return prev;
            }
            console.log('Adding new transcript:', newTranscript);
            return [...prev, newTranscript];
          });
        });
        console.log('Transcript listener setup complete');
      } catch (error) {
        console.error('Failed to setup transcript listener:', error);
        alert('Failed to setup transcript listener. Check console for details.');
      }
    };

    setupListener();
    console.log('Started listener setup');

    return () => {
      console.log('Cleaning up transcript listener...');
      if (unlistenFn) {
        unlistenFn();
        console.log('Transcript listener cleaned up');
      }
    };
  }, []);

  useEffect(() => {
    const loadModels = async () => {
      try {
        const response = await fetch('http://localhost:11434/api/tags', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const modelList = data.models.map((model: any) => ({
          name: model.name,
          id: model.model,
          size: formatSize(model.size),
          modified: model.modified_at
        }));
        setModels(modelList);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load Ollama models');
        console.error('Error loading models:', err);
      }
    };

    loadModels();
  }, []);

  const formatSize = (size: number): string => {
    if (size < 1024) {
      return `${size} B`;
    } else if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    } else if (size < 1024 * 1024 * 1024) {
      return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    } else {
      return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
  };

  const handleAudioUploaded = (uploadedTranscripts: any[]) => {
    console.log('Audio uploaded with transcripts:', uploadedTranscripts);
    setTranscripts(uploadedTranscripts);
    setMeetingTitle(`Uploaded Audio ${Math.random().toString(36).substring(2, 8)}`);
    setShowSummary(true);
    setShowUpload(false);
  };

  const handleUploadStart = () => {
    console.log('Upload started');
    setIsUploadProcessing(true);
  };

  const handleUploadComplete = () => {
    console.log('Upload completed');
    setIsUploadProcessing(false);
  };

  // 处理从音频库选择任务
  const handleTaskSelect = async (task: AudioTask) => {
    try {
      console.log('Selected task:', task);
      
      // 获取完整的任务详情（包含转录结果）
      const response = await fetch(`http://localhost:8178/status/${task.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch task details');
      }
      
      const taskDetails = await response.json();
      
      if (taskDetails.result && taskDetails.result.segments) {
        // 转换格式为前端需要的格式
        const convertedTranscripts = taskDetails.result.segments.map((segment: any, index: number) => ({
          id: `${task.id}-${index}`,
          text: segment.text,
          timestamp: new Date(Date.now() + segment.start * 1000).toISOString(), // 近似时间戳
        }));
        
        // 更新状态
        setTranscripts(convertedTranscripts);
        setMeetingTitle(task.filename.replace(/\.[^/.]+$/, "")); // 去掉文件扩展名
        setShowSummary(true);
        setShowAudioLibrary(false);
        
        console.log('Loaded transcripts from audio library:', convertedTranscripts.length);
      } else {
        console.error('No transcript data available for this task');
        alert('No transcript data available for this audio file');
      }
    } catch (error) {
      console.error('Failed to load task:', error);
      alert('Failed to load audio file. Please try again.');
    }
  };

  const handleRecordingStart = async () => {
    try {
      console.log('Starting recording...');
      const { invoke } = await import('@tauri-apps/api/core');
      const randomTitle = `Meeting ${Math.random().toString(36).substring(2, 8)}`;
      setMeetingTitle(randomTitle);
      
      // Only check if we're already recording, but don't try to stop it first
      const isCurrentlyRecording = await invoke('is_recording');
      if (isCurrentlyRecording) {
        console.log('Already recording, cannot start a new recording');
        return; // Just return without starting a new recording
      }

      // Start new recording with whisper model and language
      await invoke('start_recording', {
        args: {
          whisper_model: modelConfig.whisperModel,
          language: modelConfig.whisperLanguage
        }
      });
      console.log('Recording started successfully');
      setIsRecording(true);
      setTranscripts([]); // Clear previous transcripts when starting new recording
      setIsMeetingActive(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Failed to start recording. Check console for details.');
      setIsRecording(false); // Reset state on error
    }
  };

  const handleRecordingStop = async () => {
    try {
      console.log('Stopping recording...');
      const { invoke } = await import('@tauri-apps/api/core');
      const { appDataDir } = await import('@tauri-apps/api/path');
      
      const dataDir = await appDataDir();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const transcriptPath = `${dataDir}transcript-${timestamp}.txt`;
      const audioPath = `${dataDir}recording-${timestamp}.wav`;

      // Stop recording and save audio
      await invoke('stop_recording', { 
        args: { 
          save_path: audioPath,
          model_config: modelConfig
        }
      });
      console.log('Recording stopped successfully');

      // Format and save transcript
      const formattedTranscript = transcripts
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .map(t => `[${t.timestamp}] ${t.text}`)
        .join('\n\n');

      setIsRecording(false);
      
      // Show summary button if we have transcript content
      if (formattedTranscript.trim()) {
        setShowSummary(true);
      } else {
        console.log('No transcript content available');
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack,
        });
      }
      alert('Failed to stop recording. Check console for details.');
      setIsRecording(false); // Reset state on error
    }
  };

  const handleRecordingStop2 = async (isCallApi: boolean) => {
    try {
      console.log('Stopping recording (new implementation)...');
      const { invoke } = await import('@tauri-apps/api/core');
      const { appDataDir } = await import('@tauri-apps/api/path');
      
      const dataDir = await appDataDir();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const transcriptPath = `${dataDir}transcript-${timestamp}.txt`;
      const audioPath = `${dataDir}recording-${timestamp}.wav`;
      
      // Stop recording and get audio path
      await invoke('stop_recording', { 
        args: { 
          model_config: modelConfig,
          save_path: audioPath
        }
      });
      console.log('Recording stopped successfully');

      // Save to SQLite
      if (isCallApi) {
        console.log('Saving transcript to database...', transcripts);
        const response = await fetch('http://localhost:5167/save-transcript', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            meeting_title: meetingTitle,
            transcripts: transcripts
          })
        });

        if (!response.ok) {
          setIsRecording(false);
          throw new Error('Failed to save transcript to database');
        }

        const responseData = await response.json();
        const meetingId = responseData.meeting_id;
        setMeetings((prev: CurrentMeeting[]) => [{ id: meetingId, title: meetingTitle }, ...prev]);
        
        // Set current meeting and navigate
        setCurrentMeeting({ id: meetingId, title: meetingTitle });
        setIsMeetingActive(false);
        router.push('/meeting-details');
      }

      setIsRecording(false);
      
      // Show summary button if we have transcript content
      if (transcripts.length > 0) {
        setShowSummary(true);
      } else {
        console.log('No transcript content available');
      }
    } catch (error) {
      console.error('Error in handleRecordingStop2:', error);
      setIsRecording(false);
    }
  };

  const handleTranscriptUpdate = (update: any) => {
    console.log('Handling transcript update:', update);
    const newTranscript = {
      id: Date.now().toString(),
      text: update.text,
      timestamp: update.timestamp,
    };
    setTranscripts(prev => {
      // Check if this transcript already exists
      const exists = prev.some(
        t => t.text === update.text && t.timestamp === update.timestamp
      );
      if (exists) {
        return prev;
      }
      return [...prev, newTranscript];
    });
  };

  const generateAISummary = useCallback(async () => {
    setSummaryStatus('processing');
    setSummaryError(null);

    try {
      const fullTranscript = transcripts.map(t => t.text).join('\n');
      if (!fullTranscript.trim()) {
        throw new Error('No transcript text available. Please add some text first.');
      }
      
      // Store the original transcript for regeneration
      setOriginalTranscript(fullTranscript);
      
      console.log('Generating summary for transcript length:', fullTranscript.length);
      console.log('Using model config:', modelConfig);
      
      // Test backend connection first
      try {
        const testResponse = await fetch('http://localhost:5167/health', {
          method: 'GET',
        });
        if (!testResponse.ok) {
          throw new Error(`Backend not responding: ${testResponse.status}`);
        }
        console.log('Backend connection successful');
      } catch (error) {
        console.error('Backend connection failed:', error);
        setSummaryError('Backend service is not running. Please check if http://localhost:5167 is accessible.');
        setSummaryStatus('error');
        return;
      }
      
      // Process transcript and get process_id
      console.log('Processing transcript...');
      const response = await fetch('http://localhost:5167/process-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: fullTranscript,
          model: modelConfig.provider,
          model_name: modelConfig.model,
          chunk_size: 40000,
          overlap: 1000
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || `HTTP ${response.status}` };
        }
        console.error('Process transcript failed:', errorData);
        setSummaryError(errorData.error || `Failed to process transcript: HTTP ${response.status}`);
        setSummaryStatus('error');
        return;
      }

      const { process_id } = await response.json();
      console.log('Process ID:', process_id);
   

      // Poll for summary status
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`http://localhost:5167/get-summary/${process_id}`);
          
          if (!statusResponse.ok) {
            const errorText = await statusResponse.text();
            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch {
              errorData = { error: errorText || `HTTP ${statusResponse.status}` };
            }
            console.error('Get summary failed:', errorData);
            setSummaryError(errorData.error || `Failed to get summary: HTTP ${statusResponse.status}`);
            setSummaryStatus('error');
            clearInterval(pollInterval);
            return;
          }

          const result = await statusResponse.json();
          console.log('Summary status:', result);

          if (result.status === 'error') {
            setSummaryError(result.error || 'Unknown error occurred during summary generation');
            setSummaryStatus('error');
            clearInterval(pollInterval);
            return;
          }

          if (result.status === 'completed' && result.data) {
            clearInterval(pollInterval);
            
            console.log('Raw summary data:', result.data);
            
            // Remove MeetingName from data before formatting
            const { MeetingName, ...summaryData } = result.data;
            
            // Update meeting title if available
            if (MeetingName) {
              setMeetingTitle(MeetingName);
            }

            // Format the summary data with consistent styling
            const formattedSummary = Object.entries(summaryData).reduce((acc: Summary, [key, section]: [string, any]) => {
              // Ensure section has the expected structure
              if (section && typeof section === 'object' && section.blocks) {
                acc[key] = {
                  title: section.title || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                  blocks: Array.isArray(section.blocks) ? section.blocks.map((block: any) => ({
                    ...block,
                    type: 'bullet',
                    color: 'default',
                    content: typeof block === 'string' ? block.trim() : (block.content || '').trim()
                  })) : []
                };
              } else {
                // Fallback for unexpected format
                acc[key] = {
                  title: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                  blocks: []
                };
              }
              return acc;
            }, {} as Summary);

            console.log('Formatted summary:', formattedSummary);
            setAiSummary(formattedSummary);
            setSummaryStatus('completed');
          }
        } catch (error) {
          console.error('Failed to get summary status:', error);
          if (error instanceof Error) {
            setSummaryError(`Failed to get summary status: ${error.message}`);
          } else {
            setSummaryError('Failed to get summary status: Unknown error');
          }
          setSummaryStatus('error');
          clearInterval(pollInterval);
        }
      }, 5000);

      // Cleanup interval on component unmount
      return () => clearInterval(pollInterval);
      
    } catch (error) {
      console.error('Failed to generate summary:', error);
      if (error instanceof Error) {
        setSummaryError(`Failed to generate summary: ${error.message}`);
      } else {
        setSummaryError('Failed to generate summary: Unknown error');
      }
      setSummaryStatus('error');
    }
  }, [transcripts, modelConfig]);

  const handleSummary = useCallback((summary: any) => {
    setAiSummary(summary);
  }, []);

  const handleSummaryChange = (newSummary: Summary) => {
    console.log('Summary changed:', newSummary);
    setAiSummary(newSummary);
  };

  const handleTitleChange = (newTitle: string) => {
    setMeetingTitle(newTitle);
    setCurrentMeeting({ id: 'intro-call', title: newTitle });
  };

  const getSummaryStatusMessage = (status: SummaryStatus) => {
    switch (status) {
      case 'idle':
        return 'Ready to generate summary';
      case 'processing':
        return 'Processing transcript...';
      case 'summarizing':
        return 'Generating AI summary...';
      case 'regenerating':
        return 'Regenerating AI summary...';
      case 'completed':
        return 'Summary generated successfully!';
      case 'error':
        return summaryError || 'An error occurred';
      default:
        return '';
    }
  };

  const handleDownloadTranscript = async () => {
    try {
      // Create transcript object with metadata
      const transcriptData = {
        title: meetingTitle,
        timestamp: new Date().toISOString(),
        transcripts: transcripts
      };

      // Generate filename
      const sanitizedTitle = meetingTitle.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${sanitizedTitle}_transcript.json`;
      
      // Get download directory path
      const downloadPath = await downloadDir();
      
      // Write file to downloads directory
      await writeTextFile(`${downloadPath}/${filename}`, JSON.stringify(transcriptData, null, 2));

      console.log('Transcript saved successfully to:', `${downloadPath}/${filename}`);
      alert('Transcript downloaded successfully!');
    } catch (error) {
      console.error('Failed to save transcript:', error);
      alert('Failed to save transcript. Please try again.');
    }
  };

  const handleUploadTranscript = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      // Validate the uploaded file structure
      if (!data.transcripts || !Array.isArray(data.transcripts)) {
        throw new Error('Invalid transcript file format');
      }

      // Update state with uploaded data
      setMeetingTitle(data.title || 'Uploaded Transcript');
      setTranscripts(data.transcripts);
      
      // Generate summary for the uploaded transcript
      setShowSummary(true);
    } catch (error) {
      console.error('Error uploading transcript:', error);
      alert('Failed to upload transcript. Please make sure the file format is correct.');
    }
  };

  const handleRegenerateSummary = useCallback(async () => {
    if (!originalTranscript.trim()) {
      console.error('No original transcript available for regeneration');
      return;
    }

    setSummaryStatus('regenerating');
    setSummaryError(null);

    try {
      console.log('Regenerating summary with original transcript...');
      
      // Process transcript and get process_id
      console.log('Processing transcript...');
      const response = await fetch('http://localhost:5167/process-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: originalTranscript,
          model: modelConfig.provider,
          model_name: modelConfig.model,
          chunk_size: 40000,
          overlap: 1000
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Process transcript failed:', errorData);
        throw new Error(errorData.error || 'Failed to process transcript');
      }

      const { process_id } = await response.json();
      console.log('Process ID:', process_id);

      // Poll for summary status
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`http://localhost:5167/get-summary/${process_id}`);
          
          if (!statusResponse.ok) {
            const errorData = await statusResponse.json();
            console.error('Get summary failed:', errorData);
            throw new Error(errorData.error || 'Failed to get summary status');
          }

          const result = await statusResponse.json();
          console.log('Summary status:', result);

          if (result.status === 'error') {
            setSummaryError(result.error || 'Unknown error');
            setSummaryStatus('error');
            clearInterval(pollInterval);
            return;
          }

          if (result.status === 'completed' && result.data) {
            clearInterval(pollInterval);
            
            // Remove MeetingName from data before formatting
            const { MeetingName, ...summaryData } = result.data;
            
            // Update meeting title if available
            if (MeetingName) {
              setMeetingTitle(MeetingName);
            }

            // Format the summary data with consistent styling
            const formattedSummary = Object.entries(summaryData).reduce((acc: Summary, [key, section]: [string, any]) => {
              acc[key] = {
                title: section.title,
                blocks: section.blocks.map((block: any) => ({
                  ...block,
                  type: 'bullet',
                  color: 'default',
                  content: block.content.trim()
                }))
              };
              return acc;
            }, {} as Summary);

            setAiSummary(formattedSummary);
            setSummaryStatus('completed');
          } else if (result.status === 'error') {
            clearInterval(pollInterval);
            throw new Error(result.error || 'Failed to generate summary');
          }
        } catch (error) {
          clearInterval(pollInterval);
          console.error('Failed to get summary status:', error);
          if (error instanceof Error) {
            setSummaryError(error.message);
          } else {
            setSummaryError('An unexpected error occurred');
          }
          setSummaryStatus('error');
          setAiSummary(null);
        }
      }, 10000);

      return () => clearInterval(pollInterval);
    } catch (error) {
      console.error('Failed to regenerate summary:', error);
      if (error instanceof Error) {
        setSummaryError(error.message);
      } else {
        setSummaryError('An unexpected error occurred');
      }
      setSummaryStatus('error');
      setAiSummary(null);
    }
  }, [originalTranscript, modelConfig]);

  const handleCopyTranscript = useCallback(() => {
    const fullTranscript = transcripts
      .map(t => `${t.timestamp}: ${t.text}`)
      .join('\n');
    navigator.clipboard.writeText(fullTranscript);
  }, [transcripts]);

  const handleGenerateSummary = useCallback(async () => {
    if (!transcripts.length) {
      console.log('No transcripts available for summary');
      return;
    }
    
    try {
      await generateAISummary();
    } catch (error) {
      console.error('Failed to generate summary:', error);
      if (error instanceof Error) {
        setSummaryError(error.message);
      } else {
        setSummaryError('Failed to generate summary: Unknown error');
      }
    }
  }, [transcripts, generateAISummary]);

  const isSummaryLoading = summaryStatus === 'processing' || summaryStatus === 'summarizing' || summaryStatus === 'regenerating';

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="flex flex-1 overflow-hidden">
        {/* Left side - Transcript */}
        <div className="w-1/3 min-w-[300px] border-r border-gray-200 bg-white flex flex-col relative">
          {/* Title area */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex flex-col space-y-3">
              <div className="flex items-center">
                <EditableTitle
                  title={meetingTitle}
                  isEditing={isEditingTitle}
                  onStartEditing={() => setIsEditingTitle(true)}
                  onFinishEditing={() => setIsEditingTitle(false)}
                  onChange={handleTitleChange}
                />
              </div>
              <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                <button
                  onClick={handleCopyTranscript}
                  disabled={transcripts.length === 0}
                  className={`px-3 py-2 border rounded-md transition-all duration-200 inline-flex items-center gap-2 shadow-sm ${
                    transcripts.length === 0
                      ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-300 active:bg-blue-200'
                  }`}
                  title={transcripts.length === 0 ? 'No transcript available' : 'Copy Transcript'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V7.5l-3.75-3.612z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 3v3.75a.75.75 0 0 0 .75.75H18" />
                  </svg>
                  <span className="text-sm">Copy</span>
                </button>
                
                {/* Upload Audio Button */}
                <button
                  onClick={() => setShowUpload(true)}
                  disabled={isRecording || isUploadProcessing}
                  className={`px-3 py-2 border rounded-md transition-all duration-200 inline-flex items-center gap-2 shadow-sm ${
                    isRecording || isUploadProcessing
                      ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100 hover:border-purple-300 active:bg-purple-200'
                  }`}
                  title={isRecording ? 'Stop recording first' : 'Upload Audio File'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span className="text-sm">Upload</span>
                </button>

                {/* Audio Library Button */}
                <button
                  onClick={() => setShowAudioLibrary(true)}
                  disabled={isRecording}
                  className={`px-3 py-2 border rounded-md transition-all duration-200 inline-flex items-center gap-2 shadow-sm ${
                    isRecording
                      ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 active:bg-indigo-200'
                  }`}
                  title={isRecording ? 'Stop recording first' : 'View Audio Library'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <span className="text-sm">Library</span>
                </button>

                {showSummary && !isRecording && (
                  <>
                    <button
                      onClick={handleGenerateSummary}
                      disabled={summaryStatus === 'processing'}
                      className={`px-3 py-2 border rounded-md transition-all duration-200 inline-flex items-center gap-2 shadow-sm ${
                        summaryStatus === 'processing'
                          ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                          : transcripts.length === 0
                          ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100 hover:border-green-300 active:bg-green-200'
                      }`}
                      title={
                        summaryStatus === 'processing'
                          ? 'Generating summary...'
                          : transcripts.length === 0
                          ? 'No transcript available'
                          : 'Generate AI Summary'
                      }
                    >
                      {summaryStatus === 'processing' ? (
                        <>
                          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span className="text-sm">Processing...</span>
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span className="text-sm">Generate Note</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setShowModelSettings(true)}
                      className="px-3 py-2 border rounded-md transition-all duration-200 inline-flex items-center gap-2 shadow-sm bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-gray-300 active:bg-gray-200"
                      title="Model Settings"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Transcript content */}
          <div className="flex-1 overflow-y-auto pb-32">
            <TranscriptView transcripts={transcripts} />
          </div>

          {/* Recording controls */}
          <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 z-10">
            <div className="bg-white rounded-full shadow-lg flex items-center">
              <RecordingControls
                isRecording={isRecording}
                onRecordingStop={() => handleRecordingStop2(true)}
                onRecordingStart={handleRecordingStart}
                onTranscriptReceived={handleTranscriptUpdate}
                barHeights={barHeights}
              />
            </div>
          </div>

          {/* Model Settings Modal */}
          {showModelSettings && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Model Settings</h3>
                  <button
                    onClick={() => setShowModelSettings(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      转录语言 (Transcription Language)
                    </label>
                    <select
                      className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      value={modelConfig.whisperLanguage}
                      onChange={(e) => setModelConfig(prev => ({ ...prev, whisperLanguage: e.target.value }))}
                    >
                      {whisperLanguages.map(lang => (
                        <option key={lang.code} value={lang.code}>
                          {lang.name}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      选择音频内容的主要语言。建议使用"自动检测"以获得最佳效果。
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Summarization Model
                    </label>
                    <div className="flex space-x-2">
                      <select
                        className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        value={modelConfig.provider}
                        onChange={(e) => {
                          const provider = e.target.value as ModelConfig['provider'];
                          setModelConfig({
                            ...modelConfig,
                            provider,
                            model: modelOptions[provider][0]
                          });
                        }}
                      >
                        <option value="openai">OpenAI</option>
                        <option value="claude">Claude</option>
                        <option value="groq">Groq</option>
                        <option value="ollama">Ollama</option>
                      </select>

                      <select
                        className="flex-1 px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        value={modelConfig.model}
                        onChange={(e) => setModelConfig(prev => ({ ...prev, model: e.target.value }))}
                      >
                        {modelOptions[modelConfig.provider].map(model => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {modelConfig.provider === 'ollama' && (
                    <div>
                      <h4 className="text-lg font-bold mb-4">Available Ollama Models</h4>
                      {error && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                          {error}
                        </div>
                      )}
                      <div className="grid gap-4 max-h-[400px] overflow-y-auto pr-2">
                        {models.map((model) => (
                          <div 
                            key={model.id}
                            className={`bg-white p-4 rounded-lg shadow cursor-pointer transition-colors ${
                              modelConfig.model === model.name ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                            }`}
                            onClick={() => setModelConfig(prev => ({ ...prev, model: model.name }))}
                          >
                            <h3 className="font-bold">{model.name}</h3>
                            <p className="text-gray-600">Size: {model.size}</p>
                            <p className="text-gray-600">Modified: {model.modified}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setShowModelSettings(false)}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Upload Audio Modal */}
          {showUpload && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Upload Audio File</h3>
                  <button
                    onClick={() => !isUploadProcessing && setShowUpload(false)}
                    disabled={isUploadProcessing}
                    className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <AudioUpload
                  onAudioUploaded={handleAudioUploaded}
                  onUploadStart={handleUploadStart}
                  onUploadComplete={handleUploadComplete}
                  isProcessing={isUploadProcessing}
                  language={modelConfig.whisperLanguage}
                />

                {!isUploadProcessing && (
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => setShowUpload(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Audio Library Modal */}
          {showAudioLibrary && (
            <AudioLibrary
              onTaskSelect={handleTaskSelect}
              onClose={() => setShowAudioLibrary(false)}
            />
          )}
        </div>

        {/* Right side - AI Summary */}
        <div className="flex-1 overflow-y-auto bg-white">
          {isSummaryLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                <p className="text-gray-600">Generating AI Summary...</p>
              </div>
            </div>
          ) : showSummary && (
            <div className="max-w-4xl mx-auto p-6">
              {summaryResponse && (
                <div className="fixed bottom-0 left-0 right-0 bg-white shadow-lg p-4 max-h-1/3 overflow-y-auto">
                  <h3 className="text-lg font-semibold mb-2">Meeting Summary</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                      <h4 className="font-medium mb-1">Key Points</h4>
                      <ul className="list-disc pl-4">
                        {summaryResponse.summary.key_points.blocks.map((block, i) => (
                          <li key={i} className="text-sm">{block.content}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm mt-4">
                      <h4 className="font-medium mb-1">Action Items</h4>
                      <ul className="list-disc pl-4">
                        {summaryResponse.summary.action_items.blocks.map((block, i) => (
                          <li key={i} className="text-sm">{block.content}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm mt-4">
                      <h4 className="font-medium mb-1">Decisions</h4>
                      <ul className="list-disc pl-4">
                        {summaryResponse.summary.decisions.blocks.map((block, i) => (
                          <li key={i} className="text-sm">{block.content}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm mt-4">
                      <h4 className="font-medium mb-1">Main Topics</h4>
                      <ul className="list-disc pl-4">
                        {summaryResponse.summary.main_topics.blocks.map((block, i) => (
                          <li key={i} className="text-sm">{block.content}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  {summaryResponse.raw_summary ? (
                    <div className="mt-4">
                      <h4 className="font-medium mb-1">Full Summary</h4>
                      <p className="text-sm whitespace-pre-wrap">{summaryResponse.raw_summary}</p>
                    </div>
                  ) : null}
                </div>
              )}
              <div className="flex-1 overflow-y-auto p-4">
                <AISummary 
                  summary={aiSummary} 
                  status={summaryStatus} 
                  error={summaryError}
                  onSummaryChange={(newSummary) => setAiSummary(newSummary)}
                  onRegenerateSummary={handleRegenerateSummary}
                />
              </div>
              {summaryStatus !== 'idle' && (
                <div className={`mt-4 p-4 rounded-lg ${
                  summaryStatus === 'error' ? 'bg-red-100 text-red-700' :
                  summaryStatus === 'completed' ? 'bg-green-100 text-green-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  <p className="text-sm font-medium">{getSummaryStatusMessage(summaryStatus)}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}