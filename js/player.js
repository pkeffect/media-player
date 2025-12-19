/* VERSION: 3.6.0 */
/* js/player.js */
import { Logger } from './logger.js';

/**
 * Media Player Logic with HLS and MediaSession
 */
export class MediaPlayer {
    /**
     * @param {HTMLVideoElement} videoElement - The video element to control.
     * @param {Function} updateUICallback - Callback to update UI components.
     * @param {Object} callbacks - Event callbacks {onEnded, onError, onTimeUpdate, onNext, onPrev}.
     */
    constructor(videoElement, updateUICallback, callbacks) {
        this.video = videoElement;
        this.updateUI = updateUICallback;
        this.onEnded = callbacks.onEnded;
        this.onError = callbacks.onError;
        this.onTimeUpdate = callbacks.onTimeUpdate;
        
        // Media Session Callbacks
        this.onNext = callbacks.onNext;
        this.onPrev = callbacks.onPrev;
        
        this.hls = null;
        this.currentObjectURL = null; // Track for memory cleanup
        this.frameCallbackId = null;
        this.audioEngineRef = null; // To control fades
        
        this.bindEvents();
        this.initMediaSession();
    }
    
    /**
     * Injects the AudioEngine to allow fade control during playback events.
     * @param {AudioEngine} engine 
     */
    setAudioEngine(engine) {
        this.audioEngineRef = engine;
    }

    bindEvents() {
        const updateLoop = (now, metadata) => {
            this.updateProgress();
            if (!this.video.paused && !this.video.ended) {
                if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
                    this.frameCallbackId = this.video.requestVideoFrameCallback(updateLoop);
                } else {
                    // Fallback for Safari/Firefox if rVFC is missing
                    this.frameCallbackId = requestAnimationFrame(() => updateLoop());
                }
            }
        };

        this.video.addEventListener('play', () => {
            this.updateUI('playState', true);
            this.updateMediaSessionState('playing');
            // Soft Start
            if(this.audioEngineRef) this.audioEngineRef.fadeIn(0.5);
            
            // Cancel existing to prevent double loops
            if (this.frameCallbackId) {
                if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
                    this.video.cancelVideoFrameCallback(this.frameCallbackId);
                } else {
                    cancelAnimationFrame(this.frameCallbackId);
                }
            }

            if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
                this.frameCallbackId = this.video.requestVideoFrameCallback(updateLoop);
            } else {
                this.frameCallbackId = requestAnimationFrame(() => updateLoop());
            }
        });

        this.video.addEventListener('pause', () => {
            this.updateUI('playState', false);
            this.updateMediaSessionState('paused');
            
            if (this.frameCallbackId) {
                if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
                    this.video.cancelVideoFrameCallback(this.frameCallbackId);
                } else {
                    cancelAnimationFrame(this.frameCallbackId);
                }
                this.frameCallbackId = null;
            }
        });

        this.video.addEventListener('timeupdate', () => {
            this.updateProgress();
            if (this.onTimeUpdate) this.onTimeUpdate(this.video.currentTime);
        });

        this.video.addEventListener('ended', () => {
            this.updateUI('playState', false);
            if (this.onEnded) this.onEnded();
        });
        
        this.video.addEventListener('loadedmetadata', () => this.updateProgress());

        this.video.addEventListener('error', () => {
            if (this.video.error && this.onError) {
                // Map the error code to a user-friendly message using Logger
                const friendlyMsg = Logger.getUserMessage(this.video.error);
                this.onError(friendlyMsg);
            }
        });
    }

    // --- Media Session API ---
    initMediaSession() {
        if ('mediaSession' in navigator) {
            const ms = navigator.mediaSession;
            ms.setActionHandler('play', () => this.togglePlay());
            ms.setActionHandler('pause', () => this.togglePlay());
            ms.setActionHandler('previoustrack', () => { if(this.onPrev) this.onPrev(); });
            ms.setActionHandler('nexttrack', () => { if(this.onNext) this.onNext(); });
            ms.setActionHandler('seekto', (details) => {
                if (details.seekTime && Number.isFinite(this.video.duration)) {
                    this.video.currentTime = details.seekTime;
                }
            });
        }
    }

    updateMediaSessionState(state) {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = state;
        }
    }

    updateMediaSessionMetadata(meta) {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: meta.title || 'Unknown Title',
                artist: meta.artist || 'Internode Player',
                album: meta.album || '',
                artwork: meta.artwork || []
            });
        }
    }

    // --- Loading Logic with HLS ---
    /**
     * Loads a file or URL into the video player.
     * Automatically handles HLS (.m3u8) streams using hls.js or native support.
     * @param {File|Blob|string} source - The media source.
     * @param {Object} metadata - Metadata for Media Session (title, artist, thumb).
     */
    async loadFile(source, metadata = {}) {
        // Soft Stop old track before loading new
        if (!this.video.paused && this.audioEngineRef) {
            this.audioEngineRef.fadeOut(0.3);
            await new Promise(r => setTimeout(r, 300));
        }

        // Revoke previous object URL to prevent memory leak
        this.revokeCurrentObjectURL();

        let url;
        if (source instanceof File || source instanceof Blob) {
            url = URL.createObjectURL(source);
            this.currentObjectURL = url;
        } else if (typeof source === 'string') {
            url = source;
        } else {
            return;
        }

        this.updateMediaSessionMetadata({
            title: metadata.title || (source.name ? source.name : "Stream"),
            artist: "Internode Player",
            artwork: metadata.thumb ? [{ src: metadata.thumb, sizes: '96x96', type: 'image/png' }] : []
        });

        if (this.hls) {
            this.hls.destroy();
            this.hls = null;
        }

        const isHLS = url.includes('.m3u8');
        // Safari/iOS has native HLS - don't use hls.js
        const canPlayHLSNatively = this.video.canPlayType('application/vnd.apple.mpegurl') !== '';
        
        if (isHLS && !canPlayHLSNatively && typeof Hls !== 'undefined' && Hls.isSupported()) {
            // Use hls.js for browsers without native HLS (Chrome, Firefox, etc.)
            this.hls = new Hls({
                enableWorker: true,
                lowLatencyMode: false
            });
            this.hls.loadSource(url);
            this.hls.attachMedia(this.video);
            this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
                this.safePlay();
            });
            this.hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal && this.onError) {
                    // hls.js error types are strings, but we can wrap them
                    Logger.warn(`HLS Error: ${data.type}`);
                    this.onError("Stream Error: " + data.type);
                }
            });
        } else {
            // Native playback (including Safari HLS)
            this.video.src = url;
            this.video.load();
            this.safePlay();
        }
    }

    /**
     * Cleans up object URLs to free memory.
     */
    revokeCurrentObjectURL() {
        if (this.currentObjectURL) {
            URL.revokeObjectURL(this.currentObjectURL);
            this.currentObjectURL = null;
        }
    }

    destroy() {
        this.revokeCurrentObjectURL();
        if (this.hls) {
            this.hls.destroy();
            this.hls = null;
        }
    }

    safePlay() {
        const playPromise = this.video.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                if (error.name !== 'AbortError') {
                    // Autoplay blocked - user will need to tap play
                    Logger.info("Autoplay prevented by browser.");
                }
            });
        }
    }

    // --- Standard Controls ---
    updateProgress() {
        const current = this.video.currentTime || 0;
        const duration = this.video.duration;
        let percent = 0;
        let totalStr = "00:00";

        if (Number.isFinite(duration) && duration > 0) {
            percent = (current / duration) * 100;
            totalStr = this.formatTime(duration);
        }

        this.updateUI('progress', { percent: percent });
        this.updateUI('time', { current: this.formatTime(current), total: totalStr });
    }

    togglePlay() {
        if (this.video.paused) {
            this.safePlay();
        } else {
            // Soft Pause
            if (this.audioEngineRef) {
                this.audioEngineRef.fadeOut(0.2);
                setTimeout(() => this.video.pause(), 200);
            } else {
                this.video.pause();
            }
        }
    }

    restart() {
        this.video.currentTime = 0;
        this.safePlay();
    }

    /**
     * Sets playback volume.
     * @param {number} val - Volume between 0.0 and 1.0.
     */
    setVolume(val) {
        this.video.volume = Math.max(0, Math.min(1, val));
        this.updateUI('volume', this.video.volume);
    }
    
    toggleMute() {
        this.video.muted = !this.video.muted;
        return this.video.muted;
    }

    setSpeed(rate) {
        this.video.playbackRate = rate;
    }

    /**
     * Seeks to a specific percentage of the video.
     * @param {number} percent - 0.0 to 1.0
     */
    seek(percent) {
        if (Number.isFinite(this.video.duration) && this.video.duration > 0) {
            this.video.currentTime = this.video.duration * percent;
            this.updateProgress();
        }
    }

    /**
     * Seeks by a relative number of seconds.
     * @param {number} seconds - Positive to skip forward, negative to rewind.
     */
    seekStep(seconds) {
        if (Number.isFinite(this.video.duration)) {
            this.video.currentTime = Math.min(Math.max(0, this.video.currentTime + seconds), this.video.duration);
        }
    }

    async togglePiP() {
        if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
        } else if (this.video !== document.pictureInPictureElement) {
            // Check support
            if (this.video.requestPictureInPicture) {
                await this.video.requestPictureInPicture();
            } else {
                Logger.warn("Picture-in-Picture not supported");
            }
        }
    }

    formatTime(seconds) {
        if (isNaN(seconds) || !isFinite(seconds)) return "00:00";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const mStr = m.toString().padStart(2, '0');
        const sStr = s.toString().padStart(2, '0');
        if (h > 0) return `${h}:${mStr}:${sStr}`;
        return `${mStr}:${sStr}`;
    }
}