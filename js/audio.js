/* VERSION: 3.3.0 */
/* js/audio.js */
/**
 * Audio Engine: Stereo 12-Band EQ + Mastering Chain
 * Chain: Source -> Splitter -> [EQs] -> Merger -> FadeGain -> Mid/Side -> Limiter -> Metering -> Dest
 * iOS/Safari compatible
 */
export class AudioEngine {
    /**
     * @param {HTMLMediaElement} videoElement - The HTML5 Video/Audio element to attach to.
     */
    constructor(videoElement) {
        this.video = videoElement;
        /** @type {AudioContext} */
        this.context = null;
        /** @type {MediaElementAudioSourceNode} */
        this.source = null;
        this.initialized = false;
        
        // Nodes
        this.splitter = null;
        this.merger = null;
        this.fadeGain = null; // For crossfade/soft transitions
        
        // Mid-Side Nodes
        this.msSplitter = null;
        this.msMerger = null;
        this.widthGain = null; // Controls Side channel volume
        
        // Dynamics
        this.compressor = null;
        
        // Metering
        this.analyserL = null;
        this.analyserR = null;
        this.meterSplitter = null;

        // Stereo Chains
        this.leftChain = { gain: null, filters: [] };
        this.rightChain = { gain: null, filters: [] };

        this.frequencies = [25, 40, 63, 100, 160, 250, 500, 1000, 2000, 4000, 8000, 16000];
    }

    /**
     * Initializes the Web Audio API Context and Graph.
     * Must be called after a user gesture on some browsers (iOS).
     */
    init() {
        if (this.context) return;

        // Use webkit prefix for older Safari
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) {
            console.warn("Web Audio API not supported");
            return;
        }
        
        // Create context - iOS requires this to be created during user gesture
        // but we handle resume separately
        this.context = new AudioContext();
        
        // iOS Safari may start suspended
        if (this.context.state === 'suspended') {
            // Will be resumed on first user interaction via resume() call
            console.log("AudioContext created in suspended state (normal on iOS)");
        }

        try {
            this.source = this.context.createMediaElementSource(this.video);
        } catch(e) {
            console.warn("Audio source issue:", e);
            return;
        }
        
        this.initialized = true;

        // 1. Split Source
        this.splitter = this.context.createChannelSplitter(2);
        
        // 2. Build EQ Chains
        this.leftChain = this.buildChain();
        this.rightChain = this.buildChain();
        
        // 3. Merge EQ outputs
        this.merger = this.context.createChannelMerger(2);

        // 4. Fade Gain (Crossfade logic)
        this.fadeGain = this.context.createGain();
        this.fadeGain.gain.value = 1.0;

        // 5. Mid-Side Processing (Stereo Width)
        // Channel 0 = Left, Channel 1 = Right
        this.msSplitter = this.context.createChannelSplitter(2);
        this.msMerger = this.context.createChannelMerger(2);
        
        // Nodes for MS Matrix
        this.midNode = this.context.createGain(); // Sum L+R
        this.sideNode = this.context.createGain(); // Diff L-R
        this.sideGain = this.context.createGain(); // Width Control
        
        // 6. Limiter (Compressor)
        this.compressor = this.context.createDynamicsCompressor();
        this.compressor.threshold.value = -0.5; // Safety limit
        this.compressor.knee.value = 0; // Hard knee
        this.compressor.ratio.value = 20; // Limiting
        this.compressor.attack.value = 0.005; 
        this.compressor.release.value = 0.1;

        // 7. Metering
        this.meterSplitter = this.context.createChannelSplitter(2);
        this.analyserL = this.context.createAnalyser();
        this.analyserR = this.context.createAnalyser();
        this.analyserL.fftSize = 256;
        this.analyserR.fftSize = 256;

        // --- CONNECT THE GRAPH ---
        
        // Source -> EQ Splitter
        this.source.connect(this.splitter);

        // Splitter -> EQ Chains
        this.splitter.connect(this.leftChain.input, 0);
        this.splitter.connect(this.rightChain.input, 1);

        // EQ Chains -> Merger
        this.leftChain.output.connect(this.merger, 0, 0);
        this.rightChain.output.connect(this.merger, 0, 1);

        // Merger -> Fade Gain
        this.merger.connect(this.fadeGain);

        // Fade Gain -> MS Splitter (Input for MS Matrix)
        this.fadeGain.connect(this.msSplitter);

        // --- MS MATRIX IMPLEMENTATION ---
        // We need L and R separated again
        // 1. Create Inverters for subtraction
        const inverter = this.context.createGain();
        inverter.gain.value = -1;

        // MID PATH (L+R)
        // Splitter L -> Mid
        this.msSplitter.connect(this.midNode, 0); 
        // Splitter R -> Mid
        this.msSplitter.connect(this.midNode, 1);
        
        // SIDE PATH (L-R)
        // Splitter L -> Side
        this.msSplitter.connect(this.sideNode, 0);
        // Splitter R -> Invert -> Side
        this.msSplitter.connect(inverter, 1);
        inverter.connect(this.sideNode);

        // Width Control applies to Side Signal
        this.sideNode.connect(this.sideGain);

        // DECODE MS back to LR
        // L = M + S
        // R = M - S
        
        // Mid -> Left Output (Merger Ch 0)
        this.midNode.connect(this.msMerger, 0, 0);
        // Mid -> Right Output (Merger Ch 1)
        this.midNode.connect(this.msMerger, 0, 1);

        // Side -> Left Output (Merger Ch 0)
        this.sideGain.connect(this.msMerger, 0, 0);
        // Side -> Invert -> Right Output (Merger Ch 1)
        const sideInverter = this.context.createGain();
        sideInverter.gain.value = -1;
        this.sideGain.connect(sideInverter);
        sideInverter.connect(this.msMerger, 0, 1);
        
        // --- END CHAIN ---
        // MS Merger -> Compressor
        this.msMerger.connect(this.compressor);

        // Compressor -> Meter Splitter
        this.compressor.connect(this.meterSplitter);
        
        // Meter Splitter -> Analysers
        this.meterSplitter.connect(this.analyserL, 0);
        this.meterSplitter.connect(this.analyserR, 1);

        // Compressor -> Destination (Audio Out)
        this.compressor.connect(this.context.destination);
    }

    /**
     * Constructs a single channel EQ chain with Input Gain and BiquadFilters.
     * @returns {{input: GainNode, output: AudioNode, gain: GainNode, filters: BiquadFilterNode[]}}
     */
    buildChain() {
        const inputGain = this.context.createGain();
        let prevNode = inputGain;
        const filters = [];

        this.frequencies.forEach(freq => {
            const filter = this.context.createBiquadFilter();
            filter.type = 'peaking';
            filter.frequency.value = freq;
            filter.Q.value = 1.4; 
            filter.gain.value = 0;

            prevNode.connect(filter);
            prevNode = filter;
            filters.push(filter);
        });

        return {
            input: inputGain,
            output: prevNode, 
            gain: inputGain,
            filters: filters
        };
    }

    /**
     * Updates EQ, Gain, and Width based on the provided state object.
     * @param {Object} state - The audio state object.
     * @param {boolean} state.bypass - Whether to bypass EQ.
     * @param {boolean} state.limiterActive - Whether to engage the brickwall limiter.
     * @param {number} state.widthRotation - Stereo width rotation (-135 to 135).
     * @param {Object} state.left - Left channel config {gain, bands}.
     * @param {Object} state.right - Right channel config {gain, bands}.
     */
    updateFromState(state) {
        if (!this.context) this.init();
        if (!state) return;

        const isBypass = state.bypass;

        // EQ Channels
        this.applyChannelSettings(this.leftChain, state.left, isBypass);
        this.applyChannelSettings(this.rightChain, state.right, isBypass);

        // Stereo Width
        if (this.sideGain) {
            // map -135..135 to 0..2
            let widthVal = (state.widthRotation + 135) / 135; 
            if (widthVal < 0) widthVal = 0;
            // Normalizing: If knob is 0, rotation is 0. widthVal = 1.
            this.sideGain.gain.setTargetAtTime(widthVal, this.context.currentTime, 0.1);
        }

        // Limiter Toggle
        if (this.compressor) {
            if (state.limiterActive) {
                this.compressor.threshold.value = -1.0;
                this.compressor.ratio.value = 20;
            } else {
                // "Off" essentially means raising threshold so it never hits
                this.compressor.threshold.value = 0; 
                this.compressor.ratio.value = 1;
            }
        }
    }

    /**
     * Internal helper to apply settings to a specific channel chain.
     */
    applyChannelSettings(chain, data, bypass) {
        // Gain
        if (chain.gain) {
            // If bypass, input gain resets to 0db (1.0)
            const db = bypass ? 0 : data.gain;
            const linearGain = Math.pow(10, db / 20);
            chain.gain.gain.setTargetAtTime(linearGain, this.context.currentTime, 0.1);
        }

        // Filters
        chain.filters.forEach((filter) => {
            let key = filter.frequency.value.toString();
            if (key === "1000") key = "1k";
            if (key === "2000") key = "2k";
            if (key === "4000") key = "4k";
            if (key === "8000") key = "8k";
            if (key === "16000") key = "16k";

            const val = bypass ? 0 : (data.bands[key] !== undefined ? data.bands[key] : 0);
            filter.gain.setTargetAtTime(val, this.context.currentTime, 0.1);
        });
    }

    /**
     * Fades audio volume out to 0.
     * @param {number} duration - Duration in seconds.
     */
    fadeOut(duration = 0.5) {
        if (!this.context || !this.fadeGain) return;
        const curr = this.fadeGain.gain.value;
        this.fadeGain.gain.cancelScheduledValues(this.context.currentTime);
        this.fadeGain.gain.setValueAtTime(curr, this.context.currentTime);
        this.fadeGain.gain.linearRampToValueAtTime(0, this.context.currentTime + duration);
    }

    /**
     * Fades audio volume in to 1.
     * @param {number} duration - Duration in seconds.
     */
    fadeIn(duration = 0.5) {
        if (!this.context || !this.fadeGain) return;
        this.fadeGain.gain.cancelScheduledValues(this.context.currentTime);
        this.fadeGain.gain.setValueAtTime(0, this.context.currentTime);
        this.fadeGain.gain.linearRampToValueAtTime(1, this.context.currentTime + duration);
    }

    /**
     * Calculates the RMS (Root Mean Square) for metering.
     * @returns {{l: number, r: number}} Normalized RMS values (0.0 to 1.0).
     */
    getRMS() {
        if (!this.analyserL || !this.analyserR) return { l: 0, r: 0 };
        
        const dataL = new Uint8Array(this.analyserL.fftSize);
        const dataR = new Uint8Array(this.analyserR.fftSize);
        
        this.analyserL.getByteTimeDomainData(dataL);
        this.analyserR.getByteTimeDomainData(dataR);

        // Helper to calculate RMS from byte data (128 is 0)
        const calc = (data) => {
            let sum = 0;
            for(let i = 0; i < data.length; i++) {
                const x = (data[i] - 128) / 128;
                sum += x * x;
            }
            return Math.sqrt(sum / data.length);
        };

        return { l: calc(dataL), r: calc(dataR) };
    }

    /**
     * Resumes the AudioContext if suspended (required by browser policies).
     */
    resume() {
        // iOS requires AudioContext.resume() to be called from a user gesture
        if (this.context && this.context.state === 'suspended') {
            this.context.resume().then(() => {
                console.log("AudioContext resumed successfully");
            }).catch((e) => {
                console.warn("AudioContext resume failed:", e);
            });
        }
    }
    
    /**
     * Checks if the audio context is initialized and running.
     * @returns {boolean}
     */
    isReady() {
        return this.initialized && this.context && this.context.state === 'running';
    }
}