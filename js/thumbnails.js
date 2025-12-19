// VERSION: 2.2.0
/**
 * Thumbnail Generator
 * Optimized for DOM performance using idle time batching.
 * Reuses a single canvas instance.
 */
export class ThumbnailGenerator {
    constructor() {
        this.queue = [];
        this.activeJobs = 0;
        this.MAX_CONCURRENT_JOBS = 1; // Strict serial to save UI
        this.generationId = 0;
        
        // Single Reusable Canvas
        this.canvas = document.createElement('canvas');
        this.canvas.width = 100;
        this.canvas.height = 60;
        this.ctx = this.canvas.getContext('2d', { alpha: false });
    }

    addToQueue(file, callback) {
        this.queue.push({ file, callback, genId: this.generationId });
        this.scheduleProcess();
    }

    cancelQueue() {
        this.queue = [];
        this.generationId++;
    }

    scheduleProcess() {
        if (this.activeJobs >= this.MAX_CONCURRENT_JOBS || this.queue.length === 0) return;
        
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => this.processQueue(), { timeout: 1000 });
        } else {
            setTimeout(() => this.processQueue(), 200);
        }
    }

    processQueue() {
        if (this.activeJobs >= this.MAX_CONCURRENT_JOBS || this.queue.length === 0) return;

        const task = this.queue.shift();
        if (!task) return;

        this.activeJobs++;
        this.processTask(task).finally(() => {
            this.activeJobs--;
            this.scheduleProcess();
        });
    }

    async processTask(task) {
        if (task.genId !== this.generationId) return;

        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.preload = 'metadata';
        
        let url = null;
        try {
            url = URL.createObjectURL(task.file);
            video.src = url;
            
            await new Promise((resolve, reject) => {
                video.onloadeddata = () => {
                    video.currentTime = Math.min(5, video.duration / 2);
                };
                video.onseeked = () => resolve();
                video.onerror = () => reject();
                setTimeout(reject, 3000);
            });

            if (task.genId === this.generationId) {
                // Reuse the singleton context
                this.ctx.drawImage(video, 0, 0, 100, 60);
                const dataUrl = this.canvas.toDataURL('image/jpeg', 0.5);
                task.callback(dataUrl);
            }
        } catch (e) {
            // Fallback: Notify callback with null so UI can show placeholder/default
            if (task.genId === this.generationId) {
                task.callback(null);
            }
        } finally {
            if (url) URL.revokeObjectURL(url);
            video.src = "";
            video.load();
        }
    }
}