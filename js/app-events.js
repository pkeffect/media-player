/* VERSION: 2.4.0 */
/* js/app-events.js */
/**
 * Event Listeners and Input Handling
 */
export function initEvents(ctx) {
    const { uiEls, player, pm, ui, audio, subs, logic, videoMgr, keys } = ctx;
    
    let lastTapTime = 0;
    let seekDragging = false;

    // --- iOS Audio Context Resume Helper ---
    const resumeAudioContext = () => {
        if (audio && audio.context && audio.context.state === 'suspended') {
            audio.context.resume();
        }
    };

    const firstInteraction = () => {
        resumeAudioContext();
        document.removeEventListener('touchstart', firstInteraction);
        document.removeEventListener('click', firstInteraction);
    };
    window.addEventListener('touchstart', firstInteraction, { passive: true });
    window.addEventListener('click', firstInteraction, { passive: true });

    // --- UI Wake Up Logic (Global) ---
    window.addEventListener('touchstart', () => { logic.showUI(); }, { passive: true });
    window.addEventListener('click', () => { logic.showUI(); }, { passive: true });

    // --- Menu Bar Mobile Logic ---
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.top-menubar')) {
            document.querySelectorAll('.top-menubar li.is-open').forEach(el => {
                el.classList.remove('is-open');
            });
        }
    });

    const topLevelMenus = document.querySelectorAll('.top-menubar > ul > li');
    topLevelMenus.forEach(menu => {
        const title = menu.querySelector('span');
        if(title) {
            title.addEventListener('click', (e) => {
                if (menu.querySelector('.dropdown-menu')) {
                    e.stopPropagation(); 
                    const wasOpen = menu.classList.contains('is-open');
                    document.querySelectorAll('.top-menubar li.is-open').forEach(el => el.classList.remove('is-open'));
                    if (!wasOpen) menu.classList.add('is-open');
                }
            });
        }
    });

    // --- File Inputs ---
    uiEls.fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) logic.handleFiles(e.target.files);
        uiEls.fileInput.value = '';
    });

    if (uiEls.folderInput) {
        uiEls.folderInput.addEventListener('change', (e) => {
            if (e.target.files.length) logic.handleFiles(e.target.files);
            uiEls.folderInput.value = '';
        });
    }

    if (uiEls.importInput) {
        uiEls.importInput.addEventListener('change', (e) => {
            if (e.target.files.length) logic.importPlaylist(e.target.files[0]);
            uiEls.importInput.value = '';
        });
    }

    // --- Search ---
    uiEls.searchInput.addEventListener('input', () => logic.handleSearch());

    // --- Playback Controls ---
    uiEls.playBtn.addEventListener('click', (e) => { e.stopPropagation(); player.togglePlay(); });
    uiEls.prevBtn.addEventListener('click', (e) => { e.stopPropagation(); logic.playPrev(); });
    uiEls.nextBtn.addEventListener('click', (e) => { e.stopPropagation(); logic.playNext(); });
    uiEls.muteBtn.addEventListener('click', (e) => { e.stopPropagation(); player.toggleMute(); });
    uiEls.pipBtn.addEventListener('click', () => player.togglePiP());
    
    uiEls.screenshotBtn.addEventListener('click', () => logic.takeScreenshot());

    if (uiEls.framePrevBtn) {
        uiEls.framePrevBtn.addEventListener('click', (e) => { e.stopPropagation(); logic.stepFrame(-1); });
    }
    if (uiEls.frameNextBtn) {
        uiEls.frameNextBtn.addEventListener('click', (e) => { e.stopPropagation(); logic.stepFrame(1); });
    }

    uiEls.volSlider.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        player.setVolume(v);
        pm.saveSettings({ volume: v });
    });

    uiEls.speedSelect.addEventListener('change', (e) => {
        const v = parseFloat(e.target.value);
        player.setSpeed(v);
        pm.saveSettings({ speed: v });
    });

    uiEls.fsBtn.addEventListener('click', () => {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        if (document.fullscreenElement || document.webkitFullscreenElement) {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        } else {
            if (isIOS && uiEls.video.webkitEnterFullscreen) {
                uiEls.video.webkitEnterFullscreen();
            } else if (uiEls.stage.requestFullscreen) {
                uiEls.stage.requestFullscreen();
            } else if (uiEls.stage.webkitRequestFullscreen) {
                uiEls.stage.webkitRequestFullscreen();
            }
        }
    });

    // --- Subtitles ---
    uiEls.subBtn.addEventListener('click', () => {
        const active = subs.toggle();
        uiEls.subBtn.classList.toggle('active', active);
        pm.saveSettings({ subtitlesVisible: active });
    });

    uiEls.subBtn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uiEls.captionModal.classList.add('visible');
    });

    if (uiEls.btnCaptionClose) {
        uiEls.btnCaptionClose.addEventListener('click', () => uiEls.captionModal.classList.remove('visible'));
    }

    if (uiEls.inpCapSize) {
        uiEls.inpCapSize.addEventListener('input', (e) => {
            const val = e.target.value;
            uiEls.subOverlay.style.setProperty('--sub-font-size', val + 'rem');
            pm.saveSettings({ subFontSize: parseFloat(val) });
        });
    }

    if (uiEls.inpCapColor) {
        uiEls.inpCapColor.addEventListener('input', (e) => {
            const val = e.target.value;
            uiEls.subOverlay.style.setProperty('--sub-color', val);
            pm.saveSettings({ subColor: val });
        });
    }

    if (uiEls.inpCapBg) {
        uiEls.inpCapBg.addEventListener('input', (e) => {
            const val = e.target.value;
            uiEls.subOverlay.style.setProperty('--sub-bg-opacity', val);
            pm.saveSettings({ subBgOpacity: parseFloat(val) });
        });
    }

    // --- Keybinding UI ---
    if (uiEls.menuKeybinds) {
        uiEls.menuKeybinds.addEventListener('click', () => {
            keys.renderUI(uiEls.keybindList);
            uiEls.keybindModal.classList.add('visible');
        });
    }
    if (uiEls.btnKeybindClose) {
        uiEls.btnKeybindClose.addEventListener('click', () => uiEls.keybindModal.classList.remove('visible'));
    }
    if (uiEls.btnKeybindReset) {
        uiEls.btnKeybindReset.addEventListener('click', () => {
            keys.reset();
            keys.renderUI(uiEls.keybindList);
        });
    }

    // --- Changelog UI ---
    if (uiEls.menuChangelog) {
        uiEls.menuChangelog.addEventListener('click', () => uiEls.changelogModal.classList.add('visible'));
    }
    if (uiEls.btnCloseChangelog) {
        uiEls.btnCloseChangelog.addEventListener('click', () => uiEls.changelogModal.classList.remove('visible'));
    }

    // --- Video Adjustments ---
    if (uiEls.btnVideoClose) {
        uiEls.btnVideoClose.addEventListener('click', () => uiEls.videoModal.classList.remove('visible'));
    }
    
    if (uiEls.btnVideoReset) {
        uiEls.btnVideoReset.addEventListener('click', () => {
            videoMgr.resetFilters();
            uiEls.inpVidBright.value = 100; uiEls.valVidBright.textContent = "100%";
            uiEls.inpVidContrast.value = 100; uiEls.valVidContrast.textContent = "100%";
            uiEls.inpVidSat.value = 100; uiEls.valVidSat.textContent = "100%";
            uiEls.inpVidHue.value = 0; uiEls.valVidHue.textContent = "0°";
        });
    }

    const bindFilter = (inp, valEl, type, unit) => {
        if (inp) {
            inp.addEventListener('input', (e) => {
                const v = e.target.value;
                valEl.textContent = v + unit;
                videoMgr.setFilter(type, v);
            });
        }
    };

    bindFilter(uiEls.inpVidBright, uiEls.valVidBright, 'brightness', '%');
    bindFilter(uiEls.inpVidContrast, uiEls.valVidContrast, 'contrast', '%');
    bindFilter(uiEls.inpVidSat, uiEls.valVidSat, 'saturate', '%');
    bindFilter(uiEls.inpVidHue, uiEls.valVidHue, 'hue', '°');

    // --- Playlist Tools ---
    uiEls.shuffleBtn.addEventListener('click', () => {
        const val = pm.toggleShuffle();
        ui.updateShuffleBtn(val);
    });

    uiEls.loopBtn.addEventListener('click', () => {
        const val = pm.cycleLoopMode();
        ui.updateLoopBtn(val);
    });

    // --- Playlist Management ---
    uiEls.openBtn.addEventListener('click', () => uiEls.fileInput.click());
    if (uiEls.openFolderBtn) uiEls.openFolderBtn.addEventListener('click', () => uiEls.folderInput.click());
    if (uiEls.exportBtn) uiEls.exportBtn.addEventListener('click', () => logic.exportPlaylist());
    if (uiEls.importBtn) uiEls.importBtn.addEventListener('click', () => uiEls.importInput.click());

    // --- Layout Toggles ---
    const handlePlaylistToggle = () => {
        uiEls.playlistSidebar.classList.toggle('hidden');
        uiEls.togglePlaylistBtn.classList.toggle('active');
        logic.showUI();
    };
    uiEls.togglePlaylistBtn.addEventListener('click', handlePlaylistToggle);
    if (uiEls.mobilePlaylistToggle) {
        uiEls.mobilePlaylistToggle.addEventListener('click', (e) => { e.stopPropagation(); handlePlaylistToggle(); });
        uiEls.mobilePlaylistToggle.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); handlePlaylistToggle(); });
    }

    // --- Readme Modal ---
    if (uiEls.readmeBtn && uiEls.readmeModal) {
        uiEls.readmeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            uiEls.readmeModal.classList.add('visible');
        });
    }
    if (uiEls.closeReadmeBtn && uiEls.readmeModal) {
        uiEls.closeReadmeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            uiEls.readmeModal.classList.remove('visible');
        });
    }
    if (uiEls.readmeModal) {
        uiEls.readmeModal.addEventListener('click', (e) => {
            if (e.target === uiEls.readmeModal) uiEls.readmeModal.classList.remove('visible');
        });
    }

    // --- Seek ---
    const handleSeek = (clientX) => {
        const rect = uiEls.seekContainer.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        player.seek(percent);
    };

    uiEls.seekContainer.addEventListener('click', (e) => {
        e.stopPropagation();
        handleSeek(e.clientX);
    });

    uiEls.seekContainer.addEventListener('touchstart', (e) => {
        e.stopPropagation();
        seekDragging = true;
        handleSeek(e.touches[0].clientX);
    }, { passive: true });

    uiEls.seekContainer.addEventListener('touchmove', (e) => {
        if (seekDragging) {
            e.preventDefault();
            handleSeek(e.touches[0].clientX);
        }
    }, { passive: false });

    uiEls.seekContainer.addEventListener('touchend', () => {
        seekDragging = false;
    }, { passive: true });

    // --- Context Menu ---
    if (uiEls.ctxRemoveBtn) uiEls.ctxRemoveBtn.addEventListener('click', () => logic.removeContextItem());
    if (uiEls.ctxMoveUpBtn) uiEls.ctxMoveUpBtn.addEventListener('click', () => logic.moveContextItem(-1));
    if (uiEls.ctxMoveDownBtn) uiEls.ctxMoveDownBtn.addEventListener('click', () => logic.moveContextItem(1));
    if (uiEls.ctxOpenFolderBtn) uiEls.ctxOpenFolderBtn.addEventListener('click', () => logic.openContextFolder());

    window.addEventListener('click', (e) => {
        if (!e.target.closest('#context-menu')) uiEls.contextMenu.classList.remove('visible');
    });

    // --- EQ ---
    uiEls.eqBtn.addEventListener('click', (e) => { e.stopPropagation(); logic.toggleEQ(); });
    uiEls.closeEqBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); logic.toggleEQ(); });

    // --- Drag & Drop ---
    window.addEventListener('dragover', (e) => { e.preventDefault(); uiEls.dropOverlay.classList.add('active'); });
    window.addEventListener('dragleave', (e) => { if (e.clientX === 0 || e.clientY === 0) uiEls.dropOverlay.classList.remove('active'); });
    window.addEventListener('drop', (e) => {
        e.preventDefault();
        uiEls.dropOverlay.classList.remove('active');
        if (e.dataTransfer.files.length) logic.handleFiles(e.dataTransfer.files);
    });

    // --- Gestures ---
    uiEls.stage.addEventListener('dblclick', (e) => {
        if (e.target.closest('.controls-wrapper')) return;
        const rect = uiEls.stage.getBoundingClientRect();
        const x = e.clientX - rect.left;
        if (x < rect.width * 0.3) { player.seekStep(-10); logic.triggerAnim('anim-rewind'); }
        else if (x > rect.width * 0.7) { player.seekStep(10); logic.triggerAnim('anim-forward'); }
        else uiEls.fsBtn.click();
    });

    // DOUBLE TAP FIX: Accurate timing and area check
    uiEls.stage.addEventListener('touchstart', (e) => {
        if (e.target.closest('.controls-wrapper') || e.target.closest('#mobile-playlist-toggle') || e.target.closest('#eq-modal')) {
            return;
        }

        const currentTime = Date.now();
        const tapLength = currentTime - lastTapTime;
        
        if (tapLength < 300 && tapLength > 50) { // >50 debounce
            e.preventDefault(); 
            const rect = uiEls.stage.getBoundingClientRect();
            const touchX = e.changedTouches[0].clientX - rect.left;
            if (touchX < rect.width * 0.3) { player.seekStep(-10); logic.triggerAnim('anim-rewind'); }
            else if (touchX > rect.width * 0.7) { player.seekStep(10); logic.triggerAnim('anim-forward'); }
            else { uiEls.fsBtn.click(); }
            lastTapTime = 0;
        } else {
            lastTapTime = currentTime;
        }
    }, { passive: false });

    uiEls.stage.addEventListener('touchmove', () => logic.showUI(), { passive: true });
    uiEls.stage.addEventListener('mousemove', () => logic.showUI());
    
    uiEls.stage.addEventListener('click', (e) => {
        if (!e.target.closest('.controls-wrapper') && !e.target.closest('#mobile-playlist-toggle') && !e.target.closest('#eq-modal') && !e.target.closest('.top-menubar')) {
            player.togglePlay();
        }
    });

    // --- MENU BAR ---
    const bindMenu = (el, action) => { 
        if (el) {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.top-menubar li.is-open').forEach(el => el.classList.remove('is-open'));
                action();
            });
        }
    };

    bindMenu(uiEls.menuOpen, () => uiEls.fileInput.click());
    bindMenu(uiEls.menuOpenFolder, () => uiEls.folderInput.click());
    
    bindMenu(uiEls.menuWatchFolder, async () => {
        if (window.showDirectoryPicker) {
            try {
                const handle = await window.showDirectoryPicker();
                await logic.setWatchedFolder(handle);
            } catch(e) { console.log("Cancelled"); }
        } else {
            ui.showToast("Browser does not support folder watching.");
        }
    });

    bindMenu(uiEls.menuStream, () => document.getElementById('btn-stream').click());
    bindMenu(uiEls.menuImport, () => uiEls.importInput.click());
    bindMenu(uiEls.menuExport, () => logic.exportPlaylist());
    bindMenu(uiEls.menuScreenshot, () => logic.takeScreenshot());

    bindMenu(uiEls.menuPlay, () => player.togglePlay());
    bindMenu(uiEls.menuPrev, () => logic.playPrev());
    bindMenu(uiEls.menuNext, () => logic.playNext());
    bindMenu(uiEls.menuFramePrev, () => logic.stepFrame(-1));
    bindMenu(uiEls.menuFrameNext, () => logic.stepFrame(1));
    
    bindMenu(uiEls.menuLoopA, () => videoMgr.setLoopA());
    bindMenu(uiEls.menuLoopB, () => videoMgr.setLoopB());
    bindMenu(uiEls.menuLoopClear, () => videoMgr.clearLoop());

    bindMenu(uiEls.menuShuffle, () => uiEls.shuffleBtn.click());
    bindMenu(uiEls.menuLoop, () => uiEls.loopBtn.click());

    bindMenu(uiEls.menuMute, () => player.toggleMute());
    bindMenu(uiEls.menuEq, () => logic.toggleEQ());
    
    bindMenu(uiEls.menuVideoFilters, () => uiEls.videoModal.classList.add('visible'));
    bindMenu(uiEls.menuAspectAuto, () => videoMgr.setAspectRatio('auto'));
    bindMenu(uiEls.menuAspect169, () => videoMgr.setAspectRatio('16:9'));
    bindMenu(uiEls.menuAspect43, () => videoMgr.setAspectRatio('4:3'));
    bindMenu(uiEls.menuAspect219, () => videoMgr.setAspectRatio('21:9'));
    bindMenu(uiEls.menuAspect235, () => videoMgr.setAspectRatio('2.35:1'));
    bindMenu(uiEls.menuAspect11, () => videoMgr.setAspectRatio('1:1'));
    bindMenu(uiEls.menuAspectFill, () => videoMgr.setAspectRatio('fill'));

    bindMenu(uiEls.menuFullscreen, () => uiEls.fsBtn.click());
    bindMenu(uiEls.menuPip, () => player.togglePiP());
    bindMenu(uiEls.menuSidebar, () => handlePlaylistToggle());
    
    bindMenu(uiEls.menuSortName, () => pm.sortPlaylist('name'));
    bindMenu(uiEls.menuSortDate, () => pm.sortPlaylist('date'));
    bindMenu(uiEls.menuSortSize, () => pm.sortPlaylist('size'));

    bindMenu(uiEls.menuSubs, () => uiEls.subBtn.click());
    bindMenu(uiEls.menuSubSettings, () => uiEls.captionModal.classList.add('visible'));
    bindMenu(uiEls.menuAbout, () => uiEls.readmeModal.classList.add('visible'));

    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        const action = keys.getAction(e.code);
        if (action) {
            e.preventDefault();
            switch (action) {
                case 'togglePlay': player.togglePlay(); break;
                case 'seekFwd': player.seekStep(5); break;
                case 'seekBack': player.seekStep(-5); break;
                case 'volUp': player.setVolume(Math.min(1, uiEls.video.volume + 0.1)); break;
                case 'volDown': player.setVolume(Math.max(0, uiEls.video.volume - 0.1)); break;
                case 'toggleMute': player.toggleMute(); break;
                case 'toggleFullscreen': uiEls.fsBtn.click(); break;
                case 'nextTrack': logic.playNext(); break;
                case 'prevTrack': logic.playPrev(); break;
                case 'frameBack': logic.stepFrame(-1); break;
                case 'frameFwd': logic.stepFrame(1); break;
                case 'loopA': videoMgr.setLoopA(); break;
                case 'loopB': videoMgr.setLoopB(); break;
                case 'loopClear': videoMgr.clearLoop(); break;
                case 'closeModal': 
                    if (logic.isEqOpen()) { logic.closeEQ(); }
                    uiEls.readmeModal.classList.remove('visible'); 
                    uiEls.captionModal.classList.remove('visible'); 
                    uiEls.videoModal.classList.remove('visible'); 
                    uiEls.keybindModal.classList.remove('visible'); 
                    uiEls.changelogModal.classList.remove('visible'); 
                    break;
            }
        }
    });
}