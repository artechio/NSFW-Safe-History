const test = require('node:test');
const assert = require('node:assert/strict');
const { isNsfwPrediction } = require('../src/lib/scores');

test('isNsfwPrediction requires Porn or Hentai at the threshold', () => {
    const predictions = [
        { className: 'Sexy', probability: 0.99 },
        { className: 'Porn', probability: 0.69 },
        { className: 'Hentai', probability: 0.1 }
    ];
    assert.equal(isNsfwPrediction(predictions, 0.7), false);
    assert.equal(isNsfwPrediction([
        { className: 'Hentai', probability: 0.7 }
    ], 0.7), true);
    assert.equal(isNsfwPrediction(null, 0.7), false);
});
