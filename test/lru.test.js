const test = require('node:test');
const assert = require('node:assert/strict');
const { LruCache } = require('../src/lib/lru');

test('LruCache evicts the least recently used entry', () => {
    const cache = new LruCache(2);
    cache.set('a', 1);
    cache.set('b', 2);
    assert.equal(cache.get('a'), 1);
    cache.set('c', 3);
    assert.equal(cache.has('a'), true);
    assert.equal(cache.has('b'), false);
    assert.equal(cache.has('c'), true);
    assert.equal(cache.size, 2);
});

test('LruCache keeps falsy values', () => {
    const cache = new LruCache(5);
    cache.set('x', false);
    assert.equal(cache.has('x'), true);
    assert.equal(cache.get('x'), false);
});
