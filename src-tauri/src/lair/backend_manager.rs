use crate::lair::types::{BackendStatus, BackendStatusEvent};
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::{Child, Stdio};
use std::sync::{Arc, Mutex};
use tauri::AppHandle;

pub struct ManagedBackend {
    pub id: String,
    pub program: PathBuf,
    pub args: Vec<String>,
    pub health_url: Option<String>,
}

struct BackendEntry {
    config: ManagedBackend,
    status: BackendStatus,
    child: Option<Child>,
    #[allow(dead_code)]
    last_health: std::time::Instant,
    #[allow(dead_code)]
    failures: u32,
}

struct BackendManagerInner {
    entries: HashMap<String, BackendEntry>,
    app: Option<AppHandle>,
}

pub struct BackendManager {
    inner: Mutex<BackendManagerInner>,
}

impl BackendManager {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(BackendManagerInner {
                entries: HashMap::new(),
                app: None,
            }),
        }
    }

    pub fn set_app(&self, app: AppHandle) {
        self.inner.lock().unwrap().app = Some(app);
    }

    pub fn status(&self, id: &str) -> BackendStatus {
        self.inner
            .lock()
            .unwrap()
            .entries
            .get(id)
            .map(|e| e.status.clone())
            .unwrap_or(BackendStatus::Stopped)
    }

    pub fn start(&self, backend: ManagedBackend) -> Result<(), String> {
        let id = backend.id.clone();
        self.emit(&id, BackendStatus::Starting);

        let mut child_cmd = std::process::Command::new(&backend.program);
        child_cmd
            .args(&backend.args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let child = child_cmd.spawn().map_err(|e| format!("spawn {id}: {e}"))?;

        let health_url = backend.health_url.clone();

        let entry = BackendEntry {
            config: backend,
            status: BackendStatus::Running,
            child: Some(child),
            last_health: std::time::Instant::now(),
            failures: 0,
        };
        self.inner.lock().unwrap().entries.insert(id.clone(), entry);

        if let Some(url) = health_url {
            let id_c = id.clone();
            let mgr = BACKEND_MANAGER_ARC.clone();
            tauri::async_runtime::spawn(async move {
                let client = reqwest::Client::builder()
                    .timeout(std::time::Duration::from_secs(2))
                    .build()
                    .ok();
                let Some(client) = client else { return };
                loop {
                    tokio::time::sleep(std::time::Duration::from_secs(10)).await;
                    let resp = client.get(&url).send().await;
                    let healthy = matches!(resp, Ok(r) if r.status().is_success());
                    let mut guard = mgr.inner.lock().unwrap();
                    let Some(entry) = guard.entries.get_mut(&id_c) else { break };
                    if healthy {
                        entry.failures = 0;
                        if !matches!(entry.status, BackendStatus::Running) {
                            entry.status = BackendStatus::Running;
                            let app = guard.app.clone();
                            drop(guard);
                            emit_backend_event(&app, &id_c, BackendStatus::Running);
                        }
                    } else {
                        entry.failures += 1;
                        if entry.failures >= 3
                            && !matches!(entry.status, BackendStatus::Crashed)
                        {
                            entry.status = BackendStatus::Crashed;
                            let app = guard.app.clone();
                            drop(guard);
                            emit_backend_event(&app, &id_c, BackendStatus::Crashed);
                            let _ = mgr.restart(&id_c);
                            break;
                        }
                    }
                }
            });
        }

        self.emit(&id, BackendStatus::Running);
        Ok(())
    }

    pub fn stop(&self, id: &str) -> Result<(), String> {
        let mut guard = self.inner.lock().unwrap();
        if let Some(entry) = guard.entries.get_mut(id) {
            if let Some(mut c) = entry.child.take() {
                let _ = c.kill();
                let _ = c.wait();
            }
            entry.status = BackendStatus::Stopped;
        }
        drop(guard);
        self.emit(id, BackendStatus::Stopped);
        Ok(())
    }

    pub fn restart(&self, id: &str) -> Result<(), String> {
        let cfg = {
            let guard = self.inner.lock().unwrap();
            guard.entries.get(id).map(|e| ManagedBackend {
                id: e.config.id.clone(),
                program: e.config.program.clone(),
                args: e.config.args.clone(),
                health_url: e.config.health_url.clone(),
            })
        };
        if let Some(cfg) = cfg {
            self.stop(id)?;
            self.start(cfg)
        } else {
            // Never started — cold-start it
            match id {
                "uniclaude-proxy" => spawn_uniclaude_proxy(),
                other => Err(format!("unknown backend: {other}")),
            }
        }
    }

    pub fn stop_all(&self) {
        let ids: Vec<String> = self.inner.lock().unwrap().entries.keys().cloned().collect();
        for id in ids {
            let _ = self.stop(&id);
        }
    }

    fn emit(&self, id: &str, status: BackendStatus) {
        let app = self.inner.lock().unwrap().app.clone();
        emit_backend_event(&app, id, status);
    }
}

impl Default for BackendManager {
    fn default() -> Self {
        Self::new()
    }
}

fn emit_backend_event(app: &Option<AppHandle>, id: &str, status: BackendStatus) {
    if let Some(app) = app {
        use tauri::Emitter;
        let _ = app.emit(
            "lair-backend-status-changed",
            BackendStatusEvent {
                id: id.to_string(),
                status,
            },
        );
    }
}

pub static BACKEND_MANAGER_ARC: Lazy<Arc<BackendManager>> =
    Lazy::new(|| Arc::new(BackendManager::new()));

// Convenience: borrows from the Arc-backed singleton. Only valid after first access.
pub fn backend_manager() -> &'static BackendManager {
    &BACKEND_MANAGER_ARC
}

// Keep old name working for existing callers
pub static BACKEND_MANAGER: Lazy<Arc<BackendManager>> =
    Lazy::new(|| BACKEND_MANAGER_ARC.clone());

/// Resolve the bundled sidecar binary path at runtime.
pub fn sidecar_path(name: &str) -> Result<PathBuf, String> {
    // Dev mode: check src-tauri/binaries first
    if let Ok(cwd) = std::env::current_dir() {
        let dev = cwd
            .join("src-tauri")
            .join("binaries")
            .join(format!("{name}-x86_64-pc-windows-msvc.exe"));
        if dev.exists() {
            return Ok(dev);
        }
    }
    // Release mode: alongside the exe
    let exe = std::env::current_exe().map_err(|e| format!("current_exe: {e}"))?;
    let exe_dir = exe.parent().ok_or("no exe parent dir")?;
    let candidate = exe_dir
        .join("binaries")
        .join(format!("{name}-x86_64-pc-windows-msvc.exe"));
    if candidate.exists() {
        return Ok(candidate);
    }
    Err(format!("sidecar binary not found: {name}"))
}

pub fn spawn_uniclaude_proxy() -> Result<(), String> {
    // Port fallback: if port 9223 is occupied, restart will fail until the user
    // edits ~/.lair/uniclaude-proxy-port.txt and restarts the backend from settings.
    // Full automatic fallback is M4 work.
    let path = sidecar_path("uniclaude-proxy")?;
    BACKEND_MANAGER.start(ManagedBackend {
        id: "uniclaude-proxy".into(),
        program: path,
        args: vec![],
        health_url: Some("http://127.0.0.1:9223/health".into()),
    })
}
