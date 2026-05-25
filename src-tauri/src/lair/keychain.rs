const SERVICE: &str = "terax-ai";
const ACCOUNT: &str = "openrouter-api-key";

#[cfg(any(target_os = "windows", target_os = "macos"))]
pub fn get_openrouter_key() -> Result<String, String> {
    if let Ok(v) = std::env::var("OPENROUTER_API_KEY") {
        if !v.is_empty() {
            return Ok(v);
        }
    }
    let entry =
        keyring::Entry::new(SERVICE, ACCOUNT).map_err(|e| format!("keyring entry: {e}"))?;
    match entry.get_password() {
        Ok(v) if !v.is_empty() => Ok(v),
        Ok(_) => Err("OpenRouter key is empty in keychain".into()),
        Err(keyring::Error::NoEntry) => Err(
            "OpenRouter key missing. Set it in Settings > AI > OpenRouter, or export OPENROUTER_API_KEY."
                .into(),
        ),
        Err(e) => Err(format!("keyring read: {e}")),
    }
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn get_openrouter_key() -> Result<String, String> {
    match std::env::var("OPENROUTER_API_KEY") {
        Ok(v) if !v.is_empty() => Ok(v),
        _ => Err(
            "On Linux, Lair currently reads OPENROUTER_API_KEY env only; the Terax file-store fallback is not wired up yet."
                .into(),
        ),
    }
}
