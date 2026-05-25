use crate::modules::workspace::{resolve_path, WorkspaceEnv, WorkspaceRegistry};
use serde::{Deserialize, Serialize};
use std::process::{Command, Stdio};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Worktree {
    pub path: String,
    pub branch: Option<String>,
}

#[tauri::command]
pub async fn lair_list_worktrees(
    root: String,
    workspace: Option<WorkspaceEnv>,
    app: AppHandle,
) -> Result<Vec<Worktree>, String> {
    let workspace = WorkspaceEnv::from_option(workspace);
    tauri::async_runtime::spawn_blocking(move || {
        let registry = app.state::<WorkspaceRegistry>();
        list_worktrees(&registry, &root, &workspace)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn list_worktrees(
    registry: &WorkspaceRegistry,
    root: &str,
    workspace: &WorkspaceEnv,
) -> Result<Vec<Worktree>, String> {
    let resolved = resolve_path(root, workspace);
    let canonical = registry
        .canonicalize_cached(&resolved)
        .map_err(|e| format!("workspace not accessible: {e}"))?;
    if !canonical.is_dir() {
        return Err(format!(
            "workspace is not a directory: {}",
            canonical.display()
        ));
    }
    if !registry.is_authorized(&canonical) {
        return Err(format!(
            "workspace is outside the authorized workspace: {}",
            canonical.display()
        ));
    }

    let output = run_worktree_list(root, &canonical, workspace)?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "git worktree list failed".into()
        } else {
            stderr
        });
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let worktrees = parse_worktree_porcelain(&stdout);
    for worktree in &worktrees {
        let resolved = resolve_path(&worktree.path, workspace);
        let _ = registry.authorize(&resolved);
    }
    Ok(worktrees)
}

fn run_worktree_list(
    root: &str,
    canonical: &std::path::Path,
    workspace: &WorkspaceEnv,
) -> Result<std::process::Output, String> {
    let mut cmd = build_worktree_command(root, canonical, workspace)?;
    cmd.env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_ASKPASS", "")
        .env("SSH_ASKPASS", "")
        .env("GIT_OPTIONAL_LOCKS", "0")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    crate::modules::proc::hide_console(&mut cmd);
    cmd.output().map_err(|e| format!("git: {e}"))
}

fn build_worktree_command(
    root: &str,
    canonical: &std::path::Path,
    workspace: &WorkspaceEnv,
) -> Result<Command, String> {
    #[cfg(windows)]
    if let WorkspaceEnv::Wsl { distro } = workspace {
        crate::modules::workspace::validate_wsl_distro_name(distro)?;
        let mut cmd = Command::new("wsl.exe");
        cmd.arg("-d")
            .arg(distro)
            .arg("--cd")
            .arg(root)
            .arg("--exec")
            .arg("git");
        cmd.args(["worktree", "list", "--porcelain"]);
        return Ok(cmd);
    }

    let _ = root;
    let _ = workspace;
    let mut cmd = Command::new("git");
    cmd.args(["worktree", "list", "--porcelain"]);
    cmd.current_dir(canonical);
    Ok(cmd)
}

fn parse_worktree_porcelain(text: &str) -> Vec<Worktree> {
    let mut result = Vec::new();
    let mut current: Option<Worktree> = None;

    for raw in text.lines() {
        let line = raw.trim_end_matches('\r');
        if let Some(path) = line.strip_prefix("worktree ") {
            if let Some(worktree) = current.take() {
                result.push(worktree);
            }
            current = Some(Worktree {
                path: path.to_string(),
                branch: None,
            });
            continue;
        }

        if let Some(branch) = line.strip_prefix("branch ") {
            if let Some(worktree) = current.as_mut() {
                worktree.branch = Some(branch.trim_start_matches("refs/heads/").to_string());
            }
        }
    }

    if let Some(worktree) = current {
        result.push(worktree);
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_porcelain_worktrees() {
        let input = "\
worktree C:/repo/main
HEAD 1111111111111111111111111111111111111111
branch refs/heads/main

worktree C:/repo/feature
HEAD 2222222222222222222222222222222222222222
branch refs/heads/feature/lair
";

        let parsed = parse_worktree_porcelain(input);

        assert_eq!(
            parsed,
            vec![
                Worktree {
                    path: "C:/repo/main".into(),
                    branch: Some("main".into()),
                },
                Worktree {
                    path: "C:/repo/feature".into(),
                    branch: Some("feature/lair".into()),
                },
            ]
        );
    }

    #[test]
    fn parses_detached_worktree_without_branch() {
        let input = "\
worktree C:/repo/detached
HEAD 3333333333333333333333333333333333333333
detached
";

        let parsed = parse_worktree_porcelain(input);

        assert_eq!(
            parsed,
            vec![Worktree {
                path: "C:/repo/detached".into(),
                branch: None,
            }]
        );
    }
}
