use crate::lair::types::{Agent, Phase};

pub fn system_prompt_for(phase: &Phase, agent: &Agent) -> String {
    match (phase, agent) {
        (Phase::Implement, Agent::Claude) => {
            "You are in IMPLEMENT phase. Write working code. \
Follow existing patterns and conventions exactly. \
No refactoring beyond what is needed. No scope creep."
                .into()
        }
        (Phase::Implement, Agent::Codex) => {
            "IMPLEMENT phase. Write code. Follow existing patterns. No scope creep.".into()
        }
        (Phase::Refactor, Agent::Claude) => {
            "You are in REFACTOR phase. No new features. No scope expansion. \
Only structural improvements: naming, dedup, decomposition, type tightening. \
If you see a bug, flag it but do not fix it."
                .into()
        }
        (Phase::Refactor, Agent::Codex) => {
            "REFACTOR phase. Rename, dedup, decompose, tighten types only. \
No new features. Flag bugs, do not fix.".into()
        }
        (Phase::Test, Agent::Claude) => {
            "You are in TEST phase. Write tests that cover the specified behavior. \
Do not change production code unless fixing a test-blocking bug you also report. \
Prefer unit tests; add integration tests only for cross-boundary invariants."
                .into()
        }
        (Phase::Test, Agent::Codex) => {
            "TEST phase. Write tests. Do not change production code unless blocking. \
Unit first, integration only at boundaries.".into()
        }
        (Phase::Critique, Agent::Claude) => {
            "You are in CRITIQUE phase. The user is critiquing this implementation. \
Each user message describes a concrete change they want applied. \
Apply the change directly. Re-read the design pillars before each edit; pillars are anchors. \
Be terse in any narration. Code over commentary."
                .into()
        }
        (Phase::Critique, Agent::Codex) => {
            "CRITIQUE phase. User describes concrete changes; apply them. \
Re-read pillars before each edit. No commentary unless asked.".into()
        }
        (Phase::Review, _) => {
            "You are in REVIEW phase. Read the code critically. \
Report bugs, security issues, and design problems. \
Do not make changes. Output a structured list: severity, file, line, description."
                .into()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_combinations_non_empty() {
        for phase in [
            Phase::Implement,
            Phase::Refactor,
            Phase::Test,
            Phase::Critique,
            Phase::Review,
        ] {
            for agent in [Agent::Claude, Agent::Codex] {
                let prompt = system_prompt_for(&phase, &agent);
                assert!(!prompt.is_empty(), "empty prompt for {phase:?} + {agent:?}");
            }
        }
    }

    #[test]
    fn refactor_forbids_new_features() {
        let p = system_prompt_for(&Phase::Refactor, &Agent::Claude);
        assert!(p.contains("No new features"));
    }

    #[test]
    fn critique_mentions_pillars() {
        let p = system_prompt_for(&Phase::Critique, &Agent::Claude);
        assert!(p.contains("pillars"));
    }

    #[test]
    fn implement_codex_terse() {
        let p = system_prompt_for(&Phase::Implement, &Agent::Codex);
        assert!(p.len() < 200);
    }
}
