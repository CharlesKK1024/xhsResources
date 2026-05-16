(function () {
    'use strict';

    let overlay = null;
    let currentAuthorId = null;
    let currentApp = null;
    let currentAvatar = '';
    let currentWorks = [];
    let tagsScrollTimer = null;
    let currentProfileMode = 'author';
    let currentProfileUserId = null;

    function getOrCreateOverlay() {
        if (overlay && document.body.contains(overlay)) return overlay;
        overlay = document.createElement('div');
        overlay.className = 'author-profile-overlay';
        overlay.innerHTML = `
            <div class="author-profile-header">
                <button class="ap-back">‹</button>
                <span class="ap-header-title"></span>
                <button class="ap-xhs-link" title="查看小红书主页">🔗</button>
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
                        <div class="ap-ip-location"></div>
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
        overlay.querySelector('.ap-xhs-link').onclick = function (e) {
            e.stopPropagation();
            if (!currentAuthorId) return;
            var deepLink = 'xhsdiscover://user/' + currentAuthorId + '/';
            var webUrl = 'https://www.xiaohongshu.com/user/profile/' + currentAuthorId;
            var start = Date.now();
            window.location.href = deepLink;
            setTimeout(function () {
                if (Date.now() - start < 1800) {
                    window.open(webUrl, '_blank');
                }
            }, 1500);
        };
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
        el.style.zIndex = window.nextOverlayZ();

        el.querySelector('.ap-header-title').textContent = authorName;
        el.querySelector('.ap-name').textContent = authorName;
        el.querySelector('.ap-uid-text').textContent = '小红书号: ' + authorId.slice(-8);
        el.querySelector('.ap-ip-location').textContent = '';
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

            // 从最新帖子获取IP归属地
            var ipLoc = '';
            for (var i = 0; i < currentWorks.length; i++) {
                var noteData = currentWorks[i].data;
                if (noteData && noteData.ipLocation) {
                    ipLoc = noteData.ipLocation;
                    break;
                }
            }
            el.querySelector('.ap-ip-location').textContent = ipLoc ? '📍 IP归属: ' + ipLoc : '';
        } catch (e) {
            el.querySelector('.ap-works-grid').innerHTML = '<div class="ap-loading">网络错误</div>';
        }
    }

    function renderTags(el, tags) {
        var container = el.querySelector('.ap-tags-scroll');
        container.innerHTML = '';
        stopTagsScroll();
        if (!tags.length) {
            el.querySelector('.ap-tags-section').style.display = 'none';
            return;
        }
        el.querySelector('.ap-tags-section').style.display = '';
        tags.forEach(function (tag) {
            var span = document.createElement('span');
            span.className = 'ap-tag';
            span.textContent = '#' + tag;
            span.addEventListener('click', function (e) {
                e.stopPropagation();
                if (currentApp && currentApp.openTagPopup) {
                    currentApp.openTagPopup(tag, currentAuthorId || '', e);
                }
            });
            container.appendChild(span);
        });

        setTimeout(function () {
            startTagsScroll(el.querySelector('.ap-tags-section'));
        }, 800);
    }

    function startTagsScroll(section) {
        stopTagsScroll();
        var inner = section.querySelector('.ap-tags-scroll');
        if (!inner) return;
        var overflow = inner.scrollHeight - section.clientHeight;
        if (overflow <= 2) return;

        var paused = false;
        section.addEventListener('touchstart', function () { paused = true; }, { passive: true });
        section.addEventListener('touchend', function () { paused = false; }, { passive: true });
        section.addEventListener('mouseenter', function () { paused = true; });
        section.addEventListener('mouseleave', function () { paused = false; });

        var offset = 0;
        var direction = 1;
        var pauseAt = 0;
        var PAUSE_DURATION = 1500;
        var SPEED = 0.5;

        function tick() {
            tagsScrollTimer = requestAnimationFrame(tick);
            if (paused) return;

            if (pauseAt > 0) {
                pauseAt -= 16;
                return;
            }

            overflow = inner.scrollHeight - section.clientHeight;
            if (overflow <= 0) return;

            if (direction === 1) {
                offset += SPEED;
                if (offset >= overflow) {
                    offset = overflow;
                    direction = -1;
                    pauseAt = PAUSE_DURATION;
                }
            } else {
                offset -= SPEED;
                if (offset <= 0) {
                    offset = 0;
                    direction = 1;
                    pauseAt = PAUSE_DURATION;
                }
            }

            inner.style.transform = 'translateY(' + (-offset) + 'px)';
        }

        pauseAt = PAUSE_DURATION;
        tagsScrollTimer = requestAnimationFrame(tick);
    }

    function stopTagsScroll() {
        if (tagsScrollTimer) {
            cancelAnimationFrame(tagsScrollTimer);
            tagsScrollTimer = null;
        }
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
                    '<span class="ap-work-link" data-note-id="' + (note.id || '') + '" title="查看原帖">🔗</span>' +
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

            card.onclick = function (e) {
                var linkEl = e.target.closest('.ap-work-link');
                if (linkEl) {
                    e.stopPropagation();
                    e.preventDefault();
                    var nid = linkEl.getAttribute('data-note-id');
                    if (nid) {
                        var deepLink = 'xhsdiscover://item/' + nid + '/';
                        var webUrl = 'https://www.xiaohongshu.com/explore/' + nid;
                        var start = Date.now();
                        window.location.href = deepLink;
                        setTimeout(function () {
                            if (Date.now() - start < 1800) {
                                window.open(webUrl, '_blank');
                            }
                        }, 1500);
                    }
                    return;
                }
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

    async function openUserProfile(userId, appInstance) {
        currentProfileMode = 'user';
        currentProfileUserId = userId;
        currentAuthorId = null;
        currentApp = appInstance;
        var el = getOrCreateOverlay();
        el.style.zIndex = window.nextOverlayZ();

        el.querySelector('.ap-header-title').textContent = '加载中...';
        el.querySelector('.ap-name').textContent = '';
        el.querySelector('.ap-uid').style.display = 'none';
        el.querySelector('.ap-ip-location').style.display = 'none';
        el.querySelector('.ap-xhs-link').style.display = 'none';
        el.querySelector('.ap-tags-section').style.display = 'none';
        el.querySelector('.ap-works-grid').innerHTML = '<div class="ap-loading">加载中...</div>';
        el.querySelector('.ap-works-count').textContent = '';
        el.querySelector('.ap-avatar-large').src = '';
        el.querySelector('.ap-follow-btn').textContent = '关注';
        el.querySelector('.ap-add-friend').style.display = 'none';

        el.classList.add('ap-visible');
        document.body.style.overflow = 'hidden';

        var token = (appInstance && appInstance.token) || localStorage.getItem('xhs_token') || '';
        try {
            var resp = await fetch('/web/api/user/' + userId + '/profile?token=' + encodeURIComponent(token));
            if (!resp.ok) {
                el.querySelector('.ap-works-grid').innerHTML = '<div class="ap-loading">用户不存在</div>';
                return;
            }
            var data = await resp.json();
            currentWorks = data.works || [];
            currentAvatar = data.avatar_url || '';

            el.querySelector('.ap-header-title').textContent = data.nickname || '用户';
            el.querySelector('.ap-name').textContent = data.nickname || '用户';

            if (data.avatar_url) {
                var avatarUrl = getMediaUrl(data.avatar_url);
                el.querySelector('.ap-avatar-large').src = avatarUrl;
            }

            var followBtn = el.querySelector('.ap-follow-btn');
            followBtn.textContent = data.is_following ? '已关注' : '关注';
            followBtn.onclick = async function () {
                var isFollowing = followBtn.textContent === '已关注';
                try {
                    if (isFollowing) {
                        await fetch('/web/api/user/follow?target_id=' + userId + '&token=' + encodeURIComponent(token), { method: 'DELETE' });
                        followBtn.textContent = '关注';
                    } else {
                        await fetch('/web/api/user/follow', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ target_id: userId, token: token }),
                        });
                        followBtn.textContent = '已关注';
                    }
                } catch (e) {
                    if (window.showToast) window.showToast('操作失败');
                }
            };

            var chatBtn = el.querySelector('.ap-chat-btn');
            chatBtn.onclick = function () {
                if (window.ChatUI && window.ChatUI.openUserChat) {
                    window.ChatUI.openUserChat(userId, data.nickname, data.avatar_url);
                }
            };

            el.querySelector('.ap-works-count').textContent = data.work_count + ' 篇';
            renderWorks(el, currentWorks);
        } catch (e) {
            el.querySelector('.ap-works-grid').innerHTML = '<div class="ap-loading">网络错误</div>';
        }
    }

    function close() {
        stopTagsScroll();
        if (overlay) {
            overlay.classList.remove('ap-visible');
            setTimeout(function () {
                if (!overlay.classList.contains('ap-visible')) {
                    document.body.style.overflow = '';
                }
            }, 400);
        }
        currentAuthorId = null;
        currentApp = null;
        currentWorks = [];
        currentProfileMode = 'author';
        currentProfileUserId = null;

        if (overlay) {
            overlay.querySelector('.ap-uid').style.display = '';
            overlay.querySelector('.ap-ip-location').style.display = '';
            overlay.querySelector('.ap-xhs-link').style.display = '';
            overlay.querySelector('.ap-add-friend').style.display = '';
        }
    }

    function isOpen() {
        return overlay && overlay.classList.contains('ap-visible');
    }

    window.AuthorProfile = {
        open: open,
        openUserProfile: openUserProfile,
        close: close,
        isOpen: isOpen,
    };
})();
