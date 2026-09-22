const sharp = require('sharp');
const path = require('path');

const sizes = [16, 32, 48, 128];
const inputSvg = path.join(__dirname, '../assets/icon.svg');

Promise.all(sizes.map(size =>
    sharp(inputSvg)
        .resize(size, size)
        .png()
        .toFile(path.join(__dirname, `../assets/icon${size}.png`))
        .then(() => console.log(`Generated ${size}x${size} icon`))
)).catch(error => {
    console.error(error);
    process.exit(1);
});
