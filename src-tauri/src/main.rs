#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;

#[tauri::command]
fn save_file(path: String, data: Vec<u8>) -> Result<(), String> {
    fs::write(&path, &data).map_err(|e| format!("Failed to save: {}", e))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![save_file])
        .run(tauri::generate_context!())
        .expect("error while running ciafx");
}
