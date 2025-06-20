import React, { useRef, useEffect, useState } from 'react';

export interface AudioSegment {
  start: number;
  end: number;
  text: string;
  t0?: number;
  t1?: number;
}

export interface VidstackAudioPlayerProps {
  audioUrl: string;
  segments: AudioSegment[];
  onTimeUpdate?: (currentTime: number) => void;
  onSegmentClick?: (segment: AudioSegment) => void;
  className?: string;
}

export const VidstackAudioPlayer: React.FC<VidstackAudioPlayerProps> = ({
  audioUrl,
  segments,
  onTimeUpdate,
  onSegmentClick,
  className = '',
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number>(-1);
  const [playbackRate, setPlaybackRate] = useState(1);

  // 查找当前时间对应的活跃段落
  useEffect(() => {
    const activeIndex = segments.findIndex(
      (segment) => currentTime >= segment.start && currentTime <= segment.end
    );
    setActiveSegmentIndex(activeIndex);
  }, [currentTime, segments]);

  // 跳转到指定时间
  const seekTo = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  // 格式化时间显示
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // 段落点击处理
  const handleSegmentClick = (segment: AudioSegment) => {
    seekTo(segment.start);
    onSegmentClick?.(segment);
  };

  // 播放/暂停
  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
    }
  };

  // 进度条点击处理
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (audioRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const width = rect.width;
      const clickTime = (clickX / width) * duration;
      seekTo(clickTime);
    }
  };

  // 音频事件处理
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const time = audioRef.current.currentTime;
      setCurrentTime(time);
      onTimeUpdate?.(time);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);

  // 键盘事件处理
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        togglePlayPause();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isPlaying]);

  return (
    <div className={`enhanced-audio-player ${className}`}>
      {/* 主播放器 */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-4">
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={handlePlay}
          onPause={handlePause}
          onRateChange={() => {
            if (audioRef.current) {
              setPlaybackRate(audioRef.current.playbackRate);
            }
          }}
          className="hidden"
        />

        {/* 播放控制界面 */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center space-x-4">
            {/* 播放/暂停按钮 */}
            <button
              onClick={togglePlayPause}
              className="flex items-center justify-center w-12 h-12 bg-blue-600 hover:bg-blue-700 rounded-full transition-colors shadow-lg"
            >
              {isPlaying ? (
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                </svg>
              ) : (
                <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>

            {/* 时间显示 */}
            <div className="flex items-center space-x-2 text-sm font-medium text-gray-700">
              <span>{formatTime(currentTime)}</span>
              <span>/</span>
              <span>{formatTime(duration)}</span>
            </div>

            {/* 进度条 */}
            <div className="flex-1">
              <div 
                className="relative h-3 bg-gray-200 rounded-full cursor-pointer hover:bg-gray-300 transition-colors"
                onClick={handleProgressClick}
              >
                <div 
                  className="absolute top-0 left-0 h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                />
                <div 
                  className="absolute top-1/2 w-4 h-4 bg-white border-2 border-blue-500 rounded-full transform -translate-y-1/2 shadow-md cursor-pointer hover:scale-110 transition-transform"
                  style={{ left: `${(currentTime / duration) * 100}%`, marginLeft: '-8px' }}
                />
              </div>
            </div>

            {/* 速度控制 */}
            <select
              value={playbackRate}
              onChange={(e) => {
                const rate = parseFloat(e.target.value);
                if (audioRef.current) {
                  audioRef.current.playbackRate = rate;
                }
                setPlaybackRate(rate);
              }}
              className="bg-white border border-gray-300 rounded px-3 py-1 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="0.5">0.5x</option>
              <option value="0.75">0.75x</option>
              <option value="1">1x</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
              <option value="2">2x</option>
            </select>
          </div>
        </div>
      </div>

      {/* 转录文本与时间戳同步 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
          转录文本 (点击跳转播放)
        </h3>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {segments.map((segment, index) => (
            <div
              key={index}
              className={`group p-3 rounded-lg border transition-all cursor-pointer hover:shadow-md ${
                activeSegmentIndex === index
                  ? 'border-blue-500 bg-blue-50 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
              onClick={() => handleSegmentClick(segment)}
            >
              <div className="flex items-start space-x-3">
                {/* 时间戳 */}
                <div className="flex-shrink-0">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    activeSegmentIndex === index
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'
                  }`}>
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                    {formatTime(segment.start)}
                  </span>
                </div>

                {/* 文本内容 */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-relaxed break-words ${
                    activeSegmentIndex === index
                      ? 'text-blue-900 font-medium'
                      : 'text-gray-700 group-hover:text-gray-900'
                  }`}>
                    {segment.text}
                  </p>
                </div>

                {/* 播放图标 */}
                <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 播放控制提示 */}
        <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
          <div className="flex items-center text-sm text-blue-800">
            <svg className="w-4 h-4 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            <div>
              <p className="font-medium">智能播放功能:</p>
              <ul className="mt-1 text-xs space-y-1">
                <li>• 点击任意文本段落可跳转到对应时间点</li>
                <li>• 当前播放位置的文本会自动高亮显示</li>
                <li>• 支持调节播放速度 (0.5x - 2x)</li>
                <li>• 使用键盘空格键可快速播放/暂停</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VidstackAudioPlayer; 