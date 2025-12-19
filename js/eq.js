/* VERSION: 1.6.0 */
/* js/eq.js */

import { EQ_PRESETS } from './eq-presets.js';
import { Logger } from './logger.js';

export const AUDIO_ENGINE_STATE = {
    bypass: false,
    limiterActive: true,
    widthRotation: 0, // 0 deg = Normal Stereo
    left: {
        gain: 0.0,
        bands: { "25": 0.0, "40": 0.0, "63": 0.0, "100": 0.0, "160": 0.0, "250": 0.0, "500": 0.0, "1k": 0.0, "2k": 0.0, "4k": 0.0, "8k": 0.0, "16k": 0.0 }
    },
    right: {
        gain: 0.0,
        bands: { "25": 0.0, "40": 0.0, "63": 0.0, "100": 0.0, "160": 0.0, "250": 0.0, "500": 0.0, "1k": 0.0, "2k": 0.0, "4k": 0.0, "8k": 0.0, "16k": 0.0 }
    }
};

let audioContextRef = null;
let meterAnimFrame = null;

export function initEQ(audioEngineInstance) {
    audioContextRef = audioEngineInstance;
    
    initSliders();
    initKnobs();
    initButtons();
    initPresets(); 
    startMeterLoop();
    
    // Standardized log call using the Logger utility
    Logger.info("EQ UI Initialized (Mastering Enabled)", "color: #00ff88;");
}

function updateAudioEngine() {
    if (audioContextRef) {
        audioContextRef.updateFromState(AUDIO_ENGINE_STATE);
    }
}

function getClientY(e) {
    return e.touches ? e.touches[0].clientY : e.clientY;
}

// --- METERING VISUALIZATION ---
function startMeterLoop() {
    const canvas = document.getElementById('vu-meter');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const draw = () => {
        if (!audioContextRef) {
             meterAnimFrame = requestAnimationFrame(draw);
             return;
        }

        const rms = audioContextRef.getRMS();
        // RMS is 0 to 1 usually. 
        // Visual mapping: Logarithmic looks better for audio, but linear is ok for simple visual.
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Background
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Gradient
        const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
        grad.addColorStop(0, '#4caf50');   // Green
        grad.addColorStop(0.6, '#ffeb3b'); // Yellow
        grad.addColorStop(0.9, '#f44336'); // Red

        // L Channel (Top Half)
        const wL = Math.min(canvas.width, rms.l * 4 * canvas.width); // *4 for sensitivity boost
        ctx.fillStyle = grad;
        ctx.fillRect(0, 1, wL, (canvas.height/2) - 2);

        // R Channel (Bottom Half)
        const wR = Math.min(canvas.width, rms.r * 4 * canvas.width);
        ctx.fillStyle = grad;
        ctx.fillRect(0, (canvas.height/2) + 1, wR, (canvas.height/2) - 2);

        meterAnimFrame = requestAnimationFrame(draw);
    };
    
    draw();
}

// --- PRESET LOGIC ---
function initPresets() {
    const select = document.getElementById('eq-presets');
    if (!select) return;

    Object.keys(EQ_PRESETS).forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name.toUpperCase();
        select.appendChild(opt);
    });

    select.addEventListener('change', (e) => {
        const presetName = e.target.value;
        if (EQ_PRESETS[presetName]) {
            applyPreset(EQ_PRESETS[presetName]);
        }
    });
    
    select.addEventListener('touchstart', (e) => e.stopPropagation(), {passive: true});
}

function applyPreset(presetData) {
    Object.keys(presetData).forEach(band => {
        AUDIO_ENGINE_STATE.left.bands[band] = presetData[band];
        AUDIO_ENGINE_STATE.right.bands[band] = presetData[band];
    });

    AUDIO_ENGINE_STATE.left.gain = 0.0;
    AUDIO_ENGINE_STATE.right.gain = 0.0;
    
    // Don't reset Width/Limiter on preset change
    
    updateKnobsUI(); 

    const tracks = document.querySelectorAll('.slider-track');
    tracks.forEach(track => {
        const band = track.dataset.band;
        if (presetData[band] !== undefined) {
            const handle = track.querySelector('.slider-handle');
            const percentage = (presetData[band] / 24 + 0.5) * 100;
            updateVisuals(track, handle, percentage);
        }
    });

    updateAudioEngine();
}

function updateKnobsUI() {
    const knobs = document.querySelectorAll('.knob');
    knobs.forEach(knob => {
        // Reset only Gain knobs, preserve Width if it exists
        if (knob.dataset.param && knob.dataset.param.includes('gain')) {
            knob.style.transform = `rotate(0deg)`;
            knob.dataset.rotation = 0;
        }
    });
}

// --- 1. SLIDER LOGIC ---
function initSliders() {
    const tracks = document.querySelectorAll('.slider-track');
    
    tracks.forEach(track => {
        const channel = track.dataset.channel; 
        const band = track.dataset.band;       
        const handle = track.querySelector('.slider-handle');
        
        updateVisuals(track, handle, 50);

        let isDragging = false;

        const startDrag = (e) => {
            if (AUDIO_ENGINE_STATE.bypass) return; 
            
            e.stopPropagation();
            if (e.type === 'touchstart') e.preventDefault();
            
            isDragging = true;
            handle.style.cursor = 'grabbing';
            handle.classList.add('active-drag');
            handleMove(e);
            
            if (e.type === 'mousedown') {
                document.addEventListener('mousemove', handleMove);
                document.addEventListener('mouseup', stopDrag);
            } else {
                document.addEventListener('touchmove', handleMove, { passive: false });
                document.addEventListener('touchend', stopDrag);
            }
        };

        const handleMove = (e) => {
            if (!isDragging) return;
            if (e.type === 'touchmove') e.preventDefault();

            const clientY = getClientY(e);
            const trackRect = track.getBoundingClientRect();
            let distanceFromBottom = trackRect.bottom - clientY;
            
            if (distanceFromBottom < 0) distanceFromBottom = 0;
            if (distanceFromBottom > trackRect.height) distanceFromBottom = trackRect.height;

            const percentage = (distanceFromBottom / trackRect.height) * 100;
            let dbVal = ((percentage - 50) / 50) * 12;
            
            if (dbVal > -0.5 && dbVal < 0.5) {
                dbVal = 0;
                updateVisuals(track, handle, 50);
            } else {
                updateVisuals(track, handle, percentage);
            }
            
            if (AUDIO_ENGINE_STATE[channel] && AUDIO_ENGINE_STATE[channel].bands) {
                AUDIO_ENGINE_STATE[channel].bands[band] = parseFloat(dbVal.toFixed(1));
                updateAudioEngine(); 
            }
        };

        const stopDrag = () => {
            isDragging = false;
            handle.style.cursor = 'grab';
            handle.classList.remove('active-drag');
            
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('mouseup', stopDrag);
            document.removeEventListener('touchmove', handleMove);
            document.removeEventListener('touchend', stopDrag);
        };

        track.addEventListener('mousedown', startDrag);
        track.addEventListener('touchstart', startDrag, { passive: false });
        handle.addEventListener('mousedown', (e) => { e.stopPropagation(); startDrag(e); });
        handle.addEventListener('touchstart', (e) => { e.stopPropagation(); startDrag(e); }, { passive: false });
    });
}

function updateVisuals(track, handle, percentage) {
    handle.style.bottom = `${percentage}%`;
}


// --- 2. KNOB LOGIC ---
function initKnobs() {
    const knobs = document.querySelectorAll('.knob');

    knobs.forEach(knob => {
        const SENSITIVITY = 1.5; 
        let startY = 0;
        let initialRotation = 0;
        
        // Determine type
        const param = knob.dataset.param || 'gain'; // 'gain-left', 'gain-right', 'width'
        
        let currentRot = parseFloat(knob.dataset.rotation) || 0;
        knob.style.transform = `rotate(${currentRot}deg)`;

        const startDrag = (e) => {
            // Bypass logic: Bypass disables EQ Gains, but usually mastering controls (Width) might stay active.
            // For simplicity, let's allow all if not bypassed.
            if (AUDIO_ENGINE_STATE.bypass && param.includes('gain')) return;

            e.stopPropagation();
            if (e.type === 'touchstart') e.preventDefault();

            startY = getClientY(e);
            initialRotation = parseFloat(knob.dataset.rotation) || 0;
            
            if (e.type === 'mousedown') {
                document.addEventListener('mousemove', handleDrag);
                document.addEventListener('mouseup', stopDrag);
            } else {
                document.addEventListener('touchmove', handleDrag, { passive: false });
                document.addEventListener('touchend', stopDrag);
            }
        };

        const handleDrag = (e) => {
            if (e.type === 'touchmove') e.preventDefault();

            const clientY = getClientY(e);
            const deltaY = startY - clientY; 
            let newRotation = initialRotation + (deltaY * SENSITIVITY);

            if (newRotation > 135) newRotation = 135;
            if (newRotation < -135) newRotation = -135;

            knob.style.transform = `rotate(${newRotation}deg)`;
            knob.dataset.rotation = newRotation;
            
            // Map rotation
            if (param === 'width') {
                AUDIO_ENGINE_STATE.widthRotation = newRotation;
            } else {
                // Gain knobs
                const channel = knob.dataset.channel;
                let gainDb = (newRotation / 135) * 12;
                if (channel && AUDIO_ENGINE_STATE[channel]) {
                    AUDIO_ENGINE_STATE[channel].gain = parseFloat(gainDb.toFixed(1));
                }
            }
            updateAudioEngine(); 
        };

        const stopDrag = () => {
            document.removeEventListener('mousemove', handleDrag);
            document.removeEventListener('mouseup', stopDrag);
            document.removeEventListener('touchmove', handleDrag);
            document.removeEventListener('touchend', stopDrag);
        };

        knob.addEventListener('mousedown', startDrag);
        knob.addEventListener('touchstart', startDrag, { passive: false });
    });
}


// --- 3. SWITCH & RESET LOGIC ---
function initButtons() {
    const btnBypass = document.getElementById('btn-bypass');
    const btnReset = document.getElementById('btn-eq-reset');
    const btnLimiter = document.getElementById('btn-limiter');
    const closeBtn = document.getElementById('btn-close-eq');

    if (closeBtn) {
        closeBtn.addEventListener('touchstart', (e) => { e.stopPropagation(); }, {passive: true});
    }

    if (btnBypass) {
        const toggleBypass = (e) => {
            e.preventDefault();
            e.stopPropagation();
            btnBypass.classList.toggle('active');
            const isBypassed = btnBypass.classList.contains('active');
            
            AUDIO_ENGINE_STATE.bypass = isBypassed;
            toggleSystemLock(isBypassed);
            updateAudioEngine(); 
        };
        btnBypass.addEventListener('click', toggleBypass);
        btnBypass.addEventListener('touchstart', toggleBypass, {passive: false});
    }

    if (btnLimiter) {
        const toggleLimiter = (e) => {
            e.preventDefault();
            e.stopPropagation();
            btnLimiter.classList.toggle('active');
            AUDIO_ENGINE_STATE.limiterActive = btnLimiter.classList.contains('active');
            updateAudioEngine();
        };
        btnLimiter.addEventListener('click', toggleLimiter);
        btnLimiter.addEventListener('touchstart', toggleLimiter, {passive: false});
    }

    if (btnReset) {
        const doReset = (e) => {
            e.stopPropagation();
            resetEQ();
        };
        btnReset.addEventListener('click', doReset);
        btnReset.addEventListener('touchstart', doReset, {passive: true});
    }
}

function resetEQ() {
    // 1. Reset State Data
    AUDIO_ENGINE_STATE.left.gain = 0.0;
    AUDIO_ENGINE_STATE.right.gain = 0.0;
    AUDIO_ENGINE_STATE.widthRotation = 0;
    
    const bands = ["25", "40", "63", "100", "160", "250", "500", "1k", "2k", "4k", "8k", "16k"];
    bands.forEach(b => {
        AUDIO_ENGINE_STATE.left.bands[b] = 0.0;
        AUDIO_ENGINE_STATE.right.bands[b] = 0.0;
    });

    // 2. Reset Visuals - Sliders
    const tracks = document.querySelectorAll('.slider-track');
    tracks.forEach(track => {
        const handle = track.querySelector('.slider-handle');
        updateVisuals(track, handle, 50); 
    });

    // 3. Reset Visuals - Knobs
    updateKnobsUI();
    const wKnob = document.getElementById('knob-width');
    if(wKnob) {
        wKnob.style.transform = `rotate(0deg)`;
        wKnob.dataset.rotation = 0;
    }

    // 4. Update Engine
    updateAudioEngine();

    // 5. Reset Dropdown
    const select = document.getElementById('eq-presets');
    if(select) select.selectedIndex = 0;
}

function toggleSystemLock(isLocked) {
    const panels = document.querySelectorAll('.eq-channel, .knob-group');
    // We only lock EQ sections, not mastering (optional choice)
    
    panels.forEach(p => {
        // Only lock input gains, not Width knob if it's in a knob-group
        const parent = p.closest('.eq-controls-right');
        if (!parent) {
             p.style.opacity = isLocked ? '0.4' : '1';
             p.style.pointerEvents = isLocked ? 'none' : 'auto';
             p.style.transition = 'opacity 0.2s ease';
        }
    });
}