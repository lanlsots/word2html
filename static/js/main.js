// 深色模式切换
const darkModeToggle = document.createElement('button');
darkModeToggle.className = 'fixed top-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg';
darkModeToggle.innerHTML = '<i class="fas fa-moon"></i>';
document.body.appendChild(darkModeToggle);

darkModeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    darkModeToggle.innerHTML = document.body.classList.contains('dark-mode') 
        ? '<i class="fas fa-sun"></i>' 
        : '<i class="fas fa-moon"></i>';
});

// 文件拖放功能
const dropZone = document.querySelector('.file-upload-label');
const fileInput = document.getElementById('file-upload');

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, highlight, false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, unhighlight, false);
});

function highlight(e) {
    dropZone.classList.add('bg-blue-100');
}

function unhighlight(e) {
    dropZone.classList.remove('bg-blue-100');
}

dropZone.addEventListener('drop', handleDrop, false);

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    fileInput.files = files;
    const event = new Event('change');
    fileInput.dispatchEvent(event);
}

// 错误处理
window.addEventListener('error', (event) => {
    console.error('Error:', event.error);
    alert('发生错误，请刷新页面重试');
});

// 加载指示器
function showLoading() {
    const loading = document.createElement('div');
    loading.id = 'loading';
    loading.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center';
    loading.innerHTML = '<div class="bg-white p-4 rounded-lg"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
    document.body.appendChild(loading);
}

function hideLoading() {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.remove();
    }
} 