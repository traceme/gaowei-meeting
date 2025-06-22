import argparse
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
from faster_whisper import WhisperModel
import tempfile
import os
import threading
import time
import uuid
import subprocess
import json
from datetime import datetime, timedelta

# ----------------- Argument Parsing -----------------
parser = argparse.ArgumentParser(description="Flask server for faster-whisper transcription.")
parser.add_argument('--port', type=int, default=8178, help='Port to run the server on.')
parser.add_argument('--model-path', type=str, default='small', help='Path to the faster-whisper model.')
args = parser.parse_args()
# ----------------------------------------------------

# 设置日志
logging.basicConfig(level=logging.INFO)
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

def convert_to_simplified_chinese(text):
    """将繁体中文转换为简体中文"""
    if HAS_OPENCC and cc and text:
        try:
            return cc.convert(text)
        except Exception as e:
            logger.warning(f"繁简转换失败: {e}")
            return text
    return text

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

app = Flask(__name__)
CORS(app, origins=["http://localhost:3118", "http://127.0.0.1:3118"])

# 初始化模型 - 改为使用命令行参数
logger.info(f"Initializing Whisper model from '{args.model_path}'...")
model = WhisperModel(args.model_path, device="cpu", compute_type="int8")
logger.info("Whisper model initialized successfully")

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "model": args.model_path, "active_tasks": len(processing_status)})

@app.route('/', methods=['GET'])
def index():
    return jsonify({"message": "Whisper.cpp compatible server", "status": "running"})

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

def process_audio_async(task_id, file_path, original_filename, language=None):
    """异步处理音频 - 添加数字进度支持"""
    segments_text = []
    
    try:
        # 初始状态 - 添加数字进度
        with _status_lock:
            processing_status[task_id] = {
                "status": "processing",
                "progress": 5,  # 数字进度 0-100
                "progress_text": "Starting transcription...",  # 文本描述
                "filename": original_filename,
                "created_at": datetime.now().isoformat(),
                "segments_processed": 0,
                "language": language or "auto"
            }
        save_status_to_file()
        
        # 开始转录 - 15%
        with _status_lock:
            processing_status[task_id]["progress"] = 15
            processing_status[task_id]["progress_text"] = "Transcribing audio..."
        save_status_to_file()
        
        # 转录音频，支持语言参数
        # 处理简体中文特殊情况
        if language == "zh-cn":
            # 对于简体中文，使用中文转录
            segments, info = model.transcribe(file_path, language="zh")
            logger.info(f"Transcription completed for task {task_id}. Simplified Chinese mode, detected: {info.language}, duration: {info.duration}")
        elif language and language != "auto":
            segments, info = model.transcribe(file_path, language=language)
            logger.info(f"Transcription completed for task {task_id}. Specified language: {language}, detected: {info.language}, duration: {info.duration}")
        else:
            segments, info = model.transcribe(file_path)
            logger.info(f"Transcription completed for task {task_id}. Detected language: {info.language}, duration: {info.duration}")
        
        # 格式化阶段 - 70%
        with _status_lock:
            processing_status[task_id]["progress"] = 70
            processing_status[task_id]["progress_text"] = "Formatting results..."
            processing_status[task_id]["detected_language"] = info.language
        save_status_to_file()
        
        # 格式化结果 - 批量处理，减少状态更新频率
        result = {
            "text": "",
            "segments": [],
            "language": info.language
        }
        
        segment_count = 0
        total_segments = len(list(segments))  # 获取总段数用于计算进度
        batch_size = max(1, total_segments // 10)  # 动态批次大小，确保进度更新10次左右
        
        # 重新获取segments（因为上面已经被消费了）
        if language == "zh-cn":
            segments, info = model.transcribe(file_path, language="zh")
        elif language and language != "auto":
            segments, info = model.transcribe(file_path, language=language)
        else:
            segments, info = model.transcribe(file_path)
        
        for i, segment in enumerate(segments):
            segment_count += 1
            
            # 处理文本转换
            segment_text = segment.text.strip()
            if language == "zh-cn":
                # 简体中文模式，转换繁体为简体
                segment_text = convert_to_simplified_chinese(segment_text)
            
            segment_data = {
                "start": segment.start,
                "end": segment.end,
                "text": segment_text,
                "t0": segment.start,
                "t1": segment.end
            }
            result["segments"].append(segment_data)
            segments_text.append(segment_text)
            
            # 计算处理进度（70% 到 95%）
            processing_progress = 70 + int((i / total_segments) * 25)
            
            # 每批次更新一次进度（减少I/O）
            if i % batch_size == 0:
                with _status_lock:
                    processing_status[task_id]["progress"] = processing_progress
                    processing_status[task_id]["progress_text"] = f"Processed {i+1}/{total_segments} segments..."
                    processing_status[task_id]["segments_processed"] = segment_count
                save_status_to_file()
                logger.info(f"Task {task_id}: processed {i+1}/{total_segments} segments, progress: {processing_progress}%")
        
        # 最终合并文本
        result["text"] = " ".join(segments_text)
        logger.info(f"Processed {segment_count} segments for task {task_id}, total text length: {len(result['text'])}")
        
        # 更新状态为完成
        with _status_lock:
            processing_status[task_id] = {
                "status": "completed",
                "progress": 100,  # 完成进度
                "progress_text": "Completed successfully",
                "result": result,
                "filename": original_filename,
                "created_at": processing_status[task_id]["created_at"],
                "completed_at": datetime.now().isoformat(),
                "segments_processed": segment_count,
                "total_text_length": len(result["text"]),
                "detected_language": info.language,
                "specified_language": language or "auto"
            }
        
        # 强制保存最终状态
        global _last_save_time
        _last_save_time = 0  # 重置时间，强制保存
        save_status_to_file()
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
        
        _last_save_time = 0  # 强制保存错误状态
        save_status_to_file()
        
    finally:
        # 清理临时文件
        if os.path.exists(file_path):
            try:
                os.unlink(file_path)
                logger.info(f"Cleaned up temp file: {file_path}")
            except Exception as e:
                logger.warning(f"Failed to clean up temp file {file_path}: {e}")

@app.route('/inference', methods=['POST'])
def transcribe():
    try:
        logger.info(f"Received inference request: {request.method} {request.url}")
        logger.info(f"Content-Type: {request.content_type}")
        logger.info(f"Files in request: {list(request.files.keys())}")
        
        if 'file' not in request.files:
            logger.error("No file provided in request")
            return jsonify({"error": "No file provided"}), 400
        
        file = request.files['file']
        file_size = len(file.read())
        file.seek(0)  # Reset file pointer
        
        # 获取语言参数
        language = request.form.get('language', None)
        if language == 'auto' or language == '':
            language = None
        
        logger.info(f"Processing file: {file.filename}, size: {file_size} bytes ({file_size/(1024*1024):.1f} MB), language: {language or 'auto'}")
        
        if file.filename == '':
            logger.error("Empty filename")
            return jsonify({"error": "No file selected"}), 400
        
        # 保存临时文件以检查音频时长
        # 保持原始文件扩展名，避免格式转换问题
        file_extension = os.path.splitext(file.filename)[1] or '.wav'
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=file_extension)
        file.save(temp_file.name)
        temp_file.close()
        
        # 获取音频时长
        duration_seconds = get_audio_duration(temp_file.name)
        
        # 决定是否使用异步处理
        # 条件：文件大小 > 10MB 或 音频时长 > 10分钟 或 无法获取时长的大文件
        should_async = False
        estimated_minutes = 0
        
        if duration_seconds:
            estimated_minutes = duration_seconds / 60
            should_async = estimated_minutes > 10  # 超过10分钟
            logger.info(f"Audio duration: {duration_seconds:.1f} seconds ({estimated_minutes:.1f} minutes)")
        else:
            # 无法获取时长，根据文件大小判断
            file_size_mb = file_size / (1024 * 1024)
            should_async = file_size_mb > 10  # 超过10MB
            estimated_minutes = file_size_mb  # 粗略估算
            logger.info(f"Could not determine duration, using file size: {file_size_mb:.1f} MB")
        
        if should_async:
            # 生成任务ID
            task_id = str(uuid.uuid4())
            
            logger.info(f"Using async processing for task {task_id} (estimated {estimated_minutes:.1f} minutes)")
            
            # 立即创建状态记录，包含数字进度
            with _status_lock:
                processing_status[task_id] = {
                    "status": "processing",
                    "progress": 1,  # 数字进度
                    "progress_text": "Initializing...",  # 文本描述
                    "filename": file.filename,
                    "created_at": datetime.now().isoformat(),
                    "file_size_mb": file_size / (1024 * 1024),
                    "estimated_minutes": estimated_minutes,
                    "language": language or "auto"
                }
            save_status_to_file()
            
            # 启动异步处理
            thread = threading.Thread(
                target=process_audio_async, 
                args=(task_id, temp_file.name, file.filename, language)
            )
            thread.daemon = True
            thread.start()
            
            response = {
                "task_id": task_id,
                "status": "processing",
                "progress": 1,
                "message": f"Large file detected ({estimated_minutes:.1f} min). Processing asynchronously.",
                "status_url": f"/status/{task_id}",
                "estimated_time_minutes": estimated_minutes * 0.5,
                "audio_duration_minutes": estimated_minutes,
                "file_size_mb": file_size / (1024 * 1024),
                "language": language or "auto"
            }
            
            logger.info(f"Returning async response for task {task_id}: {response}")
            return jsonify(response)
        
        else:
            # 小文件直接同步处理
            logger.info(f"Using sync processing (estimated {estimated_minutes:.1f} minutes)")
            
            # 转录，支持语言参数
            logger.info("Starting transcription...")
            # 处理简体中文特殊情况
            if language == "zh-cn":
                # 对于简体中文，使用中文转录
                segments, info = model.transcribe(temp_file.name, language="zh")
                logger.info(f"Transcription completed. Simplified Chinese mode, detected: {info.language}, duration: {info.duration}")
            elif language and language != "auto":
                segments, info = model.transcribe(temp_file.name, language=language)
                logger.info(f"Transcription completed. Specified language: {language}, detected: {info.language}, duration: {info.duration}")
            else:
                segments, info = model.transcribe(temp_file.name)
                logger.info(f"Transcription completed. Detected language: {info.language}, duration: {info.duration}")
            
            # 格式化结果
            result = {
                "text": "",
                "segments": [],
                "language": info.language
            }
            
            segment_count = 0
            segments_text = []
            
            for segment in segments:
                segment_count += 1
                
                # 处理文本转换
                segment_text = segment.text.strip()
                if language == "zh-cn":
                    # 简体中文模式，转换繁体为简体
                    segment_text = convert_to_simplified_chinese(segment_text)
                
                result["segments"].append({
                    "start": segment.start,
                    "end": segment.end,
                    "text": segment_text,
                    "t0": segment.start,
                    "t1": segment.end
                })
                segments_text.append(segment_text)
            
            result["text"] = " ".join(segments_text)
            logger.info(f"Processed {segment_count} segments, total text length: {len(result['text'])}")
            
            # 清理临时文件
            os.unlink(temp_file.name)
            
            return jsonify(result)
    
    except Exception as e:
        logger.error(f"Error during transcription: {str(e)}", exc_info=True)
        # 清理临时文件
        if 'temp_file' in locals() and os.path.exists(temp_file.name):
            os.unlink(temp_file.name)
        return jsonify({"error": str(e)}), 500

@app.route('/stream', methods=['POST'])
def stream_transcribe():
    """流式处理音频 - 这是一个占位符，Whisper.cpp支持但faster-whisper默认不支持"""
    # faster-whisper本身不支持流式解码，此功能需要额外实现
    # 这里返回一个兼容的错误或空实现
    return jsonify({
        "error": "Streaming not implemented in this Python server.",
        "message": "This endpoint is a placeholder for Whisper.cpp compatibility."
    }), 501

if __name__ == '__main__':
    logger.info(f"Starting server on http://127.0.0.1:{args.port}")
    app.run(host='127.0.0.1', port=args.port, debug=False)