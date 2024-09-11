document.addEventListener('DOMContentLoaded', () => {
    const keywordInput = document.getElementById('keywordInput');
    const addKeywordButton = document.getElementById('addKeyword');
    const keywordList = document.getElementById('keywordList');
    const clearHistoryButton = document.getElementById('clearHistory');
    const excludeSiteButton = document.getElementById('excludeSite');
    const excludedSitesList = document.getElementById('excludedSitesList');

    let currentSiteDomain = '';

    // Load current keywords and excluded sites on popup open
    chrome.storage.sync.get(['keywords', 'excludedSites'], (items) => {
        const keywords = items.keywords || [];
        keywords.forEach((keyword, index) => {
            addKeywordToList(keyword.data, index);
        });

        const excludedSites = items.excludedSites || [];
        excludedSites.forEach((site, index) => {
            addExcludedSiteToList(site, index);
        });
    });

    // Function to check if the current site is excluded
    function updateExcludeSiteButtonState() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const url = new URL(tabs[0].url);
            currentSiteDomain = url.hostname;

            chrome.storage.sync.get('excludedSites', (items) => {
                const excludedSites = items.excludedSites || [];
                if (excludedSites.includes(currentSiteDomain)) {
                    excludeSiteButton.disabled = true;
                    excludeSiteButton.textContent = 'Site Excluded';
                    excludeSiteButton.classList.add('bg-gray-400', 'cursor-not-allowed');
                    excludeSiteButton.classList.remove('bg-red-500', 'hover:bg-red-600');
                } else {
                    excludeSiteButton.disabled = false;
                    excludeSiteButton.textContent = 'Exclude this site';
                    excludeSiteButton.classList.add('bg-red-500', 'hover:bg-red-600');
                    excludeSiteButton.classList.remove('bg-gray-400', 'cursor-not-allowed');
                }
            });
        });
    }

    // Initial call to update the button state when popup opens
    updateExcludeSiteButtonState();

    // Add new keyword to the list
    addKeywordButton.addEventListener('click', () => {
        const keyword = keywordInput.value.trim();
        if (keyword) {
            chrome.storage.sync.get('keywords', (items) => {
                const keywords = items.keywords || [];
                keywords.push({ data: keyword });
                chrome.storage.sync.set({ keywords: keywords }, () => {
                    addKeywordToList(keyword, keywords.length - 1);
                    keywordInput.value = ''; // Clear input
                });
            });
        }
    });

    // Clear NSFW history based on keywords
    clearHistoryButton.addEventListener('click', () => {
        chrome.storage.sync.get(['excludedSites', 'keywords'], (items) => {
            const excludedSites = items.excludedSites || [];
            const keywords = (items.keywords || []).map(keyword => keyword.data.toLowerCase());

            chrome.history.search({ text: '', startTime: 0 }, (historyItems) => {
                historyItems.forEach(item => {
                    const url = new URL(item.url);
                    const domain = url.hostname;

                    if (!excludedSites.includes(domain)) {
                        const title = item.title.toLowerCase();
                        const matchedKeyword = keywords.some(keyword => title.includes(keyword));

                        if (matchedKeyword) {
                            chrome.history.deleteUrl({ url: item.url });
                        }
                    }
                });
            });
        });
    });

    // Exclude the current site
    excludeSiteButton.addEventListener('click', () => {
        chrome.storage.sync.get('excludedSites', (items) => {
            const excludedSites = items.excludedSites || [];

            if (!excludedSites.includes(currentSiteDomain)) {
                excludedSites.push(currentSiteDomain);
                chrome.storage.sync.set({ excludedSites }, () => {
                    addExcludedSiteToList(currentSiteDomain, excludedSites.length - 1);
                    updateExcludeSiteButtonState(); // Update button state after exclusion
                });
            } else {
                alert(`Site already excluded: ${currentSiteDomain}`);
            }
        });
    });

    // Function to add keyword to the list
    function addKeywordToList(keyword, index) {
        const li = document.createElement('li');
        li.className = 'flex items-center justify-between bg-gray-200 p-2 rounded-md';
        li.innerHTML = `<span>${keyword}</span>`;
        const removeButton = document.createElement('button');
        removeButton.className = 'text-red-500 hover:text-red-700';
        removeButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#e34a4a" viewBox="0 0 256 256"><path d="M224,56a8,8,0,0,1-8,8h-8V208a16,16,0,0,1-16,16H64a16,16,0,0,1-16-16V64H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,56ZM88,32h80a8,8,0,0,0,0-16H88a8,8,0,0,0,0,16Z"></path></svg>`;
        removeButton.addEventListener('click', () => {
            removeKeyword(index);
        });
        li.appendChild(removeButton);
        keywordList.appendChild(li);
    }

    // Function to remove keyword
    function removeKeyword(index) {
        chrome.storage.sync.get('keywords', (items) => {
            const keywords = items.keywords || [];
            keywords.splice(index, 1);
            chrome.storage.sync.set({ keywords: keywords }, () => {
                keywordList.innerHTML = '';
                keywords.forEach((keyword, idx) => {
                    addKeywordToList(keyword.data, idx);
                });
            });
        });
    }

    // Function to add excluded site to the list with a remove button
    function addExcludedSiteToList(site, index) {
        const li = document.createElement('li');
        li.className = 'flex items-center justify-between bg-gray-200 p-2 rounded-md';
        li.innerHTML = `<span>${site}</span>`;
        const removeButton = document.createElement('button');
        removeButton.className = 'text-red-500 hover:text-red-700';
        removeButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#e34a4a" viewBox="0 0 256 256"><path d="M224,56a8,8,0,0,1-8,8h-8V208a16,16,0,0,1-16,16H64a16,16,0,0,1-16-16V64H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,56ZM88,32h80a8,8,0,0,0,0-16H88a8,8,0,0,0,0,16Z"></path></svg>`;
        removeButton.addEventListener('click', () => {
            removeExcludedSite(index);
        });
        li.appendChild(removeButton);
        excludedSitesList.appendChild(li);
    }

    // Function to remove excluded site
    function removeExcludedSite(index) {
        chrome.storage.sync.get('excludedSites', (items) => {
            const excludedSites = items.excludedSites || [];
            excludedSites.splice(index, 1);
            chrome.storage.sync.set({ excludedSites: excludedSites }, () => {
                excludedSitesList.innerHTML = '';
                excludedSites.forEach((site, idx) => {
                    addExcludedSiteToList(site, idx);
                });
                updateExcludeSiteButtonState(); // Update button state after re-inclusion
            });
        });
    }
});
