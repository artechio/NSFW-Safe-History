// Function to load keywords from assets/keyword.txt
function loadKeywords(callback) {
    fetch(chrome.runtime.getURL('assets/keyword.txt'))
        .then(response => response.text())
        .then(text => {
            // Split text into lines (assuming each keyword is on a new line)
            const keywords = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            callback(keywords);
        })
        .catch(error => console.error('Error loading keywords:', error));
}

// Function to check for keywords in the page content
function checkForKeywords(keywords) {
    let keywordFound = false;

    keywords.forEach(keyword => {
        if (document.body.innerText.toLowerCase().includes(keyword.toLowerCase())) {
            keywordFound = true;
            console.log(`Keyword found: ${keyword}`);
        }
    });

    // Send message if a keyword is found
    if (keywordFound) {
        chrome.runtime.sendMessage({ adultContentFound: true });
    }
}

// Function to check if the current site is excluded
function isSiteExcluded(callback) {
    const url = new URL(window.location.href);
    const domain = url.hostname;

    chrome.storage.sync.get('excludedSites', (data) => {
        const excludedSites = data.excludedSites || [];
        callback(excludedSites.includes(domain));
    });
}

// Load keywords and check the page content unless the site is excluded
isSiteExcluded((isExcluded) => {
    if (!isExcluded) {
        loadKeywords(checkForKeywords);
    } else {
        console.log(`This site (${window.location.hostname}) is excluded.`);
    }
});
