use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;

const DEFAULT_SCAFFOLD: &str = "## Now\n\n## Next\n\n## Later\n\n## Done\n";

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Item {
    pub text: String,
    pub checked: bool,
    pub line: usize,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ChecklistData {
    pub now: Vec<Item>,
    pub next: Vec<Item>,
    pub later: Vec<Item>,
    pub done: Vec<Item>,
}

#[derive(serde::Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Section {
    Now,
    Next,
    Later,
    Done,
}

pub struct ChecklistWatcher(pub Mutex<Option<RecommendedWatcher>>);

impl Default for ChecklistWatcher {
    fn default() -> Self {
        Self(Mutex::new(None))
    }
}

fn checklist_path(workspace: &str) -> PathBuf {
    Path::new(workspace).join(".lair").join("checklist.md")
}

pub fn read_checklist(workspace: &str) -> Result<ChecklistData, String> {
    let path = checklist_path(workspace);
    let raw = if path.exists() {
        std::fs::read_to_string(&path).map_err(|e| format!("read checklist: {e}"))?
    } else {
        DEFAULT_SCAFFOLD.to_string()
    };
    Ok(parse_checklist(&raw))
}

pub fn append_item(workspace: &str, section: &Section, text: &str) -> Result<(), String> {
    let path = checklist_path(workspace);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("mkdir .lair: {e}"))?;
    }
    let raw = if path.exists() {
        std::fs::read_to_string(&path).map_err(|e| format!("read: {e}"))?
    } else {
        DEFAULT_SCAFFOLD.to_string()
    };
    let updated = insert_item(&raw, section, text);
    std::fs::write(&path, &updated).map_err(|e| format!("write: {e}"))
}

pub fn delete_item(workspace: &str, line_idx: usize) -> Result<(), String> {
    let path = checklist_path(workspace);
    let raw = std::fs::read_to_string(&path).map_err(|e| format!("read: {e}"))?;
    let trailing_nl = raw.ends_with('\n');
    let lines: Vec<&str> = raw.lines().collect();
    if line_idx >= lines.len() {
        return Err(format!("line {line_idx} out of range ({})", lines.len()));
    }
    if parse_item(lines[line_idx].trim(), line_idx).is_none() {
        return Err(format!("line {line_idx} is not a checklist item"));
    }
    let mut kept: Vec<String> = Vec::with_capacity(lines.len() - 1);
    for (i, l) in lines.iter().enumerate() {
        if i != line_idx {
            kept.push((*l).to_string());
        }
    }
    let updated = kept.join("\n") + if trailing_nl { "\n" } else { "" };
    std::fs::write(&path, updated).map_err(|e| format!("write: {e}"))
}

pub fn toggle_item(workspace: &str, line_idx: usize) -> Result<(), String> {
    let path = checklist_path(workspace);
    let raw = std::fs::read_to_string(&path).map_err(|e| format!("read: {e}"))?;
    let lines: Vec<&str> = raw.lines().collect();
    if line_idx >= lines.len() {
        return Err(format!("line {line_idx} out of range ({})", lines.len()));
    }
    let original = lines[line_idx];
    let toggled = if original.contains("- [x]") || original.contains("- [X]") {
        original.replacen("- [x]", "- [ ]", 1).replacen("- [X]", "- [ ]", 1)
    } else if original.contains("- [ ]") {
        original.replacen("- [ ]", "- [x]", 1)
    } else {
        return Err(format!("line {line_idx} is not a checklist item"));
    };
    let mut new_lines: Vec<String> = lines.iter().map(|s| s.to_string()).collect();
    new_lines[line_idx] = toggled;
    let updated = new_lines.join("\n") + if raw.ends_with('\n') { "\n" } else { "" };
    std::fs::write(&path, updated).map_err(|e| format!("write: {e}"))
}

pub fn start_watcher<F>(workspace: &str, on_change: F) -> Result<RecommendedWatcher, String>
where
    F: Fn() + Send + Sync + 'static,
{
    let path = checklist_path(workspace);
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    // Touch the file so we can watch it even before first write
    if !path.exists() {
        let _ = std::fs::write(&path, DEFAULT_SCAFFOLD);
    }

    let last_fire = Arc::new(Mutex::new(std::time::Instant::now() - Duration::from_secs(10)));
    let on_change = Arc::new(on_change);

    let mut watcher = notify::recommended_watcher(move |res: notify::Result<Event>| {
        if let Ok(event) = res {
            if matches!(
                event.kind,
                EventKind::Modify(_) | EventKind::Create(_) | EventKind::Remove(_)
            ) {
                let mut last = last_fire.lock().unwrap();
                if last.elapsed() >= Duration::from_millis(100) {
                    *last = std::time::Instant::now();
                    on_change();
                }
            }
        }
    })
    .map_err(|e| format!("watcher init: {e}"))?;

    let watch_dir = path.parent().unwrap_or(&path);
    watcher
        .watch(watch_dir, RecursiveMode::NonRecursive)
        .map_err(|e| format!("watcher watch: {e}"))?;

    Ok(watcher)
}

// ---- parsing helpers ----

#[derive(PartialEq)]
enum CurrentSection { None, Now, Next, Later, Done }

fn parse_checklist(raw: &str) -> ChecklistData {
    let mut now = Vec::new();
    let mut next = Vec::new();
    let mut later = Vec::new();
    let mut done = Vec::new();
    let mut current = CurrentSection::None;

    for (idx, line) in raw.lines().enumerate() {
        let trimmed = line.trim();
        match trimmed {
            "## Now" => current = CurrentSection::Now,
            "## Next" => current = CurrentSection::Next,
            "## Later" => current = CurrentSection::Later,
            "## Done" => current = CurrentSection::Done,
            _ => {
                if let Some(item) = parse_item(trimmed, idx) {
                    match current {
                        CurrentSection::Now => now.push(item),
                        CurrentSection::Next => next.push(item),
                        CurrentSection::Later => later.push(item),
                        CurrentSection::Done => done.push(item),
                        CurrentSection::None => {}
                    }
                }
            }
        }
    }
    ChecklistData { now, next, later, done }
}

fn parse_item(line: &str, idx: usize) -> Option<Item> {
    if line.starts_with("- [ ]") || line.starts_with("- [x]") || line.starts_with("- [X]") {
        let checked = line.starts_with("- [x]") || line.starts_with("- [X]");
        let text = line[5..].trim().to_string();
        Some(Item { text, checked, line: idx })
    } else {
        None
    }
}

fn section_header(section: &Section) -> &'static str {
    match section {
        Section::Now => "## Now",
        Section::Next => "## Next",
        Section::Later => "## Later",
        Section::Done => "## Done",
    }
}

fn insert_item(raw: &str, section: &Section, text: &str) -> String {
    let header = section_header(section);
    let new_item = format!("- [ ] {text}");

    if let Some(pos) = raw.find(header) {
        let after_header = pos + header.len();
        // Find where the next section starts (or end of string)
        let next_section_pos = raw[after_header..]
            .find("\n## ")
            .map(|p| after_header + p)
            .unwrap_or(raw.len());
        let insert_at = after_header + raw[after_header..next_section_pos].trim_end().len();
        format!("{}\n{}\n{}", &raw[..insert_at], new_item, &raw[insert_at..])
    } else {
        // Section missing, append at end
        format!("{}\n{header}\n{new_item}\n", raw.trim_end())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = "\
## Now
- [ ] fix login bug
- [x] update deps

## Next
- [ ] add dark mode

## Later

## Done
- [x] init project
";

    #[test]
    fn round_trip_parse() {
        let data = parse_checklist(SAMPLE);
        assert_eq!(data.now.len(), 2);
        assert!(!data.now[0].checked);
        assert!(data.now[1].checked);
        assert_eq!(data.next.len(), 1);
        assert_eq!(data.later.len(), 0);
        assert_eq!(data.done.len(), 1);
    }

    #[test]
    fn insert_into_now() {
        let updated = insert_item(SAMPLE, &Section::Now, "new task");
        let data = parse_checklist(&updated);
        assert!(data.now.iter().any(|i| i.text == "new task"));
    }

    #[test]
    fn delete_removes_correct_line() {
        let tmp = tempfile::tempdir().unwrap();
        let ws = tmp.path().to_str().unwrap();
        std::fs::create_dir_all(tmp.path().join(".lair")).unwrap();
        std::fs::write(tmp.path().join(".lair/checklist.md"), SAMPLE).unwrap();

        // Find the "fix login bug" line (it's at index 1 in SAMPLE)
        let before = read_checklist(ws).unwrap();
        let target = before
            .now
            .iter()
            .find(|i| i.text == "fix login bug")
            .unwrap()
            .clone();

        delete_item(ws, target.line).unwrap();

        let after = read_checklist(ws).unwrap();
        assert!(!after.now.iter().any(|i| i.text == "fix login bug"));
        // "update deps" remains
        assert!(after.now.iter().any(|i| i.text == "update deps"));
    }

    #[test]
    fn delete_rejects_non_item_line() {
        let tmp = tempfile::tempdir().unwrap();
        let ws = tmp.path().to_str().unwrap();
        std::fs::create_dir_all(tmp.path().join(".lair")).unwrap();
        std::fs::write(tmp.path().join(".lair/checklist.md"), SAMPLE).unwrap();
        // line 0 is "## Now"
        assert!(delete_item(ws, 0).is_err());
    }

    #[test]
    fn scaffold_on_empty() {
        let data = parse_checklist(DEFAULT_SCAFFOLD);
        assert_eq!(data.now.len(), 0);
        assert_eq!(data.next.len(), 0);
    }
}
