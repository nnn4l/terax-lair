use crate::lair::orchestrator::LairConfig;
use crate::lair::parser_client::compress_spec;
use crate::lair::types::{Agent, QueueItem, RawQueueNode, SpecRef};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use uuid::Uuid;

pub fn list_specs(workspace: &str) -> Result<Vec<String>, String> {
    let root = workspace.trim_end_matches(['/', '\\']);
    let patterns = [
        format!("{root}/docs/superpowers/plans/**/*.md"),
        format!("{root}/docs/plans/**/*.md"),
        format!("{root}/docs/**/*plan*.md"),
        format!("{root}/docs/**/*.md"),
    ];
    let mut paths = Vec::new();
    for pattern in patterns {
        for path in glob::glob(&pattern)
            .map_err(|e| format!("glob pattern error: {e}"))?
            .filter_map(Result::ok)
        {
            let path = path.to_string_lossy().replace('\\', "/");
            if !paths.contains(&path) {
                paths.push(path);
            }
        }
    }
    paths.sort();
    paths.sort_by_key(|path| {
        if path.contains("/docs/superpowers/plans/") {
            0
        } else if path.contains("/docs/plans/") {
            1
        } else if path.to_lowercase().contains("plan") {
            2
        } else {
            3
        }
    });
    Ok(paths)
}

pub async fn import_spec(
    _workspace: &str,
    spec_path: &str,
    cfg: &LairConfig,
) -> Result<Vec<QueueItem>, String> {
    let content = std::fs::read_to_string(spec_path)
        .map_err(|e| format!("read {spec_path}: {e}"))?;
    let hashes = section_hashes(&content);
    let nodes = compress_spec(&content, cfg).await?;
    Ok(nodes
        .into_iter()
        .map(|node| node_to_item(node, Some(spec_path), &hashes))
        .collect())
}

pub async fn import_pasted_spec(
    _workspace: &str,
    markdown: &str,
    cfg: &LairConfig,
) -> Result<Vec<QueueItem>, String> {
    let nodes = compress_spec(markdown, cfg).await?;
    Ok(nodes
        .into_iter()
        .map(|node| node_to_item(node, None, &HashMap::new()))
        .collect())
}

fn node_to_item(
    node: RawQueueNode,
    spec_file: Option<&str>,
    hashes: &HashMap<String, String>,
) -> QueueItem {
    let source = node.source_anchor.as_deref().and_then(|anchor| {
        let file = spec_file?.to_string();
        let hash = hashes.get(anchor).cloned().unwrap_or_default();
        Some(SpecRef {
            file,
            anchor: anchor.to_string(),
            hash,
        })
    });
    let agent_hint = node.agent_hint.as_deref().and_then(|hint| match hint {
        "claude" => Some(Agent::Claude),
        "codex" => Some(Agent::Codex),
        _ => None,
    });
    QueueItem {
        id: Uuid::new_v4().to_string(),
        label: node.label,
        context: node.context,
        source,
        agent_hint,
        children: node
            .children
            .into_iter()
            .map(|child| node_to_item(child, spec_file, hashes))
            .collect(),
        checked: false,
        stale: false,
    }
}

pub fn section_hashes(content: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();
    let mut current: Option<String> = None;
    let mut body = String::new();
    for line in content.lines() {
        if line.starts_with("## ") {
            if let Some(heading) = current.take() {
                map.insert(heading, format!("{:x}", Sha256::digest(body.as_bytes())));
            }
            current = Some(line.to_string());
            body.clear();
        } else if current.is_some() {
            body.push_str(line);
            body.push('\n');
        }
    }
    if let Some(heading) = current {
        map.insert(heading, format!("{:x}", Sha256::digest(body.as_bytes())));
    }
    map
}
