/* VERSION: 3.1.0 */
/* js/playlist-manager.js */
import { appStore, Events } from './store.js';

export class PlaylistManager {
    constructor() {
        this.playlist = [];
        this.currentIndex = -1;
        this.shuffleMode = false;
        this.loopMode = 0; 
        
        // Metadata Worker
        this.metaWorker = new Worker('js/worker-metadata.js');
        this.metaWorker.onmessage = this.handleWorkerMessage.bind(this);
        this.metaQueue = [];
        this.activeParseCount = 0;
        this.MAX_CONCURRENT_PARSE = 4;
        this.MAX_QUEUE_SIZE = 1000; // Limit queue to prevent OOM

        // Debounce save operations
        this.saveTimeout = null;
        this.SAVE_DEBOUNCE_MS = 300;
        
        // Settings defaults
        this.defaultSettings = {
            volume: 1, 
            speed: 1, 
            shuffle: false, 
            loop: 0,
            subtitlesVisible: true,
            subFontSize: 1.5,
            subColor: '#ffffff',
            subBgOpacity: 0.6
        };

        try {
            const saved = localStorage.getItem('internodePlayerSettings');
            this.settings = saved ? { ...this.defaultSettings, ...JSON.parse(saved) } : this.defaultSettings;
        } catch (e) {
            console.warn("Settings Load Error", e);
            this.settings = this.defaultSettings;
        }
        
        this.shuffleMode = this.settings.shuffle;
        this.loopMode = this.settings.loop;

        // DB Config
        this.dbName = 'InternodeDB';
        this.storeName = 'playlistStore';
        this.db = null;

        // Init
        this.initDB().then(() => this.restorePlaylist());
    }

    // --- Worker Logic ---
    handleWorkerMessage(e) {
        const { id, metadata, error } = e.data;
        this.activeParseCount--;

        if (!error && metadata) {
            const item = this.playlist.find(p => p.id === id);
            if (item) {
                // Merge new metadata
                item.metadata = { ...item.metadata, ...metadata };
                appStore.emit(Events.PLAYLIST_UPDATED, this.playlist);
                this.savePlaylist();
            }
        }
        this.processMetaQueue();
    }

    addToMetaQueue(item) {
        if (item.isStream) return;
        // Bounded Queue
        if (this.metaQueue.length > this.MAX_QUEUE_SIZE) return;
        this.metaQueue.push(item);
        this.processMetaQueue();
    }

    processMetaQueue() {
        if (this.activeParseCount >= this.MAX_CONCURRENT_PARSE || this.metaQueue.length === 0) return;
        
        const item = this.metaQueue.shift();
        this.activeParseCount++;
        
        this.metaWorker.postMessage({
            type: 'parse',
            id: item.id,
            file: item.file
        });

        // Try to fill other slots
        this.processMetaQueue();
    }

    // --- IndexedDB Logic ---
    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 2);
            request.onerror = (e) => {
                console.error("DB Error", e);
                appStore.emit(Events.ERROR, "Database access failed. Playlist won't be saved.");
                reject(e);
            };
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('meta')) {
                    db.createObjectStore('meta', { keyPath: 'key' });
                }
            };
            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve();
            };
        });
    }

    savePlaylist() {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            this._savePlaylistImmediate();
        }, this.SAVE_DEBOUNCE_MS);
    }

    async _savePlaylistImmediate() {
        if (!this.db) return;
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([this.storeName, 'meta'], 'readwrite');
            const store = tx.objectStore(this.storeName);
            const meta = tx.objectStore('meta');

            store.clear();

            this.playlist.forEach(item => {
                const record = {
                    id: item.id,
                    isStream: item.isStream,
                    url: item.url || null,
                    thumb: item.thumb,
                    file: item.isStream ? null : item.file,
                    name: item.file.name,
                    size: item.file.size,
                    metadata: item.metadata || null
                };
                try { store.put(record); } catch (e) { console.error(e); }
            });

            const order = this.playlist.map(p => p.id);
            meta.put({ key: 'order', value: order });
            meta.put({ key: 'currentIndex', value: this.currentIndex });

            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    async restorePlaylist() {
        if (!this.db) return;
        return new Promise((resolve, reject) => {
            try {
                const tx = this.db.transaction([this.storeName, 'meta'], 'readonly');
                const store = tx.objectStore(this.storeName);
                const meta = tx.objectStore('meta');

                let order = [];
                let savedIndex = -1;
                let tracks = [];

                meta.get('order').onsuccess = (e) => { order = e.target.result ? e.target.result.value : []; };
                meta.get('currentIndex').onsuccess = (e) => { savedIndex = e.target.result ? e.target.result.value : -1; };
                store.getAll().onsuccess = (e) => { tracks = e.target.result || []; };

                tx.oncomplete = () => {
                    if (tracks.length > 0) {
                        const trackMap = new Map(tracks.map(t => [t.id, t]));
                        this.playlist = order.map(id => {
                            const t = trackMap.get(id);
                            if (!t) return null;
                            return {
                                id: t.id,
                                isStream: t.isStream,
                                url: t.url,
                                thumb: t.thumb,
                                hasError: false,
                                file: t.isStream ? { name: t.name, size: 0 } : t.file,
                                metadata: t.metadata || {}
                            };
                        }).filter(t => t !== null);

                        this.currentIndex = savedIndex;
                        if (this.currentIndex >= this.playlist.length) this.currentIndex = -1;
                        
                        appStore.emit(Events.PLAYLIST_UPDATED, this.playlist);
                        
                        this.playlist.forEach(item => {
                            if (!item.isStream && (!item.metadata || !item.metadata.title)) {
                                this.addToMetaQueue(item);
                            }
                        });
                    }
                    if (window.onPlaylistLoaded) window.onPlaylistLoaded(); 
                    resolve();
                };
                tx.onerror = (e) => reject(e.target.error);
            } catch (e) { reject(e); }
        });
    }

    async saveDirectoryHandle(handle) {
        if (!this.db) return;
        const tx = this.db.transaction(['meta'], 'readwrite');
        tx.objectStore('meta').put({ key: 'watchedFolder', value: handle });
        return new Promise(resolve => { tx.oncomplete = resolve; });
    }

    async loadDirectoryHandle() {
        if (!this.db) return null;
        return new Promise(resolve => {
            const tx = this.db.transaction(['meta'], 'readonly');
            const req = tx.objectStore('meta').get('watchedFolder');
            req.onsuccess = (e) => resolve(e.target.result ? e.target.result.value : null);
            req.onerror = () => resolve(null);
        });
    }

    sortPlaylist(type) {
        if (this.playlist.length === 0) return;
        const currentItem = this.playlist[this.currentIndex];
        this.playlist.sort((a, b) => {
            switch (type) {
                case 'name': return a.file.name.localeCompare(b.file.name);
                case 'size': return (b.file.size || 0) - (a.file.size || 0);
                case 'date': return a.id - b.id;
                default: return 0;
            }
        });
        if (currentItem) this.currentIndex = this.playlist.indexOf(currentItem);
        appStore.emit(Events.PLAYLIST_UPDATED, this.playlist);
        this.savePlaylist();
    }

    get length() { return this.playlist.length; }
    get currentItem() { return this.playlist[this.currentIndex] || null; }
    getSettings() { return this.settings; }

    saveSettings(updates = {}) {
        this.settings = { ...this.settings, ...updates };
        try { localStorage.setItem('internodePlayerSettings', JSON.stringify(this.settings)); } catch (e) {}
        appStore.emit(Events.SETTINGS_CHANGED, this.settings);
    }

    addItems(files) {
        let added = 0;
        Array.from(files).forEach(file => {
            const id = Date.now() + Math.random();
            const item = { 
                file, hasError: false, id, thumb: null, isStream: false, metadata: {} 
            };
            this.playlist.push(item);
            this.addToMetaQueue(item); 
            added++;
        });
        if (added > 0) {
            appStore.emit(Events.PLAYLIST_UPDATED, this.playlist);
            this.savePlaylist();
        }
        return added;
    }

    addStream(url) {
        const item = { 
            file: { name: url, size: 0 }, isStream: true, url: url, id: Date.now(), metadata: {}
        };
        this.playlist.push(item);
        appStore.emit(Events.PLAYLIST_UPDATED, this.playlist);
        this.savePlaylist();
        return this.playlist.length - 1; 
    }

    setThumb(id, url) {
        const item = this.playlist.find(p => p.id === id);
        if (item) {
            item.thumb = url;
            this.savePlaylist(); 
        }
    }

    removeItem(index) {
        this.playlist.splice(index, 1);
        if (index === this.currentIndex) this.currentIndex = -1;
        else if (index < this.currentIndex) this.currentIndex--;
        appStore.emit(Events.PLAYLIST_UPDATED, this.playlist);
        this.savePlaylist();
    }

    reorder(from, to) {
        if (from === to) return;
        const item = this.playlist[from];
        this.playlist.splice(from, 1);
        this.playlist.splice(to, 0, item);
        if (this.currentIndex === from) this.currentIndex = to;
        else if (this.currentIndex > from && this.currentIndex <= to) this.currentIndex--;
        else if (this.currentIndex < from && this.currentIndex >= to) this.currentIndex++;
        appStore.emit(Events.PLAYLIST_UPDATED, this.playlist);
        this.savePlaylist();
    }

    setCurrentIndex(idx) {
        this.currentIndex = idx;
        appStore.emit(Events.TRACK_CHANGED, idx);
        this.savePlaylist(); 
    }

    markError(index) {
        if (this.playlist[index]) {
            this.playlist[index].hasError = true;
            appStore.emit(Events.PLAYLIST_UPDATED, this.playlist);
        }
    }

    getNextIndex() {
        if (this.playlist.length === 0) return -1;
        if (this.shuffleMode) {
            let next;
            do { next = Math.floor(Math.random() * this.playlist.length); } 
            while (next === this.currentIndex && this.playlist.length > 1);
            return next;
        } else {
            let next = this.currentIndex + 1;
            if (next >= this.playlist.length) return this.loopMode === 1 ? 0 : -1;
            return next;
        }
    }

    getPrevIndex() {
        if (this.playlist.length === 0) return -1;
        if (this.currentIndex > 0) return this.currentIndex - 1;
        else if (this.loopMode === 1) return this.playlist.length - 1;
        return -1;
    }

    toggleShuffle() {
        this.shuffleMode = !this.shuffleMode;
        this.saveSettings({ shuffle: this.shuffleMode });
        return this.shuffleMode;
    }

    cycleLoopMode() {
        this.loopMode = (this.loopMode + 1) % 3;
        this.saveSettings({ loop: this.loopMode });
        return this.loopMode;
    }
}