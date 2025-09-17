use cucumber::{given, then, when};
use cucumber::gherkin::Step;
use cukerust_core::step_index::{extract_step_index_from_files, SourceFile};
use crate::CoreWorld;

#[given("a Rust file with attribute given")]
async fn a_file_with_attr_given(world: &mut CoreWorld) {
    world.files.push(SourceFile {
        path: "steps_attr.rs".into(),
        text: "#[given(regex = r\"^given$\")]\nfn g() {}".into(),
    });
}

#[then(regex = r#"^there is a step with kind \"(Given|When|Then)\" and regex \"(.*)\" from file \"([^\"]+)\" at line (\d+) with function \"([^\"]+)\"$"#)]
async fn there_is_step_with_kind_regex_file_line_function(
    world: &mut CoreWorld,
    kind: String,
    regex: String,
    file: String,
    line: usize,
    function: String,
) {
    use cukerust_core::step_index::StepKind;
    let idx = world.index.as_ref().expect("index built");
    let target_kind = match kind.as_str() {
        "Given" => StepKind::Given,
        "When" => StepKind::When,
        _ => StepKind::Then,
    };
    let found = idx.steps.iter().any(|s| s.kind == target_kind && s.regex == regex && s.file == file && s.line == line && s.function.as_deref() == Some(function.as_str()));
    assert!(found, "expected step not found with function name");
}

#[given("a Rust file with attribute when")]
async fn a_file_with_attr_when(world: &mut CoreWorld) {
    world.files.push(SourceFile {
        path: "steps_attr.rs".into(),
        text: "#[when(regex = r\"^when$\")]\nfn w() {}".into(),
    });
}

#[given("a Rust file with attribute then")]
async fn a_file_with_attr_then(world: &mut CoreWorld) {
    world.files.push(SourceFile {
        path: "steps_attr.rs".into(),
        text: "#[then(regex = r\"^then$\")]\nfn t() {}".into(),
    });
}

#[given("a Rust file with builder given")]
async fn a_file_with_builder_given(world: &mut CoreWorld) {
    world.files.push(SourceFile {
        path: "steps_builder.rs".into(),
        text: "registry.given(r\"^I have (\\\\d+) cukes$\");".into(),
    });
}

#[given("a Rust file with macro then")]
async fn a_file_with_macro_then(world: &mut CoreWorld) {
    world.files.push(SourceFile {
        path: "steps_macro.rs".into(),
        text: "then!(r\"^it works$\", || {});".into(),
    });
}

#[given("a Rust file with macro given")]
async fn a_file_with_macro_given(world: &mut CoreWorld) {
    world.files.push(SourceFile {
        path: "steps_macro.rs".into(),
        text: "given!(r\"^start$\", || {});".into(),
    });
}

#[given("a Rust file with macro when")]
async fn a_file_with_macro_when(world: &mut CoreWorld) {
    world.files.push(SourceFile {
        path: "steps_macro.rs".into(),
        text: "when!(r\"^middle$\", || {});".into(),
    });
}

#[given("a Rust file with raw string pattern")]
async fn a_file_with_raw_string(world: &mut CoreWorld) {
    world.files.push(SourceFile {
        path: "steps_raw.rs".into(),
        text: r##"registry.when(r#"^a "quoted" word$"#);"##.into(),
    });
}

#[given("a Rust file with raw string pattern (multi)")]
async fn a_file_with_raw_string_multi(world: &mut CoreWorld) {
    world.files.push(SourceFile {
        path: "steps_raw_multi.rs".into(),
        text: r####"registry.when(r###"^multi # hash$"###);"####.into(),
    });
}

#[when("we extract the Step Index")]
async fn we_extract_step_index(world: &mut CoreWorld) {
    let idx = extract_step_index_from_files(&world.files);
    world.index = Some(idx);
}

#[then(regex = r"^the index contains (\d+) steps$")]
async fn index_contains(world: &mut CoreWorld, n: usize) {
    let idx = world.index.as_ref().expect("index built");
    assert_eq!(idx.stats.total, n);
}

#[then("the index has Given, When, Then kinds counted")]
async fn counts_by_kind(world: &mut CoreWorld) {
    let idx = world.index.as_ref().expect("index built");
    assert!(idx.stats.by_kind.given >= 1);
    assert!(idx.stats.by_kind.when >= 1);
    assert!(idx.stats.by_kind.then >= 1);
}

#[then(regex = r"^the index ambiguous count is (\d+)$")]
async fn ambiguous_count(world: &mut CoreWorld, n: usize) {
    let idx = world.index.as_ref().expect("index built");
    assert_eq!(idx.stats.ambiguous, n);
}

// Generic Given: push any Rust file content via DocString
#[given(regex = r#"^a Rust file \"([^\"]+)\" with content:$"#)]
async fn a_rust_file_with_content(world: &mut CoreWorld, path: String, step: &Step) {
    let text = step.docstring.clone().unwrap_or_default();
    world.files.push(SourceFile { path, text });
}

#[then("there are no steps")]
async fn there_are_no_steps(world: &mut CoreWorld) {
    let idx = world.index.as_ref().expect("index built");
    assert_eq!(idx.stats.total, 0);
}

#[then(regex = r#"^there is a step with kind \"(Given|When|Then)\" and regex \"(.*)\" from file \"([^\"]+)\" at line (\d+)$"#)]
async fn there_is_step_with_kind_regex_file_line(
    world: &mut CoreWorld,
    kind: String,
    regex: String,
    file: String,
    line: usize,
) {
    use cukerust_core::step_index::StepKind;
    let idx = world.index.as_ref().expect("index built");
    let target_kind = match kind.as_str() {
        "Given" => StepKind::Given,
        "When" => StepKind::When,
        _ => StepKind::Then,
    };
    let found = idx.steps.iter().any(|s| s.kind == target_kind && s.regex == regex && s.file == file && s.line == line);
    assert!(found, "expected step not found: kind={kind} regex={regex} file={file}:{line}");
}

#[then(regex = r#"^there is a step with kind \"(Given|When|Then)\" and regex \"(.*)\" from file \"([^\"]+)\"$"#)]
async fn there_is_step_with_kind_regex_file(
    world: &mut CoreWorld,
    kind: String,
    regex: String,
    file: String,
) {
    use cukerust_core::step_index::StepKind;
    let idx = world.index.as_ref().expect("index built");
    let target_kind = match kind.as_str() {
        "Given" => StepKind::Given,
        "When" => StepKind::When,
        _ => StepKind::Then,
    };
    let found = idx.steps.iter().any(|s| s.kind == target_kind && s.regex == regex && s.file == file);
    assert!(found, "expected step not found: kind={kind} regex={regex} file={file}");
}

#[then(regex = r#"^steps are ordered by file then line$"#)]
async fn steps_are_ordered(world: &mut CoreWorld) {
    let idx = world.index.as_ref().expect("index built");
    for w in idx.steps.windows(2) {
        let a = &w[0];
        let b = &w[1];
        let ord = a.file.cmp(&b.file).then(a.line.cmp(&b.line));
        assert!(ord != std::cmp::Ordering::Greater, "steps not ordered by (file, line)");
    }
}

#[then(regex = r#"^there is a step with kind \"(Given|When|Then)\" and exact regex from file \"([^\"]+)\" at line (\d+):$"#)]
async fn there_is_step_with_kind_exact_regex_file_line(
    world: &mut CoreWorld,
    kind: String,
    file: String,
    line: usize,
    step: &Step,
) {
    use cukerust_core::step_index::StepKind;
    let idx = world.index.as_ref().expect("index built");
    let target_kind = match kind.as_str() {
        "Given" => StepKind::Given,
        "When" => StepKind::When,
        _ => StepKind::Then,
    };
    let expected = step.docstring.clone().unwrap_or_default();
    let found = idx
        .steps
        .iter()
        .any(|s| s.kind == target_kind && s.regex == expected && s.file == file && s.line == line);
    assert!(found, "expected step not found with exact regex (including newlines)");
}
