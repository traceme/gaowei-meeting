#!/bin/bash

echo "🔧 Quick test for audio upload functionality..."

# 1. Check if whisper server is running
echo "🔍 Checking Whisper server status..."
if curl -s http://localhost:8178/health > /dev/null; then
    echo "✅ Whisper server is running"
    curl -s http://localhost:8178/health | jq . 2>/dev/null || curl -s http://localhost:8178/health
else
    echo "❌ Whisper server is not accessible at http://localhost:8178"
    exit 1
fi

echo ""

# 2. Check if we can reach the inference endpoint
echo "🧪 Testing inference endpoint accessibility..."
RESPONSE=$(curl -s -w "%{http_code}" -X POST http://localhost:8178/inference -o /tmp/test_response.txt)
HTTP_CODE=${RESPONSE: -3}

if [ "$HTTP_CODE" = "400" ]; then
    echo "✅ Inference endpoint is accessible (400 expected without file)"
    echo "Response: $(cat /tmp/test_response.txt)"
elif [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Inference endpoint is accessible"
    echo "Response: $(cat /tmp/test_response.txt)"
else
    echo "❌ Inference endpoint returned HTTP $HTTP_CODE"
    echo "Response: $(cat /tmp/test_response.txt)"
fi

echo ""

# 3. Check frontend accessibility
echo "🌐 Checking frontend accessibility..."
if curl -s http://localhost:3118 > /dev/null; then
    echo "✅ Frontend is accessible at http://localhost:3118"
else
    echo "❌ Frontend is not accessible at http://localhost:3118"
fi

echo ""

# 4. Show recent whisper server logs
echo "📊 Recent Whisper server logs:"
echo "================================"
docker logs --tail 10 meeting-minutes-whisper-server-1 2>/dev/null || docker logs --tail 10 whisper-server-1 2>/dev/null || echo "Could not find whisper server container"

echo ""
echo "🔍 To debug further:"
echo "  - Check browser console for JavaScript errors"
echo "  - Check network tab in browser dev tools"
echo "  - Monitor logs: docker logs -f meeting-minutes-whisper-server-1"

# Cleanup
rm -f /tmp/test_response.txt
