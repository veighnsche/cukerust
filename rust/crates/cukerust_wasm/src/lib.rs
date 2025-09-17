use wasm_bindgen::prelude::*;
use cukerust_core::{normalize_step_text, version};

/// Minimal WASM entry point; accepts JSON and returns JSON (identity for now).
#[wasm_bindgen]
pub fn analyze_steps(files_json: &str) -> String {
    // Touch core so it's linked
    let _core_ver = version();
    // Placeholder: in future, parse and build a StepIndex here
    normalize_step_text(files_json)
}
