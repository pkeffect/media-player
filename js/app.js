/* VERSION: 8.5.0 */
/* js/app.js */
import { getUiElements } from './ui-elements.js';
import { initEvents } from './app-events.js';
import { MediaPlayer } from './player.js';
import { AudioEngine } from './audio.js';
import { SubtitleManager } from './subtitles.js';
import { ThumbnailGenerator } from './thumbnails.js';
import { initEQ } from './eq.js';
import { StreamManager } from './stream.js';
import { PlaylistManager } from './playlist-manager.js';
import { UIManager } from './ui-manager.js';
import { Logger } from './logger.js';
import { VideoManager } from './video-manager.js';
import { KeybindManager } from './keybind-manager.js';
import { appStore, Events } from './store.js';
import { getVersionString } from './version.js';

// --- Widget Loader ---
async function loadWidgets() {
    try {
        const files = ['menubar','eq','info','playlist','captions','stream','video-filters','keybinds','changelog'];
        const loads = files.map(f => fetch(`html/${f}.html`).then(r => r.text()));
        const htmls = await Promise.all(loads);
        
        document.body.insertAdjacentHTML('afterbegin', htmls[0]); 
        
        htmls.slice(1).forEach(h => {
             if(h.includes('playlist-sidebar')) {
                 document.getElementById('app-layout').insertAdjacentHTML('beforeend', h);
             } else {
                 document.body.insertAdjacentHTML('beforeend', h);
             }
        });
    } catch(e) {
        Logger.error(`Failed to load widgets: ${e}`);
    }
}

// --- Bootstrap ---
(async function initApp() {
    Logger.info(`Booting Internode ${getVersionString()}`);
    await loadWidgets();
    
    // Remove Loader
    const loader = document.getElementById('app-loader');
    if(loader) {
        loader.style.opacity = '0';
        setTimeout(() => loader.remove(), 500);
    }

    // Offline Detection
    const offlineInd = document.getElementById('offline-indicator');
    const updateOnlineStatus = () => {
        if(offlineInd) offlineInd.style.display = navigator.onLine ? 'none' : 'block';
    };
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();

    const uiEls = getUiElements();
    const videoEl = uiEls.video; 
    const subOverlay = document.getElementById('subtitle-overlay');

    const ui = new UIManager(uiEls);
    const pm = new PlaylistManager(); 
    const thumbGen = new ThumbnailGenerator();
    
    // --- Store Subscriptions ---
    appStore.on(Events.PLAYLIST_UPDATED, () => {
        renderList();
    });
    
    appStore.on(Events.TRACK_CHANGED, () => {
        renderList();
    });

    appStore.on(Events.ERROR, (msg) => {
        ui.showToast(msg);
    });
    
    // UI updates when Settings change
    appStore.on(Events.SETTINGS_CHANGED, (settings) => {
        if (settings.volume !== undefined) player.setVolume(settings.volume);
        if (settings.speed !== undefined) player.setSpeed(settings.speed);
        if (settings.shuffle !== undefined) ui.updateShuffleBtn(settings.shuffle);
        if (settings.loop !== undefined) ui.updateLoopBtn(settings.loop);
        
        if (settings.subtitlesVisible !== undefined) {
             subs.setVisible(settings.subtitlesVisible);
             uiEls.subBtn.classList.toggle('active', settings.subtitlesVisible);
        }
        
        if (uiEls.subOverlay) {
            if(settings.subFontSize) uiEls.subOverlay.style.setProperty('--sub-font-size', settings.subFontSize + 'rem');
            if(settings.subColor) uiEls.subOverlay.style.setProperty('--sub-color', settings.subColor);
            if(settings.subBgOpacity) uiEls.subOverlay.style.setProperty('--sub-bg-opacity', settings.subBgOpacity);
        }
    });
    
    // Initial Load
    setTimeout(() => {
        try {
            checkWatchedFolder();
            if (pm.currentIndex > -1) {
                const item = pm.currentItem;
                if (item) {
                    ui.showToast(`Restored: ${item.file.name}`);
                    playTrack(pm.currentIndex, false);
                }
            }
        } catch(e) {
            Logger.error("Startup Error: " + e);
        }
    }, 500);

    const audio = new AudioEngine(videoEl);
    const subs = new SubtitleManager(subOverlay, videoEl);
    const videoMgr = new VideoManager(videoEl, {
        showToast: (msg) => ui.showToast(msg)
    });
    const keys = new KeybindManager({
        showToast: (msg) => ui.showToast(msg)
    });

    // --- Global Focus Trap ---
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            const openModal = document.querySelector('.modal-overlay.visible, .eq-realistic.visible');
            if (openModal) {
                const focusables = openModal.querySelectorAll('button, input, select, textarea, [href]');
                if (focusables.length > 0) {
                    const first = focusables[0];
                    const last = focusables[focusables.length - 1];
                    if (e.shiftKey && document.activeElement === first) {
                        e.preventDefault();
                        last.focus();
                    } else if (!e.shiftKey && document.activeElement === last) {
                        e.preventDefault();
                        first.focus();
                    }
                } else {
                    e.preventDefault();
                }
            }
        }
    });

    // --- State Variables ---
    let draggedItemIndex = -1;
    let contextMenuTargetIndex = -1;
    let isEqOpenState = false;
    let searchDebounceTimer = null;
    const SEARCH_DEBOUNCE_MS = 300;
    
    let lastMouseX = 0;
    let lastMouseY = 0;
    const MOUSE_MOVE_THRESHOLD = 10; 

    const player = new MediaPlayer(
        videoEl,
        (type, data) => {
            if (type === 'progress') ui.updateSeek(data.percent);
            if (type === 'time') ui.updateTime(data.current, data.total);
            if (type === 'playState') {
                const isStream = pm.currentItem ? pm.currentItem.isStream : false;
                ui.updatePlayState(data, isStream);
                if (data) audio.resume();
                if (!data) showUI();
            }
            if (type === 'volume') ui.updateVolume(data, videoEl.muted);
        },
        {
            onEnded: () => {
                if (pm.loopMode === 2) player.restart();
                else playNext(true);
            },
            onError: (msg) => {
                ui.showToast(msg);
                pm.markError(pm.currentIndex);
            },
            onTimeUpdate: (time) => {
                subs.update(time);
                if (pm.currentItem) {
                    try {
                        localStorage.setItem('internode-resume', JSON.stringify({
                            id: pm.currentItem.id,
                            time: time
                        }));
                    } catch(e) {}
                }
            },
            onNext: () => playNext(),
            onPrev: () => playPrev()
        }
    );
    
    player.setAudioEngine(audio);

    initEQ(audio);
    ui.initResizer();
    if (window.innerWidth <= 768) {
        uiEls.playlistSidebar.classList.add('hidden');
        uiEls.togglePlaylistBtn.classList.remove('active');
    }
    
    const sets = pm.getSettings();
    player.setVolume(sets.volume);
    player.setSpeed(sets.speed);
    if(uiEls.speedSelect) uiEls.speedSelect.value = sets.speed;
    ui.updateShuffleBtn(sets.shuffle);
    ui.updateLoopBtn(sets.loop);
    ui.updateVolume(sets.volume, videoEl.muted);
    
    subs.setVisible(sets.subtitlesVisible);
    if (sets.subtitlesVisible) {
        uiEls.subBtn.classList.add('active');
    } else {
        uiEls.subBtn.classList.remove('active');
    }
    
    if (uiEls.inpCapSize) uiEls.inpCapSize.value = sets.subFontSize;
    if (uiEls.inpCapColor) uiEls.inpCapColor.value = sets.subColor;
    if (uiEls.inpCapBg) uiEls.inpCapBg.value = sets.subBgOpacity;
    if (uiEls.subOverlay) {
        uiEls.subOverlay.style.setProperty('--sub-font-size', sets.subFontSize + 'rem');
        uiEls.subOverlay.style.setProperty('--sub-color', sets.subColor);
        uiEls.subOverlay.style.setProperty('--sub-bg-opacity', sets.subBgOpacity);
    }

    new StreamManager({
        onLoad: (url) => {
            const idx = pm.addStream(url);
            playTrack(idx);
            ui.showToast("Stream Added");
        },
        onError: (msg) => ui.showToast(msg)
    });

    // --- Core Logic Functions ---

    function playTrack(index, autoPlay = true) {
        if (index < 0 || index >= pm.length) return;
        const item = pm.playlist[index];
        if (item.hasError) return;
        pm.setCurrentIndex(index);
        
        showUI();
        subs.clear();
        videoMgr.clearLoop(true); 
        
        const displayTitle = (item.metadata && item.metadata.title) ? item.metadata.title : item.file.name;
        const meta = { title: displayTitle, thumb: item.thumb, artist: item.metadata?.artist || '' };
        
        try {
            player.loadFile(item.isStream ? item.url : item.file, meta);
            if (!autoPlay) {
                videoEl.pause();
                ui.updatePlayState(false, item.isStream);
                try {
                    const resume = JSON.parse(localStorage.getItem('internode-resume'));
                    if (resume && resume.id === item.id) {
                        videoEl.currentTime = resume.time;
                    }
                } catch(e) {}
            }
        } catch (e) { ui.showToast("Error loading file"); }
    }

    function playNext(auto = false) {
        const next = pm.getNextIndex();
        if (next !== -1) playTrack(next);
    }

    function playPrev() {
        const prev = pm.getPrevIndex();
        if (prev !== -1) playTrack(prev);
    }

    function renderList() {
        ui.renderPlaylist(pm.playlist, pm.currentIndex, {
            onPlay: (idx) => playTrack(idx),
            onContextMenu: (e, idx) => {
                e.preventDefault();
                contextMenuTargetIndex = idx;
                let x = e.clientX;
                let y = e.clientY;
                const menuWidth = 150;
                const menuHeight = 130; 
                if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
                if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10;
                uiEls.contextMenu.style.left = `${x}px`;
                uiEls.contextMenu.style.top = `${y}px`;
                uiEls.contextMenu.classList.add('visible');
            },
            onDragStart: (idx) => draggedItemIndex = idx,
            onDragEnd: () => {}, 
            getDraggedIndex: () => draggedItemIndex,
            onDrop: (targetIdx) => {
                if (draggedItemIndex > -1) pm.reorder(draggedItemIndex, targetIdx);
            },
            reorderCallback: (from, to) => pm.reorder(from, to)
        });
    }

    function handleFiles(files) {
        try {
            const mediaFiles = [];
            Array.from(files).forEach(file => {
                if (file.name.match(/\.(srt|vtt|ass|ssa)$/i)) {
                    subs.loadFile(file);
                    ui.showToast("Subtitles Loaded");
                } else {
                    mediaFiles.push(file);
                }
            });
            if (mediaFiles.length > 0) {
                const wasEmpty = pm.length === 0;
                pm.addItems(mediaFiles);
                mediaFiles.forEach(f => {
                    if (f.type.startsWith('video/')) {
                        const item = pm.playlist.find(p => p.file === f);
                        if (item) {
                            thumbGen.addToQueue(f, (url) => {
                                pm.setThumb(item.id, url);
                            });
                        }
                    }
                });
                if (wasEmpty && pm.length > 0) playTrack(0);
            }
        } catch (e) {
            ui.showToast("File Import Error");
            Logger.error(e);
        }
    }

    function exportPlaylist() {
        if (pm.length === 0) {
            ui.showToast("Playlist is empty");
            return;
        }
        try {
            const data = {
                version: "1.0",
                exported: new Date().toISOString(),
                tracks: pm.playlist.map(item => ({
                    name: item.file.name,
                    isStream: item.isStream,
                    url: item.isStream ? item.url : null,
                    size: item.file.size || 0
                }))
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `internode-playlist-${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            ui.showToast("Playlist Exported");
        } catch(e) { Logger.error(e); }
    }

    function importPlaylist(file) {
        thumbGen.cancelQueue();
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target.result;
                if (file.name.endsWith('.json')) {
                    const data = JSON.parse(content);
                    if (data.tracks && Array.isArray(data.tracks)) {
                        let streamCount = 0;
                        data.tracks.forEach(track => {
                            if (track.isStream && track.url) {
                                pm.addStream(track.url);
                                streamCount++;
                            }
                        });
                        if (streamCount > 0) {
                            ui.showToast(`Imported ${streamCount} stream(s)`);
                        } else {
                            ui.showToast("No streams found in playlist");
                        }
                    } else {
                        ui.showToast("Invalid playlist format");
                    }
                } else if (file.name.endsWith('.m3u') || file.name.endsWith('.m3u8')) {
                    const lines = content.split('\n');
                    let count = 0;
                    lines.forEach(line => {
                        line = line.trim();
                        if (line && !line.startsWith('#')) {
                            if (line.startsWith('http')) {
                                pm.addStream(line);
                                count++;
                            } else {
                                console.warn("Local path in M3U ignored (Browser Sandbox): " + line);
                            }
                        }
                    });
                    if (count > 0) ui.showToast(`Imported ${count} items`);
                    else ui.showToast("No valid streams found");
                }
            } catch (err) {
                ui.showToast("Failed to parse playlist");
            }
        };
        reader.onerror = () => {
            ui.showToast("Failed to read file");
        };
        reader.readAsText(file);
    }

    function showUI(forceKeepOpen = false) {
        const isSidebarVisible = !uiEls.playlistSidebar.classList.contains('hidden');
        const isFullscreen = !!document.fullscreenElement;
        
        if (isFullscreen && !videoEl.paused && !forceKeepOpen) {
            ui.toggleControls(true, false);
            return;
        }
        
        const isMenuHovered = uiEls.menubar ? uiEls.menubar.matches(':hover') : false;
        const isControlsHovered = uiEls.controlsWrapper ? uiEls.controlsWrapper.matches(':hover') : false;
        
        const keepOpen = videoEl.paused || isSidebarVisible || isMenuHovered || isControlsHovered || forceKeepOpen;
        
        ui.toggleControls(true, keepOpen);
    }
    
    window.addEventListener('mousemove', (e) => {
        const deltaX = Math.abs(e.clientX - lastMouseX);
        const deltaY = Math.abs(e.clientY - lastMouseY);
        
        if (deltaX < MOUSE_MOVE_THRESHOLD && deltaY < MOUSE_MOVE_THRESHOLD) return;
        
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        showUI();
    });

    async function checkWatchedFolder() {
        try {
            const handle = await pm.loadDirectoryHandle();
            if (handle) {
                if ((await handle.queryPermission({ mode: 'read' })) === 'granted') {
                    scanDirectory(handle);
                } else {
                    ui.showToast("Reload Library Folder?", true);
                    const toast = document.getElementById('notification-toast');
                    toast.style.cursor = 'pointer';
                    const clickHandler = async () => {
                        cleanupToastHandler();
                        try {
                            if ((await handle.requestPermission({ mode: 'read' })) === 'granted') {
                                scanDirectory(handle);
                            }
                        } catch(e) { Logger.error(e); }
                    };
                    const cleanupToastHandler = () => {
                        toast.removeEventListener('click', clickHandler);
                        toast.style.cursor = 'default';
                    };
                    toast.addEventListener('click', clickHandler);
                    setTimeout(cleanupToastHandler, 5000);
                }
            }
        } catch (e) { Logger.error("Watched Folder Error: " + e); }
    }

    async function scanDirectory(dirHandle) {
        ui.showToast("Scanning Library...");
        const files = [];
        async function getFilesRecursively(dir) {
            for await (const entry of dir.values()) {
                if (entry.kind === 'file') {
                    if (entry.name.match(/\.(mp3|wav|ogg|mp4|webm|flac|m4a)$/i)) {
                        files.push(await entry.getFile());
                    }
                } else if (entry.kind === 'directory') {
                    await getFilesRecursively(entry);
                }
            }
        }
        
        try {
            await getFilesRecursively(dirHandle);
            if (files.length > 0) {
                handleFiles(files);
                ui.showToast(`Loaded ${files.length} files from Library`);
            }
        } catch (e) {
            Logger.error("Scan Error: " + e);
            ui.showToast("Library Scan Failed");
        }
    }

    const logic = {
        playTrack, playNext, playPrev, renderList, handleFiles, exportPlaylist, importPlaylist, showUI,
        handleSearch: () => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => renderList(), SEARCH_DEBOUNCE_MS);
        },
        removeContextItem: () => {
            if (contextMenuTargetIndex > -1) {
                pm.removeItem(contextMenuTargetIndex);
                if (pm.currentIndex === -1) { player.restart(); videoEl.src = ""; }
                uiEls.contextMenu.classList.remove('visible');
            }
        },
        moveContextItem: (direction) => {
            if (contextMenuTargetIndex > -1) {
                const newIndex = contextMenuTargetIndex + direction;
                if (newIndex >= 0 && newIndex < pm.length) {
                    pm.reorder(contextMenuTargetIndex, newIndex);
                    uiEls.contextMenu.classList.remove('visible');
                }
            }
        },
        openContextFolder: () => {
            ui.showToast("Open File Location not supported in Web Version");
            uiEls.contextMenu.classList.remove('visible');
        },
        isEqOpen: () => isEqOpenState,
        toggleEQ: async () => {
            isEqOpenState = !isEqOpenState;
            const isMobile = window.innerWidth <= 900;
            if (isEqOpenState) {
                uiEls.eqModal.classList.add('visible');
                uiEls.eqBtn.classList.add('active');
                if (isMobile) {
                    try {
                        if (screen.orientation && screen.orientation.lock) {
                            if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
                            await screen.orientation.lock('landscape');
                            uiEls.eqModal.classList.remove('force-landscape');
                        } else throw new Error("Orientation API not supported");
                    } catch (e) {
                        uiEls.eqModal.classList.add('force-landscape');
                    }
                }
            } else {
                logic.closeEQ();
            }
        },
        closeEQ: () => {
            isEqOpenState = false;
            const isMobile = window.innerWidth <= 900;
            uiEls.eqModal.classList.remove('visible');
            uiEls.eqBtn.classList.remove('active');
            uiEls.eqModal.classList.remove('force-landscape');
            if (screen.orientation && screen.orientation.unlock) {
                try { screen.orientation.unlock(); } catch (e) {}
            }
            if (document.fullscreenElement && isMobile) {
                document.exitFullscreen().catch(e => {});
            }
        },
        triggerAnim: (id) => {
            const el = document.getElementById(id);
            el.classList.add('animate');
            setTimeout(() => el.classList.remove('animate'), 300);
        },
        takeScreenshot: async () => {
            if (!videoEl.videoWidth) return;
            const canvas = document.createElement('canvas');
            canvas.width = videoEl.videoWidth;
            canvas.height = videoEl.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(async (blob) => {
                if (!blob) return;
                const filename = `internode-snap-${Date.now()}.png`;
                if (window.showSaveFilePicker) {
                    try {
                        const handle = await window.showSaveFilePicker({
                            suggestedName: filename,
                            types: [{ description: 'PNG Image', accept: {'image/png': ['.png']} }]
                        });
                        const writable = await handle.createWritable();
                        await writable.write(blob);
                        await writable.close();
                        ui.showToast("Screenshot Saved");
                    } catch (err) {}
                } else {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    ui.showToast("Screenshot Saved");
                }
            }, 'image/png');
        },
        stepFrame: (direction) => {
            if (!videoEl.duration) return;
            const FRAME_TIME = 0.04; 
            const newTime = videoEl.currentTime + (direction * FRAME_TIME);
            videoEl.currentTime = Math.min(videoEl.duration, Math.max(0, newTime));
        },
        setWatchedFolder: async (handle) => {
            try {
                if ((await handle.queryPermission({ mode: 'read' })) !== 'granted') {
                    if ((await handle.requestPermission({ mode: 'read' })) !== 'granted') {
                        ui.showToast("Folder access denied");
                        return;
                    }
                }
                await pm.saveDirectoryHandle(handle);
                scanDirectory(handle);
            } catch(e) { Logger.error(e); }
        },
        initEvents: (context) => initEvents(context) 
    };

    initEvents({ uiEls, player, pm, ui, audio, subs, thumbGen, logic, videoMgr, keys });

    if (!localStorage.getItem('internode-first-run')) {
        setTimeout(() => {
            if (uiEls.readmeModal) {
                uiEls.readmeModal.classList.add('visible');
                ui.showToast("Welcome! Info shown only on first visit.", true);
                localStorage.setItem('internode-first-run', 'true');
            }
        }, 500);
    }

    if ('serviceWorker' in navigator) {
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
        });
        navigator.serviceWorker.register('./sw.js').then(reg => {
            if (reg.waiting) {
                reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        ui.showToast("Update installed. Reloading...", true);
                        newWorker.postMessage({ type: 'SKIP_WAITING' });
                    }
                });
            });
        }).catch(err => console.error('SW Register fail', err));
    }
})();