use crate::lair::types::{CostTier, Lane, LaneRole, Phase};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone)]
pub struct RouteRequest {
    pub lanes: Vec<Lane>,
    pub prompt: String,
    pub phase: Phase,
    pub agent_hint: Option<String>,
    pub api_key: String,
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteResult {
    pub lane_id: String,
    pub reason: String,
}

pub async fn route_lane(req: RouteRequest) -> Result<RouteResult, String> {
    let implementors: Vec<&Lane> = req
        .lanes
        .iter()
        .filter(|l| matches!(l.role, LaneRole::Implementor) && l.enabled)
        .collect();
    if implementors.is_empty() {
        return Err("no enabled implementor lanes".into());
    }

    // Precedence 1: agent_hint matches a lane id
    if let Some(hint) = req.agent_hint.as_deref() {
        if let Some(found) = implementors.iter().find(|l| l.id == hint) {
            return Ok(RouteResult {
                lane_id: found.id.clone(),
                reason: "hint match".into(),
            });
        }
    }

    // Precedence 2: auto_bias contains phase key or prompt keyword
    let phase_key = phase_str(&req.phase);
    let prompt_lower = req.prompt.to_lowercase();
    let mut bias_matches: Vec<&Lane> = implementors
        .iter()
        .filter(|l| {
            l.auto_bias.iter().any(|tag| {
                let t = tag.to_lowercase();
                t == phase_key || prompt_lower.contains(&t)
            })
        })
        .copied()
        .collect();
    if !bias_matches.is_empty() {
        bias_matches.sort_by_key(|l| cost_preference(&l.cost_tier));
        let pick = bias_matches[0];
        return Ok(RouteResult {
            lane_id: pick.id.clone(),
            reason: format!("bias matched ({phase_key})"),
        });
    }

    // Precedence 3: Haiku call
    if !req.api_key.is_empty() {
        if let Ok(result) = call_haiku(&req, &implementors).await {
            if implementors.iter().any(|l| l.id == result.lane_id) {
                return Ok(result);
            }
        }
    }

    // Precedence 4: fallback to first Free implementor
    let pick = implementors
        .iter()
        .find(|l| matches!(l.cost_tier, CostTier::Free))
        .or_else(|| implementors.first())
        .copied()
        .unwrap();
    Ok(RouteResult {
        lane_id: pick.id.clone(),
        reason: "fallback".into(),
    })
}

fn phase_str(p: &Phase) -> String {
    match p {
        Phase::Implement => "implement",
        Phase::Refactor => "refactor",
        Phase::Test => "test",
        Phase::Critique => "critique",
        Phase::Review => "review",
    }
    .into()
}

fn cost_preference(c: &CostTier) -> u8 {
    match c {
        CostTier::Free => 0,
        CostTier::Cheap => 1,
        CostTier::Standard => 2,
        CostTier::Expensive => 3,
    }
}

async fn call_haiku(req: &RouteRequest, lanes: &[&Lane]) -> Result<RouteResult, String> {
    use serde_json::json;
    let lanes_desc = lanes
        .iter()
        .map(|l| {
            format!(
                "- {} ({}, {}): {}",
                l.id,
                format!("{:?}", l.cost_tier).to_lowercase(),
                l.label,
                l.auto_bias.join(",")
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    let system = format!(
        "You route implementation prompts to coding agent lanes. \
Reply ONLY with JSON: {{\"lane_id\": \"<one of the listed ids>\", \"reason\": \"<short why>\"}}. \
Prefer cheaper lanes for routine work; reserve expensive for complex reasoning. \
Lanes:\n{lanes_desc}"
    );
    let user = format!("Phase: {}\nPrompt: {}", phase_str(&req.phase), req.prompt);
    let body = json!({
        "model": req.model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "response_format": {"type": "json_object"},
    });
    let client = reqwest::Client::new();
    let resp = client
        .post("https://openrouter.ai/api/v1/chat/completions")
        .bearer_auth(&req.api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("http: {e}"))?;
    let text = resp.text().await.map_err(|e| format!("body: {e}"))?;
    let outer: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("parse: {e}"))?;
    let content = outer["choices"][0]["message"]["content"]
        .as_str()
        .ok_or("no content")?;
    let inner: RouteResult =
        serde_json::from_str(content).map_err(|e| format!("parse content: {e}"))?;
    Ok(inner)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn mk_lane(id: &str, role: LaneRole, cost: CostTier, bias: &[&str], enabled: bool) -> Lane {
        Lane {
            id: id.into(),
            label: id.into(),
            cli: "claude".into(),
            env: HashMap::new(),
            default_model: None,
            default_effort: None,
            role,
            cost_tier: cost,
            clear_required: false,
            backend: None,
            auto_bias: bias.iter().map(|s| s.to_string()).collect(),
            enabled,
            context_window: None,
        }
    }

    #[tokio::test]
    async fn empty_implementors_returns_err() {
        let req = RouteRequest {
            lanes: vec![mk_lane(
                "a",
                LaneRole::Reviewer,
                CostTier::Free,
                &[],
                true,
            )],
            prompt: "x".into(),
            phase: Phase::Implement,
            agent_hint: None,
            api_key: String::new(),
            model: String::new(),
        };
        assert!(route_lane(req).await.is_err());
    }

    #[tokio::test]
    async fn agent_hint_match_short_circuits() {
        let req = RouteRequest {
            lanes: vec![
                mk_lane(
                    "claude",
                    LaneRole::Implementor,
                    CostTier::Expensive,
                    &[],
                    true,
                ),
                mk_lane(
                    "codex",
                    LaneRole::Implementor,
                    CostTier::Free,
                    &[],
                    true,
                ),
            ],
            prompt: "x".into(),
            phase: Phase::Implement,
            agent_hint: Some("claude".into()),
            api_key: String::new(),
            model: String::new(),
        };
        let res = route_lane(req).await.unwrap();
        assert_eq!(res.lane_id, "claude");
        assert!(res.reason.contains("hint"));
    }

    #[tokio::test]
    async fn bias_match_prefers_cheaper_tier() {
        let req = RouteRequest {
            lanes: vec![
                mk_lane(
                    "claude",
                    LaneRole::Implementor,
                    CostTier::Expensive,
                    &["test"],
                    true,
                ),
                mk_lane(
                    "flash",
                    LaneRole::Implementor,
                    CostTier::Cheap,
                    &["test"],
                    true,
                ),
            ],
            prompt: "write a test".into(),
            phase: Phase::Test,
            agent_hint: None,
            api_key: String::new(),
            model: String::new(),
        };
        let res = route_lane(req).await.unwrap();
        assert_eq!(res.lane_id, "flash");
    }

    #[tokio::test]
    async fn fallback_picks_free_implementor() {
        let req = RouteRequest {
            lanes: vec![
                mk_lane(
                    "claude",
                    LaneRole::Implementor,
                    CostTier::Expensive,
                    &[],
                    true,
                ),
                mk_lane(
                    "codex",
                    LaneRole::Implementor,
                    CostTier::Free,
                    &[],
                    true,
                ),
            ],
            prompt: "do something".into(),
            phase: Phase::Implement,
            agent_hint: None,
            api_key: String::new(),
            model: String::new(),
        };
        let res = route_lane(req).await.unwrap();
        assert_eq!(res.lane_id, "codex");
        assert!(res.reason.contains("fallback"));
    }
}
