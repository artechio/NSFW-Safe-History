# Changelog

All notable changes to NSFW Safe History are documented here.

## [2.0.8] — 2026-09-22

### Added
- GitHub Actions packs a signed **CRX3** release asset when `EXTENSION_PRIVATE_KEY` is set
- `npm run pack:crx` and signing docs (`docs/SIGNING.md`)

## [2.0.7] — 2026-09-22

### Changed
- README rewritten for clearer product positioning and discoverability
- GitHub Release notes now pull from `CHANGELOG.md` with install steps and links
- Store / package descriptions tightened for Chrome Web Store–style clarity

## [2.0.6] — 2026-09-22

### Added
- Popup and options UI rebuilt with **shadcn/ui (mira)** (Vite + React + Tailwind)
- Captcha-aware blur skipping (reCAPTCHA, hCaptcha, Turnstile, Arkose, and related frames)

### Changed
- Extension build now chains webpack (core) with the Vite UI app into `dist/`

## [2.0.5] — 2026-09-22

### Fixed
- Captcha widgets and provider iframes were incorrectly blurred on listed sites and via iframe ad heuristics

## [2.0.4] — 2026-09-22

### Fixed
- Ads inside iframes and CSS background images were not blurred reliably on listed adult tabs

## [2.0.3] — 2026-09-22

### Fixed
- History clear counts reporting `0` when the popup message channel dropped
- Media blur reliability on listed sites and model/offscreen edge cases

## [2.0.2] — 2026-09-22

### Changed
- Clear-all history requires an explicit confirmation

## [2.0.1] — 2026-09-22

### Added
- Popup range selector for cleaning today / week / month / all matching history

## [2.0.0] — 2026-09-22

### Added
- Domain-set matching with IndexedDB cache
- Immediate history deletion for listed / adult-titled visits
- On-device nsfwjs blur for classified media
- Options for protection, blur strength, threshold, custom domains, and exclusions
