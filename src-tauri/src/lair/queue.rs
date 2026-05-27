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

    pub fn drop_item(&mut self, id: &str) {
        Self::remove_id(&mut self.items, id);
        if self.cursor.as_deref() == Some(id) {
            self.cursor = self.find_first_unchecked_leaf();
        }
    }

    pub fn mark_done(&mut self, id: &str) {
        Self::set_checked(&mut self.items, id, true);
        if self.cursor.as_deref() == Some(id) {
            self.cursor = self.find_first_unchecked_leaf();
        }
    }

    pub fn edit_context(&mut self, id: &str, context: &str) {
        Self::set_context(&mut self.items, id, context);
    }

    pub fn all_leaves_checked(&self) -> bool {
        fn dfs(items: &[QueueItem]) -> bool {
            items.iter().all(|item| {
                if item.children.is_empty() {
                    item.checked
                } else {
                    dfs(&item.children)
                }
            })
        }
        dfs(&self.items)
    }

    fn remove_id(items: &mut Vec<QueueItem>, id: &str) {
        items.retain(|item| item.id != id);
        for item in items {
            Self::remove_id(&mut item.children, id);
        }
    }

    fn set_checked(items: &mut [QueueItem], id: &str, value: bool) {
        for item in items {
            if item.id == id {
                item.checked = value;
                return;
            }
            Self::set_checked(&mut item.children, id, value);
        }
    }

    fn set_context(items: &mut [QueueItem], id: &str, context: &str) {
        for item in items {
            if item.id == id {
                item.context = context.to_string();
                return;
            }
            Self::set_context(&mut item.children, id, context);
        }
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

#[cfg(test)]
mod tests {
    use super::*;

    fn mk_item(id: &str, children: Vec<QueueItem>) -> QueueItem {
        QueueItem {
            id: id.to_string(),
            label: id.to_string(),
            context: String::new(),
            source: None,
            agent_hint: None,
            children,
            checked: false,
            stale: false,
        }
    }

    #[test]
    fn drop_removes_item() {
        let items = vec![mk_item("a", vec![]), mk_item("b", vec![])];
        let mut q = Queue::new(items, AutopilotMode::Off);
        q.drop_item("a");
        assert_eq!(q.items().len(), 1);
        assert_eq!(q.items()[0].id, "b");
    }

    #[test]
    fn mark_done_checks_item() {
        let items = vec![mk_item("a", vec![])];
        let mut q = Queue::new(items, AutopilotMode::Off);
        q.mark_done("a");
        assert!(q.items()[0].checked);
    }

    #[test]
    fn edit_context_replaces_context() {
        let items = vec![mk_item("a", vec![])];
        let mut q = Queue::new(items, AutopilotMode::Off);
        q.edit_context("a", "new context");
        assert_eq!(q.items()[0].context, "new context");
    }

    #[test]
    fn all_leaves_checked_empty_queue_returns_true() {
        let q = Queue::new(vec![], AutopilotMode::Off);
        assert!(q.all_leaves_checked());
    }

    #[test]
    fn all_leaves_checked_returns_false_when_any_leaf_unchecked() {
        let items = vec![mk_item("a", vec![]), mk_item("b", vec![])];
        let mut q = Queue::new(items, AutopilotMode::Off);
        q.mark_done("a");
        assert!(!q.all_leaves_checked());
    }

    #[test]
    fn all_leaves_checked_returns_true_when_every_leaf_checked() {
        let items = vec![mk_item("a", vec![]), mk_item("b", vec![])];
        let mut q = Queue::new(items, AutopilotMode::Off);
        q.mark_done("a");
        q.mark_done("b");
        assert!(q.all_leaves_checked());
    }

    #[test]
    fn all_leaves_checked_recurses_into_children() {
        let leaf = mk_item("leaf", vec![]);
        let parent = mk_item("parent", vec![leaf]);
        let mut q = Queue::new(vec![parent], AutopilotMode::Off);
        assert!(!q.all_leaves_checked());
        q.mark_done("leaf");
        assert!(q.all_leaves_checked());
    }
}
