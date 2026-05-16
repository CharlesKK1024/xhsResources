(function () {
    'use strict';

    var overlay = null;
    var currentAuthorId = null;
    var currentAuthorName = '';
    var currentAvatarUrl = '';
    var token = '';

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

        overlay.querySelectorAll('.chat-reaction-item').forEach(function (item) {
            item.onclick = function () {
                var emoji = item.dataset.emoji;
                input.value += emoji;
                input.focus();
                sendBtn.classList.toggle('can-send', input.value.trim().length > 0);
            };
        });

        return overlay;
    }

    function getMediaUrl(url) {
        if (!url) return '';
        if (typeof url === 'string' && url.startsWith('/web/cache')) return url;
        var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) return url;
        return '/web/api/proxy?url=' + encodeURIComponent(url);
    }

    async function open(authorId, authorName, avatarUrl) {
        currentAuthorId = authorId;
        currentAuthorName = authorName;
        currentAvatarUrl = avatarUrl || '';
        token = localStorage.getItem('xhs_token') || '';

        var el = getOrCreateOverlay();
        el.querySelector('.chat-title').textContent = authorName;

        var avatarImg = el.querySelector('.chat-avatar-small');
        avatarImg.src = getMediaUrl(currentAvatarUrl);

        el.querySelector('.chat-messages').innerHTML = '';
        el.querySelector('.chat-input').value = '';
        el.querySelector('.chat-send-btn').classList.remove('can-send');

        el.classList.add('chat-visible');
        document.body.style.overflow = 'hidden';

        await loadMessages();
    }

    async function loadMessages() {
        if (!currentAuthorId) return;
        var messagesEl = overlay.querySelector('.chat-messages');

        try {
            var resp = await fetch(
                '/web/api/author/messages?author_id=' + encodeURIComponent(currentAuthorId) +
                '&token=' + encodeURIComponent(token)
            );
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

                msgEl.innerHTML = avatarHtml +
                    '<div class="chat-msg-bubble">' + escapeHtml(msg.content) + '</div>';

                messagesEl.appendChild(msgEl);
            });

            scrollToBottom();
        } catch (e) {
            messagesEl.innerHTML = '<div class="chat-empty">加载消息失败</div>';
        }
    }

    async function sendMessage() {
        var input = overlay.querySelector('.chat-input');
        var content = input.value.trim();
        if (!content || !currentAuthorId) return;

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
            await fetch('/web/api/author/message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    author_id: currentAuthorId,
                    content: content,
                    token: token,
                }),
            });
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
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function close() {
        if (overlay) {
            overlay.classList.remove('chat-visible');
            if (!window.AuthorProfile || !window.AuthorProfile.isOpen()) {
                document.body.style.overflow = '';
            }
        }
        currentAuthorId = null;
    }

    function isOpen() {
        return overlay && overlay.classList.contains('chat-visible');
    }

    window.ChatUI = {
        open: open,
        close: close,
        isOpen: isOpen,
    };
})();
