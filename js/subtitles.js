// VERSION: 2.2.0
// js/subtitles.js
/**
 * Subtitle Manager
 * Supports SRT/VTT (native DOM) and ASS/SSA (SubtitlesOctopus)
 */
export class SubtitleManager {
    /**
     * @param {HTMLElement} overlayElement - DOM element for text subs.
     * @param {HTMLVideoElement} videoElement - Video element for binding Octopus.
     */
    constructor(overlayElement, videoElement) {
        this.overlay = overlayElement;
        this.video = videoElement;
        this.cues = [];
        this.active = true;
        this.octopusInstance = null;
        this.octopusScriptLoaded = false;
        
        // Ensure library is loaded
        this.loadOctopusLib();
    }

    loadOctopusLib() {
        if (window.SubtitlesOctopus) {
            this.octopusScriptLoaded = true;
            return;
        }
        const script = document.createElement('script');
        script.src = 'js/subtitles-octopus-min.js';
        script.onload = () => { this.octopusScriptLoaded = true; };
        document.body.appendChild(script);
    }

    /**
     * Toggles subtitle visibility.
     * @returns {boolean} New visibility state.
     */
    toggle() {
        this.setVisible(!this.active);
        return this.active;
    }

    /**
     * Sets the visibility of subtitles (both DOM and Canvas).
     * @param {boolean} visible 
     */
    setVisible(visible) {
        this.active = visible;
        
        // Handle SRT/VTT Overlay
        this.overlay.style.display = this.active ? 'block' : 'none';
        
        // Handle Octopus (ASS/SSA) Overlay
        // Octopus creates a canvas sibling to the video or inside the container
        // We usually control it via the instance, but simple CSS toggle on canvas works too
        if (this.octopusInstance) {
            // Find the canvas created by Octopus (usually next to video)
            const canvas = this.video.parentNode.querySelector('canvas.libass-canvas');
            if (canvas) {
                canvas.style.display = this.active ? 'block' : 'none';
            }
        }
    }

    clear() {
        this.cues = [];
        this.overlay.innerHTML = '';
        this.disposeOctopus();
    }

    disposeOctopus() {
        if (this.octopusInstance) {
            try {
                this.octopusInstance.dispose();
            } catch(e) { console.warn("Octopus dispose error", e); }
            this.octopusInstance = null;
        }
    }

    /**
     * Loads a subtitle file.
     * @param {File} file 
     */
    async loadFile(file) {
        this.clear();
        
        if (file.name.endsWith('.ass') || file.name.endsWith('.ssa')) {
            await this.loadASS(file);
        } else {
            const text = await file.text();
            if (file.name.endsWith('.vtt')) {
                this.parseVTT(text);
            } else if (file.name.endsWith('.srt')) {
                this.parseSRT(text);
            }
        }
        
        // Re-apply visibility state after loading new file
        this.setVisible(this.active);
    }

    async loadASS(file) {
        if (!this.octopusScriptLoaded || !window.SubtitlesOctopus) {
            console.error("SubtitlesOctopus not loaded yet.");
            return;
        }

        const url = URL.createObjectURL(file);

        // Options for Octopus
        const options = {
            video: this.video,
            subUrl: url,
            fonts: [], // User can add fonts here if needed
            workerUrl: 'js/subtitles-octopus-worker.js', // Assumes worker is in js/
            legacyWorkerUrl: 'js/subtitles-octopus-worker-legacy.js',
            onReady: () => {
                // Ensure visibility is respected immediately upon load
                this.setVisible(this.active);
            }
        };

        this.octopusInstance = new window.SubtitlesOctopus(options);
    }

    parseSRT(text) {
        const pattern = /(\d+)\n(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/g;
        const blocks = text.trim().replace(/\r\n/g, '\n').split('\n\n');
        
        this.cues = blocks.map(block => {
            const lines = block.split('\n');
            if (lines.length < 3) return null;
            
            const timeLine = lines[1];
            // Safe Join: Join lines with newline character instead of <br>
            // textContent + white-space: pre-wrap in CSS will handle rendering
            const rawText = lines.slice(2).join('\n');
            const times = timeLine.split(' --> ');
            
            if(times.length !== 2) return null;

            return {
                start: this.srtTimeToSeconds(times[0]),
                end: this.srtTimeToSeconds(times[1]),
                text: rawText // Raw text, no HTML escaping needed for textContent
            };
        }).filter(c => c);
    }

    parseVTT(text) {
        const lines = text.trim().replace(/\r\n/g, '\n').split('\n');
        let currentCue = null;

        lines.forEach(line => {
            if (line.includes('-->')) {
                const times = line.split(' --> ');
                currentCue = {
                    start: this.vttTimeToSeconds(times[0]),
                    end: this.vttTimeToSeconds(times[1]),
                    text: ''
                };
                this.cues.push(currentCue);
            } else if (currentCue && line.trim() !== '') {
                // Accumulate text with newlines
                currentCue.text += (currentCue.text ? '\n' : '') + line;
            } else if (line.trim() === '') {
                currentCue = null;
            }
        });
    }

    update(currentTime) {
        // Octopus handles its own update loop via the video element binding
        // We only need to update manual DOM overlay for SRT/VTT
        if (this.octopusInstance) return; 

        if (!this.active) {
            this.overlay.textContent = '';
            return;
        }
        
        const activeCue = this.cues.find(cue => currentTime >= cue.start && currentTime <= cue.end);
        
        // XSS Mitigation: Use textContent instead of innerHTML
        // Clear previous content
        this.overlay.textContent = ''; 

        if (activeCue) {
            const span = document.createElement('span');
            span.className = 'subtitle-line';
            span.textContent = activeCue.text; // Safe text insertion
            this.overlay.appendChild(span);
        }
    }

    srtTimeToSeconds(t) {
        try {
            if (!t || typeof t !== 'string') return 0;
            const normalized = t.replace(',', '.').trim();
            const parts = normalized.split(':');
            if (parts.length !== 3) return 0;
            const [h, m, s] = parts;
            const hours = parseFloat(h) || 0;
            const minutes = parseFloat(m) || 0;
            const seconds = parseFloat(s) || 0;
            if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return 0;
            return (hours * 3600) + (minutes * 60) + seconds;
        } catch (e) {
            return 0;
        }
    }
    
    vttTimeToSeconds(t) {
        try {
            if (!t || typeof t !== 'string') return 0;
            const parts = t.trim().split(':');
            if (parts.length < 2 || parts.length > 3) return 0;
            let s = 0;
            if (parts.length === 3) {
                const hours = parseFloat(parts[0]) || 0;
                const minutes = parseFloat(parts[1]) || 0;
                const seconds = parseFloat(parts[2]) || 0;
                if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return 0;
                s = (hours * 3600) + (minutes * 60) + seconds;
            } else {
                const minutes = parseFloat(parts[0]) || 0;
                const seconds = parseFloat(parts[1]) || 0;
                if (isNaN(minutes) || isNaN(seconds)) return 0;
                s = (minutes * 60) + seconds;
            }
            return s;
        } catch (e) {
            return 0;
        }
    }
}