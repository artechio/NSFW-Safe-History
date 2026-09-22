const fs = require('fs');
const path = require('path');
const https = require('https');

const base = 'https://cdn.jsdelivr.net/gh/infinitered/nsfwjs@master/models/mobilenet_v2/';
const dir = path.join(__dirname, '../assets/model');

function download(url) {
    return new Promise((resolve, reject) => {
        https.get(url, response => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                download(response.headers.location).then(resolve, reject);
                return;
            }
            if (response.statusCode !== 200) {
                reject(new Error(`Download failed ${response.statusCode}: ${url}`));
                return;
            }
            const chunks = [];
            response.on('data', chunk => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks)));
        }).on('error', reject);
    });
}

async function main() {
    fs.mkdirSync(dir, { recursive: true });
    const model = await download(`${base}model.json`);
    fs.writeFileSync(path.join(dir, 'model.json'), model);
    const manifest = JSON.parse(model.toString('utf8')).weightsManifest || [];
    const files = new Set();
    manifest.forEach(group => (group.paths || []).forEach(file => files.add(file)));
    for (const file of files) {
        const bytes = await download(base + file);
        fs.writeFileSync(path.join(dir, file), bytes);
        console.log(`Wrote ${file} (${bytes.length} bytes)`);
    }
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
