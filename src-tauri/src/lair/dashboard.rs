use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BriefingData {
    pub time: Option<String>,
    pub date_label: Option<String>,
    pub weather: Option<WeatherData>,
    pub priorities: Vec<String>,
    pub now: Option<NowData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeatherData {
    pub temp_f: i32,
    pub condition: String,
    pub location: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NowData {
    pub workspace: String,
    pub queue_done: u32,
    pub queue_total: u32,
    pub last_touched_min: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AmbientData {
    pub uningested_count: u32,
    pub wiki_edits_today: u32,
    pub log_entries_pending: u32,
}

#[tauri::command]
pub fn lair_dashboard_briefing() -> Result<BriefingData, String> {
    let home = dirs::home_dir().ok_or_else(|| "no home dir".to_string())?;
    let vault = vault_dir(&home);
    let script = vault.join("scripts").join("plan_data.py");
    if !script.exists() {
        return Ok(BriefingData::default());
    }

    let output = Command::new("python")
        .arg(&script)
        .output()
        .map_err(|e| format!("python: {e}"))?;
    if !output.status.success() {
        return Ok(BriefingData::default());
    }

    let text = String::from_utf8_lossy(&output.stdout);
    let parsed: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| format!("parse plan json: {e}"))?;
    let mut priorities: Vec<String> = parsed
        .get("priorities")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|x| x.as_str().map(String::from)).collect())
        .unwrap_or_default();
    if priorities.is_empty() {
        let today = parsed.get("today").and_then(|v| v.as_str());
        priorities = parse_priorities_from_daily_plan(&vault, today);
    }

    Ok(BriefingData {
        time: parsed
            .get("time")
            .or_else(|| parsed.get("current_time"))
            .and_then(|v| v.as_str())
            .map(String::from),
        date_label: parsed
            .get("date_label")
            .and_then(|v| v.as_str())
            .map(String::from)
            .or_else(|| {
                let day = parsed.get("day_of_week")?.as_str()?;
                let today = parsed.get("today")?.as_str()?;
                Some(format!("{day}, {today}"))
            }),
        weather: parsed.get("weather").and_then(parse_weather),
        priorities,
        now: None,
    })
}

#[tauri::command]
pub fn lair_dashboard_ambient() -> Result<AmbientData, String> {
    let home = dirs::home_dir().ok_or_else(|| "no home dir".to_string())?;
    let raw_dir = vault_dir(&home).join("raw");
    let mut uningested_count = 0u32;
    if let Ok(entries) = std::fs::read_dir(&raw_dir) {
        uningested_count = entries.filter_map(|entry| entry.ok()).count() as u32;
    }
    Ok(AmbientData {
        uningested_count,
        wiki_edits_today: 0,
        log_entries_pending: 0,
    })
}

fn vault_dir(home: &std::path::Path) -> PathBuf {
    let repo = home.join("Documents").join("GitHub").join("obsidian-vault");
    if repo.exists() {
        repo
    } else {
        home.join("obsidian-vault")
    }
}

fn parse_priorities_from_daily_plan(vault: &std::path::Path, today: Option<&str>) -> Vec<String> {
    let plan_dir = vault.join("output").join("daily-plans");
    let path = today
        .map(|date| plan_dir.join(format!("{date}.md")))
        .filter(|path| path.exists())
        .or_else(|| newest_markdown_file(&plan_dir));
    let Some(path) = path else {
        return Vec::new();
    };
    let Ok(text) = std::fs::read_to_string(path) else {
        return Vec::new();
    };
    let headings = [
        "top priorities",
        "three priorities",
        "now",
        "top 1-3 priorities",
    ];
    for heading in headings {
        if let Some(items) = extract_priority_section(&text, heading) {
            if !items.is_empty() {
                return items;
            }
        }
    }
    text.lines()
        .filter_map(parse_list_item)
        .take(3)
        .collect()
}

fn newest_markdown_file(dir: &std::path::Path) -> Option<PathBuf> {
    let mut entries: Vec<_> = std::fs::read_dir(dir)
        .ok()?
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| {
            let path = entry.path();
            if path.extension().and_then(|ext| ext.to_str()) != Some("md") {
                return None;
            }
            let modified = entry.metadata().ok()?.modified().ok()?;
            Some((modified, path))
        })
        .collect();
    entries.sort_by_key(|(modified, _)| *modified);
    entries.pop().map(|(_, path)| path)
}

fn extract_priority_section(text: &str, heading: &str) -> Option<Vec<String>> {
    let mut in_section = false;
    let mut items = Vec::new();
    for line in text.lines() {
        let trimmed = line.trim();
        if let Some(title) = trimmed.strip_prefix("##") {
            let title = title.trim().to_lowercase();
            if in_section {
                break;
            }
            in_section = title == heading;
            continue;
        }
        if in_section {
            if let Some(item) = parse_list_item(trimmed) {
                items.push(item);
                if items.len() == 3 {
                    break;
                }
            }
        }
    }
    in_section.then_some(items)
}

fn parse_list_item(line: &str) -> Option<String> {
    let trimmed = line.trim_start();
    let without_bullet = trimmed
        .strip_prefix("- ")
        .or_else(|| trimmed.strip_prefix("* "))
        .or_else(|| {
            let (head, tail) = trimmed.split_once('.')?;
            head.chars().all(|c| c.is_ascii_digit()).then_some(tail.trim_start())
        })?;
    let cleaned = without_bullet.trim().trim_start_matches("[ ] ").trim();
    (!cleaned.is_empty()).then(|| cleaned.to_string())
}

fn parse_weather(value: &serde_json::Value) -> Option<WeatherData> {
    let temp_f = value
        .get("temp_f")
        .and_then(|v| v.as_i64())
        .or_else(|| value.get("temp_f").and_then(|v| v.as_str()?.parse::<i64>().ok()))? as i32;
    let condition = value
        .get("condition")
        .or_else(|| value.get("description"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let location = value
        .get("location")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    Some(WeatherData {
        temp_f,
        condition,
        location,
    })
}
