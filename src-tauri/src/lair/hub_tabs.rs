use crate::lair::types::{HubState, HubTab, HubTabKind};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{Emitter, Manager, State};

const PERSIST_FILE: &str = ".lair/hub-tabs.json";

pub struct HubTabsState(pub Mutex<HubState>);

pub fn dashboard_tab() -> HubTab {
    HubTab {
        id: "dashboard".to_string(),
        kind: HubTabKind::Dashboard,
        label: "Dashboard".to_string(),
        repo_path: None,
    }
}

pub fn new_repo_tab(repo_path: String) -> HubTab {
    let label = Path::new(&repo_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| repo_path.clone());
    HubTab {
        id: format!("repo:{repo_path}"),
        kind: HubTabKind::Repo,
        label,
        repo_path: Some(repo_path),
    }
}

pub fn initial_state() -> HubState {
    let dashboard = dashboard_tab();
    HubState {
        tabs: vec![dashboard.clone()],
        active_tab_id: Some(dashboard.id),
    }
}

pub fn add_repo_tab(state: &mut HubState, repo_path: String) -> String {
    let tab = new_repo_tab(repo_path);
    let id = tab.id.clone();
    if !state.tabs.iter().any(|t| t.id == id) {
        state.tabs.push(tab);
    }
    state.active_tab_id = Some(id.clone());
    id
}

pub fn close_tab(state: &mut HubState, id: &str) {
    if id == "dashboard" {
        return;
    }
    state.tabs.retain(|t| t.id != id);
    if state.active_tab_id.as_deref() == Some(id) {
        state.active_tab_id = state.tabs.first().map(|t| t.id.clone());
    }
}

pub fn switch_tab(state: &mut HubState, id: &str) -> bool {
    if state.tabs.iter().any(|t| t.id == id) {
        state.active_tab_id = Some(id.to_string());
        true
    } else {
        false
    }
}

pub fn persist(state: &HubState, dir: &Path) -> Result<(), String> {
    let path = dir.join(PERSIST_FILE);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(state).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())
}

pub fn load(dir: &Path) -> HubState {
    let path = dir.join(PERSIST_FILE);
    let Ok(json) = fs::read_to_string(&path) else {
        return initial_state();
    };
    serde_json::from_str(&json).unwrap_or_else(|_| initial_state())
}

fn data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn lair_list_hub_tabs(state: State<HubTabsState>) -> HubState {
    state.0.lock().unwrap().clone()
}

#[tauri::command]
pub fn lair_open_repo_tab(
    app: tauri::AppHandle,
    state: State<HubTabsState>,
    repo_path: String,
) -> Result<HubState, String> {
    if !Path::new(&repo_path).join(".git").exists() {
        return Err(format!("Not a git repository: {repo_path}"));
    }
    let mut s = state.0.lock().unwrap();
    add_repo_tab(&mut s, repo_path);
    let dir = data_dir(&app)?;
    persist(&s, &dir)?;
    let snapshot = s.clone();
    drop(s);
    app.emit("lair-hub-tabs-changed", &snapshot).ok();
    Ok(snapshot)
}

#[tauri::command]
pub fn lair_close_hub_tab(
    app: tauri::AppHandle,
    state: State<HubTabsState>,
    tab_id: String,
) -> Result<HubState, String> {
    let mut s = state.0.lock().unwrap();
    close_tab(&mut s, &tab_id);
    let dir = data_dir(&app)?;
    persist(&s, &dir)?;
    let snapshot = s.clone();
    drop(s);
    app.emit("lair-hub-tabs-changed", &snapshot).ok();
    Ok(snapshot)
}

#[tauri::command]
pub fn lair_switch_hub_tab(
    app: tauri::AppHandle,
    state: State<HubTabsState>,
    tab_id: String,
) -> Result<HubState, String> {
    let mut s = state.0.lock().unwrap();
    if !switch_tab(&mut s, &tab_id) {
        return Err(format!("Unknown tab: {tab_id}"));
    }
    let dir = data_dir(&app)?;
    persist(&s, &dir)?;
    let snapshot = s.clone();
    drop(s);
    app.emit("lair-hub-tabs-changed", &snapshot).ok();
    Ok(snapshot)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn initial_state_has_dashboard_active() {
        let s = initial_state();
        assert_eq!(s.tabs.len(), 1);
        assert_eq!(s.active_tab_id.as_deref(), Some("dashboard"));
    }

    #[test]
    fn add_repo_tab_makes_it_active() {
        let mut s = initial_state();
        let id = add_repo_tab(&mut s, "/repo/combocars".to_string());
        assert_eq!(id, "repo:/repo/combocars");
        assert_eq!(s.tabs.len(), 2);
        assert_eq!(s.active_tab_id, Some(id));
    }

    #[test]
    fn add_existing_repo_does_not_duplicate() {
        let mut s = initial_state();
        add_repo_tab(&mut s, "/repo/x".to_string());
        add_repo_tab(&mut s, "/repo/x".to_string());
        assert_eq!(s.tabs.len(), 2);
    }

    #[test]
    fn close_dashboard_is_noop() {
        let mut s = initial_state();
        close_tab(&mut s, "dashboard");
        assert_eq!(s.tabs.len(), 1);
    }

    #[test]
    fn close_active_repo_falls_back_to_dashboard() {
        let mut s = initial_state();
        let id = add_repo_tab(&mut s, "/repo/x".to_string());
        close_tab(&mut s, &id);
        assert_eq!(s.active_tab_id.as_deref(), Some("dashboard"));
    }

    #[test]
    fn switch_to_unknown_tab_returns_false() {
        let mut s = initial_state();
        assert!(!switch_tab(&mut s, "bogus"));
    }

    #[test]
    fn persist_and_load_roundtrip() {
        let dir = tempdir().unwrap();
        let mut s = initial_state();
        add_repo_tab(&mut s, "/repo/combocars".to_string());
        persist(&s, dir.path()).unwrap();
        let loaded = load(dir.path());
        assert_eq!(loaded.tabs.len(), 2);
        assert_eq!(
            loaded.active_tab_id.as_deref(),
            Some("repo:/repo/combocars")
        );
    }

    #[test]
    fn load_missing_file_returns_initial() {
        let dir = tempdir().unwrap();
        let loaded = load(dir.path());
        assert_eq!(loaded.tabs.len(), 1);
        assert_eq!(loaded.active_tab_id.as_deref(), Some("dashboard"));
    }
}
