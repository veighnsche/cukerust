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
        StepIndex { steps, stats }
    }
}

pub fn extract_step_index_from_files(files: &[SourceFile]) -> StepIndex {
    let mut out: Vec<StepEntry> = Vec::new();

    // Pre-compile lightweight detectors for builder/macro lines (only detect call and kind).
    let builder_re = Regex::new("\\.(given|when|then)\\s*\\(").unwrap();
    let macro_re = Regex::new("\\b(given|when|then)!\\s*\\(").unwrap();
    let attr_re = Regex::new("#\\[\\s*(given|when|then)[^\\]]*\\]").unwrap();

    for sf in files {
        for (i, line) in sf.text.lines().enumerate() {
            let lineno = i + 1;
            // Builder chains: .given/.when/.then(r"…")
            if let Some(cap) = builder_re.captures(line) {
                let kind = kind_from_lower(cap.get(1).map(|m| m.as_str()).unwrap_or(""));
                if let Some(open) = line.find('(') {
                    let after = &line[open + 1..];
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
                        continue;
                    }
                }
            }

            // Macros: given!/when!/then!(r"…", ...)
            if let Some(cap) = macro_re.captures(line) {
                let kind = kind_from_lower(cap.get(1).map(|m| m.as_str()).unwrap_or(""));
                if let Some(open) = line.find('(') {
                    let after = &line[open + 1..];
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
                        continue;
                    }
                }
            }

            // Attribute macros: #[given/when/then(...)] on the same line
            if attr_re.is_match(line) {
                if let Some(attr_cap) = attr_re.captures(line) {
                    let kind = kind_from_lower(attr_cap.get(1).map(|m| m.as_str()).unwrap_or(""));
                    // Try to extract literal from inside the attribute's brackets
                    if let Some(start) = line.find('[') {
                        if let Some(end) = line[start..].find(']') {
                            let inside = &line[start + 1..start + end];
                            if let Some(regex_text) = extract_first_string_literal(inside) {
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
                                continue;
                            }
                        }
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
