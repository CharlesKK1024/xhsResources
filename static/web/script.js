class XHSWebUI {
    constructor() {
        this.currentNote = null;
        this.init();
    }

    init() {
        // 提取页面元素
        this.urlInput = document.getElementById('urlInput');
        this.cookieInput = document.getElementById('cookieInput');
        this.fetchBtn = document.getElementById('fetchBtn');
        this.refreshBtn = document.getElementById('refreshBtn');
        this.loading = document.getElementById('loading');
        this.result = document.getElementById('result');
        this.error = document.getElementById('error');
        this.errorMsg = document.getElementById('errorMsg');
        this.copyBtn = document.getElementById('copyBtn');
        this.starBtn = document.getElementById('starBtn');
        this.downloadAllBtn = document.getElementById('downloadAllBtn');
        
        // 导航元素
        this.navItems = document.querySelectorAll('.nav-item');
        this.pages = document.querySelectorAll('.page');
        
        // 列表页面元素
        this.historyList = document.getElementById('historyList');
        this.historySearch = document.getElementById('historySearch');
        this.historySort = document.getElementById('historySort');
        
        this.collectionList = document.getElementById('collectionList');
        this.collectionSearch = document.getElementById('collectionSearch');
        this.filterBtns = document.querySelectorAll('.filter-btn');
        this.themeToggle = document.getElementById('themeToggle');

        this.bindEvents();
        this.loadTheme();
        this.loadInitialData();
    }

    bindEvents() {
        // 主题切换
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        // 导航切换
        this.navItems.forEach(item => {
            item.addEventListener('click', () => this.switchPage(item.dataset.target));
        });

        // 提取功能
        this.fetchBtn.addEventListener('click', () => this.fetchNote(false));
        this.refreshBtn.addEventListener('click', () => this.fetchNote(true));
        this.urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.fetchNote(false);
        });
        
        this.copyBtn.addEventListener('click', () => this.copyLinks());
        this.starBtn.addEventListener('click', () => this.toggleStar());
        this.downloadAllBtn.addEventListener('click', () => this.downloadAllImages());
        this.exportBtn = document.getElementById('exportBtn');
        if (this.exportBtn) {
            this.exportBtn.addEventListener('click', () => this.exportCollections());
        }

        // 搜索与排序
        this.historySearch.addEventListener('input', () => this.debounce(() => this.loadHistory(), 500)());
        this.historySort.addEventListener('change', () => this.loadHistory());
        
        this.collectionSearch.addEventListener('input', () => this.debounce(() => this.loadCollections(), 500)());
    }

    async loadInitialData() {
        // 默认显示提取页面，不需要初始加载数据
    }

    switchPage(targetId) {
        this.navItems.forEach(item => {
            item.classList.toggle('active', item.dataset.target === targetId);
        });
        this.pages.forEach(page => {
            page.classList.toggle('active', page.id === targetId);
        });

        if (targetId === 'history-page') this.loadHistory();
        if (targetId === 'collection-page') this.loadCollections();
    }

    toggleTheme() {
        const isDark = document.body.getAttribute('data-theme') === 'dark';
        const newTheme = isDark ? 'light' : 'dark';
        this.setTheme(newTheme);
    }

    setTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        const icon = theme === 'dark' ? '☀️' : '🌙';
        const text = theme === 'dark' ? '浅色模式' : '深色模式';
        this.themeToggle.querySelector('.nav-icon').textContent = icon;
        this.themeToggle.querySelector('.theme-text').textContent = text;
        localStorage.setItem('xhs_theme', theme);
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('xhs_theme') || 'light';
        this.setTheme(savedTheme);
    }

    async fetchNote(refresh = false) {
        const url = this.urlInput.value.trim();
        if (!url) {
            this.showError('请输入小红书作品链接');
            return;
        }

        this.showLoading();

        try {
            const cookie = this.cookieInput.value.trim();
            const apiUrl = `/web/api/note?url=${encodeURIComponent(url)}&cookie=${encodeURIComponent(cookie)}&refresh=${refresh}`;
            const resp = await fetch(apiUrl);
            if (!resp.ok) throw new Error(await resp.text());
            
            const data = await resp.json();
            this.currentNote = data;
            this.displayResult(data);
            
            // 显示刷新按钮
            this.refreshBtn.style.display = 'flex';
        } catch (err) {
            this.showError(err.message || '获取失败，请检查链接或 Cookie');
        }
    }

    displayResult(data) {
        this.hideAll();
        this.result.style.display = 'block';

        document.getElementById('title').textContent = data.title || '无标题';
        document.getElementById('desc').textContent = data.desc || '';
        document.getElementById('author').textContent = data.author || '未知作者';
        document.getElementById('publishTime').textContent = data.time || '-';
        document.getElementById('likeCount').textContent = this.formatNum(data.likeCount);
        document.getElementById('collectCount').textContent = this.formatNum(data.collectCount);
        document.getElementById('commentCount').textContent = this.formatNum(data.commentCount);

        const cover = document.getElementById('coverImg');
        cover.src = this.getMediaUrl(data.cover);
        
        // 封面加载失败时的回退逻辑
        cover.onerror = () => {
            if (data.images && data.images.length > 0) {
                cover.src = this.getMediaUrl(data.images[0].url);
            } else if (data.videos && data.videos.length > 0) {
                cover.src = this.getMediaUrl(data.videos[0].url);
            } else {
                cover.src = this.getPlaceholder();
            }
            cover.onerror = null; // 防止死循环
        };
        
        this.renderTags(data.tags);
        this.renderPreviewList(data);
        
        // 更新收藏按钮状态
        this.updateStarBtn(false); 
    }

    renderTags(tagsStr) {
        const container = document.getElementById('tags');
        container.innerHTML = '';
        if (!tagsStr) return;
        
        const tags = tagsStr.split(/[#\s]+/).filter(t => t.trim());
        tags.forEach(tag => {
            const span = document.createElement('span');
            span.className = 'tag';
            span.textContent = `#${tag}`;
            container.appendChild(span);
        });
    }

    renderPreviewList(data) {
        const container = document.getElementById('previewList');
        container.innerHTML = '';
        
        const media = data.images.length > 0 ? data.images : data.videos;
        if (!media.length) return;

        media.forEach((item, i) => {
            const div = document.createElement('div');
            div.className = 'preview-item';
            const url = this.getMediaUrl(item.url);
            div.innerHTML = `<img src="${url}" loading="lazy" referrerpolicy="no-referrer">`;
            div.onclick = () => window.open(url, '_blank');
            container.appendChild(div);
        });

        this.downloadAllBtn.style.display = data.images.length > 0 ? 'block' : 'none';
    }

    async toggleStar() {
        if (!this.currentNote) return;
        const newState = this.starBtn.classList.contains('starred') ? 0 : 1;
        
        try {
            await fetch('/web/api/star', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ note_id: this.currentNote.id, is_starred: newState })
            });
            this.updateStarBtn(newState === 1);
        } catch (e) {
            console.error('收藏失败', e);
        }
    }

    updateStarBtn(isStarred) {
        if (isStarred) {
            this.starBtn.classList.add('starred');
            this.starBtn.innerHTML = '❤️ 已收藏';
            this.starBtn.style.backgroundColor = '#fff5f6';
            this.starBtn.style.color = 'var(--primary-color)';
        } else {
            this.starBtn.classList.remove('starred');
            this.starBtn.innerHTML = '⭐ 收藏';
            this.starBtn.style.backgroundColor = '#f0f0f0';
            this.starBtn.style.color = '#666';
        }
    }

    async loadHistory() {
        const search = this.historySearch.value;
        const sort = this.historySort.value;
        
        try {
            const resp = await fetch(`/web/api/history?search=${encodeURIComponent(search)}&sort=${sort}`);
            const data = await resp.json();
            this.renderDataList(this.historyList, data);
        } catch (e) {
            console.error('加载历史失败', e);
        }
    }

    async loadCollections() {
        const search = this.collectionSearch.value;
        try {
            const resp = await fetch(`/web/api/collection?search=${encodeURIComponent(search)}`);
            const data = await resp.json();
            this.renderDataList(this.collectionList, data);
        } catch (e) {
            console.error('加载收藏失败', e);
        }
    }

    renderDataList(container, items) {
        container.innerHTML = '';
        if (!items.length) {
            container.innerHTML = '<div class="empty-tip">暂无数据</div>';
            return;
        }

        items.forEach(item => {
            const note = item.data;
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `
                <div class="item-cover">
                    <img src="${this.getMediaUrl(note.cover)}" loading="lazy">
                    ${item.is_starred ? '<div class="item-star-badge">❤️</div>' : ''}
                </div>
                <div class="item-info">
                    <div class="item-title">${note.title || '无标题'}</div>
                    <div class="item-meta">
                        <span>👤 ${note.author}</span>
                        <span>📅 ${note.time || '-'}</span>
                    </div>
                </div>
            `;
            div.onclick = () => {
                this.currentNote = note;
                this.switchPage('extract-page');
                this.displayResult(note);
                this.updateStarBtn(item.is_starred);
            };
            container.appendChild(div);
        });
    }

    getMediaUrl(url) {
        if (!url) return this.getPlaceholder();
        if (url.startsWith('/web/cache')) return url;
        return `/web/api/proxy?url=${encodeURIComponent(url)}`;
    }

    async copyLinks() {
        if (!this.currentNote) return;
        const links = [];
        if (this.currentNote.images) links.push(...this.currentNote.images.map(i => i.url));
        if (this.currentNote.videos) links.push(...this.currentNote.videos.map(v => v.url));
        
        try {
            await navigator.clipboard.writeText(links.join('\n'));
            alert('链接已复制');
        } catch (e) {
            alert('复制失败');
        }
    }

    async exportCollections() {
        try {
            const resp = await fetch('/web/api/collection');
            const data = await resp.json();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `xhs_collections_${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            alert('导出失败');
        }
    }

    downloadAllImages() {
        if (!this.currentNote || !this.currentNote.images) return;
        this.currentNote.images.forEach((img, i) => {
            setTimeout(() => {
                const a = document.createElement('a');
                a.href = this.getMediaUrl(img.url);
                a.download = `xhs_${this.currentNote.id}_${i+1}.png`;
                a.click();
            }, i * 300);
        });
    }

    // 工具函数
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
    }

    formatNum(n) {
        n = parseInt(n) || 0;
        if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
        return n.toString();
    }

    getPlaceholder() {
        return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect fill="%23f0f0f0" width="200" height="200"/><text fill="%23ccc" font-family="sans-serif" font-size="14" x="50%" y="50%" text-anchor="middle" dy=".3em">无封面</text></svg>';
    }

    debounce(fn, delay) {
        let timer = null;
        return function() {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, arguments), delay);
        };
    }
}

document.addEventListener('DOMContentLoaded', () => new XHSWebUI());
