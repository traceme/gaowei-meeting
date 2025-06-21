cat > backend/whisper-custom/Dockerfile << 'EOF'
# 使用官方的 Ubuntu 22.04 基础镜像
FROM ubuntu:22.04

# 设置非交互式安装，避免时区等配置提示
ENV DEBIAN_FRONTEND=noninteractive

# 安装构建依赖和运行时依赖
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    pkg-config \
    curl \
    wget \
    libcurl4-openssl-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# 设置工作目录
WORKDIR /app

# 复制项目源代码
COPY . .

# 创建模型目录
RUN mkdir -p models

# 下载 Whisper 模型文件
RUN cd models && \
    echo "Downloading Whisper models..." && \
    wget -q --timeout=60 https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin || \
    wget -q --timeout=60 https://hf-mirror.com/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin || \
    echo "Model download failed, will need manual download"

# 检查源代码结构
RUN echo "Checking source structure..." && \
    ls -la && \
    ls -la examples/ && \
    ls -la examples/server/ || echo "Server directory not found in examples"

# 创建构建目录并编译项目
RUN mkdir -p build && cd build && \
    echo "Configuring build with CMake..." && \
    cmake .. \
        -DCMAKE_BUILD_TYPE=Release \
        -DWHISPER_BUILD_SERVER=ON \
        -DWHISPER_BUILD_EXAMPLES=ON && \
    echo "Building project..." && \
    make -j$(nproc) && \
    echo "Build completed"

# 查看编译结果
RUN echo "Checking build results..." && \
    find build -name "*server*" -type f && \
    ls -la build/bin/ || ls -la build/ && \
    ls -la build/examples/ || echo "No examples directory in build"

# 找到正确的 server 可执行文件位置
RUN if [ -f "build/bin/server" ]; then \
        echo "Server found at build/bin/server"; \
        cp build/bin/server /usr/local/bin/whisper-server; \
    elif [ -f "build/examples/server/server" ]; then \
        echo "Server found at build/examples/server/server"; \
        cp build/examples/server/server /usr/local/bin/whisper-server; \
    elif [ -f "build/server" ]; then \
        echo "Server found at build/server"; \
        cp build/server /usr/local/bin/whisper-server; \
    else \
        echo "ERROR: Server executable not found!"; \
        find build -name "*server*" -type f; \
        exit 1; \
    fi

# 验证可执行文件
RUN /usr/local/bin/whisper-server --help || echo "Server help not available"

# 创建运行时用户
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
    echo "ERROR: Model file not found or empty."\n\
    echo "Available files:"\n\
    ls -la /app/models/\n\
    echo "Downloading model..."\n\
    cd /app/models\n\
    wget -q https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin || exit 1\n\
fi\n\
\n\
# 启动服务器\n\
exec /usr/local/bin/whisper-server \\\n\
    -m "/app/models/${WHISPER_MODEL:-ggml-base.en.bin}" \\\n\
    --port 8178 \\\n\
    --host "0.0.0.0" \\\n\
    --threads "${WHISPER_THREADS:-4}" \\\n\
    --language "en"\n\
' > /app/start.sh && chmod +x /app/start.sh

# 切换到非特权用户
USER whisper

# 启动命令
CMD ["/app/start.sh"]
EOF
