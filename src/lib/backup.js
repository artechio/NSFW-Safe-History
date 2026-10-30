const { normalizeSettings } = require('./settings');

const BACKUP_FORMAT = 'nsfw-safe-history-settings';
const BACKUP_KEYS = [
    'enabled',
    'autoDeleteHistory',
    'blurEnabled',
    'blurIntensity',
    'nsfwThreshold',
    'excludedSites',
    'customDomains',
    'lastCleanRange'
];

function exportSettings(settings, version) {
    const normalized = normalizeSettings(settings);
    const data = {};
    for (const key of BACKUP_KEYS) data[key] = normalized[key];
    return {
        format: BACKUP_FORMAT,
        version: String(version || ''),
        exportedAt: new Date().toISOString(),
        settings: data
    };
}

function parseBackup(input) {
    let raw = input;
    if (typeof raw === 'string') {
        try {
            raw = JSON.parse(raw);
        } catch (error) {
            throw new Error('Backup file is not valid JSON');
        }
    }
    if (!raw || typeof raw !== 'object' || raw.format !== BACKUP_FORMAT) {
        throw new Error('Not an NSFW Safe History backup');
    }
    const source = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
    const picked = {};
    for (const key of BACKUP_KEYS) {
        if (source[key] !== undefined) picked[key] = source[key];
    }
    const normalized = normalizeSettings(picked);
    const result = {};
    for (const key of Object.keys(picked)) result[key] = normalized[key];
    return result;
}

module.exports = {
    BACKUP_FORMAT,
    BACKUP_KEYS,
    exportSettings,
    parseBackup
};
