const test = require('node:test');
const assert = require('node:assert/strict');
const {
    hostLooksLikeCaptcha,
    urlLooksLikeCaptcha
} = require('../src/lib/captcha');

test('hostLooksLikeCaptcha recognizes captcha providers', () => {
    assert.equal(hostLooksLikeCaptcha('challenges.cloudflare.com'), true);
    assert.equal(hostLooksLikeCaptcha('newassets.hcaptcha.com'), true);
    assert.equal(hostLooksLikeCaptcha('www.recaptcha.net'), true);
    assert.equal(hostLooksLikeCaptcha('client-api.arkoselabs.com'), true);
    assert.equal(hostLooksLikeCaptcha('pornhub.com'), false);
    assert.equal(hostLooksLikeCaptcha('www.google.com'), false);
    assert.equal(hostLooksLikeCaptcha('cdn.cloudflare.com'), false);
});

test('urlLooksLikeCaptcha matches widget and asset urls', () => {
    assert.equal(
        urlLooksLikeCaptcha('https://www.google.com/recaptcha/api2/anchor?k=abc'),
        true
    );
    assert.equal(
        urlLooksLikeCaptcha('https://www.gstatic.com/recaptcha/releases/x/styles__ltr.css'),
        true
    );
    assert.equal(
        urlLooksLikeCaptcha('https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/b/turnstile'),
        true
    );
    assert.equal(
        urlLooksLikeCaptcha('https://newassets.hcaptcha.com/captcha/v1/hash/static/hcaptcha.html'),
        true
    );
    assert.equal(urlLooksLikeCaptcha('https://cdn.example.com/image.jpg'), false);
    assert.equal(urlLooksLikeCaptcha('https://www.google.com/maps'), false);
});
