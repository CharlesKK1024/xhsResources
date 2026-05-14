/**
 * StackSwipe - 实现 iOS 后台任务风格的堆叠滑动效果
 */
class StackSwipe {
    constructor(container, options = {}) {
        this.container = container;
        this.wrapper = container.querySelector('.cards-wrapper');
        this.cards = Array.from(this.wrapper.children);
        
        this.options = {
            baseOverlap: 15,      // 减小重叠，更接近平铺
            minOverlap: 0,        // 展开时完全平铺
            damping: 0.4,         // 增加阻尼
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
            isVerticalScroll: false, // 标记是否为纵向滚动
            currentTranslate: 0,
            prevTranslate: 0,
            spreadProgress: 0
        };

        this.init();
    }

    init() {
        this.setupStyles();
        this.bindEvents();
        // 初始状态不应该有偏移，确保单卡片可见
        this.updatePositions();
    }

    setupStyles() {
        this.container.style.perspective = '1500px';
        this.container.style.overflow = 'hidden'; 
        this.wrapper.style.display = 'flex';
        this.wrapper.style.alignItems = 'center';
        this.wrapper.style.transition = 'none';
        this.wrapper.style.transformStyle = 'preserve-3d';
        this.wrapper.style.width = 'fit-content'; // 确保宽度由内容决定
        this.wrapper.style.minWidth = '100%';
        
        this.cards.forEach((card, index) => {
            card.style.flexShrink = '0';
            card.style.position = 'relative';
            card.style.transition = 'opacity 0.3s, margin-left 0.4s cubic-bezier(0.23, 1, 0.32, 1)';
            // 初始微小重叠
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

        // 核心：拦截点击事件，如果在滑动则不触发点击
        this.container.addEventListener('click', (e) => {
            if (this.state.moved) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, true);
    }

    onStart(e) {
        // 如果全局页面正在滚动，则禁止开始滑动交互
        if (window.isPageScrolling) return;

        this.state.isDragging = true;
        this.state.isVerticalScroll = false;
        this.state.startX = this.getClientX(e);
        this.state.startY = this.getClientY(e);
        this.state.lastX = this.state.startX;
        this.state.lastTime = Date.now();
        this.state.velocity = 0;
        this.state.moved = false; // 重置移动标记
        
        this.wrapper.style.transition = 'none';
        this.container.style.cursor = 'grabbing';
        
        // 交互开始：丝滑摊开
        this.state.spreadProgress = 1;
        this.updateSpacing();
    }

    onMove(e) {
        if (!this.state.isDragging || this.state.isVerticalScroll || window.isPageScrolling) {
            if (window.isPageScrolling && this.state.isDragging) {
                this.onEnd(); // 强制结束
            }
            return;
        }

        const x = this.getClientX(e);
        const y = this.getClientY(e);
        const dx = x - this.state.lastX;
        const totalDx = Math.abs(x - this.state.startX);
        const totalDy = Math.abs(y - this.state.startY);
        
        // 方向判定：如果在产生明显位移前，垂直位移大于水平位移，则判定为页面纵向滚动
        if (!this.state.moved && totalDy > 5 && totalDy > totalDx) {
            this.state.isVerticalScroll = true;
            return;
        }

        // 如果确定是横向滑动，阻止默认滚动行为
        if (totalDx > 5) {
            this.state.moved = true;
            if (e.cancelable) e.preventDefault();
        }

        const now = Date.now();
        const dt = now - this.state.lastTime;
        
        if (dt > 0) {
            this.state.velocity = dx / dt;
        }

        let moveX = x - this.state.startX;
        let translate = this.state.prevTranslate + moveX;

        // 边界阻尼
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

        // 交互结束：收回去
        this.state.spreadProgress = 0;
        this.updateSpacing();

        // 计算惯性终点
        let finalTranslate = this.state.currentTranslate + this.state.velocity * 250;
        const bounds = this.getBounds();

        // 限制边界
        finalTranslate = Math.max(bounds.min, Math.min(bounds.max, finalTranslate));
        
        // 对齐到卡片
        const overlap = this.options.baseOverlap; // 回弹后是基础重叠
        const cardWidth = this.cards[0].offsetWidth - overlap;
        finalTranslate = Math.round(finalTranslate / cardWidth) * cardWidth;
        finalTranslate = Math.max(bounds.min, Math.min(bounds.max, finalTranslate));

        this.state.prevTranslate = finalTranslate;
        this.state.currentTranslate = finalTranslate;

        this.wrapper.style.transition = `transform ${this.options.snapSpeed}s cubic-bezier(0.19, 1, 0.22, 1)`;
        this.updatePositions();
    }

    updateSpacing() {
        const currentOverlap = this.state.spreadProgress === 1 ? this.options.minOverlap : this.options.baseOverlap;
        this.cards.forEach((card, index) => {
            if (index > 0) {
                card.style.marginLeft = `-${currentOverlap}px`;
            }
        });
    }

    getBounds() {
        if (this.cards.length <= 1) return { min: 0, max: 0 };
        // 边界计算始终基于当前的展开状态
        const currentOverlap = this.state.spreadProgress === 1 ? this.options.minOverlap : this.options.baseOverlap;
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

        const currentOverlap = this.state.spreadProgress === 1 ? this.options.minOverlap : this.options.baseOverlap;
        
        // 核心修复：如果 offsetWidth 为 0 (未渲染)，则使用一个合理的预设值 (15vh 对应的 px)
        // 1vh 约等于 window.innerHeight / 100
        const vh = window.innerHeight / 100;
        const defaultWidth = 15 * vh;
        const cardWidth = (this.cards[0].offsetWidth || defaultWidth) - currentOverlap;

        this.cards.forEach((card, index) => {
            // 防止除以 0
            const safeCardWidth = cardWidth || 1;
            const cardOffset = index * safeCardWidth + translate;
            const normalizedOffset = cardOffset / safeCardWidth;
            
            let scale = 1;
            let opacity = 1;
            let rotateY = 0;
            let z = 0;

            if (normalizedOffset < 0) {
                // 左侧堆叠
                scale = Math.max(0.75, 1 + normalizedOffset * 0.15);
                opacity = Math.max(0.3, 1 + normalizedOffset * 0.6);
                rotateY = Math.min(30, -normalizedOffset * 20);
                z = normalizedOffset * 100;
            } else if (normalizedOffset > 0) {
                // 右侧微调
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
