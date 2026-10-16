# NSFW Safe History

**Chromium extension (Edge and other Chromium-based browsers) for private browsing hygiene:** remove adult sites from history as soon as they are visited, and optionally blur NSFW media on-device — without uploading your media.

[![Microsoft Edge Add-ons](https://img.shields.io/badge/Edge%20Add--ons-Install-0078D4?logo=microsoftedge&logoColor=white)](https://microsoftedge.microsoft.com/addons/detail/nsfw-safe-history/ajhlgoaigfcfjlhmkghchilnponmdfoa)
[![Latest release](https://img.shields.io/github/v/release/artechio/NSFW-Safe-History?label=release)](https://github.com/artechio/NSFW-Safe-History/releases/latest)
[![Build](https://img.shields.io/github/actions/workflow/status/artechio/NSFW-Safe-History/build-extension.yml?branch=main&label=build)](https://github.com/artechio/NSFW-Safe-History/actions/workflows/build-extension.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

NSFW Safe History is a Manifest V3 extension for people who want **history privacy**, **adult content filtering**, and optional **local NSFW media blur** in one lightweight tool. It matches visited hosts against an on-device adult-domain list, deletes matching history entries immediately, and can run [nsfwjs](https://github.com/infinitered/nsfwjs) classification in the browser so image bytes never leave your machine.

## Install from Microsoft Edge Add-ons

Install from the [Microsoft Edge Add-ons listing](https://microsoftedge.microsoft.com/addons/detail/nsfw-safe-history/ajhlgoaigfcfjlhmkghchilnponmdfoa).

## Why use it

| Need | What you get |
| --- | --- |
| Clean browser history | Adult and included domains are removed on visit |
| On-page protection | Images, videos, and media ads can be blurred after local classification (off by default) |
| Privacy-first design | No image upload; weekly domain-list fetch only |
| Control | Filter this site, included sites, excluded NSFW hosts, blur strength, detection threshold |

## Features

- **Instant history cleanup** — matches the page hostname (and parent hosts) against a domain set in IndexedDB, then deletes that URL from history
- **Filter this site** — on by default only for NSFW-list hosts; turn on to include a normal site, turn off to exclude an adult host
- **On-device NSFW blur** — off by default; when on, blurs images, video, and media iframes only when `Porn` or `Hentai` scores meet your threshold (`Sexy` alone does not blur)
- **Listed-site media blur** — on known adult hosts, blurs images, videos, and media ad iframes right away
- **Captcha-safe** — leaves reCAPTCHA, hCaptcha, Cloudflare Turnstile, and similar challenges usable
- **Manual clean ranges** — clear matching history for today, this week, this month, or all time from the popup
- **Included & excluded lists** — add extra hosts to always filter; opt out of NSFW-list hosts you want untouched
- **Modern UI** — popup and options rebuilt with shadcn/ui (mira)

## Privacy

- Classification runs **locally** in an offscreen document (TensorFlow.js / nsfwjs).
- Image pixels are **not uploaded**.
- The extension’s only standalone network request is the optional weekly refresh of the adult-domain list.
- You choose blur intensity, detection threshold, included sites, and which NSFW hosts are excluded.

## Install from GitHub Release

1. Open the [latest release](https://github.com/artechio/NSFW-Safe-History/releases/latest).
2. Download `nsfw-safe-history-*.zip` and unzip it.
3. Go to `edge://extensions` or `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**.
4. Select the unzipped folder (the one that contains `manifest.json`).

## Install from source

```bash
npm install
npm install --prefix ext-ui
npm test
npm run build
```

Then load the `dist/` folder as an unpacked extension.

Optional maintainers scripts:

- `npm run update-blocklist` — refresh `assets/blocklist.txt` from the Steven Black porn-only hosts list  
- `npm run download-model` — refresh bundled MobileNet weights in `assets/model/`  
- `npm run generate-icons` — rebuild toolbar PNGs plus `assets/icons/light` and `assets/icons/dark` from `assets/icon.svg`

## Settings

| Control | Where |
| --- | --- |
| Filter this site / blur toggle / history range | Popup |
| Master protection, auto-delete, blur strength, threshold, included & excluded domains, blocklist update | Options page |

## How it works (short)

1. Hostnames are checked against the NSFW domain set plus your included list (Set lookup + parent walk).
2. Matching visits are deleted via `chrome.history` as they happen, unless the host is excluded.
3. When blur is on, visible media is classified on-device (or blurred immediately on listed adult sites).
4. Captcha frames and widgets are skipped so challenges stay readable.

See [CHANGELOG.md](CHANGELOG.md) for version history.

## Tech stack

- Chrome Manifest V3 (service worker, offscreen document, content scripts)
- Domain matching + IndexedDB blocklist cache
- nsfwjs / MobileNet for local classification
- Webpack for core scripts; Vite + React + Tailwind + shadcn/ui for popup & options

## Keywords

`chrome extension` · `edge extension` · `nsfw filter` · `history cleaner` · `adult content blocker` · `privacy` · `on-device blur` · `manifest v3` · `nsfwjs`

## License

MIT. See [LICENSE](LICENSE).

Third-party:

- Domain list: [Steven Black porn-only hosts](https://github.com/StevenBlack/hosts)
- Classification: [nsfwjs](https://github.com/infinitered/nsfwjs)
