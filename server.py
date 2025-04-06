from flask import Flask, send_from_directory
from flask_cors import CORS  # 添加CORS支持
import os
import uuid

app = Flask(__name__)
CORS(app)  # 启用CORS

# 创建存储HTML文件的目录
UPLOAD_FOLDER = 'generated_html'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

@app.route('/')
def index():
    return "HTML文件托管服务器正在运行"

@app.route('/html/<filename>')
def serve_html(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

@app.route('/save', methods=['POST'])
def save_html():
    from flask import request, jsonify
    try:
        html_content = request.json.get('html')
        if not html_content:
            return jsonify({'error': '没有提供HTML内容'}), 400
            
        # 生成唯一的文件名
        filename = f"{uuid.uuid4()}.html"
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        
        # 保存HTML文件
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
            
        # 构建访问URL（使用请求的host）
        host = request.headers.get('Host', request.host)
        url = f"http://{host}/html/{filename}"
        return jsonify({
            'url': url,
            'filename': filename,
            'success': True
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True) 