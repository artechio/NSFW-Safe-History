const BLOCKLIST_URL = 'https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/porn-only/hosts';
const BLOCKLIST_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;

function parseHosts(text) {
    const domains = new Set();
    const lines = String(text || '').split('\n');

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;

        const withoutComment = line.split('#')[0].trim();
        const parts = withoutComment.split(/\s+/).filter(Boolean);

        for (const part of parts) {
            const domain = normalizeDomain(part);
            if (domain) domains.add(domain);
        }
    }

    return [...domains];
}

function normalizeDomain(value) {
    if (!value) return '';
    let domain = String(value).trim().toLowerCase();
    domain = domain.replace(/^\*\./, '').replace(/\.$/, '');
    if (!domain || domain === 'localhost' || IPV4.test(domain)) return '';
    if (domain.includes(':') || domain.includes('/')) return '';
    if (!domain.includes('.')) return '';
    if (!/^[a-z0-9.-]+$/.test(domain)) return '';
    if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) return '';
    return domain;
}

function hostMatches(hostname, domainSet) {
    let host = String(hostname || '').trim().toLowerCase().replace(/\.$/, '');
    if (!host || host.includes(':')) return false;

    while (host.includes('.')) {
        if (domainSet.has(host)) return true;
        host = host.slice(host.indexOf('.') + 1);
    }

    return false;
}

function isExcluded(hostname, excludedSites) {
    const host = String(hostname || '').trim().toLowerCase();
    return (excludedSites || []).some(site => site === host);
}

module.exports = {
    BLOCKLIST_URL,
    BLOCKLIST_INTERVAL_MS,
    parseHosts,
    normalizeDomain,
    hostMatches,
    isExcluded
};
