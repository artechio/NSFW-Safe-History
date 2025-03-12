const fs = require('fs');
const path = require('path');
const https = require('https');

const BLOCKLIST_URL = 'https://raw.githubusercontent.com/columndeeply/hosts/main/lists/porn.txt';
const OUTPUT_FILE = path.join(__dirname, '../assets/blocklist.txt');

// Create directory if it doesn't exist
const dir = path.dirname(OUTPUT_FILE);
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

// Download and process blocklist
https.get(BLOCKLIST_URL, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        // Process and clean the data
        const domains = data
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'))
            .sort();

        // Save to file
        fs.writeFileSync(OUTPUT_FILE, domains.join('\n'));
        console.log(`Updated blocklist with ${domains.length} domains`);
    });
}).on('error', (err) => {
    console.error('Error downloading blocklist:', err);
    process.exit(1);
}); 