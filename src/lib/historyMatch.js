const ADULT_PATTERNS = [
    /\bporn\b/i,
    /\bporno\b/i,
    /\bxxx\b/i,
    /\bhentai\b/i,
    /\bonlyfans\b/i,
    /\bxvideos\b/i,
    /\bxnxx\b/i,
    /\bxhamster\b/i,
    /\bredtube\b/i,
    /\byouporn\b/i,
    /\bpornhub\b/i,
    /\bspankbang\b/i,
    /\bnsfw\b/i,
    /\badult\s*video/i,
    /\bsex\s*video/i,
    /\.xxx(?:\/|$)/i
];

function titleOrUrlLooksAdult(url, title) {
    const haystack = `${url || ''} ${title || ''}`;
    return ADULT_PATTERNS.some(pattern => pattern.test(haystack));
}

module.exports = {
    ADULT_PATTERNS,
    titleOrUrlLooksAdult
};
