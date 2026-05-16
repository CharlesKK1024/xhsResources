(function () {
    'use strict';

    var overlay = null;
    var currentAuthorId = null;
    var currentAuthorName = '';
    var currentAvatarUrl = '';
    var token = '';
    var contextMenu = null;
    var notePicker = null;
    var noteCache = {};
    var pickerDebounceTimer = null;

    var currentMode = 'author';
    var currentPeerId = null;
    var pollTimer = null;
    var lastMessageId = 0;
    var lastRawTime = null;

    var REACTIONS = [
        { emoji: '🐱', label: '棒' },
        { emoji: '😹', label: '笑哭了' },
        { emoji: '😻', label: '心心眼' },
        { emoji: '🙀', label: '呃' },
        { emoji: '😿', label: '抽泣' },
        { emoji: '😸', label: '开心' },
    ];

    function getOrCreateOverlay() {
        if (overlay && document.body.contains(overlay)) return overlay;
        overlay = document.createElement('div');
        overlay.className = 'chat-overlay';

        var reactionsHtml = REACTIONS.map(function (r) {
            return '<div class="chat-reaction-item" data-emoji="' + r.emoji + '">' +
                '<span class="chat-reaction-emoji">' + r.emoji + '</span>' +
                '<span class="chat-reaction-label">' + r.label + '</span>' +
            '</div>';
        }).join('');

        overlay.innerHTML =
            '<div class="chat-header">' +
                '<button class="chat-back">‹</button>' +
                '<img class="chat-avatar-small" src="" referrerpolicy="no-referrer">' +
                '<span class="chat-title"></span>' +
            '</div>' +
            '<div class="chat-messages"></div>' +
            '<div class="chat-reactions">' + reactionsHtml + '</div>' +
            '<div class="chat-input-bar">' +
                '<button class="chat-voice-btn">🎙</button>' +
                '<input class="chat-input" placeholder="发消息...">' +
                '<button class="chat-emoji-btn">😊</button>' +
                '<button class="chat-extra-btn">⊕</button>' +
                '<button class="chat-send-btn">发送</button>' +
            '</div>';

        document.body.appendChild(overlay);

        overlay.querySelector('.chat-back').onclick = close;

        var input = overlay.querySelector('.chat-input');
        var sendBtn = overlay.querySelector('.chat-send-btn');

        input.addEventListener('input', function () {
            sendBtn.classList.toggle('can-send', input.value.trim().length > 0);
        });

        input.addEventListener('keypress', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        sendBtn.onclick = sendMessage;

        overlay.querySelector('.chat-extra-btn').onclick = showNotePicker;

        overlay.querySelectorAll('.chat-reaction-item').forEach(function (item) {
            item.onclick = function () {
                var emoji = item.dataset.emoji;
                input.value += emoji;
                input.focus();
                sendBtn.classList.toggle('can-send', input.value.trim().length > 0);
            };
        });

        overlay.addEventListener('click', function (e) {
            if (contextMenu && !contextMenu.contains(e.target)) {
                hideContextMenu();
            }
        });

        bindSwipeClose(overlay);

        return overlay;
    }

    function bindSwipeClose(el) {
        var startX = 0, startY = 0, gesture = '', startTime = 0;

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

        var mouseDown = false, mouseStartX = 0, mouseStartTime = 0;

        el.addEventListener('mousedown', function (e) {
            if (e.target.closest('button, a, input, .chat-msg-bubble, .chat-note-card')) return;
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

    // ========== Message Content Rendering ==========

    function renderMessageContent(content) {
        try {
            var parsed = JSON.parse(content);
            if (parsed && parsed.type === 'note_card') {
                return renderNoteCardBubble(parsed);
            }
        } catch (e) {}
        return '<div class="chat-msg-bubble">' + escapeHtml(content) + '</div>';
    }

    function renderNoteCardBubble(card) {
        var coverUrl = getMediaUrl(card.cover || '');
        return '<div class="chat-note-card" data-note-id="' + escapeAttr(card.noteId || '') + '">' +
            '<img class="chat-note-card-cover" src="' + coverUrl + '" referrerpolicy="no-referrer">' +
            '<div class="chat-note-card-info">' +
                '<div class="chat-note-card-title">' + escapeHtml(card.title || '无标题') + '</div>' +
                '<div class="chat-note-card-author">' + escapeHtml(card.author || '') + '</div>' +
            '</div>' +
        '</div>';
    }

    // ========== Long Press Context Menu ==========

    function bindLongPress(msgEl, messageId, isSelf) {
        var timer = null;
        var startX = 0, startY = 0;

        function onStart(e) {
            var point = e.touches ? e.touches[0] : e;
            startX = point.clientX;
            startY = point.clientY;
            timer = setTimeout(function () {
                showContextMenu(msgEl, messageId, isSelf);
            }, 500);
        }

        function onMove(e) {
            if (!timer) return;
            var point = e.touches ? e.touches[0] : e;
            if (Math.abs(point.clientX - startX) > 10 || Math.abs(point.clientY - startY) > 10) {
                clearTimeout(timer);
                timer = null;
            }
        }

        function onEnd() {
            clearTimeout(timer);
            timer = null;
        }

        msgEl.addEventListener('touchstart', onStart, { passive: true });
        msgEl.addEventListener('touchmove', onMove, { passive: true });
        msgEl.addEventListener('touchend', onEnd, { passive: true });
        msgEl.addEventListener('touchcancel', onEnd, { passive: true });
        msgEl.addEventListener('mousedown', onStart);
        msgEl.addEventListener('mousemove', onMove);
        msgEl.addEventListener('mouseup', onEnd);
    }

    function getMessageText(msgEl) {
        var bubble = msgEl.querySelector('.chat-msg-bubble');
        if (bubble) return bubble.textContent || '';
        var card = msgEl.querySelector('.chat-note-card');
        if (card) {
            var title = card.querySelector('.chat-note-card-title');
            return title ? title.textContent : '[笔记卡片]';
        }
        return '';
    }

    function showContextMenu(msgEl, messageId, isSelf) {
        hideContextMenu();

        contextMenu = document.createElement('div');
        contextMenu.className = 'chat-context-menu';

        var items = [
            { icon: '📋', label: '复制', cls: 'ctx-copy' },
            { icon: '↩️', label: '引用', cls: 'ctx-quote' },
        ];
        if (isSelf && messageId) {
            items.push({ icon: '🗑️', label: '删除', cls: 'ctx-delete' });
        }

        contextMenu.innerHTML = items.map(function (it) {
            return '<div class="chat-context-item ' + it.cls + '">' +
                '<span class="ctx-icon">' + it.icon + '</span>' +
                '<span class="ctx-label">' + it.label + '</span>' +
            '</div>';
        }).join('');

        contextMenu.querySelector('.ctx-copy').onclick = function (e) {
            e.stopPropagation();
            var text = getMessageText(msgEl);
            if (text && navigator.clipboard) {
                navigator.clipboard.writeText(text).then(function () {
                    if (window.showToast) window.showToast('已复制');
                });
            } else if (text) {
                var ta = document.createElement('textarea');
                ta.value = text;
                ta.style.cssText = 'position:fixed;left:-9999px';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                if (window.showToast) window.showToast('已复制');
            }
            hideContextMenu();
        };

        contextMenu.querySelector('.ctx-quote').onclick = function (e) {
            e.stopPropagation();
            quoteMessage(msgEl);
            hideContextMenu();
        };

        var delBtn = contextMenu.querySelector('.ctx-delete');
        if (delBtn) {
            delBtn.onclick = function (e) {
                e.stopPropagation();
                deleteMessage(msgEl, messageId);
            };
        }

        var rect = msgEl.querySelector('.chat-msg-bubble, .chat-note-card');
        if (!rect) rect = msgEl;
        var r = rect.getBoundingClientRect();

        document.body.appendChild(contextMenu);

        var menuW = contextMenu.offsetWidth;
        var menuH = contextMenu.offsetHeight;
        var left = r.left + r.width / 2 - menuW / 2;
        var top = r.top - menuH - 8;

        if (top < 10) top = r.bottom + 8;
        if (left < 5) left = 5;
        if (left + menuW > window.innerWidth - 5) left = window.innerWidth - menuW - 5;

        contextMenu.style.left = left + 'px';
        contextMenu.style.top = top + 'px';
    }

    function quoteMessage(msgEl) {
        if (!overlay) return;
        var text = getMessageText(msgEl);
        if (!text) return;
        var input = overlay.querySelector('.chat-input');
        var quoted = '「' + (text.length > 40 ? text.substring(0, 40) + '...' : text) + '」\n';
        input.value = quoted;
        input.focus();
        var sendBtn = overlay.querySelector('.chat-send-btn');
        if (sendBtn) sendBtn.classList.add('can-send');
    }

    function hideContextMenu() {
        if (contextMenu && contextMenu.parentNode) {
            contextMenu.parentNode.removeChild(contextMenu);
        }
        contextMenu = null;
    }

    async function deleteMessage(msgEl, messageId) {
        hideContextMenu();

        try {
            var url = currentMode === 'user'
                ? '/web/api/user/message/' + messageId + '?token=' + encodeURIComponent(token)
                : '/web/api/author/message/' + messageId + '?token=' + encodeURIComponent(token);
            var resp = await fetch(url, { method: 'DELETE' });
            if (resp.ok) {
                var prev = msgEl.previousElementSibling;
                if (prev && prev.classList.contains('chat-time-divider')) {
                    var next = msgEl.nextElementSibling;
                    if (!next || next.classList.contains('chat-time-divider') || !next.classList.contains('chat-msg')) {
                        prev.remove();
                    }
                }
                msgEl.remove();
                if (window.showToast) window.showToast('已删除');
            }
        } catch (e) {
            if (window.showToast) window.showToast('删除失败');
        }
    }

    // ========== Note Card Click ==========

    function bindNoteCardClick(container) {
        container.addEventListener('click', function (e) {
            var card = e.target.closest('.chat-note-card');
            if (!card) return;

            var noteId = card.dataset.noteId;
            if (!noteId) return;

            var cached = noteCache[noteId];
            if (cached && window.xhsApp && window.xhsApp.openNoteDetail) {
                window.xhsApp.openNoteDetail(cached, card);
                return;
            }

            fetchNoteForCard(noteId, card);
        });
    }

    async function fetchNoteForCard(noteId, cardEl) {
        try {
            var resp = await fetch(
                '/web/api/history?search=' + encodeURIComponent(noteId) + '&token=' + encodeURIComponent(token)
            );
            var data = await resp.json();
            if (data && data.length) {
                for (var i = 0; i < data.length; i++) {
                    if (data[i].data && data[i].data.id === noteId) {
                        noteCache[noteId] = data[i].data;
                        if (window.xhsApp && window.xhsApp.openNoteDetail) {
                            window.xhsApp.openNoteDetail(data[i].data, cardEl);
                        }
                        return;
                    }
                }
            }
            var resp2 = await fetch('/web/api/note/lookup?note_id=' + encodeURIComponent(noteId));
            if (resp2.ok) {
                var noteData = await resp2.json();
                if (noteData && noteData.id) {
                    noteCache[noteId] = noteData;
                    if (window.xhsApp && window.xhsApp.openNoteDetail) {
                        window.xhsApp.openNoteDetail(noteData, cardEl);
                    }
                    return;
                }
            }
            if (window.showToast) window.showToast('找不到该笔记');
        } catch (e) {
            if (window.showToast) window.showToast('加载失败');
        }
    }

    // ========== Note Picker (⊕ button) ==========

    function getOrCreatePicker() {
        if (notePicker && overlay.contains(notePicker)) return notePicker;
        notePicker = document.createElement('div');
        notePicker.className = 'chat-note-picker';
        notePicker.innerHTML =
            '<div class="chat-picker-header">' +
                '<span>选择笔记</span>' +
                '<button class="chat-picker-close">✕</button>' +
            '</div>' +
            '<div class="chat-picker-search">' +
                '<input placeholder="搜索作者/作品...">' +
            '</div>' +
            '<div class="chat-picker-results">' +
                '<div class="chat-picker-loading">加载中...</div>' +
            '</div>';

        notePicker.querySelector('.chat-picker-close').onclick = hideNotePicker;

        var searchInput = notePicker.querySelector('.chat-picker-search input');
        searchInput.addEventListener('input', function () {
            clearTimeout(pickerDebounceTimer);
            pickerDebounceTimer = setTimeout(function () {
                loadPickerResults(searchInput.value.trim());
            }, 500);
        });

        overlay.appendChild(notePicker);
        return notePicker;
    }

    function showNotePicker() {
        var picker = getOrCreatePicker();
        picker.querySelector('.chat-picker-search input').value = '';
        loadPickerResults('');
        requestAnimationFrame(function () {
            picker.classList.add('picker-visible');
        });
    }

    function hideNotePicker() {
        if (notePicker) {
            notePicker.classList.remove('picker-visible');
        }
    }

    async function loadPickerResults(search) {
        if (!notePicker) return;
        var resultsEl = notePicker.querySelector('.chat-picker-results');
        resultsEl.innerHTML = '<div class="chat-picker-loading">加载中...</div>';

        try {
            var url = '/web/api/history?token=' + encodeURIComponent(token);
            if (search) url += '&search=' + encodeURIComponent(search);

            var resp = await fetch(url);
            var data = await resp.json();

            if (!data || !data.length) {
                resultsEl.innerHTML = '<div class="chat-picker-loading">没有找到作品</div>';
                return;
            }

            resultsEl.innerHTML = '';
            data.forEach(function (item) {
                var note = item.data;
                if (!note) return;

                noteCache[note.id] = note;

                var el = document.createElement('div');
                el.className = 'chat-picker-item';
                el.innerHTML =
                    '<img class="chat-picker-cover" src="' + getMediaUrl(note.cover || '') + '" ' +
                        'loading="lazy" referrerpolicy="no-referrer">' +
                    '<div class="chat-picker-info">' +
                        '<div class="chat-picker-title">' + escapeHtml(note.title || '无标题') + '</div>' +
                        '<div class="chat-picker-author">' + escapeHtml(note.author || '') + '</div>' +
                    '</div>';

                el.onclick = function () {
                    sendNoteCard(note);
                    hideNotePicker();
                };

                resultsEl.appendChild(el);
            });
        } catch (e) {
            resultsEl.innerHTML = '<div class="chat-picker-loading">加载失败</div>';
        }
    }

    async function sendNoteCard(note) {
        if (currentMode === 'user' && !currentPeerId) return;
        if (currentMode === 'author' && !currentAuthorId) return;

        var cardData = {
            type: 'note_card',
            noteId: note.id,
            title: note.title || '无标题',
            cover: note.cover || note.raw_cover || '',
            author: note.author || '',
            authorId: note.authorId || '',
        };
        var content = JSON.stringify(cardData);

        var messagesEl = overlay.querySelector('.chat-messages');
        var empty = messagesEl.querySelector('.chat-empty');
        if (empty) empty.remove();

        var msgEl = document.createElement('div');
        msgEl.className = 'chat-msg msg-self';
        msgEl.innerHTML = renderNoteCardBubble(cardData);
        messagesEl.appendChild(msgEl);
        scrollToBottom();

        try {
            var url, body;
            if (currentMode === 'user') {
                url = '/web/api/user/message';
                body = { receiver_id: currentPeerId, content: content, token: token };
            } else {
                url = '/web/api/author/message';
                body = { author_id: currentAuthorId, content: content, token: token };
            }
            var resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            var result = await resp.json();
            if (result && result.status === 'success') {
                bindLongPress(msgEl, result.id || 0, true);
                if (result.id && result.id > lastMessageId) {
                    lastMessageId = result.id;
                }
            }
        } catch (e) {
            if (window.showToast) window.showToast('发送失败');
        }
    }

    // ========== Core Functions ==========

    async function open(authorId, authorName, avatarUrl) {
        currentMode = 'author';
        currentAuthorId = authorId;
        currentPeerId = null;
        currentAuthorName = authorName;
        currentAvatarUrl = avatarUrl || '';
        token = localStorage.getItem('xhs_token') || '';

        var el = getOrCreateOverlay();
        el.style.zIndex = window.nextOverlayZ();
        el.querySelector('.chat-title').textContent = authorName;

        var avatarImg = el.querySelector('.chat-avatar-small');
        avatarImg.src = getMediaUrl(currentAvatarUrl);

        el.querySelector('.chat-messages').innerHTML = '';
        el.querySelector('.chat-input').value = '';
        el.querySelector('.chat-send-btn').classList.remove('can-send');
        hideNotePicker();
        hideContextMenu();
        stopPolling();

        el.classList.add('chat-visible');
        document.body.style.overflow = 'hidden';

        bindNoteCardClick(el.querySelector('.chat-messages'));

        await loadMessages();
    }

    async function openUserChat(peerId, peerName, peerAvatar) {
        currentMode = 'user';
        currentPeerId = peerId;
        currentAuthorId = null;
        currentAuthorName = peerName;
        currentAvatarUrl = peerAvatar || '';
        token = localStorage.getItem('xhs_token') || '';
        lastMessageId = 0;

        var el = getOrCreateOverlay();
        el.style.zIndex = window.nextOverlayZ();
        el.querySelector('.chat-title').textContent = peerName;

        var avatarImg = el.querySelector('.chat-avatar-small');
        avatarImg.src = peerAvatar ? getMediaUrl(peerAvatar) : '';

        el.querySelector('.chat-messages').innerHTML = '';
        el.querySelector('.chat-input').value = '';
        el.querySelector('.chat-send-btn').classList.remove('can-send');
        hideNotePicker();
        hideContextMenu();

        el.classList.add('chat-visible');
        document.body.style.overflow = 'hidden';

        bindNoteCardClick(el.querySelector('.chat-messages'));

        await loadMessages();
        startPolling();
    }

    async function loadMessages() {
        var messagesEl = overlay.querySelector('.chat-messages');

        try {
            var url;
            if (currentMode === 'user') {
                if (!currentPeerId) return;
                url = '/web/api/user/messages?peer_id=' + currentPeerId + '&token=' + encodeURIComponent(token);
            } else {
                if (!currentAuthorId) return;
                url = '/web/api/author/messages?author_id=' + encodeURIComponent(currentAuthorId) + '&token=' + encodeURIComponent(token);
            }

            var resp = await fetch(url);
            var messages = await resp.json();

            if (!messages || !messages.length) {
                messagesEl.innerHTML = '<div class="chat-empty">暂无消息，发送第一条吧</div>';
                return;
            }

            messagesEl.innerHTML = '';
            var lastTime = null;

            messages.forEach(function (msg) {
                if (msg.time && shouldShowTime(lastTime, msg.time)) {
                    var divider = document.createElement('div');
                    divider.className = 'chat-time-divider';
                    divider.textContent = formatTime(msg.time);
                    messagesEl.appendChild(divider);
                }
                lastTime = msg.time;

                var msgEl = document.createElement('div');
                msgEl.className = 'chat-msg ' + (msg.is_self ? 'msg-self' : 'msg-other');

                var avatarSrc = msg.is_self ? '' : getMediaUrl(currentAvatarUrl);
                var avatarHtml = avatarSrc
                    ? '<img class="chat-msg-avatar" src="' + avatarSrc + '" referrerpolicy="no-referrer">'
                    : '';

                msgEl.innerHTML = avatarHtml + renderMessageContent(msg.content);

                if (msg.id) {
                    bindLongPress(msgEl, msg.id, msg.is_self);
                }

                messagesEl.appendChild(msgEl);

                if (msg.id && msg.id > lastMessageId) {
                    lastMessageId = msg.id;
                }
            });

            lastRawTime = lastTime;
            scrollToBottom();
        } catch (e) {
            messagesEl.innerHTML = '<div class="chat-empty">加载消息失败</div>';
        }
    }

    async function sendMessage() {
        var input = overlay.querySelector('.chat-input');
        var content = input.value.trim();
        if (!content) return;
        if (currentMode === 'user' && !currentPeerId) return;
        if (currentMode === 'author' && !currentAuthorId) return;

        input.value = '';
        overlay.querySelector('.chat-send-btn').classList.remove('can-send');

        var messagesEl = overlay.querySelector('.chat-messages');
        var empty = messagesEl.querySelector('.chat-empty');
        if (empty) empty.remove();

        var msgEl = document.createElement('div');
        msgEl.className = 'chat-msg msg-self';
        msgEl.innerHTML = '<div class="chat-msg-bubble">' + escapeHtml(content) + '</div>';
        messagesEl.appendChild(msgEl);
        scrollToBottom();

        try {
            var url, body;
            if (currentMode === 'user') {
                url = '/web/api/user/message';
                body = { receiver_id: currentPeerId, content: content, token: token };
            } else {
                url = '/web/api/author/message';
                body = { author_id: currentAuthorId, content: content, token: token };
            }
            var resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            var result = await resp.json();
            if (result && result.status === 'success') {
                bindLongPress(msgEl, result.id || 0, true);
                if (result.id && result.id > lastMessageId) {
                    lastMessageId = result.id;
                }
            }
        } catch (e) {
            if (window.showToast) window.showToast('发送失败');
        }

        input.focus();
    }

    function scrollToBottom() {
        var el = overlay.querySelector('.chat-messages');
        requestAnimationFrame(function () {
            el.scrollTop = el.scrollHeight;
        });
    }

    function shouldShowTime(prev, curr) {
        if (!prev) return true;
        var d1 = new Date(prev);
        var d2 = new Date(curr);
        return (d2 - d1) > 300000;
    }

    function formatTime(timeStr) {
        if (!timeStr) return '';
        var d = new Date(timeStr);
        var now = new Date();
        var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
        var time = pad(d.getHours()) + ':' + pad(d.getMinutes());
        if (d.toDateString() === now.toDateString()) return time;
        return (d.getMonth() + 1) + '-' + d.getDate() + ' ' + time;
    }

    function escapeHtml(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function escapeAttr(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;');
    }

    function close() {
        stopPolling();
        if (overlay) {
            overlay.classList.remove('chat-visible');
            hideNotePicker();
            hideContextMenu();
            if (!window.AuthorProfile || !window.AuthorProfile.isOpen()) {
                document.body.style.overflow = '';
            }
        }
        currentAuthorId = null;
        currentPeerId = null;
        currentMode = 'author';
    }

    function isOpen() {
        return overlay && overlay.classList.contains('chat-visible');
    }

    function startPolling() {
        stopPolling();
        pollTimer = setInterval(async function () {
            if (currentMode !== 'user' || !currentPeerId) return;
            try {
                var resp = await fetch(
                    '/web/api/user/messages/poll?peer_id=' + currentPeerId +
                    '&after_id=' + lastMessageId +
                    '&token=' + encodeURIComponent(token)
                );
                var newMsgs = await resp.json();
                if (newMsgs && newMsgs.length) {
                    appendNewMessages(newMsgs);
                }
            } catch (e) {}
        }, 3000);
    }

    function stopPolling() {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    }

    function appendNewMessages(messages) {
        if (!overlay) return;
        var messagesEl = overlay.querySelector('.chat-messages');
        var empty = messagesEl.querySelector('.chat-empty');
        if (empty) empty.remove();

        messages.forEach(function (msg) {
            if (msg.id <= lastMessageId) return;

            if (msg.time && shouldShowTime(lastRawTime, msg.time)) {
                var divider = document.createElement('div');
                divider.className = 'chat-time-divider';
                divider.textContent = formatTime(msg.time);
                messagesEl.appendChild(divider);
            }
            lastRawTime = msg.time;

            var msgEl = document.createElement('div');
            msgEl.className = 'chat-msg ' + (msg.is_self ? 'msg-self' : 'msg-other');

            var avatarSrc = msg.is_self ? '' : getMediaUrl(currentAvatarUrl);
            var avatarHtml = avatarSrc
                ? '<img class="chat-msg-avatar" src="' + avatarSrc + '" referrerpolicy="no-referrer">'
                : '';

            msgEl.innerHTML = avatarHtml + renderMessageContent(msg.content);

            if (msg.id) {
                bindLongPress(msgEl, msg.id, msg.is_self);
            }

            messagesEl.appendChild(msgEl);
            lastMessageId = msg.id;
        });

        scrollToBottom();
    }

    window.ChatUI = {
        open: open,
        openUserChat: openUserChat,
        close: close,
        isOpen: isOpen,
    };
})();
