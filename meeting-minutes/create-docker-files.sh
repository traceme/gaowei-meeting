#!/bin/bash

# 创建 Docker 配置文件的脚本
# 这个脚本会在正确的位置创建所有必要的 Docker 文件

set -e

echo "🔧 Creating Docker configuration files..."

# 创建必要的目录
mkdir -p backend/whisper-custom
mkdir -p backend/summary-server
mkdir -p frontend

# 创建 backend/whisper-custom/Dockerfile
echo "📝 Creating backend/whisper-custom/Dockerfile..."
cat > backend/whisper-custom/Dockerfile << 'EOF'
# 使用官方的 Ubuntu 22.04 基础镜像
FROM ubuntu:22.04

# 设置非交互式安装，避免时区等配置提示
ENV DEBIAN_FRONTEND=noninteractive

# 安装构建依赖和运行时依赖
RUN apt-get update && apt-get install -y \
    # 构建工具
    build-essential \
    cmake \
    pkg-config \
    # 网络工具
    curl \
    wget \
    # SSL 支持
    libcurl4-openssl-dev \
    libssl-dev \
    # JSON 处理
    nlohmann-json3-dev \
    # 版本控制
    git \
    # 清理缓存
    && rm -rf /var/lib/apt/lists/*

# 设置工作目录
WORKDIR /app

# 复制项目源代码
COPY . .

# 创建模型目录
RUN mkdir -p models

# 下载 Whisper 模型文件
# 使用多个镜像源以提高下载成功率
RUN cd models && \
    echo "Downloading Whisper models..." && \
    # 尝试官方源
    (wget -q --timeout=30 https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin || \
     # 备用源
     wget -q --timeout=30 https://hf-mirror.com/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin || \
     # 如果都失败，创建一个占位文件，需要后续手动下载
     (echo "Model download failed, please download manually" && touch ggml-base.en.bin.placeholder)) && \
    # 验证文件大小（正常的 base.en 模型约 142MB）
    ls -la ggml-base.en.bin* && \
    echo "Model download completed"

# 可选：下载多语言模型
RUN cd models && \
    echo "Downloading multilingual model..." && \
    (wget -q --timeout=30 https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin || \
     wget -q --timeout=30 https://hf-mirror.com/ggerganov/whisper.cpp/resolve/main/ggml-base.bin || \
     echo "Multilingual model download failed") && \
    ls -la ggml-base.bin* || true

# 创建构建目录并编译项目
RUN mkdir -p build && cd build && \
    echo "Configuring build with CMake..." && \
    cmake .. \
        -DCMAKE_BUILD_TYPE=Release \
        -DWHISPER_BUILD_TESTS=OFF \
        -DWHISPER_BUILD_EXAMPLES=OFF \
        -DBUILD_SHARED_LIBS=OFF \
        -DWHISPER_BUILD_SERVER=ON && \
    echo "Building project..." && \
    make -j$(nproc) && \
    echo "Build completed successfully"

# 验证编译结果
RUN ls -la build/bin/ && \
    ldd build/bin/server || echo "Static binary, no dynamic dependencies"

# 创建运行时用户（安全最佳实践）
RUN useradd -r -s /bin/false whisper && \
    chown -R whisper:whisper /app

# 暴露服务端口
EXPOSE 8178

# 设置健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8178/ || exit 1

# 创建启动脚本
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
echo "Starting Whisper.cpp server..."\n\
echo "Model directory contents:"\n\
ls -la /app/models/\n\
\n\
# 检查模型文件是否存在\n\
if [ ! -f "/app/models/ggml-base.en.bin" ] || [ ! -s "/app/models/ggml-base.en.bin" ]; then\n\
    echo "ERROR: Model file not found or empty. Please download the model:"\n\
    echo "docker-compose exec whisper-server bash"\n\
    echo "cd models"\n\
    echo "wget https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin"\n\
    exit 1\n\
fi\n\
\n\
# 启动服务器\n\
exec /app/build/bin/server \\\n\
    -m "/app/models/${WHISPER_MODEL:-ggml-base.en.bin}" \\\n\
    --port 8178 \\\n\
    --host "0.0.0.0" \\\n\
    --threads "${WHISPER_THREADS:-4}" \\\n\
    --language "en" \\\n\
    --diarize \\\n\
    --no-fallback\n\
' > /app/start.sh && chmod +x /app/start.sh

# 切换到非特权用户
USER whisper

# 启动命令
CMD ["/app/start.sh"]
EOF

# 创建 backend/whisper-custom/.dockerignore
echo "📝 Creating backend/whisper-custom/.dockerignore..."
cat > backend/whisper-custom/.dockerignore << 'EOF'
# 构建产物
build/
*.o
*.so
*.dylib
*.dll

# IDE 文件
.vscode/
.idea/
*.swp
*.swo

# 系统文件
.DS_Store
Thumbs.db

# 日志文件
*.log

# 临时文件
*.tmp
*.temp

# Git
.git/
.gitignore

# 文档
README.md
*.md

# 示例文件
examples/
samples/

# 模型文件（在 Dockerfile 中下载）
models/*.bin
models/*.pt

# 测试文件
tests/
*_test.*
EOF

# 创建 backend/summary-server/Dockerfile
echo "📝 Creating backend/summary-server/Dockerfile..."
cat > backend/summary-server/Dockerfile << 'EOF'
# 使用官方 Python 3.9 精简镜像
FROM python:3.9-slim

# 设置环境变量
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    # 网络工具
    curl \
    wget \
    # 构建工具（某些 Python 包需要）
    build-essential \
    # 清理缓存
    && rm -rf /var/lib/apt/lists/*

# 创建应用用户
RUN useradd -r -s /bin/false -m -d /app summary

# 设置工作目录
WORKDIR /app

# 创建数据目录
RUN mkdir -p /app/data && chown summary:summary /app/data

# 复制依赖文件
COPY requirements.txt .

# 安装 Python 依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY . .

# 设置目录权限
RUN chown -R summary:summary /app

# 创建健康检查端点脚本
RUN echo '#!/usr/bin/env python3\n\
import requests\n\
import sys\n\
try:\n\
    response = requests.get("http://localhost:5167/health", timeout=5)\n\
    if response.status_code == 200:\n\
        sys.exit(0)\n\
    else:\n\
        sys.exit(1)\n\
except:\n\
    sys.exit(1)\n\
' > /app/health_check.py && chmod +x /app/health_check.py

# 创建初始化脚本
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
echo "Initializing Summary Server..."\n\
\n\
# 创建数据库目录\n\
mkdir -p /app/data\n\
\n\
# 等待 Ollama 服务启动\n\
echo "Waiting for Ollama service..."\n\
timeout=60\n\
while [ $timeout -gt 0 ]; do\n\
    if curl -f "${OLLAMA_URL:-http://ollama:11434}/api/tags" >/dev/null 2>&1; then\n\
        echo "Ollama service is ready"\n\
        break\n\
    fi\n\
    echo "Waiting for Ollama... ($timeout seconds remaining)"\n\
    sleep 2\n\
    timeout=$((timeout-2))\n\
done\n\
\n\
if [ $timeout -le 0 ]; then\n\
    echo "WARNING: Ollama service not responding, continuing anyway..."\n\
fi\n\
\n\
# 初始化数据库（如果需要）\n\
if [ -f "init_db.py" ]; then\n\
    echo "Initializing database..."\n\
    python init_db.py\n\
fi\n\
\n\
echo "Starting Flask application..."\n\
exec python app.py\n\
' > /app/start.sh && chmod +x /app/start.sh

# 切换到应用用户
USER summary

# 暴露端口
EXPOSE 5167

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD python /app/health_check.py

# 启动命令
CMD ["/app/start.sh"]
EOF

# 创建 backend/summary-server/.dockerignore
echo "📝 Creating backend/summary-server/.dockerignore..."
cat > backend/summary-server/.dockerignore << 'EOF'
# Python 缓存
__pycache__/
*.py[cod]
*$py.class
*.pyc

# 虚拟环境
venv/
env/
.env

# IDE 文件
.vscode/
.idea/
*.swp
*.swo

# 系统文件
.DS_Store
Thumbs.db

# 日志文件
*.log

# 数据库文件
*.db
*.sqlite
*.sqlite3

# 测试文件
tests/
test_*.py
*_test.py

# 开发工具
.pytest_cache/
.coverage
htmlcov/

# Git
.git/
.gitignore

# 文档
README.md
*.md

# 临时文件
*.tmp
*.temp

# 数据目录（运行时创建）
data/
uploads/
EOF

# 创建 backend/summary-server/requirements.txt
echo "📝 Creating backend/summary-server/requirements.txt..."
cat > backend/summary-server/requirements.txt << 'EOF'
# Web 框架
Flask==2.3.3
Flask-CORS==4.0.0

# HTTP 客户端
requests==2.31.0

# JSON 处理
jsonschema==4.19.0

# 数据库
SQLAlchemy==2.0.20

# AI/ML 库
anthropic==0.3.11
openai==0.28.1

# 数据处理
pandas==2.0.3
numpy==1.24.3

# 异步支持
asyncio==3.4.3

# 日志
structlog==23.1.0

# 环境变量
python-dotenv==1.0.0

# 时间处理
python-dateutil==2.8.2

# 文本处理
nltk==3.8.1

# 开发工具
pytest==7.4.2
pytest-flask==1.2.0
EOF

# 创建 backend/summary-server/app.py（如果不存在）
if [ ! -f "backend/summary-server/app.py" ]; then
    echo "📝 Creating backend/summary-server/app.py..."
    cat > backend/summary-server/app.py << 'EOF'
#!/usr/bin/env python3
"""
Meeting Minutes Summary Server
基础的 Flask 应用，提供转录摘要功能
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
OLLAMA_URL = os.getenv('OLLAMA_URL', 'http://ollama:11434')

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

def close_db(e=None):
    """关闭数据库连接"""
    db = g.pop('db', None)
    if db is not None:
        db.close()

@app.teardown_appcontext
def close_db(error):
    close_db()

# 路由定义
@app.route('/health', methods=['GET'])
def health_check():
    """健康检查端点"""
    try:
        # 检查数据库连接
        db = get_db()
        db.execute('SELECT 1').fetchone()
        
        # 检查 Ollama 连接
        ollama_status = "unknown"
        try:
            response = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
            ollama_status = "connected" if response.status_code == 200 else "error"
        except:
            ollama_status = "disconnected"
        
        return jsonify({
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "database": "connected",
            "ollama": ollama_status
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
        model = data.get('model', 'ollama')
        model_name = data.get('model_name', 'llama3.2:latest')
        
        if not text.strip():
            return jsonify({"error": "No text provided"}), 400
        
        # 生成处理 ID（简单实现）
        import uuid
        process_id = str(uuid.uuid4())
        
        # 存储处理请求（简化版本，实际应该使用队列）
        # 这里直接处理并返回
        try:
            summary = generate_summary(text, model, model_name)
            
            # 存储结果（可以添加到数据库）
            app.config[f'process_{process_id}'] = {
                'status': 'completed',
                'data': summary
            }
            
        except Exception as e:
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
    if model == 'ollama':
        return generate_ollama_summary(text, model_name)
    else:
        # 其他模型的实现可以在这里添加
        raise ValueError(f"Unsupported model: {model}")

def generate_ollama_summary(text, model_name):
    """使用 Ollama 生成摘要"""
    prompt = f"""Please analyze the following meeting transcript and provide a structured summary in JSON format with these sections:

1. MeetingName: A descriptive title for the meeting
2. key_points: Main discussion points
3. action_items: Tasks or actions to be taken
4. decisions: Decisions that were made
5. main_topics: Primary topics discussed

Format your response as valid JSON with this structure:
{{
    "MeetingName": "Meeting Title",
    "key_points": {{
        "title": "Key Points",
        "blocks": [
            {{"content": "Point 1", "type": "bullet", "color": "default"}},
            {{"content": "Point 2", "type": "bullet", "color": "default"}}
        ]
    }},
    "action_items": {{
        "title": "Action Items", 
        "blocks": [
            {{"content": "Action 1", "type": "bullet", "color": "default"}}
        ]
    }},
    "decisions": {{
        "title": "Decisions",
        "blocks": [
            {{"content": "Decision 1", "type": "bullet", "color": "default"}}
        ]
    }},
    "main_topics": {{
        "title": "Main Topics",
        "blocks": [
            {{"content": "Topic 1", "type": "bullet", "color": "default"}}
        ]
    }}
}}

Transcript:
{text}
"""
    
    try:
        response = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": model_name,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.1,
                    "top_p": 0.9
                }
            },
            timeout=120
        )
        
        if response.status_code != 200:
            raise Exception(f"Ollama API error: {response.status_code}")
        
        result = response.json()
        summary_text = result.get('response', '')
        
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
            logger.warning(f"Failed to parse JSON from Ollama response: {e}")
            # 返回基础摘要格式
            summary_data = {
                "MeetingName": "Meeting Summary",
                "key_points": {
                    "title": "Key Points",
                    "blocks": [{"content": summary_text[:500] + "...", "type": "bullet", "color": "default"}]
                },
                "action_items": {
                    "title": "Action Items",
                    "blocks": [{"content": "Review transcript for specific actions", "type": "bullet", "color": "default"}]
                },
                "decisions": {
                    "title": "Decisions",
                    "blocks": [{"content": "Review transcript for decisions", "type": "bullet", "color": "default"}]
                },
                "main_topics": {
                    "title": "Main Topics",
                    "blocks": [{"content": "General discussion", "type": "bullet", "color": "default"}]
                }
            }
        
        return summary_data
        
    except requests.RequestException as e:
        logger.error(f"Error connecting to Ollama: {e}")
        raise Exception(f"Failed to connect to Ollama service: {e}")
    except Exception as e:
        logger.error(f"Error generating summary: {e}")
        raise

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
    logger.info(f"Ollama URL: {OLLAMA_URL}")
    
    app.run(
        host=host,
        port=port,
        debug=debug,
        threaded=True
    )
EOF
fi

# 创建 frontend/.dockerignore
echo "📝 Creating frontend/.dockerignore..."
cat > frontend/.dockerignore << 'EOF'
# Node.js
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Next.js
.next/
out/

# Tauri
src-tauri/target/
src-tauri/Cargo.lock

# IDE 文件
.vscode/
.idea/
*.swp
*.swo

# 系统文件
.DS_Store
Thumbs.db

# 环境变量
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# 日志文件
*.log

# 测试覆盖率
coverage/

# Git
.git/
.gitignore

# 文档
README.md
*.md

# 临时文件
*.tmp
*.temp

# 构建产物
dist/
build/
EOF

echo "✅ All Docker configuration files created successfully!"
echo ""
echo "📂 Created files:"
echo "  - backend/whisper-custom/Dockerfile"
echo "  - backend/whisper-custom/.dockerignore"
echo "  - backend/summary-server/Dockerfile"
echo "  - backend/summary-server/.dockerignore"
echo "  - backend/summary-server/requirements.txt"
echo "  - backend/summary-server/app.py"
echo "  - frontend/.dockerignore"
echo ""
echo "🚀 You can now run the setup script again:"
echo "  ./setup-docker.sh"
EOF

chmod +x create-docker-files.sh