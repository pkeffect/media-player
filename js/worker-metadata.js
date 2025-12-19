/* VERSION: 1.0.0 */
/* js/worker-metadata.js */
/**
 * Web Worker for parsing media metadata off the main thread.
 * Imports jsmediatags from the root context.
 */

// Import library (path relative to the worker file location in js/)
importScripts('jsmediatags.min.js');

self.addEventListener('message', (e) => {
    const { id, file, type } = e.data;

    if (type === 'parse') {
        if (!self.jsmediatags) {
            self.postMessage({ id, error: 'Library not loaded' });
            return;
        }

        self.jsmediatags.read(file, {
            onSuccess: (tag) => {
                const tags = tag.tags;
                
                // Extract minimal data to send back (structured clone friendly)
                const metadata = {
                    title: tags.title || '',
                    artist: tags.artist || '',
                    album: tags.album || ''
                };

                // NOTE: We do NOT extract the picture (base64) here as passing 
                // huge strings from Worker to Main thread can still be slow.
                // We stick to text metadata for performance.

                self.postMessage({ id, metadata });
            },
            onError: (error) => {
                self.postMessage({ id, error: error.type });
            }
        });
    }
});