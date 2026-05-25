use crate::lair::types::Agent;
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

pub struct AgentSpawnRequest {
    pub agent: Agent,
    pub prompt: String,
    pub phase_prefix: String,
    pub cwd: String,
    pub program_override: Option<String>,
    pub args_override: Option<Vec<String>>,
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
        _ => default_command_for(&req.agent, &req.prompt, &req.phase_prefix),
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

fn default_command_for(agent: &Agent, prompt: &str, phase_prefix: &str) -> (String, Vec<String>) {
    let full = format!("{phase_prefix} {prompt}");
    match agent {
        Agent::Claude => ("claude".into(), vec!["--print".into(), full]),
        Agent::Codex => ("codex".into(), vec!["exec".into(), full]),
    }
}
