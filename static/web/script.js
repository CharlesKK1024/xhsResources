class XHSWebUI {
    constructor() {
        this.init();
    }

    init() {
        this.urlInput = document.getElementById('urlInput');
        this.cookieInput = document.getElementById('cookieInput');
        this.fetchBtn = document.getElementById('fetchBtn');
        this.settingsBtn = document.getElementById('settingsBtn');
        this.loading = document.getElementById('loading');
        this.result = document.getElementById('result');
        this.error = document.getElementById('error');
        this.errorMsg = document.getElementById('errorMsg');
        this.copyBtn = document.getElementById('copyBtn');
        this.settingsPanel = document.getElementById('settingsPanel');
        this.closeSettings = document.getElementById('closeSettings');
        this.saveSettings = document.getElementById('saveSettings');

        this.bindEvents();
        this.loadSettings();
    }

    bindEvents() {
        this.fetchBtn.addEventListener('click', () => this.fetchNote());
        this.urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.fetchNote();
        });
        this.copyBtn.addEventListener('click', () => this.copyLinks());
        this.settingsBtn.addEventListener('click', () => this.showSettings());
        this.closeSettings.addEventListener('click', () => this.hideSettings());
        this.saveSettings.addEventListener('click', () => this.saveSettingsHandler());
    }

    async fetchNote() {
        const url = this.urlInput.value.trim();
        if (!url) {
            this.showError('请输入小红书作品链接');
            return;
        }

        this.showLoading();

        try {
            const cookie = this.cookieInput.value.trim();
            const settings = this.getSettings();
            const data = await this.callAPI(url, cookie, settings);
            this.displayResult(data);
        } catch (err) {
            this.showError(err.message || '获取失败，请检查链接或 Cookie');
        }
    }

    async callAPI(url, cookie, settings) {
        const params = new URLSearchParams({ url });
        if (cookie) params.append('cookie', cookie);
        if (settings.proxy) params.append('proxy', settings.proxy);
        if (settings.imageFormat) params.append('image_format', settings.imageFormat);
        if (settings.videoPref) params.append('video_preference', settings.videoPref);

        const resp = await fetch(`/web/api/note?${params.toString()}`, {
            headers: { 'Accept': 'application/json' }
        });

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.detail || `请求失败 (${resp.status})`);
        }

        return await resp.json();
    }

    displayResult(data) {
        this.hideAll();
        this.result.style.display = 'block';
        const previewSection = document.querySelector('.preview-section');
        if (previewSection) previewSection.style.display = 'block';

        document.getElementById('title').textContent = data.title || '未命名';
        document.getElementById('desc').textContent = data.desc || '';
        document.getElementById('author').textContent = data.author || '未知';
        document.getElementById('likeCount').textContent = this.formatNum(data.likeCount);
        document.getElementById('collectCount').textContent = this.formatNum(data.collectCount);

        const cover = document.getElementById('coverImg');
        if (data.cover) {
            cover.referrerPolicy = "no-referrer";
            cover.src = this.proxyUrl(data.cover);
            cover.onerror = () => { cover.src = this.getPlaceholder(); };
        } else {
            cover.src = this.getPlaceholder();
        }

        this.renderDownloadList(data);
        localStorage.setItem('xhs_last_note', JSON.stringify(data));
    }

    proxyUrl(url) {
        if (!url) return '';
        // 清理 URL，移除可能的空格和反引号
        let cleanUrl = url.trim().replace(/[`"']/g, '');
        
        // 如果是小红书图片域名且没有 format 参数，则添加
        if (cleanUrl.includes('xhscdn.com') && !cleanUrl.includes('?format=')) {
            cleanUrl += '?format=png';
        }
        return cleanUrl;
    }

    renderDownloadList(data) {
        const container = document.getElementById('downloadList');
        container.innerHTML = '';
        const previewContainer = document.getElementById('previewList');
        previewContainer.innerHTML = '';

        const items = [];

        if (data.images && data.images.length) {
            data.images.forEach((img, i) => {
                items.push({
                    icon: '🖼️',
                    name: `图片 ${i + 1}`,
                    info: img.width && img.height ? `${img.width} × ${img.height}` : '',
                    url: img.url
                });
                const previewEl = document.createElement('div');
                previewEl.className = 'preview-item';
                previewEl.innerHTML = `
                    <img src="${this.proxyUrl(img.url)}" alt="图片 ${i + 1}" loading="lazy" referrerpolicy="no-referrer">
                    <span class="preview-index">${i + 1}</span>
                `;
                previewContainer.appendChild(previewEl);
            });
        }

        if (data.videos && data.videos.length) {
            data.videos.forEach((v, i) => {
                items.push({
                    icon: '🎬',
                    name: `视频 ${i + 1}`,
                    info: '',
                    url: v.url
                });
            });
        }

        if (!items.length) {
            container.innerHTML = '<p class="no-links">暂无下载链接</p>';
            return;
        }

        items.forEach(item => {
            const el = document.createElement('div');
            el.className = 'download-item';
            el.innerHTML = `
                <div class="item-icon">${item.icon}</div>
                <div class="item-info">
                    <div class="item-name">${item.name}</div>
                    ${item.info ? `<div class="item-size">${item.info}</div>` : ''}
                </div>
                <a class="item-link" href="${this.proxyUrl(item.url)}" target="_blank" rel="noopener">下载</a>
            `;
            container.appendChild(el);
        });
    }

    async copyLinks() {
        const data = JSON.parse(localStorage.getItem('xhs_last_note') || '{}');
        const links = [];

        if (data.images) links.push(...data.images.map(i => this.proxyUrl(i.url)));
        if (data.videos) links.push(...data.videos.map(v => this.proxyUrl(v.url)));

        if (!links.length) {
            alert('没有可复制的链接');
            return;
        }

        try {
            await navigator.clipboard.writeText(links.join('\n'));
            alert('链接已复制到剪贴板');
        } catch {
            const ta = document.createElement('textarea');
            ta.value = links.join('\n');
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            alert('链接已复制到剪贴板');
        }
    }

    showSettings() {
        this.settingsPanel.style.display = 'flex';
        const s = this.getSettings();
        document.getElementById('settingPath').value = s.path || '';
        document.getElementById('settingImageFormat').value = s.imageFormat || 'auto';
        document.getElementById('settingVideoPref').value = s.videoPref || 'resolution';
        document.getElementById('settingProxy').value = s.proxy || '';
    }

    hideSettings() {
        this.settingsPanel.style.display = 'none';
    }

    saveSettingsHandler() {
        const settings = {
            path: document.getElementById('settingPath').value.trim(),
            imageFormat: document.getElementById('settingImageFormat').value,
            videoPref: document.getElementById('settingVideoPref').value,
            proxy: document.getElementById('settingProxy').value.trim()
        };
        localStorage.setItem('xhs_settings', JSON.stringify(settings));
        this.hideSettings();
    }

    getSettings() {
        try {
            return JSON.parse(localStorage.getItem('xhs_settings') || '{}');
        } catch {
            return {};
        }
    }

    loadSettings() {
        const s = this.getSettings();
        if (s.path) document.getElementById('settingPath').value = s.path;
    }

    showLoading() {
        this.hideAll();
        this.loading.style.display = 'block';
    }

    showError(msg) {
        this.hideAll();
        this.error.style.display = 'flex';
        this.errorMsg.textContent = msg;
    }

    hideAll() {
        this.loading.style.display = 'none';
        this.result.style.display = 'none';
        this.error.style.display = 'none';
        const previewSection = document.querySelector('.preview-section');
        if (previewSection) previewSection.style.display = 'none';
    }

    formatNum(n) {
        n = parseInt(n) || 0;
        if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
        return n.toString();
    }

    getPlaceholder() {
        return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect fill="%23f0f0f0" width="200" height="200"/><text fill="%23ccc" font-family="sans-serif" font-size="14" x="50%" y="50%" text-anchor="middle" dy=".3em">无封面</text></svg>';
    }
}

document.addEventListener('DOMContentLoaded', () => new XHSWebUI());