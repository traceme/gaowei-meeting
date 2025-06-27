#!/bin/bash
# 测试中文文件名上传编码处理

echo "🧪 测试中文文件名上传编码处理..."

# 创建一个测试音频文件
TEST_FILENAME="测试中文文件名.mp3"
TEST_FILE="test-audio.mp3"

# 创建一个简单的测试音频文件（空文件，仅用于测试）
echo "创建测试文件: $TEST_FILE"
dd if=/dev/zero of="$TEST_FILE" bs=1024 count=1 2>/dev/null

# 测试Base64编码（模拟前端行为）
ORIGINAL_NAME="$TEST_FILENAME"
ENCODED_NAME=$(echo -n "$ORIGINAL_NAME" | base64)

echo "📁 原始文件名: $ORIGINAL_NAME"
echo "🔤 Base64编码: $ENCODED_NAME"

# 测试解码（模拟后端行为）
DECODED_NAME=$(echo "$ENCODED_NAME" | base64 -d)
echo "🔓 解码结果: $DECODED_NAME"

# 验证编码解码是否正确
if [ "$ORIGINAL_NAME" = "$DECODED_NAME" ]; then
    echo "✅ Base64编码解码测试通过"
else
    echo "❌ Base64编码解码测试失败"
    echo "   期望: $ORIGINAL_NAME"
    echo "   实际: $DECODED_NAME"
fi

# 清理测试文件
rm -f "$TEST_FILE"

echo ""
echo "💡 下一步测试建议："
echo "1. 在浏览器中上传一个中文文件名的音频文件"
echo "2. 检查浏览器控制台的日志"
echo "3. 检查后端API日志"
echo "4. 验证数据库中存储的文件名是否正确"
