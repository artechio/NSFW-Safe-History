// Constants
const BLOCKLIST_UPDATE_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 1 week
const BLOCKLIST_URL = 'https://raw.githubusercontent.com/columndeeply/hosts/main/lists/porn.txt';
const DEFAULT_SETTINGS = {
    useDefaultBlocklist: true,
    customBlocklist: [],
    autoDeleteHistory: true,
    historyCleanupInterval: '1', // days
    customStartDate: null,
    lastBlocklistUpdate: null,
    excludedSites: []
};

// Initialize settings
function initializeSettings() {
    chrome.storage.sync.get(null, (settings) => {
        if (Object.keys(settings).length === 0) {
            chrome.storage.sync.set(DEFAULT_SETTINGS);
        }
        updateBlocklistIfNeeded();
    });
}

// Update blocklist if it's older than BLOCKLIST_UPDATE_INTERVAL
function updateBlocklistIfNeeded() {
    chrome.storage.sync.get('lastBlocklistUpdate', ({ lastBlocklistUpdate }) => {
        const now = Date.now();
        if (!lastBlocklistUpdate || (now - lastBlocklistUpdate > BLOCKLIST_UPDATE_INTERVAL)) {
            updateBlocklist();
        }
    });
}

// Update blocklist from remote source
function updateBlocklist() {
    fetch(BLOCKLIST_URL)
        .then(response => response.text())
        .then(text => {
            const domains = text
                .split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#'));

            chrome.storage.local.set({
                blocklist: domains,
                lastBlocklistUpdate: Date.now()
            });

            console.log(`Updated blocklist with ${domains.length} domains`);
        })
        .catch(error => {
            console.error('Error updating blocklist:', error);
        });
}

// Check if a URL matches any domain in the blocklist
function isURLBlocked(url, callback) {
    try {
        const hostname = new URL(url).hostname;
        
        chrome.storage.sync.get(['excludedSites'], (items) => {
            const excludedSites = items.excludedSites || [];
            if (excludedSites.includes(hostname)) {
                callback(false);
                return;
            }

            chrome.storage.local.get('blocklist', ({ blocklist }) => {
                chrome.storage.sync.get(['useDefaultBlocklist', 'customBlocklist'], (settings) => {
                    const { useDefaultBlocklist, customBlocklist } = settings;

                    if (!useDefaultBlocklist && (!customBlocklist || customBlocklist.length === 0)) {
                        callback(false);
                        return;
                    }

                    const domains = [
                        ...(useDefaultBlocklist ? blocklist || [] : []),
                        ...(customBlocklist || [])
                    ];

                    const isBlocked = domains.some(domain => 
                        hostname === domain || 
                        hostname.endsWith('.' + domain)
                    );
                    callback(isBlocked);
                });
            });
        });
    } catch (error) {
        console.error('Error checking URL:', error);
        callback(false);
    }
}

// Clean browser history based on settings
function cleanHistory() {
    chrome.storage.sync.get([
        'autoDeleteHistory',
        'historyCleanupInterval',
        'customStartDate'
    ], (settings) => {
        const { autoDeleteHistory, historyCleanupInterval, customStartDate } = settings;

        if (!autoDeleteHistory) return;

        let startTime;
        if (historyCleanupInterval === 'custom' && customStartDate) {
            startTime = new Date(customStartDate).getTime();
        } else {
            const days = parseInt(historyCleanupInterval) || 1;
            startTime = Date.now() - (days * 24 * 60 * 60 * 1000);
        }

        chrome.history.search({
            text: '',
            startTime,
            maxResults: 10000
        }, (historyItems) => {
            historyItems.forEach(item => {
                isURLBlocked(item.url, (isBlocked) => {
                    if (isBlocked) {
                        chrome.history.deleteUrl({ url: item.url });
                    }
                });
            });
        });
    });
}

// Handle tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        isURLBlocked(tab.url, (isBlocked) => {
            if (isBlocked) {
                chrome.tabs.sendMessage(tabId, { 
                    action: 'ACTIVATE_FILTER'
                }).catch(error => {
                    console.error('Error sending message to tab:', error);
                });
            }
        });
    }
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'CHECK_URL') {
        isURLBlocked(sender.tab.url, (isBlocked) => {
            sendResponse(isBlocked);
        });
        return true; // Keep the message channel open for async response
    }
    
    if (message.action === 'CLEAR_HISTORY') {
        cleanHistory();
        sendResponse({ success: true });
        return true;
    }

    if (message.action === 'UPDATE_SETTINGS') {
        chrome.storage.sync.set(message.settings, () => {
            sendResponse({ success: true });
        });
        return true;
    }
});

// Clean history periodically
chrome.alarms.create('cleanHistory', { periodInMinutes: 30 });
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'cleanHistory') {
        cleanHistory();
    }
});

// Initialize when extension loads
initializeSettings(); 