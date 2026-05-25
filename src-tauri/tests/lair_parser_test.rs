use terax_lib::lair::parser_client::{summarize_output, SummarizeRequest};

#[tokio::test]
#[ignore]
async fn summarizes_short_output() {
    let api_key = std::env::var("OPENROUTER_API_KEY").expect("set OPENROUTER_API_KEY");
    let req = SummarizeRequest {
        agent: "claude".into(),
        raw_output: "Refactored auth.ts into 3 files. Tests: 12 passed.".into(),
        phase: "implement".into(),
        api_key,
        model: "anthropic/claude-haiku-4.5".into(),
    };
    let res = summarize_output(req).await.expect("ok");
    assert!(!res.summary.is_empty());
    assert!(!res.outcome.is_empty());
}
