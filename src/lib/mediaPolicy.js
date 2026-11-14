// Decides what to do with one media element found on the page.
// 'blur'     — blur without checking (only on sites the user filters)
// 'classify' — send the URL or frame to the on-device model
// 'skip'     — leave it alone; nothing on unlisted sites is blurred without a positive result

function isClassifiable(url) {
    return typeof url === 'string' && (/^https?:/i.test(url) || url.startsWith('data:image/'));
}

function planMedia({ tag, siteListed, url }) {
    if (siteListed) return 'blur';
    // A frame's own content script checks the media inside it; the frame box itself is never blurred.
    if (tag === 'IFRAME') return 'skip';
    // Unreadable media (cross-origin video without CORS, a video with no frame yet) is not guessed at.
    if (!isClassifiable(url)) return 'skip';
    return 'classify';
}

// Live video frames change, so one frame is not enough to blur a video on an unlisted site.
function needsSecondFrame(tag, hasPoster) {
    return tag === 'VIDEO' && !hasPoster;
}

module.exports = {
    isClassifiable,
    planMedia,
    needsSecondFrame
};
