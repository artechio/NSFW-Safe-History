const { normalizeDomain } = require('./domains');

const DEFAULT_SETTINGS = {
    enabled: true,
    autoDeleteHistory: true,
    blurEnabled: true,
    blurIntensity: 20,
    nsfwThreshold: 0.7,
    excludedSites: [],
    customDomains: [],
    lastBlocklistUpdate: 0,
    lastCleanRange: 'week'
};

const CLEAN_RANGES = {
    today: 1,
    week: 7,
    month: 30,
    all: 0
};

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function uniqueDomains(values) {
    const domains = [];
    const seen = new Set();

    for (const value of values || []) {
        const domain = normalizeDomain(value);
        if (!domain || seen.has(domain)) continue;
        seen.add(domain);
        domains.push(domain);
    }

    return domains;
}

function normalizeCleanRange(value) {
    if (CLEAN_RANGES[value] !== undefined) return value;
    return DEFAULT_SETTINGS.lastCleanRange;
}

function normalizeSettings(raw) {
    const source = raw || {};
    const blurIntensity = Number(source.blurIntensity);
    const nsfwThreshold = Number(source.nsfwThreshold);

    return {
        enabled: source.enabled !== false,
        autoDeleteHistory: source.autoDeleteHistory !== false,
        blurEnabled: source.blurEnabled !== false,
        blurIntensity: clamp(Number.isFinite(blurIntensity) ? blurIntensity : DEFAULT_SETTINGS.blurIntensity, 5, 40),
        nsfwThreshold: clamp(Number.isFinite(nsfwThreshold) ? nsfwThreshold : DEFAULT_SETTINGS.nsfwThreshold, 0.5, 0.95),
        excludedSites: uniqueDomains(source.excludedSites),
        customDomains: uniqueDomains(source.customDomains),
        lastBlocklistUpdate: Number(source.lastBlocklistUpdate) || 0,
        lastCleanRange: normalizeCleanRange(source.lastCleanRange)
    };
}

function historyStartTime(range) {
    const key = normalizeCleanRange(range);
    const days = CLEAN_RANGES[key];
    if (!days) return 0;
    if (key === 'today') {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        return start.getTime();
    }
    return Date.now() - days * 24 * 60 * 60 * 1000;
}

module.exports = {
    DEFAULT_SETTINGS,
    CLEAN_RANGES,
    normalizeSettings,
    normalizeCleanRange,
    historyStartTime
};
