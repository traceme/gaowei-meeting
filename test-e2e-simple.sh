#!/bin/bash

# 高维会议AI端到端功能测试脚本
# 测试转录和摘要的完整流程

echo "🚀 开始高维会议AI端到端功能测试"
echo "=================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 测试配置
WHISPER_URL="http://localhost:8178"
API_URL="http://localhost:3000"
OLLAMA_URL="http://localhost:11434"
TEST_AUDIO="packages/whisper-engine/src/whisper-cpp-server/samples/jfk.mp3"

# 测试计数器
TOTAL_TESTS=0
PASSED_TESTS=0

# 测试函数
test_service() {
    local name="$1"
    local url="$2"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo -e "\n${BLUE}🔍 测试 $name...${NC}"
    
    if curl -s --connect-timeout 5 "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ $name 服务正常${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}❌ $name 服务异常${NC}"
        return 1
    fi
}

# 第一阶段：服务健康检查
echo -e "\n${YELLOW}📋 第一阶段: 服务健康检查${NC}"

# 测试Whisper服务
echo -e "\n${BLUE}🔍 测试 Whisper转录引擎...${NC}"
TOTAL_TESTS=$((TOTAL_TESTS + 1))
WHISPER_RESPONSE=$(curl -s --connect-timeout 5 "$WHISPER_URL/health" 2>/dev/null)
if [ $? -eq 0 ] && echo "$WHISPER_RESPONSE" | grep -q "ok"; then
    echo -e "${GREEN}✅ Whisper转录引擎 服务正常${NC}"
    echo "   状态: $(echo "$WHISPER_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)"
    echo "   模型: $(echo "$WHISPER_RESPONSE" | grep -o '"model":"[^"]*"' | cut -d'"' -f4)"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    WHISPER_OK=true
else
    echo -e "${RED}❌ Whisper转录引擎 服务异常${NC}"
    WHISPER_OK=false
fi

# 测试API服务
echo -e "\n${BLUE}🔍 测试 后端API服务...${NC}"
TOTAL_TESTS=$((TOTAL_TESTS + 1))
API_RESPONSE=$(curl -s --connect-timeout 5 "$API_URL/api/health" 2>/dev/null)
if [ $? -eq 0 ] && echo "$API_RESPONSE" | grep -q "ok"; then
    echo -e "${GREEN}✅ 后端API服务 服务正常${NC}"
    echo "   运行时间: $(echo "$API_RESPONSE" | grep -o '"uptime":[0-9.]*' | cut -d':' -f2)秒"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    API_OK=true
else
    echo -e "${RED}❌ 后端API服务 服务异常${NC}"
    API_OK=false
fi

# 测试Ollama服务
echo -e "\n${BLUE}🔍 测试 Ollama摘要引擎...${NC}"
TOTAL_TESTS=$((TOTAL_TESTS + 1))
OLLAMA_RESPONSE=$(curl -s --connect-timeout 5 "$OLLAMA_URL/api/tags" 2>/dev/null)
if [ $? -eq 0 ] && echo "$OLLAMA_RESPONSE" | grep -q "llama3.2"; then
    echo -e "${GREEN}✅ Ollama摘要引擎 服务正常${NC}"
    echo "   可用模型: $(echo "$OLLAMA_RESPONSE" | grep -o '"name":"[^"]*"' | cut -d'"' -f4 | head -1)"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    OLLAMA_OK=true
else
    echo -e "${RED}❌ Ollama摘要引擎 服务异常${NC}"
    OLLAMA_OK=false
fi

# 检查是否所有服务都正常
if [ "$WHISPER_OK" = true ] && [ "$API_OK" = true ] && [ "$OLLAMA_OK" = true ]; then
    echo -e "\n${GREEN}🎉 所有服务健康检查通过！${NC}"
else
    echo -e "\n${RED}❌ 部分服务异常，无法继续功能测试${NC}"
    echo -e "\n${YELLOW}请确保以下服务正在运行：${NC}"
    echo "   - Whisper转录引擎: pnpm --filter @gaowei/whisper-engine start-whisper-server"
    echo "   - 后端API服务: pnpm --filter @gaowei/api dev"
    echo "   - Ollama摘要引擎: ollama serve"
    exit 1
fi

# 第二阶段：转录功能测试
echo -e "\n${YELLOW}📋 第二阶段: 音频转录测试${NC}"

if [ ! -f "$TEST_AUDIO" ]; then
    echo -e "${RED}❌ 测试音频文件不存在: $TEST_AUDIO${NC}"
    echo -e "${YELLOW}请确保whisper-engine包含示例音频文件${NC}"
    exit 1
fi

echo -e "\n${BLUE}🎵 测试音频转录...${NC}"
echo "   上传文件: $(basename "$TEST_AUDIO")"

TOTAL_TESTS=$((TOTAL_TESTS + 1))

# 执行转录测试
TRANSCRIPTION_RESPONSE=$(curl -s --max-time 60 \
    -F "file=@$TEST_AUDIO" \
    -F "language=en" \
    "$WHISPER_URL/inference" 2>/dev/null)

if [ $? -eq 0 ] && echo "$TRANSCRIPTION_RESPONSE" | grep -q '"text"'; then
    echo -e "${GREEN}✅ 转录成功${NC}"
    TRANSCRIPTION_TEXT=$(echo "$TRANSCRIPTION_RESPONSE" | grep -o '"text":"[^"]*"' | cut -d'"' -f4)
    echo "   转录文本: \"${TRANSCRIPTION_TEXT:0:100}...\""
    PROCESSING_TIME=$(echo "$TRANSCRIPTION_RESPONSE" | grep -o '"processing_time":[0-9.]*' | cut -d':' -f2)
    echo "   处理时间: ${PROCESSING_TIME}秒"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    TRANSCRIPTION_OK=true
else
    echo -e "${RED}❌ 转录失败${NC}"
    echo "   响应: $TRANSCRIPTION_RESPONSE"
    TRANSCRIPTION_OK=false
fi

# 第三阶段：AI摘要测试
if [ "$TRANSCRIPTION_OK" = true ] && [ -n "$TRANSCRIPTION_TEXT" ]; then
    echo -e "\n${YELLOW}📋 第三阶段: AI摘要生成测试${NC}"
    
    echo -e "\n${BLUE}📝 测试AI摘要生成...${NC}"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    # 构建摘要请求 - 修复JSON转义问题
    # 清理文本中的引号和换行符，避免JSON解析错误
    CLEAN_TEXT=$(echo "$TRANSCRIPTION_TEXT" | sed 's/"/\\"/g' | tr '\n' ' ' | tr '\r' ' ')
    SUMMARY_PROMPT="请为以下会议转录内容生成简洁的摘要：$CLEAN_TEXT"
    
    SUMMARY_RESPONSE=$(curl -s --max-time 30 \
        -H "Content-Type: application/json" \
        -d "{\"model\":\"llama3.2:1b\",\"prompt\":\"$SUMMARY_PROMPT\",\"stream\":false}" \
        "$OLLAMA_URL/api/generate" 2>/dev/null)
    
    if [ $? -eq 0 ] && echo "$SUMMARY_RESPONSE" | grep -q '"response"'; then
        echo -e "${GREEN}✅ AI摘要生成成功${NC}"
        SUMMARY_TEXT=$(echo "$SUMMARY_RESPONSE" | grep -o '"response":"[^"]*"' | cut -d'"' -f4)
        echo "   摘要内容: \"${SUMMARY_TEXT:0:150}...\""
        PASSED_TESTS=$((PASSED_TESTS + 1))
        SUMMARY_OK=true
    else
        echo -e "${RED}❌ AI摘要生成失败${NC}"
        echo "   响应: $SUMMARY_RESPONSE"
        SUMMARY_OK=false
    fi
else
    echo -e "\n${YELLOW}⏭️  跳过AI摘要测试（转录失败）${NC}"
    SUMMARY_OK=false
fi

# 第四阶段：API集成测试
if [ "$TRANSCRIPTION_OK" = true ] && [ "$SUMMARY_OK" = true ]; then
    echo -e "\n${YELLOW}📋 第四阶段: API集成测试${NC}"
    
    echo -e "\n${BLUE}🔗 测试API集成...${NC}"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    # 创建会议记录 - 修复JSON转义问题
    # 清理所有文本字段，避免JSON解析错误
    CLEAN_TRANSCRIPTION=$(echo "$TRANSCRIPTION_TEXT" | sed 's/"/\\"/g' | tr '\n' ' ' | tr '\r' ' ')
    CLEAN_SUMMARY=$(echo "$SUMMARY_TEXT" | sed 's/"/\\"/g' | tr '\n' ' ' | tr '\r' ' ')
    CLEAN_TITLE="E2E测试会议-$(date +%Y%m%d%H%M%S)"
    
    MEETING_DATA="{\"title\":\"$CLEAN_TITLE\",\"filename\":\"$(basename "$TEST_AUDIO")\",\"transcription\":\"$CLEAN_TRANSCRIPTION\",\"summary\":\"$CLEAN_SUMMARY\",\"duration\":${PROCESSING_TIME:-0},\"status\":\"completed\"}"
    
    MEETING_RESPONSE=$(curl -s --max-time 10 \
        -H "Content-Type: application/json" \
        -d "$MEETING_DATA" \
        "$API_URL/api/meetings" 2>/dev/null)
    
    if [ $? -eq 0 ] && echo "$MEETING_RESPONSE" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ 会议记录创建成功${NC}"
        MEETING_ID=$(echo "$MEETING_RESPONSE" | grep -o '"id":[0-9]*' | cut -d':' -f2)
        echo "   会议ID: $MEETING_ID"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        INTEGRATION_OK=true
    else
        echo -e "${RED}❌ 会议记录创建失败${NC}"
        echo "   响应: $MEETING_RESPONSE"
        INTEGRATION_OK=false
    fi
else
    echo -e "\n${YELLOW}⏭️  跳过API集成测试（前置测试失败）${NC}"
    INTEGRATION_OK=false
fi

# 第五阶段：生成测试报告
echo -e "\n${YELLOW}📊 测试报告${NC}"
echo "=================================="

SUCCESS_RATE=$(echo "scale=1; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc -l 2>/dev/null || echo "N/A")

echo -e "\n${BLUE}测试结果统计:${NC}"
echo "   总测试项: $TOTAL_TESTS"
echo -e "   通过测试: ${GREEN}$PASSED_TESTS${NC}"
echo -e "   失败测试: ${RED}$((TOTAL_TESTS - PASSED_TESTS))${NC}"
echo "   成功率: $SUCCESS_RATE%"

echo -e "\n${BLUE}功能测试详情:${NC}"
echo "   ✅ Whisper转录引擎: $([ "$WHISPER_OK" = true ] && echo "正常" || echo "异常")"
echo "   ✅ 后端API服务: $([ "$API_OK" = true ] && echo "正常" || echo "异常")"
echo "   ✅ Ollama摘要引擎: $([ "$OLLAMA_OK" = true ] && echo "正常" || echo "异常")"
echo "   🎵 音频转录功能: $([ "$TRANSCRIPTION_OK" = true ] && echo "成功" || echo "失败")"
echo "   📝 AI摘要生成: $([ "$SUMMARY_OK" = true ] && echo "成功" || echo "失败")"
echo "   🔗 API集成测试: $([ "$INTEGRATION_OK" = true ] && echo "成功" || echo "失败")"

if [ $PASSED_TESTS -eq $TOTAL_TESTS ]; then
    echo -e "\n${GREEN}🎉 恭喜！端到端测试全部通过！${NC}"
    echo -e "${GREEN}   高维会议AI系统核心功能完全正常${NC}"
    echo -e "\n${BLUE}✨ 重构成功验证：${NC}"
    echo "   • Whisper转录引擎：8178端口 ✅"
    echo "   • Ollama摘要引擎：11434端口 ✅"
    echo "   • 完整转录流程：音频→文本 ✅"
    echo "   • 完整摘要流程：文本→AI摘要 ✅"
    echo "   • 数据持久化：会议记录存储 ✅"
else
    echo -e "\n${YELLOW}⚠️  部分测试失败，请检查相关服务${NC}"
    echo -e "\n${BLUE}故障排除建议：${NC}"
    
    if [ "$WHISPER_OK" != true ]; then
        echo "   • 启动Whisper服务: pnpm --filter @gaowei/whisper-engine start-whisper-server"
    fi
    
    if [ "$API_OK" != true ]; then
        echo "   • 启动API服务: pnpm --filter @gaowei/api dev"
    fi
    
    if [ "$OLLAMA_OK" != true ]; then
        echo "   • 启动Ollama服务: ollama serve"
        echo "   • 安装模型: ollama pull llama3.2:1b"
    fi
fi

echo -e "\n${BLUE}测试完成时间: $(date)${NC}" 