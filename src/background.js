const { parseHosts, hostMatches, isExcluded, BLOCKLIST_URL, BLOCKLIST_INTERVAL_MS } = require('./lib/domains');
const { normalizeSettings } = require('./lib/settings');
const { isNsfwPrediction } = require('./lib/scores');
const { readDomains, writeDomains } = require('./lib/blocklistDb');

const MAX_CONCURRENT = 2;
const CLASSIFY_TIMEOUT_MS = 20000;

let settingsCache = null;
let domainSet = new Set();
let customSet = new Set();
let blocklistReady = null;
let blocklistLoaded = false;
const pendingVisits = [];

let classifierPort = null;
let resolvePort = null;
let portWait = null;
let offscreenPromise = null;
let nextId = 0;
let running = 0;
const waiters = [];
const pendingClassify = new Map();
const imageCache = new Map();

function chromeCall(fn) {
    return new Promise((resolve, reject) => {
        fn(result => {
            const err = chrome.runtime.lastError;
            if (err) reject(new Error(err.message));
            else resolve(result);
        });
    });
}

function getSettings() {
    if (settingsCache) return Promise.resolve(settingsCache);
    return chromeCall(cb => chrome.storage.sync.get(null, cb)).then(stored => {
        const settings = normalizeSettings(stored);
        applySettings(settings);
        return settings;
    });
}

function saveSettings(partial) {
    return getSettings().then(current => {
        const next = normalizeSettings({ ...current, ...partial });
        return chromeCall(cb => chrome.storage.sync.set(next, cb)).then(() => {
            applySettings(next);
            return next;
        });
    });
}

function applySettings(settings) {
    settingsCache = settings;
    customSet = new Set(settings.customDomains);
}

function hostnameOf(url) {
    try {
        return new URL(url).hostname;
    } catch (error) {
        return '';
    }
}

function isListed(hostname) {
    return hostMatches(hostname, domainSet) || hostMatches(hostname, customSet);
}

function matchesDomainList(url, settings) {
    if (!/^https?:/i.test(url || '')) return false;
    const hostname = hostnameOf(url);
    if (!hostname || isExcluded(hostname, settings.excludedSites)) return false;
    return isListed(hostname);
}

function shouldDelete(url, settings) {
    if (!settings.enabled || !settings.autoDeleteHistory) return false;
    return matchesDomainList(url, settings);
}

function deleteHistoryUrl(url) {
    return chromeCall(cb => chrome.history.deleteUrl({ url }, cb));
}

async function handleVisit(item) {
    if (!item || !item.url || !blocklistLoaded) return;
    const settings = await getSettings();
    if (shouldDelete(item.url, settings)) {
        await deleteHistoryUrl(item.url);
    }
}

function loadBundledBlocklist() {
    return fetch(chrome.runtime.getURL('assets/blocklist.txt'))
        .then(response => response.text())
        .then(parseHosts);
}

async function refreshBlocklist(force) {
    const settings = await getSettings();
    let domains = await readDomains();

    if (!domains.length) {
        domains = await loadBundledBlocklist();
        if (domains.length) await writeDomains(domains);
    }

    const stale = Date.now() - settings.lastBlocklistUpdate > BLOCKLIST_INTERVAL_MS;
    if (force || stale || !settings.lastBlocklistUpdate) {
        try {
            const response = await fetch(BLOCKLIST_URL);
            if (response.ok) {
                const parsed = parseHosts(await response.text());
                if (parsed.length) {
                    domains = parsed;
                    await writeDomains(domains);
                    await saveSettings({ lastBlocklistUpdate: Date.now() });
                }
            }
        } catch (error) {
            console.warn('Blocklist update failed', error);
        }
    }

    domainSet = new Set(domains);
    return domainSet.size;
}

function bootBlocklist() {
    if (!blocklistReady) {
        blocklistReady = refreshBlocklist(false).catch(error => {
            console.error('Blocklist load failed', error);
            domainSet = new Set();
        }).then(async () => {
            blocklistLoaded = true;
            const queued = pendingVisits.splice(0);
            for (const item of queued) {
                await handleVisit(item);
            }
        });
    }
    return blocklistReady;
}

function waitForPort() {
    if (classifierPort) return Promise.resolve(classifierPort);
    if (!portWait) {
        portWait = new Promise(resolve => {
            resolvePort = resolve;
        });
    }
    return portWait;
}

async function ensureOffscreen() {
    if (classifierPort) return;
    if (!offscreenPromise) {
        offscreenPromise = (async () => {
            if (await chrome.offscreen.hasDocument()) {
                await chrome.offscreen.closeDocument();
            }
            await chrome.offscreen.createDocument({
                url: 'offscreen.html',
                reasons: ['WORKERS'],
                justification: 'Run the local NSFW image model outside the service worker'
            });
            await waitForPort();
        })().finally(() => {
            offscreenPromise = null;
        });
    }
    await offscreenPromise;
}

function schedule(task) {
    return new Promise((resolve, reject) => {
        const run = () => {
            running += 1;
            task().then(resolve, reject).finally(() => {
                running -= 1;
                if (waiters.length) waiters.shift()();
            });
        };
        if (running < MAX_CONCURRENT) run();
        else waiters.push(run);
    });
}

function requestClassify(url) {
    return ensureOffscreen().then(() => new Promise((resolve, reject) => {
        const id = String(++nextId);
        const timer = setTimeout(() => {
            pendingClassify.delete(id);
            reject(new Error('Classification timed out'));
        }, CLASSIFY_TIMEOUT_MS);
        pendingClassify.set(id, { resolve, reject, timer });
        classifierPort.postMessage({ type: 'classify', id, url });
    }));
}

async function classifyCached(url, threshold) {
    if (imageCache.has(url)) return imageCache.get(url);
    try {
        const predictions = await schedule(() => requestClassify(url));
        const nsfw = isNsfwPrediction(predictions, threshold);
        imageCache.set(url, nsfw);
        return nsfw;
    } catch (error) {
        console.warn('Image classification failed', error);
        return false;
    }
}

async function classifyForTab(urls, sender) {
    await bootBlocklist();
    const settings = await getSettings();
    const pageUrl = sender && sender.tab && sender.tab.url;
    const hostname = hostnameOf(pageUrl);
    const list = [...new Set((urls || []).filter(url => typeof url === 'string' && /^https?:/i.test(url)))].slice(0, 12);

    if (!settings.enabled || !settings.blurEnabled || isExcluded(hostname, settings.excludedSites)) {
        return { results: list.map(url => ({ url, nsfw: false })), skipped: true };
    }

    const results = [];
    let anyNsfw = false;
    for (const url of list) {
        const nsfw = await classifyCached(url, settings.nsfwThreshold);
        if (nsfw) anyNsfw = true;
        results.push({ url, nsfw });
    }

    if (anyNsfw && settings.autoDeleteHistory && pageUrl && /^https?:/i.test(pageUrl) && !isExcluded(hostname, settings.excludedSites)) {
        await deleteHistoryUrl(pageUrl);
    }

    return { results };
}

async function clearMatchingHistory() {
    await bootBlocklist();
    const settings = await getSettings();
    const startTime = Date.now() - settings.historyLookbackDays * 24 * 60 * 60 * 1000;
    let endTime = Date.now();
    let deleted = 0;

    for (let page = 0; page < 20; page += 1) {
        const items = await chromeCall(cb => chrome.history.search({
            text: '',
            startTime,
            endTime,
            maxResults: 1000
        }, cb));
        if (!items || !items.length) break;

        let oldest = endTime;
        for (const item of items) {
            if (item.lastVisitTime && item.lastVisitTime < oldest) oldest = item.lastVisitTime;
            if (matchesDomainList(item.url, settings)) {
                await deleteHistoryUrl(item.url);
                deleted += 1;
            }
        }

        if (items.length < 1000) break;
        endTime = oldest - 1;
    }

    return deleted;
}

chrome.runtime.onConnect.addListener(port => {
    if (port.name !== 'classifier') return;
    classifierPort = port;
    port.onMessage.addListener(message => {
        const pending = pendingClassify.get(message.id);
        if (!pending) return;
        clearTimeout(pending.timer);
        pendingClassify.delete(message.id);
        if (message.error) pending.reject(new Error(message.error));
        else pending.resolve(message.predictions || []);
    });
    port.onDisconnect.addListener(() => {
        if (classifierPort === port) {
            classifierPort = null;
            portWait = null;
            resolvePort = null;
        }
    });
    if (resolvePort) {
        const resolve = resolvePort;
        resolvePort = null;
        resolve(port);
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.action) return;

    if (message.action === 'GET_SETTINGS') {
        getSettings().then(sendResponse).catch(error => sendResponse({ error: error.message }));
        return true;
    }

    if (message.action === 'UPDATE_SETTINGS') {
        saveSettings(message.settings || {}).then(sendResponse).catch(error => sendResponse({ error: error.message }));
        return true;
    }

    if (message.action === 'CLASSIFY_URLS') {
        classifyForTab(message.urls, sender).then(sendResponse).catch(error => sendResponse({ error: error.message, results: [] }));
        return true;
    }

    if (message.action === 'CLEAR_HISTORY') {
        clearMatchingHistory()
            .then(deleted => sendResponse({ ok: true, deleted }))
            .catch(error => sendResponse({ ok: false, error: error.message }));
        return true;
    }

    if (message.action === 'UPDATE_BLOCKLIST') {
        refreshBlocklist(true)
            .then(count => sendResponse({ ok: true, count }))
            .catch(error => sendResponse({ ok: false, error: error.message }));
        return true;
    }
});

chrome.history.onVisited.addListener(item => {
    if (!blocklistLoaded) {
        pendingVisits.push(item);
        return;
    }
    handleVisit(item).catch(error => console.warn('History visit handling failed', error));
});

chrome.alarms.create('updateBlocklist', { periodInMinutes: 7 * 24 * 60 });
chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === 'updateBlocklist') {
        refreshBlocklist(true).catch(error => console.warn('Scheduled blocklist update failed', error));
    }
});

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    settingsCache = null;
    getSettings().catch(error => console.warn('Settings reload failed', error));
});

chrome.runtime.onInstalled.addListener(() => {
    saveSettings({}).catch(error => console.warn('Settings init failed', error));
    bootBlocklist();
});

bootBlocklist();
