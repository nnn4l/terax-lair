use crate::lair::checklist::{
    append_item, delete_item, read_checklist, start_watcher, toggle_item, ChecklistData,
    ChecklistWatcher, Section,
};
use crate::lair::cli_agent::{run_agent_streaming, AgentSpawnRequest};
use crate::lair::keychain::get_openrouter_key;
use crate::lair::narrator::{narrate, NarrationTrigger};
use crate::lair::parser_client::{
    list_models, route_agent, summarize_output, ModelInfo, RouteRequest, RouteResult,
    SummarizeRequest,
};
use crate::lair::phase_prompts::system_prompt_for;
use crate::lair::types::*;
use crate::lair::usage_parser::parse_usage;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{async_runtime, AppHandle, Emitter, State};
use uuid::Uuid;

pub struct LairConfig {
    pub openrouter_model: String,
}

#[tauri::command]
pub async fn lair_send_message(
    app: AppHandle,
    config: State<'_, Arc<LairConfig>>,
    checklist_watcher: State<'_, ChecklistWatcher>,
    req: SendMessageRequest,
) -> Result<Vec<String>, String> {
    let _ = checklist_watcher; // watcher state managed separately
    let config = config.inner().clone();
    let mut ids = Vec::new();
    match req.agent_choice {
        AgentChoice::Claude => {
            emit_narration_background(
                &app,
                &config,
                NarrationTrigger::Dispatching { agent: Agent::Claude },
            );
            ids.push(spawn(app, config, Agent::Claude, &req).await?);
        }
        AgentChoice::Codex => {
            emit_narration_background(
                &app,
                &config,
                NarrationTrigger::Dispatching { agent: Agent::Codex },
            );
            ids.push(spawn(app, config, Agent::Codex, &req).await?);
        }
        AgentChoice::Compare => {
            emit_narration_background(&app, &config, NarrationTrigger::CompareLaunching);
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
            emit_narration_background(
                &app,
                &config,
                NarrationTrigger::Routing {
                    agent: agent.clone(),
                    reason: route.reason.clone(),
                },
            );
            ids.push(spawn(app, config, agent, &req).await?);
        }
    }
    Ok(ids)
}

async fn emit_narration(app: &AppHandle, config: &Arc<LairConfig>, trigger: &NarrationTrigger) {
    if let Some(text) = narrate(trigger, config).await {
        let line = NarrationLine {
            id: Uuid::new_v4().to_string(),
            text,
            timestamp_ms: now_ms(),
        };
        let _ = app.emit("lair-narration", NarrationEvent { line });
    }
}

fn emit_narration_background(app: &AppHandle, config: &Arc<LairConfig>, trigger: NarrationTrigger) {
    let app = app.clone();
    let config = config.clone();
    async_runtime::spawn(async move {
        emit_narration(&app, &config, &trigger).await;
    });
}

async fn spawn(
    app: AppHandle,
    config: Arc<LairConfig>,
    agent: Agent,
    req: &SendMessageRequest,
) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let model = model_for(&agent, req);
    let effort = effort_for(&agent, req);
    let system_prompt = system_prompt_for(&req.phase, &agent);

    let _ = app.emit(
        "lair-card-update",
        CardUpdateEvent {
            turn_id: req.turn_id.clone(),
            card: CardData {
                id: id.clone(),
                agent: agent.clone(),
                status: CardStatus::Streaming,
                raw_output: String::new(),
                summary: None,
                outcome: None,
                error: None,
                usage: None,
                model: model.clone(),
                effort: effort.clone(),
            },
        },
    );

    let buf = Arc::new(std::sync::Mutex::new(String::new()));
    let buf_c = buf.clone();
    let app_c = app.clone();
    let id_c = id.clone();

    let exit = run_agent_streaming(
        AgentSpawnRequest {
            agent: agent.clone(),
            prompt: req.prompt.clone(),
            system_prompt,
            model: model.clone(),
            effort: effort.clone(),
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
    let usage = parse_usage(&raw, &agent);

    let _ = app.emit(
        "lair-card-update",
        CardUpdateEvent {
            turn_id: req.turn_id.clone(),
            card: CardData {
                id: id.clone(),
                agent: agent.clone(),
                status: CardStatus::Summarizing,
                raw_output: raw.clone(),
                summary: None,
                outcome: None,
                error: None,
                usage: usage.clone(),
                model: model.clone(),
                effort: effort.clone(),
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

    let outcome_str = outcome.clone().unwrap_or_default();
    let final_card = CardData {
        id: id.clone(),
        agent: agent.clone(),
        status: status.clone(),
        raw_output: raw,
        summary,
        outcome,
        error,
        usage,
        model,
        effort,
    };
    let _ = app.emit(
        "lair-card-update",
        CardUpdateEvent {
            turn_id: req.turn_id.clone(),
            card: final_card,
        },
    );

    if status == CardStatus::Done {
        emit_narration(
            &app,
            &config,
            &NarrationTrigger::AgentDone {
                agent,
                outcome: outcome_str,
            },
        )
        .await;
    }

    Ok(id)
}

// ---- model list ----

#[tauri::command]
pub async fn lair_list_models() -> Result<Vec<ModelInfo>, String> {
    list_models().await
}

// ---- checklist commands ----

#[tauri::command]
pub fn lair_read_checklist(workspace: String) -> Result<ChecklistData, String> {
    read_checklist(&workspace)
}

#[tauri::command]
pub fn lair_append_checklist_item(
    workspace: String,
    section: Section,
    text: String,
) -> Result<(), String> {
    append_item(&workspace, &section, &text)
}

#[tauri::command]
pub fn lair_toggle_checklist_item(workspace: String, line: usize) -> Result<(), String> {
    toggle_item(&workspace, line)
}

#[tauri::command]
pub fn lair_delete_checklist_item(workspace: String, line: usize) -> Result<(), String> {
    delete_item(&workspace, line)
}

#[tauri::command]
pub fn lair_watch_checklist(
    app: AppHandle,
    watcher_state: State<'_, ChecklistWatcher>,
    workspace: String,
) -> Result<(), String> {
    let app_c = app.clone();
    let new_watcher = start_watcher(&workspace, move || {
        let _ = app_c.emit("lair-checklist-changed", ());
    })?;
    let mut guard = watcher_state.0.lock().unwrap();
    *guard = Some(new_watcher);
    Ok(())
}

// ---- helpers ----

fn model_for(agent: &Agent, req: &SendMessageRequest) -> Option<String> {
    match agent {
        Agent::Claude => req.claude_model.clone(),
        Agent::Codex => req.codex_model.clone(),
    }
}

fn effort_for(agent: &Agent, req: &SendMessageRequest) -> Option<String> {
    match agent {
        Agent::Claude => req.claude_effort.clone(),
        Agent::Codex => req.codex_effort.clone(),
    }
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

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
