const MIN_IMAGE_SIZE = 64;
const elementsByUrl = new Map();
const queued = new Set();
const decided = new Map();
let settings = null;
let siteListed = false;
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

function isClassifiable(url) {
    return /^https?:/i.test(url) || (typeof url === 'string' && url.startsWith('data:image/'));
}

function applyBlur(element) {
    if (!element || element.dataset.nsfwRevealed === '1' || element.classList.contains('nsfw-blur')) return;
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

    if (siteListed) {
        applyBlur(element);
        return;
    }

    const url = imageUrl(element);
    if (!isClassifiable(url)) {
        if (element.tagName === 'VIDEO') applyBlur(element);
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

function readyToScan(element) {
    if (element.tagName === 'IMG') {
        if (!element.complete) {
            element.addEventListener('load', () => consider(element), { once: true });
            return false;
        }
        if (element.naturalWidth < MIN_IMAGE_SIZE || element.naturalHeight < MIN_IMAGE_SIZE) return false;
        return true;
    }
    if (element.tagName === 'VIDEO') {
        if (siteListed) return true;
        if (element.poster) return true;
        if (element.readyState >= 2 && element.videoWidth >= MIN_IMAGE_SIZE) return true;
        element.addEventListener('loadeddata', () => consider(element), { once: true });
        return false;
    }
    return false;
}

function consider(element) {
    if (!element || element.dataset.nsfwWatch === '1') return;
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
    scope.querySelectorAll('img, video').forEach(consider);
    if (root && (root.tagName === 'IMG' || root.tagName === 'VIDEO')) consider(root);
}

function syncAppearance() {
    if (!settings) return;
    document.documentElement.style.setProperty('--blur-intensity', `${settings.blurIntensity}px`);
    if (!filteringActive()) {
        document.querySelectorAll('.nsfw-blur').forEach(clearBlur);
    }
}

function filteringActive() {
    return Boolean(settings && settings.enabled && settings.blurEnabled && !settings.excludedSites.includes(location.hostname));
}

function rescan() {
    document.querySelectorAll('img, video').forEach(element => {
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

function start() {
    sendMessage({ action: 'GET_SITE_STATUS', hostname: location.hostname }).then(response => {
        if (!response || response.error) return;
        settings = response;
        siteListed = Boolean(response.listed);
        syncAppearance();
        watchDom();
        rescan();
    }).catch(() => {});

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'sync') return;
        sendMessage({ action: 'GET_SITE_STATUS', hostname: location.hostname }).then(response => {
            if (!response || response.error) return;
            settings = response;
            siteListed = Boolean(response.listed);
            syncAppearance();
            rescan();
        }).catch(() => {});
    });
}

if (location.protocol === 'http:' || location.protocol === 'https:') {
    start();
}
