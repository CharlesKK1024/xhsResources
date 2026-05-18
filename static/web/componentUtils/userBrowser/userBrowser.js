(function () {
    'use strict';

    var container = null;
    var currentApp = null;
    var currentTargetUser = null;
    var currentAuthorId = null;
    var searchTimer = null;
    var initialized = false;

    function init() {
        container = document.getElementById('userBrowserContainer');
        if (!container || initialized) return;
        initialized = true;

        container.innerHTML = [
            '<div class="ub-nav">',
            '  <button class="ub-nav-back">‹</button>',
            '  <span class="ub-nav-title">搜索站内用户</span>',
            '</div>',
            '<div class="ub-view ub-search-view ub-active">',
            '  <div class="ub-search-box">',
            '    <input type="text" class="ub-search-input" placeholder="输入用户昵称搜索..." />',
            '  </div>',
            '  <div class="ub-search-results">',
            '    <div class="ub-empty">输入昵称开始搜索</div>',
            '  </div>',
            '</div>',
            '<div class="ub-view ub-collection-view">',
            '  <div class="ub-user-card"></div>',
            '  <div class="ub-import-all-bar">',
            '    <button class="ub-import-all-btn">导入全部作品</button>',
            '  </div>',
            '  <div class="ub-author-list"></div>',
            '</div>',
            '<div class="ub-view ub-works-view">',
            '  <div class="ub-works-header-info"></div>',
            '  <div class="ub-works-actions">',
            '    <button class="ub-import-author-btn">导入此作者全部</button>',
            '  </div>',
            '  <div class="ub-works-grid"></div>',
            '</div>',
        ].join('\n');

        container.querySelector('.ub-nav-back').onclick = handleBack;

        var input = container.querySelector('.ub-search-input');
        input.addEventListener('input', function () {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(function () {
                doSearch(input.value.trim());
            }, 300);
        });
    }

    function switchView(name) {
        var views = container.querySelectorAll('.ub-view');
        for (var i = 0; i < views.length; i++) {
            views[i].classList.remove('ub-active');
        }
        container.querySelector('.ub-' + name + '-view').classList.add('ub-active');

        var backBtn = container.querySelector('.ub-nav-back');
        if (name === 'search') {
            backBtn.classList.remove('ub-show');
        } else {
            backBtn.classList.add('ub-show');
        }
    }

    function handleBack() {
        var worksView = container.querySelector('.ub-works-view');
        var collectionView = container.querySelector('.ub-collection-view');
        if (worksView.classList.contains('ub-active')) {
            switchView('collection');
            container.querySelector('.ub-nav-title').textContent = currentTargetUser ? currentTargetUser.nickname + ' 的作品集' : '搜索站内用户';
            currentAuthorId = null;
        } else if (collectionView.classList.contains('ub-active')) {
            switchView('search');
            container.querySelector('.ub-nav-title').textContent = '搜索站内用户';
            currentTargetUser = null;
        } else {
            close();
        }
    }

    function getMediaUrl(url) {
        if (!url) return '';
        if (typeof url === 'string' && url.startsWith('/web/cache')) return url;
        if (currentApp && currentApp.getMediaUrl) return currentApp.getMediaUrl(url);
        var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) return url;
        return '/web/api/proxy?url=' + encodeURIComponent(url);
    }

    function formatNum(n) {
        if (!n && n !== 0) return '0';
        n = Number(n);
        if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
        return String(n);
    }

    function getToken() {
        return (currentApp && currentApp.token) || localStorage.getItem('xhs_token') || '';
    }

    async function checkFollowStatus(userId) {
        try {
            var resp = await fetch('/web/api/user/follow/check?target_id=' + userId + '&token=' + encodeURIComponent(getToken()));
            return await resp.json();
        } catch (e) {
            return { is_following: false, is_mutual: false };
        }
    }

    async function toggleFollow(userId, btn) {
        var isFollowing = btn.dataset.following === 'true';
        btn.disabled = true;
        try {
            if (isFollowing) {
                await fetch('/web/api/user/follow?target_id=' + userId + '&token=' + encodeURIComponent(getToken()), { method: 'DELETE' });
                btn.dataset.following = 'false';
                btn.textContent = '关注';
                btn.classList.remove('ub-following');
            } else {
                await fetch('/web/api/user/follow', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ target_id: userId, token: getToken() }),
                });
                btn.dataset.following = 'true';
                btn.textContent = '已关注';
                btn.classList.add('ub-following');
            }
        } catch (e) {
            if (window.showToast) window.showToast('操作失败');
        }
        btn.disabled = false;
    }

    async function doSearch(query) {
        var results = container.querySelector('.ub-search-results');
        if (!query) {
            results.innerHTML = '<div class="ub-empty">输入昵称开始搜索</div>';
            return;
        }
        results.innerHTML = '<div class="ub-loading">搜索中...</div>';
        try {
            var resp = await fetch('/web/api/user/search?q=' + encodeURIComponent(query) + '&token=' + encodeURIComponent(getToken()));
            if (!resp.ok) throw new Error('search failed');
            var users = await resp.json();
            if (!users.length) {
                results.innerHTML = '<div class="ub-empty">未找到用户</div>';
                return;
            }
            results.innerHTML = '';
            users.forEach(function (user) {
                var item = document.createElement('div');
                item.className = 'ub-user-item';
                var avatarSrc = user.avatar_url ? getMediaUrl(user.avatar_url) : '';
                item.innerHTML = [
                    '<div class="ub-user-avatar-wrap">',
                    avatarSrc ? '<img class="ub-user-avatar" src="' + avatarSrc + '" referrerpolicy="no-referrer">' : '<span class="ub-user-avatar-placeholder">👤</span>',
                    '</div>',
                    '<div class="ub-user-info">',
                    '  <span class="ub-user-name">' + escapeHtml(user.nickname) + '</span>',
                    '  <span class="ub-user-count">' + user.work_count + ' 个作品</span>',
                    '</div>',
                    '<button class="ub-follow-btn" data-following="false">关注</button>',
                    '<span class="ub-user-arrow">›</span>',
                ].join('');

                var followBtn = item.querySelector('.ub-follow-btn');
                followBtn.onclick = function (e) {
                    e.stopPropagation();
                    toggleFollow(user.id, followBtn);
                };
                checkFollowStatus(user.id).then(function (status) {
                    if (status.is_following) {
                        followBtn.dataset.following = 'true';
                        followBtn.textContent = '已关注';
                        followBtn.classList.add('ub-following');
                    }
                });

                var avatarWrap = item.querySelector('.ub-user-avatar-wrap');
                avatarWrap.style.cursor = 'pointer';
                avatarWrap.onclick = function (e) {
                    e.stopPropagation();
                    if (window.AuthorProfile && window.AuthorProfile.openUserProfile) {
                        window.AuthorProfile.openUserProfile(user.id, null);
                    }
                };

                item.onclick = function () {
                    openUserCollection(user);
                };
                results.appendChild(item);
            });
        } catch (e) {
            results.innerHTML = '<div class="ub-empty">搜索失败</div>';
        }
    }

    async function openUserCollection(user) {
        currentTargetUser = user;
        container.querySelector('.ub-nav-title').textContent = user.nickname + ' 的作品集';
        switchView('collection');

        var card = container.querySelector('.ub-user-card');
        var avatarSrc = user.avatar_url ? getMediaUrl(user.avatar_url) : '';
        card.innerHTML = [
            '<div class="ub-target-avatar-wrap">',
            avatarSrc ? '<img class="ub-target-avatar" src="' + avatarSrc + '" referrerpolicy="no-referrer">' : '<span class="ub-target-avatar-placeholder">👤</span>',
            '</div>',
            '<div class="ub-target-info">',
            '  <div class="ub-target-name">' + escapeHtml(user.nickname) + '</div>',
            '  <div class="ub-target-count">共 ' + user.work_count + ' 个作品</div>',
            '</div>',
            '<div class="ub-card-actions">',
            '  <button class="ub-follow-btn" data-following="false">关注</button>',
            '  <button class="ub-chat-btn">发私信</button>',
            '</div>',
        ].join('');

        var followBtn = card.querySelector('.ub-follow-btn');
        checkFollowStatus(user.id).then(function (status) {
            if (status.is_following) {
                followBtn.dataset.following = 'true';
                followBtn.textContent = '已关注';
                followBtn.classList.add('ub-following');
            }
        });
        followBtn.onclick = function (e) {
            e.stopPropagation();
            toggleFollow(user.id, followBtn);
        };

        card.querySelector('.ub-chat-btn').onclick = function (e) {
            e.stopPropagation();
            if (window.ChatUI && window.ChatUI.openUserChat) {
                window.ChatUI.openUserChat(user.id, user.nickname, user.avatar_url);
            }
        };

        var authorList = container.querySelector('.ub-author-list');
        authorList.innerHTML = '<div class="ub-loading">加载中...</div>';

        var importAllBtn = container.querySelector('.ub-import-all-btn');
        importAllBtn.onclick = function () { importAll(); };
        importAllBtn.style.display = '';

        try {
            var resp = await fetch('/web/api/user/' + user.id + '/history?token=' + encodeURIComponent(getToken()));
            if (resp.status === 403) {
                importAllBtn.style.display = 'none';
                authorList.innerHTML = '<div class="ub-empty ub-mutual-hint">🔒 相互关注后可以查看对方的典藏作品集</div>';
                return;
            }
            if (!resp.ok) throw new Error('fetch failed');
            var items = await resp.json();
            if (!items.length) {
                authorList.innerHTML = '<div class="ub-empty">该用户没有作品</div>';
                return;
            }
            renderAuthorList(authorList, items);
        } catch (e) {
            importAllBtn.style.display = 'none';
            authorList.innerHTML = '<div class="ub-empty ub-mutual-hint">🔒 相互关注后可以查看对方的典藏作品集</div>';
        }
    }

    function renderAuthorList(listContainer, items) {
        var groups = {};
        var allNoteIds = [];
        items.forEach(function (item) {
            var author = (item.data && item.data.author) || '未知作者';
            var authorId = (item.data && item.data.authorId) || '';
            if (!groups[authorId]) {
                groups[authorId] = { name: author, authorId: authorId, works: [] };
            }
            groups[authorId].works.push(item);
            if (item.data && item.data.id) allNoteIds.push(item.data.id);
        });

        listContainer._allNoteIds = allNoteIds;
        listContainer._groups = groups;

        var sorted = Object.values(groups).sort(function (a, b) {
            return b.works.length - a.works.length;
        });

        listContainer.innerHTML = '';
        sorted.forEach(function (group) {
            var card = document.createElement('div');
            card.className = 'ub-author-card';

            var cover = '';
            for (var i = 0; i < group.works.length; i++) {
                var d = group.works[i].data;
                if (d && (d.cover || d.raw_cover)) {
                    cover = getMediaUrl(d.cover || d.raw_cover);
                    break;
                }
            }

            var noteIds = group.works.map(function (w) { return w.data && w.data.id; }).filter(Boolean);

            card.innerHTML = [
                '<div class="ub-author-cover-wrap">',
                cover ? '<img class="ub-author-cover" src="' + cover + '" loading="lazy" referrerpolicy="no-referrer">' : '<div class="ub-author-cover-empty">🖼️</div>',
                '</div>',
                '<div class="ub-author-meta">',
                '  <div class="ub-author-name">' + escapeHtml(group.name) + '</div>',
                '  <div class="ub-author-count">' + group.works.length + ' 篇</div>',
                '</div>',
                '<button class="ub-author-import-btn" title="导入此作者全部作品">导入</button>',
            ].join('');

            card.querySelector('.ub-author-import-btn').onclick = function (e) {
                e.stopPropagation();
                importNotes(noteIds, this);
            };

            card.onclick = function () {
                openAuthorWorks(group);
            };

            listContainer.appendChild(card);
        });
    }

    function openAuthorWorks(group) {
        currentAuthorId = group.authorId;
        container.querySelector('.ub-nav-title').textContent = group.name;
        switchView('works');

        var info = container.querySelector('.ub-works-header-info');
        info.innerHTML = '<span class="ub-works-author-label">' + escapeHtml(group.name) + ' · ' + group.works.length + ' 篇</span>';

        var noteIds = group.works.map(function (w) { return w.data && w.data.id; }).filter(Boolean);
        container.querySelector('.ub-import-author-btn').onclick = function () {
            importNotes(noteIds, this);
        };

        var grid = container.querySelector('.ub-works-grid');
        grid.innerHTML = '';
        group.works.forEach(function (work) {
            var note = work.data;
            if (!note) return;
            var card = document.createElement('div');
            card.className = 'ub-work-card';
            var coverSrc = getMediaUrl(note.cover || note.raw_cover || '');
            var isVideo = note.type === '视频' || (note.videos && note.videos.length > 0);

            card.innerHTML = [
                '<div class="ub-work-cover">',
                coverSrc ? '<img src="' + coverSrc + '" loading="lazy" referrerpolicy="no-referrer">' : '<div class="ub-work-cover-empty">🖼️</div>',
                isVideo ? '<span class="ub-video-badge">▶</span>' : '',
                '</div>',
                '<div class="ub-work-info">',
                '  <div class="ub-work-title">' + escapeHtml(note.title || '无标题') + '</div>',
                '  <div class="ub-work-meta">',
                '    <span>❤️ ' + formatNum(note.likeCount) + '</span>',
                '    <button class="ub-work-import-btn">导入</button>',
                '  </div>',
                '</div>',
            ].join('');

            card.querySelector('.ub-work-import-btn').onclick = function (e) {
                e.stopPropagation();
                importNotes([note.id], this);
            };

            card.onclick = function () {
                if (currentApp && currentApp.openNoteDetail) {
                    currentApp.openNoteDetail(note, card);
                }
            };

            grid.appendChild(card);
        });
    }

    async function importNotes(noteIds, btn) {
        if (!currentTargetUser || !noteIds.length) return;
        var originalText = btn.textContent;
        btn.textContent = '导入中...';
        btn.disabled = true;
        try {
            var resp = await fetch('/web/api/import/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source_user_id: currentTargetUser.id,
                    note_ids: noteIds,
                    token: getToken(),
                }),
            });
            if (!resp.ok) {
                var err = await resp.json().catch(function () { return {}; });
                throw new Error(err.error || '导入失败');
            }
            var result = await resp.json();
            var msg = '已导入 ' + result.imported + ' 个作品';
            if (result.skipped > 0) msg += '，跳过 ' + result.skipped + ' 个已有';
            if (window.showTip) window.showTip(msg, 'success', 3000);
            btn.textContent = '✅ 已导入';
            if (currentApp) currentApp._historyLoaded = false;
        } catch (e) {
            if (window.showTip) window.showTip(e.message, 'error');
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }

    async function importAll() {
        var list = container.querySelector('.ub-author-list');
        var allIds = list._allNoteIds;
        if (!allIds || !allIds.length) return;
        var btn = container.querySelector('.ub-import-all-btn');
        await importNotes(allIds, btn);
    }

    function escapeHtml(s) {
        if (!s) return '';
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function open(appInstance) {
        currentApp = appInstance;
        currentTargetUser = null;
        currentAuthorId = null;
        init();
        if (!container) return;

        container.querySelector('.ub-nav-title').textContent = '搜索站内用户';
        container.querySelector('.ub-search-input').value = '';
        container.querySelector('.ub-search-results').innerHTML = '<div class="ub-empty">输入昵称开始搜索</div>';
        switchView('search');
        container.style.display = '';

        var toggleBtn = document.getElementById('browseUsersBtn');
        if (toggleBtn) toggleBtn.classList.add('ub-active-toggle');

        setTimeout(function () {
            container.querySelector('.ub-search-input').focus();
        }, 100);
    }

    function close() {
        if (!container) return;
        container.style.display = 'none';
        currentTargetUser = null;
        currentAuthorId = null;

        var toggleBtn = document.getElementById('browseUsersBtn');
        if (toggleBtn) toggleBtn.classList.remove('ub-active-toggle');
    }

    function isOpen() {
        return container && container.style.display !== 'none';
    }

    window.UserBrowser = { open: open, close: close, isOpen: isOpen };
})();
