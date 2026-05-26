use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub provider: String,
}

#[derive(Deserialize)]
struct OpenRouterModel {
    id: String,
    name: Option<String>,
}

#[derive(Deserialize)]
struct OpenRouterModelsResponse {
    data: Vec<OpenRouterModel>,
}

const MODELS_URL: &str = "https://openrouter.ai/api/v1/models";

pub async fn list_models() -> Result<Vec<ModelInfo>, String> {
    let client = reqwest::Client::new();
    let resp = client
        .get(MODELS_URL)
        .send()
        .await
        .map_err(|e| format!("http: {e}"))?;
    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("body: {e}"))?;
    if !status.is_success() {
        return Err(format!("openrouter models {status}: {text}"));
    }
    let parsed: OpenRouterModelsResponse =
        serde_json::from_str(&text).map_err(|e| format!("parse models: {e}"))?;
    let mut out = Vec::new();
    for m in parsed.data {
        let (provider, cli_id) = match m.id.split_once('/') {
            Some((p, rest)) => (p.to_string(), rest.to_string()),
            None => continue,
        };
        if provider != "anthropic" && provider != "openai" {
            continue;
        }
        out.push(ModelInfo {
            id: cli_id,
            name: m.name.unwrap_or_else(|| m.id.clone()),
            provider,
        });
    }
    Ok(out)
}

#[derive(Debug, Clone)]
pub struct NarrationRequest {
    pub text: String,
    pub api_key: String,
    pub model: String,
}

pub async fn narrate_text(req: NarrationRequest) -> Result<String, String> {
    let system = "Narrate agent events in caveman style. \
One short sentence. Max 12 words. No articles, no filler. \
Examples: 'Routing to Codex. Edit task.' / 'Both agents launched.' / 'Claude done. Success.'";
    let body = ChatRequest {
        model: req.model,
        max_tokens: Some(50),
        messages: vec![
            ChatMessage { role: "system".into(), content: system.into() },
            ChatMessage { role: "user".into(), content: req.text },
        ],
        response_format: serde_json::Value::Null,
    };
    call(&req.api_key, &body).await.map(|s| s.trim().to_string())
}

#[derive(Debug, Clone)]
pub struct SummarizeRequest {
    pub agent: String,
    pub raw_output: String,
    pub phase: String,
    pub api_key: String,
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SummarizeResult {
    pub summary: String,
    pub outcome: String,
}

#[derive(Debug, Clone)]
pub struct RouteRequest {
    pub prompt: String,
    pub phase: String,
    pub api_key: String,
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteResult {
    pub agent: String,
    pub reason: String,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "serde_json::Value::is_null")]
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

const URL: &str = "https://openrouter.ai/api/v1/chat/completions";

pub async fn summarize_output(req: SummarizeRequest) -> Result<SummarizeResult, String> {
    let system = "You summarize CLI agent output. Reply with bare JSON ONLY \
(no markdown, no code fences, no prose before or after): \
{\"summary\": \"3-5 line plain-English summary of what the agent did\", \
\"outcome\": \"one-line result (success/fail/partial + key fact)\"}. \
Caveman style: drop articles, no filler.";
    let user = format!(
        "Agent: {}\nPhase: {}\nRaw output:\n{}",
        req.agent, req.phase, req.raw_output
    );
    let body = ChatRequest {
        model: req.model,
        max_tokens: None,
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
    let cleaned = extract_json(&raw);
    serde_json::from_str(&cleaned).map_err(|e| format!("parse summary json: {e}; got: {raw}"))
}

pub async fn route_agent(req: RouteRequest) -> Result<RouteResult, String> {
    let system = "You route prompts to coding agents. Reply with bare JSON ONLY \
(no markdown, no code fences, no prose before or after): \
{\"agent\": \"claude\" or \"codex\", \"reason\": \"short why\"}. \
Heuristic: Claude for planning/thinking/ambiguity; Codex for concrete edits. \
Phase weights: brainstorm/plan/review -> Claude; implement/refactor/test -> Codex.";
    let user = format!("Phase: {}\nPrompt: {}", req.phase, req.prompt);
    let body = ChatRequest {
        model: req.model,
        max_tokens: None,
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
    let cleaned = extract_json(&raw);
    serde_json::from_str(&cleaned).map_err(|e| format!("parse route json: {e}; got: {raw}"))
}

/// Strip Markdown code fences and any prose around the JSON object,
/// returning the substring between the first `{` and the matching last `}`.
/// Models often wrap responses in ```json ... ``` despite instructions; this
/// is a belt-and-suspenders fallback so a single non-compliant reply does not
/// fail the whole card.
fn extract_json(s: &str) -> String {
    let trimmed = s.trim();
    let start = trimmed.find('{');
    let end = trimmed.rfind('}');
    match (start, end) {
        (Some(a), Some(b)) if b >= a => trimmed[a..=b].to_string(),
        _ => trimmed.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::extract_json;

    #[test]
    fn strips_markdown_json_fence() {
        let s = "```json\n{ \"summary\": \"x\", \"outcome\": \"y\" }\n```";
        assert_eq!(
            extract_json(s),
            "{ \"summary\": \"x\", \"outcome\": \"y\" }"
        );
    }

    #[test]
    fn strips_prose_around_json() {
        let s = "Here is the JSON: { \"agent\": \"codex\", \"reason\": \"edit\" } end";
        assert_eq!(
            extract_json(s),
            "{ \"agent\": \"codex\", \"reason\": \"edit\" }"
        );
    }

    #[test]
    fn passthrough_when_already_bare() {
        let s = "{\"a\":1}";
        assert_eq!(extract_json(s), "{\"a\":1}");
    }
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
