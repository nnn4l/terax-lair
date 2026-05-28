use crate::lair::types::{CostTier, Lane, LaneRole};
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::mpsc;
use std::time::{Duration, Instant};

pub struct WatcherHandle {
    _watcher: RecommendedWatcher,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct LanesFile {
    #[serde(default)]
    lane: Vec<Lane>,
}

fn home_dir() -> PathBuf {
    if let Ok(test_home) = std::env::var("LAIR_TEST_HOME") {
        return PathBuf::from(test_home);
    }
    dirs::home_dir().unwrap_or_else(|| PathBuf::from("."))
}

pub fn config_path() -> PathBuf {
    home_dir().join(".lair").join("lanes.toml")
}

pub fn ensure_seeded() -> Result<(), String> {
    let path = config_path();
    if path.exists() {
        return Ok(());
    }
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| format!("mkdir .lair: {e}"))?;
    }
    fs::write(&path, SEED).map_err(|e| format!("write lanes.toml: {e}"))?;
    Ok(())
}

pub fn load() -> Result<Vec<Lane>, String> {
    ensure_seeded()?;
    let path = config_path();
    let raw = fs::read_to_string(&path).map_err(|e| format!("read lanes.toml: {e}"))?;
    let parsed: LanesFile = toml::from_str(&raw).map_err(|e| format!("parse lanes.toml: {e}"))?;
    Ok(parsed.lane)
}

pub fn save(lanes: &[Lane]) -> Result<(), String> {
    let path = config_path();
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| format!("mkdir .lair: {e}"))?;
    }
    let file = LanesFile {
        lane: lanes.to_vec(),
    };
    let s = toml::to_string_pretty(&file).map_err(|e| format!("serialize lanes.toml: {e}"))?;
    fs::write(&path, s).map_err(|e| format!("write lanes.toml: {e}"))
}

pub fn watch<F>(on_change: F) -> Result<WatcherHandle, String>
where
    F: Fn() + Send + 'static,
{
    let path = config_path();
    let dir = path.parent().ok_or("no parent")?.to_path_buf();
    let target = path.clone();
    let (tx, rx) = mpsc::channel::<notify::Result<Event>>();
    let mut watcher: RecommendedWatcher =
        notify::recommended_watcher(tx).map_err(|e| format!("watcher: {e}"))?;
    watcher
        .watch(&dir, RecursiveMode::NonRecursive)
        .map_err(|e| format!("watch dir: {e}"))?;
    std::thread::spawn(move || {
        let mut last = Instant::now() - Duration::from_secs(1);
        while let Ok(event) = rx.recv() {
            if let Ok(event) = event {
                if !event.paths.iter().any(|p| p == &target) {
                    continue;
                }
                if !matches!(
                    event.kind,
                    EventKind::Modify(_) | EventKind::Create(_) | EventKind::Remove(_)
                ) {
                    continue;
                }
                if last.elapsed() < Duration::from_millis(300) {
                    continue;
                }
                last = Instant::now();
                on_change();
            }
        }
    });
    Ok(WatcherHandle {
        _watcher: watcher,
    })
}

/// Synthetic auto-router lane. Not in the file.
pub fn auto_lane() -> Lane {
    Lane {
        id: "auto".into(),
        label: "Auto".into(),
        cli: String::new(),
        env: HashMap::new(),
        default_model: None,
        default_effort: None,
        role: LaneRole::Implementor,
        cost_tier: CostTier::Cheap,
        clear_required: false,
        backend: None,
        auto_bias: vec![],
        enabled: true,
        context_window: None,
    }
}

const SEED: &str = r#"# Lair lanes
# Each lane = configured agent identity.
# Edit via Settings -> Lanes, or directly here.

[[lane]]
id = "claude"
label = "Claude"
cli = "claude"
default_model = "claude-opus-4-5"
default_effort = "medium"
role = "consultant"
cost_tier = "expensive"
clear_required = false
auto_bias = ["design", "plan", "brainstorm", "critique"]
enabled = true
context_window = 200000

[[lane]]
id = "codex"
label = "Codex"
cli = "codex"
default_model = "gpt-5"
role = "implementor"
cost_tier = "free"
clear_required = false
auto_bias = ["review", "test", "implement"]
enabled = true
context_window = 200000

[[lane]]
id = "deepseek-pro"
label = "DeepSeek Pro"
cli = "claude"
default_model = "claude-sonnet-4-5"
default_effort = "medium"
role = "implementor"
cost_tier = "standard"
clear_required = true
backend = "uniclaude-proxy"
auto_bias = ["implement", "refactor", "design"]
enabled = false
context_window = 128000

[lane.env]
ANTHROPIC_BASE_URL = "http://127.0.0.1:9223"
ANTHROPIC_AUTH_TOKEN = "dummy"

[[lane]]
id = "deepseek-flash"
label = "DeepSeek Flash"
cli = "claude"
default_model = "claude-haiku-4-5"
role = "implementor"
cost_tier = "cheap"
clear_required = true
backend = "uniclaude-proxy"
auto_bias = ["test", "lint", "format"]
enabled = false
context_window = 64000

[lane.env]
ANTHROPIC_BASE_URL = "http://127.0.0.1:9223"
ANTHROPIC_AUTH_TOKEN = "dummy"
"#;

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn with_tmp_home<F: FnOnce(&str)>(f: F) {
        let tmp = TempDir::new().expect("tmp");
        let home = tmp.path().to_string_lossy().to_string();
        std::env::set_var("LAIR_TEST_HOME", &home);
        f(&home);
        std::env::remove_var("LAIR_TEST_HOME");
    }

    #[test]
    fn ensure_seeded_writes_default_file() {
        with_tmp_home(|home| {
            ensure_seeded().expect("ok");
            let p = PathBuf::from(home).join(".lair").join("lanes.toml");
            assert!(p.exists());
            let content = fs::read_to_string(&p).unwrap();
            assert!(content.contains("id = \"claude\""));
            assert!(content.contains("id = \"codex\""));
            assert!(content.contains("id = \"deepseek-pro\""));
            assert!(content.contains("id = \"deepseek-flash\""));
        });
    }

    #[test]
    fn ensure_seeded_idempotent() {
        with_tmp_home(|home| {
            let dir = PathBuf::from(home).join(".lair");
            fs::create_dir_all(&dir).unwrap();
            let p = dir.join("lanes.toml");
            fs::write(
                &p,
                "[[lane]]\nid = \"custom\"\nlabel = \"X\"\ncli = \"claude\"\nrole = \"implementor\"\ncost_tier = \"cheap\"\n",
            )
            .unwrap();
            ensure_seeded().expect("second");
            let content = fs::read_to_string(&p).unwrap();
            // Idempotent: custom lane preserved, seed not overwritten
            assert!(content.contains("id = \"custom\""));
        });
    }

    #[test]
    fn load_round_trip_with_save() {
        with_tmp_home(|_| {
            ensure_seeded().expect("seed");
            let original = load().expect("load");
            assert!(!original.is_empty());
            save(&original).expect("save");
            let again = load().expect("reload");
            assert_eq!(original.len(), again.len());
            assert_eq!(original[0].id, again[0].id);
        });
    }

    #[test]
    fn load_malformed_returns_err() {
        with_tmp_home(|home| {
            let dir = PathBuf::from(home).join(".lair");
            fs::create_dir_all(&dir).unwrap();
            // Write invalid TOML that `toml` crate rejects
            fs::write(dir.join("lanes.toml"), "[invalid\ntable_without_close_bracket").unwrap();
            assert!(load().is_err(), "load should fail on malformed TOML");
        });
    }

    #[test]
    fn auto_lane_returns_implementor_role() {
        let lane = auto_lane();
        assert_eq!(lane.id, "auto");
        assert!(matches!(
            lane.role,
            crate::lair::types::LaneRole::Implementor
        ));
    }
}
