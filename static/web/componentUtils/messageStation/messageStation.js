(function () {
    'use strict';

    var overlay = null;
    var currentApp = null;
    var currentTab = 'messages';
    var badgeTimer = null;
    var initialized = false;

    function getToken() {
        return (currentApp && currentApp.token) || localStorage.getItem('xhs_token') || '';
    }

    function getMediaUrl(url) {
        if (!url) return '';
        if (typeof url === 'string' && url.startsWith('/web/cache')) return url;
        if (currentApp && currentApp.getMediaUrl) return currentApp.getMediaUrl(url);
        var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) return url;
        return '/web/api/proxy?url=' + encodeURIComponent(url);
    }

    function escapeHtml(s) {
        if (!s) return '';
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function formatTime(timeStr) {
        if (!timeStr) return '';
        var d = new Date(timeStr);
        var now = new Date();
        var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
        var time = pad(d.getHours()) + ':' + pad(d.getMinutes());
        if (d.toDateString() === now.toDateString()) return time;
        var diff = (now - d) / 86400000;
        if (diff < 1) return '昨天 ' + time;
        return (d.getMonth() + 1) + '-' + d.getDate() + ' ' + time;
    }

    function getOrCreateOverlay() {
        if (overlay && document.body.contains(overlay)) return overlay;
        overlay = document.createElement('div');
        overlay.className = 'ms-overlay';
        overlay.innerHTML = [
            '<div class="ms-header">',
            '  <button class="ms-back">‹</button>',
            '  <span class="ms-title">信息站</span>',
            '</div>',
            '<div class="ms-tabs">',
            '  <button class="ms-tab ms-tab-active" data-tab="messages">消息</button>',
            '  <button class="ms-tab" data-tab="following">关注</button>',
            '</div>',
            '<div class="ms-content">',
            '  <div class="ms-panel ms-panel-active" data-panel="messages">',
            '    <div class="ms-conv-list"></div>',
            '  </div>',
            '  <div class="ms-panel" data-panel="following">',
            '    <div class="ms-follow-list"></div>',
            '  </div>',
            '</div>',
        ].join('\n');

        overlay.querySelector('.ms-back').onclick = close;

        overlay.querySelectorAll('.ms-tab').forEach(function (tab) {
            tab.onclick = function () {
                switchTab(tab.dataset.tab);
            };
        });

        bindSwipeClose(overlay);
        document.body.appendChild(overlay);
        initialized = true;
        return overlay;
    }

    function switchTab(tabName) {
        currentTab = tabName;
        overlay.querySelectorAll('.ms-tab').forEach(function (t) {
            t.classList.toggle('ms-tab-active', t.dataset.tab === tabName);
        });
        overlay.querySelectorAll('.ms-panel').forEach(function (p) {
            p.classList.toggle('ms-panel-active', p.dataset.panel === tabName);
        });
        if (tabName === 'messages') loadConversations();
        if (tabName === 'following') loadFollowing();
    }

    function bindSwipeClose(el) {
        var startX = 0, gesture = '', startTime = 0;

        el.addEventListener('touchstart', function (e) {
            startX = e.touches[0].clientX;
            startTime = Date.now();
            gesture = '';
            el.style.transition = 'none';
        }, { passive: true });

        el.addEventListener('touchmove', function (e) {
            var dx = e.touches[0].clientX - startX;
            var ax = Math.abs(dx);
            var ay = Math.abs(e.touches[0].clientY - startX);
            if (!gesture && (ax > 10 || ay > 10)) gesture = ax > ay ? 'h' : 'v';
            if (gesture === 'h' && dx > 0) {
                if (e.cancelable) e.preventDefault();
                var p = Math.min(dx / (window.innerWidth * 0.45), 1);
                el.style.transform = 'translateX(' + dx + 'px) scale(' + (1 - p * 0.15) + ')';
                el.style.borderRadius = (p * 20) + 'px';
            }
        }, { passive: false });

        el.addEventListener('touchend', function (e) {
            if (gesture === 'h') {
                var dx = e.changedTouches[0].clientX - startX;
                var p = dx / (window.innerWidth * 0.45);
                var v = dx / (Date.now() - startTime);
                if (p > 0.35 || v > 0.5) {
                    el.style.transition = 'all 0.3s cubic-bezier(0.23,1,0.32,1)';
                    el.style.transform = 'translateX(100%) scale(0.85)';
                    el.style.borderRadius = '20px';
                    setTimeout(function () { close(); el.style.transform = ''; el.style.borderRadius = ''; el.style.transition = ''; }, 300);
                } else {
                    el.style.transition = 'all 0.3s cubic-bezier(0.23,1,0.32,1)';
                    el.style.transform = '';
                    el.style.borderRadius = '';
                }
            }
            gesture = '';
        }, { passive: true });
    }

    async function loadConversations() {
        var list = overlay.querySelector('.ms-conv-list');
        list.innerHTML = '<div class="ms-loading">加载中...</div>';
        try {
            var resp = await fetch('/web/api/user/conversations?token=' + encodeURIComponent(getToken()));
            var convs = await resp.json();
            if (!convs || !convs.length) {
                list.innerHTML = '<div class="ms-empty">暂无消息</div>';
                return;
            }
            list.innerHTML = '';
            convs.forEach(function (conv) {
                var item = document.createElement('div');
                item.className = 'ms-conv-item';
                var avatarSrc = conv.peer_avatar ? getMediaUrl(conv.peer_avatar) : '';
                var preview = conv.last_message || '';
                if (preview.length > 30) preview = preview.substring(0, 30) + '...';
                try {
                    var parsed = JSON.parse(preview);
                    if (parsed && parsed.type === 'note_card') preview = '[笔记卡片]';
                } catch (e) {}

                item.innerHTML = [
                    '<div class="ms-conv-avatar-wrap">',
                    avatarSrc ? '<img class="ms-conv-avatar" src="' + avatarSrc + '" referrerpolicy="no-referrer">' : '<span class="ms-conv-avatar-ph">👤</span>',
                    '</div>',
                    '<div class="ms-conv-info">',
                    '  <div class="ms-conv-top">',
                    '    <span class="ms-conv-name">' + escapeHtml(conv.peer_name) + '</span>',
                    '    <span class="ms-conv-time">' + formatTime(conv.last_time) + '</span>',
                    '  </div>',
                    '  <div class="ms-conv-bottom">',
                    '    <span class="ms-conv-preview">' + escapeHtml(conv.is_self ? '我: ' + preview : preview) + '</span>',
                    conv.unread > 0 ? '<span class="ms-conv-badge">' + conv.unread + '</span>' : '',
                    '  </div>',
                    '</div>',
                ].join('');

                item.onclick = function () {
                    if (window.ChatUI && window.ChatUI.openUserChat) {
                        window.ChatUI.openUserChat(conv.peer_id, conv.peer_name, conv.peer_avatar);
                    }
                };
                list.appendChild(item);
            });
        } catch (e) {
            list.innerHTML = '<div class="ms-empty">加载失败</div>';
        }
    }

    async function loadFollowing() {
        var list = overlay.querySelector('.ms-follow-list');
        list.innerHTML = '<div class="ms-loading">加载中...</div>';
        try {
            var resp = await fetch('/web/api/user/following?token=' + encodeURIComponent(getToken()));
            var users = await resp.json();
            if (!users || !users.length) {
                list.innerHTML = '<div class="ms-empty">还没有关注任何人</div>';
                return;
            }
            list.innerHTML = '';
            users.forEach(function (user) {
                var item = document.createElement('div');
                item.className = 'ms-follow-item';
                var avatarSrc = user.avatar_url ? getMediaUrl(user.avatar_url) : '';

                item.innerHTML = [
                    '<div class="ms-follow-avatar-wrap">',
                    avatarSrc ? '<img class="ms-follow-avatar" src="' + avatarSrc + '" referrerpolicy="no-referrer">' : '<span class="ms-follow-avatar-ph">👤</span>',
                    '</div>',
                    '<div class="ms-follow-info">',
                    '  <span class="ms-follow-name">' + escapeHtml(user.nickname) + '</span>',
                    '  <span class="ms-follow-count">' + user.work_count + ' 个作品</span>',
                    '</div>',
                    '<button class="ms-follow-chat-btn">私信</button>',
                ].join('');

                item.querySelector('.ms-follow-chat-btn').onclick = function (e) {
                    e.stopPropagation();
                    if (window.ChatUI && window.ChatUI.openUserChat) {
                        window.ChatUI.openUserChat(user.id, user.nickname, user.avatar_url);
                    }
                };

                item.onclick = function () {
                    if (window.AuthorProfile && window.AuthorProfile.openUserProfile) {
                        window.AuthorProfile.openUserProfile(user.id, currentApp);
                    }
                };

                list.appendChild(item);
            });
        } catch (e) {
            list.innerHTML = '<div class="ms-empty">加载失败</div>';
        }
    }

    function open(appInstance) {
        currentApp = appInstance;
        var el = getOrCreateOverlay();
        el.style.zIndex = window.nextOverlayZ();
        switchTab('messages');
        el.classList.add('ms-visible');
        document.body.style.overflow = 'hidden';
    }

    function close() {
        if (overlay) {
            overlay.classList.remove('ms-visible');
            document.body.style.overflow = '';
        }
    }

    function isOpen() {
        return overlay && overlay.classList.contains('ms-visible');
    }

    function startBadgePolling() {
        stopBadgePolling();
        updateBadge();
        badgeTimer = setInterval(updateBadge, 30000);
    }

    function stopBadgePolling() {
        if (badgeTimer) {
            clearInterval(badgeTimer);
            badgeTimer = null;
        }
    }

    async function updateBadge() {
        var badge = document.getElementById('msgBadge');
        if (!badge) return;
        try {
            var resp = await fetch('/web/api/user/unread-count?token=' + encodeURIComponent(getToken()));
            var data = await resp.json();
            var count = data.count || 0;
            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : count;
                badge.style.display = '';
            } else {
                badge.style.display = 'none';
            }
        } catch (e) {
            badge.style.display = 'none';
        }
    }

    window.MessageStation = {
        open: open,
        close: close,
        isOpen: isOpen,
        startBadgePolling: startBadgePolling,
        stopBadgePolling: stopBadgePolling,
    };
})();
