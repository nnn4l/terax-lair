use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::Mutex;

pub struct ProcessRegistry {
    inner: Mutex<HashMap<String, u32>>, // card_id -> PID
}

impl ProcessRegistry {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(HashMap::new()),
        }
    }
    pub fn register(&self, card_id: String, pid: u32) {
        self.inner.lock().unwrap().insert(card_id, pid);
    }
    pub fn deregister(&self, card_id: &str) {
        self.inner.lock().unwrap().remove(card_id);
    }
    pub fn lookup(&self, card_id: &str) -> Option<u32> {
        self.inner.lock().unwrap().get(card_id).copied()
    }
    pub fn take(&self, card_id: &str) -> Option<u32> {
        self.inner.lock().unwrap().remove(card_id)
    }
}

impl Default for ProcessRegistry {
    fn default() -> Self {
        Self::new()
    }
}

pub static PROCESS_REGISTRY: Lazy<ProcessRegistry> = Lazy::new(ProcessRegistry::new);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn register_and_lookup_round_trip() {
        let reg = ProcessRegistry::new();
        reg.register("card-1".into(), 42);
        assert_eq!(reg.lookup("card-1"), Some(42));
    }

    #[test]
    fn deregister_removes() {
        let reg = ProcessRegistry::new();
        reg.register("card-1".into(), 42);
        reg.deregister("card-1");
        assert!(reg.lookup("card-1").is_none());
    }

    #[test]
    fn take_removes_entry() {
        let reg = ProcessRegistry::new();
        reg.register("card-1".into(), 42);
        assert!(reg.take("card-1").is_some());
        assert!(reg.lookup("card-1").is_none());
    }
}
