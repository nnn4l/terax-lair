use crate::lair::checklist::{
    append_item, delete_item, read_checklist, start_watcher, toggle_item, ChecklistData,
    ChecklistWatcher, Section,
};
use crate::lair::cli_agent::{run_agent_streaming, AgentSpawnRequest};
use crate::lair::doc_watcher::WatcherHandle;
use crate::lair::keychain::get_openrouter_key;
use crate::lair::narrator::{narrate, NarrationTrigger};
use crate::lair::parser_client::{
    judge_outcome, list_models, summarize_output, ModelInfo, SummarizeRequest,
};
use crate::lair::phase_prompts::system_prompt_for;
use crate::lair::pillars;
use crate::lair::queue::Queue;
use crate::lair::{doc_watcher, spec_import};
use crate::lair::types::*;
use crate::lair::usage_parser::parse_usage;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{async_runtime, AppHandle, Emitter, State};
use uuid::Uuid;

#[derive(serde::Serialize, Clone)]
struct SpecCompleteEvent {
    spec_anchor: String,
}

pub struct LairConfig {
    pub openrouter_model: String,
}

pub struct LairState {
    pub queue: Mutex<Option<Queue>>,
    pub watcher: Mutex<Option<WatcherHandle>>,
    pub pillar_cache: Mutex<HashMap<String, String>>,
    pub pillar_watchers: Mutex<HashMap<String, crate::lair::pillars::WatcherHandle>>,
    pub was_all_checked: Mutex<bool>,
    pub lane_status: Arc<crate::lair::lane_status::LaneStatusStore>,
    pub lanes_cache: Mutex<Vec<Lane>>,
    pub lanes_watcher: Mutex<Option<crate::lair::lanes::WatcherHandle>>,
}

impl LairState {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            queue: Mutex::new(None),
            watcher: Mutex::new(None),
            pillar_cache: Mutex::new(HashMap::new()),
            pillar_watchers: Mutex::new(HashMap::new()),
            was_all_checked: Mutex::new(false),
            lane_status: Arc::new(crate::lair::lane_status::LaneStatusStore::new()),
            lanes_cache: Mutex::new(Vec::new()),
            lanes_watcher: Mutex::new(None),
        })
    }
}

#[tauri::command]
pub async fn lair_send_message(
    app: AppHandle,
    config: State<'_, Arc<LairConfig>>,
    checklist_watcher: State<'_, ChecklistWatcher>,
    lair_state: State<'_, Arc<LairState>>,
    req: SendMessageRequest,
) -> Result<Vec<String>, String> {
    let _ = checklist_watcher; // watcher state managed separately
    let config = config.inner().clone();
    let lair_state = lair_state.inner().clone();
    let mut ids = Vec::new();
    let lane = resolve_lane_for_request(&config, &lair_state, &req).await?;
    ensure_lane_backend_running(&lane)?;
    let agent = agent_for_lane(&lane);
    match agent {
        Agent::Claude => {
            emit_narration_background(
                &app,
                &config,
                NarrationTrigger::Dispatching { agent: Agent::Claude },
            );
            ids.push(spawn(app, config, lair_state, lane, Agent::Claude, &req).await?);
        }
        Agent::Codex => {
            emit_narration_background(
                &app,
                &config,
                NarrationTrigger::Dispatching { agent: Agent::Codex },
            );
            ids.push(spawn(app, config, lair_state, lane, Agent::Codex, &req).await?);
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
    lair_state: Arc<LairState>,
    lane: Lane,
    agent: Agent,
    req: &SendMessageRequest,
) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let model = model_for_lane(&lane, req);
    let effort = effort_for_lane(&lane, req);
    let phase_prompt = system_prompt_for(&req.phase, &agent);
    let pillars = read_pillars_cached(&lair_state, &req.workspace);
    let system_prompt = if pillars.trim().is_empty() {
        phase_prompt
    } else {
        format!("{phase_prompt}\n\n## Design Pillars (do not violate)\n{pillars}")
    };

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

    let effective_prompt = if let Some(ctx) = &req.task_context {
        format!(
            "## Current task\n{}\n\n## Task context\n{}\n\n## User message\n{}",
            ctx.label, ctx.context, req.prompt
        )
    } else {
        req.prompt.clone()
    };

    if let Some(ctx) = &req.task_context {
        let _ = app.emit(
            "lair-queue-event",
            QueueEvent::ItemDispatched {
                id: ctx.item_id.clone(),
                agent: agent.clone(),
            },
        );
    }

    let exit = run_agent_streaming(
        AgentSpawnRequest {
            lane,
            prompt: effective_prompt,
            system_prompt,
            model_override: model.clone(),
            effort_override: effort.clone(),
            cwd: req.workspace.clone(),
            card_id: id.clone(),
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
    let timed_out = matches!(&exit, Err(e) if e.contains("timeout"));
    let queue_outcome = match scan_for_result_marker(&raw) {
        Some(outcome) => outcome,
        None => judge_outcome(&raw, &config)
            .await
            .unwrap_or(CompletionOutcome::NeedsReview),
    };

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

    if let Some(ctx) = &req.task_context {
        let mut guard = lair_state.queue.lock().unwrap();
        if let Some(queue) = guard.as_mut() {
            if timed_out {
                queue.pause();
                let _ = app.emit(
                    "lair-queue-event",
                    QueueEvent::BlockedAwaitingApproval {
                        id: ctx.item_id.clone(),
                        reason: "agent timed out - investigate and resume".to_string(),
                    },
                );
            } else {
                queue.check(&ctx.item_id, queue_outcome.clone());
                let _ = app.emit(
                    "lair-queue-event",
                    QueueEvent::ItemCompleted {
                        id: ctx.item_id.clone(),
                        outcome: queue_outcome.clone(),
                    },
                );
                if queue_outcome == CompletionOutcome::Failed && queue.stop_on_failure {
                    queue.pause();
                    let _ = app.emit("lair-queue-event", QueueEvent::Paused);
                } else if let Some(gate_id) = queue.needs_approval_gate() {
                    queue.pause();
                    let _ = app.emit(
                        "lair-queue-event",
                        QueueEvent::BlockedAwaitingApproval {
                            id: gate_id,
                            reason: "task boundary".to_string(),
                        },
                    );
                } else if !queue.paused && queue.autopilot != AutopilotMode::Off {
                    let to = queue.current().map(|item| item.id.clone());
                    let _ = app.emit(
                        "lair-queue-event",
                        QueueEvent::CursorAdvanced {
                            from: ctx.item_id.clone(),
                            to,
                        },
                    );
                }
            }
        }
    }

    if let Some(ctx) = &req.task_context {
        let guard = lair_state.queue.lock().unwrap();
        let now_all = guard
            .as_ref()
            .map(|q| q.all_leaves_checked())
            .unwrap_or(false);
        let mut prev_guard = lair_state.was_all_checked.lock().unwrap();
        let prev_all = *prev_guard;
        *prev_guard = now_all;
        drop(guard);
        drop(prev_guard);
        if now_all && !prev_all && req.phase == Phase::Implement {
            let _ = app.emit(
                "lair-spec-complete",
                SpecCompleteEvent {
                    spec_anchor: ctx.item_id.clone(),
                },
            );
        }
    }

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

#[tauri::command]
pub fn lair_read_pillars(workspace: String) -> Result<String, String> {
    pillars::read_pillars(&workspace)
}

#[tauri::command]
pub async fn lair_run_pillar_check(
    config: State<'_, Arc<LairConfig>>,
    state: State<'_, Arc<LairState>>,
    workspace: String,
) -> Result<Vec<crate::lair::types::PillarFinding>, String> {
    let pillars_text = pillars::read_pillars(&workspace)?;
    let api_key = get_openrouter_key()?;
    let model = config.openrouter_model.clone();

    let recent_summary = {
        let guard = state.queue.lock().unwrap();
        match guard.as_ref() {
            None => String::new(),
            Some(queue) => {
                let mut lines: Vec<String> = Vec::new();
                fn walk(items: &[crate::lair::types::QueueItem], lines: &mut Vec<String>) {
                    for item in items {
                        if item.checked {
                            lines.push(format!("- {}: {}", item.label, item.context));
                        }
                        walk(&item.children, lines);
                    }
                }
                walk(queue.items(), &mut lines);
                lines.join("\n")
            }
        }
    };

    crate::lair::pillar_check::run_pillar_check(crate::lair::pillar_check::PillarCheckRequest {
        pillars: pillars_text,
        recent_summary,
        api_key,
        model,
    })
    .await
}

#[tauri::command]
pub async fn lair_dispatch_critiques(
    app: AppHandle,
    config: State<'_, Arc<LairConfig>>,
    checklist_watcher: State<'_, ChecklistWatcher>,
    lair_state: State<'_, Arc<LairState>>,
    workspace: String,
    items: Vec<String>,
    mode: String,
) -> Result<(), String> {
    let _ = checklist_watcher;
    let parallel = mode == "parallel";

    if parallel {
        let mut handles = Vec::new();
        for item in items {
            let req = critique_request(workspace.clone(), item);
            let app_c = app.clone();
            let config_c = config.inner().clone();
            let state_c = lair_state.inner().clone();
            handles.push(tauri::async_runtime::spawn(async move {
                dispatch_one(app_c, config_c, state_c, req).await
            }));
        }
        let mut errors = Vec::new();
        for handle in handles {
            match handle.await {
                Ok(Ok(())) => {}
                Ok(Err(e)) => errors.push(e),
                Err(e) => errors.push(format!("critique task join: {e}")),
            }
        }
        if !errors.is_empty() {
            return Err(errors.join("\n"));
        }
    } else {
        for item in items {
            let req = critique_request(workspace.clone(), item);
            dispatch_one(
                app.clone(),
                config.inner().clone(),
                lair_state.inner().clone(),
                req,
            )
            .await?;
        }
    }
    Ok(())
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

// ---- queue commands ----

#[tauri::command]
pub async fn lair_import_spec(
    app: AppHandle,
    config: State<'_, Arc<LairConfig>>,
    state: State<'_, Arc<LairState>>,
    workspace: String,
    path: String,
) -> Result<Vec<QueueItem>, String> {
    let items = spec_import::import_spec(&workspace, &path, &config).await?;
    let queue = Queue::new(items.clone(), AutopilotMode::Task);
    let app_c = app.clone();
    let watcher = doc_watcher::watch_specs(vec![path.clone()], move |file| {
        let _ = app_c.emit("lair-spec-changed", file);
    })?;
    *state.queue.lock().unwrap() = Some(queue);
    *state.watcher.lock().unwrap() = Some(watcher);
    *state.was_all_checked.lock().unwrap() = false;
    Ok(items)
}

#[tauri::command]
pub async fn lair_paste_spec(
    config: State<'_, Arc<LairConfig>>,
    state: State<'_, Arc<LairState>>,
    workspace: String,
    markdown: String,
) -> Result<Vec<QueueItem>, String> {
    let items = spec_import::import_pasted_spec(&workspace, &markdown, &config).await?;
    *state.queue.lock().unwrap() = Some(Queue::new(items.clone(), AutopilotMode::Task));
    *state.was_all_checked.lock().unwrap() = false;
    Ok(items)
}

#[tauri::command]
pub fn lair_list_specs(workspace: String) -> Result<Vec<String>, String> {
    spec_import::list_specs(&workspace)
}

#[tauri::command]
pub fn lair_queue_pause(app: AppHandle, state: State<'_, Arc<LairState>>) {
    if let Some(queue) = state.queue.lock().unwrap().as_mut() {
        queue.pause();
        let _ = app.emit("lair-queue-event", QueueEvent::Paused);
    }
}

#[tauri::command]
pub fn lair_queue_resume(app: AppHandle, state: State<'_, Arc<LairState>>) {
    if let Some(queue) = state.queue.lock().unwrap().as_mut() {
        queue.resume();
        let _ = app.emit("lair-queue-event", QueueEvent::Resumed);
    }
}

#[tauri::command]
pub fn lair_queue_skip(app: AppHandle, state: State<'_, Arc<LairState>>) {
    if let Some(queue) = state.queue.lock().unwrap().as_mut() {
        let from = queue.current().map(|item| item.id.clone()).unwrap_or_default();
        queue.skip();
        let to = queue.current().map(|item| item.id.clone());
        let _ = app.emit("lair-queue-event", QueueEvent::CursorAdvanced { from, to });
    }
}

#[tauri::command]
pub fn lair_queue_pin(state: State<'_, Arc<LairState>>, item_id: String) {
    if let Some(queue) = state.queue.lock().unwrap().as_mut() {
        queue.pin(&item_id);
    }
}

#[tauri::command]
pub fn lair_queue_unpin(state: State<'_, Arc<LairState>>) {
    if let Some(queue) = state.queue.lock().unwrap().as_mut() {
        queue.unpin();
    }
}

#[tauri::command]
pub fn lair_queue_get(state: State<'_, Arc<LairState>>) -> Option<Vec<QueueItem>> {
    state.queue.lock().unwrap().as_ref().map(|queue| queue.items().clone())
}

#[tauri::command]
pub fn lair_queue_drop(app: AppHandle, state: State<'_, Arc<LairState>>, item_id: String) {
    if let Some(queue) = state.queue.lock().unwrap().as_mut() {
        queue.drop_item(&item_id);
        let to = queue.current().map(|item| item.id.clone());
        let _ = app.emit(
            "lair-queue-event",
            QueueEvent::CursorAdvanced { from: item_id, to },
        );
    }
}

#[tauri::command]
pub fn lair_queue_mark_done(app: AppHandle, state: State<'_, Arc<LairState>>, item_id: String) {
    if let Some(queue) = state.queue.lock().unwrap().as_mut() {
        queue.mark_done(&item_id);
        let _ = app.emit(
            "lair-queue-event",
            QueueEvent::ItemCompleted {
                id: item_id.clone(),
                outcome: CompletionOutcome::Done,
            },
        );
        let to = queue.current().map(|item| item.id.clone());
        let _ = app.emit(
            "lair-queue-event",
            QueueEvent::CursorAdvanced { from: item_id, to },
        );
    }
}

#[tauri::command]
pub fn lair_queue_edit_context(
    state: State<'_, Arc<LairState>>,
    item_id: String,
    context: String,
) {
    if let Some(queue) = state.queue.lock().unwrap().as_mut() {
        queue.edit_context(&item_id, &context);
    }
}

#[tauri::command]
pub fn lair_queue_set_autopilot(
    state: State<'_, Arc<LairState>>,
    mode: AutopilotMode,
) {
    if let Some(queue) = state.queue.lock().unwrap().as_mut() {
        queue.set_autopilot(mode);
    }
}

#[tauri::command]
pub async fn lair_queue_check_stale(
    config: State<'_, Arc<LairConfig>>,
    state: State<'_, Arc<LairState>>,
) -> Result<Vec<StaleReport>, String> {
    let items = state
        .queue
        .lock()
        .unwrap()
        .as_ref()
        .map(|queue| queue.items().clone())
        .unwrap_or_default();
    let reports = doc_watcher::check_stale(&items, &config).await?;
    if !reports.is_empty() {
        let ids = reports
            .iter()
            .map(|report| report.item_id.clone())
            .collect::<Vec<_>>();
        if let Some(queue) = state.queue.lock().unwrap().as_mut() {
            mark_stale(queue.items_mut(), &ids, true);
        }
    }
    Ok(reports)
}

#[tauri::command]
pub fn lair_queue_resync(
    state: State<'_, Arc<LairState>>,
    accepted_ids: Vec<String>,
) -> Result<(), String> {
    let mut guard = state.queue.lock().unwrap();
    let queue = guard.as_mut().ok_or("no queue")?;
    resync_items(queue.items_mut(), &accepted_ids);
    Ok(())
}

// ---- helpers ----

fn agent_key(agent: &Agent) -> String {
    match agent {
        Agent::Claude => "claude",
        Agent::Codex => "codex",
    }
    .to_string()
}

fn agent_for_lane(lane: &Lane) -> Agent {
    if lane.cli == "codex" {
        Agent::Codex
    } else {
        Agent::Claude
    }
}

fn model_for_lane(lane: &Lane, req: &SendMessageRequest) -> Option<String> {
    let override_model = if lane.cli == "codex" {
        req.codex_model.clone()
    } else {
        req.claude_model.clone()
    };
    override_model.or_else(|| lane.default_model.clone())
}

fn effort_for_lane(lane: &Lane, req: &SendMessageRequest) -> Option<String> {
    let override_effort = if lane.cli == "codex" {
        req.codex_effort.clone()
    } else {
        req.claude_effort.clone()
    };
    override_effort.or_else(|| lane.default_effort.clone())
}

async fn resolve_lane_for_request(
    config: &Arc<LairConfig>,
    state: &Arc<LairState>,
    req: &SendMessageRequest,
) -> Result<Lane, String> {
    let lanes = ensure_lanes_loaded(state)?;
    if req.use_auto || req.lane_id == "auto" {
        let api_key = get_openrouter_key().unwrap_or_default();
        let route = crate::lair::auto_router::route_lane(crate::lair::auto_router::RouteRequest {
            lanes: lanes.clone(),
            prompt: req.prompt.clone(),
            phase: req.phase.clone(),
            agent_hint: None,
            api_key,
            model: config.openrouter_model.clone(),
        })
        .await?;
        return lanes
            .into_iter()
            .find(|lane| lane.id == route.lane_id && lane.enabled)
            .ok_or_else(|| format!("auto selected unavailable lane: {}", route.lane_id));
    }

    let lane = lanes
        .into_iter()
        .find(|lane| lane.id == req.lane_id)
        .ok_or_else(|| format!("unknown lane: {}", req.lane_id))?;
    if !lane.enabled {
        return Err(format!("lane disabled: {}", lane.label));
    }
    Ok(lane)
}

fn ensure_lane_backend_running(lane: &Lane) -> Result<(), String> {
    let Some(backend_id) = lane.backend.as_deref() else {
        return Ok(());
    };
    if matches!(
        crate::lair::backend_manager::BACKEND_MANAGER.status(backend_id),
        BackendStatus::Running
    ) {
        return Ok(());
    }
    crate::lair::backend_manager::BACKEND_MANAGER.restart(backend_id)
}

fn phase_key(phase: &Phase) -> String {
    match phase {
        Phase::Implement => "implement",
        Phase::Refactor => "refactor",
        Phase::Test => "test",
        Phase::Critique => "critique",
        Phase::Review => "review",
    }
    .to_string()
}

fn read_pillars_cached(state: &Arc<LairState>, workspace: &str) -> String {
    {
        let cache = state.pillar_cache.lock().unwrap();
        if let Some(text) = cache.get(workspace) {
            return text.clone();
        }
    }

    let text = pillars::read_pillars(workspace).unwrap_or_default();
    state
        .pillar_cache
        .lock()
        .unwrap()
        .insert(workspace.to_string(), text.clone());

    let mut watchers = state.pillar_watchers.lock().unwrap();
    if !watchers.contains_key(workspace) {
        let state_for_watcher = state.clone();
        let workspace_owned = workspace.to_string();
        if let Ok(handle) = pillars::watch_pillars(workspace, move || {
            state_for_watcher
                .pillar_cache
                .lock()
                .unwrap()
                .remove(&workspace_owned);
        }) {
            watchers.insert(workspace.to_string(), handle);
        }
    }

    text
}

fn critique_request(workspace: String, prompt: String) -> SendMessageRequest {
    SendMessageRequest {
        turn_id: Uuid::new_v4().to_string(),
        prompt,
        lane_id: "codex".into(),
        use_auto: false,
        phase: Phase::Critique,
        workspace,
        task_context: None,
        claude_model: None,
        codex_model: None,
        claude_effort: None,
        codex_effort: None,
    }
}

async fn dispatch_one(
    app: AppHandle,
    config: Arc<LairConfig>,
    lair_state: Arc<LairState>,
    req: SendMessageRequest,
) -> Result<(), String> {
    let lane = resolve_lane_for_request(&config, &lair_state, &req).await?;
    ensure_lane_backend_running(&lane)?;
    let agent = agent_for_lane(&lane);
    let _ = spawn(app, config, lair_state, lane, agent, &req).await?;
    Ok(())
}

pub fn scan_for_result_marker(output: &str) -> Option<CompletionOutcome> {
    let tail_rev: String = output.chars().rev().take(500).collect();
    let tail: String = tail_rev.chars().rev().collect();
    for line in tail.lines().rev() {
        let low = line.trim().to_lowercase();
        if low.starts_with("result:") {
            if low.contains("done") {
                return Some(CompletionOutcome::Done);
            }
            if low.contains("partial") || low.contains("needs_review") {
                return Some(CompletionOutcome::NeedsReview);
            }
            if low.contains("failed") || low.contains("fail") {
                return Some(CompletionOutcome::Failed);
            }
        }
    }
    None
}

fn mark_stale(items: &mut [QueueItem], ids: &[String], stale: bool) {
    for item in items {
        if ids.contains(&item.id) {
            item.stale = stale;
        }
        mark_stale(&mut item.children, ids, stale);
    }
}

fn resync_items(items: &mut [QueueItem], ids: &[String]) {
    for item in items {
        if ids.contains(&item.id) {
            item.stale = false;
            if let Some(source) = &mut item.source {
                if let Ok(content) = std::fs::read_to_string(&source.file) {
                    let hashes = spec_import::section_hashes(&content);
                    if let Some(hash) = hashes.get(&source.anchor) {
                        source.hash = hash.clone();
                    }
                } else {
                    item.source = None;
                }
            }
        }
        resync_items(&mut item.children, ids);
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

// ---- M3: Lane commands ----

fn ensure_lanes_loaded(state: &Arc<LairState>) -> Result<Vec<Lane>, String> {
    {
        let cache = state.lanes_cache.lock().unwrap();
        if !cache.is_empty() {
            return Ok(cache.clone());
        }
    }
    let lanes = crate::lair::lanes::load()?;
    *state.lanes_cache.lock().unwrap() = lanes.clone();
    Ok(lanes)
}

#[tauri::command]
pub fn lair_list_lanes() -> Result<Vec<Lane>, String> {
    crate::lair::lanes::load()
}

#[tauri::command]
pub fn lair_save_lane(
    state: State<'_, Arc<LairState>>,
    lane: Lane,
) -> Result<(), String> {
    let mut lanes = crate::lair::lanes::load()?;
    if let Some(existing) = lanes.iter_mut().find(|l| l.id == lane.id) {
        *existing = lane;
    } else {
        lanes.push(lane);
    }
    crate::lair::lanes::save(&lanes)?;
    *state.lanes_cache.lock().unwrap() = lanes;
    Ok(())
}

#[tauri::command]
pub fn lair_delete_lane(state: State<'_, Arc<LairState>>, lane_id: String) -> Result<(), String> {
    let builtins = ["claude", "codex", "deepseek-pro", "deepseek-flash"];
    if builtins.contains(&lane_id.as_str()) {
        return Err("cannot delete built-in lane; disable instead".into());
    }
    let mut lanes = crate::lair::lanes::load()?;
    lanes.retain(|l| l.id != lane_id);
    crate::lair::lanes::save(&lanes)?;
    *state.lanes_cache.lock().unwrap() = lanes;
    Ok(())
}

#[tauri::command]
pub fn lair_get_lane_status(
    state: State<'_, Arc<LairState>>,
    lane_id: String,
) -> Option<LaneStatus> {
    state.lane_status.get(&lane_id)
}

#[tauri::command]
pub fn lair_get_all_lane_status(state: State<'_, Arc<LairState>>) -> Vec<LaneStatus> {
    state.lane_status.all()
}

#[tauri::command]
pub async fn lair_clear_lane(
    app: AppHandle,
    state: State<'_, Arc<LairState>>,
    lane_id: String,
) -> Result<(), String> {
    state.lane_status.clear(&lane_id);
    let _ = app.emit("lair-lane-cleared", &lane_id);
    Ok(())
}

// ---- M3: Stop card ----

#[tauri::command]
pub fn lair_stop_card(card_id: String) -> Result<(), String> {
    let pid = crate::lair::process_registry::PROCESS_REGISTRY
        .take(&card_id)
        .ok_or("card not running or already done")?;
    kill_process(pid)
}

#[cfg(windows)]
fn kill_process(pid: u32) -> Result<(), String> {
    use std::process::Command as StdCommand;
    let output = StdCommand::new("taskkill")
        .args(["/F", "/T", "/PID", &pid.to_string()])
        .output()
        .map_err(|e| format!("taskkill: {e}"))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(())
}

#[cfg(not(windows))]
fn kill_process(pid: u32) -> Result<(), String> {
    // Not used on non-Windows for M3; stub
    Err(format!("kill not implemented for pid {pid}"))
}

// ---- M3: Backend management ----

#[tauri::command]
pub fn lair_restart_backend(backend_id: String) -> Result<(), String> {
    crate::lair::backend_manager::BACKEND_MANAGER.restart(&backend_id)
}

#[tauri::command]
pub fn lair_get_backend_status(backend_id: String) -> BackendStatus {
    crate::lair::backend_manager::BACKEND_MANAGER.status(&backend_id)
}
