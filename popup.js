document.addEventListener('DOMContentLoaded', () => {
    const keywordInput = document.getElementById('keywordInput');
    const addKeywordButton = document.getElementById('addKeyword');
    const keywordList = document.getElementById('keywordList');
    const clearHistoryButton = document.getElementById('clearHistory');

    // Load the current keyword list
    chrome.storage.sync.get('keywords', (items) => {
        const keywords = items.keywords || [];
        keywords.forEach((keyword, index) => {
            const li = document.createElement('li');
            li.className = 'flex items-center justify-between bg-gray-200 p-2 rounded-md';
            li.innerHTML = `<span>${keyword.data}</span>`;
            const removeButton = document.createElement('button');
            removeButton.className = 'text-red-500 hover:text-red-700';
            removeButton.textContent = 'x';
            removeButton.addEventListener('click', () => {
                removeKeyword(index);
            });
            li.appendChild(removeButton);
            keywordList.appendChild(li);
        });
    });

    // Add a new keyword
    addKeywordButton.addEventListener('click', () => {
        const keyword = keywordInput.value.trim();
        if (keyword) {
            chrome.storage.sync.get('keywords', (items) => {
                const keywords = items.keywords || [];
                keywords.push({ data: keyword });
                chrome.storage.sync.set({ keywords: keywords }, () => {
                    const li = document.createElement('li');
                    li.className = 'flex items-center justify-between bg-gray-200 p-2 rounded-md';
                    li.innerHTML = `<span>${keyword}</span>`;
                    const removeButton = document.createElement('button');
                    removeButton.className = 'text-red-500 hover:text-red-700';
                    removeButton.textContent = 'x';
                    removeButton.addEventListener('click', () => {
                        removeKeyword(keywords.length - 1);
                    });
                    li.appendChild(removeButton);
                    keywordList.appendChild(li);
                    keywordInput.value = ''; // Clear input field
                });
            });
        }
    });

    // Clear browsing history based on keywords
    clearHistoryButton.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'clearMatchingHistory' });
    });

    function removeKeyword(index) {
        chrome.storage.sync.get('keywords', (items) => {
            const keywords = items.keywords || [];
            keywords.splice(index, 1);
            chrome.storage.sync.set({ keywords: keywords }, () => {
                // Refresh the keyword list
                keywordList.innerHTML = '';
                keywords.forEach((keyword, idx) => {
                    const li = document.createElement('li');
                    li.className = 'flex items-center justify-between bg-gray-200 p-2 rounded-md';
                    li.innerHTML = `<span>${keyword.data}</span>`;
                    const removeButton = document.createElement('button');
                    removeButton.className = 'text-red-500 hover:text-red-700';
                    removeButton.textContent = 'x';
                    removeButton.addEventListener('click', () => {
                        removeKeyword(idx);
                    });
                    li.appendChild(removeButton);
                    keywordList.appendChild(li);
                });
            });
        });
    }
});
