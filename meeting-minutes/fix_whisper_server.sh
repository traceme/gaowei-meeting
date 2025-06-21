#!/bin/bash

echo "🔧 Fixing Whisper server issues..."

# 1. 停止whisper服务器
echo "📦 Stopping whisper-server container..."
docker-compose stop whisper-server

# 2. 删除旧的容器和镜像
echo "🗑️  Removing old container and image..."
docker-compose rm -f whisper-server
docker rmi meeting-minutes-whisper-server 2>/dev/null || true

# 3. 重新构建whisper服务器
echo "🔨 Rebuilding whisper-server..."
docker-compose build --no-cache whisper-server

# 4. 启动whisper服务器
echo "🚀 Starting whisper-server..."
docker-compose up -d whisper-server

# 5. 等待服务器启动
echo "⏳ Waiting for whisper-server to start..."
sleep 10

# 6. 检查健康状态
echo "🔍 Checking whisper-server health..."
for i in {1..30}; do
    if curl -s http://localhost:8178/health > /dev/null 2>&1; then
        echo "✅ Whisper server is healthy!"
        break
    fi
    echo "⏳ Waiting for health check... ($i/30)"
    sleep 2
done

# 7. 测试转录端点
echo "🧪 Testing transcription endpoint..."
curl -X POST http://localhost:8178/inference \
  -H "Content-Type: application/json" \
  -d '{}' 2>/dev/null && echo "✅ Inference endpoint is accessible" || echo "❌ Inference endpoint test failed (expected - no file provided)"

echo "🎉 Whisper server restart complete!"
echo ""
echo "📊 Check logs with: docker logs -f meeting-minutes-whisper-server-1"
echo "🌐 Test health: curl http://localhost:8178/health"
echo "📝 Test inference: Upload a file through the web interface"
