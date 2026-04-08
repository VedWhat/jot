use std::path::PathBuf;
use tauri::{
    AppHandle, Manager,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState},
    WindowEvent,
};
use tauri_plugin_positioner::{Position, WindowExt};

fn load_tray_icon() -> tauri::image::Image<'static> {
    let bytes = include_bytes!("../icons/tray-iconTemplate.png");
    let img = image::load_from_memory_with_format(bytes, image::ImageFormat::Png)
        .expect("failed to load tray icon PNG");
    let rgba = img.to_rgba8();
    let (w, h) = image::GenericImageView::dimensions(&rgba);
    tauri::image::Image::new_owned(rgba.into_raw(), w, h)
}

// ── Env var storage ──────────────────────────────────────────────────────────
//
// Keys arriving from the frontend look like "jot:secret:openai_api_key".
// We strip the prefix and uppercase to get "JOT_OPENAI_API_KEY".
//
// On startup we load ~/.config/jot/.env so the settings panel can persist
// values. Shell env vars (set in .zprofile etc.) always take precedence.

fn env_file_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    PathBuf::from(home).join(".config").join("jot").join(".env")
}

fn to_env_key(key: &str) -> String {
    let stripped = key.strip_prefix("jot:secret:").unwrap_or(key);
    let upper = stripped.to_uppercase();
    format!("JOT_{}", upper.replace(['-', ':'], "_"))
}

/// Load ~/.config/jot/.env into the process environment.
/// Shell env vars set before launch are NOT overwritten.
fn load_env_file() {
    let path = env_file_path();
    let Ok(content) = std::fs::read_to_string(&path) else { return };
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') { continue; }
        if let Some((k, v)) = line.split_once('=') {
            let k = k.trim();
            let v = v.trim();
            // Shell wins — only set if not already present
            if std::env::var(k).is_err() {
                unsafe { std::env::set_var(k, v); }
            }
        }
    }
}

fn write_env_file(key: &str, value: &str) -> Result<(), String> {
    let path = env_file_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let existing = std::fs::read_to_string(&path).unwrap_or_default();
    let prefix = format!("{}=", key);
    let new_line = format!("{}={}", key, value);
    let mut lines: Vec<String> = existing.lines().map(String::from).collect();
    if let Some(pos) = lines.iter().position(|l| l.starts_with(&prefix)) {
        lines[pos] = new_line;
    } else {
        lines.push(new_line);
    }
    std::fs::write(&path, lines.join("\n") + "\n").map_err(|e| e.to_string())
}

fn remove_from_env_file(key: &str) -> Result<(), String> {
    let path = env_file_path();
    let existing = std::fs::read_to_string(&path).unwrap_or_default();
    let prefix = format!("{}=", key);
    let lines: Vec<&str> = existing.lines().filter(|l| !l.starts_with(&prefix)).collect();
    std::fs::write(&path, lines.join("\n") + "\n").map_err(|e| e.to_string())
}

// ── Tauri commands ───────────────────────────────────────────────────────────

#[tauri::command]
fn get_secret(key: String) -> Result<Option<String>, String> {
    let env_key = to_env_key(&key);
    Ok(std::env::var(&env_key).ok())
}

#[tauri::command]
fn set_secret(key: String, value: String) -> Result<(), String> {
    let env_key = to_env_key(&key);
    // Persist to .env file
    write_env_file(&env_key, &value)?;
    // Also update the live process so changes take effect immediately
    unsafe { std::env::set_var(&env_key, &value); }
    Ok(())
}

#[tauri::command]
fn delete_secret(key: String) -> Result<(), String> {
    let env_key = to_env_key(&key);
    remove_from_env_file(&env_key)?;
    unsafe { std::env::remove_var(&env_key); }
    Ok(())
}

// ── File system command (Obsidian export) ────────────────────────────────────

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = std::path::Path::new(&path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

// ── Window toggle ────────────────────────────────────────────────────────────

fn toggle_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.move_window(Position::TrayCenter);
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

// ── Entry point ──────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load persisted values from ~/.config/jot/.env before anything else
    load_env_file();

    tauri::Builder::default()
        .plugin(tauri_plugin_positioner::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        toggle_window(app);
                    }
                })
                .build(),
        )
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};
            app.global_shortcut().register(
                Shortcut::new(Some(Modifiers::META | Modifiers::SHIFT), Code::KeyJ)
            )?;

            let open_item = MenuItem::with_id(app, "open", "Open Jot", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit Jot", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_item, &sep, &quit_item])?;

            TrayIconBuilder::new()
                .icon(load_tray_icon())
                .icon_as_template(true)
                .tooltip("Jot — ⌘⇧J")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => toggle_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    tauri_plugin_positioner::on_tray_event(tray.app_handle(), &event);
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event {
                        toggle_window(tray.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::Focused(false) = event {
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_secret,
            set_secret,
            delete_secret,
            write_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Jot");
}
