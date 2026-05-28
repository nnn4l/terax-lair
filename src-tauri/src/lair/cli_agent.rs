use crate::lair::types::Lane;
use std::path::Path;
use std::process::Stdio;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::time::timeout;

pub const DEFAULT_AGENT_TIMEOUT: Duration = Duration::from_secs(300);

pub struct AgentSpawnRequest {
    pub lane: Lane,
    pub prompt: String,
    pub system_prompt: String,
    pub model_override: Option<String>,
    pub effort_override: Option<String>,
    pub cwd: String,
    pub card_id: String,
    pub program_override: Option<String>,
    pub args_override: Option<Vec<String>>,
}

struct Resolved {
    program: String,
    prefix_args: Vec<String>,
}

pub async fn run_agent_streaming<F>(
    req: AgentSpawnRequest,
    on_chunk: F,
) -> Result<i32, String>
where
    F: FnMut(String) + Send + 'static,
{
    run_agent_streaming_with_timeout(req, on_chunk, DEFAULT_AGENT_TIMEOUT).await
}

pub async fn run_agent_streaming_with_timeout<F>(
    req: AgentSpawnRequest,
    mut on_chunk: F,
    wall_clock: Duration,
) -> Result<i32, String>
where
    F: FnMut(String) + Send + 'static,
{
    let (program, args) = match (req.program_override.clone(), req.args_override.clone()) {
        (Some(p), Some(a)) => (p, a),
        _ => build_command(&req.lane, &req.prompt, &req.system_prompt, &req.model_override, &req.effort_override),
    };

    let mut cmd = Command::new(&program);
    cmd.args(&args)
        .current_dir(&req.cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    for (k, v) in &req.lane.env {
        cmd.env(k, v);
    }
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("spawn {program}: {e}"))?;
    if let Some(pid) = child.id() {
        crate::lair::process_registry::PROCESS_REGISTRY.register(req.card_id.clone(), pid);
    }

    let stdout = child.stdout.take().ok_or("no stdout")?;
    let stderr = child.stderr.take().ok_or("no stderr")?;
    let mut out_reader = BufReader::new(stdout).lines();
    let mut err_reader = BufReader::new(stderr).lines();
    let mut out_done = false;
    let mut err_done = false;

    let drain = async {
        while !out_done || !err_done {
            tokio::select! {
                line = out_reader.next_line(), if !out_done => match line {
                    Ok(Some(l)) => on_chunk(format!("{l}\n")),
                    Ok(None) => out_done = true,
                    Err(e) => return Err(format!("stdout read: {e}")),
                },
                line = err_reader.next_line(), if !err_done => match line {
                    Ok(Some(l)) => on_chunk(format!("[stderr] {l}\n")),
                    Ok(None) => err_done = true,
                    Err(e) => return Err(format!("stderr read: {e}")),
                },
            }
        }
        Ok::<(), String>(())
    };

    let drain_result = match timeout(wall_clock, drain).await {
        Ok(inner) => inner,
        Err(_) => {
            let _ = child.start_kill();
            crate::lair::process_registry::PROCESS_REGISTRY.deregister(&req.card_id);
            return Err(format!("timeout after {}s", wall_clock.as_secs()));
        }
    };
    drain_result?;

    let status = timeout(Duration::from_secs(2), child.wait())
        .await
        .map_err(|_| "wait timeout".to_string())?
        .map_err(|e| format!("wait: {e}"))?;
    crate::lair::process_registry::PROCESS_REGISTRY.deregister(&req.card_id);
    Ok(status.code().unwrap_or(-1))
}

fn build_command(
    lane: &Lane,
    prompt: &str,
    system_prompt: &str,
    model: &Option<String>,
    effort: &Option<String>,
) -> (String, Vec<String>) {
    let effective_model = model.clone().or_else(|| lane.default_model.clone());
    let effective_effort = effort.clone().or_else(|| lane.default_effort.clone());
    let (program, args) = match lane.cli.as_str() {
        "claude" => build_claude(prompt, system_prompt, &effective_model, &effective_effort),
        "codex" => build_codex(prompt, system_prompt, &effective_model, &effective_effort),
        "pi" => build_pi(&lane.id, prompt, system_prompt, &effective_model, &effective_effort),
        other => (other.to_string(), vec![prompt.to_string()]),
    };
    let resolved = resolve_program(&program);
    let mut full_args = resolved.prefix_args;
    full_args.extend(args);
    (resolved.program, full_args)
}

fn build_pi(
    lane_id: &str,
    prompt: &str,
    system_prompt: &str,
    model: &Option<String>,
    effort: &Option<String>,
) -> (String, Vec<String>) {
    let mut args = vec![
        "--mode".to_string(),
        "json".to_string(),
        "--session-id".to_string(),
        format!("lair-{lane_id}"),
        "--session-dir".to_string(),
        ".lair/pi-sessions".to_string(),
    ];
    if let Some(m) = model {
        if m != "auto" {
            args.push("--model".to_string());
            args.push(m.clone());
        }
    }
    if let Some(e) = effort {
        args.push("--thinking".to_string());
        args.push(e.clone());
    }
    if !system_prompt.is_empty() {
        args.push("--append-system-prompt".to_string());
        args.push(system_prompt.to_string());
    }
    args.push("-p".to_string());
    args.push(prompt.to_string());
    ("pi".to_string(), args)
}

fn build_claude(
    prompt: &str,
    system_prompt: &str,
    model: &Option<String>,
    effort: &Option<String>,
) -> (String, Vec<String>) {
    let mut args = vec!["--print".to_string()];
    if let Some(m) = model {
        args.push("--model".to_string());
        args.push(m.clone());
    }
    // Claude CLI: --effort low|medium|high|xhigh|max
    if let Some(e) = effort {
        args.push("--effort".to_string());
        args.push(e.clone());
    }
    if !system_prompt.is_empty() {
        args.push("--append-system-prompt".to_string());
        args.push(system_prompt.to_string());
    }
    args.push(prompt.to_string());
    ("claude".to_string(), args)
}

fn build_codex(
    prompt: &str,
    system_prompt: &str,
    model: &Option<String>,
    effort: &Option<String>,
) -> (String, Vec<String>) {
    let mut args = vec!["exec".to_string(), "--skip-git-repo-check".to_string()];
    if let Some(m) = model {
        args.push("-m".to_string());
        args.push(m.clone());
    }
    // Codex CLI: no dedicated reasoning flag; passed via config override.
    if let Some(e) = effort {
        args.push("-c".to_string());
        args.push(format!("model_reasoning_effort={e}"));
    }
    // Codex has no system-prompt flag; prepend on a single line. Newlines in
    // args break .cmd shims (CMD.EXE batch parser splits on them), so even
    // after shim-bypass we keep this collapsed for resilience.
    let full_prompt = if system_prompt.is_empty() {
        prompt.to_string()
    } else {
        format!("[System: {system_prompt}] {prompt}")
    };
    args.push(full_prompt);
    ("codex".to_string(), args)
}

/// On Windows, CreateProcess only finds `.exe` by default; npm-installed CLIs
/// (codex, etc.) ship `.cmd` shims that won't resolve without an explicit
/// extension. Worse, `.cmd` shims pipe args through CMD.EXE which mangles
/// multi-line strings. So when we find a `.cmd` shim, peek inside to recover
/// the underlying node script and spawn node.exe directly.
#[cfg(windows)]
fn resolve_program(name: &str) -> Resolved {
    if name.contains('\\') || name.contains('/') {
        return Resolved { program: name.to_string(), prefix_args: Vec::new() };
    }
    let Ok(path) = std::env::var("PATH") else {
        return Resolved { program: name.to_string(), prefix_args: Vec::new() };
    };
    // Prefer .exe (CreateProcess-friendly); fall back to .cmd (npm shim).
    for dir in path.split(';').filter(|d| !d.is_empty()) {
        for ext in &[".exe", ".cmd", ".bat"] {
            let candidate = Path::new(dir).join(format!("{name}{ext}"));
            if !candidate.is_file() { continue; }
            if *ext == ".cmd" || *ext == ".bat" {
                if let Some(unwrapped) = unwrap_npm_shim(&candidate) {
                    return unwrapped;
                }
            }
            return Resolved {
                program: candidate.to_string_lossy().into_owned(),
                prefix_args: Vec::new(),
            };
        }
    }
    Resolved { program: name.to_string(), prefix_args: Vec::new() }
}

#[cfg(not(windows))]
fn resolve_program(name: &str) -> Resolved {
    Resolved { program: name.to_string(), prefix_args: Vec::new() }
}

/// Parse an npm-cmd-shim to extract `(node_path, script_path)` so we can
/// spawn node.exe directly and skip CMD.EXE argv mangling entirely.
#[cfg(windows)]
fn unwrap_npm_shim(cmd_path: &Path) -> Option<Resolved> {
    let content = std::fs::read_to_string(cmd_path).ok()?;
    let dp0 = cmd_path.parent()?.to_string_lossy().to_string();
    for line in content.lines() {
        let line = line.trim();
        // Target line ends with %* or %*" and contains two quoted paths:
        //   the node binary and the .js script.
        if !line.contains("%*") { continue; }
        if !line.contains(".js") && !line.contains(".mjs") { continue; }
        let quoted = collect_quoted(line);
        if quoted.len() < 2 { continue; }
        let script = expand_dp0(&quoted[quoted.len() - 1], &dp0);
        if !script.to_lowercase().ends_with(".js") && !script.to_lowercase().ends_with(".mjs") {
            continue;
        }
        let prog_candidate = expand_dp0(&quoted[0], &dp0);
        let program = if prog_candidate.to_lowercase().contains("node") && Path::new(&prog_candidate).is_file() {
            prog_candidate
        } else {
            "node.exe".to_string()
        };
        return Some(Resolved { program, prefix_args: vec![script] });
    }
    None
}

#[cfg(windows)]
fn collect_quoted(s: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c != '"' { continue; }
        let mut buf = String::new();
        for ch in chars.by_ref() {
            if ch == '"' { break; }
            buf.push(ch);
        }
        out.push(buf);
    }
    out
}

#[cfg(windows)]
fn expand_dp0(s: &str, dp0: &str) -> String {
    s.replace("%~dp0", dp0)
        .replace("%dp0%", dp0)
        .trim_end_matches('\\')
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codex_exec_skips_git_repo_check_for_workspace_roots() {
        let (_program, args) = build_codex("prompt", "", &None, &None);

        assert_eq!(args[0], "exec");
        assert!(args.iter().any(|arg| arg == "--skip-git-repo-check"));
    }

    #[test]
    fn pi_harness_uses_json_print_session_and_system_prompt() {
        use crate::lair::types::{CostTier, LaneRole};
        use std::collections::HashMap;

        let lane = Lane {
            id: "pi-implementor".into(),
            label: "Pi Implementor".into(),
            cli: "pi".into(),
            env: HashMap::new(),
            default_model: Some("openai/gpt-4o".into()),
            default_effort: Some("medium".into()),
            role: LaneRole::Implementor,
            cost_tier: CostTier::Cheap,
            clear_required: false,
            backend: Some("pi".into()),
            auto_bias: vec![],
            enabled: true,
            context_window: None,
        };

        let (_program, args) = build_command(
            &lane,
            "do the task",
            "system rules",
            &None,
            &None,
        );

        assert!(args.windows(2).any(|w| w == ["--mode", "json"]));
        assert!(args.windows(2).any(|w| w == ["--model", "openai/gpt-4o"]));
        assert!(args.windows(2).any(|w| w == ["--thinking", "medium"]));
        assert!(args.iter().any(|arg| arg == "--session-id"));
        assert!(args.iter().any(|arg| arg == "--session-dir"));
        assert!(args.windows(2).any(|w| w == ["-p", "do the task"]));
        assert!(args.windows(2).any(|w| w == ["--append-system-prompt", "system rules"]));
    }

    #[tokio::test]
    async fn stall_timeout_aborts_long_running_process() {
        use crate::lair::types::{CostTier, LaneRole};
        use std::collections::HashMap;
        use std::time::Duration;

        fn mk_lane(id: &str) -> Lane {
            Lane {
                id: id.into(),
                label: id.into(),
                cli: "claude".into(),
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

        let req = AgentSpawnRequest {
            lane: mk_lane("test"),
            prompt: "x".into(),
            system_prompt: String::new(),
            model_override: None,
            effort_override: None,
            cwd: ".".into(),
            card_id: "card-stall-test".into(),
            program_override: Some(if cfg!(windows) { "powershell".into() } else { "sh".into() }),
            args_override: Some(if cfg!(windows) {
                vec![
                    "-NoProfile".into(),
                    "-Command".into(),
                    "Start-Sleep -Seconds 60".into(),
                ]
            } else {
                vec!["-c".into(), "sleep 60".into()]
            }),
        };
        let result = run_agent_streaming_with_timeout(req, |_| {}, Duration::from_millis(300)).await;
        assert!(matches!(result, Err(e) if e.contains("timeout")));
    }
}
