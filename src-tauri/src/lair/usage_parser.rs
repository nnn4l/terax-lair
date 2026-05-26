use crate::lair::types::{Agent, Usage};

/// Extracts token counts and cost from CLI tail output.
/// Returns None on any parse miss; never panics.
pub fn parse_usage(raw_output: &str, agent: &Agent) -> Option<Usage> {
    match agent {
        Agent::Claude => parse_claude(raw_output),
        Agent::Codex => parse_codex(raw_output),
    }
}

fn parse_claude(raw: &str) -> Option<Usage> {
    // Claude CLI --print mode emits a stats block near the tail, e.g.:
    //   Input tokens: 1234
    //   Output tokens: 567
    //   Cost: $0.012
    // or compact: "Tokens: 1234 input, 567 output ($0.012)"
    let tokens_in = extract_u32(raw, &["Input tokens:", "tokens input,", "input tokens:"])
        .or_else(|| extract_compact_claude_in(raw))?;
    let tokens_out = extract_u32(raw, &["Output tokens:", "tokens output", "output tokens:"])
        .or_else(|| extract_compact_claude_out(raw))?;
    let cost_usd = extract_cost(raw).unwrap_or(0.0);
    Some(Usage { tokens_in, tokens_out, cost_usd })
}

fn parse_codex(raw: &str) -> Option<Usage> {
    // Codex CLI output stats, e.g.:
    //   prompt_tokens: 1234
    //   completion_tokens: 567
    //   total_cost: $0.012
    let tokens_in = extract_u32(raw, &["prompt_tokens:", "input_tokens:"])?;
    let tokens_out = extract_u32(raw, &["completion_tokens:", "output_tokens:"])?;
    let cost_usd = extract_cost(raw).unwrap_or(0.0);
    Some(Usage { tokens_in, tokens_out, cost_usd })
}

/// Search for any of the label strings in raw, then parse the first integer after it.
fn extract_u32(raw: &str, labels: &[&str]) -> Option<u32> {
    for label in labels {
        if let Some(pos) = find_ci(raw, label) {
            let after = raw[pos + label.len()..].trim_start();
            let num: String = after.chars().take_while(|c| c.is_ascii_digit()).collect();
            if let Ok(n) = num.parse::<u32>() {
                return Some(n);
            }
        }
    }
    None
}

/// "Tokens: 1234 input" → parse 1234
fn extract_compact_claude_in(raw: &str) -> Option<u32> {
    let pos = find_ci(raw, "Tokens:")?;
    let after = raw[pos + 7..].trim_start();
    let num: String = after.chars().take_while(|c| c.is_ascii_digit()).collect();
    num.parse::<u32>().ok()
}

/// "1234 input, 567 output" → parse 567
fn extract_compact_claude_out(raw: &str) -> Option<u32> {
    let pos = find_ci(raw, "input,")?;
    let after = raw[pos + 6..].trim_start();
    let num: String = after.chars().take_while(|c| c.is_ascii_digit()).collect();
    num.parse::<u32>().ok()
}

/// Find "$0.012" or "cost: $0.012" pattern; parse as f32.
fn extract_cost(raw: &str) -> Option<f32> {
    let dollar = raw.find('$')?;
    let after = &raw[dollar + 1..];
    let num: String = after
        .chars()
        .take_while(|c| c.is_ascii_digit() || *c == '.')
        .collect();
    num.parse::<f32>().ok()
}

fn find_ci(haystack: &str, needle: &str) -> Option<usize> {
    let lower_h = haystack.to_lowercase();
    let lower_n = needle.to_lowercase();
    lower_h.find(&lower_n)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn claude_multiline_format() {
        let raw = "some output\nInput tokens: 1234\nOutput tokens: 567\nCost: $0.012\n";
        let u = parse_usage(raw, &Agent::Claude).unwrap();
        assert_eq!(u.tokens_in, 1234);
        assert_eq!(u.tokens_out, 567);
        assert!((u.cost_usd - 0.012).abs() < 0.001);
    }

    #[test]
    fn claude_compact_format() {
        let raw = "done\nTokens: 800 input, 200 output ($0.005)\n";
        let u = parse_usage(raw, &Agent::Claude).unwrap();
        assert_eq!(u.tokens_in, 800);
        assert_eq!(u.tokens_out, 200);
        assert!((u.cost_usd - 0.005).abs() < 0.001);
    }

    #[test]
    fn codex_format() {
        let raw = "result\nprompt_tokens: 500\ncompletion_tokens: 150\ntotal_cost: $0.003\n";
        let u = parse_usage(raw, &Agent::Codex).unwrap();
        assert_eq!(u.tokens_in, 500);
        assert_eq!(u.tokens_out, 150);
    }

    #[test]
    fn miss_returns_none() {
        let raw = "no stats here at all";
        assert!(parse_usage(raw, &Agent::Claude).is_none());
    }
}
