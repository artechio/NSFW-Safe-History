// Global settings with defaults
let settings = {
    blurIntensity: 20,
    autoBlur: true,
    minImageSize: 64
};

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
        img.naturalWidth < settings.minImageSize || 
        img.naturalHeight < settings.minImageSize || 
        img.hasAttribute('data-nsfw-processed')) {
        return;
    }

    // Skip if auto-blur is disabled
    if (!settings.autoBlur) {
        return;
    }

    // Mark as processed
    img.setAttribute('data-nsfw-processed', 'true');

    // Create warning overlay
    const overlay = document.createElement('div');
    overlay.className = 'nsfw-warning';
    overlay.textContent = 'Click to view image';
    
    // Wrap image in container if not already wrapped
    let container = img.parentElement;
    if (!container || !container.classList.contains('nsfw-container')) {
        container = document.createElement('div');
        container.className = 'nsfw-container';
        if (img.parentNode) {
            img.parentNode.insertBefore(container, img);
            container.appendChild(img);
        }
    }
    container.appendChild(overlay);
    
    // Apply blur with current intensity
    img.style.setProperty('--blur-intensity', `${settings.blurIntensity}px`);
    img.title = 'Potentially NSFW content';
    
    // Handle click to reveal
    overlay.addEventListener('click', (e) => {
        e.stopPropagation();
        img.style.removeProperty('--blur-intensity');
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

// Load settings from storage
function loadSettings(callback) {
    chrome.storage.sync.get(['blurIntensity', 'autoBlur', 'minImageSize'], (items) => {
        settings = {
            blurIntensity: items.blurIntensity || 20,
            autoBlur: items.autoBlur !== false,
            minImageSize: items.minImageSize || 64
        };
        if (callback) callback();
    });
}

// Update all processed images with new settings
function updateProcessedImages() {
    const images = document.querySelectorAll('img[data-nsfw-processed]');
    images.forEach(img => {
        if (settings.autoBlur) {
            img.style.setProperty('--blur-intensity', `${settings.blurIntensity}px`);
        } else {
            img.style.removeProperty('--blur-intensity');
            const overlay = img.parentElement?.querySelector('.nsfw-warning');
            if (overlay) overlay.remove();
        }
    });
}

// Initialize when page loads
function initialize() {
    // Handle messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'ACTIVATE_FILTER') {
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