use cukerust_wasm::extract_step_index;
#[test]
fn json_round_trip() {
    let input = serde_json::json!({
        "files": [
            { "path": "src/steps.rs", "text": ".given(r\"^I have (\\d+) cukes$\");" },
            { "path": "src/steps.rs", "text": "when!(r\"^eat$\", || {});" },
            { "path": "src/steps.rs", "text": "#[then(regex = r\"^done$\")] fn ok() {}" }
        ]
    })
    .to_string();

    let out = extract_step_index(&input);
    let v: serde_json::Value = serde_json::from_str(&out).expect("valid JSON");
    assert!(v.get("steps").and_then(|s| s.as_array()).map(|a| a.len()).unwrap_or(0) >= 3);
}
