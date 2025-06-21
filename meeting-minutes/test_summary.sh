#!/bin/bash
echo "Testing summary service..."

# 测试健康检查
echo "=== Health Check ==="
curl -v http://localhost:5167/health
echo -e "\n"

# 测试简单的摘要请求
echo "=== Summary Test ==="
curl -X POST http://localhost:5167/process-transcript \
  -H "Content-Type: application/json" \
  -d '{
    "text": "会议讨论了以下内容：1. 项目进展顺利 2. 需要增加人手 3. 下周交付第一版",
    "model": "ollama",
    "model_name": "llama3.2:latest"
  }' \
  --max-time 30 \
  -v

echo -e "\nTest completed"
