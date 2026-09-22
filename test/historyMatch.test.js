const test = require('node:test');
const assert = require('node:assert/strict');
const { titleOrUrlLooksAdult } = require('../src/lib/historyMatch');

test('titleOrUrlLooksAdult catches adult titles and hostnames', () => {
    assert.equal(titleOrUrlLooksAdult('https://example.com/video', 'Massage - Porn Photos & Videos'), true);
    assert.equal(titleOrUrlLooksAdult('https://www.pornhub.com/view_video.php?viewkey=1', 'Anything'), true);
    assert.equal(titleOrUrlLooksAdult('https://news.example.com/story', 'Local politics update'), false);
});
