# PixelCluster

> Video becomes PixelCluster.

A real-time video-to-particle renderer for macOS and Windows. Drop a video in. Each region of the frame becomes a small cluster of glowing points.

## What it is

PixelCluster takes a video and replaces every region of every frame with a small cluster of light-emitting particles. Each cluster shares the color of its source region. Members spread within a bounded radius, vary in size, and drift on a low-frequency turbulence field. You can push them around with the mouse.

It is a renderer, not a filter. It is not AI. It is not a Gaussian splat tool.

## Download

Get the latest build from the [Releases page](https://github.com/cia-mac/splat-desktop/releases/latest).

- **macOS (Apple Silicon):** `PixelCluster_0.1.0_aarch64.dmg`
- **Windows (x64):** `PixelCluster_0.1.0_x64-setup.exe` or `PixelCluster_0.1.0_x64_en-US.msi`

## How it works

PixelCluster samples each region of a video frame and replaces it with a small group of glowing points that share the region's color. The points jitter in size, drift on a turbulence field, and respond to mouse input in real time.

## Usage

1. Launch the app.
2. Drop a video file onto the window, or click to choose one. Formats: MP4, WebM, MOV.
3. The video starts playing as a particle cluster field.
4. Mouse: no button to swirl, left click to push, right click to attract.
5. Keyboard: spacebar to pause, **R** to record, **Esc** to toggle the controls panel.

## System requirements

- macOS on Apple Silicon, macOS 10.15 or later.
- Windows 10 or later, x64.
- An internet connection on first launch (the WebGL renderer is fetched from a CDN; to be fixed in a later release).
- Approximately 30 MB download.

## Known limitations (v0.1)

- **Mac builds are unsigned.** On first launch you may see a Gatekeeper warning ("PixelCluster is damaged and can't be opened"). After dragging the app to `/Applications`, run in Terminal:

  ```
  xattr -cr /Applications/PixelCluster.app
  ```

- **Internet required on first launch.** The Three.js library is loaded from a public CDN (`cdn.jsdelivr.net`). Offline first-launch will not render.
- **Intel Macs not supported.** Apple Silicon only.
- **Recording quality** depends on system performance and the chosen output format.

## History

This engine has been shipping since April 2026 under the name `ciafx` (v1.x as Splat, v2.x as ciafx). PixelCluster v0.1.0 is the same renderer with a name that matches what it actually does. The version reset to 0.1 because the public product surface is new, not the engine. The [final ciafx release (v2.0.2)](https://github.com/cia-mac/splat-desktop/releases/tag/v2.0.2) remains in the release history.

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

## Architecture (one paragraph)

Tauri v2 Rust shell wraps a WebKit/Chromium webview. The frontend is vanilla JavaScript with Three.js (WebGL2) doing the rendering. Cluster construction expands each sample cell into a group of particles with shared UV and per-member offset and size jitter. Turbulence runs entirely on the GPU; only mouse offsets touch the CPU.

## License

MIT.

## Author

Built by Ciamac Parhizi. [ciamac.com](https://ciamac.com)
