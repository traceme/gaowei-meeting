#!/bin/bash

echo "🧪 测试 Ollama 摘要功能..."
echo "====================================="

# 测试 Ollama API 基本连接
echo "1. 检查 Ollama 服务状态..."
if curl -s http://localhost:11434/api/tags > /dev/null; then
    echo "✅ Ollama 服务正常运行"
else
    echo "❌ Ollama 服务不可用"
    exit 1
fi

# 检查可用模型
echo ""
echo "2. 检查可用模型..."
curl -s http://localhost:11434/api/tags | jq -r '.models[].name' | head -5

# 测试摘要生成
echo ""
echo "3. 测试摘要生成功能（使用 summary-server）..."

PROCESS_ID=$(curl -s -X POST http://localhost:5167/process-transcript \
  -H "Content-Type: application/json" \
  -d '{
    "text": "今天的会议讨论了Q4产品路线图。产品经理提出了三个新功能的开发计划，工程团队评估需要8周时间。我们决定优先开发用户最需要的搜索功能，预计下个月开始开发。",
    "model": "ollama",
    "model_name": "llama3.2:1b"
  }' | jq -r '.process_id')

if [ "$PROCESS_ID" != "null" ] && [ -n "$PROCESS_ID" ]; then
    echo "✅ 请求已提交，Process ID: $PROCESS_ID"
    echo "⏳ 等待处理完成..."
    
    # 等待处理完成
    for i in {1..30}; do
        sleep 5
        RESULT=$(curl -s http://localhost:5167/get-summary/$PROCESS_ID)
        STATUS=$(echo $RESULT | jq -r '.status')
        
        if [ "$STATUS" = "completed" ]; then
            echo "✅ Ollama 摘要生成成功！"
            echo ""
            echo "📋 生成的摘要:"
            echo $RESULT | jq '.data' | head -20
            echo "..."
            break
        elif [ "$STATUS" = "error" ]; then
            echo "❌ 处理失败："
            echo $RESULT | jq '.error'
            break
        else
            echo "⏳ 处理中... ($i/30)"
        fi
    done
else
    echo "❌ 请求失败"
fi

echo ""
echo "====================================="
echo "🔍 如果遇到问题，请检查日志："
echo "   docker logs meeting-minutes-summary-server-1 --tail 20"
echo "   docker logs meeting-minutes-ollama-1 --tail 20" 