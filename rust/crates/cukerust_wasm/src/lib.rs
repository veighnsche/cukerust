use wasm_bindgen::prelude::*;
use cukerust_core::step_index as core;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct Input {
    files: Vec<core::SourceFile>,
}

/// JSON FFI: accepts `{ files: Array<{ path, text }>}\n` and returns StepIndex JSON.
#[wasm_bindgen]
pub fn extract_step_index(input_json: &str) -> String {
    match serde_json::from_str::<Input>(input_json) {
        Ok(input) => {
            let idx = core::extract_step_index_from_files(&input.files);
            serde_json::to_string(&idx).unwrap_or_else(|e| error_json(&format!("serde: {e}")))
        }
        Err(e) => error_json(&format!("input: {e}")),
    }
}

fn error_json(msg: &str) -> String {
    format!("{{\"error\":\"{}\"}}", escape_json(msg))
}

fn escape_json(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"")
}
