//! Supervised sidecar with crash-restart, exponential backoff, healthcheck,
//! graceful-then-forceful kill on app exit. Drop into `src-tauri/src/sidecar.rs`
//! and wire via:
//!
//!   tauri::Builder::default()
//!       .plugin(tauri_plugin_shell::init())
//!       .setup(|app| { sidecar::install(app.handle().clone(), "myproxy", 4142); Ok(()) })
//!       .build(tauri::generate_context!())?
//!       .run(sidecar::on_run_event);

use std::{
    sync::{atomic::{AtomicBool, AtomicU32, Ordering}, Arc},
    time::{Duration, Instant},
};
use tauri::{AppHandle, Manager, RunEvent};
use tauri_plugin_shell::{ShellExt, process::{CommandChild, CommandEvent}};
use tokio::sync::Mutex;

pub struct Sidecar {
    pub name: &'static str,
    pub port: u16,
    pub child: Mutex<Option<CommandChild>>,
    pub pid: AtomicU32,
    pub shutting_down: AtomicBool,
}

impl Sidecar {
    fn new(name: &'static str, port: u16) -> Arc<Self> {
        Arc::new(Self {
            name,
            port,
            child: Mutex::new(None),
            pid: AtomicU32::new(0),
            shutting_down: AtomicBool::new(false),
        })
    }
}

pub fn install(app: AppHandle, name: &'static str, port: u16) {
    let state = Sidecar::new(name, port);
    app.manage(state.clone());
    tauri::async_runtime::spawn(supervise(app, state));
}

async fn supervise(app: AppHandle, state: Arc<Sidecar>) {
    let mut delay = Duration::from_millis(250);
    const MAX_DELAY: Duration = Duration::from_secs(30);
    const HEALTHY_THRESHOLD: Duration = Duration::from_secs(30);

    while !state.shutting_down.load(Ordering::SeqCst) {
        let started = Instant::now();
        match spawn_once(&app, &state).await {
            Ok(()) => {
                if started.elapsed() >= HEALTHY_THRESHOLD {
                    delay = Duration::from_millis(250);   // reset
                }
            }
            Err(e) => eprintln!("[sidecar:{}] spawn error: {e}", state.name),
        }
        if state.shutting_down.load(Ordering::SeqCst) { break; }
        tokio::time::sleep(delay).await;
        delay = (delay * 2).min(MAX_DELAY);
    }
}

async fn spawn_once(app: &AppHandle, state: &Arc<Sidecar>) -> Result<(), String> {
    let (mut rx, child) = app
        .shell()
        .sidecar(state.name)
        .map_err(|e| e.to_string())?
        .args(["--port", &state.port.to_string()])
        .spawn()
        .map_err(|e| e.to_string())?;

    state.pid.store(child.pid(), Ordering::SeqCst);
    *state.child.lock().await = Some(child);

    // Concurrent healthcheck — emits an app event when first /health 200.
    let app_for_health = app.clone();
    let port = state.port;
    tauri::async_runtime::spawn(async move {
        if wait_ready(port).await.is_ok() {
            let _ = app_for_health.emit("sidecar://ready", port);
        }
    });

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(line) => {
                println!("[sidecar:{}] {}", state.name, String::from_utf8_lossy(&line));
            }
            CommandEvent::Stderr(line) => {
                eprintln!("[sidecar:{}:err] {}", state.name, String::from_utf8_lossy(&line));
            }
            CommandEvent::Error(msg) => {
                eprintln!("[sidecar:{}:pipe-err] {msg}", state.name);
            }
            CommandEvent::Terminated(p) => {
                eprintln!("[sidecar:{}] exited code={:?} signal={:?}",
                          state.name, p.code, p.signal);
                break;
            }
            _ => {}
        }
    }

    *state.child.lock().await = None;
    state.pid.store(0, Ordering::SeqCst);
    Ok(())
}

async fn wait_ready(port: u16) -> Result<(), &'static str> {
    let deadline = Instant::now() + Duration::from_secs(10);
    while Instant::now() < deadline {
        match tokio::net::TcpStream::connect(("127.0.0.1", port)).await {
            Ok(_) => return Ok(()),
            Err(_) => tokio::time::sleep(Duration::from_millis(100)).await,
        }
    }
    Err("sidecar not ready in 10s")
}

/// Wire into `app.run(|h, ev| sidecar::on_run_event(h, &ev))`.
pub fn on_run_event(app: &AppHandle, event: &RunEvent) {
    if matches!(event, RunEvent::ExitRequested { .. }) {
        let state = app.state::<Arc<Sidecar>>().inner().clone();
        state.shutting_down.store(true, Ordering::SeqCst);
        let pid = state.pid.load(Ordering::SeqCst);
        tauri::async_runtime::block_on(async move {
            graceful_kill(&state, pid).await;
        });
    }
}

async fn graceful_kill(state: &Arc<Sidecar>, pid: u32) {
    let Some(child) = state.child.lock().await.take() else { return };
    let _ = child.kill();   // SIGTERM / TerminateProcess

    // Wait up to 5 s for the child to actually exit.
    let deadline = Instant::now() + Duration::from_secs(5);
    while Instant::now() < deadline {
        if !pid_alive(pid) { return; }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }

    // Escalate. Kills grandchildren on Windows via /T; SIGKILL on POSIX.
    force_kill_tree(pid);
}

#[cfg(windows)]
fn force_kill_tree(pid: u32) {
    let _ = std::process::Command::new("taskkill")
        .args(["/T", "/F", "/PID", &pid.to_string()])
        .status();
}

#[cfg(unix)]
fn force_kill_tree(pid: u32) {
    // SAFETY: kill(2) with SIGKILL on a known PID we own.
    unsafe { libc::kill(pid as i32, libc::SIGKILL) };
}

#[cfg(unix)]
fn pid_alive(pid: u32) -> bool {
    if pid == 0 { return false; }
    // signal 0 ⇒ existence check, no signal delivered.
    unsafe { libc::kill(pid as i32, 0) == 0 }
}

#[cfg(windows)]
fn pid_alive(pid: u32) -> bool {
    use std::process::Command;
    if pid == 0 { return false; }
    Command::new("tasklist")
        .args(["/FI", &format!("PID eq {pid}"), "/NH"])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).contains(&pid.to_string()))
        .unwrap_or(false)
}
