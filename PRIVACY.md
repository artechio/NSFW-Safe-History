# NSFW Safe History privacy policy

NSFW Safe History cleans adult sites from browsing history and blurs NSFW images on the page. Classification runs on your device. We do not operate an account system and we do not sell user data.

## Data accessed on your device

- **Browsing history.** Visited URLs are read only to find and delete entries whose site matches the on-device adult-domain list or a site you added.
- **Website content.** Images on the page, and sometimes a video poster or frame, are read only to decide whether to blur them.
- **Settings.** Your choices (protection, auto-delete, blur strength, threshold, excluded sites, custom domains) are stored with the browser's extension storage.
- **Removal counts.** The number of visits removed (today and in total) is stored only in local extension storage on this device. It never includes which sites were removed.
- **Settings backups.** Exporting settings saves a JSON file of your switches and site lists to your computer. It contains no history.

## What leaves your device

Image pixels, page contents, and browsing history are not uploaded. To classify an image, the extension may re-read it from the browser cache or from the site that already served it, without cookies. The only network request is a weekly download of a public plain-text adult-domain list from [Steven Black's porn-only hosts list](https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/porn-only/hosts). No user data is sent with that request.

## Sharing

We do not sell or transfer user data to third parties, use it for purposes unrelated to history cleanup and on-device NSFW blur, or use it to determine creditworthiness or for lending.

## Contact

Questions and requests: [open an issue](https://github.com/artechio/NSFW-Safe-History/issues).
