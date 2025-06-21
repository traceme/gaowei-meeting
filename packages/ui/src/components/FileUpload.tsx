import React, { useRef, useState } from 'react'
import { cn } from '../utils/cn'

export interface FileUploadProps {
  accept?: string
  multiple?: boolean
  maxSize?: number // 文件大小限制(MB)
  onFilesSelect: (files: File[]) => void
  onError?: (error: string) => void
  className?: string
  children?: React.ReactNode
  disabled?: boolean
  allowedTypes?: string[]
}

export const FileUpload: React.FC<FileUploadProps> = ({
  accept = 'audio/*',
  multiple = false,
  maxSize = 100, // 默认100MB
  onFilesSelect,
  onError,
  className,
  children,
  disabled = false,
  allowedTypes = ['mp3', 'wav', 'm4a', 'webm', 'ogg', 'flac']
}) => {
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFiles = (files: File[]): File[] => {
    const validFiles: File[] = []
    
    for (const file of files) {
      // 检查文件类型
      const isValidType = file.type.startsWith('audio/') || 
        allowedTypes.some(ext => file.name.toLowerCase().endsWith(`.${ext}`))
      
      if (!isValidType) {
        onError?.(`不支持的文件类型: ${file.name}`)
        continue
      }

      // 检查文件大小
      if (file.size > maxSize * 1024 * 1024) {
        onError?.(`文件 ${file.name} 超过 ${maxSize}MB 限制`)
        continue
      }

      validFiles.push(file)
    }

    return validFiles
  }

  const handleFiles = (files: File[]) => {
    if (disabled) return
    
    const validFiles = validateFiles(files)
    if (validFiles.length > 0) {
      onFilesSelect(validFiles)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) {
      setIsDragOver(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    
    if (disabled) return
    
    const files = Array.from(e.dataTransfer.files)
    handleFiles(files)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      handleFiles(files)
    }
  }

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click()
    }
  }

  return (
    <div
      className={cn(
        'relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200',
        isDragOver && !disabled
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 hover:border-gray-400',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />
      
      {children || (
        <div className="space-y-4">
          <div className="text-6xl text-gray-400">📁</div>
          <div>
            <p className="text-lg font-medium text-gray-900 mb-2">
              {isDragOver ? '释放文件到这里' : '拖拽音频文件到这里，或点击选择'}
            </p>
            <p className="text-sm text-gray-500">
              支持格式: {allowedTypes.map(type => type.toUpperCase()).join(', ')}
            </p>
            <p className="text-sm text-gray-500">
              最大文件大小: {maxSize}MB
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export interface FileListProps {
  files: File[]
  onRemove?: (index: number) => void
  className?: string
  showSize?: boolean
}

export const FileList: React.FC<FileListProps> = ({
  files,
  onRemove,
  className,
  showSize = true
}) => {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (files.length === 0) return null

  return (
    <div className={cn('space-y-2', className)}>
      <h4 className="text-sm font-medium text-gray-900">已选择的文件:</h4>
      {files.map((file, index) => (
        <div
          key={`${file.name}-${index}`}
          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
        >
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🎵</span>
            <div>
              <p className="text-sm font-medium text-gray-900">{file.name}</p>
              {showSize && (
                <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
              )}
            </div>
          </div>
          {onRemove && (
            <button
              onClick={() => onRemove(index)}
              className="text-red-500 hover:text-red-700 transition-colors p-1"
              title="移除文件"
            >
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  )
} 