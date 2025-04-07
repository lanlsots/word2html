@echo off
echo Starting Word2HTML server...

REM 激活Python虚拟环境（如果有）
IF EXIST venv\Scripts\activate.bat (
    call venv\Scripts\activate.bat
)

REM 安装依赖
pip install -r requirements.txt

REM 启动Python服务
python server.py

pause 