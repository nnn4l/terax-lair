#[tokio::test]
#[ignore]
async fn compress_m1_fixture_returns_valid_tree() {
    let fixture = std::fs::read_to_string("tests/fixtures/m1-plan.md").expect("fixture missing");
    let cfg = terax_lib::lair::orchestrator::LairConfig {
        openrouter_model: "anthropic/claude-haiku-4.5".into(),
    };
    let nodes = terax_lib::lair::parser_client::compress_spec(&fixture, &cfg)
        .await
        .expect("compress_spec failed");
    assert!(!nodes.is_empty(), "should produce at least 1 task");
    assert!(
        nodes.iter().any(|node| !node.children.is_empty()),
        "at least one task should have children"
    );
}

#[tokio::test]
#[ignore]
async fn judge_outcome_classifies_success() {
    let cfg = terax_lib::lair::orchestrator::LairConfig {
        openrouter_model: "anthropic/claude-haiku-4.5".into(),
    };
    let output = "Refactored auth.rs into 3 files. All tests pass. No errors.";
    let outcome = terax_lib::lair::parser_client::judge_outcome(output, &cfg)
        .await
        .expect("judge_outcome failed");
    assert_eq!(
        outcome,
        terax_lib::lair::types::CompletionOutcome::Done
    );
}
