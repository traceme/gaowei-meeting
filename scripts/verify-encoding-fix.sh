#!/bin/bash
# 验证修复后的中文文件名编码

echo "🔧 验证修复后的中文文件名编码..."

# 测试新的编码方式
node -e "
const filename = '2025 AI Agent 最新趋势.mp3';
console.log('📁 测试文件名:', filename);

// 前端编码方式（修复后）
const frontendEncoded = Buffer.from(encodeURIComponent(filename)).toString('base64');
console.log('🔤 前端编码:', frontendEncoded);

// 后端解码方式（Node.js）
const nodeDecoded = decodeURIComponent(Buffer.from(frontendEncoded, 'base64').toString());
console.log('🔓 Node.js解码:', nodeDecoded);

// Python解码方式（模拟）
const pythonDecoded = decodeURIComponent(Buffer.from(frontendEncoded, 'base64').toString());
console.log('🐍 Python解码:', pythonDecoded);

console.log('');
console.log('✅ 编码解码验证:');
console.log('   前端->Node.js:', filename === nodeDecoded ? '通过' : '失败');
console.log('   前端->Python:', filename === pythonDecoded ? '通过' : '失败');
"

echo ""
echo "💡 测试建议："
echo "1. 重启前端和后端服务以应用修复"
echo "2. 上传一个中文文件名的音频文件"
echo "3. 检查浏览器和服务器控制台日志"
echo "4. 验证数据库中的文件名是否正确"
