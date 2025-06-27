#!/bin/bash

# 启动Whisper服务的UTF-8编码脚本
# 确保所有编码环境变量都正确设置

# 设置UTF-8环境变量
export LANG=C.UTF-8
export LC_ALL=C.UTF-8
export LC_CTYPE=C.UTF-8
export PYTHONIOENCODING=utf-8
export PYTHONUTF8=1

# 打印编码信息
echo "🌐 UTF-8编码环境设置："
echo "LANG=$LANG"
echo "LC_ALL=$LC_ALL"
echo "PYTHONIOENCODING=$PYTHONIOENCODING"
echo "PYTHONUTF8=$PYTHONUTF8"

# 验证Python编码
echo "🐍 Python编码验证："
python3 -c "import sys; import locale; print(f'Python编码: {sys.stdout.encoding}'); print(f'Locale: {locale.getlocale()}'); print(f'默认编码: {locale.getpreferredencoding()}')"

# 启动Whisper服务
echo "🚀 启动Whisper转录服务..."
cd "$(dirname "$0")/.."
python3 packages/whisper-engine/src/python/app.py --port 8178 --model-path small
