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
        if id == "pi" {
            return self.check_pi();
        }
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
                other => Err(format!("unknown backend: {other}")),
            }
        }
    }

    pub fn check_pi(&self) -> Result<(), String> {
        self.emit("pi", BackendStatus::Starting);
        #[cfg(windows)]
        let mut command = {
            let mut cmd = std::process::Command::new("powershell.exe");
            cmd.args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "pi --help"]);
            cmd
        };
        #[cfg(not(windows))]
        let mut command = {
            let mut cmd = std::process::Command::new("pi");
            cmd.arg("--help");
            cmd
        };
        let output = command
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map_err(|e| {
                self.emit("pi", BackendStatus::Crashed);
                format!("pi executable not available: {e}")
            })?;
        if output.success() {
            self.inner.lock().unwrap().entries.insert(
                "pi".into(),
                BackendEntry {
                    config: ManagedBackend {
                        id: "pi".into(),
                        program: PathBuf::from("pi"),
                        args: vec!["--help".into()],
                        health_url: None,
                    },
                    status: BackendStatus::Running,
                    child: None,
                    last_health: std::time::Instant::now(),
                    failures: 0,
                },
            );
            self.emit("pi", BackendStatus::Running);
            Ok(())
        } else {
            self.emit("pi", BackendStatus::Crashed);
            Err(format!("pi --help exited with {output}"))
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

pub fn check_pi() -> Result<(), String> {
    BACKEND_MANAGER.check_pi()
}
