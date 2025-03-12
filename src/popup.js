document.addEventListener('DOMContentLoaded', () => {
    // Get DOM elements with error handling
    const elements = {
        keywordInput: document.getElementById('keywordInput'),
        addKeyword: document.getElementById('addKeyword'),
        keywordList: document.getElementById('keywordList'),
        clearHistory: document.getElementById('clearHistory'),
        excludeToggle: document.getElementById('excludeToggle'),
        defaultKeywordsToggle: document.getElementById('defaultKeywordsToggle'),
        excludeToggleLabel: document.getElementById('excludeToggleLabel'),
        openOptions: document.getElementById('openOptions')
    };

    // Validate all elements exist
    for (const [key, element] of Object.entries(elements)) {
        if (!element) {
            console.error(`Element not found: ${key}`);
            return;
        }
    }

    let currentSiteDomain = '';

    // Load current keywords and excluded sites on popup open
    chrome.storage.sync.get(['keywords', 'excludedSites', 'defaultKeywordsEnabled'], (items) => {
        const keywords = items.keywords || [];
        keywords.forEach((keyword, index) => {
            addKeywordToList(keyword.data, index);
        });

        const excludedSites = items.excludedSites || [];
        updateExcludeToggleState(excludedSites);

        // Set default keywords toggle state
        elements.defaultKeywordsToggle.checked = items.defaultKeywordsEnabled !== false;
    });

    // Function to check if the current site is excluded
    function updateExcludeToggleState(excludedSites) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].url) {
                try {
                    const url = new URL(tabs[0].url);
                    currentSiteDomain = url.hostname;

                    elements.excludeToggle.checked = !excludedSites.includes(currentSiteDomain);
                    updateExcludeToggleLabel(elements.excludeToggle.checked);
                } catch (e) {
                    console.error('Error processing URL:', e);
                }
            }
        });
    }

    // Handle toggling filter on/off for the current site
    elements.excludeToggle.addEventListener('change', () => {
        chrome.storage.sync.get('excludedSites', (items) => {
            let excludedSites = items.excludedSites || [];

            if (elements.excludeToggle.checked) {
                excludedSites = excludedSites.filter(site => site !== currentSiteDomain);
            } else if (!excludedSites.includes(currentSiteDomain)) {
                excludedSites.push(currentSiteDomain);
            }

            chrome.storage.sync.set({ excludedSites }, () => {
                updateExcludeToggleLabel(elements.excludeToggle.checked);
            });
        });
    });

    // Handle default keywords toggle
    elements.defaultKeywordsToggle.addEventListener('change', () => {
        chrome.storage.sync.set({ 
            defaultKeywordsEnabled: elements.defaultKeywordsToggle.checked 
        });
    });

    // Clear NSFW history
    elements.clearHistory.addEventListener('click', () => {
        elements.clearHistory.disabled = true;
        elements.clearHistory.classList.add('opacity-50');

        chrome.runtime.sendMessage({ action: 'clearMatchingHistory' }, () => {
            showStatusMessage('History cleaning in progress...', 'info');
            
            // Re-enable button after a delay
            setTimeout(() => {
                elements.clearHistory.disabled = false;
                elements.clearHistory.classList.remove('opacity-50');
            }, 2000);
        });
    });

    // Add new keyword
    elements.addKeyword.addEventListener('click', addNewKeyword);
    elements.keywordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addNewKeyword();
        }
    });

    function addNewKeyword() {
        const keyword = elements.keywordInput.value.trim();
        if (keyword) {
            chrome.storage.sync.get('keywords', (items) => {
                const keywords = items.keywords || [];
                keywords.push({ data: keyword });
                chrome.storage.sync.set({ keywords }, () => {
                    addKeywordToList(keyword, keywords.length - 1);
                    elements.keywordInput.value = '';
                    showStatusMessage('Keyword added successfully', 'success');
                });
            });
        }
    }

    // Function to add keyword to the list
    function addKeywordToList(keyword, index) {
        const li = document.createElement('li');
        li.className = 'keyword-item';

        const keywordSpan = document.createElement('span');
        keywordSpan.className = 'keyword-text';
        keywordSpan.textContent = keyword;

        const removeButton = document.createElement('button');
        removeButton.className = 'remove-btn';

        const trashIcon = document.createElement('img');
        trashIcon.src = chrome.runtime.getURL('assets/trash.svg');
        trashIcon.alt = 'Delete';
        trashIcon.className = 'icon';

        removeButton.appendChild(trashIcon);
        removeButton.addEventListener('click', () => removeKeyword(index));

        li.appendChild(keywordSpan);
        li.appendChild(removeButton);
        elements.keywordList.appendChild(li);
    }

    // Function to remove keyword
    function removeKeyword(index) {
        chrome.storage.sync.get('keywords', (items) => {
            const keywords = items.keywords || [];
            keywords.splice(index, 1);
            chrome.storage.sync.set({ keywords }, () => {
                elements.keywordList.innerHTML = '';
                keywords.forEach((keyword, idx) => {
                    addKeywordToList(keyword.data, idx);
                });
                showStatusMessage('Keyword removed successfully', 'success');
            });
        });
    }

    // Function to update the label for exclude toggle
    function updateExcludeToggleLabel(isFilterActive) {
        elements.excludeToggleLabel.textContent = isFilterActive
            ? "Filter is active for this website"
            : "Filter is NOT active for this website";
    }

    // Function to show status messages
    function showStatusMessage(message, type = 'success') {
        const status = document.createElement('div');
        status.textContent = message;
        status.className = `status-message status-${type}`;
        document.body.appendChild(status);
        setTimeout(() => status.remove(), 3000);
    }

    // Handle opening options page
    elements.openOptions.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.openOptionsPage();
    });
});
