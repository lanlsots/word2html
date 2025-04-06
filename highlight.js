// 代码高亮处理模块

/**
 * 初始化代码高亮所需的资源
 * @returns {Object} 返回包含CSS和JS资源的对象
 */
function initHighlightResources() {
    return {
        css: '<link href="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism.min.css" rel="stylesheet" />',
        js: [
            '<script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/prism.min.js"></script>',
            '<script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/plugins/autoloader/prism-autoloader.min.js"></script>'
        ]
    };
}

/**
 * 将代码高亮资源注入到HTML内容中
 * @param {string} content - HTML内容
 * @returns {string} - 注入资源后的HTML内容
 */
function injectHighlightResources(content) {
    try {
        const resources = initHighlightResources();
        const headEndPos = content.indexOf('</head>');
        
        if (headEndPos === -1) {
            console.error('未找到</head>标签，无法注入代码高亮资源');
            return content;
        }
        
        // 注入CSS和JS资源
        const injection = resources.css + resources.js.join('');
        return content.slice(0, headEndPos) + injection + content.slice(headEndPos);
    } catch (error) {
        console.error('注入代码高亮资源失败:', error);
        return content;
    }
}

/**
 * 初始化Prism.js的配置
 */
function initPrismConfig() {
    // 配置Prism自动加载器
    if (window.Prism) {
        window.Prism.plugins.autoloader.languages_path = 
            'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/';
        
        // 设置默认支持的语言
        const defaultLanguages = ['javascript', 'css', 'html', 'python', 'bash', 'json'];
        defaultLanguages.forEach(lang => {
            if (!window.Prism.languages[lang]) {
                window.Prism.plugins.autoloader.loadLanguages([lang], () => {
                    console.log(`加载${lang}语言支持成功`);
                }, (err) => {
                    console.error(`加载${lang}语言支持失败:`, err);
                });
            }
        });
    } else {
        console.error('Prism.js未正确加载');
    }
}

/**
 * 手动触发代码高亮
 * @param {string} container - 容器选择器，默认为document
 */
function highlightCode(container = document) {
    try {
        if (window.Prism) {
            // 查找所有未高亮的代码块
            const codeBlocks = container.querySelectorAll('pre code:not(.prism-highlighted)');
            if (codeBlocks.length > 0) {
                console.log(`找到${codeBlocks.length}个需要高亮的代码块`);
                codeBlocks.forEach(block => {
                    // 确保代码块有语言类
                    if (!block.className) {
                        block.className = 'language-plaintext';
                    }
                    window.Prism.highlightElement(block);
                });
            }
        } else {
            console.error('Prism.js未加载，无法执行代码高亮');
        }
    } catch (error) {
        console.error('执行代码高亮失败:', error);
    }
}

/**
 * 监听DOM变化，自动触发代码高亮
 */
function observeCodeBlocks() {
    try {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    // 检查新增的节点中是否包含代码块
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) { // 元素节点
                            highlightCode(node);
                        }
                    });
                }
            });
        });

        // 开始观察document.body的变化
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        console.log('代码块观察器已启动');
        return observer;
    } catch (error) {
        console.error('启动代码块观察器失败:', error);
        return null;
    }
}

// 导出模块功能
window.codeHighlight = {
    injectResources: injectHighlightResources,
    initConfig: initPrismConfig,
    highlight: highlightCode,
    observe: observeCodeBlocks
};