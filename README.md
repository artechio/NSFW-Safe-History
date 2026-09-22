# NSFW Safe History

A Chrome extension that removes known adult sites from history as soon as they are visited, and blurs individual images only after an on-device model classifies them as adult.

Classification runs in the browser. Image bytes are not uploaded. The only network request the extension makes on its own is the weekly adult-domain list update.

## What it does

- Matches the hostname (and parent hostnames) against a domain set stored in IndexedDB.
- Deletes that URL from Chrome history in `history.onVisited`, and again when the on-device model flags an image on the page.
- Blurs only images whose `Porn` or `Hentai` score is at or above the threshold. A high `Sexy` score alone does not blur.
- Leaves excluded hostnames untouched.
- Leaves captcha widgets and captcha provider frames (reCAPTCHA, hCaptcha, Turnstile, etc.) unblurred so challenges stay usable.
- Does not scan page text, and does not delete every history entry for a domain.
- Classifies video posters only, not every video frame. Text-only pages that are not on the domain list stay in history.

## Install from source

1. `npm install`
2. `npm test`
3. `npm run build`
4. Open `chrome://extensions`, enable Developer mode, and load the `dist` folder.

`npm run update-blocklist` refreshes `assets/blocklist.txt` from the Steven Black porn-only hosts list. `npm run download-model` refreshes the bundled MobileNet weights in `assets/model/`. `npm run generate-icons` rebuilds the PNG icons from `assets/icon.svg`.

## Settings

Protection, blur strength, detection threshold, custom domains, excluded sites, and the manual history range live on the options page. The popup turns filtering off for the current site, toggles blur, and runs a manual history clean.

## License

MIT. See [LICENSE](LICENSE). The domain list is the [Steven Black porn-only hosts list](https://github.com/StevenBlack/hosts). Image classification uses [nsfwjs](https://github.com/infinitered/nsfwjs).
