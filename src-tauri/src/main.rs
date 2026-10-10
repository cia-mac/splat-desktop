#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs::{self, OpenOptions};
use std::io::Write;

/// Write one chunk of a recording to a path the user chose in the save panel.
///
/// The renderer sends the file in bounded chunks rather than in one piece. Each
/// byte crossing the IPC boundary becomes a JS number and then JSON text, so a
/// whole recording sent at once cost roughly 8-15x the file size in transient
/// memory on the WebContent main thread; a few minutes of 12 Mbps video was
/// enough to stall or kill it. Chunking caps that cost no matter how long the
/// recording is.
///
/// `append` is false for the first chunk, which creates or truncates the file,
/// and true for every chunk after it.
#[tauri::command]
fn save_file(path: String, data: Vec<u8>, append: bool) -> Result<(), String> {
    if append {
        let mut f = OpenOptions::new()
            .append(true)
            .open(&path)
            .map_err(|e| format!("Failed to save: {}", e))?;
        f.write_all(&data)
            .map_err(|e| format!("Failed to save: {}", e))
    } else {
        fs::write(&path, &data).map_err(|e| format!("Failed to save: {}", e))
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![save_file])
        .run(tauri::generate_context!())
        .expect("error while running Pointfield");
}
