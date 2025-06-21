import React, { useRef, useEffect, useState } from 'react'
import { cn } from '../utils/cn'

export interface AudioSegment {
  start: number
  end: number
  text: string
  t0?: number
  t1?: number
}

export interface AudioPlayerProps {
  audioUrl: string
  segments?: AudioSegment[]
  onTimeUpdate?: (currentTime: number) => void
  onSegmentClick?: (segment: AudioSegment) => void
  className?: string
  showTranscript?: boolean
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUrl,
  segments = [],
  onTimeUpdate,
  onSegmentClick,
  className,
  showTranscript = true
}) => {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number>(-1)
  const [playbackRate, setPlaybackRate] = useState(1)

  // 查找当前时间对应的活跃段落
  useEffect(() => {
    const activeIndex = segments.findIndex(
      (segment) => currentTime >= segment.start && currentTime <= segment.end
    )
    setActiveSegmentIndex(activeIndex)
  }, [currentTime, segments])

  // 跳转到指定时间
  const seekTo = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time
    }
  }

  // 格式化时间显示
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  // 段落点击处理
  const handleSegmentClick = (segment: AudioSegment) => {
    seekTo(segment.start)
    onSegmentClick?.(segment)
  }

  // 播放/暂停
  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
    }
  }

  // 进度条点击处理
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (audioRef.current) {
      const rect = e.currentTarget.getBoundingClientRect()
      const clickX = e.clientX - rect.left
      const width = rect.width
      const clickTime = (clickX / width) * duration
      seekTo(clickTime)
    }
  }

  // 音频事件处理
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const time = audioRef.current.currentTime
      setCurrentTime(time)
      onTimeUpdate?.(time)
    }
  }

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }

  const handlePlay = () => setIsPlaying(true)
  const handlePause = () => setIsPlaying(false)

  // 键盘事件处理
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault()
        togglePlayPause()
      }
    }

    document.addEventListener('keydown', handleKeyPress)
    return () => document.removeEventListener('keydown', handleKeyPress)
  }, [isPlaying])

  return (
    <div className={cn('enhanced-audio-player', className)}>
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
              setPlaybackRate(audioRef.current.playbackRate)
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
                const rate = parseFloat(e.target.value)
                if (audioRef.current) {
                  audioRef.current.playbackRate = rate
                }
                setPlaybackRate(rate)
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
      {showTranscript && segments.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <span className="text-2xl mr-2">📝</span>
            转录文本
          </h3>
          
          <div className="max-h-96 overflow-y-auto space-y-2">
            {segments.map((segment, index) => (
              <div
                key={index}
                onClick={() => handleSegmentClick(segment)}
                className={cn(
                  'p-3 rounded-lg cursor-pointer transition-all duration-200 border',
                  activeSegmentIndex === index
                    ? 'bg-blue-100 border-blue-300 shadow-md'
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                )}
              >
                <div className="flex items-start space-x-3">
                  <span className="text-xs font-mono text-gray-500 mt-1 min-w-[80px]">
                    {formatTime(segment.start)}
                  </span>
                  <p className={cn(
                    'text-sm flex-1 leading-relaxed',
                    activeSegmentIndex === index ? 'text-blue-900 font-medium' : 'text-gray-700'
                  )}>
                    {segment.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 