use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::{AppHandle, Manager, Runtime};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Función auxiliar para obtener la ruta completa de un binario dentro de la carpeta "bundled"
fn get_binary_path(app_handle: &AppHandle<impl Runtime>, binary_name: &str) -> Result<PathBuf, String> {
    let mut resource_dir = app_handle
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?;
    resource_dir.push("bundled");
    resource_dir.push(binary_name);
    if resource_dir.exists() {
        Ok(resource_dir)
    } else {
        Err(format!("No se encontró el binario: {:?}", resource_dir))
    }
}

/// Obtiene el título del video (con extensión sugerida) usando yt-dlp sin descargar el video.
#[tauri::command]
fn get_video_title(
    app_handle: AppHandle,
    url: String,
    download_type: String,
) -> Result<String, String> {
    let yt_dlp_path = get_binary_path(&app_handle, "yt-dlp.exe")?;
    // Siempre usamos la plantilla genérica para obtener el título con la extensión original.
    let output_template = "%(title)s.%(ext)s".to_string();

    let mut cmd = Command::new(&yt_dlp_path);
    cmd.arg("--get-filename")
        .arg("-o")
        .arg(&output_template)
        .arg(&url);
    
    let output = cmd.output().map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).into_owned());
    }
    let title = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(title)
}


/// Descarga el video (o audio) utilizando el binario yt-dlp empaquetado.
/// Se usa el parámetro savePath (ruta y nombre del archivo) que el usuario seleccionó.
#[tauri::command]
fn download_video(
    app_handle: AppHandle,
    url: String,
    savePath: String,
    download_type: String,
) -> Result<String, String> {
    if savePath.is_empty() {
        return Err("No se proporcionó un path de guardado".into());
    }
    
    let yt_dlp_path = get_binary_path(&app_handle, "yt-dlp.exe")?;
    let output_template = savePath.clone(); // Usamos directamente el path seleccionado

    // 1. Obtener el nombre esperado (aunque no lo mostraremos)
    let mut get_filename_cmd = Command::new(&yt_dlp_path);
    get_filename_cmd
        .arg("--get-filename")
        .arg("-o")
        .arg(&output_template)
        .arg(&url);
    
    let filename_output = get_filename_cmd.output().map_err(|e| e.to_string())?;
    if !filename_output.status.success() {
        return Err(String::from_utf8_lossy(&filename_output.stderr).into_owned());
    }
    let _ = String::from_utf8_lossy(&filename_output.stdout)
        .trim()
        .to_string();

    // 2. Ejecutar la descarga.
    let mut download_cmd = Command::new(&yt_dlp_path);
    download_cmd
        .arg("-o")
        .arg(&output_template)
        .arg(&url);

    match download_type.as_str() {
        "audio" => {
            download_cmd.arg("-x").arg("--audio-format").arg("mp3");
        },
        "mute" => {
            download_cmd.arg("--postprocessor-args").arg("ffmpeg:-an");
        },
        _ => {}
    }

    if let Ok(mut bundled_path) = app_handle.path().resource_dir().map_err(|e| e.to_string()) {
        bundled_path.push("bundled");
        if let Some(bundled_str) = bundled_path.to_str() {
            let current_path = std::env::var("PATH").unwrap_or_default();
            let new_path = format!("{};{}", bundled_str, current_path);
            download_cmd.env("PATH", new_path);
        }
    }

    let download_output = download_cmd.output().map_err(|e| e.to_string())?;
    if !download_output.status.success() {
        return Err(String::from_utf8_lossy(&download_output.stderr).into_owned());
    }
    
    Ok("Download complete!".into())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![greet, get_video_title, download_video])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
