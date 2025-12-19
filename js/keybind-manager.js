/* VERSION: 1.0.0 */
/* js/keybind-manager.js */
/**
 * Manages Keyboard Shortcuts and Custom Mappings
 */
export class KeybindManager {
    constructor(uiCallbacks) {
        this.showToast = uiCallbacks.showToast;
        
        // Action Definitions
        this.actions = {
            'togglePlay': { name: 'Play / Pause', default: 'Space' },
            'seekFwd': { name: 'Seek Forward 5s', default: 'ArrowRight' },
            'seekBack': { name: 'Seek Backward 5s', default: 'ArrowLeft' },
            'volUp': { name: 'Volume Up', default: 'ArrowUp' },
            'volDown': { name: 'Volume Down', default: 'ArrowDown' },
            'toggleMute': { name: 'Mute / Unmute', default: 'KeyM' },
            'toggleFullscreen': { name: 'Toggle Fullscreen', default: 'KeyF' },
            'nextTrack': { name: 'Next Track', default: 'KeyJ' },
            'prevTrack': { name: 'Previous Track', default: 'KeyK' },
            'frameBack': { name: 'Frame Step Back', default: 'Comma' },
            'frameFwd': { name: 'Frame Step Fwd', default: 'Period' },
            'loopA': { name: 'Set Loop Start (A)', default: 'BracketLeft' },
            'loopB': { name: 'Set Loop End (B)', default: 'BracketRight' },
            'loopClear': { name: 'Clear Loop', default: 'Backslash' },
            'closeModal': { name: 'Close Menus/Modals', default: 'Escape' }
        };

        // Load mappings
        this.mappings = { ...this.getDefaults() };
        this.load();
    }

    getDefaults() {
        const defaults = {};
        for (const [action, def] of Object.entries(this.actions)) {
            defaults[action] = def.default;
        }
        return defaults;
    }

    load() {
        try {
            const saved = localStorage.getItem('internode-keybinds');
            if (saved) {
                this.mappings = { ...this.getDefaults(), ...JSON.parse(saved) };
            }
        } catch (e) {
            console.warn("Failed to load keybinds", e);
        }
    }

    save() {
        localStorage.setItem('internode-keybinds', JSON.stringify(this.mappings));
        this.showToast("Keybinds Saved");
    }

    reset() {
        this.mappings = this.getDefaults();
        this.save();
        this.showToast("Keybinds Reset");
    }

    getAction(code) {
        // Reverse lookup: code -> action
        // Note: This simple lookup assumes 1 key = 1 action.
        return Object.keys(this.mappings).find(action => this.mappings[action] === code);
    }

    setBind(action, code) {
        // Remove code from other actions to prevent conflict
        for (const act in this.mappings) {
            if (this.mappings[act] === code) {
                this.mappings[act] = null; // Unbind
            }
        }
        this.mappings[action] = code;
        this.save();
    }

    // --- UI Generation ---
    renderUI(container) {
        container.innerHTML = '';
        
        for (const [action, def] of Object.entries(this.actions)) {
            const row = document.createElement('div');
            row.className = 'keybind-row';
            
            const label = document.createElement('div');
            label.className = 'keybind-label';
            label.textContent = def.name;
            
            const btn = document.createElement('button');
            btn.className = 'keybind-input';
            btn.textContent = this.formatKey(this.mappings[action]);
            
            btn.onclick = () => {
                btn.textContent = "Press Key...";
                btn.classList.add('recording');
                
                const handler = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Ignore modifiers alone
                    if (['Shift','Control','Alt','Meta'].includes(e.key)) return;
                    
                    this.setBind(action, e.code);
                    btn.textContent = this.formatKey(e.code);
                    btn.classList.remove('recording');
                    
                    document.removeEventListener('keydown', handler);
                };
                
                document.addEventListener('keydown', handler, { once: true, capture: true });
            };
            
            row.appendChild(label);
            row.appendChild(btn);
            container.appendChild(row);
        }
    }

    formatKey(code) {
        if (!code) return "Unbound";
        return code.replace('Key', '').replace('Arrow', '').replace('Digit', '');
    }
}