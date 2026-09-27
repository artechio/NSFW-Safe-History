const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const GREEN = [0x98, 0xfa, 0x33];
const SIZES = [16, 32, 48, 128];

const sourceSvg = fs.readFileSync(path.join(ROOT, 'assets/icon.svg'), 'utf8');
const sourcePaths = [...sourceSvg.matchAll(/\sd="([^"]+)"/g)].map(match => match[1]);
const CIRCLE_PATH = sourcePaths[0];
const BROOM_PATH = sourcePaths[1];
const BROOM_ONLY = BROOM_PATH.slice(0, BROOM_PATH.indexOf('Z') + 1);

// 16px bars are hand-placed so each line stays 1px and detached from the broom.
const BARS_16 = [
    { x: 9, y: 8, w: 5, h: 1 },
    { x: 10, y: 11, w: 5, h: 1 },
    { x: 11, y: 14, w: 4, h: 1 }
];

const SOURCE_BARS = [
    { x: 12, y: 13, w: 7, h: 2.5 },
    { x: 14, y: 17, w: 7, h: 2.5 },
    { x: 16, y: 21, w: 7, h: 2.5 }
];

function broomSvg() {
    return Buffer.from(`<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <path fill="#000" d="${BROOM_ONLY}"/>
</svg>`);
}

function fullSvg(fill, stroke) {
    const strokeAttr = stroke
        ? ' stroke="#111111" stroke-width="0.4" stroke-linejoin="round" paint-order="stroke fill"'
        : '';
    return Buffer.from(`<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" width="24" height="24">
  <defs>
    <linearGradient id="g" gradientUnits="userSpaceOnUse" x1="12" y1="0" x2="12" y2="24">
      <stop offset="0%" stop-color="#98FA33" stop-opacity="1"/>
      <stop offset="100%" stop-color="#98FA33" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <path fill="url(#g)" d="${CIRCLE_PATH}"/>
  <path fill="${fill}"${strokeAttr} fill-rule="evenodd" d="${BROOM_PATH}"/>
</svg>`);
}

async function broomMask(size) {
    const { data, info } = await sharp(broomSvg(), { density: 2400 })
        .resize(size, size)
        .threshold(140)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    const bits = new Uint8Array(size * size);
    for (let i = 0; i < size * size; i++) {
        bits[i] = data[i * info.channels + 3] > 128 ? 1 : 0;
    }
    // Keep the diagonal handle at least 2px wide. A 1px step breaks at 16px.
    if (size === 16) {
        const source = bits.slice();
        for (let y = 1; y <= 8; y++) {
            for (let x = 0; x < size - 1; x++) {
                if (source[y * size + x] && !source[y * size + x + 1]) bits[y * size + x + 1] = 1;
            }
        }
    }
    return bits;
}

function rectHits(bits, size, x, y, w, h) {
    for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
            const xx = x + i;
            const yy = y + j;
            if (xx < 0 || yy < 0 || xx >= size || yy >= size) return true;
            if (bits[yy * size + xx]) return true;
        }
    }
    return false;
}

function barsFor(size, bits) {
    if (size === 16) return BARS_16;
    return SOURCE_BARS.map(src => {
        let h = Math.max(2, Math.round(src.h * size / 24));
        let w = Math.max(6, Math.round(src.w * size / 24));
        let x = Math.round(src.x * size / 24);
        let y = Math.round(src.y * size / 24);
        if (y + h > size - 1) y = size - 1 - h;
        if (x + w > size) x = size - w;
        let guard = 0;
        while (rectHits(bits, size, x - 1, y, w + 1, h) && guard < size) {
            x += 1;
            if (x + w > size) w -= 1;
            guard++;
        }
        return { x, y, w, h };
    });
}

function stampBars(bits, size, bars) {
    const mark = new Uint8Array(bits);
    for (const bar of bars) {
        for (let j = 0; j < bar.h; j++) {
            for (let i = 0; i < bar.w; i++) {
                const x = bar.x + i;
                const y = bar.y + j;
                if (x >= 0 && y >= 0 && x < size && y < size) mark[y * size + x] = 1;
            }
        }
    }
    return mark;
}

function dilate(mark, size) {
    const out = new Uint8Array(size * size);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            let on = 0;
            for (let dy = -1; dy <= 1 && !on; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const xx = x + dx;
                    const yy = y + dy;
                    if (xx >= 0 && yy >= 0 && xx < size && yy < size && mark[yy * size + xx]) on = 1;
                }
            }
            out[y * size + x] = on;
        }
    }
    return out;
}

function circleAlpha(x, y, size) {
    const dist = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2);
    const coverage = Math.max(0, Math.min(1, (size / 2 - dist) / 0.75 + 0.5));
    const fade = 1 - y / Math.max(1, size - 1);
    return coverage * fade;
}

function paint(broomBits, bars, size, mode) {
    const mark = stampBars(broomBits, size, bars);
    const fill = mode === 'light' ? [0x11, 0x11, 0x11] : [0xff, 0xff, 0xff];
    // Outline only the broom. Bars get a 1px dark foot so a white bar still
    // shows on a light toolbar without the three lines melting together.
    const outline = mode === 'universal' ? dilate(broomBits, size) : null;
    const foot = new Uint8Array(size * size);
    if (mode === 'universal') {
        for (const bar of bars) {
            const y = bar.y + bar.h;
            if (y >= size) continue;
            for (let i = 0; i < bar.w; i++) {
                const x = bar.x + i;
                if (x >= 0 && x < size && !mark[y * size + x]) foot[y * size + x] = 1;
            }
        }
    }
    const data = Buffer.alloc(size * size * 4);

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const p = y * size + x;
            const i = p * 4;
            const gA = circleAlpha(x, y, size);
            let r = GREEN[0];
            let g = GREEN[1];
            let b = GREEN[2];
            let a = gA;

            if ((outline && outline[p] && !mark[p]) || foot[p]) {
                r = 0x11;
                g = 0x11;
                b = 0x11;
                a = 1;
            }
            if (mark[p]) {
                r = fill[0];
                g = fill[1];
                b = fill[2];
                a = 1;
            }

            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
            data[i + 3] = Math.round(Math.max(0, Math.min(1, a)) * 255);
        }
    }
    return sharp(data, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer();
}

async function renderIcon(mode, size) {
    if (size === 16 || size === 32) {
        const bits = await broomMask(size);
        return paint(bits, barsFor(size, bits), size, mode);
    }
    const fill = mode === 'light' ? '#111111' : '#FFFFFF';
    return sharp(fullSvg(fill, mode === 'universal'), { density: 768 })
        .resize(size, size)
        .png()
        .toBuffer();
}

async function writeIcon(mode, size, file) {
    const png = await renderIcon(mode, size);
    await fs.promises.mkdir(path.dirname(file), { recursive: true });
    await fs.promises.writeFile(file, png);
    console.log(`${mode} ${size} -> ${path.relative(ROOT, file)}`);
}

async function main() {
    const jobs = [];
    for (const size of SIZES) {
        jobs.push(writeIcon('light', size, path.join(ROOT, 'assets/icons/light', `icon${size}.png`)));
        jobs.push(writeIcon('dark', size, path.join(ROOT, 'assets/icons/dark', `icon${size}.png`)));
        jobs.push(writeIcon('universal', size, path.join(ROOT, 'assets', `icon${size}.png`)));
    }
    await Promise.all(jobs);
    await fs.promises.copyFile(
        path.join(ROOT, 'assets/icon128.png'),
        path.join(ROOT, 'assets/icon.png')
    );
    console.log('universal 128 -> assets/icon.png');
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
