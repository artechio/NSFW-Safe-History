# Extension signing (optional / advanced)

Chrome **does not allow** installing self-signed `.crx` files by drag-and-drop or double-click. You will see:

```text
Package is invalid: 'CRX_REQUIRED_PROOF_MISSING'
```

That is Chrome policy since ~v75: only Chrome Web Store packages carry Google’s required proof. A CRX we sign ourselves is valid CRX3, but Chrome still blocks sideload install for normal users.

## What to use instead

**ZIP + Load unpacked** (supported path):

1. Download `nsfw-safe-history-*.zip` from [Releases](https://github.com/artechio/NSFW-Safe-History/releases/latest)
2. Unzip
3. `chrome://extensions` → Developer mode → **Load unpacked** → select the folder with `manifest.json`

## Optional local CRX pack

`npm run pack:crx` can still build a CRX3 for enterprise / update-server experiments. It will **not** install via drag-drop in consumer Chrome.

```bash
npm run build
npm run pack:crx -- --key /path/to/extension.pem --crx nsfw-safe-history.crx
```

Keep any private key out of git (`*.pem` is gitignored). Stable IDs need a reused PEM; see `EXTENSION_PRIVATE_KEY` only if you run a private update channel.
