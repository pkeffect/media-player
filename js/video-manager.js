/* VERSION: 1.3.0 */
/* js/video-manager.js */
/**
 * Video Adjustment & Logic Manager
 * Handles: CSS Filters, Aspect Ratio, A-B Looping
 */
export class VideoManager {
    constructor(videoElement, uiCallbacks) {
        this.video = videoElement;
        this.showToast = uiCallbacks.showToast;
        
        // Filter State
        this.filters = {
            brightness: 100,
            contrast: 100,
            saturate: 100,
            hue: 0
        };

        // Load Saved
        try {
            const saved = localStorage.getItem('internode-video-filters');
            if (saved) {
                this.filters = { ...this.filters, ...JSON.parse(saved) };
                this.applyFilters();
            }
        } catch(e) {}

        // A-B Loop State
        this.loopA = null;
        this.loopB = null;
        this.looping = false;

        this.bindEvents();
    }

    bindEvents() {
        this.video.addEventListener('timeupdate', () => {
            if (this.looping && this.loopB !== null && this.loopA !== null) {
                if (this.video.currentTime >= this.loopB) {
                    this.video.currentTime = this.loopA;
                }
            }
        });
    }

    setFilter(type, val) {
        this.filters[type] = parseInt(val, 10);
        this.applyFilters();
        this.saveFilters();
    }

    resetFilters() {
        this.filters = { brightness: 100, contrast: 100, saturate: 100, hue: 0 };
        this.applyFilters();
        this.saveFilters();
    }

    applyFilters() {
        const f = this.filters;
        this.video.style.filter = `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturate}%) hue-rotate(${f.hue}deg)`;
    }

    saveFilters() {
        try {
            localStorage.setItem('internode-video-filters', JSON.stringify(this.filters));
        } catch(e) {}
    }

    setAspectRatio(mode) {
        this.video.style.objectFit = 'contain';
        this.video.style.width = '100%';
        this.video.style.height = '100%';
        this.video.style.aspectRatio = 'auto';
        
        switch (mode) {
            case 'fill': this.video.style.objectFit = 'fill'; break;
            case '16:9': this.video.style.aspectRatio = '16/9'; break;
            case '4:3': this.video.style.aspectRatio = '4/3'; break;
            case '21:9': this.video.style.aspectRatio = '21/9'; break;
            case '2.35:1': this.video.style.aspectRatio = '2.35/1'; break;
            case '1:1': this.video.style.aspectRatio = '1/1'; break;
            default: break;
        }
        
        if (mode !== 'auto' && mode !== 'fill') {
            this.video.style.objectFit = 'fill';
        }
        
        if (mode !== 'auto') {
             this.showToast(`Aspect Ratio: ${mode}`);
        }
    }

    setLoopA() {
        this.loopA = this.video.currentTime;
        this.showToast(`Loop Start (A) Set: ${this.formatTime(this.loopA)}`);
        this.checkLoopState();
    }

    setLoopB() {
        this.loopB = this.video.currentTime;
        this.showToast(`Loop End (B) Set: ${this.formatTime(this.loopB)}`);
        this.checkLoopState();
    }

    clearLoop(silent = false) {
        this.loopA = null;
        this.loopB = null;
        this.looping = false;
        if (!silent) {
            this.showToast("A-B Loop Cleared");
        }
    }

    checkLoopState() {
        if (this.loopA !== null && this.loopB !== null) {
            if (this.loopA >= this.loopB) {
                this.showToast("Invalid Loop: Start > End");
                this.looping = false;
            } else {
                this.looping = true;
                this.showToast("A-B Loop Active");
                if (this.video.currentTime > this.loopB) {
                    this.video.currentTime = this.loopA;
                }
            }
        }
    }

    formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }
}