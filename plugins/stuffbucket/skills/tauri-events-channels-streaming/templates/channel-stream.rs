// Tauri v2 — Channel<T> streaming example.
//
// Wire into your builder:
//   tauri::Builder::default()
//     .invoke_handler(tauri::generate_handler![hash_file])

use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::ipc::Channel;
use tokio::{fs::File, io::AsyncReadExt};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
pub enum ProgressEvent {
  Started { total_bytes: u64 },
  Chunk { bytes_read: u64 },
  Done { sha256: String },
  Failed { message: String },
}

#[tauri::command]
pub async fn hash_file(
  path: String,
  on_event: Channel<ProgressEvent>,
) -> Result<(), String> {
  use sha2::{Digest, Sha256};

  let mut file = File::open(&path).await.map_err(|e| e.to_string())?;
  let total = file.metadata().await.map_err(|e| e.to_string())?.len();

  // Surviving a closed channel just aborts the work.
  if on_event.send(ProgressEvent::Started { total_bytes: total }).is_err() {
    return Ok(());
  }

  let mut hasher = Sha256::new();
  let mut buf = vec![0u8; 64 * 1024];
  let mut read_total: u64 = 0;

  // Sampled progress: cap to ~30 updates/sec to avoid flooding JS.
  let mut last_sent = Instant::now();
  let tick = Duration::from_millis(33);

  loop {
    let n = file.read(&mut buf).await.map_err(|e| e.to_string())?;
    if n == 0 {
      break;
    }
    hasher.update(&buf[..n]);
    read_total += n as u64;

    if last_sent.elapsed() >= tick {
      last_sent = Instant::now();
      if on_event
        .send(ProgressEvent::Chunk { bytes_read: read_total })
        .is_err()
      {
        // JS dropped the channel — caller doesn't care anymore.
        return Ok(());
      }
    }
  }

  let digest = format!("{:x}", hasher.finalize());
  let _ = on_event.send(ProgressEvent::Done { sha256: digest });
  Ok(())
}
