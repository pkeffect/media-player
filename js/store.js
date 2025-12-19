/* VERSION: 1.1.0 */
/* js/store.js */
/**
 * Centralized State Management (Pub/Sub)
 */

export const Events = {
    PLAYLIST_UPDATED: 'playlist:updated',
    PLAYBACK_STATE: 'playback:state', // playing, paused
    PLAYBACK_TIME: 'playback:time',
    PLAYBACK_PROGRESS: 'playback:progress',
    TRACK_CHANGED: 'track:changed',
    VOLUME_CHANGED: 'volume:changed',
    SETTINGS_CHANGED: 'settings:changed',
    ERROR: 'app:error',
    TOAST: 'ui:toast'
};

class Store {
    constructor() {
        this.events = {};
    }

    /**
     * Subscribe to an event
     * @param {string} event 
     * @param {Function} callback 
     * @returns {Function} Unsubscribe function
     */
    on(event, callback) {
        if (!this.events[event]) this.events[event] = [];
        this.events[event].push(callback);
        return () => this.off(event, callback);
    }

    /**
     * Unsubscribe
     * @param {string} event 
     * @param {Function} callback 
     */
    off(event, callback) {
        if (!this.events[event]) return;
        this.events[event] = this.events[event].filter(cb => cb !== callback);
    }

    /**
     * Dispatch an event with data
     * @param {string} event 
     * @param {any} data 
     */
    emit(event, data) {
        if (this.events[event]) {
            this.events[event].forEach(cb => cb(data));
        }
    }
}

export const appStore = new Store();