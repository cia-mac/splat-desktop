# CLAUDE.md — splat-desktop

## Project Identity
Desktop Gaussian Splat viewer built with Tauri. Related to SplatPlayer but separate repo. Clarify with project owner which is the canonical viewer before major development.

- **Repo:** ~/Developer/splat-desktop/
- **Remote:** github.com/cia-mac/splat-desktop
- **Stack:** Tauri (Rust backend) + web frontend
- **Status:** Check with project owner. SplatPlayer (separate repo) is heading to Mac App Store. This repo may be an earlier version, alternative build, or feature branch.

## Build Protocol
1. `cargo tauri dev` for development
2. `cargo tauri build` for production
3. target/ is in .gitignore. Never commit build artifacts.

## What NOT to Do
- Never commit the target/ directory.
- Never force-unwrap in Rust code.
- Do not start major feature work without clarifying the relationship to ~/Developer/splatplayer/ first. These may need to be merged.
- Do not load entire .ply sequences into memory. Stream frames on demand.

## Related Projects
- **SplatPlayer** (~/Developer/splatplayer/): Mac App Store submission pending. May be the canonical viewer.
- **Forge** (future): Gaussian splat generator. Outputs feed both viewers.
