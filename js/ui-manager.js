/* VERSION: 3.4.0 */
/* js/ui-manager.js */
export class UIManager {
    constructor(elements) {
        this.el = elements;
        this.toastTimeout = null;
        this.activityTimeout = null;
        this.FADE_TIMEOUT_NORMAL = 2500;
        this.FADE_TIMEOUT_FULLSCREEN = 1500;

        this.ITEM_HEIGHT = 56; 
        this.visibleRange = { start: 0, end: 0 };
        this.lastScrollTop = 0;
        this.cachedPlaylist = [];
        this.cachedCallbacks = null;
        this.currentTrackIndex = -1;

        this.isTouchDragging = false;
        this.ghostEl = null;

        this.initVirtualScroll();
        this.checkIOSVolume();
        
        // Announce Slider Values
        if (this.el.volSlider) {
            this.el.volSlider.addEventListener('input', (e) => {
                this.el.volSlider.setAttribute('aria-valuenow', Math.round(e.target.value * 100));
                this.el.volSlider.setAttribute('title', Math.round(e.target.value * 100) + '%');
            });
        }
    }

    checkIOSVolume() {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); 
        
        if (isIOS) {
            if (this.el.volSlider && this.el.volSlider.parentElement) {
                this.el.volSlider.parentElement.style.display = 'none';
            }
        }
    }

    initVirtualScroll() {
        if (!this.el.playlistEl) return;
        this.spacer = document.createElement('div');
        this.spacer.className = 'virtual-spacer';
        this.el.playlistEl.appendChild(this.spacer);
        this.el.playlistEl.addEventListener('scroll', () => this.renderVirtualFrame(), { passive: true });
        window.addEventListener('resize', () => this.renderVirtualFrame());
    }

    renderPlaylist(playlist, currentIndex, callbacks) {
        this.cachedPlaylist = playlist;
        this.cachedCallbacks = callbacks;
        this.currentTrackIndex = currentIndex;

        const filter = this.el.searchInput.value.toLowerCase();
        
        if (filter) {
            // FUZZY SEARCH IMPL
            this.filteredItems = playlist.map((item, index) => ({ item, index }))
                .filter(({ item }) => {
                    const text = (item.file.name + (item.metadata?.title || '') + (item.metadata?.artist || '')).toLowerCase();
                    // Simple "includes" is often enough, but splitting by space allows partial matching "foo bar"
                    const terms = filter.split(' ');
                    return terms.every(term => text.includes(term));
                });
        } else {
            this.filteredItems = playlist.map((item, index) => ({ item, index }));
        }

        const totalHeight = this.filteredItems.length * this.ITEM_HEIGHT;
        this.spacer.style.height = `${totalHeight}px`;

        this.renderVirtualFrame(true);
    }

    renderVirtualFrame(force = false) {
        if (!this.cachedPlaylist) return;
        
        const container = this.el.playlistEl;
        const scrollTop = container.scrollTop;
        const containerHeight = container.clientHeight;
        
        const BUFFER = 5;
        const startIdx = Math.max(0, Math.floor(scrollTop / this.ITEM_HEIGHT) - BUFFER);
        const endIdx = Math.min(this.filteredItems.length, Math.ceil((scrollTop + containerHeight) / this.ITEM_HEIGHT) + BUFFER);
        
        if (!force && startIdx === this.visibleRange.start && endIdx === this.visibleRange.end) return;
        
        this.visibleRange = { start: startIdx, end: endIdx };
        
        const existingMap = new Map();
        Array.from(container.children).forEach(child => {
            if (child.classList.contains('playlist-item')) {
                existingMap.set(child.dataset.virtualIndex, child);
            }
        });

        const activeIds = new Set();
        const isPlaying = this.el.video && !this.el.video.paused;

        for (let i = startIdx; i < endIdx; i++) {
            const { item, index: originalIndex } = this.filteredItems[i];
            const virtualId = String(i); 
            activeIds.add(virtualId);

            let div = existingMap.get(virtualId);
            const signature = `${item.id}|${originalIndex === this.currentTrackIndex}|${item.hasError}|${item.metadata?.title}`;
            
            if (!div) {
                div = document.createElement('div');
                div.dataset.virtualIndex = virtualId;
                div.style.position = 'absolute'; 
                div.style.height = `${this.ITEM_HEIGHT}px`;
                this.initTouchDragLogic(div, () => this.filteredItems[i].index, this.cachedCallbacks.reorderCallback);
                container.appendChild(div);
                div.dataset.signature = ''; 
            }

            div.style.top = `${i * this.ITEM_HEIGHT}px`;
            
            if (div.dataset.signature !== signature) {
                div.dataset.signature = signature;
                div.className = `playlist-item ${originalIndex === this.currentTrackIndex ? 'active' : ''} ${item.hasError ? 'error' : ''}`;
                
                div.onclick = () => {
                    if (!item.hasError) {
                        // HAPTIC FEEDBACK
                        if (navigator.vibrate) navigator.vibrate(10);
                        this.cachedCallbacks.onPlay(originalIndex);
                    }
                };
                div.oncontextmenu = (e) => this.cachedCallbacks.onContextMenu(e, originalIndex);
                div.draggable = true;
                div.ondragstart = () => this.cachedCallbacks.onDragStart(originalIndex);
                div.ondragend = () => { div.classList.remove('dragging'); this.cachedCallbacks.onDragEnd(); };
                div.ondragover = (e) => { 
                    e.preventDefault(); 
                    if(this.cachedCallbacks.getDraggedIndex() !== originalIndex) div.classList.add('drag-over'); 
                };
                div.ondragleave = () => div.classList.remove('drag-over');
                div.ondrop = (e) => { 
                    e.preventDefault(); 
                    div.classList.remove('drag-over'); 
                    this.cachedCallbacks.onDrop(originalIndex); 
                };

                div.innerHTML = ''; 
                const img = document.createElement('img');
                img.className = 'thumb-preview';
                img.src = item.thumb || '';
                img.draggable = false;
                div.appendChild(img);

                const infoDiv = document.createElement('div');
                infoDiv.className = 'item-info';

                const nameDiv = document.createElement('div');
                nameDiv.className = 'item-name';
                nameDiv.textContent = item.metadata?.title || item.file.name; 
                infoDiv.appendChild(nameDiv);

                const metaDiv = document.createElement('div');
                metaDiv.className = 'item-meta';
                metaDiv.textContent = item.metadata?.artist ? item.metadata.artist : (item.isStream ? 'Live Stream' : this.formatBytes(item.file.size));
                infoDiv.appendChild(metaDiv);

                div.appendChild(infoDiv);

                if (originalIndex === this.currentTrackIndex && !item.hasError) {
                    const eqOverlay = document.createElement('div');
                    eqOverlay.className = isPlaying ? 'mini-eq-overlay is-playing' : 'mini-eq-overlay';
                    eqOverlay.innerHTML = `
                        <svg viewBox="0 0 24 14">
                            <defs><linearGradient id="p-grad-${i}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#4caf50"/><stop offset="1" stop-color="#f44336"/></linearGradient></defs>
                            <rect class="eq-bar eq-bar-1" x="1" y="4" width="3" height="10" fill="url(#p-grad-${i})"/>
                            <rect class="eq-bar eq-bar-2" x="5.5" y="2" width="3" height="12" fill="url(#p-grad-${i})"/>
                            <rect class="eq-bar eq-bar-3" x="10" y="5" width="3" height="9" fill="url(#p-grad-${i})"/>
                            <rect class="eq-bar eq-bar-4" x="14.5" y="3" width="3" height="11" fill="url(#p-grad-${i})"/>
                            <rect class="eq-bar eq-bar-5" x="19" y="6" width="3" height="8" fill="url(#p-grad-${i})"/>
                        </svg>`;
                    div.appendChild(eqOverlay);
                }
            } else {
                const img = div.querySelector('.thumb-preview');
                if (img && item.thumb && img.src !== item.thumb) img.src = item.thumb;
            }
        }

        existingMap.forEach((div, id) => {
            if (!activeIds.has(id)) div.remove();
        });
    }

    showToast(msg, highPriority = false) {
        if(!this.el.toast) return;
        this.el.toast.textContent = msg;
        this.el.toast.classList.toggle('high-priority', highPriority);
        this.el.toast.classList.add('visible');
        clearTimeout(this.toastTimeout);
        this.toastTimeout = setTimeout(() => {
            this.el.toast.classList.remove('visible');
        }, 3000);
    }

    toggleControls(show, forceKeepOpen = false) {
        if (show) {
            this.el.controlsWrapper?.classList.remove('fade-out');
            this.el.stage.classList.remove('no-cursor');
            this.el.menubar?.classList.remove('fade-out');
            if(this.el.mobilePlaylistToggle) this.el.mobilePlaylistToggle.style.opacity = '1';

            clearTimeout(this.activityTimeout);
            if (!forceKeepOpen) {
                const isFullscreen = !!document.fullscreenElement;
                const timeout = isFullscreen ? this.FADE_TIMEOUT_FULLSCREEN : this.FADE_TIMEOUT_NORMAL;
                this.activityTimeout = setTimeout(() => {
                    this.el.controlsWrapper?.classList.add('fade-out');
                    this.el.stage.classList.add('no-cursor');
                    this.el.menubar?.classList.add('fade-out');
                    if(this.el.mobilePlaylistToggle) this.el.mobilePlaylistToggle.style.opacity = '0';
                }, timeout);
            }
        }
    }

    updatePlayState(isPlaying, isStream = false) {
        this.el.iconPlay.style.display = isPlaying ? 'none' : 'block';
        this.el.iconPause.style.display = isPlaying ? 'block' : 'none';
        
        if (this.el.centerIcon) {
            this.el.centerIcon.classList.toggle('visible', !isPlaying);
        }

        const activeEq = document.querySelector('.playlist-item.active .mini-eq-overlay');
        if (activeEq) activeEq.classList.toggle('is-playing', isPlaying);
    }

    updateTime(current, total) {
        this.el.timeDisplay.textContent = `${current} / ${total}`;
    }

    updateSeek(percent) {
        if (this.el.seekFill) this.el.seekFill.style.width = `${percent}%`;
        if (this.el.seekThumb) this.el.seekThumb.style.left = `${percent}%`;
    }

    updateVolume(vol, isMuted) {
        this.el.volSlider.value = vol;
        this.el.muteBtn.classList.toggle('muted', isMuted || vol === 0);
        const up = this.el.muteBtn.querySelector('.icon-vol-up');
        const off = this.el.muteBtn.querySelector('.icon-vol-off');
        if (up) up.style.display = (isMuted || vol === 0) ? 'none' : 'block';
        if (off) off.style.display = (isMuted || vol === 0) ? 'block' : 'none';
    }

    updateLoopBtn(mode) {
        this.el.loopBtn.classList.toggle('active', mode > 0);
        this.el.loopBadge.textContent = mode === 1 ? 'A' : (mode === 2 ? '1' : '');
    }

    updateShuffleBtn(active) {
        this.el.shuffleBtn.classList.toggle('active', active);
    }

    initResizer() {
        if (!this.el.sidebarResizer) return;
        let isResizing = false;
        const doResize = (e) => {
            if (!isResizing) return;
            let newWidth = window.innerWidth - e.clientX;
            this.el.playlistSidebar.style.width = `${Math.max(200, Math.min(newWidth, window.innerWidth * 0.5))}px`;
        };
        const stopResize = () => {
            isResizing = false;
            document.body.style.cursor = 'default';
            document.removeEventListener('mousemove', doResize);
            document.removeEventListener('mouseup', stopResize);
        };
        this.el.sidebarResizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            e.preventDefault();
            document.body.style.cursor = 'ew-resize';
            document.addEventListener('mousemove', doResize);
            document.addEventListener('mouseup', stopResize);
        });
    }

    initTouchDragLogic(el, getIndex, reorderCallback) {
        el.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            const idx = getIndex();
            this.touchDragTimer = setTimeout(() => {
                this.isTouchDragging = true;
                this.touchSourceIndex = idx;
                
                // HAPTIC
                if (navigator.vibrate) navigator.vibrate(50);
                
                el.classList.add('touch-drag-source');
                this.ghostEl = el.cloneNode(true);
                this.ghostEl.className = 'touch-drag-ghost';
                document.body.appendChild(this.ghostEl);
            }, 600);
        }, {passive: false});

        el.addEventListener('touchmove', (e) => {
            if (this.isTouchDragging && this.ghostEl) {
                e.preventDefault();
                this.ghostEl.style.left = `${e.touches[0].clientX}px`;
                this.ghostEl.style.top = `${e.touches[0].clientY}px`;
            }
        }, {passive: false});

        el.addEventListener('touchend', (e) => {
            clearTimeout(this.touchDragTimer);
            if (this.isTouchDragging) {
                this.isTouchDragging = false;
                if(this.ghostEl) this.ghostEl.remove();
                el.classList.remove('touch-drag-source');
                
                const y = e.changedTouches[0].clientY;
                const rect = this.el.playlistEl.getBoundingClientRect();
                if (y > rect.top && y < rect.bottom) {
                     const relativeY = y - rect.top + this.el.playlistEl.scrollTop;
                     const targetIndex = Math.floor(relativeY / this.ITEM_HEIGHT);
                     if (targetIndex >= 0 && targetIndex < this.cachedPlaylist.length) {
                         const currentIdx = getIndex();
                         if(currentIdx !== targetIndex) reorderCallback(currentIdx, targetIndex);
                     }
                }
            }
        });
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return parseFloat((bytes / Math.pow(1024, i)).toFixed(1)) + ' ' + ['B','KB','MB','GB'][i];
    }
}