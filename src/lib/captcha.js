const CAPTCHA_HOSTS = [
    'recaptcha.net',
    'hcaptcha.com',
    'challenges.cloudflare.com',
    'arkoselabs.com',
    'funcaptcha.com',
    'geetest.com',
    'captcha-delivery.com',
    'friendlycaptcha.com',
    'mtcaptcha.com'
];

const CAPTCHA_PATH_MARKERS = [
    '/recaptcha',
    '/hcaptcha',
    '/turnstile',
    '/captcha',
    'arkose',
    'funcaptcha',
    'geetest',
    'smartcaptcha'
];

const CAPTCHA_ATTR_RE = /captcha|recaptcha|h-?captcha|cf-turnstile|turnstile|arkose|funcaptcha|geetest|challenge-form|g-recaptcha/i;

function hostnameOf(value) {
    try {
        return new URL(String(value || '')).hostname.toLowerCase();
    } catch (error) {
        return '';
    }
}

function hostEndsWith(host, domain) {
    return host === domain || host.endsWith(`.${domain}`);
}

function hostLooksLikeCaptcha(hostname) {
    const host = String(hostname || '').trim().toLowerCase().replace(/\.$/, '');
    if (!host) return false;
    return CAPTCHA_HOSTS.some(domain => hostEndsWith(host, domain));
}

function urlLooksLikeCaptcha(url) {
    const value = String(url || '');
    if (!value) return false;
    const lower = value.toLowerCase();
    if (CAPTCHA_PATH_MARKERS.some(marker => lower.includes(marker))) {
        const host = hostnameOf(value);
        if (!host) return true;
        if (hostLooksLikeCaptcha(host)) return true;
        if (hostEndsWith(host, 'google.com') || hostEndsWith(host, 'gstatic.com')) return true;
        if (hostEndsWith(host, 'yandex.ru') || hostEndsWith(host, 'yandex.com')) return true;
        if (hostEndsWith(host, 'cloudflare.com')) return true;
        if (hostLooksLikeCaptcha(host)) return true;
    }

    return hostLooksLikeCaptcha(hostnameOf(value));
}

function attrLooksLikeCaptcha(value) {
    return CAPTCHA_ATTR_RE.test(String(value || ''));
}

function elementLooksLikeCaptcha(element) {
    if (!element || element.nodeType !== 1) return false;

    const attrs = [
        element.id,
        element.className,
        element.getAttribute && element.getAttribute('name'),
        element.getAttribute && element.getAttribute('title'),
        element.getAttribute && element.getAttribute('aria-label'),
        element.getAttribute && element.getAttribute('data-sitekey'),
        element.getAttribute && element.getAttribute('data-callback')
    ];
    if (attrs.some(attrLooksLikeCaptcha)) return true;

    if (element.tagName === 'IFRAME' || element.tagName === 'IMG' || element.tagName === 'VIDEO') {
        if (urlLooksLikeCaptcha(element.src || element.currentSrc || '')) return true;
    }

    try {
        if (typeof element.closest === 'function') {
            const host = element.closest(
                '.g-recaptcha, .h-captcha, .cf-turnstile, [data-sitekey], [data-captcha], iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="turnstile"], iframe[src*="arkose"], iframe[src*="funcaptcha"]'
            );
            if (host) return true;
        }
    } catch (error) {
        // ignore
    }

    return false;
}

module.exports = {
    hostLooksLikeCaptcha,
    urlLooksLikeCaptcha,
    elementLooksLikeCaptcha,
    hostnameOf
};
