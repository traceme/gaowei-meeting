#!/bin/bash

# Whisper.cpp 编译脚本
# 确保在项目根目录下运行此脚本

set -e

echo "🔨 开始编译 Whisper.cpp..."

# 进入whisper-cpp源码目录
WHISPER_CPP_DIR="packages/whisper-engine/src/whisper-cpp-server"

if [ ! -d "$WHISPER_CPP_DIR" ]; then
    echo "❌ 错误: 找不到whisper-cpp目录: $WHISPER_CPP_DIR"
    exit 1
fi

cd "$WHISPER_CPP_DIR"

echo "📂 当前目录: $(pwd)"
echo "🔍 检查构建依赖..."

# 检查必要的构建工具
if ! command -v make &> /dev/null; then
    echo "❌ 错误: make 命令未找到，请安装 build-essential (Ubuntu/Debian) 或 XCode Command Line Tools (macOS)"
    exit 1
fi

# 检查编译器
if command -v gcc &> /dev/null; then
    echo "✅ 找到 GCC 编译器"
    COMPILER="gcc"
elif command -v clang &> /dev/null; then
    echo "✅ 找到 Clang 编译器"
    COMPILER="clang"
else
    echo "❌ 错误: 找不到 C++ 编译器 (gcc 或 clang)"
    exit 1
fi

# 清理之前的构建
echo "🧹 清理之前的构建..."
make clean 2>/dev/null || true

# 编译主库
echo "🔨 编译 whisper 核心库..."
make -j$(nproc 2>/dev/null || echo 4)

# 编译服务器
echo "🌐 编译 HTTP 服务器..."
if [ -f "examples/server/server.cpp" ]; then
    cd examples/server
    make server -j$(nproc 2>/dev/null || echo 4)
    cd ../..
    
    # 创建软链接到根目录
    if [ -f "examples/server/server" ]; then
        echo "🔗 创建服务器可执行文件链接..."
        ln -sf examples/server/server whisper-server
        echo "✅ 编译完成！服务器可执行文件: whisper-server"
    else
        echo "❌ 错误: 服务器编译失败"
        exit 1
    fi
else
    echo "❌ 错误: 找不到服务器源码文件"
    exit 1
fi

# 检查编译结果
echo "🧪 验证编译结果..."
if [ -f "whisper-server" ]; then
    echo "✅ whisper-server 可执行文件已创建"
    echo "📋 文件信息:"
    ls -la whisper-server
    
    # 检查是否可以运行
    echo "🔍 检查可执行文件..."
    if ./whisper-server --help > /dev/null 2>&1; then
        echo "✅ 可执行文件验证成功"
    else
        echo "⚠️  警告: 可执行文件可能有问题，但文件已创建"
    fi
else
    echo "❌ 错误: whisper-server 可执行文件未找到"
    exit 1
fi

echo ""
echo "🎉 Whisper.cpp 编译完成！"
echo ""
echo "📖 使用说明:"
echo "1. 下载模型文件到 models/ 目录"
echo "2. 启动服务器: ./whisper-server --port 8081 --model models/ggml-base.bin"
echo "3. 在设置页面选择 Whisper.cpp 引擎"
echo ""
echo "💡 提示: 可以从 https://huggingface.co/ggerganov/whisper.cpp 下载模型文件" 