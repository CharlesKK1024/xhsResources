(function () {
    'use strict';

    let overlay = null;
    let currentAuthorId = null;
    let currentApp = null;
    let currentAvatar = '';
    let currentWorks = [];

    function getOrCreateOverlay() {
        if (overlay && document.body.contains(overlay)) return overlay;
        overlay = document.createElement('div');
        overlay.className = 'author-profile-overlay';
        overlay.innerHTML = `
            <div class="author-profile-header">
                <button class="ap-back">‹</button>
                <span class="ap-header-title"></span>
                <button class="ap-more">···</button>
            </div>
            <div class="author-profile-content">
                <div class="ap-hero-section">
                    <div class="ap-info-left">
                        <img class="ap-avatar-large" src="" referrerpolicy="no-referrer">
                        <div class="ap-name"></div>
                        <div class="ap-uid">
                            <span class="ap-uid-text"></span>
                            <button class="ap-uid-copy" title="复制ID">📋</button>
                        </div>
                    </div>
                    <div class="ap-info-right">
                        <div class="ap-tags-section">
                            <div class="ap-tags-scroll"></div>
                        </div>
                    </div>
                </div>
                <div class="ap-action-bar">
                    <button class="ap-follow-btn">关注</button>
                    <button class="ap-chat-btn">发私信</button>
                    <button class="ap-add-friend">👤+</button>
                </div>
                <div class="ap-works-header">
                    <span class="ap-works-title">笔记</span>
                    <span class="ap-works-count"></span>
                </div>
                <div class="ap-works-grid"></div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('.ap-back').onclick = close;
        overlay.querySelector('.ap-uid-copy').onclick = function () {
            if (currentAuthorId) {
                navigator.clipboard.writeText(currentAuthorId).then(function () {
                    if (window.showToast) window.showToast('已复制作者ID');
                });
            }
        };
        overlay.querySelector('.ap-follow-btn').onclick = function () {
            this.textContent = this.textContent === '关注' ? '已关注' : '关注';
        };
        overlay.querySelector('.ap-chat-btn').onclick = function () {
            if (window.ChatUI && currentAuthorId) {
                var name = overlay.querySelector('.ap-name').textContent;
                window.ChatUI.open(currentAuthorId, name, currentAvatar);
            }
        };

        // 右滑收缩退出手势
        bindSwipeClose(overlay);

        return overlay;
    }

    function bindSwipeClose(el) {
        var startX = 0, startY = 0, gesture = '', startTime = 0;
        var content = el.querySelector('.author-profile-content');

        el.addEventListener('touchstart', function (e) {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            startTime = Date.now();
            gesture = '';
            el.style.transition = 'none';
        }, { passive: true });

        el.addEventListener('touchmove', function (e) {
            var touch = e.touches[0];
            var dx = touch.clientX - startX;
            var dy = touch.clientY - startY;
            var ax = Math.abs(dx);
            var ay = Math.abs(dy);

            if (!gesture && (ax > 10 || ay > 10)) {
                gesture = ax > ay ? 'horizontal' : 'vertical';
            }

            if (gesture === 'horizontal' && dx > 0) {
                if (e.cancelable) e.preventDefault();
                var progress = Math.min(dx / (window.innerWidth * 0.45), 1);
                var scale = 1 - progress * 0.15;
                var radius = progress * 20;
                el.style.transform = 'translateX(' + dx + 'px) scale(' + scale + ')';
                el.style.borderRadius = radius + 'px';
            }
        }, { passive: false });

        el.addEventListener('touchend', function (e) {
            if (gesture === 'horizontal') {
                var dx = e.changedTouches[0].clientX - startX;
                var progress = dx / (window.innerWidth * 0.45);
                var velocity = dx / (Date.now() - startTime);

                if (progress > 0.35 || velocity > 0.5) {
                    el.style.transition = 'all 0.3s cubic-bezier(0.23, 1, 0.32, 1)';
                    el.style.transform = 'translateX(100%) scale(0.85)';
                    el.style.borderRadius = '20px';
                    setTimeout(function () {
                        close();
                        el.style.transform = '';
                        el.style.borderRadius = '';
                        el.style.transition = '';
                    }, 300);
                } else {
                    el.style.transition = 'all 0.3s cubic-bezier(0.23, 1, 0.32, 1)';
                    el.style.transform = '';
                    el.style.borderRadius = '';
                }
            }
            gesture = '';
        }, { passive: true });

        // 鼠标拖拽支持（桌面端）
        var mouseDown = false, mouseStartX = 0, mouseStartTime = 0;

        el.addEventListener('mousedown', function (e) {
            if (e.target.closest('button, a, .ap-work-card, input')) return;
            mouseDown = true;
            mouseStartX = e.clientX;
            mouseStartTime = Date.now();
            gesture = '';
            el.style.transition = 'none';
        });

        window.addEventListener('mousemove', function (e) {
            if (!mouseDown) return;
            var dx = e.clientX - mouseStartX;
            if (!gesture && Math.abs(dx) > 10) gesture = 'horizontal';
            if (gesture === 'horizontal' && dx > 0) {
                var progress = Math.min(dx / (window.innerWidth * 0.45), 1);
                var scale = 1 - progress * 0.15;
                var radius = progress * 20;
                el.style.transform = 'translateX(' + dx + 'px) scale(' + scale + ')';
                el.style.borderRadius = radius + 'px';
            }
        });

        window.addEventListener('mouseup', function (e) {
            if (!mouseDown) return;
            mouseDown = false;
            if (gesture === 'horizontal') {
                var dx = e.clientX - mouseStartX;
                var progress = dx / (window.innerWidth * 0.45);
                var velocity = dx / (Date.now() - mouseStartTime);

                if (progress > 0.35 || velocity > 0.5) {
                    el.style.transition = 'all 0.3s cubic-bezier(0.23, 1, 0.32, 1)';
                    el.style.transform = 'translateX(100%) scale(0.85)';
                    el.style.borderRadius = '20px';
                    setTimeout(function () {
                        close();
                        el.style.transform = '';
                        el.style.borderRadius = '';
                        el.style.transition = '';
                    }, 300);
                } else {
                    el.style.transition = 'all 0.3s cubic-bezier(0.23, 1, 0.32, 1)';
                    el.style.transform = '';
                    el.style.borderRadius = '';
                }
            }
            gesture = '';
        });
    }

    function getMediaUrl(url) {
        if (!url) return '';
        if (typeof url === 'string' && url.startsWith('/web/cache')) return url;
        var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) return url;
        return '/web/api/proxy?url=' + encodeURIComponent(url);
    }

    async function open(authorId, authorName, appInstance) {
        currentAuthorId = authorId;
        currentApp = appInstance;
        var el = getOrCreateOverlay();

        el.querySelector('.ap-header-title').textContent = authorName;
        el.querySelector('.ap-name').textContent = authorName;
        el.querySelector('.ap-uid-text').textContent = '小红书号: ' + authorId.slice(-8);
        el.querySelector('.ap-tags-scroll').innerHTML = '';
        el.querySelector('.ap-works-grid').innerHTML = '<div class="ap-loading">加载中...</div>';
        el.querySelector('.ap-works-count').textContent = '';
        el.querySelector('.ap-avatar-large').src = '';
        el.querySelector('.ap-follow-btn').textContent = '关注';

        el.classList.add('ap-visible');
        document.body.style.overflow = 'hidden';

        var token = (appInstance && appInstance.token) || localStorage.getItem('xhs_token') || '';
        try {
            var resp = await fetch('/web/api/author/detail?author_id=' + encodeURIComponent(authorId) + '&token=' + encodeURIComponent(token));
            if (!resp.ok) {
                el.querySelector('.ap-works-grid').innerHTML = '<div class="ap-loading">加载失败</div>';
                return;
            }
            var data = await resp.json();
            currentWorks = data.works || [];
            currentAvatar = data.avatar || '';

            if (data.author_name) {
                el.querySelector('.ap-header-title').textContent = data.author_name;
                el.querySelector('.ap-name').textContent = data.author_name;
            }

            var avatarUrl = getMediaUrl(data.avatar);
            if (avatarUrl) {
                el.querySelector('.ap-avatar-large').src = avatarUrl;
            }

            renderTags(el, data.tags || []);
            renderWorks(el, currentWorks);
            el.querySelector('.ap-works-count').textContent = currentWorks.length + ' 篇';
        } catch (e) {
            el.querySelector('.ap-works-grid').innerHTML = '<div class="ap-loading">网络错误</div>';
        }
    }

    function renderTags(el, tags) {
        var container = el.querySelector('.ap-tags-scroll');
        container.innerHTML = '';
        if (!tags.length) {
            el.querySelector('.ap-tags-section').style.display = 'none';
            return;
        }
        el.querySelector('.ap-tags-section').style.display = '';
        tags.forEach(function (tag) {
            var span = document.createElement('span');
            span.className = 'ap-tag';
            span.textContent = '#' + tag;
            container.appendChild(span);
        });
    }

    function renderWorks(el, works) {
        var grid = el.querySelector('.ap-works-grid');
        grid.innerHTML = '';
        if (!works.length) {
            grid.innerHTML = '<div class="ap-loading">暂无作品</div>';
            return;
        }

        works.forEach(function (item, index) {
            var note = item.data;
            if (!note) return;

            var card = document.createElement('div');
            card.className = 'ap-work-card';

            var coverUrl = getMediaUrl(note.cover || note.raw_cover || '');
            var isVideo = note.type === 'video' || (note.videos && note.videos.length > 0);

            card.innerHTML =
                '<div class="ap-work-cover">' +
                    '<img src="' + coverUrl + '" loading="lazy" referrerpolicy="no-referrer">' +
                    (isVideo ? '<span class="ap-video-badge">▶</span>' : '') +
                '</div>' +
                '<div class="ap-work-info">' +
                    '<div class="ap-work-title">' + (note.title || '无标题') + '</div>' +
                    '<div class="ap-work-meta">' +
                        '<span class="ap-work-author">' +
                            '<img src="' + (coverUrl || '') + '" referrerpolicy="no-referrer">' +
                            ' ' + (note.author || '') +
                        '</span>' +
                        '<span class="ap-work-likes">❤️ ' + formatNum(note.likeCount) + '</span>' +
                    '</div>' +
                '</div>';

            card.onclick = function () {
                if (currentApp && currentApp.openNoteDetail) {
                    currentApp.openNoteDetail(note, card);
                }
            };

            grid.appendChild(card);
        });
    }

    function formatNum(n) {
        if (!n && n !== 0) return '0';
        n = parseInt(n) || 0;
        if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
        return String(n);
    }

    function close() {
        if (overlay) {
            overlay.classList.remove('ap-visible');
            document.body.style.overflow = '';
        }
        currentAuthorId = null;
        currentApp = null;
        currentWorks = [];
    }

    function isOpen() {
        return overlay && overlay.classList.contains('ap-visible');
    }

    window.AuthorProfile = {
        open: open,
        close: close,
        isOpen: isOpen,
    };
})();
