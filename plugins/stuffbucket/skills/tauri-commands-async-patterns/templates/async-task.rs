// Cancellable long-running Tauri command with live progress over Channel<T>.
//
// Cargo.toml needs:
//   tokio       = { version = "1", features = ["sync", "rt-multi-thread", "macros", "time"] }
//   tokio-util  = "0.7"
//   serde       = { version = "1", features = ["derive"] }
//   thiserror   = "1"

use serde::Serialize;
use tauri::{AppHandle, Manager, State};
use tauri::ipc::Channel;
use tokio_util::sync::CancellationToken;

#[derive(Debug, thiserror::Error)]
pub enum JobError {
    #[error("already running")]
    Busy,
    #[error("nothing to cancel")]
    NotRunning,
    #[error("internal: {0}")]
    Internal(String),
}

impl Serialize for JobError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

#[derive(Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Progress {
    Started   { total: u64 },
    Tick      { done: u64 },
    Finished,
    Cancelled,
    Failed    { message: String },
}

/// One slot for the current job's cancellation handle. Kept behind an async
/// Mutex because we touch it from commands that may also touch other awaits.
#[derive(Default)]
pub struct Jobs {
    pub current: tokio::sync::Mutex<Option<CancellationToken>>,
}

#[tauri::command]
pub async fn start_job(
    total: u64,
    on_event: Channel<Progress>,
    app: AppHandle,
    jobs: State<'_, Jobs>,
) -> Result<(), JobError> {
    // Reject overlapping jobs. Could also queue or pre-empt, depending on UX.
    {
        let mut slot = jobs.current.lock().await;
        if slot.is_some() {
            return Err(JobError::Busy);
        }
        let token = CancellationToken::new();
        *slot = Some(token.clone());

        let app = app.clone();
        tokio::spawn(async move {
            let outcome = run(total, on_event.clone(), token.clone()).await;
            match outcome {
                Ok(_)  => { on_event.send(Progress::Finished).ok(); }
                Err(e) => {
                    on_event
                        .send(Progress::Failed { message: e.to_string() })
                        .ok();
                }
            }
            // Clear the slot so the next start_job can run.
            let jobs = app.state::<Jobs>();
            *jobs.current.lock().await = None;
        });
    }
    Ok(())
}

#[tauri::command]
pub async fn cancel_job(jobs: State<'_, Jobs>) -> Result<(), JobError> {
    let token = jobs.current.lock().await.take().ok_or(JobError::NotRunning)?;
    token.cancel();
    Ok(())
}

async fn run(
    total: u64,
    on_event: Channel<Progress>,
    token: CancellationToken,
) -> Result<(), JobError> {
    on_event.send(Progress::Started { total }).ok();

    for i in 0..total {
        // Branch on whichever finishes first: cancellation or one tick of work.
        tokio::select! {
            _ = token.cancelled() => {
                on_event.send(Progress::Cancelled).ok();
                // Return Ok — cancellation is a success path, not a failure.
                return Ok(());
            }
            _ = tokio::time::sleep(std::time::Duration::from_millis(50)) => {
                on_event.send(Progress::Tick { done: i + 1 }).ok();
            }
        }
    }
    Ok(())
}

pub fn run_app() {
    tauri::Builder::default()
        .setup(|app| {
            app.manage(Jobs::default());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![start_job, cancel_job])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
