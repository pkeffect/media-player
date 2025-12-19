/* VERSION: 1.4.0 */
/* js/stream.js */
/**
 * Stream Manager: Handles Network Stream URLs with Enhanced Validation
 */
export class StreamManager {
    constructor(uiCallbacks) {
        this.onLoad = uiCallbacks.onLoad;
        this.onError = uiCallbacks.onError;

        this.modal = document.getElementById('stream-modal');
        this.input = document.getElementById('stream-url');
        this.btnOpen = document.getElementById('btn-stream');
        this.btnLoad = document.getElementById('btn-stream-load');
        this.btnCancel = document.getElementById('btn-stream-cancel');

        this.bindEvents();
    }

    bindEvents() {
        if (this.btnOpen) {
            this.btnOpen.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openModal();
            });
        }

        if (this.btnLoad) {
            this.btnLoad.addEventListener('click', () => this.loadFromInput());
        }

        if (this.btnCancel) {
            this.btnCancel.addEventListener('click', () => this.closeModal());
        }

        if (this.input) {
            this.input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.loadFromInput();
                if (e.key === 'Escape') this.closeModal();
                e.stopPropagation(); 
            });
        }

        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) this.closeModal();
            });
        }
    }

    openModal() {
        this.modal.classList.add('visible');
        // FOCUS TRAP: Enforce focus inside input
        setTimeout(() => this.input.focus(), 100);
        this.input.value = ''; 
        this.resetButton();
    }

    closeModal() {
        this.modal.classList.remove('visible');
        this.resetButton();
    }

    resetButton() {
        if (this.btnLoad) {
            this.btnLoad.textContent = 'Load';
            this.btnLoad.disabled = false;
        }
    }

    async loadFromInput() {
        let urlStr = this.input.value.trim();
        if (!urlStr) return;

        // SECURITY: Sanitize Length to prevent DoS
        if (urlStr.length > 2048) {
            if(this.onError) this.onError("URL too long");
            return;
        }

        // Protocol Whitelist
        try {
            const parsed = new URL(urlStr);
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                if (this.onError) this.onError("Security Error: Only HTTP/HTTPS allowed.");
                return;
            }
        } catch (_) {
            if (this.onError) this.onError("Invalid URL format");
            return;
        }

        if (this.btnLoad) {
            this.btnLoad.textContent = 'Checking...';
            this.btnLoad.disabled = true;
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); 

            // CORS FIX: Removed 'no-cors'. We want to know if it fails.
            // If CORS fails, it throws. If 404, it might return OK status depending on server, 
            // but usually we catch network errors here.
            // Note: HLS streams often allow CORS. If not, playback will fail anyway.
            await fetch(urlStr, { 
                method: 'HEAD', 
                signal: controller.signal 
            });
            
            clearTimeout(timeoutId);
            this.closeModal();
            if (this.onLoad) this.onLoad(urlStr);

        } catch (e) {
            this.resetButton();
            // Allow user to force add if they believe it works (e.g. CORS block on HEAD but GET ok)
            // But typically we show error.
            if (this.onError) this.onError("Stream unreachable or CORS blocked.");
        }
    }
}