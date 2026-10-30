const test = require('node:test');
const assert = require('node:assert/strict');
const { exportSettings, parseBackup, BACKUP_FORMAT } = require('../src/lib/backup');

test('exportSettings round-trips through parseBackup', () => {
    const backup = exportSettings({
        blurEnabled: true,
        blurIntensity: 30,
        customDomains: ['Extra.Example'],
        excludedSites: ['skip.example'],
        lastBlocklistUpdate: 123
    }, '2.1.0');
    assert.equal(backup.format, BACKUP_FORMAT);
    assert.equal(backup.version, '2.1.0');
    assert.equal(backup.settings.lastBlocklistUpdate, undefined);

    const restored = parseBackup(JSON.stringify(backup));
    assert.equal(restored.blurEnabled, true);
    assert.equal(restored.blurIntensity, 30);
    assert.deepEqual(restored.customDomains, ['extra.example']);
    assert.deepEqual(restored.excludedSites, ['skip.example']);
});

test('parseBackup only returns keys present in the file, normalized', () => {
    const restored = parseBackup({ format: BACKUP_FORMAT, settings: { nsfwThreshold: 2, evil: true } });
    assert.deepEqual(restored, { nsfwThreshold: 0.95 });
});

test('parseBackup rejects foreign files', () => {
    assert.throws(() => parseBackup('not json'), /valid JSON/);
    assert.throws(() => parseBackup({ settings: {} }), /Not an NSFW Safe History backup/);
});
