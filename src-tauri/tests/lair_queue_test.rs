use terax_lib::lair::orchestrator::scan_for_result_marker;
use terax_lib::lair::queue::Queue;
use terax_lib::lair::types::{Agent, AutopilotMode, CompletionOutcome, QueueItem};

fn leaf(id: &str, label: &str) -> QueueItem {
    QueueItem {
        id: id.to_string(),
        label: label.to_string(),
        context: String::new(),
        source: None,
        agent_hint: None,
        children: vec![],
        checked: false,
        stale: false,
    }
}

fn parent(id: &str, label: &str, children: Vec<QueueItem>) -> QueueItem {
    QueueItem {
        id: id.to_string(),
        label: label.to_string(),
        context: String::new(),
        source: None,
        agent_hint: Some(Agent::Codex),
        children,
        checked: false,
        stale: false,
    }
}

#[test]
fn current_is_first_unchecked_leaf_dfs() {
    let q = Queue::new(
        vec![
            parent("t1", "Task 1", vec![leaf("s1", "Step 1"), leaf("s2", "Step 2")]),
            parent("t2", "Task 2", vec![leaf("s3", "Step 3")]),
        ],
        AutopilotMode::Off,
    );
    assert_eq!(q.current().map(|item| item.id.as_str()), Some("s1"));
}

#[test]
fn check_done_advances_cursor() {
    let mut q = Queue::new(
        vec![parent("t1", "Task 1", vec![leaf("s1", "Step 1"), leaf("s2", "Step 2")])],
        AutopilotMode::Off,
    );
    q.check("s1", CompletionOutcome::Done);
    assert_eq!(q.current().map(|item| item.id.as_str()), Some("s2"));
}

#[test]
fn approval_gate_fires_on_top_level_boundary_in_task_mode() {
    let mut q = Queue::new(
        vec![
            parent("t1", "Task 1", vec![leaf("s1", "Step 1")]),
            parent("t2", "Task 2", vec![leaf("s2", "Step 2")]),
        ],
        AutopilotMode::Task,
    );
    q.check("s1", CompletionOutcome::Done);
    assert_eq!(q.needs_approval_gate(), Some("t2".to_string()));
}

#[test]
fn approval_gate_does_not_fire_in_full_mode() {
    let mut q = Queue::new(
        vec![
            parent("t1", "Task 1", vec![leaf("s1", "Step 1")]),
            parent("t2", "Task 2", vec![leaf("s2", "Step 2")]),
        ],
        AutopilotMode::Full,
    );
    q.check("s1", CompletionOutcome::Done);
    assert_eq!(q.needs_approval_gate(), None);
}

#[test]
fn approval_gate_fires_on_each_next_leaf_in_subtask_mode() {
    let mut q = Queue::new(
        vec![parent("t1", "Task 1", vec![leaf("s1", "Step 1"), leaf("s2", "Step 2")])],
        AutopilotMode::Subtask,
    );
    q.check("s1", CompletionOutcome::Done);
    assert_eq!(q.needs_approval_gate(), Some("s2".to_string()));
}

#[test]
fn pin_overrides_cursor() {
    let mut q = Queue::new(
        vec![parent("t1", "Task 1", vec![leaf("s1", "Step 1"), leaf("s2", "Step 2")])],
        AutopilotMode::Off,
    );
    q.pin("s2");
    assert_eq!(q.current().map(|item| item.id.as_str()), Some("s2"));
}

#[test]
fn unpin_restores_auto_cursor() {
    let mut q = Queue::new(
        vec![parent("t1", "Task 1", vec![leaf("s1", "Step 1"), leaf("s2", "Step 2")])],
        AutopilotMode::Off,
    );
    q.pin("s2");
    q.unpin();
    assert_eq!(q.current().map(|item| item.id.as_str()), Some("s1"));
}

#[test]
fn check_failed_does_not_advance_cursor() {
    let mut q = Queue::new(
        vec![parent("t1", "Task 1", vec![leaf("s1", "Step 1"), leaf("s2", "Step 2")])],
        AutopilotMode::Off,
    );
    q.check("s1", CompletionOutcome::Failed);
    assert_eq!(q.current().map(|item| item.id.as_str()), Some("s1"));
}

#[test]
fn skip_advances_without_checking() {
    let mut q = Queue::new(
        vec![parent("t1", "Task 1", vec![leaf("s1", "Step 1"), leaf("s2", "Step 2")])],
        AutopilotMode::Off,
    );
    q.skip();
    assert_eq!(q.current().map(|item| item.id.as_str()), Some("s2"));
    let s1 = q
        .items()
        .iter()
        .flat_map(|item| &item.children)
        .find(|item| item.id == "s1")
        .unwrap();
    assert!(!s1.checked);
}

#[test]
fn marker_done() {
    assert_eq!(
        scan_for_result_marker("some output\nRESULT: done"),
        Some(CompletionOutcome::Done)
    );
}

#[test]
fn marker_partial() {
    assert_eq!(
        scan_for_result_marker("RESULT: partial"),
        Some(CompletionOutcome::NeedsReview)
    );
}

#[test]
fn marker_failed() {
    assert_eq!(
        scan_for_result_marker("result: failed"),
        Some(CompletionOutcome::Failed)
    );
}

#[test]
fn no_marker() {
    assert_eq!(scan_for_result_marker("No marker here at all."), None);
}
