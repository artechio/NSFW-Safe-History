// Process all images on the page
function processImages() {
    const images = document.getElementsByTagName('img');
    for (const img of images) {
        if (img.complete) {
            blurImage(img);
        } else {
            img.addEventListener('load', () => blurImage(img));
        }
    }
}

// Blur an image and add warning overlay
function blurImage(img) {
    // Skip small images, already processed images, and invalid images
    if (!img || !img.naturalWidth || !img.naturalHeight || 
        img.naturalWidth < 64 || img.naturalHeight < 64 || 
        img.hasAttribute('data-nsfw-processed')) {
        return;
    }

    // Mark as processed
    img.setAttribute('data-nsfw-processed', 'true');

    // Create warning overlay
    const overlay = document.createElement('div');
    overlay.className = 'nsfw-warning';
    overlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0,0,0,0.7);
        color: white;
        font-size: 14px;
        cursor: pointer;
        z-index: 10000;
    `;
    overlay.textContent = 'Click to view image';
    
    // Wrap image in container if not already wrapped
    let container = img.parentElement;
    if (!container || !container.classList.contains('nsfw-container')) {
        container = document.createElement('div');
        container.className = 'nsfw-container';
        container.style.cssText = `
            position: relative;
            display: inline-block;
            max-width: 100%;
        `;
        if (img.parentNode) {
            img.parentNode.insertBefore(container, img);
            container.appendChild(img);
        }
    }
    container.appendChild(overlay);
    
    // Blur the image
    img.style.filter = 'blur(20px)';
    img.title = 'Potentially NSFW content';
    
    // Handle click to reveal
    overlay.addEventListener('click', (e) => {
        e.stopPropagation();
        img.style.filter = '';
        overlay.remove();
    });
}

// Check if URL is in blocklist
function checkIfBlocked(callback) {
    chrome.storage.sync.get(['excludedSites'], (items) => {
        const excludedSites = items.excludedSites || [];
        const currentDomain = window.location.hostname;
        callback(!excludedSites.includes(currentDomain));
    });
}

// Process new images added dynamically
function setupObserver() {
    // Make sure we have a valid document and body
    if (!document || !document.body) {
        console.warn('Document or body not ready for observer');
        return;
    }

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            // Handle added nodes
            mutation.addedNodes.forEach((node) => {
                if (node.nodeName === 'IMG') {
                    blurImage(node);
                } else if (node.getElementsByTagName) {
                    const images = node.getElementsByTagName('img');
                    Array.from(images).forEach(img => blurImage(img));
                }
            });

            // Handle attribute changes on images
            if (mutation.type === 'attributes' && 
                mutation.target.nodeName === 'IMG' &&
                !mutation.target.hasAttribute('data-nsfw-processed')) {
                blurImage(mutation.target);
            }
        });
    });

    try {
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['src']
        });
    } catch (error) {
        console.error('Error setting up observer:', error);
    }

    return observer;
}

// Initialize when page loads
function initialize() {
    // Process existing images
    processImages();

    // Set up observer for new images
    let observer = null;
    
    const setupObserverWhenReady = () => {
        if (document.body) {
            observer = setupObserver();
        } else {
            // If body is not ready, wait and try again
            setTimeout(setupObserverWhenReady, 100);
        }
    };

    setupObserverWhenReady();

    // Handle messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'ACTIVATE_FILTER') {
            processImages();
            if (!observer) {
                observer = setupObserver();
            }
            sendResponse({ success: true });
        }
    });
}

// Start initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}