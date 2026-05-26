use crate::lair::orchestrator::LairConfig;
use crate::lair::parser_client::diff_spec_sections;
use crate::lair::spec_import::section_hashes;
use crate::lair::types::{QueueItem, StaleReport};
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::HashMap;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

pub struct WatcherHandle {
    _watcher: RecommendedWatcher,
}

pub fn watch_specs(
    spec_files: Vec<String>,
    on_change: impl Fn(String) + Send + Sync + 'static,
) -> Result<WatcherHandle, String> {
    let last = Arc::new(Mutex::new(HashMap::<String, Instant>::new()));
    let on_change = Arc::new(on_change);
    let mut watcher = notify::recommended_watcher({
        let last = last.clone();
        let on_change = on_change.clone();
        move |res: notify::Result<Event>| {
            let Ok(event) = res else { return };
            if !matches!(
                event.kind,
                EventKind::Modify(_) | EventKind::Create(_) | EventKind::Remove(_)
            ) {
                return;
            }
            for path in event.paths {
                let path = path.to_string_lossy().replace('\\', "/");
                let now = Instant::now();
                let mut guard = last.lock().unwrap();
                let should_skip = guard
                    .get(&path)
                    .map(|then| now.duration_since(*then) < Duration::from_millis(500))
                    .unwrap_or(false);
                if should_skip {
                    continue;
                }
                guard.insert(path.clone(), now);
                on_change(path);
            }
        }
    })
    .map_err(|e| format!("watcher init: {e}"))?;

    for file in &spec_files {
        watcher
            .watch(Path::new(file), RecursiveMode::NonRecursive)
            .map_err(|e| format!("watch {file}: {e}"))?;
    }

    Ok(WatcherHandle { _watcher: watcher })
}

pub async fn check_stale(
    queue: &[QueueItem],
    cfg: &LairConfig,
) -> Result<Vec<StaleReport>, String> {
    let mut file_map: HashMap<String, Vec<(String, String, String)>> = HashMap::new();
    collect_sources(queue, &mut file_map);

    let mut reports = Vec::new();
    for (file, entries) in file_map {
        let current = match std::fs::read_to_string(&file) {
            Ok(content) => content,
            Err(_) => {
                for (item_id, anchor, _) in entries {
                    reports.push(StaleReport {
                        item_id,
                        spec_section: anchor,
                        diff_summary: "source spec file is missing".to_string(),
                    });
                }
                continue;
            }
        };
        let hashes = section_hashes(&current);
        for (item_id, anchor, stored_hash) in entries {
            let current_hash = hashes.get(&anchor).cloned().unwrap_or_default();
            if current_hash == stored_hash {
                continue;
            }
            let section_text = extract_section(&current, &anchor);
            let diffs = diff_spec_sections("(previous version unavailable)", &section_text, cfg)
                .await
                .unwrap_or_default();
            let diff_summary = diffs
                .first()
                .map(|diff| diff.summary.clone())
                .unwrap_or_else(|| "section content changed".to_string());
            reports.push(StaleReport {
                item_id,
                spec_section: anchor,
                diff_summary,
            });
        }
    }
    Ok(reports)
}

fn collect_sources(
    items: &[QueueItem],
    map: &mut HashMap<String, Vec<(String, String, String)>>,
) {
    for item in items {
        if let Some(source) = &item.source {
            map.entry(source.file.clone()).or_default().push((
                item.id.clone(),
                source.anchor.clone(),
                source.hash.clone(),
            ));
        }
        collect_sources(&item.children, map);
    }
}

fn extract_section(content: &str, heading: &str) -> String {
    let mut in_section = false;
    let mut result = String::new();
    for line in content.lines() {
        if line == heading {
            in_section = true;
            continue;
        }
        if in_section {
            if line.starts_with("## ") {
                break;
            }
            result.push_str(line);
            result.push('\n');
        }
    }
    result
}
