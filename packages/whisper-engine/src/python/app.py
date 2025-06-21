#!/usr/bin/env python3
"""
Whisper转录引擎服务
基于faster-whisper实现的HTTP API服务
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from faster_whisper import WhisperModel
import tempfile
import os
import logging
import threading
import time
import uuid
import subprocess
import json
from datetime import datetime, timedelta
import argparse

# 配置命令行参数
parser = argparse.ArgumentParser(description="Flask server for faster-whisper transcription.")
parser.add_argument('--port', type=int, default=8178, help='Port to run the server on.')
parser.add_argument('--model-path', type=str, default='small', help='Path to the faster-whisper model.')
args = parser.parse_args()

# 设置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 尝试导入OpenCC用于中文转换
try:
    import opencc
    HAS_OPENCC = True
    cc = opencc.OpenCC('t2s')  # traditional to simplified
    logger.info("OpenCC库已加载，支持繁简转换")
except ImportError:
    HAS_OPENCC = False
    cc = None
    logger.warning("OpenCC库未安装，无法进行繁简转换")

def convert_to_simplified_chinese(text):
    """将繁体中文转换为简体中文"""
    if HAS_OPENCC and cc and text:
        try:
            return cc.convert(text)
        except Exception as e:
            logger.warning(f"繁简转换失败: {e}")
            return text
    return text

app = Flask(__name__)
CORS(app, origins=["*"])  # 允许所有来源

# 初始化模型
logger.info(f"Initializing Whisper model from '{args.model_path}'...")
model = WhisperModel(args.model_path, device="cpu", compute_type="int8")
logger.info("Whisper model initialized successfully")

# 存储处理状态
processing_status = {}
_status_lock = threading.Lock()

def get_audio_duration(file_path):
    """获取音频文件时长（秒）"""
    try:
        result = subprocess.run([
            'ffprobe', '-v', 'quiet', '-show_entries', 
            'format=duration', '-of', 'csv=p=0', file_path
        ], capture_output=True, text=True, timeout=10)
        
        if result.returncode == 0:
            duration = float(result.stdout.strip())
            return duration
    except Exception as e:
        logger.warning(f"Could not get audio duration: {e}")
    
    return None

@app.route('/health', methods=['GET'])
def health():
    """健康检查端点"""
    return jsonify({
        "status": "ok", 
        "model": args.model_path, 
        "active_tasks": len(processing_status)
    })

@app.route('/', methods=['GET'])
def index():
    """根路径"""
    return jsonify({
        "message": "Whisper转录引擎服务", 
        "status": "running",
        "model": args.model_path
    })

@app.route('/status/<task_id>', methods=['GET'])
def get_status(task_id):
    """获取处理状态"""
    logger.info(f"Status request for task: {task_id}")
    
    if task_id in processing_status:
        status = processing_status[task_id]
        return jsonify(status)
    else:
        return jsonify({
            "error": "Task not found", 
            "task_id": task_id
        }), 404

@app.route('/tasks', methods=['GET'])
def list_tasks():
    """列出所有任务状态"""
    return jsonify({
        "total_tasks": len(processing_status),
        "tasks": {task_id: status.get('status', 'unknown') for task_id, status in processing_status.items()}
    })

def process_audio_async(task_id, file_path, original_filename, language=None):
    """异步处理音频"""
    segments_text = []
    
    try:
        # 初始状态
        with _status_lock:
            processing_status[task_id] = {
                "status": "processing",
                "progress": 5,
                "progress_text": "Starting transcription...",
                "filename": original_filename,
                "created_at": datetime.now().isoformat(),
                "language": language or "auto"
            }
        
        # 开始转录
        with _status_lock:
            processing_status[task_id]["progress"] = 15
            processing_status[task_id]["progress_text"] = "Transcribing audio..."
        
        # 转录音频
        if language == "zh-cn":
            segments, info = model.transcribe(file_path, language="zh")
        elif language and language != "auto":
            segments, info = model.transcribe(file_path, language=language)
        else:
            segments, info = model.transcribe(file_path)
        
        logger.info(f"Transcription completed for task {task_id}. Language: {info.language}, duration: {info.duration}")
        
        # 格式化结果
        with _status_lock:
            processing_status[task_id]["progress"] = 70
            processing_status[task_id]["progress_text"] = "Formatting results..."
            processing_status[task_id]["detected_language"] = info.language
        
        segment_count = 0
        result_segments = []
        
        for segment in segments:
            segment_count += 1
            
            # 处理文本转换
            segment_text = segment.text.strip()
            if language == "zh-cn":
                segment_text = convert_to_simplified_chinese(segment_text)
            
            result_segments.append({
                "start": segment.start,
                "end": segment.end,
                "text": segment_text,
                "t0": segment.start,
                "t1": segment.end
            })
            segments_text.append(segment_text)
        
        # 完成状态
        with _status_lock:
            processing_status[task_id] = {
                "status": "completed",
                "progress": 100,
                "progress_text": "Transcription completed",
                "filename": original_filename,
                "created_at": processing_status[task_id]["created_at"],
                "completed_at": datetime.now().isoformat(),
                "result": {
                    "text": " ".join(segments_text),
                    "segments": result_segments,
                    "language": info.language,
                    "segment_count": segment_count,
                    "duration": info.duration
                }
            }
        
        logger.info(f"Task {task_id} completed successfully with {segment_count} segments")
        
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error during transcription for task {task_id}: {error_msg}", exc_info=True)
        
        with _status_lock:
            processing_status[task_id] = {
                "status": "error",
                "progress": 0,
                "progress_text": f"Error: {error_msg}",
                "error": error_msg,
                "filename": original_filename,
                "created_at": processing_status[task_id].get("created_at", datetime.now().isoformat()),
                "error_at": datetime.now().isoformat()
            }
        
    finally:
        # 清理临时文件
        if os.path.exists(file_path):
            try:
                os.unlink(file_path)
                logger.info(f"Cleaned up temp file: {file_path}")
            except Exception as e:
                logger.warning(f"Failed to clean up temp file {file_path}: {e}")

@app.route('/transcribe', methods=['POST'])
def transcribe():
    """主要转录端点"""
    try:
        logger.info(f"Received transcription request")
        
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        
        # 获取参数
        language = request.form.get('language', None)
        if language == 'auto' or language == '':
            language = None
        
        file_size = len(file.read())
        file.seek(0)  # Reset file pointer
        
        logger.info(f"Processing file: {file.filename}, size: {file_size} bytes, language: {language or 'auto'}")
        
        # 保存临时文件
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
        file.save(temp_file.name)
        temp_file.close()
        
        # 获取音频时长
        duration_seconds = get_audio_duration(temp_file.name)
        
        # 决定是否使用异步处理（大于10分钟或10MB的文件）
        should_async = False
        estimated_minutes = 0
        
        if duration_seconds:
            estimated_minutes = duration_seconds / 60
            should_async = estimated_minutes > 10
        else:
            file_size_mb = file_size / (1024 * 1024)
            should_async = file_size_mb > 10
            estimated_minutes = file_size_mb
        
        if should_async:
            # 异步处理
            task_id = str(uuid.uuid4())
            
            logger.info(f"Using async processing for task {task_id} (estimated {estimated_minutes:.1f} minutes)")
            
            with _status_lock:
                processing_status[task_id] = {
                    "status": "processing",
                    "progress": 1,
                    "progress_text": "Initializing...",
                    "filename": file.filename,
                    "created_at": datetime.now().isoformat(),
                    "language": language or "auto"
                }
            
            # 启动异步处理
            thread = threading.Thread(
                target=process_audio_async, 
                args=(task_id, temp_file.name, file.filename, language)
            )
            thread.daemon = True
            thread.start()
            
            return jsonify({
                "task_id": task_id,
                "status": "processing",
                "progress": 1,
                "message": f"Large file detected. Processing asynchronously.",
                "status_url": f"/status/{task_id}",
                "language": language or "auto"
            })
        
        else:
            # 同步处理
            logger.info(f"Using sync processing")
            
            # 转录
            if language == "zh-cn":
                segments, info = model.transcribe(temp_file.name, language="zh")
            elif language and language != "auto":
                segments, info = model.transcribe(temp_file.name, language=language)
            else:
                segments, info = model.transcribe(temp_file.name)
            
            logger.info(f"Transcription completed. Language: {info.language}, duration: {info.duration}")
            
            # 格式化结果
            result_segments = []
            segments_text = []
            
            for segment in segments:
                segment_text = segment.text.strip()
                if language == "zh-cn":
                    segment_text = convert_to_simplified_chinese(segment_text)
                
                result_segments.append({
                    "start": segment.start,
                    "end": segment.end,
                    "text": segment_text,
                    "t0": segment.start,
                    "t1": segment.end
                })
                segments_text.append(segment_text)
            
            result = {
                "text": " ".join(segments_text),
                "segments": result_segments,
                "language": info.language,
                "duration": info.duration,
                "segment_count": len(result_segments)
            }
            
            # 清理临时文件
            os.unlink(temp_file.name)
            
            return jsonify(result)
    
    except Exception as e:
        logger.error(f"Error during transcription: {str(e)}", exc_info=True)
        # 清理临时文件
        if 'temp_file' in locals() and os.path.exists(temp_file.name):
            os.unlink(temp_file.name)
        return jsonify({"error": str(e)}), 500

# 兼容性端点（与原whisper.cpp兼容）
@app.route('/inference', methods=['POST'])
def inference():
    """兼容原whisper.cpp API的端点"""
    return transcribe()

if __name__ == '__main__':
    logger.info(f"Starting Whisper service on http://127.0.0.1:{args.port}")
    app.run(host='127.0.0.1', port=args.port, debug=False) 