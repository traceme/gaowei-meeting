#!/bin/bash

echo "🚀 Quick rebuild and restart Whisper server..."

# 停止并重新构建whisper服务器
echo "📦 Stopping and rebuilding whisper-server..."
docker-compose stop whisper-server
docker-compose build whisper-server
docker-compose up -d whisper-server

echo "⏳ Waiting for server to start..."
sleep 5

# 检查状态
for i in {1..10}; do
    if curl -s http://localhost:8178/health > /dev/null 2>&1; then
        echo "✅ Whisper server is ready!"
        echo "🎯 New features:"
        echo "   - Async processing for large files (>30min estimated)"
        echo "   - Progress tracking via /status/<task_id>"
        echo "   - Better timeout handling"
        echo "   - Real-time progress updates"
        echo ""
        echo "🔍 Your current file is likely still processing..."
        echo "   Check logs: docker logs -f meeting-minutes-whisper-server-1"
        break
    fi
    echo "⏳ Waiting... ($i/10)"
    sleep 2
done

echo ""
echo "📊 Recent logs:"
docker logs --tail 5 meeting-minutes-whisper-server-1
