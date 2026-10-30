const { parseHosts, hostMatches, isExcluded, BLOCKLIST_URL, BLOCKLIST_INTERVAL_MS } = require('./lib/domains');
const { normalizeSettings, historyStartTime, normalizeCleanRange } = require('./lib/settings');
const { isNsfwPrediction } = require('./lib/scores');
const { readDomains, writeDomains } = require('./lib/blocklistDb');
const { hostLooksLikeCaptcha, urlLooksLikeCaptcha } = require('./lib/captcha');
const { LruCache } = require('./lib/lru');
const { exportSettings, parseBackup } = require('./lib/backup');
const { STATS_KEY, normalizeStats, addRemoved } = require('./lib/stats');

const MAX_CONCURRENT = 2;
const CLASSIFY_TIMEOUT_MS = 25000;
const HISTORY_CHUNK_MS = 7 * 24 * 60 * 60 * 1000;
const IMAGE_CACHE_LIMIT = 600;
const BADGE_COLOR = '#16a34a';
const BADGE_OFF_COLOR = '#6b7280';
const HISTORY_SEARCH_QUERIES = ['', 'porn', 'xxx', 'pornhub', 'xvideos', 'xnxx', 'onlyfans', 'hentai', 'nsfw'];

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
const imageCache = new LruCache(IMAGE_CACHE_LIMIT);
let statsWrite = Promise.resolve();

function getSettings() {
    if (settingsCache) return Promise.resolve(settingsCache);
    return chrome.storage.sync.get(null).then(stored => {
        const settings = normalizeSettings(stored);
        applySettings(settings);
        return settings;
    });
}

function saveSettings(partial) {
    return getSettings().then(current => {
        const next = normalizeSettings({ ...current, ...partial });
        return chrome.storage.sync.set(next).then(() => {
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

function isInBlocklist(hostname) {
    return hostMatches(hostname, domainSet);
}

function isIncluded(hostname) {
    return hostMatches(hostname, customSet);
}

function isListed(hostname) {
    return isInBlocklist(hostname) || isIncluded(hostname);
}

function siteIsProtected(hostname, settings) {
    if (!hostname) return false;
    if (isExcluded(hostname, settings.excludedSites)) return false;
    return isListed(hostname);
}

function shouldCleanHistoryItem(item, settings) {
    if (!item || !item.url || !/^https?:/i.test(item.url)) return false;
    const hostname = hostnameOf(item.url);
    if (!hostname || isExcluded(hostname, settings.excludedSites)) return false;
    return isListed(hostname);
}

async function pruneExcludedSites() {
    const settings = await getSettings();
    if (!settings.excludedSites.length || !domainSet.size) return settings;
    const pruned = settings.excludedSites.filter(site => isInBlocklist(site));
    if (pruned.length === settings.excludedSites.length) return settings;
    return saveSettings({ excludedSites: pruned });
}

async function bumpDeleted(count, options = {}) {
    const amount = Number(count) || 0;
    const current = await chrome.storage.session.get(['deletedTotal']);
    const update = {
        deletedTotal: (Number(current.deletedTotal) || 0) + amount
    };
    if (options.isClear) {
        update.lastClearDeleted = amount;
        update.lastClearAt = Date.now();
    }
    await chrome.storage.session.set(update);
    if (amount > 0) await recordRemoved(amount);
}

function recordRemoved(amount) {
    statsWrite = statsWrite.then(async () => {
        const stored = await chrome.storage.local.get([STATS_KEY]);
        await chrome.storage.local.set({ [STATS_KEY]: addRemoved(stored[STATS_KEY], amount, Date.now()) });
    }).catch(error => console.warn('Stats update failed', error));
    return statsWrite;
}

async function getStats() {
    const stored = await chrome.storage.local.get([STATS_KEY]);
    return normalizeStats(stored[STATS_KEY], Date.now());
}

async function deleteHistoryUrl(url) {
    await chrome.history.deleteUrl({ url });
    return true;
}

async function handleVisit(item) {
    if (!item || !item.url || !blocklistLoaded) return;
    const settings = await getSettings();
    if (!settings.enabled || !settings.autoDeleteHistory) return;
    if (shouldCleanHistoryItem(item, settings)) {
        await deleteHistoryUrl(item.url);
        await bumpDeleted(1);
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
    await pruneExcludedSites();
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
                reasons: ['BLOBS', 'DOM_SCRAPING'],
                justification: 'Classify images with an on-device NSFW model'
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
        if (!classifierPort) {
            reject(new Error('Classifier port missing'));
            return;
        }
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
    const key = `${threshold}|${url}`;
    if (imageCache.has(key)) return imageCache.get(key);
    try {
        const predictions = await schedule(() => requestClassify(url));
        const nsfw = isNsfwPrediction(predictions, threshold);
        imageCache.set(key, nsfw);
        return nsfw;
    } catch (error) {
        // Transient failures (timeouts, offscreen restarts) are not cached so the image can be retried.
        console.warn('Image classification failed', error);
        return false;
    }
}

async function classifyForTab(urls, sender) {
    await bootBlocklist();
    const settings = await getSettings();
    const pageUrl = sender && sender.tab && sender.tab.url;
    const hostname = hostnameOf(pageUrl);
    const list = [...new Set((urls || []).filter(url => typeof url === 'string' && (/^https?:/i.test(url) || url.startsWith('data:image/'))))].slice(0, 12);

    if (!settings.enabled || !settings.blurEnabled || isExcluded(hostname, settings.excludedSites)) {
        return { results: list.map(url => ({ url, nsfw: false })), skipped: true };
    }

    if (siteIsProtected(hostname, settings)) {
        return {
            results: list.map(url => ({
                url,
                nsfw: !urlLooksLikeCaptcha(url)
            })),
            listed: true
        };
    }

    const results = [];
    for (const url of list) {
        if (urlLooksLikeCaptcha(url)) {
            results.push({ url, nsfw: false });
            continue;
        }
        const nsfw = await classifyCached(url, settings.nsfwThreshold);
        results.push({ url, nsfw });
    }

    return { results };
}

async function collectHistoryItems(startTime) {
    const seen = new Set();
    const collected = [];

    async function take(items) {
        for (const item of items || []) {
            if (!item.url || seen.has(item.url)) continue;
            seen.add(item.url);
            collected.push(item);
        }
    }

    for (const text of HISTORY_SEARCH_QUERIES) {
        if (!text) continue;
        const items = await chrome.history.search({
            text,
            startTime,
            maxResults: 1000
        });
        await take(items);
    }

    let endTime = Date.now();
    while (endTime > startTime) {
        const chunkStart = Math.max(startTime, endTime - HISTORY_CHUNK_MS);
        let pageEnd = endTime;

        for (let page = 0; page < 40; page += 1) {
            const items = await chrome.history.search({
                text: '',
                startTime: chunkStart,
                endTime: pageEnd,
                maxResults: 1000
            });
            if (!items || !items.length) break;

            let oldest = pageEnd;
            for (const item of items) {
                if (item.lastVisitTime && item.lastVisitTime < oldest) oldest = item.lastVisitTime;
            }
            await take(items);

            if (items.length < 1000) break;
            pageEnd = oldest - 1;
            if (pageEnd < chunkStart) break;
        }

        endTime = chunkStart - 1;
    }

    return collected;
}

async function clearMatchingHistory(range) {
    await bootBlocklist();
    const settings = await getSettings();
    const cleanRange = normalizeCleanRange(range || settings.lastCleanRange);
    const startTime = historyStartTime(cleanRange);
    const items = await collectHistoryItems(startTime);
    const targets = items.filter(item => shouldCleanHistoryItem(item, settings));
    let deleted = 0;
    const batchSize = 25;

    for (let index = 0; index < targets.length; index += batchSize) {
        const batch = targets.slice(index, index + batchSize);
        const results = await Promise.allSettled(batch.map(item => deleteHistoryUrl(item.url)));
        deleted += results.filter(result => result.status === 'fulfilled').length;
    }

    await bumpDeleted(deleted, { isClear: true });
    if (cleanRange !== settings.lastCleanRange) {
        await saveSettings({ lastCleanRange: cleanRange });
    }

    return deleted;
}

async function cleanSiteHistory(hostname) {
    const host = String(hostname || '').toLowerCase();
    if (!host) return 0;
    const hostSet = new Set([host]);
    const settings = await getSettings();
    const items = await chrome.history.search({ text: host, startTime: 0, maxResults: 10000 });
    const targets = (items || []).filter(item =>
        shouldCleanHistoryItem(item, settings) && hostMatches(hostnameOf(item.url), hostSet)
    );
    const results = await Promise.allSettled(targets.map(item => deleteHistoryUrl(item.url)));
    const deleted = results.filter(result => result.status === 'fulfilled').length;
    if (deleted) await bumpDeleted(deleted);
    return deleted;
}

async function setSiteFilter(hostname, enabled) {
    await bootBlocklist();
    const host = String(hostname || '').toLowerCase();
    if (!host) throw new Error('No site to filter');
    const settings = await getSettings();
    const included = new Set(settings.customDomains);
    const excluded = new Set(settings.excludedSites);
    const inBlocklist = isInBlocklist(host);

    if (enabled) {
        excluded.delete(host);
        if (!inBlocklist) included.add(host);
    } else {
        included.delete(host);
        if (inBlocklist) excluded.add(host);
    }

    await saveSettings({ customDomains: [...included], excludedSites: [...excluded] });
    let deleted = 0;
    if (enabled && settings.enabled && settings.autoDeleteHistory) {
        deleted = await cleanSiteHistory(host).catch(error => {
            console.warn('Site history cleanup failed', error);
            return 0;
        });
    }
    const status = await getSiteStatus(host, host);
    return { ...status, deleted };
}

async function updateBadge(tabId, url) {
    if (tabId === undefined || tabId < 0) return;
    const settings = await getSettings();
    let text = '';
    let color = BADGE_COLOR;
    if (!settings.enabled) {
        text = 'OFF';
        color = BADGE_OFF_COLOR;
    } else if (blocklistLoaded && /^https?:/i.test(url || '') && siteIsProtected(hostnameOf(url), settings)) {
        // A discreet dot: shows the tab is filtered without spelling out why.
        text = '•';
    }
    try {
        await chrome.action.setBadgeBackgroundColor({ tabId, color });
        await chrome.action.setBadgeText({ tabId, text });
    } catch (error) {
        // The tab may have closed before the badge was set.
    }
}

async function refreshAllBadges() {
    const tabs = await chrome.tabs.query({});
    await Promise.all(tabs.map(tab => updateBadge(tab.id, tab.url)));
}

async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return tab;
}

async function runCommand(command) {
    if (command === 'toggle-blur') {
        const settings = await getSettings();
        await saveSettings({ blurEnabled: !settings.blurEnabled });
        return;
    }

    if (command === 'toggle-site-filter') {
        const tab = await getActiveTab();
        if (!tab || !/^https?:/i.test(tab.url || '')) return;
        const hostname = hostnameOf(tab.url);
        const status = await getSiteStatus(hostname, hostname);
        if (!status.enabled) return;
        await setSiteFilter(hostname, !status.filterActive);
        return;
    }

    if (command === 'clean-today') {
        const settings = await getSettings();
        if (settings.enabled) await clearMatchingHistory('today');
    }
}

async function getSiteStatus(frameHostname, tabHostname) {
    await bootBlocklist();
    const settings = await getSettings();
    const frameHost = String(frameHostname || '').toLowerCase();
    const tabHost = String(tabHostname || frameHost || '').toLowerCase();
    const captchaFrame = hostLooksLikeCaptcha(frameHost);
    const inBlocklist = isInBlocklist(tabHost) || isInBlocklist(frameHost);
    const inIncluded = isIncluded(tabHost) || isIncluded(frameHost);
    const inExcluded = isExcluded(tabHost, settings.excludedSites)
        || isExcluded(frameHost, settings.excludedSites);
    const filterActive = (inBlocklist || inIncluded) && !inExcluded;
    const listed = !captchaFrame && filterActive;
    return {
        ...settings,
        listed,
        filterActive,
        inBlocklist,
        inIncluded,
        inExcluded,
        captchaFrame,
        hostname: frameHost || tabHost,
        tabHostname: tabHost
    };
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

    if (message.action === 'GET_SITE_STATUS') {
        const tabHostname = (sender.tab && hostnameOf(sender.tab.url)) || message.hostname || '';
        const frameHostname = message.hostname || tabHostname;
        getSiteStatus(frameHostname, tabHostname)
            .then(sendResponse)
            .catch(error => sendResponse({ error: error.message }));
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
        clearMatchingHistory(message.range)
            .then(deleted => sendResponse({ ok: true, deleted }))
            .catch(error => sendResponse({ ok: false, error: error.message }));
        return true;
    }

    if (message.action === 'SET_SITE_FILTER') {
        setSiteFilter(message.hostname, Boolean(message.enabled))
            .then(sendResponse)
            .catch(error => sendResponse({ error: error.message }));
        return true;
    }

    if (message.action === 'EXPORT_SETTINGS') {
        getSettings()
            .then(settings => sendResponse({ ok: true, backup: exportSettings(settings, chrome.runtime.getManifest().version) }))
            .catch(error => sendResponse({ ok: false, error: error.message }));
        return true;
    }

    if (message.action === 'IMPORT_SETTINGS') {
        Promise.resolve()
            .then(() => saveSettings(parseBackup(message.backup)))
            .then(settings => sendResponse({ ok: true, settings }))
            .catch(error => sendResponse({ ok: false, error: error.message }));
        return true;
    }

    if (message.action === 'GET_STATS') {
        getStats().then(sendResponse).catch(error => sendResponse({ error: error.message }));
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

// The service worker restarts often; recreating the alarm each time would keep pushing it back.
chrome.alarms.get('updateBlocklist').then(alarm => {
    if (!alarm) chrome.alarms.create('updateBlocklist', { periodInMinutes: 7 * 24 * 60 });
}).catch(error => console.warn('Alarm setup failed', error));
chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === 'updateBlocklist') {
        refreshBlocklist(true).catch(error => console.warn('Scheduled blocklist update failed', error));
    }
});

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    settingsCache = null;
    getSettings()
        .then(() => {
            if (changes.enabled || changes.customDomains || changes.excludedSites) return refreshAllBadges();
        })
        .catch(error => console.warn('Settings reload failed', error));
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
    chrome.tabs.get(tabId)
        .then(tab => updateBadge(tab.id, tab.url))
        .catch(() => {});
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!changeInfo.url && changeInfo.status !== 'loading') return;
    updateBadge(tabId, tab.url).catch(() => {});
});

chrome.commands.onCommand.addListener(command => {
    runCommand(command).catch(error => console.warn(`Command ${command} failed`, error));
});

chrome.runtime.onInstalled.addListener(() => {
    saveSettings({}).catch(error => console.warn('Settings init failed', error));
    bootBlocklist();
});

bootBlocklist().then(refreshAllBadges).catch(error => console.warn('Badge refresh failed', error));
