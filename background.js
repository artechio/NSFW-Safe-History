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

// Load default keywords from file
async function loadDefaultKeywords() {
    try {
        const response = await fetch(chrome.runtime.getURL('assets/keyword.txt'));
        const text = await response.text();
        return text.split('\n').filter(keyword => keyword.trim().length > 0);
    } catch (error) {
        console.error('Error loading default keywords:', error);
        return [];
    }
}

// Get start time based on history range setting
async function getHistoryStartTime() {
    const settings = await chrome.storage.sync.get(['historyRange', 'customStartDate']);
    
    if (settings.historyRange === 'custom' && settings.customStartDate) {
        return new Date(settings.customStartDate).getTime();
    }
    
    const days = parseInt(settings.historyRange || '1');
    return Date.now() - (days * 24 * 60 * 60 * 1000);
}

// Load all keywords (default + user-defined)
async function loadAllKeywords(callback) {
    const defaultKeywords = await loadDefaultKeywords();
    
    chrome.storage.sync.get(['keywords', 'defaultKeywordsEnabled'], (items) => {
        let keywords = (items.keywords || []).map(keyword => keyword.data);
        
        // Add default keywords if enabled
        if (items.defaultKeywordsEnabled !== false) {
            keywords = [...keywords, ...defaultKeywords];
        }
        
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

// Check if content matches NSFW criteria
function isNSFWContent(text, keywords) {
    if (!text) return false;
    text = text.toLowerCase();
    return keywords.some(keyword => {
        const kw = keyword.toLowerCase();
        // Check for exact word matches using word boundaries
        const regex = new RegExp(`\\b${kw}\\b`, 'i');
        return regex.test(text);
    });
}

// Clear history entries matching keywords, excluding sites in the excluded list
async function clearMatchingHistory() {
    const startTime = await getHistoryStartTime();
    
    loadAllKeywords(keywords => {
        loadExcludedSites(excludedSites => {
            chrome.history.search({ 
                text: '', 
                maxResults: 10000,
                startTime: startTime
            }, results => {
                let deletedCount = 0;
                
                results.forEach(historyItem => {
                    try {
                        const url = new URL(historyItem.url);
                        const domain = extractDomain(historyItem.url);

                        if (!excludedSites.includes(domain)) {
                            // Check both URL and title for NSFW content
                            if (isNSFWContent(historyItem.url, keywords) || 
                                isNSFWContent(historyItem.title, keywords)) {
                                
                                chrome.history.deleteUrl({ url: historyItem.url }, () => {
                                    if (!chrome.runtime.lastError) {
                                        deletedCount++;
                                        console.log('Deleted:', historyItem.url);
                                    }
                                });

                                // If root URL is found with NSFW content, clean entire domain
                                if (isRootUrl(historyItem.url)) {
                                    chrome.history.search({ 
                                        text: domain,
                                        startTime: startTime
                                    }, domainResults => {
                                        domainResults.forEach(item => {
                                            chrome.history.deleteUrl({ url: item.url });
                                        });
                                    });
                                }
                            }
                        }
                    } catch (e) {
                        console.error('Error processing URL:', historyItem.url, e);
                    }
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
