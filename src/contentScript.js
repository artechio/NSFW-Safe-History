const { hostLooksLikeCaptcha, urlLooksLikeCaptcha, elementLooksLikeCaptcha } = require('./lib/captcha');
const { planMedia, needsSecondFrame } = require('./lib/mediaPolicy');

const MIN_IMAGE_SIZE = 64;
const MIN_AD_SIZE = 40;
const SECOND_FRAME_DELAY_MS = 1500;
const elementsByUrl = new Map();
const queued = new Set();
const decided = new Map();
let settings = null;
let siteListed = false;
let blurAllowed = false;
let captchaFrame = false;
let flushTimer = null;
const pending = [];

function sendMessage(message) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, response => {
            const err = chrome.runtime.lastError;
            if (err) reject(new Error(err.message));
            else resolve(response);
        });
    });
}

function imageUrl(element) {
    if (element.tagName === 'IMG') {
        return element.currentSrc || element.src || '';
    }
    if (element.tagName === 'VIDEO') {
        if (element.poster) return element.poster;
        return captureVideoFrame(element);
    }
    return '';
}

function captureVideoFrame(video) {
    if (!video || video.readyState < 2) return '';
    if (video.videoWidth < MIN_IMAGE_SIZE || video.videoHeight < MIN_IMAGE_SIZE) return '';
    try {
        const canvas = document.createElement('canvas');
        canvas.width = 224;
        canvas.height = 224;
        const context = canvas.getContext('2d');
        context.drawImage(video, 0, 0, 224, 224);
        return canvas.toDataURL('image/jpeg', 0.7);
    } catch (error) {
        return '';
    }
}

function elementSizeOk(element, minimum) {
    const width = element.clientWidth || element.offsetWidth || element.naturalWidth || 0;
    const height = element.clientHeight || element.offsetHeight || element.naturalHeight || 0;
    return width >= minimum && height >= minimum;
}

function shouldSkipBlur(element) {
    if (captchaFrame) return true;
    if (!element) return true;
    if (elementLooksLikeCaptcha(element)) return true;
    if (element.tagName === 'IFRAME' || element.tagName === 'IMG' || element.tagName === 'VIDEO') {
        if (urlLooksLikeCaptcha(element.src || element.currentSrc || '')) return true;
    }
    return false;
}

function applyBlur(element) {
    if (!element || shouldSkipBlur(element)) return;
    if (element.dataset.nsfwRevealed === '1' || element.classList.contains('nsfw-blur')) return;
    element.classList.add('nsfw-blur');
    element.title = 'Potentially NSFW media. Click to reveal.';
    element.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        element.classList.remove('nsfw-blur');
        element.dataset.nsfwRevealed = '1';
    }, { once: true, capture: true });
}

function clearBlur(element) {
    element.classList.remove('nsfw-blur');
}

function remember(url, element) {
    if (!url) return;
    if (!elementsByUrl.has(url)) elementsByUrl.set(url, new Set());
    elementsByUrl.get(url).add(element);
}

function paint(url, nsfw) {
    decided.set(url, nsfw);
    const elements = elementsByUrl.get(url);
    if (!elements) return;
    elements.forEach(element => {
        if (nsfw) applyBlur(element);
        else clearBlur(element);
    });
}

function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
        flushTimer = null;
        const urls = pending.splice(0, 12);
        if (!urls.length) return;
        sendMessage({ action: 'CLASSIFY_URLS', urls })
            .then(response => {
                const results = response && response.results ? response.results : [];
                const seen = new Set();
                results.forEach(result => {
                    seen.add(result.url);
                    queued.delete(result.url);
                    paint(result.url, Boolean(result.nsfw));
                });
                urls.forEach(url => {
                    if (!seen.has(url)) {
                        queued.delete(url);
                        paint(url, false);
                    }
                });
            })
            .catch(() => {
                urls.forEach(url => queued.delete(url));
            });
        if (pending.length) scheduleFlush();
    }, 250);
}

function enqueue(element) {
    if (!filteringActive()) return;
    if (shouldSkipBlur(element)) return;

    const url = siteListed ? '' : imageUrl(element);
    const plan = planMedia({ tag: element.tagName, siteListed, url });
    if (plan === 'blur') {
        applyBlur(element);
        return;
    }
    if (plan === 'skip' || urlLooksLikeCaptcha(url)) return;

    if (needsSecondFrame(element.tagName, Boolean(element.poster))) {
        checkVideoFrames(element, url);
        return;
    }

    remember(url, element);

    if (decided.has(url)) {
        if (decided.get(url)) applyBlur(element);
        return;
    }
    if (queued.has(url)) return;
    queued.add(url);
    pending.push(url);
    scheduleFlush();
}

function classifyOne(url) {
    return sendMessage({ action: 'CLASSIFY_URLS', urls: [url] })
        .then(response => Boolean(response && response.results && response.results[0] && response.results[0].nsfw))
        .catch(() => false);
}

// Blur a video only when two frames taken a moment apart are both flagged.
async function checkVideoFrames(video, firstFrame) {
    if (video.dataset.nsfwVideoCheck === '1') return;
    video.dataset.nsfwVideoCheck = '1';
    try {
        if (!(await classifyOne(firstFrame))) return;
        await new Promise(resolve => setTimeout(resolve, SECOND_FRAME_DELAY_MS));
        const secondFrame = captureVideoFrame(video) || firstFrame;
        if (filteringActive() && await classifyOne(secondFrame)) applyBlur(video);
    } finally {
        delete video.dataset.nsfwVideoCheck;
    }
}

function readyToScan(element) {
    const tag = element.tagName;
    if (tag === 'IMG') {
        if (!element.complete) {
            element.addEventListener('load', () => consider(element), { once: true });
            return false;
        }
        if (element.naturalWidth < MIN_IMAGE_SIZE || element.naturalHeight < MIN_IMAGE_SIZE) return false;
        return true;
    }
    if (tag === 'VIDEO') {
        if (siteListed) return true;
        if (element.poster) return true;
        if (element.readyState >= 2 && element.videoWidth >= MIN_IMAGE_SIZE) return true;
        element.addEventListener('loadeddata', () => consider(element), { once: true });
        return false;
    }
    if (tag === 'IFRAME') {
        return elementSizeOk(element, MIN_AD_SIZE);
    }
    return false;
}

function consider(element) {
    if (!element || element.dataset.nsfwWatch === '1') return;
    if (shouldSkipBlur(element)) return;
    if (!readyToScan(element)) return;
    element.dataset.nsfwWatch = '1';
    observer.observe(element);
}

const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) enqueue(entry.target);
    });
}, { rootMargin: '240px' });

function scan(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('img, video, iframe').forEach(consider);
    if (root && root.tagName && /^(IMG|VIDEO|IFRAME)$/.test(root.tagName)) consider(root);
}

function syncAppearance() {
    if (!settings) return;
    document.documentElement.style.setProperty('--blur-intensity', `${settings.blurIntensity}px`);
    if (!filteringActive()) {
        document.querySelectorAll('.nsfw-blur').forEach(clearBlur);
    }
}

function filteringActive() {
    if (captchaFrame || hostLooksLikeCaptcha(location.hostname)) return false;
    return Boolean(settings && settings.enabled && settings.blurEnabled && blurAllowed);
}

function rescan() {
    document.querySelectorAll('img, video, iframe').forEach(element => {
        delete element.dataset.nsfwWatch;
    });
    decided.clear();
    queued.clear();
    pending.length = 0;
    if (filteringActive()) scan(document);
}

function watchDom() {
    new MutationObserver(mutations => {
        if (!filteringActive()) return;
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) scan(node);
            });
            if (mutation.type === 'attributes' && mutation.target && mutation.target.dataset) {
                delete mutation.target.dataset.nsfwWatch;
                consider(mutation.target);
            }
        });
    }).observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'poster', 'srcset']
    });
}

function applySiteStatus(response) {
    if (!response || response.error) return;
    settings = response;
    captchaFrame = Boolean(response.captchaFrame) || hostLooksLikeCaptcha(location.hostname);
    siteListed = Boolean(response.listed) && !captchaFrame;
    blurAllowed = !Boolean(response.inExcluded);
    syncAppearance();
    if (captchaFrame) {
        document.querySelectorAll('.nsfw-blur').forEach(clearBlur);
        return;
    }
    rescan();
}

function start() {
    sendMessage({ action: 'GET_SITE_STATUS', hostname: location.hostname }).then(response => {
        applySiteStatus(response);
        watchDom();
    }).catch(() => {});

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'sync') return;
        sendMessage({ action: 'GET_SITE_STATUS', hostname: location.hostname })
            .then(applySiteStatus)
            .catch(() => {});
    });
}

if (location.protocol === 'http:' || location.protocol === 'https:') {
    start();
}
