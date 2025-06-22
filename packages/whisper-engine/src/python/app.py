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
from opencc import OpenCC
from typing import Dict, Any, Optional

# ----------------- Argument Parsing -----------------
parser = argparse.ArgumentParser(description="Flask server for faster-whisper transcription.")
parser.add_argument('--port', type=int, default=8178, help='Port to run the server on.')
parser.add_argument('--model-path', type=str, default='small', help='Path to the faster-whisper model.')
args = parser.parse_args()
# ----------------------------------------------------

# 设置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# 尝试导入OpenCC用于中文转换
try:
    import opencc
    HAS_OPENCC = True
    # 创建繁体转简体的转换器
    cc = opencc.OpenCC('t2s')  # traditional to simplified
    logger.info("OpenCC库已加载，支持繁简转换")
except ImportError:
    HAS_OPENCC = False
    cc = None
    logger.warning("OpenCC库未安装，无法进行繁简转换。可以通过 pip install opencc-python-reimplemented 安装")

def convert_to_simplified_chinese(text: str) -> str:
    """将繁体中文转换为简体中文"""
    if HAS_OPENCC and cc and text:
        try:
            return cc.convert(text)
        except Exception as e:
            logger.warning(f"繁简转换失败: {e}")
            return text
    return text

app = Flask(__name__)
CORS(app, origins=["http://localhost:3118", "http://127.0.0.1:3118", "http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173", "http://127.0.0.1:5173"])

# 初始化模型 - 改为使用命令行参数
logger.info(f"Initializing Whisper model from '{args.model_path}'...")
model = WhisperModel(args.model_path, device="cpu", compute_type="int8")
logger.info("Whisper model initialized successfully")

# 存储处理状态 - 优化版本：减少文件I/O
processing_status = {}
STATUS_FILE = "/tmp/whisper_status.json"
_status_lock = threading.Lock()
_last_save_time = 0
SAVE_INTERVAL = 5  # 每5秒最多保存一次

def save_status_to_file():
    """将状态保存到文件，防止丢失 - 优化频率"""
    global _last_save_time
    
    current_time = time.time()
    if current_time - _last_save_time < SAVE_INTERVAL:
        return  # 跳过太频繁的保存
    
    try:
        with _status_lock:
            # 清理过期状态（超过24小时）
            now = datetime.now()
            expired_tasks = []
            for task_id, status in processing_status.items():
                if 'created_at' in status:
                    created_at = datetime.fromisoformat(status['created_at'])
                    if now - created_at > timedelta(hours=24):
                        expired_tasks.append(task_id)
            
            for task_id in expired_tasks:
                del processing_status[task_id]
                logger.info(f"Cleaned up expired task: {task_id}")
            
            # 保存到文件
            with open(STATUS_FILE, 'w') as f:
                json.dump(processing_status, f, indent=2)
            
            _last_save_time = current_time
            
    except Exception as e:
        logger.warning(f"Failed to save status to file: {e}")

def load_status_from_file():
    """从文件加载状态"""
    try:
        if os.path.exists(STATUS_FILE):
            with open(STATUS_FILE, 'r') as f:
                loaded_status = json.load(f)
                processing_status.update(loaded_status)
                logger.info(f"Loaded {len(loaded_status)} tasks from status file")
    except Exception as e:
        logger.warning(f"Failed to load status from file: {e}")

# 启动时加载状态
load_status_from_file()

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
    return jsonify({"status": "ok", "model": args.model_path, "active_tasks": len(processing_status)})

@app.route('/', methods=['GET'])
def index():
    return jsonify({"message": "Whisper转录引擎服务", "model": args.model_path, "status": "running"})

@app.route('/status/<task_id>', methods=['GET'])
def get_status(task_id):
    """获取处理状态 - 改进版本"""
    logger.info(f"Status request for task: {task_id}")
    
    if task_id in processing_status:
        status = processing_status[task_id]
        logger.info(f"Status for {task_id}: {status.get('status', 'unknown')}")
        return jsonify(status)
    else:
        logger.warning(f"Task not found: {task_id}. Available tasks: {list(processing_status.keys())}")
        return jsonify({
            "error": "Task not found", 
            "task_id": task_id,
            "available_tasks": len(processing_status),
            "message": "Task may have expired or was never created"
        }), 404

@app.route('/tasks', methods=['GET'])
def list_tasks():
    """列出所有任务状态 - 调试用"""
    return jsonify({
        "total_tasks": len(processing_status),
        "tasks": {task_id: status.get('status', 'unknown') for task_id, status in processing_status.items()}
    })

def update_task_progress(task_id: str, progress: int, status: str = 'processing', progress_text: str = None):
    """更新任务进度"""
    if task_id in processing_status:
        processing_status[task_id]['progress'] = progress
        processing_status[task_id]['status'] = status
        if progress_text:
            processing_status[task_id]['progress_text'] = progress_text
        processing_status[task_id]['updated_at'] = datetime.now().isoformat()
        logger.info(f"任务 {task_id}: {progress}% - {progress_text or status}")

def process_audio_with_progress(task_id: str, file_path: str, language: str = None):
    """带进度更新的音频处理"""
    try:
        # 1. 开始处理 (10%)
        update_task_progress(task_id, 10, 'processing', '音频分析中...')
        
        # 模拟音频分析
        time.sleep(1)
        
        # 2. 音频预处理完成 (25%)
        update_task_progress(task_id, 25, 'processing', '语音识别准备中...')
        
        # 3. 开始转录 (30%)
        update_task_progress(task_id, 30, 'processing', '语音识别进行中...')
        
        # 执行转录
        if language == "zh-cn":
            # 对于简体中文，使用中文转录
            segments, info = model.transcribe(file_path, language="zh")
        else:
            segments, info = model.transcribe(file_path, language=language)
        
        # 4. 转录进行中进度更新
        segments_list = list(segments)
        total_segments = len(segments_list)
        
        processed_segments = []
        for i, segment in enumerate(segments_list):
            # 计算进度 (30% - 70%)
            progress = 30 + int((i + 1) / total_segments * 40)
            update_task_progress(task_id, progress, 'processing', f'处理音频片段 {i+1}/{total_segments}...')
            
            processed_segments.append({
                "start": segment.start,
                "end": segment.end,
                "text": segment.text
            })
            
            # 短暂延迟以显示进度
            if total_segments > 10:  # 只对长音频显示详细进度
                time.sleep(0.1)
        
        # 5. 文本处理 (70%)
        update_task_progress(task_id, 70, 'processing', '文本处理中...')
        
        # 合并文本
        text = " ".join([segment["text"] for segment in processed_segments])
        
        # 6. 繁简转换 (85%)
        update_task_progress(task_id, 85, 'processing', '繁简转换中...')
        
        # 繁简转换
        if language == "zh-cn" or info.language == "zh":
            text = convert_to_simplified_chinese(text)
            for segment in processed_segments:
                segment["text"] = convert_to_simplified_chinese(segment["text"])
        
        # 7. 完成 (100%)
        result = {
            "text": text,
            "language": info.language,
            "duration": info.duration,
            "segments": processed_segments
        }
        
        with _status_lock:
            processing_status[task_id] = {
                "status": "completed",
                "progress": 100,
                "progress_text": "转录完成",
                "result": result,
                "completed_at": datetime.now().isoformat()
            }
        save_status_to_file()
        
        logger.info(f"任务 {task_id} 转录完成")
        
    except Exception as e:
        error_msg = str(e)
        logger.error(f"任务 {task_id} 转录失败: {error_msg}")
        with _status_lock:
            processing_status[task_id] = {
                "status": "error",
                "error": error_msg,
                "progress": 0,
                "completed_at": datetime.now().isoformat()
            }
        save_status_to_file()
    finally:
        # 清理临时文件
        try:
            if os.path.exists(file_path):
                os.unlink(file_path)
                logger.info(f"Cleaned up temporary file: {file_path}")
        except Exception as e:
            logger.warning(f"Failed to clean up temporary file {file_path}: {e}")

@app.route('/inference', methods=['POST'])
def transcribe():
    """转录音频文件"""
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Empty filename"}), 400
    
    # 获取语言参数
    language = request.form.get('language', 'auto')
    
    try:
        # 生成任务ID（使用时间戳确保唯一性）
        task_id = f"task_{int(time.time() * 1000)}_{len(processing_status)}"
        
        # 保存临时文件
        temp_dir = tempfile.gettempdir()
        file_extension = os.path.splitext(file.filename)[1] or '.wav'
        temp_file_path = os.path.join(temp_dir, f"whisper_{task_id}{file_extension}")
        file.save(temp_file_path)
        
        logger.info(f"收到转录请求 - 任务ID: {task_id}, 语言: {language}, 文件: {file.filename}")
        
        # 获取音频时长
        duration = get_audio_duration(temp_file_path)
        logger.info(f"音频时长: {duration} 秒" if duration else "无法获取音频时长")
        
        # 初始化任务状态
        with _status_lock:
            processing_status[task_id] = {
                "task_id": task_id,
                "status": "processing",
                "progress": 5,
                "progress_text": "转录任务开始...",
                "filename": file.filename,
                "language": language,
                "duration": duration,
                "created_at": datetime.now().isoformat()
            }
        save_status_to_file()
        
        # 在后台线程中处理
        thread = threading.Thread(
            target=process_audio_with_progress,
            args=(task_id, temp_file_path, language)
        )
        thread.daemon = True
        thread.start()
        
        # 返回任务ID
        return jsonify({
            "task_id": task_id,
            "status": "processing",
            "message": "转录任务已开始"
        })
        
    except Exception as e:
        error_msg = f"转录请求处理失败: {str(e)}"
        logger.error(error_msg)
        return jsonify({"error": error_msg}), 500

@app.route('/stream', methods=['POST'])
def stream_transcribe():
    """流式转录 - 暂未实现，返回错误"""
    return jsonify({"error": "Streaming transcription not yet implemented"}), 501

if __name__ == '__main__':
    logger.info(f"Starting Whisper service on http://127.0.0.1:{args.port}")
    app.run(host='127.0.0.1', port=args.port, debug=False) 