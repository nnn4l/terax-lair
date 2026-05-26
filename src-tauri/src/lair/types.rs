use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Agent {
    Claude,
    Codex,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AgentChoice {
    Claude,
    Codex,
    Compare,
    Auto,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Phase {
    Brainstorm,
    Plan,
    Implement,
    Refactor,
    Test,
    Review,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum CardStatus {
    Streaming,
    Summarizing,
    Done,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Usage {
    pub tokens_in: u32,
    pub tokens_out: u32,
    pub cost_usd: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CardData {
    pub id: String,
    pub agent: Agent,
    pub status: CardStatus,
    pub raw_output: String,
    pub summary: Option<String>,
    pub outcome: Option<String>,
    pub error: Option<String>,
    pub usage: Option<Usage>,
    pub model: Option<String>,
    pub effort: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendMessageRequest {
    pub turn_id: String,
    pub prompt: String,
    pub agent_choice: AgentChoice,
    pub phase: Phase,
    pub workspace: String,
    pub claude_model: Option<String>,
    pub codex_model: Option<String>,
    pub claude_effort: Option<String>,
    pub codex_effort: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamChunkEvent {
    pub card_id: String,
    pub chunk: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CardUpdateEvent {
    pub turn_id: String,
    pub card: CardData,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NarrationLine {
    pub id: String,
    pub text: String,
    pub timestamp_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NarrationEvent {
    pub line: NarrationLine,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Worktree {
    pub path: String,
    pub branch: Option<String>,
}
