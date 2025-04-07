from flask import Flask, request, jsonify, send_from_directory
import os
from docx import Document
import io
import base64
import magic
import uuid

app = Flask(__name__, static_folder='static')

# 确保uploads目录存在
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)

@app.route('/convert', methods=['POST'])
def convert():
    try:
        if 'file' in request.files:
            file = request.files['file']
            if file.filename == '':
                return jsonify({'error': '未选择文件'}), 400
            
            # 检查文件类型
            mime = magic.Magic(mime=True)
            file_content = file.read()
            file_mime = mime.from_buffer(file_content)
            
            if not file_mime.startswith('application/vnd.openxmlformats-officedocument.wordprocessingml.document'):
                return jsonify({'error': '请上传Word文档(.docx)文件'}), 400
            
            # 处理Word文档
            doc = Document(io.BytesIO(file_content))
            html_content = []
            
            for para in doc.paragraphs:
                if para.text.strip():
                    html_content.append(f'<p>{para.text}</p>')
            
            return jsonify({'html': '\n'.join(html_content)})
            
        elif 'text' in request.form:
            text = request.form['text']
            if not text.strip():
                return jsonify({'error': '请输入文本'}), 400
            
            paragraphs = text.split('\n')
            html_content = [f'<p>{p}</p>' for p in paragraphs if p.strip()]
            
            return jsonify({'html': '\n'.join(html_content)})
            
        else:
            return jsonify({'error': '未提供文件或文本'}), 400
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/save', methods=['POST'])
def save():
    try:
        data = request.json
        if not data or 'html' not in data:
            return jsonify({'error': '未提供HTML内容'}), 400
            
        # 生成唯一文件名
        filename = f"{uuid.uuid4()}.html"
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        
        # 保存文件
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(data['html'])
            
        # 返回文件URL
        file_url = f"/uploads/{filename}"
        return jsonify({'url': file_url})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/uploads/<filename>')
def serve_upload(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

if __name__ == '__main__':
    app.run(debug=True) 