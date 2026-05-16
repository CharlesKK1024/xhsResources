(function () {
    'use strict';

    var ICONS = {
        error: '❌',
        success: '✅',
        warning: '⚠️',
        info: 'ℹ️',
    };

    var tipTimer = null;
    var tipEl = null;

    function getOrCreateTip() {
        if (tipEl && document.body.contains(tipEl)) return tipEl;
        tipEl = document.createElement('div');
        tipEl.className = 'xhs-tip';
        tipEl.innerHTML =
            '<span class="xhs-tip__icon"></span>' +
            '<span class="xhs-tip__text"></span>' +
            '<button class="xhs-tip__close">✕</button>';
        tipEl.querySelector('.xhs-tip__close').onclick = function () {
            hide();
        };
        document.body.appendChild(tipEl);
        return tipEl;
    }

    function hide() {
        if (tipTimer) {
            clearTimeout(tipTimer);
            tipTimer = null;
        }
        if (tipEl) {
            tipEl.classList.remove('xhs-tip--visible');
        }
    }

    window.showTip = function (message, type, duration) {
        if (!type) type = 'info';
        if (duration === undefined || duration === null) duration = 3000;

        if (tipTimer) {
            clearTimeout(tipTimer);
            tipTimer = null;
        }

        var el = getOrCreateTip();
        el.className = 'xhs-tip xhs-tip--' + type;
        el.querySelector('.xhs-tip__icon').textContent = ICONS[type] || ICONS.info;
        el.querySelector('.xhs-tip__text').textContent = message;

        requestAnimationFrame(function () {
            el.classList.add('xhs-tip--visible');
        });

        if (duration > 0) {
            tipTimer = setTimeout(function () {
                hide();
                tipTimer = null;
            }, duration);
        }
    };

    window.hideTip = hide;
})();
