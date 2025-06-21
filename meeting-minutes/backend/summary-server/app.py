#!/usr/bin/env python3
"""
Meeting Minutes Summary Server - 使用 OpenAI API
"""

import os
import json
import sqlite3
import logging
from datetime import datetime
from flask import Flask, request, jsonify, g
from flask_cors import CORS
import requests

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 创建 Flask 应用
app = Flask(__name__)
CORS(app)

# 配置
DATABASE = os.getenv('DATABASE_URL', 'sqlite:///data/transcripts.db').replace('sqlite:///', '')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')

# 初始化 OpenAI 客户端
client = None
if OPENAI_API_KEY:
    try:
        from openai import OpenAI
        client = OpenAI(api_key=OPENAI_API_KEY)
        logger.info("OpenAI client initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize OpenAI client: {e}")
        client = None
else:
    logger.warning("OPENAI_API_KEY not set. AI summary features will be disabled.")

# 数据库初始化
def init_db():
    """初始化数据库"""
    os.makedirs(os.path.dirname(DATABASE), exist_ok=True)
    
    with sqlite3.connect(DATABASE) as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS meetings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        conn.execute('''
            CREATE TABLE IF NOT EXISTS transcripts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                meeting_id INTEGER,
                text TEXT NOT NULL,
                timestamp TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (meeting_id) REFERENCES meetings (id)
            )
        ''')
        
        conn.execute('''
            CREATE TABLE IF NOT EXISTS summaries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                meeting_id INTEGER,
                summary_data TEXT,
                model_used TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (meeting_id) REFERENCES meetings (id)
            )
        ''')
        
        conn.commit()
        logger.info("Database initialized successfully")

def get_db():
    """获取数据库连接"""
    if 'db' not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
    return g.db

@app.teardown_appcontext
def close_db(error):
    """关闭数据库连接"""
    db = g.pop('db', None)
    if db is not None:
        db.close()

# 路由定义
@app.route('/health', methods=['GET'])
def health_check():
    """健康检查端点"""
    try:
        # 检查数据库连接
        db = get_db()
        db.execute('SELECT 1').fetchone()
        
        # 检查 OpenAI API 状态
        openai_status = "connected" if client else "no_api_key"
        
        return jsonify({
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "database": "connected",
            "openai": openai_status
        })
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({
            "status": "unhealthy",
            "error": str(e)
        }), 500

@app.route('/save-transcript', methods=['POST'])
def save_transcript():
    """保存转录内容"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        meeting_title = data.get('meeting_title', 'Untitled Meeting')
        transcripts = data.get('transcripts', [])
        
        if not transcripts:
            return jsonify({"error": "No transcripts provided"}), 400
        
        db = get_db()
        
        # 创建会议记录
        cursor = db.execute(
            'INSERT INTO meetings (title) VALUES (?)',
            (meeting_title,)
        )
        meeting_id = cursor.lastrowid
        
        # 保存转录内容
        for transcript in transcripts:
            db.execute(
                'INSERT INTO transcripts (meeting_id, text, timestamp) VALUES (?, ?, ?)',
                (meeting_id, transcript.get('text', ''), transcript.get('timestamp', ''))
            )
        
        db.commit()
        
        logger.info(f"Saved transcript for meeting: {meeting_title} (ID: {meeting_id})")
        
        return jsonify({
            "message": "Transcript saved successfully",
            "meeting_id": meeting_id
        })
        
    except Exception as e:
        logger.error(f"Error saving transcript: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/process-transcript', methods=['POST'])
def process_transcript():
    """处理转录内容并生成摘要"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        text = data.get('text', '')
        model = data.get('model', 'openai')
        model_name = data.get('model_name', 'gpt-4o-mini')
        
        if not text.strip():
            return jsonify({"error": "No text provided"}), 400
        
        # 生成处理 ID
        import uuid
        process_id = str(uuid.uuid4())
        
        # 直接处理并返回结果
        try:
            summary = generate_summary(text, model, model_name)
            
            # 存储结果
            app.config[f'process_{process_id}'] = {
                'status': 'completed',
                'data': summary
            }
            
        except Exception as e:
            logger.error(f"Error generating summary: {e}")
            app.config[f'process_{process_id}'] = {
                'status': 'error',
                'error': str(e)
            }
        
        return jsonify({"process_id": process_id})
        
    except Exception as e:
        logger.error(f"Error processing transcript: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/get-summary/<process_id>', methods=['GET'])
def get_summary(process_id):
    """获取摘要结果"""
    try:
        result = app.config.get(f'process_{process_id}')
        
        if not result:
            return jsonify({
                "status": "not_found",
                "error": "Process ID not found"
            }), 404
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error getting summary: {e}")
        return jsonify({"error": str(e)}), 500

def generate_summary(text, model, model_name):
    """生成摘要"""
    if model == 'openai':
        return generate_openai_summary(text, model_name)
    elif model == 'ollama':
        return generate_ollama_summary(text, model_name)
    else:
        raise ValueError(f"Unsupported model: {model}")

def generate_openai_summary(text, model_name):
    """使用 OpenAI API 生成摘要"""
    if not client:
        raise Exception("OpenAI API key not configured")
    
    # 构建提示词
    prompt = f"""请分析以下会议转录内容，并提供结构化摘要。请用JSON格式返回，包含以下部分：
请严格使用简体中文回答，不要使用繁体中文字符。

1. MeetingName: 为这次会议生成一个描述性标题
2. key_points: 主要讨论要点
3. action_items: 需要采取的行动或任务
4. decisions: 做出的决定
5. main_topics: 讨论的主要话题

请严格按照以下JSON格式返回：
{{
    "MeetingName": "会议标题",
    "key_points": {{
        "title": "Key Points",
        "blocks": [
            {{"content": "要点1", "type": "bullet", "color": "default"}},
            {{"content": "要点2", "type": "bullet", "color": "default"}}
        ]
    }},
    "action_items": {{
        "title": "Action Items", 
        "blocks": [
            {{"content": "行动项1", "type": "bullet", "color": "default"}}
        ]
    }},
    "decisions": {{
        "title": "Decisions",
        "blocks": [
            {{"content": "决定1", "type": "bullet", "color": "default"}}
        ]
    }},
    "main_topics": {{
        "title": "Main Topics",
        "blocks": [
            {{"content": "话题1", "type": "bullet", "color": "default"}}
        ]
    }}
}}

会议转录内容：
{text}"""
    
    try:
        # 调用OpenAI API
        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": "你是一个专业的会议记录助手，擅长从转录内容中提取关键信息并生成结构化摘要。请始终返回有效的JSON格式。"},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            max_tokens=2000
        )
        
        summary_text = response.choices[0].message.content.strip()
        logger.info(f"OpenAI response: {summary_text[:200]}...")
        
        # 尝试解析 JSON
        try:
            # 提取 JSON 部分
            json_start = summary_text.find('{')
            json_end = summary_text.rfind('}') + 1
            if json_start != -1 and json_end != -1:
                json_text = summary_text[json_start:json_end]
                summary_data = json.loads(json_text)
            else:
                raise ValueError("No JSON found in response")
                
        except (json.JSONDecodeError, ValueError) as e:
            logger.warning(f"Failed to parse JSON from OpenAI response: {e}")
            # 返回基础摘要格式
            summary_data = {
                "MeetingName": "AI生成摘要",
                "key_points": {
                    "title": "Key Points",
                    "blocks": [{"content": summary_text[:500] + "...", "type": "bullet", "color": "default"}]
                },
                "action_items": {
                    "title": "Action Items",
                    "blocks": [{"content": "请查看完整转录内容了解具体行动项", "type": "bullet", "color": "default"}]
                },
                "decisions": {
                    "title": "Decisions",
                    "blocks": [{"content": "请查看完整转录内容了解具体决定", "type": "bullet", "color": "default"}]
                },
                "main_topics": {
                    "title": "Main Topics",
                    "blocks": [{"content": "从转录中提取的主要讨论内容", "type": "bullet", "color": "default"}]
                }
            }
        
        return summary_data
        
    except Exception as e:
        logger.error(f"Error calling OpenAI API: {e}")
        raise Exception(f"Failed to generate summary using OpenAI: {e}")

def generate_ollama_summary(text, model_name):
    """使用 Ollama API 生成摘要"""
    # 使用环境变量或默认值
    ollama_url = os.getenv('OLLAMA_URL', 'http://ollama:11434')
    
    # 如果模型名为空或默认值，使用更快的 1B 模型
    if not model_name or model_name == 'llama3.2:latest':
        model_name = 'llama3.2:1b'
    
    logger.info(f"Using Ollama model: {model_name} at {ollama_url}")
    
    # 构建提示词（与 OpenAI 相同的格式要求）
    prompt = f"""请分析以下会议转录内容，并提供结构化摘要。请用JSON格式返回，包含以下部分：
请严格使用简体中文回答，不要使用繁体中文字符。

1. MeetingName: 为这次会议生成一个描述性标题
2. key_points: 主要讨论要点
3. action_items: 需要采取的行动或任务
4. decisions: 做出的决定
5. main_topics: 讨论的主要话题

请严格按照以下JSON格式返回：
{{
    "MeetingName": "会议标题",
    "key_points": {{
        "title": "Key Points",
        "blocks": [
            {{"content": "要点1", "type": "bullet", "color": "default"}},
            {{"content": "要点2", "type": "bullet", "color": "default"}}
        ]
    }},
    "action_items": {{
        "title": "Action Items", 
        "blocks": [
            {{"content": "行动项1", "type": "bullet", "color": "default"}}
        ]
    }},
    "decisions": {{
        "title": "Decisions",
        "blocks": [
            {{"content": "决定1", "type": "bullet", "color": "default"}}
        ]
    }},
    "main_topics": {{
        "title": "Main Topics",
        "blocks": [
            {{"content": "话题1", "type": "bullet", "color": "default"}}
        ]
    }}
}}

会议转录内容：
{text}"""
    
    try:
        # 准备请求数据
        request_data = {
            "model": model_name,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.1,
                "top_p": 0.9,
                "num_predict": 2000  # 使用 Ollama 支持的参数名，而不是 max_tokens
            }
        }
        
        logger.info(f"Sending request to Ollama: {ollama_url}/api/generate")
        
        # 发送请求到 Ollama，增加超时时间到 3 分钟
        response = requests.post(
            f"{ollama_url}/api/generate",
            json=request_data,
            timeout=180  # 3 分钟超时
        )
        
        if response.status_code != 200:
            logger.error(f"Ollama API error: {response.status_code} - {response.text}")
            raise Exception(f"Ollama API error: {response.status_code}")
        
        result = response.json()
        summary_text = result.get('response', '')
        
        if not summary_text:
            raise Exception("Ollama returned empty response")
        
        logger.info(f"Ollama response received: {summary_text[:200]}...")
        
        # 尝试解析 JSON（与 OpenAI 相同的解析逻辑）
        try:
            # 提取 JSON 部分
            json_start = summary_text.find('{')
            json_end = summary_text.rfind('}') + 1
            if json_start != -1 and json_end != -1:
                json_text = summary_text[json_start:json_end]
                summary_data = json.loads(json_text)
            else:
                raise ValueError("No JSON found in response")
                
        except (json.JSONDecodeError, ValueError) as e:
            logger.warning(f"Failed to parse JSON from Ollama response: {e}")
            # 返回基础摘要格式
            summary_data = {
                "MeetingName": "Ollama生成摘要",
                "key_points": {
                    "title": "Key Points",
                    "blocks": [{"content": summary_text[:500] + "...", "type": "bullet", "color": "default"}]
                },
                "action_items": {
                    "title": "Action Items",
                    "blocks": [{"content": "请查看完整转录内容了解具体行动项", "type": "bullet", "color": "default"}]
                },
                "decisions": {
                    "title": "Decisions",
                    "blocks": [{"content": "请查看完整转录内容了解具体决定", "type": "bullet", "color": "default"}]
                },
                "main_topics": {
                    "title": "Main Topics",
                    "blocks": [{"content": "从转录中提取的主要讨论内容", "type": "bullet", "color": "default"}]
                }
            }
        
        logger.info("Ollama summary generated successfully")
        return summary_data
        
    except requests.exceptions.Timeout:
        logger.error("Ollama request timed out after 3 minutes")
        raise Exception("Ollama服务超时，请稍后重试")
    except requests.exceptions.ConnectionError:
        logger.error(f"Failed to connect to Ollama at {ollama_url}")
        raise Exception("无法连接到Ollama服务")
    except Exception as e:
        logger.error(f"Error calling Ollama API: {e}")
        raise Exception(f"Ollama摘要生成失败: {e}")

# 启动应用
if __name__ == '__main__':
    # 初始化数据库
    init_db()
    
    # 启动 Flask 应用
    port = int(os.getenv('PORT', 5167))
    host = os.getenv('HOST', '0.0.0.0')
    debug = os.getenv('DEBUG', 'false').lower() == 'true'
    
    logger.info(f"Starting Summary Server on {host}:{port}")
    logger.info(f"Database: {DATABASE}")
    logger.info(f"OpenAI API: {'Enabled' if client else 'Disabled'}")
    
    app.run(
        host=host,
        port=port,
        debug=debug,
        threaded=True
    )
