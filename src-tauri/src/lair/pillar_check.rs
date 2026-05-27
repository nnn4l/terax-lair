use crate::lair::types::PillarFinding;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone)]
pub struct PillarCheckRequest {
    pub pillars: String,
    pub recent_summary: String,
    pub api_key: String,
    pub model: String,
}

#[derive(Serialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    response_format: serde_json::Value,
}

#[derive(Deserialize)]
struct ChatChoice {
    message: ChatMessageReply,
}

#[derive(Deserialize)]
struct ChatMessageReply {
    content: String,
}

#[derive(Deserialize)]
struct ChatResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Deserialize)]
struct FindingsWrapper {
    findings: Vec<PillarFinding>,
}

const URL: &str = "https://openrouter.ai/api/v1/chat/completions";

pub async fn run_pillar_check(req: PillarCheckRequest) -> Result<Vec<PillarFinding>, String> {
    let system = "You compare implementation work to design pillars. \
List concrete pillar violations only. No praise, no padding. \
Reply ONLY with JSON: {\"findings\": [{\"pillar\": \"<which pillar>\", \"violation\": \"<one-line concrete description>\"}]}. \
Empty findings array if no violations.";
    let user = format!(
        "Design pillars:\n{}\n\nRecent work summary:\n{}",
        req.pillars, req.recent_summary
    );
    let body = ChatRequest {
        model: req.model.clone(),
        messages: vec![
            ChatMessage {
                role: "system".into(),
                content: system.into(),
            },
            ChatMessage {
                role: "user".into(),
                content: user,
            },
        ],
        response_format: serde_json::json!({"type": "json_object"}),
    };
    let raw = call(&req.api_key, &body).await?;
    let wrapper: FindingsWrapper = serde_json::from_str(&raw)
        .map_err(|e| format!("parse findings json: {e}; got: {raw}"))?;
    Ok(wrapper.findings)
}

async fn call(api_key: &str, body: &ChatRequest) -> Result<String, String> {
    let client = reqwest::Client::new();
    let resp = client
        .post(URL)
        .bearer_auth(api_key)
        .json(body)
        .send()
        .await
        .map_err(|e| format!("http: {e}"))?;
    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("body: {e}"))?;
    if !status.is_success() {
        return Err(format!("openrouter {status}: {text}"));
    }
    let parsed: ChatResponse =
        serde_json::from_str(&text).map_err(|e| format!("parse outer: {e}; got: {text}"))?;
    Ok(parsed
        .choices
        .into_iter()
        .next()
        .ok_or("no choices")?
        .message
        .content)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore]
    async fn smoke_real_api() {
        let api_key = std::env::var("OPENROUTER_API_KEY").expect("set OPENROUTER_API_KEY");
        let req = PillarCheckRequest {
            pillars: "## 1. Personal, not product\nNo multi-user features.\n## 2. Compact over verbose\nNo wall-of-text outputs.".into(),
            recent_summary: "Added a multi-user invite system with email confirmations. Output includes 200-line tutorial dump.".into(),
            api_key,
            model: "anthropic/claude-haiku-4.5".into(),
        };
        let findings = run_pillar_check(req).await.expect("ok");
        assert!(!findings.is_empty(), "expected at least one finding");
    }

    #[test]
    fn parse_findings_wrapper_handles_empty_array() {
        let raw = "{\"findings\":[]}";
        let wrapper: FindingsWrapper = serde_json::from_str(raw).expect("parse");
        assert!(wrapper.findings.is_empty());
    }

    #[test]
    fn parse_findings_wrapper_handles_populated_array() {
        let raw = "{\"findings\":[{\"pillar\":\"1\",\"violation\":\"multi-user\"}]}";
        let wrapper: FindingsWrapper = serde_json::from_str(raw).expect("parse");
        assert_eq!(wrapper.findings.len(), 1);
        assert_eq!(wrapper.findings[0].pillar, "1");
    }
}
