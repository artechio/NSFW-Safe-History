const test = require('node:test');
const assert = require('node:assert/strict');
const { planMedia, needsSecondFrame, isClassifiable } = require('../src/lib/mediaPolicy');

test('planMedia blurs everything on filtered sites', () => {
    for (const tag of ['IMG', 'VIDEO', 'IFRAME']) {
        assert.equal(planMedia({ tag, siteListed: true, url: '' }), 'blur');
    }
});

test('planMedia never blurs unreadable media on unlisted sites', () => {
    assert.equal(planMedia({ tag: 'IFRAME', siteListed: false, url: '' }), 'skip');
    assert.equal(planMedia({ tag: 'IFRAME', siteListed: false, url: 'https://player.example/embed' }), 'skip');
    assert.equal(planMedia({ tag: 'VIDEO', siteListed: false, url: '' }), 'skip');
    assert.equal(planMedia({ tag: 'VIDEO', siteListed: false, url: 'blob:https://a.example/1' }), 'skip');
});

test('planMedia classifies readable media on unlisted sites', () => {
    assert.equal(planMedia({ tag: 'IMG', siteListed: false, url: 'https://a.example/x.jpg' }), 'classify');
    assert.equal(planMedia({ tag: 'VIDEO', siteListed: false, url: 'data:image/jpeg;base64,AAAA' }), 'classify');
});

test('needsSecondFrame only for videos without a poster', () => {
    assert.equal(needsSecondFrame('VIDEO', false), true);
    assert.equal(needsSecondFrame('VIDEO', true), false);
    assert.equal(needsSecondFrame('IMG', false), false);
});

test('isClassifiable accepts http(s) and data images only', () => {
    assert.equal(isClassifiable('https://a.example/x.png'), true);
    assert.equal(isClassifiable('data:image/png;base64,AA'), true);
    assert.equal(isClassifiable('blob:https://a.example/1'), false);
    assert.equal(isClassifiable(''), false);
    assert.equal(isClassifiable(undefined), false);
});
