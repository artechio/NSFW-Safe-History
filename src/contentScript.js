const MIN_IMAGE_SIZE = 64;
const elementsByUrl = new Map();
const queued = new Set();
const decided = new Map();
let settings = null;
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
    if (element.tagName === 'IMG') return element.currentSrc || element.src || '';
    if (element.tagName === 'VIDEO') return element.poster || '';
    return '';
}

function isClassifiable(url) {
    return /^https?:/i.test(url);
}

function applyBlur(element) {
    if (!element || element.dataset.nsfwRevealed === '1' || element.classList.contains('nsfw-blur')) return;
    element.classList.add('nsfw-blur');
    element.title = 'Potentially NSFW image. Click to reveal.';
    element.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        element.classList.remove('nsfw-blur');
        element.dataset.nsfwRevealed = '1';
    }, { once: true });
}

function clearBlur(element) {
    element.classList.remove('nsfw-blur');
}

function remember(url, element) {
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
    }, 300);
}

function enqueue(element) {
    if (!settings || !settings.enabled || !settings.blurEnabled) return;
    if (settings.excludedSites.includes(location.hostname)) return;

    const url = imageUrl(element);
    if (!isClassifiable(url)) return;
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
    }
    if (element.tagName === 'VIDEO' && !element.poster) return false;
    return true;
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
}, { rootMargin: '200px' });

function scan(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('img, video').forEach(consider);
    if (root && (root.tagName === 'IMG' || root.tagName === 'VIDEO')) consider(root);
}

function syncAppearance() {
    document.documentElement.style.setProperty('--blur-intensity', `${settings.blurIntensity}px`);
    if (!settings.enabled || !settings.blurEnabled || settings.excludedSites.includes(location.hostname)) {
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
        attributeFilter: ['src', 'poster']
    });
}

function start() {
    sendMessage({ action: 'GET_SETTINGS' }).then(response => {
        if (!response || response.error) return;
        settings = response;
        syncAppearance();
        watchDom();
        rescan();
    }).catch(() => {});

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'sync') return;
        sendMessage({ action: 'GET_SETTINGS' }).then(response => {
            if (!response || response.error) return;
            settings = response;
            syncAppearance();
            rescan();
        }).catch(() => {});
    });
}

if (location.protocol === 'http:' || location.protocol === 'https:') {
    start();
}
