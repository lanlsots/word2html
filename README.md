# Word2HTML

一个简单的文档转换工具，支持将Word文档转换为HTML格式。

## 功能特点

- 支持Word文档上传和转换
- 支持文本输入和转换
- 自动生成可访问的URL
- 支持HTML预览和下载
- 响应式设计，支持移动端

## 本地开发

1. 克隆仓库
```bash
git clone https://github.com/yourusername/word2html.git
cd word2html
```

2. 创建虚拟环境
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows
```

3. 安装依赖
```bash
pip install -r requirements.txt
```

4. 运行服务器
```bash
python server.py
```

5. 访问应用
打开浏览器访问 http://localhost:5000

## 部署到Vercel

1. 在Vercel上创建新项目
2. 连接GitHub仓库
3. 配置环境变量（如果需要）
4. 部署

## 技术栈

- 后端：Python Flask
- 前端：HTML, CSS, JavaScript
- 部署：Vercel

## 许可证

MIT License 