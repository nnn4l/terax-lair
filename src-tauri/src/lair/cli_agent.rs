use crate::lair::types::Agent;
use std::path::Path;
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

pub struct AgentSpawnRequest {
    pub agent: Agent,
    pub prompt: String,
    pub system_prompt: String,
    pub model: Option<String>,
    pub effort: Option<String>,
    pub cwd: String,
    pub program_override: Option<String>,
    pub args_override: Option<Vec<String>>,
}

struct Resolved {
    program: String,
    prefix_args: Vec<String>,
}

pub async fn run_agent_streaming<F>(
    req: AgentSpawnRequest,
    mut on_chunk: F,
) -> Result<i32, String>
where
    F: FnMut(String) + Send + 'static,
{
    let (program, args) = match (req.program_override, req.args_override) {
        (Some(p), Some(a)) => (p, a),
        _ => build_command(&req.agent, &req.prompt, &req.system_prompt, &req.model, &req.effort),
    };

    let mut child = Command::new(&program)
        .args(&args)
        .current_dir(&req.cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("spawn {program}: {e}"))?;

    let stdout = child.stdout.take().ok_or("no stdout")?;
    let stderr = child.stderr.take().ok_or("no stderr")?;
    let mut out_reader = BufReader::new(stdout).lines();
    let mut err_reader = BufReader::new(stderr).lines();
    let mut out_done = false;
    let mut err_done = false;

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

    let status = child.wait().await.map_err(|e| format!("wait: {e}"))?;
    Ok(status.code().unwrap_or(-1))
}

fn build_command(
    agent: &Agent,
    prompt: &str,
    system_prompt: &str,
    model: &Option<String>,
    effort: &Option<String>,
) -> (String, Vec<String>) {
    let (program, args) = match agent {
        Agent::Claude => build_claude(prompt, system_prompt, model, effort),
        Agent::Codex => build_codex(prompt, system_prompt, model, effort),
    };
    let resolved = resolve_program(&program);
    let mut full_args = resolved.prefix_args;
    full_args.extend(args);
    (resolved.program, full_args)
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
}
