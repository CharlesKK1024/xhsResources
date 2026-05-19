(function () {
    'use strict';

    var overlay = null;
    var currentApp = null;
    var currentTab = 'messages';
    var badgeTimer = null;
    var initialized = false;
    var createGroupPanel = null;
    var CACHE_TTLS = {
        conversations: 15000,
        following: 60000,
        groups: 30000,
        mutualFollows: 60000,
    };

    function getToken() {
        return (currentApp && currentApp.token) || localStorage.getItem('xhs_token') || '';
    }

    function getCacheApi() {
        return window.XHSUICache || null;
    }

    function getCacheScope() {
        var token = getToken();
        return token ? token.slice(-16) : 'guest';
    }

    function getCacheKey(name) {
        return 'ms:' + getCacheScope() + ':' + name;
    }

    function peekCache(name) {
        var cache = getCacheApi();
        if (!cache) return null;
        return cache.peek(getCacheKey(name), CACHE_TTLS[name] || 0);
    }

    function setCache(name, data, options) {
        var cache = getCacheApi();
        if (!cache) return;
        cache.set(getCacheKey(name), data, options || {});
    }

    function removeCache(name) {
        var cache = getCacheApi();
        if (!cache) return;
        cache.remove(getCacheKey(name));
    }

    function getMediaUrl(url) {
        if (!url) return '';
        if (currentApp && currentApp.getMediaUrl) return currentApp.getMediaUrl(url);
        if (typeof url === 'string' && url.includes('xhscdn.com') && url.startsWith('http://')) {
            return 'https://' + url.slice('http://'.length);
        }
        return url;
    }

    function getAvatarUrl(url) {
        if (!url) return '';
        if (currentApp && currentApp.getAvatarUrl) return currentApp.getAvatarUrl(url);
        return getMediaUrl(url);
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

    function renderConversations(convs) {
        var list = overlay.querySelector('.ms-conv-list');
        if (!convs || !convs.length) {
            list.innerHTML = '<div class="ms-empty">鏆傛棤娑堟伅</div>';
            return;
        }

        list.innerHTML = '';
        convs.forEach(function (conv) {
            var item = document.createElement('div');
            item.className = 'ms-conv-item';
            var avatarSrc = conv.peer_avatar ? getAvatarUrl(conv.peer_avatar) : '';
            var preview = conv.last_message || '';
            try {
                var parsed = JSON.parse(preview);
                if (parsed && parsed.type === 'note_card') {
                    preview = '[绗旇鍗＄墖]';
                } else if (parsed && parsed.type === 'follow_card') {
                    preview = (parsed.nickname || '鏈変汉') + ' 鍏虫敞浜嗕綘';
                }
            } catch (e) {}
            if (preview.length > 30) preview = preview.substring(0, 30) + '...';

            var isSystem = (conv.peer_id == 0);
            var avatarInner;
            if (isSystem) {
                avatarInner = '<span class="ms-conv-avatar-ph ms-system-icon">馃敂</span>';
            } else if (avatarSrc) {
                avatarInner = '<img class="ms-conv-avatar" src="' + avatarSrc + '" referrerpolicy="no-referrer">';
            } else {
                avatarInner = '<span class="ms-conv-avatar-ph">馃懁</span>';
            }

            item.innerHTML = [
                '<div class="ms-conv-avatar-wrap">',
                avatarInner,
                '</div>',
                '<div class="ms-conv-info">',
                '  <div class="ms-conv-top">',
                '    <span class="ms-conv-name">' + escapeHtml(conv.peer_name) + '</span>',
                '    <span class="ms-conv-time">' + formatTime(conv.last_time) + '</span>',
                '  </div>',
                '  <div class="ms-conv-bottom">',
                '    <span class="ms-conv-preview">' + escapeHtml(conv.is_self ? '鎴? ' + preview : preview) + '</span>',
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
    }

    function renderFollowing(users) {
        var list = overlay.querySelector('.ms-follow-list');
        if (!users || !users.length) {
            list.innerHTML = '<div class="ms-empty">杩樻病鏈夊叧娉ㄤ换浣曚汉</div>';
            return;
        }

        list.innerHTML = '';
        users.forEach(function (user) {
            var item = document.createElement('div');
            item.className = 'ms-follow-item';
            var avatarSrc = user.avatar_url ? getAvatarUrl(user.avatar_url) : '';

            item.innerHTML = [
                '<div class="ms-follow-avatar-wrap">',
                avatarSrc ? '<img class="ms-follow-avatar" src="' + avatarSrc + '" referrerpolicy="no-referrer">' : '<span class="ms-follow-avatar-ph">馃懁</span>',
                '</div>',
                '<div class="ms-follow-info">',
                '  <span class="ms-follow-name">' + escapeHtml(user.nickname) + '</span>',
                '  <span class="ms-follow-count">' + user.work_count + ' 涓綔鍝?/span>',
                '</div>',
                '<button class="ms-follow-chat-btn">绉佷俊</button>',
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
    }

    function renderGroups(groups) {
        var list = overlay.querySelector('.ms-group-list');
        if (!groups || !groups.length) {
            list.innerHTML = '<div class="ms-empty">鏆傛棤缇ょ粍锛岀偣鍑讳笂鏂瑰垱寤?/div>';
            return;
        }

        list.innerHTML = '';
        groups.forEach(function (group) {
            var item = document.createElement('div');
            item.className = 'ms-group-item';

            var firstChar = (group.name || '缇?').charAt(0);
            var preview = group.last_message || '';
            try {
                var parsed = JSON.parse(preview);
                if (parsed && parsed.type === 'note_card') {
                    preview = '[绗旇鍗＄墖]';
                }
            } catch (e) {}
            if (preview.length > 25) preview = preview.substring(0, 25) + '...';
            var senderPrefix = group.last_sender_name ? group.last_sender_name + ': ' : '';

            item.innerHTML = [
                '<div class="ms-group-avatar-wrap">' + escapeHtml(firstChar) + '</div>',
                '<div class="ms-group-info">',
                '  <div class="ms-group-top">',
                '    <span class="ms-group-name">' + escapeHtml(group.name) + '</span>',
                '    <span class="ms-group-time">' + formatTime(group.last_time) + '</span>',
                '  </div>',
                '  <div class="ms-group-bottom">',
                '    <span class="ms-group-preview">' + escapeHtml(senderPrefix + preview) + '</span>',
                '    <span class="ms-group-member-count">' + group.member_count + '浜?/span>',
                '  </div>',
                '</div>',
            ].join('');

            item.onclick = function () {
                if (window.ChatUI && window.ChatUI.openGroupChat) {
                    window.ChatUI.openGroupChat(group.group_id, group.name);
                }
            };
            list.appendChild(item);
        });
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
            '  <button class="ms-tab" data-tab="groups">群组</button>',
            '</div>',
            '<div class="ms-content">',
            '  <div class="ms-panel ms-panel-active" data-panel="messages">',
            '    <div class="ms-conv-list"></div>',
            '  </div>',
            '  <div class="ms-panel" data-panel="following">',
            '    <div class="ms-follow-list"></div>',
            '  </div>',
            '  <div class="ms-panel" data-panel="groups">',
            '    <div class="ms-groups-header">',
            '      <button class="ms-create-group-btn">+ 创建群组</button>',
            '    </div>',
            '    <div class="ms-group-list"></div>',
            '  </div>',
            '</div>',
        ].join('\n');

        overlay.querySelector('.ms-back').onclick = close;

        overlay.querySelectorAll('.ms-tab').forEach(function (tab) {
            tab.onclick = function () {
                switchTab(tab.dataset.tab);
            };
        });

        overlay.querySelector('.ms-create-group-btn').onclick = function () {
            showCreateGroupPanel();
        };

        document.body.appendChild(overlay);
        bindSwipeClose(overlay);
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
        if (tabName === 'groups') loadGroups();
    }

    function bindSwipeClose(el) {
        if (!el || el._msSwipeCloseBound) return;

        var startX = 0;
        var startY = 0;
        var startTime = 0;
        var gesture = '';
        var touchActive = false;
        var touchId = null;
        var mouseDown = false;
        var mouseStartX = 0;
        var mouseStartY = 0;
        var mouseStartTime = 0;

        function shouldIgnoreTarget(target) {
            return !!(target && target.closest && target.closest('button, a, input, textarea, select'));
        }

        function resetStyles() {
            el.style.transform = '';
            el.style.borderRadius = '';
            el.style.transition = '';
        }

        function applyProgress(dx) {
            var progress = Math.min(dx / (window.innerWidth * 0.45), 1);
            var scale = 1 - progress * 0.15;
            var radius = progress * 20;
            el.style.transform = 'translateX(' + dx + 'px) scale(' + scale + ')';
            el.style.borderRadius = radius + 'px';
        }

        function finishGesture(dx, duration) {
            var progress = dx / (window.innerWidth * 0.45);
            var velocity = dx / Math.max(duration, 1);

            if (progress > 0.35 || velocity > 0.5) {
                el.style.transition = 'all 0.3s cubic-bezier(0.23, 1, 0.32, 1)';
                el.style.transform = 'translateX(100%) scale(0.85)';
                el.style.borderRadius = '20px';
                setTimeout(function () {
                    close();
                    resetStyles();
                }, 300);
                return;
            }

            el.style.transition = 'all 0.3s cubic-bezier(0.23, 1, 0.32, 1)';
            resetStyles();
        }

        function findTrackedTouch(touches) {
            if (!touches) return null;
            for (var i = 0; i < touches.length; i++) {
                if (touches[i].identifier === touchId) return touches[i];
            }
            return null;
        }

        el.addEventListener('touchstart', function (e) {
            if (shouldIgnoreTarget(e.target)) return;
            var touch = e.changedTouches[0];
            touchActive = true;
            touchId = touch.identifier;
            startX = touch.clientX;
            startY = touch.clientY;
            startTime = Date.now();
            gesture = '';
            el.style.transition = 'none';
        }, { passive: true });

        window.addEventListener('touchmove', function (e) {
            if (!touchActive) return;
            var touch = findTrackedTouch(e.touches);
            if (!touch) return;

            var dx = touch.clientX - startX;
            var dy = touch.clientY - startY;
            var ax = Math.abs(dx);
            var ay = Math.abs(dy);

            if (!gesture && (ax > 10 || ay > 10)) {
                gesture = ax > ay ? 'horizontal' : 'vertical';
            }

            if (gesture === 'horizontal' && dx > 0) {
                if (e.cancelable) e.preventDefault();
                applyProgress(dx);
            }
        }, { passive: false });

        window.addEventListener('touchend', function (e) {
            if (!touchActive) return;
            var touch = findTrackedTouch(e.changedTouches);
            if (!touch) return;

            touchActive = false;
            touchId = null;

            if (gesture === 'horizontal') {
                finishGesture(touch.clientX - startX, Date.now() - startTime);
            } else {
                el.style.transition = '';
            }
            gesture = '';
        }, { passive: true });

        window.addEventListener('touchcancel', function () {
            if (!touchActive) return;
            touchActive = false;
            touchId = null;
            gesture = '';
            resetStyles();
        }, { passive: true });

        el.addEventListener('mousedown', function (e) {
            if (shouldIgnoreTarget(e.target)) return;
            mouseDown = true;
            mouseStartX = e.clientX;
            mouseStartY = e.clientY;
            mouseStartTime = Date.now();
            gesture = '';
            el.style.transition = 'none';
        });

        window.addEventListener('mousemove', function (e) {
            if (!mouseDown) return;
            var dx = e.clientX - mouseStartX;
            var dy = e.clientY - mouseStartY;
            var ax = Math.abs(dx);
            var ay = Math.abs(dy);

            if (!gesture && (ax > 10 || ay > 10)) {
                gesture = ax > ay ? 'horizontal' : 'vertical';
            }

            if (gesture === 'horizontal' && dx > 0) {
                applyProgress(dx);
            }
        });

        window.addEventListener('mouseup', function (e) {
            if (!mouseDown) return;
            mouseDown = false;

            if (gesture === 'horizontal') {
                finishGesture(e.clientX - mouseStartX, Date.now() - mouseStartTime);
            } else {
                el.style.transition = '';
            }
            gesture = '';
        });

        el._msSwipeCloseBound = true;
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
                var avatarSrc = conv.peer_avatar ? getAvatarUrl(conv.peer_avatar) : '';
                var preview = conv.last_message || '';
                try {
                    var parsed = JSON.parse(preview);
                    if (parsed && parsed.type === 'note_card') {
                        preview = '[笔记卡片]';
                    } else if (parsed && parsed.type === 'follow_card') {
                        preview = (parsed.nickname || '有人') + ' 关注了你';
                    }
                } catch (e) {}
                if (preview.length > 30) preview = preview.substring(0, 30) + '...';

                var isSystem = (conv.peer_id == 0);
                var avatarInner;
                if (isSystem) {
                    avatarInner = '<span class="ms-conv-avatar-ph ms-system-icon">🔔</span>';
                } else if (avatarSrc) {
                    avatarInner = '<img class="ms-conv-avatar" src="' + avatarSrc + '" referrerpolicy="no-referrer">';
                } else {
                    avatarInner = '<span class="ms-conv-avatar-ph">👤</span>';
                }

                item.innerHTML = [
                    '<div class="ms-conv-avatar-wrap">',
                    avatarInner,
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
                var avatarSrc = user.avatar_url ? getAvatarUrl(user.avatar_url) : '';

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

    async function loadGroups() {
        var list = overlay.querySelector('.ms-group-list');
        list.innerHTML = '<div class="ms-loading">加载中...</div>';
        try {
            var resp = await fetch('/web/api/user/groups?token=' + encodeURIComponent(getToken()));
            var groups = await resp.json();
            if (!groups || !groups.length) {
                list.innerHTML = '<div class="ms-empty">暂无群组，点击上方创建</div>';
                return;
            }
            list.innerHTML = '';
            groups.forEach(function (group) {
                var item = document.createElement('div');
                item.className = 'ms-group-item';

                var firstChar = (group.name || '群').charAt(0);
                var preview = group.last_message || '';
                try {
                    var parsed = JSON.parse(preview);
                    if (parsed && parsed.type === 'note_card') {
                        preview = '[笔记卡片]';
                    }
                } catch (e) {}
                if (preview.length > 25) preview = preview.substring(0, 25) + '...';
                var senderPrefix = group.last_sender_name ? group.last_sender_name + ': ' : '';

                item.innerHTML = [
                    '<div class="ms-group-avatar-wrap">' + escapeHtml(firstChar) + '</div>',
                    '<div class="ms-group-info">',
                    '  <div class="ms-group-top">',
                    '    <span class="ms-group-name">' + escapeHtml(group.name) + '</span>',
                    '    <span class="ms-group-time">' + formatTime(group.last_time) + '</span>',
                    '  </div>',
                    '  <div class="ms-group-bottom">',
                    '    <span class="ms-group-preview">' + escapeHtml(senderPrefix + preview) + '</span>',
                    '    <span class="ms-group-member-count">' + group.member_count + '人</span>',
                    '  </div>',
                    '</div>',
                ].join('');

                item.onclick = function () {
                    if (window.ChatUI && window.ChatUI.openGroupChat) {
                        window.ChatUI.openGroupChat(group.group_id, group.name);
                    }
                };
                list.appendChild(item);
            });
        } catch (e) {
            list.innerHTML = '<div class="ms-empty">加载失败</div>';
        }
    }

    async function loadConversations() {
        var list = overlay.querySelector('.ms-conv-list');
        var cached = peekCache('conversations');
        if (cached) {
            renderConversations(cached.data);
        } else {
            list.innerHTML = '<div class="ms-loading">鍔犺浇涓?..</div>';
        }

        try {
            var resp = await fetch('/web/api/user/conversations?token=' + encodeURIComponent(getToken()));
            var convs = await resp.json();
            setCache('conversations', convs || []);
            renderConversations(convs || []);
        } catch (e) {
            if (!cached) {
                list.innerHTML = '<div class="ms-empty">鍔犺浇澶辫触</div>';
            }
        }
    }

    async function loadFollowing() {
        var list = overlay.querySelector('.ms-follow-list');
        var cached = peekCache('following');
        if (cached) {
            renderFollowing(cached.data);
        } else {
            list.innerHTML = '<div class="ms-loading">鍔犺浇涓?..</div>';
        }

        try {
            var resp = await fetch('/web/api/user/following?token=' + encodeURIComponent(getToken()));
            var users = await resp.json();
            setCache('following', users || []);
            renderFollowing(users || []);
        } catch (e) {
            if (!cached) {
                list.innerHTML = '<div class="ms-empty">鍔犺浇澶辫触</div>';
            }
        }
    }

    async function loadGroups() {
        var list = overlay.querySelector('.ms-group-list');
        var cached = peekCache('groups');
        if (cached) {
            renderGroups(cached.data);
        } else {
            list.innerHTML = '<div class="ms-loading">鍔犺浇涓?..</div>';
        }

        try {
            var resp = await fetch('/web/api/user/groups?token=' + encodeURIComponent(getToken()));
            var groups = await resp.json();
            setCache('groups', groups || []);
            renderGroups(groups || []);
        } catch (e) {
            if (!cached) {
                list.innerHTML = '<div class="ms-empty">鍔犺浇澶辫触</div>';
            }
        }
    }

    function getOrCreateGroupPanel() {
        if (createGroupPanel && overlay.contains(createGroupPanel)) return createGroupPanel;
        createGroupPanel = document.createElement('div');
        createGroupPanel.className = 'ms-create-group-panel';
        createGroupPanel.innerHTML = [
            '<div class="ms-cgp-header">',
            '  <span>创建群组</span>',
            '  <button class="ms-cgp-close">✕</button>',
            '</div>',
            '<div class="ms-cgp-name-row">',
            '  <input class="ms-cgp-name-input" placeholder="输入群名称" maxlength="20">',
            '</div>',
            '<div class="ms-cgp-section-title">选择互关好友</div>',
            '<div class="ms-cgp-friend-list"></div>',
            '<div class="ms-cgp-footer">',
            '  <button class="ms-cgp-confirm-btn">创建</button>',
            '</div>',
        ].join('\n');

        createGroupPanel.querySelector('.ms-cgp-close').onclick = hideCreateGroupPanel;
        createGroupPanel.querySelector('.ms-cgp-confirm-btn').onclick = doCreateGroup;
        overlay.appendChild(createGroupPanel);
        return createGroupPanel;
    }

    async function showCreateGroupPanel() {
        var panel = getOrCreateGroupPanel();
        panel.querySelector('.ms-cgp-name-input').value = '';
        var friendList = panel.querySelector('.ms-cgp-friend-list');
        friendList.innerHTML = '<div class="ms-loading">加载中...</div>';

        requestAnimationFrame(function () {
            panel.classList.add('panel-visible');
        });

        try {
            var resp = await fetch('/web/api/user/mutual-follows?token=' + encodeURIComponent(getToken()));
            var friends = await resp.json();
            if (!friends || !friends.length) {
                friendList.innerHTML = '<div class="ms-empty">暂无互关好友</div>';
                return;
            }
            friendList.innerHTML = '';
            friends.forEach(function (f) {
                var el = document.createElement('div');
                el.className = 'ms-cgp-friend-item';
                var avatarSrc = f.avatar_url ? getAvatarUrl(f.avatar_url) : '';
                el.innerHTML = [
                    '<input type="checkbox" class="ms-cgp-check" data-uid="' + f.id + '">',
                    '<div class="ms-cgp-friend-avatar-wrap">',
                    avatarSrc ? '<img class="ms-cgp-friend-avatar" src="' + avatarSrc + '" referrerpolicy="no-referrer">' : '<span class="ms-cgp-friend-avatar-ph">👤</span>',
                    '</div>',
                    '<span class="ms-cgp-friend-name">' + escapeHtml(f.nickname) + '</span>',
                ].join('');
                el.onclick = function (e) {
                    if (e.target.tagName !== 'INPUT') {
                        var cb = el.querySelector('.ms-cgp-check');
                        cb.checked = !cb.checked;
                    }
                };
                friendList.appendChild(el);
            });
        } catch (e) {
            friendList.innerHTML = '<div class="ms-empty">加载失败</div>';
        }
    }

    function hideCreateGroupPanel() {
        if (createGroupPanel) {
            createGroupPanel.classList.remove('panel-visible');
        }
    }

    async function doCreateGroup() {
        var panel = createGroupPanel;
        var name = panel.querySelector('.ms-cgp-name-input').value.trim();
        if (!name) {
            if (window.showToast) window.showToast('请输入群名称');
            return;
        }
        var checks = panel.querySelectorAll('.ms-cgp-check:checked');
        var memberIds = [];
        checks.forEach(function (cb) { memberIds.push(parseInt(cb.dataset.uid)); });

        var btn = panel.querySelector('.ms-cgp-confirm-btn');
        btn.disabled = true;
        btn.textContent = '创建中...';

        try {
            var resp = await fetch('/web/api/group', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: getToken(), name: name, member_ids: memberIds }),
            });
            var result = await resp.json();
            if (result && result.status === 'success') {
                hideCreateGroupPanel();
                loadGroups();
                if (window.ChatUI && window.ChatUI.openGroupChat && result.group) {
                    window.ChatUI.openGroupChat(result.group.id, result.group.name);
                }
            } else {
                if (window.showToast) window.showToast(result.error || '创建失败');
            }
        } catch (e) {
            if (window.showToast) window.showToast('创建失败');
        } finally {
            btn.disabled = false;
            btn.textContent = '创建';
        }
    }

    async function showCreateGroupPanel() {
        var panel = getOrCreateGroupPanel();
        panel.querySelector('.ms-cgp-name-input').value = '';
        var friendList = panel.querySelector('.ms-cgp-friend-list');
        var cached = peekCache('mutualFollows');

        if (cached && cached.data && cached.data.length) {
            renderCreateGroupFriends(friendList, cached.data);
        } else {
            friendList.innerHTML = '<div class="ms-loading">鍔犺浇涓?..</div>';
        }

        requestAnimationFrame(function () {
            panel.classList.add('panel-visible');
        });

        try {
            var resp = await fetch('/web/api/user/mutual-follows?token=' + encodeURIComponent(getToken()));
            var friends = await resp.json();
            setCache('mutualFollows', friends || []);
            renderCreateGroupFriends(friendList, friends || []);
        } catch (e) {
            if (!cached) {
                friendList.innerHTML = '<div class="ms-empty">鍔犺浇澶辫触</div>';
            }
        }
    }

    function renderCreateGroupFriends(friendList, friends) {
        if (!friends || !friends.length) {
            friendList.innerHTML = '<div class="ms-empty">鏆傛棤浜掑叧濂藉弸</div>';
            return;
        }

        friendList.innerHTML = '';
        friends.forEach(function (f) {
            var el = document.createElement('div');
            el.className = 'ms-cgp-friend-item';
            var avatarSrc = f.avatar_url ? getAvatarUrl(f.avatar_url) : '';
            el.innerHTML = [
                '<input type="checkbox" class="ms-cgp-check" data-uid="' + f.id + '">',
                '<div class="ms-cgp-friend-avatar-wrap">',
                avatarSrc ? '<img class="ms-cgp-friend-avatar" src="' + avatarSrc + '" referrerpolicy="no-referrer">' : '<span class="ms-cgp-friend-avatar-ph">馃懁</span>',
                '</div>',
                '<span class="ms-cgp-friend-name">' + escapeHtml(f.nickname) + '</span>',
            ].join('');
            el.onclick = function (e) {
                if (e.target.tagName !== 'INPUT') {
                    var cb = el.querySelector('.ms-cgp-check');
                    cb.checked = !cb.checked;
                }
            };
            friendList.appendChild(el);
        });
    }

    async function doCreateGroup() {
        var panel = createGroupPanel;
        var name = panel.querySelector('.ms-cgp-name-input').value.trim();
        if (!name) {
            if (window.showToast) window.showToast('璇疯緭鍏ョ兢鍚嶇О');
            return;
        }

        var checks = panel.querySelectorAll('.ms-cgp-check:checked');
        var memberIds = [];
        checks.forEach(function (cb) { memberIds.push(parseInt(cb.dataset.uid)); });

        var btn = panel.querySelector('.ms-cgp-confirm-btn');
        btn.disabled = true;
        btn.textContent = '鍒涘缓涓?..';

        try {
            var resp = await fetch('/web/api/group', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: getToken(), name: name, member_ids: memberIds }),
            });
            var result = await resp.json();
            if (result && result.status === 'success') {
                removeCache('groups');
                removeCache('conversations');
                hideCreateGroupPanel();
                loadGroups();
                if (window.ChatUI && window.ChatUI.openGroupChat && result.group) {
                    window.ChatUI.openGroupChat(result.group.id, result.group.name);
                }
            } else {
                if (window.showToast) window.showToast(result.error || '鍒涘缓澶辫触');
            }
        } catch (e) {
            if (window.showToast) window.showToast('鍒涘缓澶辫触');
        } finally {
            btn.disabled = false;
            btn.textContent = '鍒涘缓';
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
            hideCreateGroupPanel();
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

    var overlayRenderRevision = 0;
    var closeCleanupTimer = null;

    function isOverlayRevisionActive(revision) {
        return revision === overlayRenderRevision && isOpen();
    }

    function destroyOverlayInstance(targetEl) {
        if (!targetEl) return;
        if (closeCleanupTimer) {
            clearTimeout(closeCleanupTimer);
            closeCleanupTimer = null;
        }
        if (typeof targetEl._swipeCloseCleanup === 'function') {
            targetEl._swipeCloseCleanup();
        }
        if (targetEl.parentNode) {
            targetEl.parentNode.removeChild(targetEl);
        }
        if (overlay === targetEl) {
            overlay = null;
        }
        createGroupPanel = null;
        initialized = false;
    }

    function normalizePreviewText(preview) {
        preview = preview || '';
        try {
            var parsed = JSON.parse(preview);
            if (parsed && parsed.type === 'note_card') {
                return '[笔记卡片]';
            }
            if (parsed && parsed.type === 'follow_card') {
                return (parsed.nickname || '有人') + ' 关注了你';
            }
        } catch (e) {}
        return String(preview || '');
    }

    function renderConversations(convs) {
        if (!overlay) return;
        var list = overlay.querySelector('.ms-conv-list');
        if (!convs || !convs.length) {
            list.innerHTML = '<div class="ms-empty">暂无消息</div>';
            return;
        }

        list.innerHTML = '';
        convs.forEach(function (conv) {
            var item = document.createElement('div');
            item.className = 'ms-conv-item';

            var avatarSrc = conv.peer_avatar ? getAvatarUrl(conv.peer_avatar) : '';
            var preview = normalizePreviewText(conv.last_message);
            if (preview.length > 30) preview = preview.substring(0, 30) + '...';

            var isSystem = conv.peer_id == 0;
            var avatarInner;
            if (isSystem) {
                avatarInner = '<span class="ms-conv-avatar-ph ms-system-icon">铃</span>';
            } else if (avatarSrc) {
                avatarInner = '<img class="ms-conv-avatar" src="' + avatarSrc + '" referrerpolicy="no-referrer">';
            } else {
                avatarInner = '<span class="ms-conv-avatar-ph">人</span>';
            }

            item.innerHTML = [
                '<div class="ms-conv-avatar-wrap">',
                avatarInner,
                '</div>',
                '<div class="ms-conv-info">',
                '  <div class="ms-conv-top">',
                '    <span class="ms-conv-name">' + escapeHtml(conv.peer_name || '系统通知') + '</span>',
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
    }

    function renderFollowing(users) {
        if (!overlay) return;
        var list = overlay.querySelector('.ms-follow-list');
        if (!users || !users.length) {
            list.innerHTML = '<div class="ms-empty">还没有关注任何人</div>';
            return;
        }

        list.innerHTML = '';
        users.forEach(function (user) {
            var item = document.createElement('div');
            item.className = 'ms-follow-item';
            var avatarSrc = user.avatar_url ? getAvatarUrl(user.avatar_url) : '';

            item.innerHTML = [
                '<div class="ms-follow-avatar-wrap">',
                avatarSrc ? '<img class="ms-follow-avatar" src="' + avatarSrc + '" referrerpolicy="no-referrer">' : '<span class="ms-follow-avatar-ph">人</span>',
                '</div>',
                '<div class="ms-follow-info">',
                '  <span class="ms-follow-name">' + escapeHtml(user.nickname || '未命名用户') + '</span>',
                '  <span class="ms-follow-count">' + (user.work_count || 0) + ' 个作品</span>',
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
    }

    function renderGroups(groups) {
        if (!overlay) return;
        var list = overlay.querySelector('.ms-group-list');
        if (!groups || !groups.length) {
            list.innerHTML = '<div class="ms-empty">暂无群组，点击上方创建</div>';
            return;
        }

        list.innerHTML = '';
        groups.forEach(function (group) {
            var item = document.createElement('div');
            item.className = 'ms-group-item';

            var firstChar = String(group.name || '群').charAt(0);
            var preview = normalizePreviewText(group.last_message);
            if (preview.length > 25) preview = preview.substring(0, 25) + '...';
            var senderPrefix = group.last_sender_name ? group.last_sender_name + ': ' : '';

            item.innerHTML = [
                '<div class="ms-group-avatar-wrap">' + escapeHtml(firstChar) + '</div>',
                '<div class="ms-group-info">',
                '  <div class="ms-group-top">',
                '    <span class="ms-group-name">' + escapeHtml(group.name || '未命名群组') + '</span>',
                '    <span class="ms-group-time">' + formatTime(group.last_time) + '</span>',
                '  </div>',
                '  <div class="ms-group-bottom">',
                '    <span class="ms-group-preview">' + escapeHtml(senderPrefix + preview) + '</span>',
                '    <span class="ms-group-member-count">' + (group.member_count || 0) + '人</span>',
                '  </div>',
                '</div>',
            ].join('');

            item.onclick = function () {
                if (window.ChatUI && window.ChatUI.openGroupChat) {
                    window.ChatUI.openGroupChat(group.group_id, group.name);
                }
            };

            list.appendChild(item);
        });
    }

    async function loadConversations() {
        if (!overlay) return;
        var list = overlay.querySelector('.ms-conv-list');
        var cached = peekCache('conversations');
        var revision = overlayRenderRevision;

        if (cached) {
            renderConversations(cached.data);
        } else {
            list.innerHTML = '<div class="ms-loading">加载中...</div>';
        }

        try {
            var resp = await fetch('/web/api/user/conversations?token=' + encodeURIComponent(getToken()));
            var convs = await resp.json();
            if (!isOverlayRevisionActive(revision)) return;
            setCache('conversations', convs || []);
            renderConversations(convs || []);
        } catch (e) {
            if (!cached && isOverlayRevisionActive(revision)) {
                list.innerHTML = '<div class="ms-empty">加载失败</div>';
            }
        }
    }

    async function loadFollowing() {
        if (!overlay) return;
        var list = overlay.querySelector('.ms-follow-list');
        var cached = peekCache('following');
        var revision = overlayRenderRevision;

        if (cached) {
            renderFollowing(cached.data);
        } else {
            list.innerHTML = '<div class="ms-loading">加载中...</div>';
        }

        try {
            var resp = await fetch('/web/api/user/following?token=' + encodeURIComponent(getToken()));
            var users = await resp.json();
            if (!isOverlayRevisionActive(revision)) return;
            setCache('following', users || []);
            renderFollowing(users || []);
        } catch (e) {
            if (!cached && isOverlayRevisionActive(revision)) {
                list.innerHTML = '<div class="ms-empty">加载失败</div>';
            }
        }
    }

    async function loadGroups() {
        if (!overlay) return;
        var list = overlay.querySelector('.ms-group-list');
        var cached = peekCache('groups');
        var revision = overlayRenderRevision;

        if (cached) {
            renderGroups(cached.data);
        } else {
            list.innerHTML = '<div class="ms-loading">加载中...</div>';
        }

        try {
            var resp = await fetch('/web/api/user/groups?token=' + encodeURIComponent(getToken()));
            var groups = await resp.json();
            if (!isOverlayRevisionActive(revision)) return;
            setCache('groups', groups || []);
            renderGroups(groups || []);
        } catch (e) {
            if (!cached && isOverlayRevisionActive(revision)) {
                list.innerHTML = '<div class="ms-empty">加载失败</div>';
            }
        }
    }

    function getOrCreateGroupPanel() {
        if (createGroupPanel && overlay.contains(createGroupPanel) && createGroupPanel.dataset.cleanPanel === 'v2') {
            return createGroupPanel;
        }
        if (createGroupPanel && createGroupPanel.parentNode) {
            createGroupPanel.parentNode.removeChild(createGroupPanel);
        }

        createGroupPanel = document.createElement('div');
        createGroupPanel.className = 'ms-create-group-panel';
        createGroupPanel.dataset.cleanPanel = 'v2';
        createGroupPanel.innerHTML = [
            '<div class="ms-cgp-header">',
            '  <span>创建群组</span>',
            '  <button class="ms-cgp-close" type="button">×</button>',
            '</div>',
            '<div class="ms-cgp-name-row">',
            '  <input class="ms-cgp-name-input" placeholder="输入群名称" maxlength="20">',
            '</div>',
            '<div class="ms-cgp-section-title">选择互关好友</div>',
            '<div class="ms-cgp-friend-list"></div>',
            '<div class="ms-cgp-footer">',
            '  <button class="ms-cgp-confirm-btn" type="button">创建</button>',
            '</div>',
        ].join('\n');

        createGroupPanel.querySelector('.ms-cgp-close').onclick = hideCreateGroupPanel;
        createGroupPanel.querySelector('.ms-cgp-confirm-btn').onclick = doCreateGroup;
        overlay.appendChild(createGroupPanel);
        return createGroupPanel;
    }

    function renderCreateGroupFriends(friendList, friends) {
        if (!friends || !friends.length) {
            friendList.innerHTML = '<div class="ms-empty">暂无互关好友</div>';
            return;
        }

        friendList.innerHTML = '';
        friends.forEach(function (f) {
            var el = document.createElement('div');
            el.className = 'ms-cgp-friend-item';
            var avatarSrc = f.avatar_url ? getAvatarUrl(f.avatar_url) : '';
            el.innerHTML = [
                '<input type="checkbox" class="ms-cgp-check" data-uid="' + f.id + '">',
                '<div class="ms-cgp-friend-avatar-wrap">',
                avatarSrc ? '<img class="ms-cgp-friend-avatar" src="' + avatarSrc + '" referrerpolicy="no-referrer">' : '<span class="ms-cgp-friend-avatar-ph">人</span>',
                '</div>',
                '<span class="ms-cgp-friend-name">' + escapeHtml(f.nickname || '未命名用户') + '</span>',
            ].join('');
            el.onclick = function (e) {
                if (e.target.tagName !== 'INPUT') {
                    var cb = el.querySelector('.ms-cgp-check');
                    cb.checked = !cb.checked;
                }
            };
            friendList.appendChild(el);
        });
    }

    async function showCreateGroupPanel() {
        var panel = getOrCreateGroupPanel();
        panel.querySelector('.ms-cgp-name-input').value = '';
        var friendList = panel.querySelector('.ms-cgp-friend-list');
        var cached = peekCache('mutualFollows');
        var revision = overlayRenderRevision;

        if (cached && cached.data && cached.data.length) {
            renderCreateGroupFriends(friendList, cached.data);
        } else {
            friendList.innerHTML = '<div class="ms-loading">加载中...</div>';
        }

        requestAnimationFrame(function () {
            panel.classList.add('panel-visible');
        });

        try {
            var resp = await fetch('/web/api/user/mutual-follows?token=' + encodeURIComponent(getToken()));
            var friends = await resp.json();
            if (!isOverlayRevisionActive(revision)) return;
            setCache('mutualFollows', friends || []);
            renderCreateGroupFriends(friendList, friends || []);
        } catch (e) {
            if (!cached && isOverlayRevisionActive(revision)) {
                friendList.innerHTML = '<div class="ms-empty">加载失败</div>';
            }
        }
    }

    async function doCreateGroup() {
        if (!createGroupPanel) return;
        var panel = createGroupPanel;
        var name = panel.querySelector('.ms-cgp-name-input').value.trim();
        if (!name) {
            if (window.showToast) window.showToast('请输入群名称');
            return;
        }

        var checks = panel.querySelectorAll('.ms-cgp-check:checked');
        var memberIds = [];
        checks.forEach(function (cb) {
            memberIds.push(parseInt(cb.dataset.uid, 10));
        });

        var btn = panel.querySelector('.ms-cgp-confirm-btn');
        btn.disabled = true;
        btn.textContent = '创建中...';

        try {
            var resp = await fetch('/web/api/group', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: getToken(), name: name, member_ids: memberIds }),
            });
            var result = await resp.json();
            if (result && result.status === 'success') {
                removeCache('groups');
                removeCache('conversations');
                hideCreateGroupPanel();
                loadGroups();
                if (window.ChatUI && window.ChatUI.openGroupChat && result.group) {
                    window.ChatUI.openGroupChat(result.group.id, result.group.name);
                }
            } else if (window.showToast) {
                window.showToast((result && result.error) || '创建失败');
            }
        } catch (e) {
            if (window.showToast) window.showToast('创建失败');
        } finally {
            btn.disabled = false;
            btn.textContent = '创建';
        }
    }

    function bindSwipeClose(el) {
        if (!el || el._msSwipeCloseBound) return;
        if (window.bindOverlaySwipeClose) {
            window.bindOverlaySwipeClose(el, {
                onClose: function () {
                    close({ immediate: true });
                },
                shouldIgnoreTarget: function (target) {
                    return !!(
                        target &&
                        target.closest &&
                        target.closest('button, a, input, textarea, select, .ms-create-group-panel')
                    );
                },
            });
            el._msSwipeCloseBound = true;
        }
    }

    function open(appInstance) {
        currentApp = appInstance;
        overlayRenderRevision += 1;
        if (closeCleanupTimer) {
            clearTimeout(closeCleanupTimer);
            closeCleanupTimer = null;
        }
        var el = getOrCreateOverlay();
        el.style.zIndex = window.nextOverlayZ();
        el.style.transition = '';
        el.style.transform = '';
        el.style.borderRadius = '';
        el.style.opacity = '';
        el.style.visibility = '';
        el.classList.add('ms-visible');
        document.body.style.overflow = 'hidden';
        switchTab('messages');
    }

    function close(options) {
        options = options || {};
        overlayRenderRevision += 1;
        var revision = overlayRenderRevision;
        var targetEl = overlay;

        if (targetEl) {
            if (options.immediate) {
                targetEl.style.transition = 'none';
                targetEl.classList.remove('ms-visible');
                targetEl.style.opacity = '0';
                targetEl.style.visibility = 'hidden';
                destroyOverlayInstance(targetEl);
            } else {
                targetEl.classList.remove('ms-visible');
                targetEl.style.transform = '';
                targetEl.style.borderRadius = '';
                targetEl.style.transition = '';
                if (closeCleanupTimer) {
                    clearTimeout(closeCleanupTimer);
                }
                closeCleanupTimer = setTimeout(function () {
                    closeCleanupTimer = null;
                    if (revision !== overlayRenderRevision) return;
                    destroyOverlayInstance(targetEl);
                }, 320);
            }

            hideCreateGroupPanel();
            if (!window.AuthorProfile || !window.AuthorProfile.isOpen || !window.AuthorProfile.isOpen()) {
                document.body.style.overflow = '';
            }
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
