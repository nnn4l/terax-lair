use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::time::{Duration, Instant};

pub struct WatcherHandle {
    _watcher: RecommendedWatcher,
}

pub fn pillars_path(workspace: &str) -> PathBuf {
    Path::new(workspace).join(".lair").join("pillars.md")
}

pub fn ensure_pillars_file(workspace: &str) -> Result<(), String> {
    let path = pillars_path(workspace);
    if path.exists() {
        return Ok(());
    }
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| format!("mkdir .lair: {e}"))?;
    }
    fs::write(&path, SEED).map_err(|e| format!("write pillars: {e}"))?;
    Ok(())
}

pub fn read_pillars(workspace: &str) -> Result<String, String> {
    ensure_pillars_file(workspace)?;
    let path = pillars_path(workspace);
    fs::read_to_string(&path).or_else(|_| Ok(String::new()))
}

pub fn watch_pillars<F>(workspace: &str, on_change: F) -> Result<WatcherHandle, String>
where
    F: Fn() + Send + 'static,
{
    let path = pillars_path(workspace);
    let dir = path.parent().ok_or("no parent dir")?.to_path_buf();
    let target = path.clone();
    let (tx, rx) = mpsc::channel::<notify::Result<Event>>();
    let mut watcher: RecommendedWatcher =
        notify::recommended_watcher(tx).map_err(|e| format!("watcher: {e}"))?;
    watcher
        .watch(&dir, RecursiveMode::NonRecursive)
        .map_err(|e| format!("watch dir: {e}"))?;

    std::thread::spawn(move || {
        let mut last_fire = Instant::now() - Duration::from_secs(1);
        while let Ok(event) = rx.recv() {
            if let Ok(event) = event {
                let matched = event.paths.iter().any(|p| p == &target);
                if !matched {
                    continue;
                }
                let is_change = matches!(
                    event.kind,
                    EventKind::Modify(_) | EventKind::Create(_) | EventKind::Remove(_)
                );
                if !is_change {
                    continue;
                }
                if last_fire.elapsed() < Duration::from_millis(200) {
                    continue;
                }
                last_fire = Instant::now();
                on_change();
            }
        }
    });

    Ok(WatcherHandle { _watcher: watcher })
}

const SEED: &str = r#"# Design Pillars

These do not drift. Edit rarely.

## 1. Personal, not product
We're building for one user. No multi-user, auth, telemetry, sharing, marketplace.
*Violation looks like:* features that only make sense at scale; "what if users want X."

## 2. Compact over verbose
Agent responses collapse to summary cards by default. Raw output stays one click away.
*Violation looks like:* full CLI dumps as primary content; multi-paragraph default renders.

## 3. Both agents visible simultaneously
Claude + Codex usable in the same window without screen-splitting fatigue.
*Violation looks like:* side-by-side panels that take half the screen each.

## 4. Spec to queue to execution
Work flows from spec into a hierarchical queue. Chat is the execution log, not the task list.
*Violation looks like:* ad-hoc work bypassing the queue; queue treated as decoration.

## 5. Vault for strategy, repo for tactics
Long-term goals and canon live in obsidian-vault. Concrete specs and queue live in the repo.
*Violation looks like:* design canon committed to the game repo; tactical TODOs in the vault.

## 6. Inherit Terax polish
Lair components match Terax's design system (shadcn, AI Elements, theme tokens). No raw select elements, no untokened colors, no hand-rolled chrome.
*Violation looks like:* native form elements, hardcoded hex, custom buttons that don't use shadcn primitives.

## 7. Caveman narration
Haiku narrations and summary cards drop articles and filler. Short fragments. Code stays normal.
*Violation looks like:* "Great! I'll help you with that..." style padding in agent surfaces.
"#;

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;
    use tempfile::TempDir;

    fn temp_workspace() -> TempDir {
        TempDir::new().expect("temp dir")
    }

    #[test]
    fn ensure_creates_file_when_missing() {
        let tmp = temp_workspace();
        ensure_pillars_file(tmp.path().to_str().unwrap()).expect("ok");
        let path = Path::new(tmp.path()).join(".lair").join("pillars.md");
        assert!(path.exists());
        let contents = fs::read_to_string(&path).unwrap();
        assert!(contents.contains("# Design Pillars"));
    }

    #[test]
    fn ensure_idempotent_when_present() {
        let tmp = temp_workspace();
        ensure_pillars_file(tmp.path().to_str().unwrap()).expect("first");
        let path = Path::new(tmp.path()).join(".lair").join("pillars.md");
        fs::write(&path, "# Custom Pillars\n").unwrap();
        ensure_pillars_file(tmp.path().to_str().unwrap()).expect("second");
        let contents = fs::read_to_string(&path).unwrap();
        assert_eq!(contents, "# Custom Pillars\n");
    }

    #[test]
    fn read_returns_full_content() {
        let tmp = temp_workspace();
        ensure_pillars_file(tmp.path().to_str().unwrap()).expect("seed");
        let text = read_pillars(tmp.path().to_str().unwrap()).expect("read");
        assert!(text.contains("Design Pillars"));
    }

    #[test]
    fn read_missing_file_creates_then_returns_seed() {
        let tmp = temp_workspace();
        let text = read_pillars(tmp.path().to_str().unwrap()).expect("read");
        assert!(text.contains("Design Pillars"));
    }
}
