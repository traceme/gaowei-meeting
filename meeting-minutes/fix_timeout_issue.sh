#!/bin/bash

echo "🔥 Fixing the timeout issue..."

# 停止并重新构建whisper服务器
echo "📦 Rebuilding whisper-server with audio duration detection..."
docker-compose stop whisper-server
docker-compose build --no-cache whisper-server
docker-compose up -d whisper-server

echo "⏳ Waiting for server to start..."
sleep 8

# 检查状态
for i in {1..10}; do
    if curl -s http://localhost:8178/health > /dev/null 2>&1; then
        echo "✅ Whisper server is ready!"
        echo ""
        echo "🎯 Key fixes applied:"
        echo "   - Real audio duration detection using ffprobe"
        echo "   - Files >10MB or >10min automatically use async processing"
        echo "   - Shorter initial timeout (2 min) before switching to async"
        echo "   - Better progress tracking and user feedback"
        echo ""
        echo "🔍 Your 23MB file (2+ hours) will now:"
        echo "   1. Be detected as long audio and switch to async mode"
        echo "   2. Show real-time progress updates"
        echo "   3. Process in background without browser timeout"
        echo ""
        break
    fi
    echo "⏳ Waiting... ($i/10)"
    sleep 2
done

echo "📊 Test the upload now!"
