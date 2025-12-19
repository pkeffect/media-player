/* VERSION: 1.1.0 */
/* js/logger.js */
/**
 * Centralized Logging and Error Handling
 */

const LOG_PREFIX = '[Internode]';

// Map technical DOMExceptions or MediaErrors to user-friendly strings
const ERROR_MAP = {
    // HTML5 Media Errors
    1: "Playback aborted by user.",
    2: "Network error caused download to fail.",
    3: "Media decoding failed. The file might be corrupt.",
    4: "Format not supported or source unavailable.",
    // Custom / Technical
    "SharedArrayBuffer is missing": "Browser security restriction: High-performance memory is disabled. This feature requires specific server headers (COOP/COEP).",
    "QuotaExceededError": "Storage is full. Unable to save settings or playlist.",
    "AbortError": "The operation was cancelled.",
    "NotAllowedError": "Permission denied by browser policy."
};

export const Logger = {
    /**
     * Standard Info Log
     * @param {string} msg 
     * @param {string} [style] - Optional CSS style string
     */
    info: (msg, style = null) => {
        if (style) {
            console.log(`%c${LOG_PREFIX} ${msg}`, style);
        } else {
            console.log(`${LOG_PREFIX} ${msg}`);
        }
    },

    /**
     * Warning Log
     * Uses Unicode Escape for Warning Sign (⚠️)
     * @param {string} msg 
     */
    warn: (msg) => {
        console.warn(`${LOG_PREFIX} \u26A0\uFE0F ${msg}`);
    },

    /**
     * Error Log
     * Uses Unicode Escape for Cross Mark (❌)
     * @param {string|Error} err 
     * @returns {string} The user-friendly message
     */
    error: (err) => {
        const rawMsg = err instanceof Error ? err.message : err;
        console.error(`${LOG_PREFIX} \u274C`, err);
        return rawMsg;
    },

    /**
     * Converts technical error objects/strings to user-friendly text
     * @param {any} error - The error object, code, or string
     * @returns {string} User friendly string
     */
    getUserMessage: (error) => {
        // Handle MediaError objects (e.g. video.error)
        if (error && error.code && ERROR_MAP[error.code]) {
            return ERROR_MAP[error.code];
        }
        
        // Handle Error Objects
        const msg = error instanceof Error ? error.message : error;
        
        // Check for specific substrings in the message
        for (const key in ERROR_MAP) {
            if (typeof msg === 'string' && msg.includes(key)) {
                return ERROR_MAP[key];
            }
        }

        return msg || "An unknown error occurred.";
    }
};