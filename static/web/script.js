class XHSWebUI {
    constructor() {
        this.currentNote = null;
        this.token = localStorage.getItem('xhs_token') || '';
        this.currentUser = null;
        this.init();
    }

    init() {
        // 全局滚动状态管理
        window.isPageScrolling = false;
        let scrollTimer = null;
        document.querySelector('.main-content').addEventListener('scroll', () => {
            window.isPageScrolling = true;
            if (scrollTimer) clearTimeout(scrollTimer);
            scrollTimer = setTimeout(() => {
                window.isPageScrolling = false;
            }, 150); // 滚动停止 150ms 后释放
        }, { passive: true });

        // 提取页面元素
        this.urlInput = document.getElementById('urlInput');
        this.fetchBtn = document.getElementById('fetchBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.pasteBtn = document.getElementById('pasteBtn');
        this.detectedLinksEl = document.getElementById('detectedLinks');
        this.refreshBtn = document.getElementById('refreshBtn');
        this.loading = document.getElementById('loading');
        if (this.loading && window.generateLoadingWave) {
            this.loading.innerHTML = window.generateLoadingWave();
        }
        this.result = document.getElementById('result');
        this.error = document.getElementById('error');
        this.errorMsg = document.getElementById('errorMsg');
        this.copyBtn = document.getElementById('copyBtn');
        this.starBtn = document.getElementById('starBtn');
        this.downloadAllBtn = document.getElementById('downloadAllBtn');
        this.editModeBtn = document.getElementById('editModeBtn');
        this.previewSection = document.querySelector('.preview-section');
        this.scaleBtn = document.getElementById('scaleBtn');
        this.editModeToggle = document.getElementById('editModeToggle');
        this.cardScaler = document.getElementById('cardScaler');
        this.scaleRange = document.getElementById('scaleRange');
        this.scaleValue = document.getElementById('scaleValue');
        
        // 设置面板元素
        this.settingsBtn = document.getElementById('settingsBtn');
        this.settingsPanel = document.getElementById('settingsPanel');
        this.closeSettings = document.getElementById('closeSettings');
        this.saveSettingsBtn = document.getElementById('saveSettings');
        this.settingPath = document.getElementById('settingPath');
        this.settingImageFormat = document.getElementById('settingImageFormat');
        this.settingVideoPref = document.getElementById('settingVideoPref');
        this.settingProxy = document.getElementById('settingProxy');
        this.settingCookie = document.getElementById('settingCookie');

        // 用户相关元素
        this.userWidget = document.getElementById('userWidget');
        this.userAvatar = document.getElementById('userAvatar');
        this.userNickname = document.getElementById('userNickname');
        this.loginModal = document.getElementById('loginModal');
        this.loginNickname = document.getElementById('loginNickname');
        this.loginPassword = document.getElementById('loginPassword');
        this.loginPasswordToggle = document.getElementById('loginPasswordToggle');
        this.loginError = document.getElementById('loginError');
        this.loginResetBtn = document.getElementById('loginResetBtn');
        this.loginBtn = document.getElementById('loginBtn');
        this.profileModal = document.getElementById('profileModal');
        this.profileAvatar = document.getElementById('profileAvatar');
        this.profileNickname = document.getElementById('profileNickname');
        this.profileAvatarBtn = document.getElementById('profileAvatarBtn');
        this.profileAvatarInput = document.getElementById('profileAvatarInput');
        this.profileClose = document.getElementById('profileClose');
        this.profileSave = document.getElementById('profileSave');
        this.profileLogout = document.getElementById('profileLogout');
        this.profileThemeDark = document.getElementById('profileThemeDark');
        this.profileThemeLight = document.getElementById('profileThemeLight');
        
        // 全景查看器元素
        this.fullViewer = document.getElementById('fullViewer');
        this.viewerImg = document.getElementById('viewerImg');
        this.viewerCounter = document.getElementById('viewerCounter');
        this.viewerClose = this.fullViewer.querySelector('.viewer-close');
        this.viewerPrev = this.fullViewer.querySelector('.prev');
        this.viewerNext = this.fullViewer.querySelector('.next');
        
        // 瀑布流查看器元素
        this.waterfallViewer = document.getElementById('waterfallViewer');
        this.waterfallTitle = document.getElementById('waterfallTitle');
        this.waterfallContent = document.getElementById('waterfallContent');
        this.waterfallClose = this.waterfallViewer.querySelector('.waterfall-close');
        
        // 笔记详情查看器元素
        this.noteDetailViewer = document.getElementById('noteDetailViewer');
        this.noteDetailBack = this.noteDetailViewer.querySelector('.note-detail-back');
        this.noteMediaWrapper = document.getElementById('noteMediaWrapper');
        this.noteMediaCounter = document.getElementById('noteMediaCounter');
        this.noteMediaDots = document.getElementById('noteMediaDots');
        this.noteDetailTitle = document.getElementById('noteDetailTitle');
        this.noteDetailDesc = document.getElementById('noteDetailDesc');
        this.noteDetailTags = document.getElementById('noteDetailTags');
        this.noteDetailTime = document.getElementById('noteDetailTime');
        this.noteAvatar = document.getElementById('noteAvatar');
        this.noteAuthorName = document.getElementById('noteAuthorName');
        this.noteShareBtn = document.getElementById('noteShareBtn');
        this.noteLikeCount = document.getElementById('noteLikeCount');
        this.noteCollectCount = document.getElementById('noteCollectCount');
        this.noteCommentCount = document.getElementById('noteCommentCount');

        // 状态
        this.isEditMode = false;
        this.isListEditMode = false;
        this._authorAvatarCache = {};
        this.swipeInstances = [];
        this.viewerList = []; // 当前查看器中的图片列表
        this.viewerIndex = 0; // 当前图片索引
        this.noteMediaIndex = 0; // 笔记详情媒体索引
        this.lastClipboardContent = ''; // 记录上次处理的剪贴板内容
        this.userTheme = 'dark';
        
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
        this._initScrollRail();
        this._fixIOSInputZoom();

        // 作品集页面默认展开底部筛选栏
        const historyControls = document.getElementById('historyControls');
        const activeNav = document.querySelector('.nav-item.active');
        if (historyControls && activeNav && activeNav.dataset.target === 'history-page') {
            historyControls.classList.add('visible');
        }

        // 刷新按钮
        const refreshPageBtn = document.getElementById('pageRefreshBtn');
        if (refreshPageBtn) {
            refreshPageBtn.addEventListener('click', () => location.reload());
        }
    }

    bindEvents() {
        // 主题切换
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        // 导航切换
        this.navItems.forEach(item => {
            item.addEventListener('click', () => this.switchPage(item.dataset.target));
        });

        // 提取功能
        this.clearBtn.addEventListener('click', () => {
            this.urlInput.value = '';
            this.renderDetectedLinks([]);
            this.urlInput.focus();
        });
        this.fetchBtn.addEventListener('click', () => this.fetchNote(false));
        this.refreshBtn.addEventListener('click', () => this.fetchNote(true));
        this.urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.fetchNote(false);
            }
        });
        this.urlInput.addEventListener('input', () => this.detectAndRenderLinks());
        this.urlInput.addEventListener('paste', () => {
            setTimeout(() => {
                const links = this.detectLinks();
                this.renderDetectedLinks(links);
                if (links.length === 1 && !this._hadContentBeforePaste) {
                    this.fetchNote(false);
                }
            }, 50);
        });
        this.urlInput.addEventListener('beforeinput', (e) => {
            if (e.inputType === 'insertFromPaste') {
                this._hadContentBeforePaste = this.urlInput.value.trim().length > 0;
            }
        });
        this.pasteBtn.addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                if (!text || !text.trim()) return;
                const existingLinks = this.detectLinks();
                const newRegex = /https?:\/\/[^\s)>"']*(?:xiaohongshu|xhslink)\.com[^\s)>"']*/gi;
                const newUrls = text.match(newRegex) || [];
                const dupes = newUrls.filter(u => existingLinks.includes(u));
                if (dupes.length > 0 && newUrls.length === dupes.length) {
                    if (window.showToast) window.showToast('链接已存在，跳过重复');
                    return;
                }
                const current = this.urlInput.value;
                this.urlInput.value = current ? current + '\n' + text.trim() : text.trim();
                this.detectAndRenderLinks();
                const links = this.detectLinks();
                if (dupes.length > 0) {
                    if (window.showToast) window.showToast(`已添加，${dupes.length} 个重复链接已自动去重`);
                } else if (links.length > 0) {
                    if (window.showToast) window.showToast(`已添加 ${newUrls.length} 个链接`);
                }
            } catch (err) {
                if (window.showToast) window.showToast('无法读取剪贴板');
            }
        });
        
        this.copyBtn.addEventListener('click', () => this.copyLinks());
        this.starBtn.addEventListener('click', () => this.toggleStar());
        this.downloadAllBtn.addEventListener('click', () => this.downloadAllImages());
        if (this.editModeBtn) {
            this.editModeBtn.addEventListener('click', () => this.toggleEditMode());
        }
        if (this.scaleBtn) {
            this.scaleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.cardScaler.style.display = this.cardScaler.style.display === 'none' ? 'flex' : 'none';
            });
        }
        if (this.scaleRange) {
            this.scaleRange.addEventListener('input', (e) => this.handleScale(e.target.value));
        }
        // 点击外部关闭缩放面板
        document.addEventListener('click', (e) => {
            if (this.cardScaler && !this.cardScaler.contains(e.target) && e.target !== this.scaleBtn) {
                this.cardScaler.style.display = 'none';
            }
        });

        // 编辑模式切换
        if (this.editModeToggle) {
            this.editModeToggle.addEventListener('click', () => {
                this.isListEditMode = !this.isListEditMode;
                this.editModeToggle.classList.toggle('active', this.isListEditMode);
                // 在主内容区添加/移除编辑模式类，控制删除按钮显隐
                document.querySelector('.main-content').classList.toggle('edit-mode-active', this.isListEditMode);
            });
        }

        // 全景查看器事件
        this.viewerClose.onclick = () => this.closeViewer();
        this.viewerPrev.onclick = (e) => { e.stopPropagation(); this.prevImage(); };
        this.viewerNext.onclick = (e) => { e.stopPropagation(); this.nextImage(); };
        this.fullViewer.onclick = () => this.closeViewer();
        
        // 瀑布流事件
        this.waterfallClose.onclick = () => this.closeWaterfall();
        
        // 笔记详情事件
        this.noteDetailBack.onclick = () => this.closeNoteDetail();

        // 笔记详情：下拉关闭 + 右滑缩小关闭
        let detailTouchStartY = 0;
        let detailTouchStartX = 0;
        let detailGesture = '';

        this.noteDetailViewer.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            detailTouchStartY = touch.clientY;
            detailTouchStartX = touch.clientX;
            detailGesture = '';
            this.noteDetailViewer.style.transition = 'none';
        }, { passive: true });

        this.noteDetailViewer.addEventListener('touchmove', (e) => {
            const touch = e.touches[0];
            const diffX = touch.clientX - detailTouchStartX;
            const diffY = touch.clientY - detailTouchStartY;
            const absX = Math.abs(diffX);
            const absY = Math.abs(diffY);

            if (!detailGesture && (absX > 10 || absY > 10)) {
                if (diffX > 0 && absX > absY) {
                    detailGesture = 'swipe';
                } else if (diffY > 0 && absY > absX) {
                    const content = this.noteDetailViewer.querySelector('.note-detail-content');
                    if (content && content.scrollTop <= 0) {
                        detailGesture = 'pulldown';
                    }
                }
            }

            if (detailGesture === 'pulldown') {
                if (e.cancelable) e.preventDefault();
                const translate = Math.pow(Math.max(0, touch.clientY - detailTouchStartY), 0.85);
                this.noteDetailViewer.style.transform = `translateY(${translate}px)`;
            } else if (detailGesture === 'swipe') {
                if (e.cancelable) e.preventDefault();
                const dx = Math.max(0, touch.clientX - detailTouchStartX);
                const progress = Math.min(dx / (window.innerWidth * 0.45), 1);
                const scale = 1 - progress * 0.15;
                const radius = progress * 20;
                this.noteDetailViewer.style.transform = `translateX(${dx}px) scale(${scale})`;
                this.noteDetailViewer.style.borderRadius = `${radius}px`;
            }
        }, { passive: false });

        this.noteDetailViewer.addEventListener('touchend', (e) => {
            if (detailGesture === 'pulldown') {
                const diffY = e.changedTouches[0].clientY - detailTouchStartY;
                this.noteDetailViewer.style.transition = 'transform 0.3s cubic-bezier(0.23, 1, 0.32, 1)';
                if (diffY > 150) {
                    this.closeNoteDetail();
                } else {
                    this.noteDetailViewer.style.transform = 'translateY(0)';
                }
            } else if (detailGesture === 'swipe') {
                const dx = e.changedTouches[0].clientX - detailTouchStartX;
                const progress = dx / (window.innerWidth * 0.45);
                if (progress > 0.35) {
                    this.closeNoteDetailSwipe();
                } else {
                    this.noteDetailViewer.style.transition = 'all 0.3s cubic-bezier(0.23, 1, 0.32, 1)';
                    this.noteDetailViewer.style.transform = '';
                    this.noteDetailViewer.style.borderRadius = '';
                }
            } else {
                this.noteDetailViewer.style.transition = '';
            }
            detailGesture = '';
        }, { passive: true });
        
        // 笔记详情图片滑动切换（跟手拖拽 + 50%阈值吸附 + 速度甩动）
        let noteTouchStartX = 0;
        let noteTouchStartY = 0;
        let noteTouchStartTime = 0;
        let noteGestureLock = '';
        let noteDragging = false;
        this.noteMediaWrapper.addEventListener('touchstart', (e) => {
            noteTouchStartX = e.touches[0].clientX;
            noteTouchStartY = e.touches[0].clientY;
            noteTouchStartTime = Date.now();
            noteGestureLock = '';
            noteDragging = false;
            this.noteMediaWrapper.style.transition = 'none';
        }, { passive: true });
        this.noteMediaWrapper.addEventListener('touchmove', (e) => {
            const touch = e.touches[0];
            const diffX = touch.clientX - noteTouchStartX;
            const diffY = touch.clientY - noteTouchStartY;
            const absX = Math.abs(diffX);
            const absY = Math.abs(diffY);

            if (!noteGestureLock && (absX > 10 || absY > 10)) {
                noteGestureLock = absX > absY ? 'horizontal' : 'vertical';
            }

            if (noteGestureLock === 'horizontal') {
                const atFirst = this.noteMediaIndex === 0;
                const atLast = this.noteMediaIndex === this.noteMediaList.length - 1;
                if ((atFirst && diffX > 0) || (atLast && diffX < 0)) {
                    return;
                }
                if (e.cancelable) e.preventDefault();
                e.stopPropagation();
                noteDragging = true;
                const containerWidth = this.noteMediaWrapper.parentElement.offsetWidth;
                const basePercent = -this.noteMediaIndex * 100;
                const dragPercent = (diffX / containerWidth) * 100;
                this.noteMediaWrapper.style.transform = `translateX(${basePercent + dragPercent}%)`;
            }
        }, { passive: false });
        this.noteMediaWrapper.addEventListener('touchend', (e) => {
            if (noteGestureLock === 'horizontal' && noteDragging) {
                e.stopPropagation();
                const touchEndX = e.changedTouches[0].clientX;
                const diffX = touchEndX - noteTouchStartX;
                const elapsed = Date.now() - noteTouchStartTime;
                const velocity = Math.abs(diffX) / elapsed;
                const containerWidth = this.noteMediaWrapper.parentElement.offsetWidth;
                const threshold = containerWidth * 0.5;
                this.noteMediaWrapper.style.transition = 'transform 0.3s ease';
                const shouldSnap = Math.abs(diffX) > threshold || (velocity > 0.4 && Math.abs(diffX) > 30);
                if (shouldSnap) {
                    if (diffX > 0 && this.noteMediaIndex > 0) {
                        this.noteMediaIndex--;
                    } else if (diffX < 0 && this.noteMediaIndex < this.noteMediaList.length - 1) {
                        this.noteMediaIndex++;
                    }
                }
                this.updateNoteMediaUI();
            }
            noteGestureLock = '';
            noteDragging = false;
        }, { passive: true });
        this.noteMediaWrapper.addEventListener('touchcancel', () => {
            noteGestureLock = '';
            noteDragging = false;
            this.noteMediaWrapper.style.transition = 'transform 0.3s ease';
            this.updateNoteMediaUI();
        }, { passive: true });

        // 键盘支持
        window.addEventListener('keydown', (e) => {
            if (this.fullViewer.style.display === 'flex') {
                if (e.key === 'ArrowLeft') this.prevImage();
                if (e.key === 'ArrowRight') this.nextImage();
                if (e.key === 'Escape') this.closeViewer();
            }
        });

        // 触摸滑动支持
        let touchStartX = 0;
        this.fullViewer.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
        }, { passive: true });
        this.fullViewer.addEventListener('touchend', (e) => {
            const touchEndX = e.changedTouches[0].clientX;
            const diff = touchEndX - touchStartX;
            if (Math.abs(diff) > 50) {
                if (diff > 0) this.prevImage();
                else this.nextImage();
            }
        }, { passive: true });

        this.exportBtn = document.getElementById('exportBtn');
        if (this.exportBtn) {
            this.exportBtn.addEventListener('click', () => this.exportCollections());
        }

        // 搜索与排序
        this.historySearch.addEventListener('input', () => this.debounce(() => this.loadHistory(), 500)());
        this.historySort.addEventListener('change', () => this.loadHistory());
        
        this.collectionSearch.addEventListener('input', () => this.debounce(() => this.loadCollections(), 500)());

        // iOS 剪贴板：Safari 任何 readText() 调用都会弹粘贴确认框
        // 所以 iOS 上完全不做自动检测，只靠手动按钮触发
        // 非 iOS 设备保留自动检测
        if (!this.isIOS()) {
            window.addEventListener('focus', () => this.checkClipboard());
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') this.checkClipboard();
            });
        }

        // 添加一个📋检测剪贴板按钮（iOS 专用手动触发）
        if (this.isIOS()) {
            const pasteBtn = document.createElement('button');
            pasteBtn.className = 'paste-detect-btn';
            pasteBtn.title = '检测剪贴板中的小红书链接';
            pasteBtn.innerHTML = '📋';
            pasteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.checkClipboard(true);
            });
            if (this.urlInput && this.urlInput.parentNode) {
                const wrapper = this.urlInput.parentNode;
                wrapper.style.position = 'relative';
                wrapper.appendChild(pasteBtn);
            }
        }

        // 设置面板事件
        if (this.settingsBtn) {
            this.settingsBtn.onclick = () => this.settingsPanel.style.display = 'flex';
        }
        if (this.closeSettings) {
            this.closeSettings.onclick = () => this.settingsPanel.style.display = 'none';
        }
        if (this.saveSettingsBtn) {
            this.saveSettingsBtn.onclick = () => this.saveSettings();
        }
        // 点击背景关闭设置
        if (this.settingsPanel) {
            this.settingsPanel.onclick = (e) => {
                if (e.target === this.settingsPanel) this.settingsPanel.style.display = 'none';
            };
        }

        // 用户相关事件
        if (this.loginBtn) {
            this.loginBtn.addEventListener('click', () => this.handleLogin());
        }
        if (this.loginNickname) {
            this.loginNickname.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.loginPassword.focus();
            });
        }
        if (this.loginPassword) {
            this.loginPassword.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleLogin();
            });
        }
        if (this.loginPasswordToggle) {
            this.loginPasswordToggle.addEventListener('click', () => {
                const input = this.loginPassword;
                const isPassword = input.type === 'password';
                input.type = isPassword ? 'text' : 'password';
                this.loginPasswordToggle.textContent = isPassword ? '🙈' : '👁️';
            });
        }
        if (this.loginResetBtn) {
            this.loginResetBtn.addEventListener('click', () => this.handleResetPassword());
        }
        if (this.userWidget) {
            this.userWidget.addEventListener('click', () => this.showProfile());
        }
        if (this.profileClose) {
            this.profileClose.addEventListener('click', () => this.hideProfile());
        }
        if (this.profileModal) {
            this.profileModal.addEventListener('click', (e) => {
                if (e.target === this.profileModal) this.hideProfile();
            });
        }
        if (this.profileAvatarBtn) {
            this.profileAvatarBtn.addEventListener('click', () => {
                this.profileAvatarInput.click();
            });
        }
        if (this.profileAvatarInput) {
            this.profileAvatarInput.addEventListener('change', (e) => this.uploadAvatar(e));
        }
        if (this.profileSave) {
            this.profileSave.addEventListener('click', () => this.saveProfile());
        }
        if (this.profileLogout) {
            this.profileLogout.addEventListener('click', () => this.handleLogout());
        }
        if (this.profileThemeDark) {
            this.profileThemeDark.addEventListener('click', () => {
                this.userTheme = 'dark';
                this.profileThemeDark.classList.add('active');
                this.profileThemeLight.classList.remove('active');
                document.documentElement.setAttribute('data-theme', 'dark');
                this.themeToggle.textContent = '🌙';
            });
        }
        if (this.profileThemeLight) {
            this.profileThemeLight.addEventListener('click', () => {
                this.userTheme = 'light';
                this.profileThemeLight.classList.add('active');
                this.profileThemeDark.classList.remove('active');
                document.documentElement.setAttribute('data-theme', 'light');
                this.themeToggle.textContent = '☀️';
            });
        }
    }

    async loadInitialData() {
        this.loadSettings();
        await this.initUser();
        // 默认页面是作品集，执行页面切换逻辑（控制按钮显隐等）
        this.switchPage('history-page');
    }

    loadSettings() {
        const settings = JSON.parse(localStorage.getItem('xhs_settings') || '{}');
        if (this.settingPath) this.settingPath.value = settings.path || '';
        if (this.settingImageFormat) this.settingImageFormat.value = settings.imageFormat || 'webp';
        if (this.settingVideoPref) this.settingVideoPref.value = settings.videoPref || 'resolution';
        if (this.settingProxy) this.settingProxy.value = settings.proxy || '';
        if (this.settingCookie) this.settingCookie.value = settings.cookie || '';
    }

    saveSettings() {
        const settings = {
            path: this.settingPath.value,
            imageFormat: this.settingImageFormat.value,
            videoPref: this.settingVideoPref.value,
            proxy: this.settingProxy.value,
            cookie: this.settingCookie.value
        };
        localStorage.setItem('xhs_settings', JSON.stringify(settings));
        this.settingsPanel.style.display = 'none';
        alert('设置已保存');
    }

    switchPage(targetId) {
        this.navItems.forEach(item => {
            item.classList.toggle('active', item.dataset.target === targetId);
        });
        this.pages.forEach(page => {
            page.classList.toggle('active', page.id === targetId);
        });

        // 作品集搜索/排序显隐控制（底部筛选栏动画）
        const historyControls = document.getElementById('historyControls');
        if (historyControls) {
            if (targetId === 'history-page') {
                setTimeout(() => historyControls.classList.add('visible'), 350);
            } else {
                historyControls.classList.remove('visible');
            }
        }

        // 缩放按钮显隐控制：仅在作品集或收藏页面显示
        if (this.scaleBtn) {
            this.scaleBtn.style.display = (targetId === 'history-page' || targetId === 'collection-page') ? 'flex' : 'none';
        }

        // 编辑模式按钮显隐控制：仅在作品集或收藏页面显示
        if (this.editModeToggle) {
            const isListPage = (targetId === 'history-page' || targetId === 'collection-page');
            this.editModeToggle.style.display = isListPage ? 'flex' : 'none';
            // 离开列表页时，自动关闭编辑模式
            if (!isListPage && this.isListEditMode) {
                this.isListEditMode = false;
                this.editModeToggle.classList.remove('active');
                document.querySelector('.main-content').classList.remove('edit-mode-active');
            }
        }

        if (targetId === 'history-page' && !this._historyLoaded) this.loadHistory();
        if (targetId === 'collection-page' && !this._collectionLoaded) this.loadCollections();
    }

    handleScale(value) {
        const scale = 1 + (value / 100);
        document.documentElement.style.setProperty('--card-scale', scale);
        this.scaleValue.textContent = `${Math.round(scale * 100)}%`;
        
        // 缩放时需要通知所有的滑动实例更新边界，否则滑动会出位
        this.swipeInstances.forEach(instance => {
            if (instance.setupStyles) instance.setupStyles();
            if (instance.updatePositions) instance.updatePositions();
        });
    }

    // 查看器核心方法
    openViewer(images, startIndex = 0) {
        if (!images || images.length === 0) return;
        this.viewerList = images;
        this.viewerIndex = startIndex;
        this.fullViewer.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // 禁止背景滚动
        this.updateViewerImage();
    }

    closeViewer() {
        this.fullViewer.style.display = 'none';
        document.body.style.overflow = '';
    }

    prevImage() {
        if (this.viewerIndex > 0) {
            this.viewerIndex--;
            this.updateViewerImage();
        }
    }

    nextImage() {
        if (this.viewerIndex < this.viewerList.length - 1) {
            this.viewerIndex++;
            this.updateViewerImage();
        }
    }

    updateViewerImage() {
        const url = this.viewerList[this.viewerIndex];
        this.viewerImg.style.opacity = '0';
        this.viewerImg.src = this.getMediaUrl(url);
        this.viewerImg.onload = () => {
            this.viewerImg.style.opacity = '1';
        };
        this.viewerCounter.textContent = `${this.viewerIndex + 1} / ${this.viewerList.length}`;
        
        this.viewerPrev.style.visibility = this.viewerIndex === 0 ? 'hidden' : 'visible';
        this.viewerNext.style.visibility = this.viewerIndex === this.viewerList.length - 1 ? 'hidden' : 'visible';
    }

    // 瀑布流核心方法
    openWaterfall(author, items) {
        this.waterfallTitle.textContent = `${author} 的作品集`;
        this.waterfallContent.innerHTML = '';
        
        const allImages = [];
        items.forEach(item => {
            if (item.data && item.data.images) {
                allImages.push(...item.data.images.map(img => img.url));
            }
        });

        if (allImages.length === 0) return;

        allImages.forEach((url, index) => {
            const div = document.createElement('div');
            div.className = 'waterfall-item';
            div.innerHTML = `<img src="${this.getMediaUrl(url)}" loading="lazy" referrerpolicy="no-referrer">`;
            div.onclick = () => {
                this.openViewer(allImages, index);
            };
            this.waterfallContent.appendChild(div);
        });

        this.waterfallViewer.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    closeWaterfall() {
        this.waterfallViewer.style.display = 'none';
        document.body.style.overflow = '';
    }

    // 笔记详情核心方法
    openNoteDetail(note, sourceEl) {
        if (!note) return;
        this._noteDetailSourceEl = sourceEl || null;

        const viewer = this.noteDetailViewer;
        const coverImg = sourceEl && sourceEl.querySelector('.item-cover img');
        const _expandFromCard = !!coverImg;
        let _coverRect;
        if (_expandFromCard) _coverRect = coverImg.getBoundingClientRect();

        viewer.style.transition = 'none';
        viewer.style.transform = _expandFromCard ? '' : 'translateY(100%)';
        if (_expandFromCard) viewer.style.backgroundColor = 'transparent';
        viewer.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        const _detHeader = viewer.querySelector('.note-detail-header');
        const _detFooter = viewer.querySelector('.note-detail-footer');
        const _detText = viewer.querySelector('.note-text-content');
        const _detDots = this.noteMediaDots;
        const _detCounter = viewer.querySelector('.note-media-counter');
        const _animEls = [_detHeader, _detFooter, _detText, _detDots, _detCounter].filter(Boolean);

        if (_expandFromCard) {
            _animEls.forEach(el => { el.style.opacity = '0'; el.style.transition = 'none'; });
            this.noteMediaWrapper.style.visibility = 'hidden';
        }

        const isMobile = this.isIOS() || this.isAndroid();

        // 渲染作者信息
        this.noteAuthorName.textContent = note.author || '未知作者';
        
        // 使用作者固定头像（该作者第一个作品的封面），缓存避免重复请求
        const authorId = note.authorId || '';
        if (authorId && this._authorAvatarCache[authorId]) {
            this.noteAvatar.src = this.getMediaUrl(this._authorAvatarCache[authorId]);
            this.noteAvatar.setAttribute('referrerpolicy', 'no-referrer');
        } else {
            // 临时用当前封面占位
            const tmpCover = (isMobile && note.raw_cover) ? note.raw_cover : note.cover;
            this.noteAvatar.src = this.getMediaUrl(tmpCover);
            this.noteAvatar.setAttribute('referrerpolicy', 'no-referrer');
            // 异步获取作者第一个作品的封面
            if (authorId) {
                fetch(`/web/api/author/avatar?author_id=${encodeURIComponent(authorId)}&token=${encodeURIComponent(this.token)}`)
                    .then(r => r.json())
                    .then(data => {
                        if (data && data.cover) {
                            this._authorAvatarCache[authorId] = data.cover;
                            this.noteAvatar.src = this.getMediaUrl(data.cover);
                        }
                    })
                    .catch(() => {});
            }
        }
        
        // 原帖链接按钮
        const originalLinkBtn = document.getElementById('noteOriginalLink');
        if (originalLinkBtn) {
            const noteId = note.id;
            const deepLink = `xhsdiscover://item/${noteId}`;
            const webUrl = `https://www.xiaohongshu.com/explore/${noteId}`;
            originalLinkBtn.onclick = (e) => {
                e.stopPropagation();
                const start = Date.now();
                window.location.href = deepLink;
                setTimeout(() => {
                    if (Date.now() - start < 1800) {
                        window.open(webUrl, '_blank');
                    }
                }, 1500);
            };
        }

        // 渲染分享图标
        if (this.noteShareBtn && window.svgIconShare) {
            this.noteShareBtn.innerHTML = window.svgIconShare;
        }
        // 分享按钮：点击复制原文链接
        this.noteShareBtn.onclick = (e) => {
            e.stopPropagation();
            const shareUrl = note.url || note.source_url || '';
            if (shareUrl) {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(shareUrl).then(() => {
                        if (window.showToast) window.showToast('复制成功，快分享给好友吧');
                    }).catch(() => {
                        this._fallbackCopy(shareUrl);
                    });
                } else {
                    this._fallbackCopy(shareUrl);
                }
            } else {
                if (window.showToast) window.showToast('暂无分享链接');
            }
        };
        
        // 渲染媒体内容
        this.noteMediaWrapper.innerHTML = '';
        this.noteMediaDots.innerHTML = '';
        
        let mediaItems = [];
        if (note.images && note.images.length > 0) {
            mediaItems = note.images;
        } else if (note.videos && note.videos.length > 0) {
            mediaItems = note.videos;
        }

        this.noteMediaList = mediaItems.map(item => {
            return (isMobile && item.raw_url) ? item.raw_url : item.url;
        });
        this.noteMediaIndex = 0;
        this.noteMediaWrapper.style.transition = 'none';
        this.noteMediaWrapper.style.transform = 'translateX(0%)';

        mediaItems.forEach((item, i) => {
            const url = (isMobile && item.raw_url) ? item.raw_url : item.url;
            const container = document.createElement('div');
            container.className = 'note-media-item';
            
            const img = document.createElement('img');
            img.setAttribute('referrerpolicy', 'no-referrer');
            img.src = this.getMediaUrl(url);
            
            // 点击图片进入全屏浏览
            img.onclick = () => {
                this.openViewer(this.noteMediaList, i);
            };
            
            container.appendChild(img);

            // Live 图处理
            const liveUrl = isMobile
                ? (item.raw_live_url || item.live_url || item.live_url_cached || '')
                : (item.live_url_cached || item.raw_live_url || item.live_url || '');
            if (liveUrl) {
                // 添加 Live 标识和重播按钮
                const pillGroup = document.createElement('div');
                pillGroup.className = 'live-pill-group';
                container.appendChild(pillGroup);

                const badge = document.createElement('div');
                badge.className = 'live-badge live-pill';
                badge.innerHTML = '<span class="live-icon">◎</span> Live';
                pillGroup.appendChild(badge);

                const replayBtn = document.createElement('div');
                replayBtn.className = 'live-replay-btn live-pill';
                replayBtn.innerHTML = '🔄 重播';
                replayBtn.style.display = 'none'; // 初始隐藏
                pillGroup.appendChild(replayBtn);

                // 创建视频元素（用于播放 Live 动态部分）
                const video = document.createElement('video');
                video.className = 'live-video';
                video.src = this.getVideoUrl(liveUrl);
                
                // 加上保命属性
                video.muted = true;
                video.defaultMuted = true;
                video.playsInline = true;
                video.setAttribute('webkit-playsinline', '');
                video.preload = 'auto';
                video.setAttribute('referrerpolicy', 'no-referrer');
                container.appendChild(video);

                let shouldPlayLive = false;
                let liveReady = false;
                let livePlayWithSound = false;

                const resetLiveState = (showReplay = true) => {
                    shouldPlayLive = false;
                    livePlayWithSound = false;
                    container.classList.remove('playing-live');
                    replayBtn.style.display = showReplay ? 'inline-flex' : 'none';
                    video.pause();
                    video.muted = true;
                    video.volume = 0;
                    try {
                        video.currentTime = 0;
                    } catch (e) {
                        console.log('重置 Live 视频进度失败:', e);
                    }
                };

                const setPlaybackAudioState = (withSound) => {
                    livePlayWithSound = withSound;
                    video.defaultMuted = !withSound;
                    video.muted = !withSound;
                    video.volume = withSound ? 1 : 0;
                    if (withSound) {
                        video.removeAttribute('muted');
                    } else {
                        video.setAttribute('muted', '');
                    }
                };

                const tryStartPlayback = async () => {
                    if (!shouldPlayLive) return;
                    try {
                        video.currentTime = 0;
                    } catch (e) {
                        console.log('设置 Live 视频进度失败:', e);
                    }
                    try {
                        await video.play();
                    } catch (e) {
                        console.log('播放被拦截或失败:', e);
                        resetLiveState(true);
                    }
                };

                const playLiveOnce = (withSound = false, immediate = false) => {
                    shouldPlayLive = true;
                    setPlaybackAudioState(withSound);
                    replayBtn.style.display = 'none';
                    if (immediate) {
                        video.load();
                        tryStartPlayback();
                        return;
                    }
                    if (video.readyState < 2) {
                        liveReady = false;
                        video.load();
                        return;
                    }
                    tryStartPlayback();
                };

                video.addEventListener('loadeddata', () => {
                    liveReady = true;
                    tryStartPlayback();
                });

                video.addEventListener('canplay', () => {
                    liveReady = true;
                    tryStartPlayback();
                });

                video.addEventListener('playing', () => {
                    if (!shouldPlayLive || !liveReady) return;
                    container.classList.add('playing-live');
                });

                video.onended = () => {
                    resetLiveState(true);
                };

                video.onerror = () => {
                    console.log('Live 视频加载失败:', video.currentSrc || liveUrl);
                    resetLiveState(false);
                };

                // 交互：进入该页时自动播放一次
                if (i === this.noteMediaIndex) {
                    setTimeout(() => playLiveOnce(false), 500);
                }

                // 点击重播按钮重新播放
                replayBtn.onclick = (e) => {
                    e.stopPropagation();
                    playLiveOnce(true, true);
                };

                // 长按播放逻辑 (保留并增强)
                let liveTimer = null;
                const startLive = () => {
                    liveTimer = setTimeout(() => playLiveOnce(true, true), 200);
                };
                const stopLive = () => {
                    clearTimeout(liveTimer);
                };

                container.addEventListener('mousedown', startLive);
                container.addEventListener('mouseup', stopLive);
                container.addEventListener('mouseleave', stopLive);
                container.addEventListener('touchstart', startLive, { passive: true });
                container.addEventListener('touchend', stopLive, { passive: true });
            }

            this.noteMediaWrapper.appendChild(container);

            const dot = document.createElement('div');
            dot.className = `media-dot ${i === 0 ? 'active' : ''}`;
            this.noteMediaDots.appendChild(dot);
        });

        this.updateNoteMediaUI();

        // 渲染文本内容
        this.noteDetailTitle.textContent = note.title || '无标题';
        
        // 描述去重：去除 desc 中 #标签 和 [话题] 占位符（tags 会单独用蓝色标签渲染）
        let cleanDesc = note.desc || '';
        // 1. 去掉 [话题]#xxx 或 [话题] 占位符
        cleanDesc = cleanDesc.replace(/\[话题\]\s*/g, '');
        // 2. 去掉 #标签名（蓝色标签已经单独渲染）
        if (note.tags) {
            const tagList = note.tags.split(/[#\s]+/).filter(t => t.trim());
            tagList.forEach(tag => {
                if (tag) {
                    cleanDesc = cleanDesc.replace(new RegExp(`#${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'g'), '');
                }
            });
        }
        // 3. 清理残留的孤立 # 号
        cleanDesc = cleanDesc.replace(/#\s*/g, '');
        this.noteDetailDesc.textContent = cleanDesc.trim();
        
        // 渲染标签
        this.noteDetailTags.innerHTML = '';
        if (note.tags) {
            const tags = note.tags.split(/[#\s]+/).filter(t => t.trim());
            tags.forEach(tag => {
                const span = document.createElement('span');
                span.className = 'note-tag';
                span.textContent = `#${tag}`;
                this.noteDetailTags.appendChild(span);
            });
        }

        this.noteDetailTime.textContent = note.time ? note.time.split(' ')[0] : '-';
        this.noteLikeCount.textContent = this.formatNum(note.likeCount);
        this.noteCollectCount.textContent = this.formatNum(note.collectCount);
        this.noteCommentCount.textContent = this.formatNum(note.commentCount);

        if (_expandFromCard) {
            viewer.offsetHeight;
            const mediaContainer = viewer.querySelector('.note-media-container');
            const targetRect = mediaContainer.getBoundingClientRect();
            const dur = 380;

            const clone = document.createElement('img');
            clone.src = coverImg.src;
            clone.referrerPolicy = 'no-referrer';
            Object.assign(clone.style, {
                position: 'fixed', zIndex: '9999',
                left: _coverRect.left + 'px', top: _coverRect.top + 'px',
                width: _coverRect.width + 'px', height: _coverRect.height + 'px',
                objectFit: 'cover', background: '#1B1B1B',
                borderRadius: '8px', pointerEvents: 'none',
                willChange: 'left, top, width, height',
                transition: `left ${dur}ms cubic-bezier(0.25, 0.1, 0.25, 1), top ${dur}ms cubic-bezier(0.25, 0.1, 0.25, 1), width ${dur}ms cubic-bezier(0.25, 0.1, 0.25, 1), height ${dur}ms cubic-bezier(0.25, 0.1, 0.25, 1), border-radius ${dur}ms ease`,
            });
            document.body.appendChild(clone);

            _detHeader.style.transform = 'translateY(-100%)';
            _detFooter.style.transform = 'translateY(100%)';
            [_detText, _detDots, _detCounter].filter(Boolean).forEach(el => {
                el.style.transform = 'translateY(30px)';
            });

            clone.offsetHeight;

            viewer.style.transition = `background-color ${dur * 0.6}ms ease`;
            viewer.style.backgroundColor = '#1A191F';
            Object.assign(clone.style, {
                left: targetRect.left + 'px', top: targetRect.top + 'px',
                width: targetRect.width + 'px', height: targetRect.height + 'px',
                borderRadius: '0',
            });

            setTimeout(() => {
                _animEls.forEach(el => {
                    el.style.transition = `opacity ${dur * 0.5}ms ease, transform ${dur * 0.5}ms ease`;
                    el.style.opacity = '1';
                    el.style.transform = 'translateY(0)';
                });
            }, dur * 0.25);

            setTimeout(() => {
                this.noteMediaWrapper.style.visibility = '';
                clone.style.transition = 'opacity 120ms ease';
                clone.style.opacity = '0';
                setTimeout(() => {
                    clone.remove();
                    _animEls.forEach(el => {
                        el.style.transition = '';
                        el.style.opacity = '';
                        el.style.transform = '';
                    });
                    viewer.style.transition = '';
                }, 130);
            }, dur);
        } else {
            viewer.offsetHeight;
            viewer.style.transition = 'transform 0.3s cubic-bezier(0.23, 1, 0.32, 1)';
            viewer.style.transform = 'translateY(0)';
        }
    }

    closeNoteDetail() {
        const source = this._noteDetailSourceEl;
        const coverImg = source && source.querySelector('.item-cover img');
        if (coverImg) {
            this.closeNoteDetailSwipe();
        } else {
            this.noteDetailViewer.style.transition = 'transform 0.3s cubic-bezier(0.23, 1, 0.32, 1)';
            this.noteDetailViewer.style.transform = 'translateY(100%)';
            setTimeout(() => {
                this.noteDetailViewer.style.display = 'none';
                this._resetDetailStyles();
            }, 300);
        }
    }

    closeNoteDetailSwipe() {
        const viewer = this.noteDetailViewer;
        const source = this._noteDetailSourceEl;
        const dur = 350;

        const mediaContainer = viewer.querySelector('.note-media-container');
        const coverImg = source && source.querySelector('.item-cover img');

        if (mediaContainer && coverImg) {
            const imgRect = mediaContainer.getBoundingClientRect();
            const targetRect = coverImg.getBoundingClientRect();

            if (imgRect.width < 1 || imgRect.height < 1 || targetRect.width < 1) {
                this._closeDetailFallback(viewer, dur);
                return;
            }

            const clone = document.createElement('img');
            clone.src = coverImg.src;
            clone.referrerPolicy = 'no-referrer';
            Object.assign(clone.style, {
                position: 'fixed', zIndex: '9999',
                left: imgRect.left + 'px', top: imgRect.top + 'px',
                width: imgRect.width + 'px', height: imgRect.height + 'px',
                objectFit: 'cover', background: '#1B1B1B',
                borderRadius: viewer.style.borderRadius || '0',
                pointerEvents: 'none',
                willChange: 'left, top, width, height',
            });
            document.body.appendChild(clone);

            viewer.style.transition = 'none';
            viewer.style.transform = '';
            viewer.style.borderRadius = '';
            viewer.style.backgroundColor = 'transparent';
            mediaContainer.style.opacity = '0';

            const header = viewer.querySelector('.note-detail-header');
            const footer = viewer.querySelector('.note-detail-footer');
            const textContent = viewer.querySelector('.note-text-content');
            const dots = viewer.querySelector('.note-media-dots');
            const counter = viewer.querySelector('.note-media-counter');

            if (header) {
                header.style.transformOrigin = 'top center';
                header.style.transition = `transform ${dur * 0.5}ms ease, opacity ${dur * 0.4}ms ease`;
                header.style.transform = 'scaleY(0)';
                header.style.opacity = '0';
            }
            if (footer) {
                footer.style.transformOrigin = 'bottom center';
                footer.style.transition = `transform ${dur * 0.5}ms ease, opacity ${dur * 0.4}ms ease`;
                footer.style.transform = 'scaleY(0)';
                footer.style.opacity = '0';
            }
            if (textContent) {
                textContent.style.transformOrigin = 'bottom center';
                textContent.style.transition = `transform ${dur * 0.5}ms ease, opacity ${dur * 0.4}ms ease`;
                textContent.style.transform = 'scaleY(0)';
                textContent.style.opacity = '0';
            }
            [dots, counter].filter(Boolean).forEach(el => {
                el.style.transition = `opacity ${dur * 0.3}ms ease`;
                el.style.opacity = '0';
            });

            clone.offsetHeight;
            clone.style.transition = `left ${dur}ms cubic-bezier(0.4, 0, 0.2, 1), top ${dur}ms cubic-bezier(0.4, 0, 0.2, 1), width ${dur}ms cubic-bezier(0.4, 0, 0.2, 1), height ${dur}ms cubic-bezier(0.4, 0, 0.2, 1), border-radius ${dur}ms ease, background ${dur * 0.6}ms ease`;

            Object.assign(clone.style, {
                left: targetRect.left + 'px', top: targetRect.top + 'px',
                width: targetRect.width + 'px', height: targetRect.height + 'px',
                borderRadius: '8px', background: 'transparent',
            });

            const allEls = [header, footer, textContent, dots, counter, mediaContainer].filter(Boolean);
            setTimeout(() => {
                clone.remove();
                viewer.style.display = 'none';
                this._resetDetailStyles();
                allEls.forEach(el => {
                    el.style.transition = ''; el.style.opacity = '';
                    el.style.transform = ''; el.style.transformOrigin = '';
                });
                this.noteMediaWrapper.style.visibility = '';
            }, dur + 20);
        } else {
            this._closeDetailFallback(viewer, dur);
        }
    }

    _closeDetailFallback(viewer, duration) {
        viewer.style.transition = `transform ${duration}ms ease-in-out, opacity ${duration * 0.6}ms ease ${duration * 0.4}ms`;
        viewer.style.transform = 'translateX(100%) scale(0.85)';
        viewer.style.opacity = '0';
        setTimeout(() => {
            viewer.style.display = 'none';
            this._resetDetailStyles();
        }, duration);
    }

    _resetDetailStyles() {
        const viewer = this.noteDetailViewer;
        viewer.style.transform = '';
        viewer.style.borderRadius = '';
        viewer.style.opacity = '';
        viewer.style.transition = '';
        viewer.style.backgroundColor = '';
        document.body.style.overflow = '';
    }

    _fixIOSInputZoom() {
    }

    _initScrollRail() {
        const rail = document.getElementById('scrollRail');
        if (!rail) return;
        const track = rail.querySelector('.scroll-rail-track');
        const thumb = rail.querySelector('.scroll-rail-thumb');
        const scroller = document.querySelector('.main-content');
        if (!track || !thumb || !scroller) return;

        let hideTimer = null;
        let isDragging = false;
        let dragStartY = 0;
        let dragStartThumbTop = 0;
        let isRepositionMode = false;
        let repoStartX = 0;
        let rafId = null;
        let pendingTop = null;
        let lastY = 0;
        let lastTime = 0;
        let velocity = 0;
        let inertiaId = null;
        let lastTapTime = 0;

        const getTrackMetrics = () => {
            const trackH = track.clientHeight;
            const thumbH = thumb.clientHeight;
            return { trackH, thumbH, maxTop: trackH - thumbH };
        };

        const applyPosition = (rawTop) => {
            const { maxTop } = getTrackMetrics();
            const clamped = Math.max(0, Math.min(maxTop, rawTop));
            thumb.style.top = clamped + 'px';
            const { scrollHeight, clientHeight } = scroller;
            scroller.scrollTop = (clamped / maxTop) * (scrollHeight - clientHeight);
            return clamped;
        };

        const showRail = () => {
            rail.classList.add('visible');
            resetHideTimer();
        };

        const hideRail = () => {
            if (!isDragging) rail.classList.remove('visible');
        };

        const resetHideTimer = () => {
            clearTimeout(hideTimer);
            hideTimer = setTimeout(hideRail, 3000);
        };

        const updateThumb = () => {
            const { scrollTop, scrollHeight, clientHeight } = scroller;
            if (scrollHeight <= clientHeight) { rail.classList.remove('visible'); return; }
            const { maxTop } = getTrackMetrics();
            thumb.style.top = (scrollTop / (scrollHeight - clientHeight)) * maxTop + 'px';
        };

        scroller.addEventListener('scroll', () => {
            if (!isDragging) {
                showRail();
                updateThumb();
            }
        }, { passive: true });

        const onTrackDown = (e) => {
            e.stopPropagation();
            if (e.cancelable) e.preventDefault();
            cancelInertia();
            const pt = e.touches ? e.touches[0] : e;
            const now = performance.now();

            if (now - lastTapTime < 400) {
                lastTapTime = 0;
                isRepositionMode = true;
                repoStartX = pt.clientX;
                rail.classList.add('reposition-ready');
                isDragging = true;
                clearTimeout(hideTimer);
                if (navigator.vibrate) navigator.vibrate(20);
                return;
            }
            lastTapTime = now;

            const trackRect = track.getBoundingClientRect();
            const { thumbH, maxTop } = getTrackMetrics();
            const hitTop = Math.max(0, Math.min(maxTop, pt.clientY - trackRect.top - thumbH / 2));
            applyPosition(hitTop);

            isDragging = true;
            rail.classList.add('dragging');
            clearTimeout(hideTimer);
            dragStartY = pt.clientY;
            dragStartThumbTop = hitTop;
            lastY = pt.clientY;
            lastTime = performance.now();
            velocity = 0;
        };

        const onDragMove = (e) => {
            if (!isDragging) return;
            const pt = e.touches ? e.touches[0] : e;

            if (isRepositionMode) return;

            const now = performance.now();
            const dt = now - lastTime;
            if (dt > 0) {
                const instantV = (pt.clientY - lastY) / dt;
                velocity = velocity * 0.65 + instantV * 0.35;
            }
            lastY = pt.clientY;
            lastTime = now;

            pendingTop = dragStartThumbTop + (pt.clientY - dragStartY);
            if (!rafId) {
                rafId = requestAnimationFrame(() => {
                    if (pendingTop !== null) {
                        applyPosition(pendingTop);
                        pendingTop = null;
                    }
                    rafId = null;
                });
            }
        };

        const cancelInertia = () => {
            if (inertiaId) { cancelAnimationFrame(inertiaId); inertiaId = null; }
        };

        const startInertia = () => {
            const { maxTop } = getTrackMetrics();
            let currentTop = parseFloat(thumb.style.top) || 0;
            let v = velocity * 15;
            const friction = 0.93;

            const step = () => {
                v *= friction;
                if (Math.abs(v) < 0.3) {
                    inertiaId = null;
                    resetHideTimer();
                    return;
                }
                currentTop += v;
                currentTop = applyPosition(currentTop);
                inertiaId = requestAnimationFrame(step);
            };
            inertiaId = requestAnimationFrame(step);
        };

        const onDragEnd = (e) => {
            if (!isDragging) return;
            cancelAnimationFrame(rafId);
            rafId = null;

            if (pendingTop !== null) {
                applyPosition(pendingTop);
                pendingTop = null;
            }

            if (isRepositionMode) {
                const pt = e.changedTouches ? e.changedTouches[0] : e;
                const dx = pt.clientX - repoStartX;
                if (Math.abs(dx) > 30) {
                    rail.classList[dx < 0 ? 'add' : 'remove']('left-side');
                }
                isRepositionMode = false;
                rail.classList.remove('reposition-ready');
            }

            isDragging = false;
            rail.classList.remove('dragging');

            if (!isRepositionMode && Math.abs(velocity) > 0.08) {
                startInertia();
            } else {
                resetHideTimer();
            }
        };

        track.addEventListener('touchstart', onTrackDown, { passive: false });
        track.addEventListener('mousedown', onTrackDown);
        window.addEventListener('touchmove', onDragMove, { passive: true });
        window.addEventListener('mousemove', onDragMove);
        window.addEventListener('touchend', onDragEnd, { passive: true });
        window.addEventListener('mouseup', onDragEnd);

        updateThumb();
    }

    prevNoteMedia() {
        if (this.noteMediaIndex > 0) {
            this.noteMediaWrapper.style.transition = 'transform 0.3s ease';
            this.noteMediaIndex--;
            this.updateNoteMediaUI();
        }
    }

    nextNoteMedia() {
        if (this.noteMediaIndex < this.noteMediaList.length - 1) {
            this.noteMediaWrapper.style.transition = 'transform 0.3s ease';
            this.noteMediaIndex++;
            this.updateNoteMediaUI();
        }
    }

    updateNoteMediaUI() {
        this.noteMediaWrapper.style.transform = `translateX(${-this.noteMediaIndex * 100}%)`;

        const mediaItems = this.noteMediaWrapper.querySelectorAll('.note-media-item');
        mediaItems.forEach((item, index) => {
            item.classList.toggle('active', index === this.noteMediaIndex);
            const video = item.querySelector('.live-video');
            const replayBtn = item.querySelector('.live-replay-btn');
            if (index !== this.noteMediaIndex) {
                item.classList.remove('playing-live');
                if (video) {
                    video.pause();
                    try {
                        video.currentTime = 0;
                    } catch (e) {
                        console.log('切换媒体时重置 Live 视频失败:', e);
                    }
                }
                if (replayBtn) replayBtn.style.display = 'none';
                return;
            }

            if (!video) return;
            if (replayBtn && !item.classList.contains('playing-live')) {
                setTimeout(() => {
                    const hidden = replayBtn.style.display === 'none' || replayBtn.style.display === '';
                    if (hidden) {
                        const clickEvent = new MouseEvent('click', { bubbles: true });
                        replayBtn.dispatchEvent(clickEvent);
                    }
                }, 250);
            }
        });

        this.noteMediaCounter.textContent = `${this.noteMediaIndex + 1}/${this.noteMediaList.length}`;
        
        const dots = this.noteMediaDots.querySelectorAll('.media-dot');
        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === this.noteMediaIndex);
        });
    }

    toggleTheme() {
        const isDark = document.body.getAttribute('data-theme') === 'dark';
        const newTheme = isDark ? 'light' : 'dark';
        this.setTheme(newTheme);
        if (this.currentUser && this.token) {
            this.userTheme = newTheme;
            fetch('/web/api/user/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: this.token, theme: newTheme }),
            }).catch(() => {});
        }
    }

    setTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
        const icon = theme === 'dark' ? '☀️' : '🌙';
        this.themeToggle.textContent = icon;
        localStorage.setItem('xhs_theme', theme);
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('xhs_theme') || 'dark';
        this.setTheme(savedTheme);
    }

    detectLinks() {
        const text = this.urlInput.value;
        const regex = /https?:\/\/[^\s)>"']*(?:xiaohongshu|xhslink)\.com[^\s)>"']*/gi;
        const matches = text.match(regex) || [];
        return [...new Set(matches)];
    }

    extractLinkContext(url) {
        const text = this.urlInput.value;
        const lines = text.split('\n');
        for (const line of lines) {
            if (!line.includes(url)) continue;
            let label = line.replace(url, '').trim();
            label = label.replace(/https?:\/\/\S+/g, '').trim();
            label = label.replace(/[😆😊🎉🔥❤️💕✨🌟📕💗🥰😍👏🎁🎀💐⭐️🌈☀️🌸💜💙💚🏠🎊🤩🤗😏🤔🤫🥳😎🫡🫶🙌👍🤭😁😂🤣😅🥺😤😢🥹😃😄😉🤝👋🙏💯🫰🤞✅✌️👌🎶💃🫧⚡️🎵🎤🏆🎯🎬📢🗣️💬💡📌🔔🆘🆕🔥]/gu, '').trim();
            label = label.replace(/发布了一篇小红书笔记，快来看吧！?\s*/g, '').trim();
            label = label.replace(/^\d+\s*/, '').trim();
            if (label && label.length > 1 && label.length < 80) return label;
        }
        return '';
    }

    renderDetectedLinks(links) {
        if (!links || links.length === 0) {
            this.detectedLinksEl.style.display = 'none';
            this.detectedLinksEl.innerHTML = '';
            return;
        }
        this.detectedLinksEl.style.display = 'flex';
        this.detectedLinksEl.innerHTML = links.map((url, i) => {
            const title = this.extractLinkContext(url);
            const shortUrl = url.length > 45 ? url.slice(0, 45) + '...' : url;
            return `<div class="detected-link-item">
                <span class="detected-link-num">${i + 1}</span>
                <div class="detected-link-info">
                    ${title ? `<span class="detected-link-title">${title}</span>` : ''}
                    <span class="detected-link-url" title="${url}">${shortUrl}</span>
                </div>
                <button class="detected-link-del" data-url="${url}">✕</button>
            </div>`;
        }).join('') + `<div class="detected-links-count">检测到 ${links.length} 个链接</div>`;

        this.detectedLinksEl.querySelectorAll('.detected-link-del').forEach(btn => {
            btn.addEventListener('click', () => {
                const urlToRemove = btn.dataset.url;
                const lines = this.urlInput.value.split('\n');
                this.urlInput.value = lines.filter(line => !line.includes(urlToRemove)).join('\n');
                this.detectAndRenderLinks();
            });
        });
    }

    detectAndRenderLinks() {
        this.renderDetectedLinks(this.detectLinks());
    }

    async fetchNote(refresh = false) {
        const links = this.detectLinks();
        const rawText = this.urlInput.value.trim();

        if (!rawText) {
            this.showError('请输入小红书作品链接或作者名');
            return;
        }

        // 检测主页链接
        const profileMatch = rawText.match(/xiaohongshu\.com\/user\/profile\/([a-f0-9]{24})/i);
        if (profileMatch) {
            await this._fetchAuthorNotes(profileMatch[1]);
            return;
        }

        if (links.length > 0) {
            const urlsToFetch = links;
            if (urlsToFetch.length === 1) {
                await this._fetchSingleNote(urlsToFetch[0], refresh);
            } else {
                await this._fetchBatchNotes(urlsToFetch);
            }
        } else if (/https?:\/\/|xiaohongshu\.com|xhslink\.com/i.test(rawText)) {
            await this._fetchSingleNote(rawText, refresh);
        } else {
            await this._fetchByAuthorName(rawText);
        }
    }

    async _fetchByAuthorName(name) {
        this.showLoading();
        try {
            const searchResp = await fetch(`/web/api/author/search?name=${encodeURIComponent(name)}&token=${encodeURIComponent(this.token)}`);
            const rawResult = await searchResp.json();
            const authors = Array.isArray(rawResult) ? rawResult : [];

            if (authors.length === 0) {
                this.showError(`未找到作者「${name}」，请先提取一个该作者的作品`);
                return;
            }

            let selectedAuthor;
            if (authors.length === 1) {
                selectedAuthor = authors[0];
            } else {
                this.hideAll();
                selectedAuthor = await this._showAuthorPicker(authors);
                if (!selectedAuthor) return;
                this.showLoading();
            }

            await this._fetchAuthorNotes(selectedAuthor.author_id);
        } catch (err) {
            this.showError(err.message || '作者搜索失败');
        }
    }

    async _fetchAuthorNotes(authorId) {
        this.showLoading();
        try {
            const settings = JSON.parse(localStorage.getItem('xhs_settings') || '{}');
            const cookie = settings.cookie || '';
            const proxy = settings.proxy || '';
            const notesResp = await fetch(`/web/api/author/notes?author_id=${encodeURIComponent(authorId)}&cookie=${encodeURIComponent(cookie)}&proxy=${encodeURIComponent(proxy)}&token=${encodeURIComponent(this.token)}`);

            if (!notesResp.ok) {
                const err = await notesResp.json();
                this.showError(err.error || '获取作者作品列表失败');
                return;
            }

            const notesData = await notesResp.json();
            this.hideAll();

            if (notesData.urls.length === 0) {
                const msg = notesData.total > 0
                    ? `「${notesData.author_name}」主页共 ${notesData.total} 个作品，全部已在本地`
                    : `「${notesData.author_name}」主页未找到作品`;
                if (window.showToast) window.showToast(msg);
                return;
            }

            if (window.showToast) {
                window.showToast(`找到 ${notesData.author_name} 的 ${notesData.total} 个作品，${notesData.new_count} 个为新作品，开始抓取...`);
            }
            await this._fetchBatchNotes(notesData.urls);
        } catch (err) {
            this.showError(err.message || '获取作者作品失败');
        }
    }

    _showAuthorPicker(authors) {
        return new Promise((resolve) => {
            const container = this.detectedLinksEl;
            container.style.display = 'block';
            container.innerHTML = '';

            const title = document.createElement('div');
            title.className = 'detected-links-header';
            title.textContent = `找到 ${authors.length} 位匹配的作者，请选择：`;
            title.style.cssText = 'padding: 1.5vh 2vw; font-weight: 600; font-size: 1.5vh;';
            container.appendChild(title);

            authors.forEach(author => {
                const item = document.createElement('div');
                item.className = 'detected-link-item';
                item.style.cursor = 'pointer';
                item.innerHTML = `
                    <span style="flex:1">👤 ${author.author_name}</span>
                    <span style="color:var(--text-muted); font-size:1.3vh">${author.count} 个作品</span>
                `;
                item.onclick = () => {
                    container.style.display = 'none';
                    resolve(author);
                };
                container.appendChild(item);
            });

            const cancelBtn = document.createElement('div');
            cancelBtn.className = 'detected-link-item';
            cancelBtn.style.cssText = 'cursor:pointer; justify-content:center; color:var(--text-muted);';
            cancelBtn.textContent = '取消';
            cancelBtn.onclick = () => {
                container.style.display = 'none';
                resolve(null);
            };
            container.appendChild(cancelBtn);
        });
    }

    async _fetchSingleNote(url, refresh = false) {
        this.showLoading();
        try {
            const data = await this._callNoteApi(url, refresh);
            this.currentNote = data;
            this.displayResult(data);
            this.refreshBtn.style.display = 'flex';
            this._historyLoaded = false;
        } catch (err) {
            this.showError(err.message || '获取失败，请检查链接或 Cookie');
        }
    }

    async _fetchBatchNotes(urls) {
        this.hideAll();
        const total = urls.length;
        let success = 0;
        let failed = 0;

        const savedWaveHtml = this.loading.innerHTML;
        this.loading.style.display = 'flex';
        this.loading.innerHTML = `<div class="batch-progress">
            <div class="batch-progress-text">正在批量获取 0/${total}...</div>
            <div class="batch-progress-bar"><div class="batch-progress-fill" style="width:0%"></div></div>
            <div class="batch-progress-detail">准备中...</div>
        </div>`;

        const progressText = this.loading.querySelector('.batch-progress-text');
        const progressFill = this.loading.querySelector('.batch-progress-fill');
        const progressDetail = this.loading.querySelector('.batch-progress-detail');

        for (let i = 0; i < total; i++) {
            const url = urls[i];
            const current = i + 1;
            progressText.textContent = `正在批量获取 ${current}/${total}...`;
            progressFill.style.width = `${(current / total) * 100}%`;
            const shortUrl = url.length > 40 ? url.slice(0, 40) + '...' : url;
            progressDetail.textContent = shortUrl;

            try {
                await this._callNoteApi(url, false);
                success++;
            } catch (err) {
                failed++;
                console.log(`批量获取失败 [${current}/${total}]:`, err.message);
            }
        }

        this.loading.style.display = 'none';
        this.loading.innerHTML = savedWaveHtml;
        this.urlInput.value = '';
        this.renderDetectedLinks([]);

        this._historyLoaded = false;
        const msg = failed > 0
            ? `批量获取完成：成功 ${success} 个，失败 ${failed} 个`
            : `成功获取 ${success} 个作品`;
        if (window.showToast) window.showToast(msg);
    }

    async _callNoteApi(url, refresh) {
        const settings = JSON.parse(localStorage.getItem('xhs_settings') || '{}');
        const cookie = settings.cookie || '';
        const imageFormat = settings.imageFormat || 'webp';
        const videoPref = settings.videoPref || 'resolution';
        const proxy = settings.proxy || '';

        const apiUrl = `/web/api/note?url=${encodeURIComponent(url)}&cookie=${encodeURIComponent(cookie)}&refresh=${refresh}&image_format=${imageFormat}&video_preference=${videoPref}&proxy=${encodeURIComponent(proxy)}&token=${encodeURIComponent(this.token)}`;
        const resp = await fetch(apiUrl);
        if (!resp.ok) throw new Error(await resp.text());
        return await resp.json();
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
        const coverUrl = this.getMediaUrl(data.cover);
        
        // 强制设置 no-referrer 以绕开 cpolar
        cover.setAttribute('referrerpolicy', 'no-referrer');
        cover.src = coverUrl;
        
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

    toggleEditMode() {
        this.isEditMode = !this.isEditMode;
        this.editModeBtn.classList.toggle('active', this.isEditMode);
        this.previewSection.classList.toggle('edit-active', this.isEditMode);
        this.editModeBtn.textContent = this.isEditMode ? '✅ 完成编辑' : '✏️ 编辑模式';
    }

    renderPreviewList(data) {
        const container = document.getElementById('previewList');
        container.innerHTML = '';
        
        const media = data.images.length > 0 ? data.images : data.videos;
        if (!media.length) return;

        const isMobile = this.isIOS() || this.isAndroid();

        media.forEach((item, i) => {
            const div = document.createElement('div');
            div.className = 'preview-item';
            
            // 如果是移动端，优先使用原始 URL (item.raw_url 或 item.url 只要不是 /web/cache 开头的)
            let displayUrl = item.url;
            if (isMobile && item.raw_url) {
                displayUrl = item.raw_url;
            }

            const url = this.getMediaUrl(displayUrl);
            
            // 1. 手动创建 img 元素，确保兼容性并强制绕开 cpolar
            const img = document.createElement('img');
            img.setAttribute('loading', 'lazy');
            img.setAttribute('referrerpolicy', 'no-referrer'); // 强制设置 no-referrer 绕过防盗链
            img.src = url; // 最后再赋值 src 触发加载

            // 2. 设置按钮和其他结构
            div.innerHTML = `
                <div class="preview-actions">
                    <button class="action-icon-btn set-cover-btn" title="设为封面">🖼️</button>
                    <button class="action-icon-btn delete-media-btn" title="永久删除">🗑️</button>
                </div>
            `;

            // 如果是 Live 图，在预览列表也显示标识
            const liveUrl = (isMobile && item.live_url) ? item.live_url : item.live_url_cached;
            if (liveUrl) {
                const liveBadge = document.createElement('div');
                liveBadge.className = 'live-badge';
                liveBadge.style.transform = 'scale(0.8)';
                liveBadge.style.top = '0.5vh';
                liveBadge.style.left = '0.5vh';
                liveBadge.innerHTML = '<span class="live-icon">◎</span> Live';
                div.appendChild(liveBadge);
            }

            div.prepend(img); // 把图片插到按钮前面
            
            // 设为封面逻辑
            const setCoverBtn = div.querySelector('.set-cover-btn');
            setCoverBtn.onclick = (e) => {
                e.stopPropagation();
                this.setAsCover(item.url);
            };
            
            // 删除媒体逻辑
            const deleteBtn = div.querySelector('.delete-media-btn');
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                this.deleteMedia(item.url);
            };

            div.onclick = () => {
                if (!this.isEditMode) {
                    const allUrls = media.map(m => m.url);
                    this.openViewer(allUrls, i);
                }
            };
            container.appendChild(div);
        });

        this.downloadAllBtn.style.display = data.images.length > 0 ? 'block' : 'none';
    }

    async setAsCover(url) {
        if (!this.currentNote) return;
        this.currentNote.cover = url;
        await this.updateNoteData();
        this.displayResult(this.currentNote);
    }

    async deleteMedia(url) {
        if (!this.currentNote) return; 
        try {
            // 1. 先尝试从后端物理删除文件
            await fetch(`/web/api/cache?url=${encodeURIComponent(url)}`, { method: 'DELETE' });

            // 2. 从内存数据中精准移除
            if (this.currentNote.images) {
                this.currentNote.images = this.currentNote.images.filter(img => img.url !== url);
            }
            if (this.currentNote.videos) {
                this.currentNote.videos = this.currentNote.videos.filter(vid => vid.url !== url);
            }
            
            // 3. 处理封面变动
            let coverChanged = false;
            if (this.currentNote.cover === url) {
                const nextMedia = (this.currentNote.images && this.currentNote.images[0]) || 
                                (this.currentNote.videos && this.currentNote.videos[0]);
                this.currentNote.cover = nextMedia ? nextMedia.url : '';
                coverChanged = true;
            }
            
            // 4. 同步到数据库记录
            await this.updateNoteData();
            
            // 5. 局部刷新 UI，消除闪烁
            if (coverChanged) {
                const coverImg = document.getElementById('coverImg');
                if (coverImg) coverImg.src = this.getMediaUrl(this.currentNote.cover);
            }
            this.renderPreviewList(this.currentNote);
            
        } catch (err) {
            console.error('删除媒体失败:', err);
            alert('删除失败，请稍后重试');
        }
    }

    async updateNoteData() {
        try {
            await fetch('/web/api/note/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    note_id: this.currentNote.id,
                    data: this.currentNote
                })
            });
        } catch (e) {
            console.error('更新作品数据失败', e);
        }
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
            this._collectionLoaded = false;
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
            const resp = await fetch(`/web/api/history?search=${encodeURIComponent(search)}&sort=${sort}&token=${encodeURIComponent(this.token)}`);
            const data = await resp.json();
            this.renderDataList(this.historyList, data, sort);
            this._historyLoaded = true;
        } catch (e) {
            console.error('加载历史失败', e);
        }
    }

    async loadCollections() {
        const search = this.collectionSearch.value;
        try {
            const resp = await fetch(`/web/api/collection?search=${encodeURIComponent(search)}&token=${encodeURIComponent(this.token)}`);
            const data = await resp.json();
            this.renderDataList(this.collectionList, data);
            this._collectionLoaded = true;
        } catch (e) {
            console.error('加载收藏失败', e);
        }
    }

    renderDataList(container, items, sort = '') {
        container.innerHTML = '';
        this.swipeInstances = []; // 重新渲染时清空滑动实例记录
        if (!items.length) {
            container.innerHTML = '<div class="empty-tip">暂无数据</div>';
            return;
        }

        // 按作者分组
        const groups = {};
        items.forEach(item => {
            const author = (item.data && item.data.author) || '未知作者';
            if (!groups[author]) groups[author] = [];
            groups[author].push(item);
        });

        const sortedAuthors = Object.keys(groups);
        if (sort === 'count_desc') {
            sortedAuthors.sort((a, b) => groups[b].length - groups[a].length);
        } else if (sort === 'count_asc') {
            sortedAuthors.sort((a, b) => groups[a].length - groups[b].length);
        } else {
            sortedAuthors.sort();
        }

        sortedAuthors.forEach(author => {
            try {
                const authorItems = groups[author];
                if (!authorItems || authorItems.length === 0) return;

                const row = document.createElement('div');
                row.className = 'author-row';
                
                // 作者信息头部
                const header = document.createElement('div');
                header.className = 'author-info-header';
                const authorId = authorItems[0]?.data?.authorId || '';
                header.innerHTML = `
                    <div class="author-name-tag">
                        <img class="author-avatar" src="" data-author-id="${authorId}" referrerpolicy="no-referrer">
                        <span class="author-name-text">${author}</span>
                        <button class="panorama-btn" title="查看该作者全景图集">🖼️ 全景视图</button>
                        <button class="waterfall-btn" title="查看该作者瀑布流图集">🧱 瀑布视图</button>
                        <button class="mode-toggle-btn" title="切换作品展示模式" data-mode="scroll">📐 横排</button>
                    </div>
                    <div class="author-work-count">${authorItems.length} 个作品</div>
                `;
                row.appendChild(header);

                // 加载作者头像
                const avatarImg = header.querySelector('.author-avatar');
                if (authorId) {
                    if (this._authorAvatarCache && this._authorAvatarCache[authorId]) {
                        avatarImg.src = this.getMediaUrl(this._authorAvatarCache[authorId]);
                    } else {
                        fetch(`/web/api/author/avatar?author_id=${encodeURIComponent(authorId)}&token=${encodeURIComponent(this.token)}`)
                            .then(r => r.json())
                            .then(data => {
                                if (data && data.cover) {
                                    if (!this._authorAvatarCache) this._authorAvatarCache = {};
                                    this._authorAvatarCache[authorId] = data.cover;
                                    avatarImg.src = this.getMediaUrl(data.cover);
                                }
                            })
                            .catch(() => {});
                    }
                }

                // 点击头像/作者名 → 打开作者主页
                const openProfile = () => {
                    if (window.AuthorProfile && authorId) {
                        window.AuthorProfile.open(authorId, author, this);
                    }
                };
                avatarImg.onclick = (e) => { e.stopPropagation(); openProfile(); };
                header.querySelector('.author-name-text').onclick = (e) => { e.stopPropagation(); openProfile(); };

                // 按钮逻辑
                header.querySelector('.panorama-btn').onclick = (e) => {
                    e.stopPropagation();
                    const allImages = [];
                    authorItems.forEach(item => {
                        if (item.data && item.data.images) {
                            allImages.push(...item.data.images.map(img => img.url));
                        }
                    });
                    this.openViewer(allImages);
                };

                header.querySelector('.waterfall-btn').onclick = (e) => {
                    e.stopPropagation();
                    this.openWaterfall(author, authorItems);
                };

                // 滑动视口
                const viewport = document.createElement('div');
                viewport.className = 'cards-viewport';
                
                const wrapper = document.createElement('div');
                wrapper.className = 'cards-wrapper';

                // 模式切换状态
                let currentMode = 'scroll';
                const modeLabels = { scroll: '📐 横排', wrap: '📦 换行' };
                const modeToggleBtn = header.querySelector('.mode-toggle-btn');

                modeToggleBtn.onclick = (e) => {
                    e.stopPropagation();
                    currentMode = currentMode === 'scroll' ? 'wrap' : 'scroll';
                    modeToggleBtn.textContent = modeLabels[currentMode];
                    modeToggleBtn.dataset.mode = currentMode;
                    this._applyCardMode(viewport, wrapper, currentMode, row, authorItems);
                };

                authorItems.forEach(item => {
                    const note = item.data;
                    if (!note) return; // 跳过空数据

                    const card = document.createElement('div');
                    card.className = 'list-item';
                    card.innerHTML = `
                        <div class="item-cover">
                            <img src="${this.getMediaUrl(note.cover)}" loading="lazy" referrerpolicy="no-referrer">
                            <button class="delete-item-btn" title="删除记录">✕</button>
                            ${item.is_starred ? '<div class="item-star-badge">❤️</div>' : ''}
                        </div>
                        <div class="item-info">
                            <div class="item-title">${note.title || '无标题'}</div>
                            <div class="item-meta">
                                <span>📅 ${note.time ? note.time.split(' ')[0] : '-'}</span>
                                <span>❤️ ${this.formatNum(note.likeCount)}</span>
                            </div>
                        </div>
                    `;
                    
                    // 删除逻辑
                    const deleteBtn = card.querySelector('.delete-item-btn');
                    deleteBtn.onclick = async (e) => {
                        e.stopPropagation();
                        const title = note.title || '无标题';
                        if (!confirm(`确定要删除作品「${title}」吗？\n此操作不可恢复。`)) return;
                        try {
                            const resp = await fetch(`/web/api/history/${note.id}`, { method: 'DELETE' });
                            if (resp.ok) {
                                card.remove();
                                if (wrapper.children.length === 0) row.remove();
                            }
                        } catch (err) {
                            alert('删除失败');
                        }
                    };

                    wrapper.appendChild(card);

                    // 交互逻辑：短按详情，长按(0.5s)提取，增加滑动误触判断
                    let pressTimer = null;
                    let isLongPress = false;
                    let startX, startY;
                    let isMoving = false;

                    const startPress = (e) => {
                        // 编辑模式下禁用所有卡片交互
                        if (this.isListEditMode) return;
                        
                        const touch = e.touches ? e.touches[0] : e;
                        startX = touch.clientX;
                        startY = touch.clientY;
                        isMoving = false;
                        isLongPress = false;
                        
                        card.classList.add('charging');
                        pressTimer = setTimeout(() => {
                            if (!isMoving) {
                                isLongPress = true;
                                // 触发提取逻辑
                                this.currentNote = note;
                                if (note.url) {
                                    this.urlInput.value = note.url;
                                    this.refreshBtn.style.display = 'flex';
                                }
                                this.switchPage('extract-page');
                                this.displayResult(note);
                                this.updateStarBtn(item.is_starred);
                                card.classList.remove('charging');
                            }
                        }, 500);
                    };

                    const movePress = (e) => {
                        if (this.isListEditMode) return;
                        const touch = e.touches ? e.touches[0] : e;
                        const deltaX = Math.abs(touch.clientX - startX);
                        const deltaY = Math.abs(touch.clientY - startY);
                        
                        // 如果位移超过 10px，判定为滑动，取消点击/长按逻辑
                        if (deltaX > 10 || deltaY > 10) {
                            isMoving = true;
                            clearTimeout(pressTimer);
                            card.classList.remove('charging');
                        }
                    };

                    const cancelPress = () => {
                        if (this.isListEditMode) return;
                        clearTimeout(pressTimer);
                        card.classList.remove('charging');
                    };

                    const endPress = (e) => {
                        clearTimeout(pressTimer);
                        card.classList.remove('charging');
                        // 编辑模式下不打开详情
                        if (this.isListEditMode) return;
                        if (!isLongPress && !isMoving) {
                            // 既不是长按也不是滑动，才是短按详情
                            this.openNoteDetail(note, card);
                        }
                    };

                    // 适配鼠标和触摸
                    card.addEventListener('mousedown', startPress);
                    card.addEventListener('mousemove', movePress);
                    card.addEventListener('mouseup', endPress);
                    card.addEventListener('mouseleave', cancelPress);

                    card.addEventListener('touchstart', startPress, { passive: true });
                    card.addEventListener('touchmove', movePress, { passive: true });
                    card.addEventListener('touchend', endPress, { passive: true });
                    card.addEventListener('touchcancel', cancelPress, { passive: true });
                });

                viewport.appendChild(wrapper);
                row.appendChild(viewport);
                container.appendChild(row);

                // 初始化堆叠滑动
                let swipeInstance = null;
                if (window.StackSwipe) {
                    swipeInstance = new StackSwipe(viewport);
                    this.swipeInstances.push(swipeInstance);
                }

                // 保存 swipe 实例引用，供模式切换时销毁
                viewport._swipeInstance = swipeInstance;
            } catch (err) {
                console.error(`渲染作者 ${author} 的作品失败:`, err);
            }
        });
    }

    _applyCardMode(viewport, wrapper, mode, row, authorItems) {
        // 销毁 swipe 实例
        if (viewport._swipeInstance) {
            const idx = this.swipeInstances.indexOf(viewport._swipeInstance);
            if (idx > -1) this.swipeInstances.splice(idx, 1);
            viewport._swipeInstance = null;
        }

        // 清除所有模式类和内联样式，回到 base
        viewport.classList.remove('cards-viewport--wrap');
        wrapper.classList.remove('cards-wrapper--wrap');

        const cards = wrapper.querySelectorAll('.list-item');
        cards.forEach(c => {
            c.style.transform = '';
            c.style.position = '';
            c.style.left = '';
            c.style.top = '';
            c.style.zIndex = '';
            c.style.transition = '';
            c.style.opacity = '';
        });

        // 移除 viewport 和 wrapper 上所有可能的内联样式
        const vpProps = ['height','overflowX','overflowY','cursor','touchAction','userSelect'];
        const wrProps = ['display','flexWrap','justifyContent','alignItems','paddingBottom','height','width'];
        vpProps.forEach(p => viewport.style[p] = '');
        wrProps.forEach(p => wrapper.style[p] = '');
        row.style.height = '';

        if (mode === 'scroll') {
            // 恢复横排滚动模式 — 依赖 base CSS
            if (window.StackSwipe) {
                const swipe = new StackSwipe(viewport);
                this.swipeInstances.push(swipe);
                viewport._swipeInstance = swipe;
            }
        } else if (mode === 'wrap') {
            viewport.classList.add('cards-viewport--wrap');
            wrapper.classList.add('cards-wrapper--wrap');
        }
    }

    // ---- 用户管理 ----

    async initUser() {
        if (this.token) {
            try {
                const resp = await fetch(`/web/api/user/profile?token=${encodeURIComponent(this.token)}`);
                if (resp.ok) {
                    const user = await resp.json();
                    this.currentUser = user;
                    this.userTheme = user.theme || 'dark';
                    this.applyUserTheme();
                    this.showUserWidget(user);
                    return;
                }
            } catch (e) {
                console.warn('Token 验证失败，重新登录');
            }
            localStorage.removeItem('xhs_token');
            this.token = '';
        }
        this.showLogin();
    }

    showLogin() {
        if (this.loginModal) {
            this.loginModal.style.display = 'flex';
            this.loginNickname.value = '';
            this.loginPassword.value = '';
            if (this.loginError) this.loginError.style.display = 'none';
            this.loginPassword.type = 'password';
            if (this.loginPasswordToggle) this.loginPasswordToggle.textContent = '👁️';
            this.loginBtn.textContent = '登录';
            this.loginBtn.disabled = false;
            this.loginNickname.focus();
        }
    }

    async handleLogin() {
        const nickname = this.loginNickname.value.trim();
        const password = this.loginPassword ? this.loginPassword.value.trim() : '';

        if (!nickname) {
            this.loginNickname.focus();
            this.loginNickname.style.borderColor = '#ff4757';
            setTimeout(() => { this.loginNickname.style.borderColor = ''; }, 2000);
            return;
        }
        if (!password) {
            this.loginPassword.focus();
            this.loginPassword.style.borderColor = '#ff4757';
            setTimeout(() => { this.loginPassword.style.borderColor = ''; }, 2000);
            return;
        }

        this.loginBtn.textContent = '登录中...';
        this.loginBtn.disabled = true;
        if (this.loginError) this.loginError.style.display = 'none';

        try {
            const resp = await fetch('/web/api/user/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nickname, password }),
            });
            if (!resp.ok) {
                const errData = await resp.json();
                throw new Error(errData.error || '登录失败');
            }
            const user = await resp.json();
            this.currentUser = user;
            this.token = user.token;
            this.userTheme = user.theme || 'dark';
            localStorage.setItem('xhs_token', user.token);
            this.applyUserTheme();
            this.showUserWidget(user);
            this.loginModal.style.display = 'none';
            // 登录后自动跳转到作品集并加载数据
            this.switchPage('history-page');
        } catch (e) {
            if (this.loginError) {
                this.loginError.textContent = e.message;
                this.loginError.style.display = 'block';
            } else {
                alert('登录失败: ' + e.message);
            }
        } finally {
            this.loginBtn.textContent = '登录';
            this.loginBtn.disabled = false;
        }
    }

    async handleResetPassword() {
        const nickname = this.loginNickname.value.trim();
        if (!nickname) {
            this.loginNickname.focus();
            this.loginNickname.style.borderColor = '#ff4757';
            setTimeout(() => { this.loginNickname.style.borderColor = ''; }, 2000);
            return;
        }
        if (!confirm(`确定要重置用户「${nickname}」的密码吗？\n重置后可以用任意密码登录。`)) return;

        this.loginResetBtn.textContent = '重置中...';
        this.loginResetBtn.disabled = true;

        try {
            const resp = await fetch('/web/api/user/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nickname }),
            });
            if (!resp.ok) {
                const errData = await resp.json();
                throw new Error(errData.error || '重置失败');
            }
            if (this.loginError) {
                this.loginError.textContent = '✅ 密码已重置，输入任意密码即可登录';
                this.loginError.style.display = 'block';
                this.loginError.style.color = '#2ed573';
                this.loginError.style.background = 'rgba(46, 213, 115, 0.1)';
            }
            this.loginPassword.value = '';
            this.loginPassword.focus();
        } catch (e) {
            if (this.loginError) {
                this.loginError.textContent = e.message;
                this.loginError.style.display = 'block';
                this.loginError.style.color = '#ff4757';
                this.loginError.style.background = 'rgba(255, 71, 87, 0.1)';
            } else {
                alert('重置失败: ' + e.message);
            }
        } finally {
            this.loginResetBtn.textContent = '忘记密码？重置';
            this.loginResetBtn.disabled = false;
        }
    }

    showUserWidget(user) {
        if (!this.userWidget) return;
        this.userWidget.style.display = 'flex';
        if (user.avatar_url) {
            this.userAvatar.src = user.avatar_url;
            this.userAvatar.style.display = 'block';
            this.userAvatar.onerror = () => {
                this.userAvatar.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="%23333"/></svg>';
            };
        } else {
            this.userAvatar.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="%23eee"/></svg>';
            this.userAvatar.style.display = 'block';
        }
        this.userNickname.textContent = user.nickname || '用户';
    }

    showProfile() {
        if (!this.profileModal || !this.currentUser) return;
        this.profileModal.style.display = 'flex';
        this.profileNickname.value = this.currentUser.nickname || '';
        if (this.currentUser.avatar_url) {
            this.profileAvatar.src = this.currentUser.avatar_url;
        } else {
            this.profileAvatar.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect fill="%23333" width="80" height="80" rx="40"/><text fill="%23fff" font-size="36" x="50%" y="50%" text-anchor="middle" dy=".35em">👤</text></svg>';
        }

        const theme = this.currentUser.theme || 'dark';
        if (theme === 'light') {
            this.profileThemeLight.classList.add('active');
            this.profileThemeDark.classList.remove('active');
        } else {
            this.profileThemeDark.classList.add('active');
            this.profileThemeLight.classList.remove('active');
        }
        this.userTheme = theme;
    }

    hideProfile() {
        if (this.profileModal) this.profileModal.style.display = 'none';
    }

    async saveProfile() {
        const nickname = this.profileNickname.value.trim();
        if (!nickname) return;

        try {
            const resp = await fetch('/web/api/user/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: this.token,
                    nickname,
                    theme: this.userTheme,
                }),
            });
            if (!resp.ok) throw new Error('保存失败');
            this.currentUser.nickname = nickname;
            this.currentUser.theme = this.userTheme;
            this.showUserWidget(this.currentUser);
            this.hideProfile();
        } catch (e) {
            alert('保存失败: ' + e.message);
        }
    }

    handleLogout() {
        if (!confirm('确定要退出登录吗？')) return;
        localStorage.removeItem('xhs_token');
        this.token = '';
        this.currentUser = null;
        this.hideProfile();
        if (this.userWidget) this.userWidget.style.display = 'none';
        this.showLogin();
    }

    async uploadAvatar(e) {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('token', this.token);
        formData.append('file', file);

        try {
            const resp = await fetch('/web/api/user/avatar', {
                method: 'POST',
                body: formData,
            });
            if (!resp.ok) throw new Error('上传失败');
            const data = await resp.json();
            this.currentUser.avatar_url = data.avatar_url;
            this.profileAvatar.src = data.avatar_url;
            this.showUserWidget(this.currentUser);
        } catch (e) {
            alert('头像上传失败: ' + e.message);
        }
    }

    applyUserTheme() {
        if (this.userTheme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
            this.themeToggle.textContent = '☀️';
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            this.themeToggle.textContent = '🌙';
        }
    }

    getMediaUrl(url) {
        if (!url) return this.getPlaceholder();

        if (typeof url === 'string' && url.includes('xhscdn.com') && url.startsWith('http://')) {
            url = `https://${url.slice('http://'.length)}`;
        }
        
        // 如果是移动端访问，强制不走缓存（不走 cpolar），直接走原始 URL 并配合 no-referrer
        if (this.isIOS() || this.isAndroid()) {
            // 如果已经是缓存路径，说明原始 URL 可能丢失，但通常 data 里会带原始 url
            // 这里我们优先返回原始 URL
            if (url.startsWith('/web/cache')) {
                // 如果是缓存路径且我们无法找回原始 URL，则只能走缓存
                return url;
            }
            return url;
        }

        if (url.startsWith('/web/cache')) return url;
        return `/web/api/proxy?url=${encodeURIComponent(url)}`;
    }

    getVideoUrl(url) {
        if (!url) return '';

        if (typeof url === 'string' && url.includes('xhscdn.com') && url.startsWith('http://')) {
            url = `https://${url.slice('http://'.length)}`;
        }

        // Live 视频不走图片代理；本地缓存直接用缓存路径，远程地址直接直连
        if (url.startsWith('/web/cache')) return url;
        return url;
    }

    _fallbackCopy(text) {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            if (window.showToast) window.showToast('复制成功，快分享给好友吧');
        } catch (e) {
            if (window.showToast) window.showToast('复制失败，请手动复制');
        }
    }

    isAndroid() {
        return /Android/i.test(navigator.userAgent);
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

    showLoading() {
        if (this.loading) {
            // 确保每次显示前都有波浪 HTML（防止被意外清空）
            if (this.loading.innerHTML.trim() === '' && window.generateLoadingWave) {
                this.loading.innerHTML = window.generateLoadingWave();
            }
            this.loading.style.display = 'flex';
        }
        this.result.style.display = 'none';
        this.error.style.display = 'none';
    }

    hideAll() {
        if (this.loading) this.loading.style.display = 'none';
        if (this.result) this.result.style.display = 'none';
        if (this.error) this.error.style.display = 'none';
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

    isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    // 剪贴板检测核心逻辑
    async checkClipboard(isGesture = false) {
        try {
            // 如果不在提取页面，不执行自动填装
            const extractPage = document.getElementById('extract-page');
            if (!extractPage || !extractPage.classList.contains('active')) return;

            // iOS 冷却：如果上次检测失败了，5 秒内不再重复弹窗
            if (this.isIOS() && this._clipboardCooldown && Date.now() - this._clipboardCooldown < 5000) {
                return;
            }

            // 检查环境支持
            if (!navigator.clipboard || !navigator.clipboard.readText) {
                if (isGesture) console.log('当前环境（可能是非 HTTPS）不支持剪贴板访问');
                return;
            }

            // iOS Safari 限制：必须在用户手势（如点击）的任务周期内才能读取
            // 如果不是由点击触发，且是 iOS，则跳过
            if (this.isIOS() && !isGesture) return;

            const text = await navigator.clipboard.readText();
            if (!text || text === this.lastClipboardContent) return;

            // 检测是否包含小红书链接标识
            if (text.includes('xiaohongshu.com') || text.includes('xhslink.com')) {
                this.lastClipboardContent = text;
                await this.autoTypeEffect(text);
            }
        } catch (err) {
            // iOS 权限拒绝时设置冷却，避免频繁弹窗
            if (this.isIOS()) {
                this._clipboardCooldown = Date.now();
            }
            if (isGesture) console.log('剪贴板访问受限:', err);
        }
    }

    // 打字机式删除与输入动画
    async autoTypeEffect(newContent) {
        const input = this.urlInput;
        const speed = 10; // 动画速度（毫秒/字符）

        // 第一步：逐字删除现有内容
        while (input.value.length > 0) {
            input.value = input.value.slice(0, -1);
            await new Promise(resolve => setTimeout(resolve, speed / 2));
        }

        // 第二步：逐字输入新内容
        for (let i = 0; i < newContent.length; i++) {
            input.value += newContent[i];
            await new Promise(resolve => setTimeout(resolve, speed));
        }

        // 第三步：自动触发查询
        await this.fetchNote();
    }
}

document.addEventListener('DOMContentLoaded', () => new XHSWebUI());
