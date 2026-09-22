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
    historyLookbackDays: 7
};

const LOOKBACK_DAYS = new Set([1, 7, 30]);

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

function normalizeSettings(raw) {
    const source = raw || {};
    const blurIntensity = Number(source.blurIntensity);
    const nsfwThreshold = Number(source.nsfwThreshold);
    const lookback = Number(source.historyLookbackDays);

    return {
        enabled: source.enabled !== false,
        autoDeleteHistory: source.autoDeleteHistory !== false,
        blurEnabled: source.blurEnabled !== false,
        blurIntensity: clamp(Number.isFinite(blurIntensity) ? blurIntensity : DEFAULT_SETTINGS.blurIntensity, 5, 40),
        nsfwThreshold: clamp(Number.isFinite(nsfwThreshold) ? nsfwThreshold : DEFAULT_SETTINGS.nsfwThreshold, 0.5, 0.95),
        excludedSites: uniqueDomains(source.excludedSites),
        customDomains: uniqueDomains(source.customDomains),
        lastBlocklistUpdate: Number(source.lastBlocklistUpdate) || 0,
        historyLookbackDays: LOOKBACK_DAYS.has(lookback) ? lookback : DEFAULT_SETTINGS.historyLookbackDays
    };
}

module.exports = {
    DEFAULT_SETTINGS,
    normalizeSettings
};
