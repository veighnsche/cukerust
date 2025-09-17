pub fn register_steps(registry: &mut ()) {
    // dummy registry just to produce lines for static scan examples
    // Given
    println!("{}", r#".given(r"^I have (\d+) cukes$")"#);
    // When
    println!("{}", r#".when(r"^I eat (\d+)$")"#);
    // Then (macro style)
    println!("{}", "then!(r\"^done$\", || {})");
}
