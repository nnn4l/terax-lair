use crate::lair::types::{AutopilotMode, CompletionOutcome, QueueItem};

pub struct Queue {
    items: Vec<QueueItem>,
    cursor: Option<String>,
    pinned: bool,
    pub autopilot: AutopilotMode,
    pub paused: bool,
    pub stop_on_failure: bool,
    last_top_level: Option<String>,
    pending_gate: Option<String>,
}

impl Queue {
    pub fn new(items: Vec<QueueItem>, autopilot: AutopilotMode) -> Self {
        let mut q = Self {
            items,
            cursor: None,
            pinned: false,
            autopilot,
            paused: false,
            stop_on_failure: true,
            last_top_level: None,
            pending_gate: None,
        };
        q.cursor = q.find_first_unchecked_leaf();
        q.last_top_level = q.cursor.as_ref().and_then(|id| q.top_level_for(id));
        q
    }

    pub fn items(&self) -> &Vec<QueueItem> {
        &self.items
    }

    pub fn items_mut(&mut self) -> &mut Vec<QueueItem> {
        &mut self.items
    }

    pub fn current(&self) -> Option<&QueueItem> {
        self.cursor.as_ref().and_then(|id| self.find_by_id(id))
    }

    pub fn check(&mut self, id: &str, outcome: CompletionOutcome) {
        self.mark(id, &outcome);
        if outcome == CompletionOutcome::Failed {
            return;
        }
        if self.pinned {
            return;
        }
        let next = self.find_first_unchecked_leaf();
        if let Some(next_id) = &next {
            match self.autopilot {
                AutopilotMode::Subtask => {
                    self.pending_gate = Some(next_id.clone());
                }
                AutopilotMode::Task => {
                    let next_top = self.top_level_for(next_id);
                    if next_top != self.last_top_level {
                        self.pending_gate = next_top.clone();
                        self.last_top_level = next_top;
                    }
                }
                AutopilotMode::Off | AutopilotMode::Full => {}
            }
        }
        self.cursor = next;
    }

    pub fn skip(&mut self) {
        let next = self
            .cursor
            .as_ref()
            .and_then(|id| self.next_leaf_after(id));
        self.cursor = next;
    }

    pub fn pin(&mut self, id: &str) {
        self.cursor = Some(id.to_string());
        self.pinned = true;
    }

    pub fn unpin(&mut self) {
        self.pinned = false;
        self.cursor = self.find_first_unchecked_leaf();
    }

    pub fn pause(&mut self) {
        self.paused = true;
    }

    pub fn resume(&mut self) {
        self.paused = false;
    }

    pub fn set_autopilot(&mut self, mode: AutopilotMode) {
        self.autopilot = mode;
    }

    pub fn needs_approval_gate(&mut self) -> Option<String> {
        self.pending_gate.take()
    }

    fn find_first_unchecked_leaf(&self) -> Option<String> {
        fn dfs(items: &[QueueItem]) -> Option<String> {
            for item in items {
                if item.children.is_empty() {
                    if !item.checked {
                        return Some(item.id.clone());
                    }
                } else if let Some(id) = dfs(&item.children) {
                    return Some(id);
                }
            }
            None
        }
        dfs(&self.items)
    }

    fn find_by_id(&self, id: &str) -> Option<&QueueItem> {
        fn search<'a>(items: &'a [QueueItem], id: &str) -> Option<&'a QueueItem> {
            for item in items {
                if item.id == id {
                    return Some(item);
                }
                if let Some(found) = search(&item.children, id) {
                    return Some(found);
                }
            }
            None
        }
        search(&self.items, id)
    }

    fn mark(&mut self, id: &str, outcome: &CompletionOutcome) {
        fn mutate(items: &mut [QueueItem], id: &str, outcome: &CompletionOutcome) -> bool {
            for item in items {
                if item.id == id {
                    item.checked = *outcome == CompletionOutcome::Done;
                    return true;
                }
                if mutate(&mut item.children, id, outcome) {
                    return true;
                }
            }
            false
        }
        mutate(&mut self.items, id, outcome);
    }

    fn top_level_for(&self, id: &str) -> Option<String> {
        for item in &self.items {
            if item.id == id || contains_id(&item.children, id) {
                return Some(item.id.clone());
            }
        }
        None
    }

    fn next_leaf_after(&self, current_id: &str) -> Option<String> {
        fn collect(items: &[QueueItem], leaves: &mut Vec<String>) {
            for item in items {
                if item.children.is_empty() {
                    leaves.push(item.id.clone());
                } else {
                    collect(&item.children, leaves);
                }
            }
        }
        let mut leaves = Vec::new();
        collect(&self.items, &mut leaves);
        let pos = leaves.iter().position(|id| id == current_id)?;
        leaves.into_iter().nth(pos + 1)
    }
}

fn contains_id(items: &[QueueItem], id: &str) -> bool {
    for item in items {
        if item.id == id || contains_id(&item.children, id) {
            return true;
        }
    }
    false
}
