# Internode Media Player

![open Chess](./images/image-2025-12-18-192810.png)

**Internode** is a professional-grade, browser-based media workstation designed for high-fidelity audio playback, precision video analysis, and persistent library management. Built entirely on modern Web Standards, it leverages WASM for advanced subtitle rendering and the Web Audio API for mastering-grade equalization.

![Version](https://img.shields.io/badge/version-9.2.0-red)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## ◈ Core Features

### 1. Professional Audio Engineering
*   **12-Band Stereo Parametric EQ:** Precision frequency shaping from 25Hz to 16kHz.
*   **Stereo Width Control:** Mid/Side matrix processing allows for adjusting the stereo field from mono collapse to enhanced spread.
*   **Pre-Amp Gain:** Independent Left/Right input gain controls (±12dB).
*   **Safety Limiter:** Integrated brickwall limiter to prevent digital clipping and protect hardware.
*   **Visual Metering:** Real-time stereo VU meters for monitoring signal levels.
*   **Mastering Presets:** 12 calibrated curves including Rock, Techno, Vocal, and Full Bass.

### 2. Video Analysis & Analysis Tools
*   **A-B Looping:** Mark specific start and end points on the timeline to loop segments indefinitely—perfect for study or analysis.
*   **Non-Destructive Filters:** Real-time adjustments for Brightness, Contrast, Saturation, and Hue.
*   **Aspect Ratio Override:** Correct distorted metadata by forcing 16:9, 4:3, 21:9, 2.35:1, or 1:1 ratios.
*   **Frame-by-Frame Navigation:** Step forward or backward by single frames for precise visual inspection.
*   **Screenshot Capture:** Save the current video frame as a high-quality PNG file.

### 3. Advanced Subtitle Engine
*   **Octopus (libass) Integration:** Full support for `.ASS` and `.SSA` anime-style subtitles with complex styling, positioning, and animations via WebAssembly.
*   **Native SRT/VTT:** Support for standard text-based subtitles.
*   **Custom Styling:** User-adjustable font size, text color, and background opacity.
*   **Persistence:** Subtitle preferences and visibility are saved across sessions.

### 4. High-Performance Library
*   **PWA Architecture:** Service worker integration allows the player to work offline and install as a standalone desktop/mobile app.
*   **Virtual Scrolling:** A custom DOM-diffing playlist engine that handles thousands of items smoothly without UI lag.
*   **Watched Folders:** Uses the File System Access API to automatically scan and load local directories on startup.
*   **IndexedDB Storage:** The playlist, metadata, and playback positions are stored in the browser's local database.
*   **Background Thumbnails:** Multi-threaded thumbnail generation for video files using Web Workers.

---

## ◈ Keyboard Shortcuts

Internode is built for power users. All shortcuts can be remapped in the **Keyboard Shortcuts** menu.

| Action | Default Key |
| :--- | :--- |
| **Play / Pause** | `Space` |
| **Next Track** | `J` |
| **Previous Track** | `K` |
| **Seek Forward/Back** | `→` / `←` (5s) |
| **Volume Up/Down** | `↑` / `↓` |
| **Frame Step Fwd/Back** | `.` / `,` |
| **Set Loop Start (A)** | `[` |
| **Set Loop End (B)** | `]` |
| **Clear Loop** | `\` |
| **Toggle Fullscreen** | `F` |
| **Toggle Mute** | `M` |
| **Close Modals** | `Esc` |

---

## ◈ Technical Stack

*   **Logic:** Modular ES6 JavaScript.
*   **Video Engine:** Native HTML5 Video + `hls.js` for adaptive bitrate streaming.
*   **Audio Engine:** Web Audio API (BiquadFilterNodes, DynamicsCompressor, AnalyserNode).
*   **Subtitles:** `SubtitlesOctopus` (libass via WASM).
*   **Metadata:** `jsmediatags` for ID3/MP4/FLAC tag extraction.
*   **Persistence:** IndexedDB (for playlist) and LocalStorage (for settings).
*   **PWA:** Service Worker (v29) with stale-while-revalidate strategy.

---

## ◈ Installation & Usage

### Web Usage
1.  Navigate to the hosted URL.
2.  **Drag and Drop** any media file or folder directly into the browser window.
3.  Click the **Install** icon in the browser address bar to use Internode as a standalone desktop application.

### Local Development
1.  Clone the repository.
2.  Internode uses ES6 Modules and Service Workers, which require a secure context (HTTPS) or `localhost`.
3.  Serve the project folder using a local server:
    ```bash
    # If you have Python installed:
    python -m http.server 8000
    ```
4.  Open `http://localhost:8000` in your browser.

---

## ◈ Advanced Configuration

### HLS Streaming
Internode supports `.m3u8` playlists. Click the **Globe Icon** (Open Stream) and paste your URL. The player will automatically utilize `hls.js` for non-Safari browsers to provide adaptive bitrate switching.

### Watched Folders (Chrome/Edge/Opera)
Go to `File > Set Watched Folder`. Select your local music or video directory. Internode will store a permission handle; next time you open the app, simply click the "Restore Library" toast to reload your files instantly.

### Video Analysis Mode
To analyze a specific sequence:
1.  Play the video at the desired speed (0.25x to 4.0x).
2.  Press `[` at the start of a sequence and `]` at the end.
3.  The player will loop this segment. Use `,` and `.` to inspect individual frames.
4.  Apply Brightness/Contrast filters in the **Video Adjustments** menu to highlight details in dark footage.

---

## ◈ Browser Support
*   **Chrome/Edge:** Full support (including Watched Folders).
*   **Firefox:** Full support (excluding Watched Folders).
*   **Safari/iOS:** Supported (Native HLS, native fullscreen). Note: iOS volume is controlled via hardware buttons only.

---

## 📝 License

This project is open-source. Feel free to modify and distribute.
