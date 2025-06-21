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

# 创建健康检查脚本（使用curl而不是python requests）
RUN echo '#!/bin/bash\n\
curl -f http://localhost:5167/health || exit 1\n\
' > /app/health_check.sh && chmod +x /app/health_check.sh

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

# 健康检查（使用简单的curl命令）
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
    CMD /app/health_check.sh

# 启动命令
CMD ["/app/start.sh"]