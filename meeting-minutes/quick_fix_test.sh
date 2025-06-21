# 临时修复脚本 - 测试更快的模型
#!/bin/bash

echo "=== 测试小模型摘要生成 ==="

# 首先确保有小模型
echo "检查可用模型..."
curl -s http://localhost:11434/api/tags | jq -r '.models[].name'

echo -e "\n=== 使用3.2B模型测试（当前配置）==="
timeout 15 curl -X POST http://localhost:5167/process-transcript \
  -H "Content-Type: application/json" \
  -d '{
    "text": "会议讨论：项目进展顺利，需要增加人手",
    "model": "ollama",
    "model_name": "llama3.2:latest"
  }' || echo "3.2B模型超时"

echo -e "\n=== 下载并测试1B模型 ==="
docker exec meeting-minutes-ollama-1 ollama pull llama3.2:1b

echo "等待模型下载..."
sleep 5

timeout 15 curl -X POST http://localhost:5167/process-transcript \
  -H "Content-Type: application/json" \
  -d '{
    "text": "会议讨论：项目进展顺利，需要增加人手",
    "model": "ollama",
    "model_name": "llama3.2:1b"
  }' || echo "1B模型也超时"

echo -e "\n=== 直接测试Ollama API ==="
timeout 10 curl -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2:1b",
    "prompt": "总结：今天开会讨论项目进展",
    "stream": false
  }' || echo "直接API调用也超时"
