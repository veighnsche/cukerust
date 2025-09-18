use crate::{CoreWorld, Index, Stats};
use crate::{given, when, then};

#[given(regex = r"^index has (\d+) steps$")]
pub async fn index_has(world: &mut CoreWorld, n: usize) {
    world.index = Some(Index { stats: Stats { total: n } });
}

#[when(regex = r"^noop$")]
pub async fn noop(_world: &mut CoreWorld) {}

#[then(regex = r"^the index contains (\d+) steps$")]
pub async fn index_contains(world: &mut CoreWorld, n: usize) {
    let idx = world.index.as_ref().expect("index built");
    assert_eq!(idx.stats.total, n);
}