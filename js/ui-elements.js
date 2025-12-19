/* VERSION: 2.1.0 */
/* js/ui-elements.js */
/**
 * Centralized DOM Element References
 */
export const getUiElements = () => ({
    video: document.getElementById('main-video'),
    stage: document.getElementById('player-stage'),
    controlsWrapper: document.querySelector('.controls-wrapper'), // Ensure this class exists in HTML
    playlistEl: document.getElementById('playlist-items'),
    playlistSidebar: document.getElementById('playlist-sidebar'),
    sidebarResizer: document.getElementById('sidebar-resizer'),
    toast: document.getElementById('notification-toast'),
    contextMenu: document.getElementById('context-menu'),
    eqModal: document.getElementById('eq-modal'),
    dropOverlay: document.getElementById('drop-overlay'),
    fileInput: document.getElementById('file-input'),
    folderInput: document.getElementById('folder-input'),
    importInput: document.getElementById('import-input'),
    volSlider: document.getElementById('volume-slider'),
    speedSelect: document.getElementById('playback-rate'),
    searchInput: document.getElementById('playlist-search'),
    playBtn: document.getElementById('btn-play'),
    iconPlay: document.querySelector('#btn-play .icon-play'),
    iconPause: document.querySelector('#btn-play .icon-pause'),
    centerIcon: document.getElementById('center-icon'),
    muteBtn: document.getElementById('btn-mute'),
    pipBtn: document.getElementById('btn-pip'),
    fsBtn: document.getElementById('btn-fullscreen'),
    eqBtn: document.getElementById('btn-eq'),
    closeEqBtn: document.getElementById('btn-close-eq'),
    subBtn: document.getElementById('btn-subs'),
    shuffleBtn: document.getElementById('btn-shuffle'),
    loopBtn: document.getElementById('btn-loop'),
    loopBadge: document.getElementById('loop-indicator'),
    togglePlaylistBtn: document.getElementById('btn-toggle-playlist'),
    mobilePlaylistToggle: document.getElementById('mobile-playlist-toggle'),
    openBtn: document.getElementById('btn-open'),
    openFolderBtn: document.getElementById('btn-open-folder'),
    exportBtn: document.getElementById('btn-export'),
    importBtn: document.getElementById('btn-import'),
    readmeBtn: document.getElementById('btn-readme'),
    closeReadmeBtn: document.getElementById('btn-close-readme'),
    readmeModal: document.getElementById('readme-modal'),
    prevBtn: document.getElementById('btn-prev'),
    nextBtn: document.getElementById('btn-next'),
    
    // Keybind Modal
    keybindModal: document.getElementById('keybind-modal'),
    keybindList: document.getElementById('keybind-list'),
    btnKeybindClose: document.getElementById('btn-keybind-close'),
    btnKeybindReset: document.getElementById('btn-keybind-defaults'),

    // Changelog Modal
    changelogModal: document.getElementById('changelog-modal'),
    btnCloseChangelog: document.getElementById('btn-close-changelog'),

    // Context Menu Items
    ctxMoveUpBtn: document.getElementById('ctx-move-up'),
    ctxMoveDownBtn: document.getElementById('ctx-move-down'),
    ctxOpenFolderBtn: document.getElementById('ctx-open-folder'),
    ctxRemoveBtn: document.getElementById('ctx-remove'),
    
    seekContainer: document.getElementById('seek-container'),
    seekFill: document.getElementById('seek-fill'),
    seekThumb: document.getElementById('seek-thumb'),
    timeDisplay: document.getElementById('time-display'),
    screenshotBtn: document.getElementById('btn-screenshot'),
    
    // Frame Advance
    framePrevBtn: document.getElementById('btn-frame-prev'),
    frameNextBtn: document.getElementById('btn-frame-next'),
    
    // Caption Settings
    captionModal: document.getElementById('caption-modal'),
    btnCaptionClose: document.getElementById('btn-caption-close'),
    subOverlay: document.getElementById('subtitle-overlay'),
    inpCapSize: document.getElementById('cap-size'),
    inpCapColor: document.getElementById('cap-color'),
    inpCapBg: document.getElementById('cap-bg'),

    // Video Adjustment Modal
    videoModal: document.getElementById('video-modal'),
    btnVideoClose: document.getElementById('btn-video-close'),
    btnVideoReset: document.getElementById('btn-video-reset'),
    inpVidBright: document.getElementById('vid-bright'),
    inpVidContrast: document.getElementById('vid-contrast'),
    inpVidSat: document.getElementById('vid-sat'),
    inpVidHue: document.getElementById('vid-hue'),
    valVidBright: document.getElementById('val-bright'),
    valVidContrast: document.getElementById('val-contrast'),
    valVidSat: document.getElementById('val-sat'),
    valVidHue: document.getElementById('val-hue'),

    // Menu Bar Items
    menubar: document.querySelector('.top-menubar'), 
    menuOpen: document.getElementById('menu-open'),
    menuOpenFolder: document.getElementById('menu-open-folder'),
    menuWatchFolder: document.getElementById('menu-watch-folder'),
    menuStream: document.getElementById('menu-stream'),
    menuImport: document.getElementById('menu-import'),
    menuExport: document.getElementById('menu-export'),
    menuScreenshot: document.getElementById('menu-screenshot'),
    menuPlay: document.getElementById('menu-play'),
    menuPrev: document.getElementById('menu-prev'),
    menuNext: document.getElementById('menu-next'),
    menuFramePrev: document.getElementById('menu-frame-prev'),
    menuFrameNext: document.getElementById('menu-frame-next'),
    
    // A-B Loop Menu
    menuLoopA: document.getElementById('menu-loop-a'),
    menuLoopB: document.getElementById('menu-loop-b'),
    menuLoopClear: document.getElementById('menu-loop-clear'),

    menuShuffle: document.getElementById('menu-shuffle'),
    menuLoop: document.getElementById('menu-loop'),
    menuMute: document.getElementById('menu-mute'),
    menuEq: document.getElementById('menu-eq'),
    
    // Video Menu
    menuVideoFilters: document.getElementById('menu-video-filters'),
    menuAspectAuto: document.getElementById('menu-aspect-auto'),
    menuAspect169: document.getElementById('menu-aspect-169'),
    menuAspect43: document.getElementById('menu-aspect-43'),
    menuAspect219: document.getElementById('menu-aspect-219'),
    menuAspect235: document.getElementById('menu-aspect-235'),
    menuAspect11: document.getElementById('menu-aspect-11'),
    menuAspectFill: document.getElementById('menu-aspect-fill'),

    menuFullscreen: document.getElementById('menu-fullscreen'),
    menuPip: document.getElementById('menu-pip'),
    menuSidebar: document.getElementById('menu-sidebar'),
    menuSortName: document.getElementById('menu-sort-name'),
    menuSortDate: document.getElementById('menu-sort-date'),
    menuSortSize: document.getElementById('menu-sort-size'),
    menuSubs: document.getElementById('menu-subs'),
    menuSubSettings: document.getElementById('menu-sub-settings'),
    menuAbout: document.getElementById('menu-about'),
    menuChangelog: document.getElementById('menu-changelog'),
    menuKeybinds: document.getElementById('menu-keybinds'),

    // Animations
    animRewind: document.getElementById('anim-rewind'),
    animForward: document.getElementById('anim-forward')
});