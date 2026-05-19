/**
 * StackSwipe
 * Horizontal stacked-card swipe interaction.
 * Short taps should not trigger the spread effect.
 * Cards only spread after a real horizontal drag begins.
 */
class StackSwipe {
    constructor(container, options = {}) {
        this.container = container;
        this.wrapper = container.querySelector('.cards-wrapper');
        this.cards = Array.from(this.wrapper.children);

        this.options = {
            baseOverlap: 5,
            minOverlap: 0,
            damping: 0.4,
            snapSpeed: 0.5,
            ...options
        };

        this.state = {
            isDragging: false,
            startX: 0,
            startY: 0,
            lastX: 0,
            lastTime: 0,
            velocity: 0,
            moved: false,
            isVerticalScroll: false,
            currentTranslate: 0,
            prevTranslate: 0,
            spreadProgress: 0
        };

        this.init();
    }

    init() {
        this.setupStyles();
        this.bindEvents();
        this.updatePositions();
    }

    setupStyles() {
        this.container.style.perspective = '1500px';
        this.container.style.overflow = 'hidden';
        this.wrapper.style.display = 'flex';
        this.wrapper.style.alignItems = 'center';
        this.wrapper.style.transition = 'none';
        this.wrapper.style.transformStyle = 'preserve-3d';
        this.wrapper.style.width = 'fit-content';
        this.wrapper.style.minWidth = '100%';

        this.cards.forEach((card, index) => {
            card.style.flexShrink = '0';
            card.style.position = 'relative';
            card.style.transition = 'opacity 0.3s, margin-left 0.4s cubic-bezier(0.23, 1, 0.32, 1)';
            if (index > 0) {
                card.style.marginLeft = `-${this.options.baseOverlap}px`;
            }
        });
    }

    bindEvents() {
        this.container.addEventListener('mousedown', this.onStart.bind(this));
        window.addEventListener('mousemove', this.onMove.bind(this));
        window.addEventListener('mouseup', this.onEnd.bind(this));

        this.container.addEventListener('touchstart', this.onStart.bind(this), { passive: true });
        window.addEventListener('touchmove', this.onMove.bind(this), { passive: false });
        window.addEventListener('touchend', this.onEnd.bind(this));
        window.addEventListener('touchcancel', this.onEnd.bind(this));

        this.container.addEventListener('click', (e) => {
            if (this.state.moved) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, true);
    }

    onStart(e) {
        if (window.isPageScrolling) return;

        this.state.isDragging = true;
        this.state.isVerticalScroll = false;
        this.state.startX = this.getClientX(e);
        this.state.startY = this.getClientY(e);
        this.state.lastX = this.state.startX;
        this.state.lastTime = Date.now();
        this.state.velocity = 0;
        this.state.moved = false;

        this.wrapper.style.transition = 'none';
        this.container.style.cursor = 'grab';
    }

    onMove(e) {
        if (!this.state.isDragging || this.state.isVerticalScroll || window.isPageScrolling) {
            if (window.isPageScrolling && this.state.isDragging) {
                this.onEnd();
            }
            return;
        }

        const x = this.getClientX(e);
        const y = this.getClientY(e);
        const dx = x - this.state.lastX;
        const totalDx = Math.abs(x - this.state.startX);
        const totalDy = Math.abs(y - this.state.startY);

        if (!this.state.moved && totalDy > 5 && totalDy > totalDx) {
            this.state.isVerticalScroll = true;
            return;
        }

        if (totalDx <= 5) {
            return;
        }

        if (!this.state.moved) {
            this.state.spreadProgress = 1;
            this.updateSpacing();
            this.container.style.cursor = 'grabbing';
        }

        this.state.moved = true;
        if (e.cancelable) e.preventDefault();

        const now = Date.now();
        const dt = now - this.state.lastTime;
        if (dt > 0) {
            this.state.velocity = dx / dt;
        }

        const moveX = x - this.state.startX;
        let translate = this.state.prevTranslate + moveX;
        const bounds = this.getBounds();

        if (translate > bounds.max) {
            translate = bounds.max + (translate - bounds.max) * this.options.damping;
        } else if (translate < bounds.min) {
            translate = bounds.min + (translate - bounds.min) * this.options.damping;
        }

        this.state.currentTranslate = translate;
        this.state.lastX = x;
        this.state.lastTime = now;
        this.updatePositions();
    }

    onEnd() {
        if (!this.state.isDragging) return;
        this.state.isDragging = false;
        this.container.style.cursor = 'grab';

        this.state.spreadProgress = 0;
        this.updateSpacing();

        if (!this.state.moved || this.state.isVerticalScroll) {
            return;
        }

        let finalTranslate = this.state.currentTranslate + this.state.velocity * 250;
        const bounds = this.getBounds();
        finalTranslate = Math.max(bounds.min, Math.min(bounds.max, finalTranslate));

        const overlap = this.options.baseOverlap;
        const cardWidth = this.cards[0].offsetWidth - overlap;
        finalTranslate = Math.round(finalTranslate / cardWidth) * cardWidth;
        finalTranslate = Math.max(bounds.min, Math.min(bounds.max, finalTranslate));

        this.state.prevTranslate = finalTranslate;
        this.state.currentTranslate = finalTranslate;

        this.wrapper.style.transition = `transform ${this.options.snapSpeed}s cubic-bezier(0.19, 1, 0.22, 1)`;
        this.updatePositions();
    }

    updateSpacing() {
        const currentOverlap = this.state.spreadProgress === 1
            ? this.options.minOverlap
            : this.options.baseOverlap;

        this.cards.forEach((card, index) => {
            if (index > 0) {
                card.style.marginLeft = `-${currentOverlap}px`;
            }
        });
    }

    getBounds() {
        if (this.cards.length <= 1) return { min: 0, max: 0 };

        const currentOverlap = this.state.spreadProgress === 1
            ? this.options.minOverlap
            : this.options.baseOverlap;
        const cardWidth = this.cards[0].offsetWidth - currentOverlap;
        const totalWidth = cardWidth * (this.cards.length - 1);

        return {
            min: -totalWidth,
            max: 0
        };
    }

    updatePositions() {
        if (!this.cards || this.cards.length === 0) return;

        const translate = this.state.currentTranslate;
        this.wrapper.style.transform = `translateX(${translate}px)`;

        const currentOverlap = this.state.spreadProgress === 1
            ? this.options.minOverlap
            : this.options.baseOverlap;
        const vh = window.innerHeight / 100;
        const defaultWidth = 15 * vh;
        const cardWidth = (this.cards[0].offsetWidth || defaultWidth) - currentOverlap;

        this.cards.forEach((card, index) => {
            const safeCardWidth = cardWidth || 1;
            const cardOffset = index * safeCardWidth + translate;
            const normalizedOffset = cardOffset / safeCardWidth;

            let scale = 1;
            let opacity = 1;
            let rotateY = 0;
            let z = 0;

            if (normalizedOffset < 0) {
                scale = Math.max(0.75, 1 + normalizedOffset * 0.15);
                opacity = Math.max(0.3, 1 + normalizedOffset * 0.6);
                rotateY = Math.min(30, -normalizedOffset * 20);
                z = normalizedOffset * 100;
            } else if (normalizedOffset > 0) {
                opacity = Math.max(0.9, 1 - normalizedOffset * 0.1);
                scale = Math.max(0.95, 1 - normalizedOffset * 0.02);
            }

            card.style.transform = `translateZ(${z}px) scale(${scale}) rotateY(${rotateY}deg)`;
            card.style.opacity = opacity;
            card.style.zIndex = index + (normalizedOffset < 0 ? 100 : 0);
        });
    }

    getClientX(e) {
        return e.touches ? e.touches[0].clientX : e.clientX;
    }

    getClientY(e) {
        return e.touches ? e.touches[0].clientY : e.clientY;
    }
}

window.StackSwipe = StackSwipe;
