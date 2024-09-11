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

// Load excluded sites from storage
function loadExcludedSites(callback) {
    chrome.storage.sync.get('excludedSites', (data) => {
        const excludedSites = data.excludedSites || [];
        callback(excludedSites);
    });
}

// Clear history entries matching keywords, excluding sites in the excluded list
function clearMatchingHistory() {
    loadKeywords(keywords => {
        loadExcludedSites(excludedSites => {
            chrome.history.search({ text: '', maxResults: 1000 }, results => {
                results.forEach(historyItem => {
                    const domain = extractDomain(historyItem.url);
                    
                    // Skip if the domain is in the excludedSites list
                    if (excludedSites.includes(domain)) {
                        console.log(`Skipping excluded site: ${domain}`);
                        return;
                    }

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
    });
}

// Event listener for context menu
function contextMenuClicked(info, tab) {
    chrome.tabs.create({ url: "https://github.com/artechio/NSFW-Safe-History/issues" });
}

// Add context menu on installation
chrome.runtime.onInstalled.addListener(() => {
    // Create a context menu for feedback on domains
    chrome.contextMenus.create({
        id: "provideFeedback", // Ensure this id is unique
        title: "Provide feedback on this domain",
        contexts: ["all"],
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

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "provideFeedback") {
        contextMenuClicked(info, tab);
    }
});

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Message received:', message);
    
    if (message.adultContentFound) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (tab && tab.url) {
                const url = tab.url;
                const domain = extractDomain(url);

                // Skip if the site is excluded
                loadExcludedSites(excludedSites => {
                    if (excludedSites.includes(domain)) {
                        console.log(`Skipping excluded site: ${domain}`);
                        return;
                    }

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
                });
            }
        });
    } else if (message.action === 'clearMatchingHistory') {
        clearMatchingHistory();
    }
});

// Exclude site by URL context menu
chrome.runtime.onInstalled.addListener(() => {
    // Create a context menu item
    chrome.contextMenus.create({
        id: 'excludeSite',
        title: 'Exclude this site',
        contexts: ['all']  // The context menu will show up on all types of pages
    });

    // Initialize the storage if not set
    chrome.storage.sync.get('excludedSites', (data) => {
        if (!data.excludedSites) {
            chrome.storage.sync.set({ excludedSites: [] });
        }
    });
});

// Listen for when the context menu is clicked
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'excludeSite') {
        const url = new URL(tab.url);
        const domain = url.hostname;

        // Add the domain to the excludedSites array in chrome.storage.sync
        chrome.storage.sync.get('excludedSites', (data) => {
            const excludedSites = data.excludedSites || [];
            
            if (!excludedSites.includes(domain)) {
                excludedSites.push(domain);
                chrome.storage.sync.set({ excludedSites }, () => {
                    console.log(`Site excluded: ${domain}`);
                });
            } else {
                console.log(`Site already excluded: ${domain}`);
            }
        });
    }
});
