use std::{
  collections::HashMap,
  fs,
  io::{BufRead, BufReader},
  path::{Path, PathBuf},
  process::{Child, Command, Stdio},
  sync::{Arc, Mutex},
};

use tauri::{Emitter, State, Window};
use uuid::Uuid;

fn resolve_ffmpeg() -> Result<PathBuf, String> {
  if let Ok(p) = std::env::var("FFMPEG_PATH") {
    let pb = PathBuf::from(p);
    if pb.is_file() {
      return Ok(pb);
    }
  }

  // Common macOS install locations (Homebrew on Apple Silicon / Intel).
  let candidates = [
    "/opt/homebrew/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
    "/usr/bin/ffmpeg",
  ];
  for c in candidates {
    let pb = PathBuf::from(c);
    if pb.is_file() {
      return Ok(pb);
    }
  }

  Err("ffmpeg not found. Install ffmpeg (e.g. `brew install ffmpeg`) or set FFMPEG_PATH to its full path.".to_string())
}

#[derive(Clone, Default)]
struct ExportManager(Arc<Mutex<HashMap<String, ExportJob>>>);

struct ExportJob {
  dir: PathBuf,
  total_frames: u32,
  child: Option<Child>,
}

#[derive(serde::Serialize)]
struct NativeExportStarted {
  export_id: String,
}

#[derive(serde::Deserialize)]
struct NativeExportStartArgs {
  total_frames: u32,
}

#[tauri::command]
fn native_export_start(state: State<'_, ExportManager>, args: NativeExportStartArgs) -> Result<NativeExportStarted, String> {
  let export_id = Uuid::new_v4().to_string();
  let dir = std::env::temp_dir().join(format!("pattern-tool-export-{}", export_id));
  fs::create_dir_all(&dir).map_err(|e| format!("Failed creating temp export dir: {e}"))?;

  let mut m = state.0.lock().map_err(|_| "Export manager lock poisoned".to_string())?;
  m.insert(
    export_id.clone(),
    ExportJob {
      dir,
      total_frames: args.total_frames,
      child: None,
    },
  );

  Ok(NativeExportStarted { export_id })
}

#[derive(serde::Deserialize)]
struct NativeExportWriteFrameArgs {
  export_id: String,
  frame_index: u32,
  png_base64: String,
}

fn decode_base64(data: &str) -> Result<Vec<u8>, String> {
  // Very small, dependency-free base64 decoder for standard alphabet; rejects data URLs.
  if data.starts_with("data:") {
    return Err("png_base64 must be raw base64 (no data: URL prefix)".to_string());
  }

  fn val(c: u8) -> Option<u8> {
    match c {
      b'A'..=b'Z' => Some(c - b'A'),
      b'a'..=b'z' => Some(c - b'a' + 26),
      b'0'..=b'9' => Some(c - b'0' + 52),
      b'+' => Some(62),
      b'/' => Some(63),
      _ => None,
    }
  }

  let bytes = data.as_bytes();
  if bytes.len() % 4 != 0 {
    return Err("Invalid base64 length".to_string());
  }

  let mut out = Vec::with_capacity(bytes.len() / 4 * 3);
  let mut i = 0;
  while i < bytes.len() {
    let a = bytes[i];
    let b = bytes[i + 1];
    let c = bytes[i + 2];
    let d = bytes[i + 3];

    let va = val(a).ok_or_else(|| "Invalid base64 character".to_string())?;
    let vb = val(b).ok_or_else(|| "Invalid base64 character".to_string())?;
    let vc = if c == b'=' { 0 } else { val(c).ok_or_else(|| "Invalid base64 character".to_string())? };
    let vd = if d == b'=' { 0 } else { val(d).ok_or_else(|| "Invalid base64 character".to_string())? };

    out.push((va << 2) | (vb >> 4));
    if c != b'=' {
      out.push((vb << 4) | (vc >> 2));
    }
    if d != b'=' {
      out.push((vc << 6) | vd);
    }

    i += 4;
  }

  Ok(out)
}

#[tauri::command]
fn native_export_write_frame(state: State<'_, ExportManager>, args: NativeExportWriteFrameArgs) -> Result<(), String> {
  let mut m = state.0.lock().map_err(|_| "Export manager lock poisoned".to_string())?;
  let job = m
    .get_mut(&args.export_id)
    .ok_or_else(|| "Unknown export_id".to_string())?;

  let data = decode_base64(&args.png_base64)?;
  let filename = format!("frame{:06}.png", args.frame_index);
  let path = job.dir.join(filename);
  fs::write(&path, data).map_err(|e| format!("Failed writing frame: {e}"))?;
  Ok(())
}

#[derive(serde::Deserialize)]
struct NativeExportFinishArgs {
  export_id: String,
  output_path: String,
  fps: u32,
}

#[tauri::command]
async fn native_export_finish(window: Window, state: State<'_, ExportManager>, args: NativeExportFinishArgs) -> Result<(), String> {
  let export_id = args.export_id.clone();
  let manager = state.0.clone();
  let (dir, total_frames) = {
    let mut m = manager.lock().map_err(|_| "Export manager lock poisoned".to_string())?;
    let job = m
      .get_mut(&args.export_id)
      .ok_or_else(|| "Unknown export_id".to_string())?;

    if job.child.is_some() {
      return Err("Export already running".to_string());
    }

    (job.dir.clone(), job.total_frames)
  };

  // Ensure parent dir exists.
  if let Some(parent) = Path::new(&args.output_path).parent() {
    fs::create_dir_all(parent).map_err(|e| format!("Failed creating output directory: {e}"))?;
  }

  let input_pattern = dir.join("frame%06d.png");
  let ffmpeg_path = resolve_ffmpeg()?;
  let mut cmd = Command::new(ffmpeg_path);
  cmd
    .stdin(Stdio::null())
    .stdout(Stdio::null())
    .stderr(Stdio::piped())
    .arg("-y")
    .arg("-hide_banner")
    .arg("-loglevel")
    .arg("error")
    .arg("-progress")
    .arg("pipe:2")
    .arg("-nostats")
    .arg("-framerate")
    .arg(args.fps.to_string())
    .arg("-i")
    .arg(input_pattern.to_string_lossy().to_string())
    .arg("-c:v")
    .arg("libx264")
    .arg("-preset")
    .arg("medium")
    .arg("-crf")
    .arg("18")
    .arg("-pix_fmt")
    .arg("yuv420p")
    .arg("-movflags")
    .arg("+faststart")
    .arg("-an")
    .arg(&args.output_path);

  let mut child = cmd.spawn().map_err(|e| {
    format!(
      "Failed to start ffmpeg ({e}). Install ffmpeg and ensure it’s available on PATH (or set FFMPEG_PATH)."
    )
  })?;

  let stderr = child
    .stderr
    .take()
    .ok_or_else(|| "Failed capturing ffmpeg stderr".to_string())?;

  {
    let mut m = manager.lock().map_err(|_| "Export manager lock poisoned".to_string())?;
    let job = m
      .get_mut(&args.export_id)
      .ok_or_else(|| "Unknown export_id".to_string())?;
    job.child = Some(child);
  }

  // Read progress from ffmpeg's -progress output.
  let progress_window = window.clone();
  let progress_export_id = export_id.clone();
  tauri::async_runtime::spawn_blocking(move || {
    let reader = BufReader::new(stderr);
    let mut last_frame: Option<u32> = None;
    for line in reader.lines().flatten() {
      if let Some(rest) = line.strip_prefix("frame=") {
        if let Ok(f) = rest.trim().parse::<u32>() {
          if last_frame.map(|lf| lf != f).unwrap_or(true) && total_frames > 0 {
            last_frame = Some(f);
            let p = (f as f32 / total_frames as f32).clamp(0.0, 1.0);
            let _ = progress_window.emit(
              "native-export-progress",
              serde_json::json!({ "exportId": progress_export_id, "progress": p }),
            );
          }
        }
      }
      if line.trim() == "progress=end" {
        let _ = progress_window.emit(
          "native-export-progress",
          serde_json::json!({ "exportId": progress_export_id, "progress": 1 }),
        );
      }
    }
    Some(())
  });

  // Wait for completion.
  let wait_export_id = export_id.clone();
  let wait_manager = manager.clone();
  let status = tauri::async_runtime::spawn_blocking(move || {
    let mut child = {
      let mut m = wait_manager.lock().map_err(|_| "Export manager lock poisoned".to_string())?;
      let job = m
        .get_mut(&wait_export_id)
        .ok_or_else(|| "Unknown export_id".to_string())?;
      job.child.take().ok_or_else(|| "Export process missing".to_string())?
    };
    child.wait().map_err(|e| format!("Failed waiting for ffmpeg: {e}"))
  })
  .await
  .map_err(|e| format!("Export task join failed: {e}"))??;

  // Cleanup temp dir & job entry.
  {
    let mut m = manager.lock().map_err(|_| "Export manager lock poisoned".to_string())?;
    if let Some(job) = m.remove(&export_id) {
      let _ = fs::remove_dir_all(job.dir);
    }
  }

  if !status.success() {
    return Err("ffmpeg failed to export MP4".to_string());
  }

  Ok(())
}

#[derive(serde::Deserialize)]
struct NativeExportCancelArgs {
  export_id: String,
}

#[tauri::command]
fn native_export_cancel(state: State<'_, ExportManager>, args: NativeExportCancelArgs) -> Result<(), String> {
  let mut m = state.0.lock().map_err(|_| "Export manager lock poisoned".to_string())?;
  if let Some(job) = m.get_mut(&args.export_id) {
    if let Some(child) = job.child.as_mut() {
      let _ = child.kill();
    }
    let _ = fs::remove_dir_all(&job.dir);
    m.remove(&args.export_id);
  }
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .plugin(tauri_plugin_dialog::init())
    .manage(ExportManager::default())
    .invoke_handler(tauri::generate_handler![
      native_export_start,
      native_export_write_frame,
      native_export_finish,
      native_export_cancel
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
