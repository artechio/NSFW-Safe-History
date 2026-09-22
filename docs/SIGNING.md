# Extension signing (CRX)

GitHub Actions can pack a signed **CRX3** file on every `main` release using a stable private key.

## Why a private key

Chrome extension IDs are derived from the public key. Reusing the same PEM keeps the ID stable across releases (`bbikojhkfehmocjmpgaipgmlcahipamn` for the key generated with this setup).

## Add the GitHub secret

1. Open **Settings → Secrets and variables → Actions** in this repo.
2. Create a secret named `EXTENSION_PRIVATE_KEY`.
3. Paste the full PEM contents (including `-----BEGIN … KEY-----` / `-----END … KEY-----`).

The private key is **not** committed to git (see `*.pem` in `.gitignore`).

If you received a generated key from the cloud agent artifacts (`extension-signing-key.pem`), use that exact file so the extension ID stays the same.

## Local pack

```bash
npm run build
EXTENSION_PRIVATE_KEY="$(cat /path/to/extension.pem)" npm run pack:crx
# or
npm run pack:crx -- --key /path/to/extension.pem --crx nsfw-safe-history.crx
```

## Notes

- ZIP (Load unpacked) remains the recommended install path for most users.
- Sideloaded `.crx` files may show `CRX_REQUIRED_PROOF_MISSING` unless Developer mode is enabled; that is a Chrome policy for non–Web Store packages, not a pack failure.
