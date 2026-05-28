use crate::lair::types::{BackendStatus, BackendStatusEvent};
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::{Child, Stdio};
use std::sync::Mutex;
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

pub struct BackendManager {
    inner: Mutex<HashMap<String, BackendEntry>>,
    app: Mutex<Option<AppHandle>>,
}

impl BackendManager {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(HashMap::new()),
            app: Mutex::new(None),
        }
    }

    pub fn set_app(&self, app: AppHandle) {
        *self.app.lock().unwrap() = Some(app);
    }

    pub fn status(&self, id: &str) -> BackendStatus {
        self.inner
            .lock()
            .unwrap()
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

        let entry = BackendEntry {
            config: backend,
            status: BackendStatus::Running,
            child: Some(child),
            last_health: std::time::Instant::now(),
            failures: 0,
        };
        self.inner.lock().unwrap().insert(id.clone(), entry);
        self.emit(&id, BackendStatus::Running);
        Ok(())
    }

    pub fn stop(&self, id: &str) -> Result<(), String> {
        let mut guard = self.inner.lock().unwrap();
        if let Some(entry) = guard.get_mut(id) {
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
            guard.get(id).map(|e| ManagedBackend {
                id: e.config.id.clone(),
                program: e.config.program.clone(),
                args: e.config.args.clone(),
                health_url: e.config.health_url.clone(),
            })
        };
        if let Some(cfg) = cfg {
            self.stop(id)?;
            self.start(cfg)?;
        }
        Ok(())
    }

    pub fn stop_all(&self) {
        let ids: Vec<String> = self.inner.lock().unwrap().keys().cloned().collect();
        for id in ids {
            let _ = self.stop(&id);
        }
    }

    fn emit(&self, id: &str, status: BackendStatus) {
        if let Some(app) = self.app.lock().unwrap().as_ref() {
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
}

impl Default for BackendManager {
    fn default() -> Self {
        Self::new()
    }
}

pub static BACKEND_MANAGER: Lazy<BackendManager> = Lazy::new(BackendManager::new);

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
    // Release mode: alongside the exe in the resource dir
    let exe = std::env::current_exe().map_err(|e| format!("current_exe: {e}"))?;
    let exe_dir = exe.parent().ok_or("no exe parent dir")?;
    let candidate = exe_dir
        .join("binaries")
        .join(format!("{name}-x86_64-pc-windows-msvc.exe"));
    if candidate.exists() {
        return Ok(candidate);
    }
    // Fallback: check the resource dir one level up (Tauri bundle layout)
    let resource_candidate = exe_dir
        .join("_up_")
        .join("binaries")
        .join(format!("{name}-x86_64-pc-windows-msvc.exe"));
    if resource_candidate.exists() {
        return Ok(resource_candidate);
    }
    Err(format!("sidecar binary not found: {name}"))
}

pub fn spawn_uniclaude_proxy() -> Result<(), String> {
    let path = sidecar_path("uniclaude-proxy")?;
    BACKEND_MANAGER.start(ManagedBackend {
        id: "uniclaude-proxy".into(),
        program: path,
        args: vec![],
        health_url: Some("http://127.0.0.1:9223/health".into()),
    })
}
