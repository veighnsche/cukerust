use cucumber::{given, then, when};
use cukerust_core::step_index::{extract_step_index_from_files, SourceFile};
use crate::CoreWorld;

#[given("a Rust file with attribute given")]
async fn a_file_with_attr_given(world: &mut CoreWorld) {
    world.files.push(SourceFile {
        path: "steps_attr.rs".into(),
        text: "#[given(regex = r\"^given$\")]\nfn g() {}".into(),
    });
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
