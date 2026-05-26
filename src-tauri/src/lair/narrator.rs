use crate::lair::orchestrator::LairConfig;
use crate::lair::parser_client::{narrate_text, NarrationRequest};
use crate::lair::types::Agent;
use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant};
use tokio::time::timeout;

pub enum NarrationTrigger {
    Dispatching { agent: Agent },
    Routing { agent: Agent, reason: String },
    CompareLaunching,
    AgentDone { agent: Agent, outcome: String },
}

static CACHE: LazyLock<Mutex<HashMap<String, (String, Instant)>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

const CACHE_TTL: Duration = Duration::from_secs(60);
const NARRATION_TIMEOUT: Duration = Duration::from_secs(2);

pub async fn narrate(trigger: &NarrationTrigger, cfg: &LairConfig) -> Option<String> {
    let key = cache_key(trigger);
    {
        let cache = CACHE.lock().unwrap();
        if let Some((text, at)) = cache.get(&key) {
            if at.elapsed() < CACHE_TTL {
                return Some(text.clone());
            }
        }
    }

    let api_key = crate::lair::keychain::get_openrouter_key().ok()?;
    let text = trigger_text(trigger);

    let result = timeout(
        NARRATION_TIMEOUT,
        narrate_text(NarrationRequest {
            text,
            api_key,
            model: cfg.openrouter_model.clone(),
        }),
    )
    .await;

    match result {
        Ok(Ok(narration)) => {
            CACHE
                .lock()
                .unwrap()
                .insert(key, (narration.clone(), Instant::now()));
            Some(narration)
        }
        _ => None,
    }
}

fn cache_key(trigger: &NarrationTrigger) -> String {
    match trigger {
        NarrationTrigger::Dispatching { agent } => format!("dispatch:{}", agent_key(agent)),
        NarrationTrigger::Routing { agent, .. } => format!("route:{}", agent_key(agent)),
        NarrationTrigger::CompareLaunching => "compare".into(),
        NarrationTrigger::AgentDone { agent, outcome } => {
            format!("done:{}:{}", agent_key(agent), &outcome[..30.min(outcome.len())])
        }
    }
}

fn trigger_text(trigger: &NarrationTrigger) -> String {
    match trigger {
        NarrationTrigger::Dispatching { agent } => {
            format!("Dispatching to {}.", agent_label(agent))
        }
        NarrationTrigger::Routing { agent, reason } => {
            format!("Routing to {}. Reason: {reason}.", agent_label(agent))
        }
        NarrationTrigger::CompareLaunching => "Launching both Claude and Codex.".into(),
        NarrationTrigger::AgentDone { agent, outcome } => {
            format!("{} done. {outcome}.", agent_label(agent))
        }
    }
}

fn agent_key(agent: &Agent) -> &'static str {
    match agent {
        Agent::Claude => "claude",
        Agent::Codex => "codex",
    }
}

fn agent_label(agent: &Agent) -> &'static str {
    match agent {
        Agent::Claude => "Claude",
        Agent::Codex => "Codex",
    }
}
