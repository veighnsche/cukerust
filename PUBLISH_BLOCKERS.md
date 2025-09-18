# CukeRust — Publish Blockers Checklist

Use this when you are about to publish the VS Code extension (and optionally push GitHub releases and publish Rust crates). Everything must be checked before publishing to the Marketplace.

## Marketplace Account & Auth

- [ ] VS Code Marketplace publisher exists and matches `extension/package.json` `publisher`
- [ ] Logged in with `vsce`: `npx @vscode/vsce login <publisher>` (uses Personal Access Token)
- [ ] 2FA and org permissions verified (if applicable)

## Extension Metadata (extension/package.json)

- [ ] `name` (scoped or regular) and `displayName` finalized
- [ ] `publisher` set to your real publisher id (not `your-publisher`)
- [ ] `version` bumped (SemVer) and matches CHANGELOG
- [ ] `repository.url`, `license`, and `categories` correct
- [ ] `engines.vscode` compatible with minimum supported VS Code
- [ ] `icon` set (recommended `images/icon.png`, 128×128 or 256×256 PNG)
- [ ] Optional: `galleryBanner` (e.g., `{ "color": "#111", "theme": "dark" }`)
- [ ] `files` includes all assets needed at runtime (e.g., `out/**`, `native/**`, `images/**`, README, LICENSE, CHANGELOG)
- [ ] Activation events and contributes blocks accurate and minimal

## Assets & Build

- [ ] Icon file exists at `extension/images/icon.png` (or path referenced by `icon`)
- [ ] WASM bundle present in `extension/native/**` (run `npm run build:wasm`)
- [ ] TypeScript built to `extension/out/**` (run `npm run build:ts` or `npm run build`)
- [ ] No large unneeded files leak into the VSIX (audit with `npx @vscode/vsce ls`)

## Quality Gates (Pre‑Publish)

- [ ] CI green across OS matrix for Node and Rust jobs
- [ ] Lint passes (TS/ESLint) — warnings triaged
- [ ] Rust fmt and clippy clean — no warnings
- [ ] BDD (core) passing: `cd rust && cargo test -p cukerust_core --test bdd`
- [ ] Extension host smoke test (F5): no crashes; commands operate correctly

## Licensing & Compliance

- [ ] `LICENSE-MIT` and `LICENSE-APACHE` present; root `license` in package.json matches
- [ ] Third‑party licenses complied with (WASM dependencies, npm packages)
- [ ] No telemetry or only opt‑in; documented in README (if any)

## README / Marketplace Page

- [ ] README contains: features, quickstart, commands, settings, screenshots/gifs
- [ ] Badges (CI, version, license) updated
- [ ] Links to docs (`.docs/`) and troubleshooting

## Dry Run & Publish

- [ ] Dry run packaging: `cd extension && npm run build && npx @vscode/vsce package`
- [ ] Inspect VSIX contents: `npx @vscode/vsce ls <generated>.vsix`
- [ ] Publish: `npx @vscode/vsce publish` (or `npx @vscode/vsce publish <version>`)
- [ ] Confirm Marketplace listing renders icon and images correctly

## GitHub Release (Optional but Recommended)

- [ ] Tag pushed (e.g., `vX.Y.Z`)
- [ ] Release notes derived from CHANGELOG
- [ ] Attach built VSIX for convenience (if distributing outside Marketplace)

## Rust Crates (Optional)

- [ ] If publishing `cukerust_core` or `cukerust_wasm` to crates.io:
  - [ ] Update `Cargo.toml` metadata (description, repository, license, keywords)
  - [ ] `cargo publish --dry-run`
  - [ ] `cargo publish`
