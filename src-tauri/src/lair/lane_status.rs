use crate::lair::types::{LaneStatus, Usage};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

pub struct LaneStatusStore {
    inner: Mutex<HashMap<String, LaneStatus>>,
}

impl LaneStatusStore {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(HashMap::new()),
        }
    }

    pub fn record_card(
        &self,
        lane_id: &str,
        usage: &Usage,
        context_window: Option<u32>,
    ) -> LaneStatus {
        let mut guard = self.inner.lock().unwrap();
        let entry = guard
            .entry(lane_id.to_string())
            .or_insert_with(|| LaneStatus {
                lane_id: lane_id.to_string(),
                context_pct: None,
                tokens_in: 0,
                tokens_out: 0,
                cost_usd: 0.0,
                last_updated_ms: 0,
            });
        entry.tokens_in = entry.tokens_in.saturating_add(usage.tokens_in);
        entry.tokens_out = entry.tokens_out.saturating_add(usage.tokens_out);
        entry.cost_usd += usage.cost_usd;
        entry.context_pct = context_window.map(|w| {
            let total = (entry.tokens_in + entry.tokens_out) as f32;
            (total / w as f32).min(1.0)
        });
        entry.last_updated_ms = now_ms();
        entry.clone()
    }

    pub fn clear(&self, lane_id: &str) {
        if let Some(entry) = self.inner.lock().unwrap().get_mut(lane_id) {
            entry.tokens_in = 0;
            entry.tokens_out = 0;
            entry.cost_usd = 0.0;
            entry.context_pct = Some(0.0);
            entry.last_updated_ms = now_ms();
        }
    }

    pub fn get(&self, lane_id: &str) -> Option<LaneStatus> {
        self.inner.lock().unwrap().get(lane_id).cloned()
    }

    pub fn all(&self) -> Vec<LaneStatus> {
        self.inner.lock().unwrap().values().cloned().collect()
    }
}

impl Default for LaneStatusStore {
    fn default() -> Self {
        Self::new()
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn record_accumulates() {
        let store = LaneStatusStore::new();
        let u1 = Usage {
            tokens_in: 100,
            tokens_out: 50,
            cost_usd: 0.01,
        };
        let u2 = Usage {
            tokens_in: 200,
            tokens_out: 100,
            cost_usd: 0.02,
        };
        store.record_card("claude", &u1, Some(200_000));
        let after = store.record_card("claude", &u2, Some(200_000));
        assert_eq!(after.tokens_in, 300);
        assert_eq!(after.tokens_out, 150);
        assert!((after.cost_usd - 0.03).abs() < 0.0001);
        assert!(after.context_pct.unwrap() > 0.0 && after.context_pct.unwrap() < 0.01);
    }

    #[test]
    fn clear_resets() {
        let store = LaneStatusStore::new();
        store.record_card(
            "claude",
            &Usage {
                tokens_in: 100,
                tokens_out: 50,
                cost_usd: 0.01,
            },
            Some(200_000),
        );
        store.clear("claude");
        let after = store.get("claude").unwrap();
        assert_eq!(after.tokens_in, 0);
        assert_eq!(after.context_pct, Some(0.0));
    }

    #[test]
    fn context_pct_caps_at_one() {
        let store = LaneStatusStore::new();
        let u = Usage {
            tokens_in: 250_000,
            tokens_out: 100,
            cost_usd: 0.0,
        };
        let s = store.record_card("claude", &u, Some(200_000));
        assert_eq!(s.context_pct, Some(1.0));
    }
}
