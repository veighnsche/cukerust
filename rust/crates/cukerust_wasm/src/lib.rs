use wasm_bindgen::prelude::*;
use cukerust_core::step_index as core;
use serde::{Deserialize, Serialize};
use regex::Regex;

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
    serde_json::json!({ "error": msg }).to_string()
}

// No custom escaping needed; serde_json handles it.

// -------- Matching Engine (Phase 1) --------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MatchQuery {
    kind: String,         // "Given" | "When" | "Then"
    body: String,
    mode: Option<String>, // "anchored" | "smart" | "substring"
}

#[derive(Debug, Deserialize)]
struct MatchInput {
    steps: Vec<core::StepEntry>,
    query: MatchQuery,
}

#[wasm_bindgen]
pub fn match_steps(input_json: &str) -> String {
    let parsed: MatchInput = match serde_json::from_str(input_json) {
        Ok(v) => v,
        Err(e) => return error_json(&format!("input: {e}")),
    };
    let kind = match parsed.query.kind.as_str() {
        "Given" => core::StepKind::Given,
        "When" => core::StepKind::When,
        _ => core::StepKind::Then,
    };
    let body = parsed.query.body.trim();
    let mode = parsed.query.mode.as_deref().unwrap_or("smart");
    let mut out: Vec<core::StepEntry> = Vec::new();
    for s in parsed.steps.into_iter() {
        if s.kind != kind { continue; }
        let pattern = match pattern_for_mode(&s.regex, mode) {
            Some(p) => p,
            None => continue,
        };
        if let Ok(re) = Regex::new(&pattern) {
            if re.is_match(body) {
                out.push(s);
            }
        }
    }
    serde_json::to_string(&out).unwrap_or_else(|e| error_json(&format!("serde: {e}")))
}

fn pattern_for_mode(regex: &str, mode: &str) -> Option<String> {
    match mode {
        "anchored" => {
            let mut p = regex.to_string();
            if !p.starts_with('^') { p.insert(0, '^'); }
            if !p.ends_with('$') { p.push('$'); }
            Some(p)
        }
        "smart" => {
            let anchored = regex.starts_with('^') || regex.ends_with('$');
            Some(if anchored { regex.to_string() } else { format!("^{}$", regex) })
        }
        "substring" => Some(regex.to_string()),
        _ => None,
    }
}

// -------- Diagnostics Engine (Phase 2 & 3) --------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DiagnosticsConfig {
    dialect: Option<String>,    // "auto" | "en" | "es"
    match_mode: Option<String>, // "anchored" | "smart" | "substring"
}

#[derive(Debug, Deserialize)]
struct DiagnosticsInput {
    feature_text: String,
    config: Option<DiagnosticsConfig>,
    steps: Vec<core::StepEntry>,
}

#[derive(Debug, Serialize)]
struct DiagnosticOut {
    line: usize, // 0-based
    message: String,
    severity: &'static str, // "warning"
}

#[wasm_bindgen]
pub fn diagnostics_for_feature(input_json: &str) -> String {
    let parsed: DiagnosticsInput = match serde_json::from_str(input_json) {
        Ok(v) => v,
        Err(e) => return error_json(&format!("input: {e}")),
    };
    let text = parsed.feature_text;
    let cfg = parsed.config.unwrap_or(DiagnosticsConfig { dialect: Some("auto".into()), match_mode: Some("smart".into()) });
    let dialect_code = detect_dialect(&text, cfg.dialect.as_deref().unwrap_or("auto"));
    let dialect = get_dialect(dialect_code);
    let step_re = build_step_keyword_regex(&dialect);
    let lines: Vec<&str> = text.split('\n').collect();
    let mut last_kind: Option<core::StepKind> = None;
    let mut diags: Vec<DiagnosticOut> = Vec::new();
    let mode = cfg.match_mode.as_deref().unwrap_or("smart");

    for (i, line) in lines.iter().enumerate() {
        if let Some(cap) = step_re.captures(line) {
            let keyword = cap.get(1).map(|m| m.as_str()).unwrap_or("");
            let body = cap.get(2).map(|m| m.as_str()).unwrap_or("");
            let mut kind = kind_from_keyword(keyword, &dialect).unwrap_or(core::StepKind::Given);
            if dialect.and.iter().any(|k| *k == keyword) || dialect.but.iter().any(|k| *k == keyword) {
                if let Some(prev) = last_kind { kind = prev; }
            } else {
                last_kind = Some(kind);
            }
            let oc = extract_outline_context(&lines, i);
            if oc.is_outline && !oc.examples.is_empty() && body.contains('<') && body.contains('>') {
                let mut any_ok = false;
                let mut any_amb = false;
                for row in oc.examples.iter() {
                    let resolved = resolve_placeholders(body, row);
                    let matches = match_one(&parsed.steps, kind, &resolved, mode);
                    if matches.len() > 1 { any_amb = true; }
                    if !matches.is_empty() { any_ok = true; }
                }
                if !any_ok {
                    diags.push(DiagnosticOut { line: i, message: "Undefined step (none of the Examples values match)".into(), severity: "warning" });
                } else if any_amb {
                    diags.push(DiagnosticOut { line: i, message: "Ambiguous step (one or more Examples values have multiple matches)".into(), severity: "warning" });
                }
            } else {
                let matches = match_one(&parsed.steps, kind, body, mode);
                if matches.is_empty() {
                    diags.push(DiagnosticOut { line: i, message: "Undefined step".into(), severity: "warning" });
                } else if matches.len() > 1 {
                    diags.push(DiagnosticOut { line: i, message: "Ambiguous step".into(), severity: "warning" });
                }
            }
        }
    }

    serde_json::to_string(&serde_json::json!({ "diags": diags }))
        .unwrap_or_else(|e| error_json(&format!("serde: {e}")))
}

fn match_one<'a>(steps: &'a [core::StepEntry], kind: core::StepKind, body: &str, mode: &str) -> Vec<&'a core::StepEntry> {
    let norm = body.trim();
    let mut out = Vec::new();
    for s in steps.iter() {
        if s.kind != kind { continue; }
        if let Some(p) = pattern_for_mode(&s.regex, mode) {
            if let Ok(re) = Regex::new(&p) {
                if re.is_match(norm) { out.push(s); }
            }
        }
    }
    out
}

// -------- Dialect helpers (Phase 3) --------

struct Dialect {
    given: Vec<&'static str>,
    when: Vec<&'static str>,
    then: Vec<&'static str>,
    and: Vec<&'static str>,
    but: Vec<&'static str>,
}

fn detect_dialect(text: &str, configured: &str) -> &'static str {
    if configured != "auto" { return if configured == "es" { "es" } else { "en" }; }
    let re = Regex::new(r"(?m)^\s*#\s*language:\s*([A-Za-z0-9_-]+)").unwrap();
    if let Some(cap) = re.captures(text) {
        let code = cap.get(1).map(|m| m.as_str().to_lowercase()).unwrap_or_default();
        if code.starts_with("es") { return "es"; }
    }
    "en"
}

fn get_dialect(code: &str) -> Dialect {
    match code {
        "es" => Dialect {
            given: vec!["Dado", "Dada"],
            when: vec!["Cuando"],
            then: vec!["Entonces"],
            and: vec!["Y"],
            but: vec!["Pero"],
        },
        _ => Dialect {
            given: vec!["Given"],
            when: vec!["When"],
            then: vec!["Then"],
            and: vec!["And"],
            but: vec!["But"],
        },
    }
}

fn build_step_keyword_regex(d: &Dialect) -> Regex {
    let mut kws: Vec<String> = Vec::new();
    for s in d.given.iter().chain(d.when.iter()).chain(d.then.iter()).chain(d.and.iter()).chain(d.but.iter()) {
        kws.push(regex::escape(s));
    }
    let alt = kws.join("|");
    Regex::new(&format!(r"^\s*({})\s+(.+)$", alt)).unwrap()
}

fn kind_from_keyword(kw: &str, d: &Dialect) -> Option<core::StepKind> {
    if d.given.iter().any(|k| *k == kw) { return Some(core::StepKind::Given); }
    if d.when.iter().any(|k| *k == kw) { return Some(core::StepKind::When); }
    if d.then.iter().any(|k| *k == kw) { return Some(core::StepKind::Then); }
    None
}

#[derive(Default)]
struct OutlineContext<'a> {
    is_outline: bool,
    examples: Vec<std::collections::HashMap<&'a str, String>>, // header->value
}

fn extract_outline_context<'a>(lines: &'a [&'a str], line_index: usize) -> OutlineContext<'a> {
    // walk upwards for Scenario Outline
    let mut is_outline = false;
    let mut start: isize = -1;
    for i in (0..=line_index).rev() {
        let t = lines[i].trim();
        if t.to_ascii_lowercase().starts_with("scenario outline:") { is_outline = true; start = i as isize; break; }
        if t.to_ascii_lowercase().starts_with("scenario:") || t.to_ascii_lowercase().starts_with("feature:") { break; }
    }
    if !is_outline || start < 0 { return OutlineContext::default(); }
    // find nearest Examples
    let mut ex_start: isize = -1;
    for i in (start as usize + 1)..lines.len() {
        let t = lines[i].trim();
        if t.to_ascii_lowercase().starts_with("examples:") { ex_start = i as isize; break; }
        if t.to_ascii_lowercase().starts_with("scenario") { break; }
    }
    if ex_start < 0 { return OutlineContext { is_outline: true, examples: Vec::new() }; }
    // read table
    let mut header: Vec<&str> = Vec::new();
    let mut rows: Vec<std::collections::HashMap<&str, String>> = Vec::new();
    let mut i = ex_start as usize + 1;
    while i < lines.len() {
        let raw = lines[i];
        if !raw.trim().starts_with('|') {
            if raw.trim().is_empty() { i += 1; continue; }
            break;
        }
        let cells: Vec<&str> = raw.trim().trim_start_matches('|').trim_end_matches('|').split('|').map(|s| s.trim()).collect();
        if header.is_empty() {
            header = cells;
        } else {
            let mut row = std::collections::HashMap::new();
            for (c, h) in header.iter().enumerate() {
                let v = cells.get(c).cloned().unwrap_or("");
                row.insert(*h, v.to_string());
            }
            rows.push(row);
        }
        i += 1;
    }
    OutlineContext { is_outline: true, examples: rows }
}

fn resolve_placeholders<'a>(body: &str, row: &std::collections::HashMap<&'a str, String>) -> String {
    let re = Regex::new(r"<([^>]+)>").unwrap();
    re.replace_all(body, |caps: &regex::Captures| {
        let name = caps.get(1).map(|m| m.as_str()).unwrap_or("");
        row.get(name).cloned().unwrap_or_else(|| format!("<{}>", name))
    }).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use cukerust_core::step_index as core;

    fn step(kind: core::StepKind, regex: &str, file: &str, line: usize) -> core::StepEntry {
        core::StepEntry { kind, regex: regex.into(), file: file.into(), line, function: None, captures: None, tags: None, notes: None }
    }

    #[test]
    fn test_pattern_for_mode() {
        assert_eq!(pattern_for_mode("a", "anchored").unwrap(), "^a$");
        assert_eq!(pattern_for_mode("^a$", "anchored").unwrap(), "^a$");
        assert_eq!(pattern_for_mode("a", "smart").unwrap(), "^a$");
        assert_eq!(pattern_for_mode("^a$", "smart").unwrap(), "^a$");
        assert_eq!(pattern_for_mode("a", "substring").unwrap(), "a");
    }

    #[test]
    fn test_match_one_basic() {
        let steps = vec![
            step(core::StepKind::Given, r"^I have (\d+) cukes$", "src/steps.rs", 10),
            step(core::StepKind::When, r"I eat (.+)", "src/steps.rs", 20),
            step(core::StepKind::Then, r"^done$", "src/steps.rs", 30),
        ];
        let m = match_one(&steps, core::StepKind::Given, "I have 5 cukes", "anchored");
        assert_eq!(m.len(), 1);
        assert_eq!(m[0].line, 10);
        let m2 = match_one(&steps, core::StepKind::When, "I eat apples", "smart");
        assert_eq!(m2.len(), 1);
        assert_eq!(m2[0].line, 20);
        let m3 = match_one(&steps, core::StepKind::Given, "done", "anchored");
        assert!(m3.is_empty());
    }

    #[test]
    fn test_diagnostics_basic_and_outline() {
        let steps = vec![
            step(core::StepKind::Given, r"^I have (\d+) cukes$", "src/steps.rs", 10),
            step(core::StepKind::Then, r"^done$", "src/steps.rs", 30),
        ];
        let feature = r#"Feature: Sample
  Scenario: Basic
    Given I have 5 cukes
    Then done

  Scenario Outline: Out
    Given I have <n> cukes
  Examples:
    | n |
    | 1 |
    | 2 |
"#;
        let input = serde_json::json!({
            "feature_text": feature,
            "config": { "dialect": "en", "match_mode": "smart" },
            "steps": steps,
        }).to_string();
        let out = diagnostics_for_feature(&input);
        let v: serde_json::Value = serde_json::from_str(&out).unwrap();
        let diags = v.get("diags").and_then(|d| d.as_array()).cloned().unwrap_or_default();
        // No diagnostics expected
        assert!(diags.is_empty(), "expected no diagnostics, got {:?}", diags);
    }

    #[test]
    fn test_diagnostics_undefined_and_ambiguous() {
        // Duplicate Given step causes ambiguity
        let steps = vec![
            step(core::StepKind::Given, r"^I have (\d+) cukes$", "src/steps.rs", 10),
            step(core::StepKind::Given, r"^I have (\d+) cukes$", "src/steps.rs", 11),
            step(core::StepKind::Then, r"^done$", "src/steps.rs", 30),
        ];
        let feature = r#"Feature: Sample
  Scenario: Ambiguous and undefined
    Given I have 5 cukes
    When I do a thing
    Then done
"#;
        let input = serde_json::json!({
            "feature_text": feature,
            "config": { "dialect": "en", "match_mode": "smart" },
            "steps": steps,
        }).to_string();
        let out = diagnostics_for_feature(&input);
        let v: serde_json::Value = serde_json::from_str(&out).unwrap();
        let diags = v.get("diags").and_then(|d| d.as_array()).cloned().unwrap_or_default();
        // Expect at least 1 ambiguous (Given) and 1 undefined (When)
        let msgs: Vec<String> = diags.iter().map(|d| d.get("message").and_then(|m| m.as_str()).unwrap_or("").to_string()).collect();
        assert!(msgs.iter().any(|m| m.contains("Ambiguous step")), "no ambiguous diag in {:?}", msgs);
        assert!(msgs.iter().any(|m| m.contains("Undefined step")), "no undefined diag in {:?}", msgs);
    }
}
