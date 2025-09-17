use cucumber::World;
use std::path::PathBuf;

#[derive(Debug, Default, World, Clone)]
pub struct CoreWorld {
    pub files: Vec<cukerust_core::step_index::SourceFile>,
    pub index: Option<cukerust_core::step_index::StepIndex>,
}

mod steps;

#[tokio::main]
async fn main() {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
    let features = match std::env::var("CUKERUST_BDD_FEATURE_PATH").ok() {
        Some(p) => {
            let pb = PathBuf::from(p);
            if pb.is_absolute() { pb } else { root.join(pb) }
        }
        None => root.join("features"),
    };
    CoreWorld::cucumber()
        .fail_on_skipped()
        .run_and_exit(features)
        .await;
}
