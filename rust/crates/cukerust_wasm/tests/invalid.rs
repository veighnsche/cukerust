use cukerust_wasm::extract_step_index;

#[test]
fn invalid_input_returns_error_json() {
    let out = extract_step_index("not json");
    let v: serde_json::Value = serde_json::from_str(&out).expect("valid JSON");
    assert!(v.get("error").is_some(), "expected error field in JSON: {}", out);
}
