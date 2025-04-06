// 硅基流动API调用模块

/**
 * 调用硅基流动API将内容转换为HTML
 * @param {string} content - 用户提供的内容
 * @param {string} apiKey - 硅基流动API密钥
 * @param {string} modelName - 模型名称
 * @param {string} apiUrl - API地址
 * @returns {Promise<string>} - 返回生成的HTML内容
 */
async function callSiliconFlowAPI(content, apiKey, modelName, apiUrl, onProgress) {
    try {
        // 初始化阶段：准备API调用所需参数
        console.log('开始API调用，参数：', { modelName, apiUrl, contentLength: content.length });
        const promptTemplate = await fetchPromptTemplate(); // 获取预设的提示词模板
        console.log('成功获取提示词模板');
        
        // 构建完整提示词：将模板与用户内容结合
        const fullPrompt = buildPrompt(promptTemplate, content);
        console.log('构建完整提示词，长度：', fullPrompt.length);
        
        // 内容生成状态管理
        let fullContent = '';          // 累积的完整生成内容
        let isComplete = false;        // 完成标志（HTML结构完整时设为true）
        let retryCount = 0;            // 当前重试次数计数器
        const maxRetries = 3;          // 最大允许重试次数
        let contentBuffer = '';        // 内容缓冲区（用于定期触发进度回调）
        let lastUpdateTime = Date.now(); // 最后更新进度的时间戳
        
        // OpenRouter 状态监控
        let openrouterProcessingCount = 0;      // 连续收到处理中状态的次数
        let openrouterProcessingTimeout = null; // 处理超时定时器
        
        // 重置OpenRouter监控状态（当收到有效数据时调用）
        const resetOpenrouterProcessing = () => {
            openrouterProcessingCount = 0;
            if (openrouterProcessingTimeout) {
                clearTimeout(openrouterProcessingTimeout);
                openrouterProcessingTimeout = null;
            }
        };
        
        // 创建OpenRouter处理监控计时器
        const startOpenrouterTimeout = () => {
            if (openrouterProcessingTimeout) return;
            
            openrouterProcessingTimeout = setTimeout(() => {
                if (fullContent.trim() === '') {
                    console.error('OpenRouter API请求超时，没有收到内容');
                    reader?.cancel();
                    throw new Error('API请求超时，请稍后重试');
                }
            }, 30000); // 30秒超时
        };
        
        // 添加一个使用正则表达式检查</script>和</html>标签的功能
        function checkForClosingTags(str) {
            // 检查是否包含完整的</script>和</html>标签
            const hasScriptEnd = /<\/script>/i.test(str);
            const hasHtmlEnd = /<\/html>/i.test(str);
            return { hasScriptEnd, hasHtmlEnd };
        }
        
        // 主请求循环：最大重试次数内尝试生成完整内容
        while (!isComplete && retryCount < maxRetries) {
            // 动态提示策略：首次使用完整提示，后续使用续写提示
            const currentPrompt = retryCount === 0 ? fullPrompt : `继续，直接生成后续代码，不需要输出任何文字和解释`;
            
            // 构造API请求参数
            const requestData = {
                model: modelName,
                messages: [{ role: "user", content: currentPrompt }],
                temperature: 0,        // 严格模式（保持输出确定性）
                max_tokens: 100000,     // 提高最大token数以支持长内容生成
                stream: true           // 启用流式传输模式
            };
            
            // 发送API请求
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            };
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestData)
            });

            // 流式数据处理阶段
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let chunkCount = 0;              // 接收到的数据块计数
            let currentChunkContent = '';    // 当前数据块处理内容
            let lastProgressTime = Date.now(); // 最后有效数据接收时间
            
            // 数据流读取循环
            let foundHtmlEnd = false;
            let charsAfterHtmlEnd = 0;
            const minCharsAfterHtmlEnd = 200; // 至少接收这么多字符后再结束
            
            while (true) {
                const {value, done} = await reader.read();
                if (done) {
                    console.log('流数据读取完成，总内容长度:', fullContent.length);
                    break;  // 流结束标志
                }

                // 数据块解码与处理
                const chunk = decoder.decode(value, {stream: true});
                
                // 更新数据接收计数
                chunkCount++;
                
                // 处理OpenRouter状态消息
                if (chunk.includes('OPENROUTER PROCESSING')) {
                    openrouterProcessingCount++;
                    // 超时处理逻辑（当长时间无有效内容时触发）
                    if (openrouterProcessingCount > 5 && fullContent.trim() === '') {
                        startOpenrouterTimeout();
                    }
                    // 跳过处理消息
                    continue;
                }
                
                // 解析流数据行
                const lines = chunk.split('\n');
                for (const line of lines) {
                    // 跳过空行和结束标记
                    if (line.trim() === '' || line.trim() === 'data: [DONE]') continue;
                    
                    try {
                        const jsonStr = line.replace(/^data: /, '').trim();
                        // 过滤OpenRouter系统消息
                        if (jsonStr.startsWith(':') || jsonStr.includes('OPENROUTER PROCESSING')) continue;
                        
                        const json = JSON.parse(jsonStr);
                        
                        // 内容拼接与清理
                        if (json.choices?.[0]?.delta?.content) {
                            let filteredContent = json.choices[0].delta.content;
                            
                            // 早期内容清理：移除可能的```html标记
                            if (fullContent.length < 20) {
                                const combined = fullContent + filteredContent;
                                if (combined.includes('```html')) {
                                    filteredContent = filteredContent.replace(/```html\s*/g, '');
                                    fullContent = fullContent.replace(/```h?t?m?l?\s*/g, '');
                                }
                            }
                            
                            // 尾部清理：移除结束的```标记
                            filteredContent = filteredContent.replace(/```\s*$/g, '');
                            
                            // 更新内容存储
                            fullContent += filteredContent;
                            contentBuffer += filteredContent;
                            
                            // 记录收到有效内容
                            resetOpenrouterProcessing();
                            lastProgressTime = Date.now();
                            
                            // 检查是否找到HTML结束标签
                            if (!foundHtmlEnd && filteredContent.includes('</html>')) {
                                foundHtmlEnd = true;
                                console.log('找到HTML结束标签，但继续接收剩余内容');
                            }
                            
                            // 如果已找到HTML结束标签，计算之后接收的字符数
                            if (foundHtmlEnd) {
                                charsAfterHtmlEnd += filteredContent.length;
                            }

                            // 进度回调处理（每100ms触发）
                            if (Date.now() - lastUpdateTime >= 100 && onProgress) {
                                onProgress(contentBuffer, fullContent); // 简化后的进度回调
                                contentBuffer = '';
                                lastUpdateTime = Date.now();
                            }
                        }
                    } catch (e) {
                        console.warn('解析流数据失败:', e, '原始数据:', line);
                    }
                }
            }
            
            // 在数据读取循环结束后，处理剩余数据
            if (contentBuffer && contentBuffer.length > 0) {
                if (onProgress) {
                    console.log('处理剩余缓冲区内容，长度:', contentBuffer.length);
                    onProgress(contentBuffer, fullContent);
                }
                contentBuffer = '';
            }
            
            console.log(`内容生成情况: HTML结束标签: ${foundHtmlEnd ? '是' : '否'}, 之后接收字符数: ${charsAfterHtmlEnd}`);
            
            // 完成性检查：验证HTML结构完整性
            isComplete = checkContentComplete(fullContent);
            if (!isComplete) {
                // 重试准备：等待1秒后继续生成
                retryCount++;
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        // 最终清理：移除残留的Markdown标记
        const cleanedContent = cleanMarkdownCodeMarkers(fullContent);
        return cleanedContent;
    } catch (error) {
        console.error('调用硅基流动API失败:', error);
        throw error;
    }
}

/**
 * 检查生成的内容是否完整
 * @param {string} content - 生成的内容
 * @returns {boolean} - 返回内容是否完整
 */
function checkContentComplete(content) {
    // 检查HTML结构是否完整
    const hasHtmlStart = content.includes('<!DOCTYPE html>') || content.includes('<html');
    const hasHtmlEnd = content.includes('</html>');
    
    // 通过正则表达式检查是否包含完整的</script>标签
    const hasScriptEnd = /<\/script>/i.test(content);
    
    // 检查结尾部分是否完整（确保</html>出现在接近内容的末尾）
    const isEndingComplete = hasHtmlEnd && 
        (content.trim().length - content.lastIndexOf('</html>') < 50);
    
    // 宽松检查，只要有开始和结束标签就认为基本完整
    if (hasHtmlStart && hasHtmlEnd && hasScriptEnd) {
        return true;
    }
    
    // 更严格的检查（只有基本检查失败时才进行）
    // 检查是否包含关键结构
    const hasHead = content.includes('</head>');
    const hasBody = content.includes('</body>');
    
    // 检查HTML基本结构完整性
    const structureComplete = hasHtmlStart && hasHtmlEnd && hasHead && hasBody;
    
    return structureComplete;
}

/**
 * 检查文本语义完整性
 * @param {string} content - 生成的内容
 * @returns {boolean} - 返回文本是否语义完整
 */
function checkSemanticCompleteness(content) {
    // 检查是否存在未闭合的HTML标签
    const unclosedTags = findUnclosedTags(content);
    if (unclosedTags.length > 0) {
        console.log('存在未闭合的标签:', unclosedTags);
        return false;
    }
    
    // 检查最后一个段落是否完整（不以逗号或其他连接词结尾）
    const lastParagraph = getLastTextParagraph(content);
    if (lastParagraph) {
        const incompleteSentencePatterns = [
            /[,，]\s*$/,  // 以逗号结尾
            /[的地得]\s*$/,  // 以助词结尾
            /[和与及]\s*$/,  // 以连接词结尾
            /[：:、]\s*$/,   // 以分隔符结尾
            /[\u4e00-\u9fa5]\s*$/  // 检查最后一个字符是否为汉字（可能表示未完成）
        ];
        
        const isIncomplete = incompleteSentencePatterns.some(pattern => 
            pattern.test(lastParagraph.trim())
        );
        
        if (isIncomplete) {
            console.log('最后一个段落可能不完整:', lastParagraph);
            return false;
        }
    }
    
    return true;
}

/**
 * 查找未闭合的HTML标签
 * @param {string} content - HTML内容
 * @returns {string[]} - 返回未闭合的标签列表
 */
function findUnclosedTags(content) {
    // 初始化数据结构：标签堆栈和未闭合标签集合
    const tagStack = [];            // 用于追踪未闭合的开始标签
    const unclosedTags = [];        // 收集未正确闭合的标签
    const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9]*)(?:\s[^>]*)?>/g;  // 匹配HTML标签的正则
    const voidElements = new Set([  // 自闭合标签集合（不需要闭合的标签）
        'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
        'link', 'meta', 'param', 'source', 'track', 'wbr'
    ]);
    
    let match;
    // 遍历所有匹配的HTML标签
    while ((match = tagPattern.exec(content)) !== null) {
        const [fullTag, tagName] = match;
        const isClosing = fullTag.startsWith('</');  // 判断是否为闭合标签
        
        // 仅处理非自闭合标签
        if (!voidElements.has(tagName.toLowerCase())) {
            if (isClosing) {
                // 处理闭合标签：检查堆栈是否匹配
                if (tagStack.length > 0 && tagStack[tagStack.length - 1] === tagName) {
                    tagStack.pop();  // 找到匹配的开始标签，弹出堆栈
                } else {
                    unclosedTags.push(tagName);  // 未匹配的闭合标签
                }
            } else {
                tagStack.push(tagName);  // 将开始标签压入堆栈
            }
        }
    }
    
    // 合并结果：堆栈剩余标签 + 未匹配闭合标签，并用Set去重
    return [...new Set([...tagStack, ...unclosedTags])];
}

/**
 * 获取最后一个文本段落
 * @param {string} content - HTML内容
 * @returns {string|null} - 返回最后一个文本段落，如果没有找到则返回null
 */
function getLastTextParagraph(content) {
    // 移除HTML标签
    const textContent = content.replace(/<[^>]+>/g, '\n');
    
    // 分割成段落并过滤空段落
    const paragraphs = textContent.split('\n')
        .map(p => p.trim())
        .filter(p => p.length > 0);
    
    return paragraphs.length > 0 ? paragraphs[paragraphs.length - 1] : null;
}

/**
 * 获取提示词模板
 * @returns {Promise<string>} - 返回提示词模板
 */
async function fetchPromptTemplate() {
    try {
        const response = await fetch('prm.md');
        if (!response.ok) {
            throw new Error(`获取提示词模板失败: ${response.status}`);
        }
        return await response.text();
    } catch (error) {
        console.error('获取提示词模板失败:', error);
        // 如果获取失败，返回硬编码的提示词模板
        return `获取提示词模板失败`;
    }
}

/**
 * 清理HTML代码中的Markdown标记
 * @param {string} content - 需要清理的内容
 * @returns {string} - 清理后的内容
 */
function cleanMarkdownCodeMarkers(content) {
    // 移除开头的```html标记
    let cleaned = content.replace(/^```html\s*/m, '');
    
    // 移除结尾的```标记
    cleaned = cleaned.replace(/```\s*$/m, '');
    
    return cleaned;
}

/**
 * 构建完整提示词
 * @param {string} template - 提示词模板
 * @param {string} content - 用户内容
 * @returns {string} - 返回完整提示词
 */
function buildPrompt(template, content) {
    // 在构建提示词时添加请求，不要输出```html标记
    return `${template}\n\n以下是需要转换的内容：\n\n${content}\n\n请直接输出HTML代码，不要包含\`\`\`html和\`\`\`这样的Markdown代码块标记。直接以<!DOCTYPE html>开始输出。`;
}

/**
 * 配置硅基流动API
 * @param {string} apiKey - API密钥
 * @param {string} modelName - 模型名称
 * @param {string} apiUrl - API地址
 */
function configureSiliconFlowAPI(apiKey, modelName, apiUrl) {
    window.siliconFlowConfig = {
        apiKey,
        modelName,
        apiUrl
    };
    
    console.log('硅基流动API配置已更新');
}

// 导出函数
window.siliconFlow = {
    callAPI: callSiliconFlowAPI,
    configure: configureSiliconFlowAPI
};