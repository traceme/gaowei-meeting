FROM python:3.11-slim

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 安装 Python 包
RUN pip install --no-cache-dir \
    faster-whisper \
    flask \
    flask-cors

WORKDIR /app

# 复制应用文件
COPY app.py .

EXPOSE 8178

# 修改健康检查间隔，使用专门的健康检查端点
HEALTHCHECK --interval=60s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8178/health || exit 1

CMD ["python", "app.py"]