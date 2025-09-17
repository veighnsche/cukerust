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
    CoreWorld::cucumber()
        .run_and_exit(PathBuf::from("features"))
        .await;
}
