use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum StepKind {
    Given,
    When,
    Then,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct StepEntry {
    pub kind: StepKind,
    pub regex: String,
    pub file: String,
    pub line: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub function: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub captures: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct Stats {
    pub total: usize,
    pub by_kind: ByKind,
    pub ambiguous: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub generated_at: Option<String>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct ByKind {
    #[serde(rename = "Given")]
    pub given: usize,
    #[serde(rename = "When")]
    pub when: usize,
    #[serde(rename = "Then")]
    pub then: usize,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct StepIndex {
    pub steps: Vec<StepEntry>,
    pub stats: Stats,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SourceFile {
    pub path: String,
    pub text: String,
}

impl StepIndex {
    pub fn from_steps(mut steps: Vec<StepEntry>) -> Self {
        // Sort for stability
        steps.sort_by(|a, b| a.file.cmp(&b.file).then(a.line.cmp(&b.line)));
        let mut stats = Stats::default();
        stats.total = steps.len();
        for s in &steps {
            match s.kind {
                StepKind::Given => stats.by_kind.given += 1,
                StepKind::When => stats.by_kind.when += 1,
                StepKind::Then => stats.by_kind.then += 1,
            }
        }
        // Ambiguity: same (kind, regex) appears more than once
        use std::collections::HashMap;
        let mut map: HashMap<(StepKind, &str), usize> = HashMap::new();
        for s in &steps {
            *map.entry((s.kind.clone(), s.regex.as_str())).or_insert(0) += 1;
        }
        stats.ambiguous = map.values().filter(|&&c| c > 1).count();
        // Timestamp for artifact freshness consumers (skip on wasm32)
        #[cfg(not(target_arch = "wasm32"))]
        {
            stats.generated_at = Some(chrono::Utc::now().to_rfc3339());
        }
        StepIndex { steps, stats }
    }
}

pub fn extract_step_index_from_files(files: &[SourceFile]) -> StepIndex {
    let mut out: Vec<StepEntry> = Vec::new();

    // Pre-compile detectors for builder/macro lines (detect call and kind); allow generics like .given::<T>(
    let builder_re = Regex::new("\\.(given|when|then)\\s*(?:::<[^>]+>)?\\s*\\(").unwrap();
    let macro_re = Regex::new("\\b(given|when|then)!\\s*\\(").unwrap();
    // Multi-line attribute block matcher (DOTALL)
    let attr_block_re = Regex::new("(?s)#\\[\\s*(given|when|then)[^\\]]*\\]").unwrap();

    for sf in files {
        let stripped = strip_comments_preserving_strings(&sf.text);
        for (i, line) in stripped.lines().enumerate() {
            let lineno = i + 1;
            // Builder chains: .given/.when/.then(r"…"); collect all matches in a line
            for cap in builder_re.captures_iter(line) {
                let kind = kind_from_lower(cap.get(1).map(|m| m.as_str()).unwrap_or(""));
                if let Some(m0) = cap.get(0) {
                    let after = &line[m0.end()..];
                    if let Some(regex_text) = extract_first_string_literal(after) {
                        out.push(StepEntry {
                            kind,
                            regex: regex_text,
                            file: sf.path.clone(),
                            line: lineno,
                            function: None,
                            captures: None,
                            tags: None,
                            notes: None,
                        });
                    }
                }
            }

            // Macros: given!/when!/then!(r"…", ...); collect all matches in a line
            for cap in macro_re.captures_iter(line) {
                let kind = kind_from_lower(cap.get(1).map(|m| m.as_str()).unwrap_or(""));
                if let Some(m0) = cap.get(0) {
                    let after = &line[m0.end()..];
                    if let Some(regex_text) = extract_first_string_literal(after) {
                        out.push(StepEntry {
                            kind,
                            regex: regex_text,
                            file: sf.path.clone(),
                            line: lineno,
                            function: None,
                            captures: None,
                            tags: None,
                            notes: None,
                        });
                    }
                }
            }
        }

        // Attribute macros: scan across the stripped file text for multi-line #[given/when/then(...)] blocks
        for cap in attr_block_re.captures_iter(&stripped) {
            let kind = kind_from_lower(cap.get(1).map(|m| m.as_str()).unwrap_or(""));
            if let Some(m0) = cap.get(0) {
                let matched = &stripped[m0.start()..m0.end()];
                if let (Some(lb), Some(rb)) = (matched.find('['), matched.rfind(']')) {
                    let inside = &matched[lb + 1..rb];
                    if let Some(regex_text) = extract_first_string_literal(inside) {
                        // line number: count newlines up to match start
                        let lineno = stripped[..m0.start()].bytes().filter(|&b| b == b'\n').count() + 1;
                        // best-effort function name capture from the next few lines
                        let suffix = &stripped[m0.end()..];
                        let fn_scope: String = suffix.lines().take(4).collect::<Vec<_>>().join("\n");
                        let fn_re = Regex::new(r"(?m)^\s*fn\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(").unwrap();
                        let function = fn_re
                            .captures(&fn_scope)
                            .and_then(|c| c.get(1).map(|m| m.as_str().to_string()));
                        out.push(StepEntry {
                            kind,
                            regex: regex_text,
                            file: sf.path.clone(),
                            line: lineno,
                            function,
                            captures: None,
                            tags: None,
                            notes: None,
                        });
                    }
                }
            }
        }
    }

    StepIndex::from_steps(out)
}

fn kind_from_lower(s: &str) -> StepKind {
    match s.to_ascii_lowercase().as_str() {
        "given" => StepKind::Given,
        "when" => StepKind::When,
        _ => StepKind::Then,
    }
}

/// Extracts the first Rust string literal (normal or raw) from `s`
/// and returns its inner content without delimiters.
fn extract_first_string_literal(s: &str) -> Option<String> {
    let bytes = s.as_bytes();
    let len = bytes.len();
    let mut i = 0;
    while i < len {
        let b = bytes[i];
        if b == b'r' {
            // raw string: r#*" ... "#*
            let mut j = i + 1;
            let mut hashes = 0usize;
            while j < len && bytes[j] == b'#' {
                hashes += 1;
                j += 1;
            }
            if j < len && bytes[j] == b'"' {
                j += 1; // skip opening quote
                let start = j;
                // find closing match: '"' followed by `hashes` '#'
                while j < len {
                    if bytes[j] == b'"' {
                        let mut ok = true;
                        for h in 0..hashes {
                            if j + 1 + h >= len || bytes[j + 1 + h] != b'#' {
                                ok = false;
                                break;
                            }
                        }
                        if ok {
                            let end = j;
                            return Some(String::from_utf8_lossy(&bytes[start..end]).into_owned());
                        }
                    }
                    j += 1;
                }
                return None; // unterminated
            }
        }
        if b == b'"' {
            // normal string
            let mut j = i + 1;
            let mut out = String::new();
            while j < len {
                let c = bytes[j];
                if c == b'\\' {
                    if j + 1 >= len {
                        return None;
                    }
                    let e = bytes[j + 1];
                    match e {
                        b'"' => out.push('"'),
                        b'\\' => out.push('\\'),
                        b'n' => out.push('\n'),
                        b'r' => out.push('\r'),
                        b't' => out.push('\t'),
                        _ => {
                            // keep unknown escape sequences as-is
                            out.push('\\');
                            out.push(e as char);
                        }
                    }
                    j += 2;
                    continue;
                } else if c == b'"' {
                    return Some(out);
                } else {
                    out.push(c as char);
                    j += 1;
                }
            }
            return None; // unterminated
        }
        i += 1;
    }
    None
}

/// Remove line (// ...) and block (/* ... */) comments while preserving string literals and newlines.
fn strip_comments_preserving_strings(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = String::with_capacity(s.len());
    let mut i = 0;
    let len = bytes.len();
    let mut in_block = false;
    let mut in_normal = false;
    let mut in_raw = false;
    let mut raw_hashes = 0usize;
    while i < len {
        let b = bytes[i];
        if in_block {
            if b == b'*' && i + 1 < len && bytes[i + 1] == b'/' {
                in_block = false;
                out.push(' ');
                out.push(' ');
                i += 2;
            } else {
                // replace with spaces, preserve newlines
                if b == b'\n' { out.push('\n'); } else { out.push(' '); }
                i += 1;
            }
            continue;
        }
        if in_normal {
            out.push(b as char);
            if b == b'\\' {
                if i + 1 < len { out.push(bytes[i + 1] as char); i += 2; } else { i += 1; }
                continue;
            }
            if b == b'"' { in_normal = false; }
            i += 1;
            continue;
        }
        if in_raw {
            out.push(b as char);
            if b == b'"' {
                // check for closing raw string by matching hashes
                let mut ok = true;
                for h in 0..raw_hashes {
                    if i + 1 + h >= len || bytes[i + 1 + h] != b'#' { ok = false; break; }
                }
                if ok { in_raw = false; }
            }
            i += 1;
            continue;
        }
        // Not in any special mode
        if b == b'/' && i + 1 < len && bytes[i + 1] == b'/' {
            // line comment: replace rest of line with spaces
            while i < len && bytes[i] != b'\n' { out.push(' '); i += 1; }
            continue;
        }
        if b == b'/' && i + 1 < len && bytes[i + 1] == b'*' {
            in_block = true;
            out.push(' ');
            out.push(' ');
            i += 2;
            continue;
        }
        if b == b'r' {
            // possible raw string
            let mut j = i + 1; let mut hashes = 0usize;
            while j < len && bytes[j] == b'#' { hashes += 1; j += 1; }
            if j < len && bytes[j] == b'"' {
                in_raw = true; raw_hashes = hashes; out.push('r');
                for _ in 0..hashes { out.push('#'); }
                out.push('"');
                i = j + 1; continue;
            }
        }
        if b == b'"' {
            in_normal = true; out.push('"'); i += 1; continue;
        }
        out.push(b as char);
        i += 1;
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_raw_strings() {
        assert_eq!(extract_first_string_literal("r\"^foo$\""), Some("^foo$".to_string()));
        assert_eq!(extract_first_string_literal("r#\"a \"quoted\" word\"#"), Some("a \"quoted\" word".to_string()));
        assert_eq!(extract_first_string_literal("r###\"multi # hash\"###"), Some("multi # hash".to_string()));
    }

    #[test]
    fn test_extract_normal() {
        assert_eq!(extract_first_string_literal("\"hello\\nworld\""), Some("hello\nworld".to_string()));
    }

    #[test]
    fn test_extract_index_builder_macro_attr() {
        let files = vec![SourceFile {
            path: "src/steps.rs".into(),
            text: r#"
                fn register() {
                    registry.given(r"^I have (\\d+) cukes$");
                    registry.when("^I eat (.*)$");
                }
                given!(r"^start$", || {});
                #[then(regex = r"^done$")]
                fn ok() {}
            "#.into(),
        }];
        let idx = extract_step_index_from_files(&files);
        assert_eq!(idx.stats.total, 4);
        assert_eq!(idx.stats.by_kind.given, 2);
        assert_eq!(idx.stats.by_kind.when, 1);
        assert_eq!(idx.stats.by_kind.then, 1);
        assert!(idx.steps.iter().any(|s| s.regex.contains("^I have")));
    }
}
