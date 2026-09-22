# NSFW Safe History

**Chrome extension for private browsing hygiene:** remove adult sites from Chrome history as soon as they are visited, and blur NSFW images on-device — without uploading your media.

[![Latest release](https://img.shields.io/github/v/release/artechio/NSFW-Safe-History?label=release)](https://github.com/artechio/NSFW-Safe-History/releases/latest)
[![Build](https://img.shields.io/github/actions/workflow/status/artechio/NSFW-Safe-History/build-extension.yml?branch=main&label=build)](https://github.com/artechio/NSFW-Safe-History/actions/workflows/build-extension.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

NSFW Safe History is a Manifest V3 Chrome extension for people who want **history privacy**, **adult content filtering**, and **local NSFW image blur** in one lightweight tool. It matches visited hosts against an on-device adult-domain list, deletes matching history entries immediately, and runs [nsfwjs](https://github.com/infinitered/nsfwjs) classification in the browser so image bytes never leave your machine.

## Why use it

| Need | What you get |
| --- | --- |
| Clean Chrome history | Adult and listed domains are removed on visit |
| On-page protection | Images, videos, and ads can be blurred after local classification |
| Privacy-first design | No image upload; weekly domain-list fetch only |
| Control | Per-site exclude, custom domains, blur strength, detection threshold |

Useful if you search for a **Chrome NSFW history cleaner**, **adult site history remover**, **local NSFW image blur extension**, or a **privacy-focused adult content filter** that does not rely on a cloud API.

## Features

- **Instant history cleanup** — matches the page hostname (and parent hosts) against a domain set in IndexedDB, then deletes that URL from Chrome history
- **On-device NSFW blur** — blurs media only when `Porn` or `Hentai` scores meet your threshold (`Sexy` alone does not blur)
- **Listed-site media blur** — on known adult hosts, blurs images, videos, iframes, and CSS background ads
- **Captcha-safe** — leaves reCAPTCHA, hCaptcha, Cloudflare Turnstile, and similar challenges usable
- **Manual clean ranges** — clear matching history for today, this week, this month, or all time from the popup
- **Exclusions & custom domains** — keep trusted sites untouched; add extra hosts to always clean
- **Modern UI** — popup and options rebuilt with shadcn/ui (mira)

## Privacy

- Classification runs **locally** in an offscreen document (TensorFlow.js / nsfwjs).
- Image pixels are **not uploaded**.
- The extension’s only standalone network request is the optional weekly refresh of the adult-domain list.
- You choose blur intensity, detection threshold, and which sites are excluded.

## Install from GitHub Release (recommended)

1. Open the [latest release](https://github.com/artechio/NSFW-Safe-History/releases/latest).
2. Download `nsfw-safe-history-*.zip` (or the `.crx` when published) and unzip the ZIP if needed.
3. Go to `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**.
4. Select the unzipped folder (the one that contains `manifest.json`).

Signed CRX builds are produced in CI when the `EXTENSION_PRIVATE_KEY` secret is configured. See [docs/SIGNING.md](docs/SIGNING.md).

## Install from source

```bash
npm install
npm install --prefix ext-ui
npm test
npm run build
```

Then load the `dist/` folder as an unpacked extension in Chrome.

Optional maintainers scripts:

- `npm run update-blocklist` — refresh `assets/blocklist.txt` from the Steven Black porn-only hosts list  
- `npm run download-model` — refresh bundled MobileNet weights in `assets/model/`  
- `npm run generate-icons` — rebuild PNG icons from `assets/icon.svg`

## Settings

| Control | Where |
| --- | --- |
| Filter current site / blur toggle / history range | Popup |
| Master protection, auto-delete, blur strength, threshold, custom & excluded domains, blocklist update | Options page |

## How it works (short)

1. Hostnames are checked against the domain set plus your custom list.
2. Matching visits are deleted via `chrome.history` as they happen.
3. Visible media is classified on-device (or blurred immediately on listed adult sites).
4. Captcha frames and widgets are skipped so challenges stay readable.

See [CHANGELOG.md](CHANGELOG.md) for version history.

## Tech stack

- Chrome Manifest V3 (service worker, offscreen document, content scripts)
- Domain matching + IndexedDB blocklist cache
- nsfwjs / MobileNet for local classification
- Webpack for core scripts; Vite + React + Tailwind + shadcn/ui for popup & options

## Keywords

`chrome extension` · `nsfw filter` · `history cleaner` · `adult content blocker` · `privacy` · `on-device blur` · `manifest v3` · `nsfwjs`

## License

MIT. See [LICENSE](LICENSE).

Third-party:

- Domain list: [Steven Black porn-only hosts](https://github.com/StevenBlack/hosts)
- Classification: [nsfwjs](https://github.com/infinitered/nsfwjs)
