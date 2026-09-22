const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSettings, DEFAULT_SETTINGS } = require('../src/lib/settings');

test('normalizeSettings fills defaults and clamps numbers', () => {
    const settings = normalizeSettings({
        blurIntensity: 100,
        nsfwThreshold: 0.1,
        historyLookbackDays: 3,
        customDomains: ['OK.Example', 'ok.example', 'nope'],
        excludedSites: ['Safe.Example']
    });

    assert.equal(settings.blurIntensity, 40);
    assert.equal(settings.nsfwThreshold, 0.5);
    assert.equal(settings.historyLookbackDays, DEFAULT_SETTINGS.historyLookbackDays);
    assert.deepEqual(settings.customDomains, ['ok.example']);
    assert.deepEqual(settings.excludedSites, ['safe.example']);
    assert.equal(settings.enabled, true);
    assert.equal(settings.autoDeleteHistory, true);
});

test('normalizeSettings preserves explicit off switches', () => {
    const settings = normalizeSettings({
        enabled: false,
        autoDeleteHistory: false,
        blurEnabled: false,
        historyLookbackDays: 30
    });
    assert.equal(settings.enabled, false);
    assert.equal(settings.autoDeleteHistory, false);
    assert.equal(settings.blurEnabled, false);
    assert.equal(settings.historyLookbackDays, 30);
});
