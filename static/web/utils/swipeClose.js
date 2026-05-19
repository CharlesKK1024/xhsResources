(function () {
    'use strict';

    function bindOverlaySwipeClose(el, options) {
        if (!el || el._swipeCloseBound) return el && el._swipeCloseCleanup;

        options = options || {};

        var threshold = typeof options.threshold === 'number' ? options.threshold : 0.35;
        var velocityThreshold = typeof options.velocityThreshold === 'number' ? options.velocityThreshold : 0.5;
        var dragRatio = typeof options.dragRatio === 'number' ? options.dragRatio : 0.45;
        var animationMs = typeof options.animationMs === 'number' ? options.animationMs : 300;
        var transition = options.transition || 'all 0.3s cubic-bezier(0.23, 1, 0.32, 1)';
        var shouldIgnoreTarget = typeof options.shouldIgnoreTarget === 'function'
            ? options.shouldIgnoreTarget
            : function () { return false; };
        var onClose = typeof options.onClose === 'function' ? options.onClose : function () {};

        var startX = 0;
        var startY = 0;
        var startTime = 0;
        var gesture = '';
        var mouseDown = false;
        var mouseStartX = 0;
        var mouseStartY = 0;
        var mouseStartTime = 0;

        function resetStyles() {
            el.style.transform = '';
            el.style.borderRadius = '';
            el.style.transition = '';
        }

        function applyProgress(dx) {
            var progress = Math.min(dx / (window.innerWidth * dragRatio), 1);
            var scale = 1 - progress * 0.15;
            var radius = progress * 20;
            el.style.transform = 'translateX(' + dx + 'px) scale(' + scale + ')';
            el.style.borderRadius = radius + 'px';
        }

        function finishGesture(dx, duration) {
            var progress = dx / (window.innerWidth * dragRatio);
            var velocity = dx / Math.max(duration, 1);

            if (progress > threshold || velocity > velocityThreshold) {
                el.style.transition = transition;
                el.style.transform = 'translateX(100%) scale(0.85)';
                el.style.borderRadius = '20px';
                window.setTimeout(function () {
                    onClose();
                    resetStyles();
                }, animationMs);
                return;
            }

            el.style.transition = transition;
            resetStyles();
        }

        function onTouchStart(e) {
            if (shouldIgnoreTarget(e.target)) return;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            startTime = Date.now();
            gesture = '';
            el.style.transition = 'none';
        }

        function onTouchMove(e) {
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
                applyProgress(dx);
            }
        }

        function onTouchEnd(e) {
            if (gesture === 'horizontal') {
                finishGesture(
                    e.changedTouches[0].clientX - startX,
                    Date.now() - startTime
                );
            } else {
                el.style.transition = '';
            }
            gesture = '';
        }

        function onMouseDown(e) {
            if (shouldIgnoreTarget(e.target)) return;
            mouseDown = true;
            mouseStartX = e.clientX;
            mouseStartY = e.clientY;
            mouseStartTime = Date.now();
            gesture = '';
            el.style.transition = 'none';
        }

        function onMouseMove(e) {
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
        }

        function onMouseUp(e) {
            if (!mouseDown) return;
            mouseDown = false;

            if (gesture === 'horizontal') {
                finishGesture(e.clientX - mouseStartX, Date.now() - mouseStartTime);
            } else {
                el.style.transition = '';
            }
            gesture = '';
        }

        el.addEventListener('touchstart', onTouchStart, { passive: true });
        el.addEventListener('touchmove', onTouchMove, { passive: false });
        el.addEventListener('touchend', onTouchEnd, { passive: true });
        el.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);

        el._swipeCloseBound = true;
        el._swipeCloseCleanup = function () {
            el.removeEventListener('touchstart', onTouchStart, { passive: true });
            el.removeEventListener('touchmove', onTouchMove, { passive: false });
            el.removeEventListener('touchend', onTouchEnd, { passive: true });
            el.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            delete el._swipeCloseBound;
            delete el._swipeCloseCleanup;
        };

        return el._swipeCloseCleanup;
    }

    window.bindOverlaySwipeClose = bindOverlaySwipeClose;
})();
