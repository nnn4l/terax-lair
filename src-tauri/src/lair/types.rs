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
    Implement,
    Refactor,
    Test,
    Critique,
    Review,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum CardStatus {
    Streaming,
    Summarizing,
    Done,
    Failed,
    Stopped,
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
    pub lane_id: String,
    #[serde(default)]
    pub use_auto: bool,
    pub phase: Phase,
    pub workspace: String,
    pub task_context: Option<QueueContext>,
    pub claude_model: Option<String>,
    pub codex_model: Option<String>,
    pub claude_effort: Option<String>,
    pub codex_effort: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpecRef {
    pub file: String,
    pub anchor: String,
    pub hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueItem {
    pub id: String,
    pub label: String,
    pub context: String,
    pub source: Option<SpecRef>,
    pub agent_hint: Option<Agent>,
    pub children: Vec<QueueItem>,
    pub checked: bool,
    pub stale: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum CompletionOutcome {
    Done,
    NeedsReview,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum QueueEvent {
    CursorAdvanced { from: String, to: Option<String> },
    ItemDispatched { id: String, agent: Agent },
    ItemCompleted { id: String, outcome: CompletionOutcome },
    Paused,
    Resumed,
    BlockedAwaitingApproval { id: String, reason: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AutopilotMode {
    Off,
    Subtask,
    Task,
    Full,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RawQueueNode {
    pub label: String,
    pub context: String,
    pub source_anchor: Option<String>,
    pub agent_hint: Option<String>,
    pub children: Vec<RawQueueNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SectionDiff {
    pub anchor: String,
    pub old_text: String,
    pub new_text: String,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StaleReport {
    pub item_id: String,
    pub spec_section: String,
    pub diff_summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PillarFinding {
    pub pillar: String,
    pub violation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueContext {
    pub item_id: String,
    pub label: String,
    pub context: String,
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum HubTabKind {
    Dashboard,
    Repo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HubTab {
    pub id: String,
    pub kind: HubTabKind,
    pub label: String,
    pub repo_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct HubState {
    pub tabs: Vec<HubTab>,
    pub active_tab_id: Option<String>,
}

// ---- M3: Lane types ----

pub type LaneId = String;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum LaneRole {
    Implementor,
    Reviewer,
    Consultant,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum CostTier {
    Free,
    Cheap,
    Standard,
    Expensive,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Lane {
    pub id: LaneId,
    pub label: String,
    pub cli: String,
    #[serde(default)]
    pub env: std::collections::HashMap<String, String>,
    pub default_model: Option<String>,
    pub default_effort: Option<String>,
    pub role: LaneRole,
    pub cost_tier: CostTier,
    #[serde(default)]
    pub clear_required: bool,
    pub backend: Option<String>,
    #[serde(default)]
    pub auto_bias: Vec<String>,
    #[serde(default = "default_true")]
    pub enabled: bool,
    pub context_window: Option<u32>,
}

fn default_true() -> bool {
    true
}

impl Default for LaneRole {
    fn default() -> Self {
        LaneRole::Implementor
    }
}

impl Default for CostTier {
    fn default() -> Self {
        CostTier::Standard
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LaneStatus {
    pub lane_id: LaneId,
    pub context_pct: Option<f32>,
    pub tokens_in: u32,
    pub tokens_out: u32,
    pub cost_usd: f32,
    pub last_updated_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum BackendStatus {
    Stopped,
    Starting,
    Running,
    Crashed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackendStatusEvent {
    pub id: String,
    pub status: BackendStatus,
}
