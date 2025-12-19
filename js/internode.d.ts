// VERSION: 2.0.0
// js/internode.d.ts
/**
 * Type definitions for Internode Media Player
 */

export interface TrackMetadata {
    title?: string;
    artist?: string;
    album?: string;
    picture?: any;
}

export interface PlaylistItem {
    id: number;
    file: File | { name: string; size: number };
    isStream: boolean;
    url?: string;
    thumb?: string;
    hasError: boolean;
    metadata: TrackMetadata;
}

// --- STORE ---
export interface AppState {
    playlist: PlaylistItem[];
    currentIndex: number;
    isPlaying: boolean;
    volume: number;
    shuffle: boolean;
    loopMode: number;
    settings: Record<string, any>;
}

export class Store {
    on(event: string, callback: Function): Function;
    off(event: string, callback: Function): void;
    emit(event: string, data: any): void;
    setState(partialState: Partial<AppState>): void;
    getState(): AppState;
}
export const appStore: Store;
export const Events: Record<string, string>;

// --- MANAGERS ---

export class PlaylistManager {
    constructor();
    playlist: PlaylistItem[];
    currentIndex: number;
    addItems(files: FileList | File[]): number;
    addStream(url: string): number;
    removeItem(index: number): void;
    reorder(from: number, to: number): void;
    sortPlaylist(type: 'name' | 'size' | 'date'): void;
    saveSettings(updates: any): void;
}

export class UIManager {
    constructor(elements: any);
    renderPlaylist(playlist: PlaylistItem[], currentIndex: number, callbacks: any): void;
    showToast(msg: string, highPriority?: boolean): void;
    toggleControls(show: boolean, forceKeepOpen?: boolean): void;
}

export class ThumbnailGenerator {
    addToQueue(file: File, callback: (url: string) => void): void;
    cancelQueue(): void;
}

export class MediaPlayer {
    constructor(
        videoElement: HTMLVideoElement, 
        updateUICallback: (type: string, data: any) => void, 
        callbacks: any
    );
    loadFile(source: File | string, metadata?: any): Promise<void>;
}