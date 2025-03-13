// Constants
const BLOCKLIST_UPDATE_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 1 week
const BLOCKLIST_URL = 'https://raw.githubusercontent.com/columndeeply/hosts/main/lists/porn.txt';

// Default settings
const defaultSettings = {
    useDefaultBlocklist: true,
    customBlocklist: [],
    autoDeleteHistory: true,
    historyCleanupInterval: "1",
    customStartDate: null,
    lastBlocklistUpdate: null,
    excludedSites: []
};

// Initialize settings
function initializeSettings() {
    chrome.storage.sync.get(null, (settings) => {
        if (Object.keys(settings).length === 0) {
            chrome.storage.sync.set(defaultSettings);
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

// Check if URL should be blocked
function checkIfBlocked(url, callback) {
    try {
        const hostname = new URL(url).hostname;
        chrome.storage.sync.get(['excludedSites'], (items) => {
            if ((items.excludedSites || []).includes(hostname)) {
                callback(false);
                return;
            }
            
            chrome.storage.local.get('blocklist', (items) => {
                const blocklist = items.blocklist || [];
                chrome.storage.sync.get(['useDefaultBlocklist', 'customBlocklist'], (items) => {
                    const useDefault = items.useDefaultBlocklist !== false;
                    const customList = items.customBlocklist || [];
                    
                    if (useDefault || customList.length > 0) {
                        const isBlocked = [...(useDefault ? blocklist : []), ...customList]
                            .some(domain => hostname === domain || hostname.endsWith('.' + domain));
                        callback(isBlocked);
                    } else {
                        callback(false);
                    }
                });
            });
        });
    } catch (error) {
        console.error('Error checking URL:', error);
        callback(false);
    }
}

// Clean history based on settings
function cleanHistory() {
    chrome.storage.sync.get(['autoDeleteHistory', 'historyCleanupInterval', 'customStartDate'], (items) => {
        if (!items.autoDeleteHistory) return;

        let startTime;
        if (items.historyCleanupInterval === 'custom' && items.customStartDate) {
            startTime = new Date(items.customStartDate).getTime();
        } else {
            const days = parseInt(items.historyCleanupInterval) || 1;
            startTime = Date.now() - (days * 24 * 60 * 60 * 1000);
        }

        chrome.history.search({ text: '', startTime: startTime, maxResults: 10000 }, (historyItems) => {
            historyItems.forEach(item => {
                checkIfBlocked(item.url, (shouldBlock) => {
                    if (shouldBlock) {
                        chrome.history.deleteUrl({ url: item.url });
                    }
                });
            });
        });
    });
}

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        checkIfBlocked(tab.url, (shouldBlock) => {
            if (shouldBlock) {
                chrome.tabs.sendMessage(tabId, { action: 'ACTIVATE_FILTER' })
                    .catch(error => console.error('Error sending message to tab:', error));
            }
        });
    }
});

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'CHECK_URL') {
        checkIfBlocked(sender.tab.url, (shouldBlock) => {
            sendResponse(shouldBlock);
        });
        return true;
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

// Set up alarm for history cleanup
chrome.alarms.create('cleanHistory', { periodInMinutes: 30 });
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'cleanHistory') {
        cleanHistory();
    }
});

// Initialize when extension is installed or updated
chrome.runtime.onInstalled.addListener(initializeSettings);
initializeSettings(); 