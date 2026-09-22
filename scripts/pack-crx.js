#!/usr/bin/env node
/**
 * Pack dist/ into a signed CRX3 using EXTENSION_PRIVATE_KEY env
 * or --key path.pem.
 */
const fs = require('fs');
const path = require('path');
const crx3 = require('crx3');

function parseArgs(argv) {
  const out = { key: '', crx: '', dist: path.resolve('dist') };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--key') out.key = argv[++i];
    else if (arg === '--crx') out.crx = argv[++i];
    else if (arg === '--dist') out.dist = path.resolve(argv[++i]);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  const version = require('../package.json').version;
  const crxPath = args.crx || path.resolve(`nsfw-safe-history-${version}.crx`);
  const keyPath = args.key || path.resolve('.extension-key.pem');
  const createdFromEnv = Boolean(process.env.EXTENSION_PRIVATE_KEY);

  if (createdFromEnv) {
    fs.writeFileSync(keyPath, process.env.EXTENSION_PRIVATE_KEY.replace(/\\n/g, '\n'), {
      mode: 0o600
    });
  }

  if (!fs.existsSync(keyPath)) {
    console.error('Missing private key. Set EXTENSION_PRIVATE_KEY or pass --key path.pem');
    process.exit(1);
  }

  if (!fs.existsSync(path.join(args.dist, 'manifest.json'))) {
    console.error(`No built extension at ${args.dist}. Run npm run build first.`);
    process.exit(1);
  }

  try {
    await crx3([path.join(args.dist, 'manifest.json')], {
      keyPath,
      crxPath
    });
  } finally {
    if (createdFromEnv && fs.existsSync(keyPath)) {
      fs.unlinkSync(keyPath);
    }
  }

  if (!fs.existsSync(crxPath)) {
    console.error('CRX pack finished without creating an output file');
    process.exit(1);
  }

  console.log(`Packed ${crxPath}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
