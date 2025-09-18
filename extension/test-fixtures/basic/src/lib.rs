//! Minimal demo crate for CukeRust showcase

// Re-export attribute macros for local use in modules: #[given], #[when], #[then]
pub use cukerust_demo_steps::{given, when, then};

// Minimal world/index types to let attribute-based steps compile
#[derive(Default, Debug, Clone)]
pub struct Stats {
    pub total: usize,
}

#[derive(Default, Debug, Clone)]
pub struct Index {
    pub stats: Stats,
}

#[derive(Default, Debug, Clone)]
pub struct CoreWorld {
    pub index: Option<Index>,
}

pub mod steps;
