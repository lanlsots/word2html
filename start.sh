#!/bin/bash
echo "Starting Word2HTML server..."

# 激活Python虚拟环境（如果有）
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
fi

# 安装依赖
pip install -r requirements.txt

# 启动Python服务
python3 server.py 