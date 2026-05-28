use std::sync::{Arc, Mutex};

use terax_lib::lair::cli_agent::{run_agent_streaming, AgentSpawnRequest};
use terax_lib::lair::types::{CostTier, Lane, LaneRole};

#[tokio::test]
async fn streams_chunks_from_fake_command() {
    let chunks: Arc<Mutex<Vec<String>>> = Arc::new(Mutex::new(Vec::new()));
    let cb_chunks = chunks.clone();

    let req = AgentSpawnRequest {
        lane: Lane {
            id: "test".into(),
            label: "Test".into(),
            cli: "claude".into(),
            env: Default::default(),
            default_model: None,
            default_effort: None,
            role: LaneRole::Implementor,
            cost_tier: CostTier::Cheap,
            clear_required: false,
            backend: None,
            auto_bias: vec![],
            enabled: true,
            context_window: None,
        },
        prompt: "test".into(),
        system_prompt: String::new(),
        model_override: None,
        effort_override: None,
        cwd: ".".into(),
        card_id: "integration-streams-chunks".into(),
        program_override: Some(if cfg!(windows) {
            "cmd".into()
        } else {
            "sh".into()
        }),
        args_override: Some(if cfg!(windows) {
            vec!["/C".into(), "echo hello && echo world".into()]
        } else {
            vec!["-c".into(), "echo hello; echo world".into()]
        }),
    };

    let code = run_agent_streaming(req, move |chunk| {
        cb_chunks.lock().unwrap().push(chunk);
    })
    .await
    .expect("runs");

    assert_eq!(code, 0);
    let joined = chunks.lock().unwrap().join("");
    assert!(joined.contains("hello"));
    assert!(joined.contains("world"));
}
