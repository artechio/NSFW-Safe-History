const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeStats, addRemoved, dayKey } = require('../src/lib/stats');

test('addRemoved accumulates totals and today counts', () => {
    const now = new Date(2026, 9, 30, 12).getTime();
    let stats = addRemoved(undefined, 3, now);
    stats = addRemoved(stats, 2, now);
    assert.equal(stats.removedTotal, 5);
    assert.equal(stats.removedToday, 5);
    assert.equal(stats.day, dayKey(now));
});

test('normalizeStats resets the daily count on a new day', () => {
    const yesterday = new Date(2026, 9, 29, 23).getTime();
    const today = new Date(2026, 9, 30, 8).getTime();
    const stats = normalizeStats(addRemoved(undefined, 4, yesterday), today);
    assert.equal(stats.removedTotal, 4);
    assert.equal(stats.removedToday, 0);
});

test('normalizeStats ignores garbage', () => {
    const stats = normalizeStats({ removedTotal: -7, removedToday: 'x' }, Date.now());
    assert.equal(stats.removedTotal, 0);
    assert.equal(stats.removedToday, 0);
});
