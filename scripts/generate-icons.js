const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const sizes = [16, 32, 48, 128];
const inputSvg = path.join(__dirname, '../assets/icon.svg');
const outputDir = path.join(__dirname, '../assets');

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Generate icons for each size
sizes.forEach(size => {
    sharp(inputSvg)
        .resize(size, size)
        .png()
        .toFile(path.join(outputDir, `icon${size}.png`))
        .then(() => console.log(`Generated ${size}x${size} icon`))
        .catch(err => console.error(`Error generating ${size}x${size} icon:`, err));
}); 