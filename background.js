// Helper function to extract the domain from a URL
function extractDomain(url) {
    let domain;
    if (url.indexOf("://") > -1) {
        domain = url.split('/')[2];
    } else {
        domain = url.split('/')[0];
    }
    domain = domain.split(':')[0]; // Remove port number
    return domain;
}

// Helper function to check if the URL is a root URL
function isRootUrl(url) {
    return /^https?\:\/\/[^\/]+\/?$/.test(url);
}

// Load keywords from chrome.storage.sync
function loadKeywords(callback) {
    chrome.storage.sync.get('keywords', (items) => {
        const keywords = (items.keywords || []).map(keyword => keyword.data);
        callback(keywords);
    });
}

// Clear history entries matching keywords
function clearMatchingHistory() {
    loadKeywords(keywords => {
        chrome.history.search({ text: '', maxResults: 1000 }, results => { // Adjust maxResults as needed
            results.forEach(historyItem => {
                keywords.forEach(keyword => {
                    if (historyItem.url.toLowerCase().includes(keyword.toLowerCase())) {
                        chrome.history.deleteUrl({ url: historyItem.url }, () => {
                            if (chrome.runtime.lastError) {
                                console.error('Failed to delete URL:', chrome.runtime.lastError);
                            } else {
                                console.log('URL deleted:', historyItem.url);
                            }
                        });
                    }
                });
            });
        });
    });
}

// Event listener for context menu
function contextMenuClicked(info, tab) {
    chrome.tabs.create({ url: "https://chrome.google.com/webstore/detail/safe-history/dlkkhffefpkmobphiphbghhhilhoopma/support" });
}

// Add context menu on installation
chrome.runtime.onInstalled.addListener(() => {
    // Create a context menu for feedback on domains
    chrome.contextMenus.create({
        id: "provideFeedback", // Ensure this id is unique
        title: "Provide feedback on this domain",
        contexts: ["all"],
        onclick: contextMenuClicked
    });

    // Initialize storage with an empty keyword list if not present
    chrome.storage.sync.get("keywords", (items) => {
        if (typeof items.keywords === "undefined") {
            chrome.storage.sync.set({ keywords: [] });
        }
    });

    // Initialize the switchOn flag
    chrome.storage.sync.set({ switchOn: true });
});

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Message received:', message);
    
    if (message.adultContentFound) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (tab && tab.url) {
                const url = tab.url;

                // Delete the specific URL from history
                chrome.history.deleteUrl({ url: url }, () => {
                    if (chrome.runtime.lastError) {
                        console.error('Failed to delete URL:', chrome.runtime.lastError);
                    } else {
                        console.log('URL deleted:', url);
                    }
                });

                // If it's a root URL, delete all entries from the domain
                if (isRootUrl(url)) {
                    const domain = extractDomain(url);
                    chrome.history.search({ text: domain }, (results) => {
                        results.forEach(historyItem => {
                            chrome.history.deleteUrl({ url: historyItem.url }, () => {
                                if (chrome.runtime.lastError) {
                                    console.error('Failed to delete URL:', chrome.runtime.lastError);
                                } else {
                                    console.log('URL deleted from domain:', historyItem.url);
                                }
                            });
                        });
                    });
                }
            }
        });
    } else if (message.action === 'clearMatchingHistory') {
        clearMatchingHistory();
    }
});
