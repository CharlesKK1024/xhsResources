/**
 * 动态生成海浪加载动画的 HTML 结构
 * @returns {string} 加载动画的内部 HTML
 */
window.generateLoadingWave = function() {
    const barsCount = 24;
    let barsHtml = '';
    for (let i = 0; i < barsCount; i++) {
        barsHtml += '<div class="wave-bar"></div>';
    }
    
    return `
        <div class="loading-text">笔记加载ing</div>
        <div class="wave-container">
            ${barsHtml}
        </div>
    `;
};
