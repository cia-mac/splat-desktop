# Pointfield

> Pointfield redraws moving images as interactive fields of glowing points.

A real-time renderer for macOS and Windows. Drop a video in. Each region of every frame becomes a small cluster of glowing points.

## Try it in your browser

No download required: [ciamac.com/pointfield](https://ciamac.com/pointfield)

## Download

Get the latest build from the [Releases page](https://github.com/cia-mac/splat-desktop/releases/latest).

- **macOS (Apple Silicon):** `Pointfield_0.1.1_aarch64.dmg`
- **Windows (x64):** `Pointfield_0.1.1_x64-setup.exe` or `Pointfield_0.1.1_x64_en-US.msi`

### Gatekeeper (macOS)

The Mac build is unsigned. After dragging the app to `/Applications`, run in Terminal:

```
xattr -cr /Applications/Pointfield.app
```

## What it is

Pointfield takes a video and replaces every region of every frame with a small cluster of glowing points. Each cluster shares the color of its source region. Members spread within a bounded radius, vary in size, and drift on a low-frequency turbulence field. You can push them around with the mouse.

It is a renderer, not a filter. Not AI. Not a Gaussian splat tool. Not a physics simulation.

## Usage

1. Launch the app, or open [ciamac.com/pointfield](https://ciamac.com/pointfield) in a browser.
2. Drop a video file onto the window, or click to choose one. Formats: MP4, WebM, MOV.
3. The video plays as a live field of glowing points.
4. Mouse: no button to swirl, left click to push, right click to attract.
5. Keyboard: spacebar to pause, **R** to record, **Esc** to toggle the controls panel.

## System requirements

- macOS on Apple Silicon, macOS 10.15 or later.
- Windows 10 or later, x64.
- An internet connection on first launch (the WebGL renderer is fetched from a CDN; to be fixed in a later release).
- Approximately 30 MB download.

## Known limitations (v0.1)

- **Mac builds are unsigned.** See Gatekeeper note above.
- **Internet required on first launch.** The Three.js library is loaded from a public CDN (`cdn.jsdelivr.net`). Offline first-launch will not render.
- **Intel Macs not supported.** Apple Silicon only.
- **Recording quality** depends on system performance and the chosen output format.

## History

Formerly shipped as `ciafx` (v1.x as Splat, v2.x as ciafx) and as PixelCluster (v0.1.0/v0.1.1), so old links and tags still point to the same repository. The engine is unchanged. Historical releases remain in the release history.

## Build from source

Requirements:

- Rust stable toolchain
- Tauri CLI v2 (`cargo install tauri-cli --version "^2"`)

Commands:

```
cargo tauri dev      # development with hot reload
cargo tauri build    # production binary
```

The build matrix is macOS on Apple Silicon and Windows x64.

## Architecture

Tauri v2 Rust shell wraps a WebKit/Chromium webview. The frontend is vanilla JavaScript with Three.js (WebGL2) doing the rendering. Cluster construction expands each sample cell into a group of glowing points with shared UV and per-member offset and size jitter. Turbulence runs entirely on the GPU; only mouse offsets touch the CPU.

## License

MIT.

## Author

Built by Ciamac Parhizi. [ciamac.com](https://ciamac.com)
