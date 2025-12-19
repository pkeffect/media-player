// VERSION: 1.6.0
/**
 * Handles FFmpeg WASM logic to transcode unsupported files to MP4
 */
import { Logger } from './logger.js';

export class MediaConverter {
    constructor(onProgress) {
        this.ffmpeg = null;
        this.onProgress = onProgress || (() => {});
        this.isLoaded = false;
    }

    async load() {
        if (this.isLoaded) return;

        // Check for Security Headers Requirements
        if (typeof SharedArrayBuffer === 'undefined') {
            const msg = "SharedArrayBuffer is missing";
            Logger.warn(msg); // Log technical warning
            // Throw user-friendly version
            throw new Error(Logger.getUserMessage(msg));
        }
        
        const { createFFmpeg } = FFmpeg;
        
        // corePath is usually auto-handled, but we ensure we are grabbing a compatible version
        this.ffmpeg = createFFmpeg({ 
            log: false,
            logger: ({ message }) => Logger.info(`FFmpeg: ${message}`)
        });

        this.ffmpeg.setProgress(({ ratio }) => {
            this.onProgress(Math.floor(ratio * 100));
        });

        await this.ffmpeg.load();
        this.isLoaded = true;
    }

    async convert(file) {
        if (!this.isLoaded) await this.load();

        const fileName = file.name;
        const outputName = 'output.mp4';

        this.ffmpeg.FS('writeFile', fileName, await fetchFile(file));

        // Using ultrafast preset for speed
        try {
            await this.ffmpeg.run(
                '-i', fileName, 
                '-c:v', 'libx264', 
                '-preset', 'ultrafast',
                '-crf', '22', // Balanced quality/speed
                '-c:a', 'aac', 
                outputName
            );
    
            const data = this.ffmpeg.FS('readFile', outputName);
    
            // Cleanup
            this.ffmpeg.FS('unlink', fileName);
            this.ffmpeg.FS('unlink', outputName);
    
            return new Blob([data.buffer], { type: 'video/mp4' });
        } catch (e) {
            Logger.error(e);
            throw new Error("Transcoding failed. File may be corrupt or too large for browser memory.");
        }
    }
}

async function fetchFile(file) {
    return new Uint8Array(await file.arrayBuffer());
}