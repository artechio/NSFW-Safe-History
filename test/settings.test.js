const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSettings, historyStartTime, DEFAULT_SETTINGS } = require('../src/lib/settings');

test('normalizeSettings fills defaults and clamps numbers', () => {
    const settings = normalizeSettings({
        blurIntensity: 100,
        nsfwThreshold: 0.1,
        lastCleanRange: 'nope',
        customDomains: ['OK.Example', 'ok.example', 'nope'],
        excludedSites: ['Safe.Example']
    });

    assert.equal(settings.blurIntensity, 40);
    assert.equal(settings.nsfwThreshold, 0.5);
    assert.equal(settings.lastCleanRange, DEFAULT_SETTINGS.lastCleanRange);
    assert.deepEqual(settings.customDomains, ['ok.example']);
    assert.deepEqual(settings.excludedSites, ['safe.example']);
    assert.equal(settings.enabled, true);
    assert.equal(settings.autoDeleteHistory, true);
});

test('normalizeSettings preserves explicit off switches and clean ranges', () => {
    const settings = normalizeSettings({
        enabled: false,
        autoDeleteHistory: false,
        blurEnabled: false,
        lastCleanRange: 'all'
    });
    assert.equal(settings.enabled, false);
    assert.equal(settings.autoDeleteHistory, false);
    assert.equal(settings.blurEnabled, false);
    assert.equal(settings.lastCleanRange, 'all');
});

test('historyStartTime maps today week month and all', () => {
    assert.equal(historyStartTime('all'), 0);
    const todayStart = historyStartTime('today');
    const expectedToday = new Date();
    expectedToday.setHours(0, 0, 0, 0);
    assert.equal(todayStart, expectedToday.getTime());

    const week = historyStartTime('week');
    assert.ok(Date.now() - week >= 6.9 * 24 * 60 * 60 * 1000);
    assert.ok(Date.now() - week <= 7.1 * 24 * 60 * 60 * 1000);

    const month = historyStartTime('month');
    assert.ok(Date.now() - month >= 29 * 24 * 60 * 60 * 1000);
});
