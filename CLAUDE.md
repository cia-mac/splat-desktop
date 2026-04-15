# CLAUDE.md — splat-desktop

## Project Identity
Desktop Gaussian Splat viewer built with Tauri. Related to SplatPlayer but separate repo. Clarify with Ciamac which is the canonical viewer before major development.

- **Repo:** ~/Developer/splat-desktop/
- **Remote:** github.com/cia-mac/splat-desktop
- **Stack:** Tauri (Rust backend) + web frontend
- **Status:** SplatPlayer (separate repo) is heading to Mac App Store. This repo may be an earlier version or alternative build.
- **Session state:** See SESSION_STATE.md in this directory for tactical handoff between sessions.

## Build Protocol
1. `cargo tauri dev` for development
2. `cargo tauri build` for production
3. target/ is in .gitignore. Never commit build artifacts.

## Guardrails (Do Not Touch Without Explicit Instruction)
- Never commit the target/ directory.
- Never force-unwrap in Rust code.
- Do not start major feature work without clarifying the relationship to ~/Developer/splatplayer/ first.
- Do not load entire .ply sequences into memory. Stream frames on demand.
- Do not update Tauri, Rust toolchain, or web frontend dependencies without explicit instruction.

## Failure Patterns (Learned From Prior Sessions)
- Rust build artifacts in target/ consume massive disk space. Clean periodically but never commit.
- Relationship between this repo and splatplayer is ambiguous. Always confirm scope before doing significant work.
- [TO BE FILLED: add additional failure patterns as they are discovered]

## Related Projects
- **SplatPlayer** (~/Developer/splatplayer/): Mac App Store submission pending. May be the canonical viewer.
- **Forge** (future): Gaussian splat generator. Outputs feed both viewers.
