use keyring::Entry;

#[tauri::command]
fn get_secret(key: String) -> Result<Option<String>, String> {
    let entry = Entry::new("jot", &key).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(val) => Ok(Some(val)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn set_secret(key: String, value: String) -> Result<(), String> {
    let entry = Entry::new("jot", &key).map_err(|e| e.to_string())?;
    entry.set_password(&value).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_secret(key: String) -> Result<(), String> {
    let entry = Entry::new("jot", &key).map_err(|e| e.to_string())?;
    match entry.delete_password() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_secret, set_secret, delete_secret])
        .run(tauri::generate_context!())
        .expect("error while running Jot");
}
