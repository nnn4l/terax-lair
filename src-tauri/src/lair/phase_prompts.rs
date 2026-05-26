use crate::lair::types::{Agent, Phase};

pub fn system_prompt_for(phase: &Phase, agent: &Agent) -> String {
    match (phase, agent) {
        (Phase::Plan, _) => {
            "You are in PLAN phase. Produce a numbered implementation plan \
with clearly scoped tasks. No code yet. Flag all unknowns and risks before writing anything."
                .into()
        }
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
            Phase::Plan,
            Phase::Implement,
            Phase::Refactor,
            Phase::Test,
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
}
