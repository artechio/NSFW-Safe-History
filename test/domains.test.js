const test = require('node:test');
const assert = require('node:assert/strict');
const { parseHosts, hostMatches, isExcluded, normalizeDomain } = require('../src/lib/domains');

test('parseHosts keeps domains and drops comments and addresses', () => {
    const domains = parseHosts(`
# comment
0.0.0.0 adult.example
127.0.0.1 localhost
||not-a-host
ads.example.com # trailing
`);
    assert.deepEqual(domains.sort(), ['ads.example.com', 'adult.example']);
});

test('hostMatches checks the hostname and its parents only', () => {
    const domains = new Set(['porn.example', 'cdn.images.test']);
    assert.equal(hostMatches('a.b.porn.example', domains), true);
    assert.equal(hostMatches('porn.example', domains), true);
    assert.equal(hostMatches('notporn.example', domains), false);
    assert.equal(hostMatches('example', domains), false);
    assert.equal(hostMatches('cdn.images.test', domains), true);
});

test('normalizeDomain rejects bare labels and addresses', () => {
    assert.equal(normalizeDomain('com'), '');
    assert.equal(normalizeDomain('0.0.0.0'), '');
    assert.equal(normalizeDomain('*.Adult.Example.'), 'adult.example');
});

test('isExcluded matches the full hostname', () => {
    assert.equal(isExcluded('news.example', ['news.example']), true);
    assert.equal(isExcluded('www.news.example', ['news.example']), false);
});
