const fs = require('fs');
const path = require('path');
const https = require('https');
const { BLOCKLIST_URL, parseHosts } = require('../src/lib/domains');

const outputFile = path.join(__dirname, '../assets/blocklist.txt');

function download(url) {
    return new Promise((resolve, reject) => {
        https.get(url, response => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                download(response.headers.location).then(resolve, reject);
                return;
            }
            if (response.statusCode !== 200) {
                reject(new Error(`Blocklist download failed: ${response.statusCode}`));
                return;
            }
            const chunks = [];
            response.on('data', chunk => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        }).on('error', reject);
    });
}

download(BLOCKLIST_URL)
    .then(text => {
        const domains = parseHosts(text).sort();
        if (!domains.length) throw new Error('Parsed blocklist was empty');
        fs.mkdirSync(path.dirname(outputFile), { recursive: true });
        fs.writeFileSync(outputFile, `${domains.join('\n')}\n`);
        console.log(`Wrote ${domains.length} domains to ${outputFile}`);
    })
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
