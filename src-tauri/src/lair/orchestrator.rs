use crate::lair::cli_agent::{run_agent_streaming, AgentSpawnRequest};
use crate::lair::keychain::get_openrouter_key;
use crate::lair::parser_client::{
    route_agent, summarize_output, RouteRequest, RouteResult, SummarizeRequest,
};
use crate::lair::types::*;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

pub struct LairConfig {
    pub openrouter_model: String,
}

#[tauri::command]
pub async fn lair_send_message(
    app: AppHandle,
    config: State<'_, Arc<LairConfig>>,
    req: SendMessageRequest,
) -> Result<Vec<String>, String> {
    let config = config.inner().clone();
    let mut ids = Vec::new();
    match req.agent_choice {
        AgentChoice::Claude => {
            ids.push(spawn(app, config, Agent::Claude, &req).await?);
        }
        AgentChoice::Codex => {
            ids.push(spawn(app, config, Agent::Codex, &req).await?);
        }
        AgentChoice::Compare => {
            let claude = spawn(app.clone(), config.clone(), Agent::Claude, &req);
            let codex = spawn(app, config, Agent::Codex, &req);
            let (claude_id, codex_id) = tokio::join!(claude, codex);
            ids.push(claude_id?);
            ids.push(codex_id?);
        }
        AgentChoice::Auto => {
            let api_key = get_openrouter_key().unwrap_or_default();
            let route = route_agent(RouteRequest {
                prompt: req.prompt.clone(),
                phase: phase_key(&req.phase),
                api_key,
                model: config.openrouter_model.clone(),
            })
            .await
            .unwrap_or(RouteResult {
                agent: "claude".into(),
                reason: "fallback".into(),
            });
            let agent = if route.agent == "codex" {
                Agent::Codex
            } else {
                Agent::Claude
            };
            ids.push(spawn(app, config, agent, &req).await?);
        }
    }
    Ok(ids)
}

async fn spawn(
    app: AppHandle,
    config: Arc<LairConfig>,
    agent: Agent,
    req: &SendMessageRequest,
) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();

    let _ = app.emit(
        "lair-card-update",
        CardUpdateEvent {
            card: CardData {
                id: id.clone(),
                agent: agent.clone(),
                status: CardStatus::Streaming,
                raw_output: String::new(),
                summary: None,
                outcome: None,
                error: None,
            },
        },
    );

    let buf = Arc::new(std::sync::Mutex::new(String::new()));
    let buf_c = buf.clone();
    let app_c = app.clone();
    let id_c = id.clone();
    let phase_str = phase_key(&req.phase);
    let phase_prefix = format!("[phase: {phase_str}]");

    let exit = run_agent_streaming(
        AgentSpawnRequest {
            agent: agent.clone(),
            prompt: req.prompt.clone(),
            phase_prefix,
            cwd: req.workspace.clone(),
            program_override: None,
            args_override: None,
        },
        move |chunk| {
            buf_c.lock().unwrap().push_str(&chunk);
            let _ = app_c.emit(
                "lair-stream-chunk",
                StreamChunkEvent {
                    card_id: id_c.clone(),
                    chunk,
                },
            );
        },
    )
    .await;

    let raw = buf.lock().unwrap().clone();

    let _ = app.emit(
        "lair-card-update",
        CardUpdateEvent {
            card: CardData {
                id: id.clone(),
                agent: agent.clone(),
                status: CardStatus::Summarizing,
                raw_output: raw.clone(),
                summary: None,
                outcome: None,
                error: None,
            },
        },
    );

    let (status, summary, outcome, error) = match exit {
        Ok(0) => {
            let sum = match get_openrouter_key() {
                Ok(api_key) => summarize_output(SummarizeRequest {
                    agent: agent_key(&agent),
                    raw_output: raw.clone(),
                    phase: phase_key(&req.phase),
                    api_key,
                    model: config.openrouter_model.clone(),
                })
                .await,
                Err(e) => Err(e),
            };
            match sum {
                Ok(s) => (CardStatus::Done, Some(s.summary), Some(s.outcome), None),
                Err(e) => (
                    CardStatus::Done,
                    None,
                    None,
                    Some(format!("summarizer: {e}")),
                ),
            }
        }
        Ok(code) => (CardStatus::Failed, None, None, Some(format!("exit {code}"))),
        Err(e) => (CardStatus::Failed, None, None, Some(e)),
    };

    let _ = app.emit(
        "lair-card-update",
        CardUpdateEvent {
            card: CardData {
                id: id.clone(),
                agent,
                status,
                raw_output: raw,
                summary,
                outcome,
                error,
            },
        },
    );

    Ok(id)
}

fn agent_key(agent: &Agent) -> String {
    match agent {
        Agent::Claude => "claude",
        Agent::Codex => "codex",
    }
    .to_string()
}

fn phase_key(phase: &Phase) -> String {
    match phase {
        Phase::Brainstorm => "brainstorm",
        Phase::Plan => "plan",
        Phase::Implement => "implement",
        Phase::Refactor => "refactor",
        Phase::Test => "test",
        Phase::Review => "review",
    }
    .to_string()
}
