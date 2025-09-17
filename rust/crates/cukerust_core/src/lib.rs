//! cukerust_core: Pure Rust algorithms and types used by the CukeRust extension.
//! Keep this crate platform-agnostic and free of I/O.

pub mod step_index;

/// Returns the crate version at compile time (useful for debugging).
pub fn version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

/// Placeholder normalization function.
/// In future, implement regex normalization and matching tiers here.
pub fn normalize_step_text(input: &str) -> String {
    input.trim().to_string()
}
