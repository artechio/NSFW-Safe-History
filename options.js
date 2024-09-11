document.addEventListener('DOMContentLoaded', () => {
  const keywordInput = document.getElementById('keywordInput');
  const addKeywordButton = document.getElementById('addKeyword');
  const keywordList = document.getElementById('keywordList');
  const clearHistoryButton = document.getElementById('clearHistory');
  const excludeToggle = document.getElementById('excludeToggle');
  const excludeToggleLabel = document.getElementById('excludeToggleLabel');

  let currentSiteDomain = '';

  // Load current keywords and excluded sites on popup open
  chrome.storage.sync.get(['keywords', 'excludedSites'], (items) => {
      const keywords = items.keywords || [];
      keywords.forEach((keyword, index) => {
          addKeywordToList(keyword.data, index);
      });

      const excludedSites = items.excludedSites || [];
      updateExcludeToggleState(excludedSites); // Update exclude toggle state for the current site
  });

  // Function to check if the current site is excluded
  function updateExcludeToggleState(excludedSites) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const url = new URL(tabs[0].url);
          currentSiteDomain = url.hostname;

          // Check if the current site is in the excludedSites list
          if (excludedSites.includes(currentSiteDomain)) {
              excludeToggle.checked = false; // Site is excluded, filter is off
              updateExcludeToggleLabel(false); // Show "Filter is NOT active"
          } else {
              excludeToggle.checked = true; // Filter is active for this site
              updateExcludeToggleLabel(true); // Show "Filter is active"
          }
      });
  }

  // Handle toggling filter on/off for the current site
  excludeToggle.addEventListener('change', () => {
      chrome.storage.sync.get('excludedSites', (items) => {
          let excludedSites = items.excludedSites || [];

          if (excludeToggle.checked) {
              // Remove current site from excludedSites (enable filter for this site)
              excludedSites = excludedSites.filter(site => site !== currentSiteDomain);
              updateExcludeToggleLabel(true); // Show "Filter is active"
          } else {
              // Add current site to excludedSites (disable filter for this site)
              if (!excludedSites.includes(currentSiteDomain)) {
                  excludedSites.push(currentSiteDomain);
              }
              updateExcludeToggleLabel(false); // Show "Filter is NOT active"
          }

          // Save the updated excludedSites list
          chrome.storage.sync.set({ excludedSites: excludedSites });
      });
  });

  // Function to update the label for exclude toggle
  function updateExcludeToggleLabel(isFilterActive) {
      if (isFilterActive) {
          excludeToggleLabel.textContent = "Filter is active for this website";
      } else {
          excludeToggleLabel.textContent = "Filter is NOT active for this website";
      }
  }

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

  // Function to add keyword to the list
  function addKeywordToList(keyword, index) {
      const li = document.createElement('li');
      li.className = 'flex items-center justify-between bg-gray-800 text-white p-2 rounded-md';

      const keywordSpan = document.createElement('span');
      keywordSpan.textContent = keyword;

      const removeButton = document.createElement('button');
      removeButton.className = 'text-red-500 hover:text-red-700';

      const trashIcon = document.createElement('img');
      trashIcon.src = 'assets/trash.svg'; // Use external trash icon
      trashIcon.alt = 'Delete';
      trashIcon.className = 'h-5 w-5';

      removeButton.appendChild(trashIcon);
      removeButton.addEventListener('click', () => {
          removeKeyword(index);
      });

      li.appendChild(keywordSpan);
      li.appendChild(removeButton);
      keywordList.appendChild(li);
  }

  // Function to remove keyword
  function removeKeyword(index) {
      chrome.storage.sync.get('keywords', (items) => {
          const keywords = items.keywords || [];
          keywords.splice(index, 1); // Remove keyword
          chrome.storage.sync.set({ keywords: keywords }, () => {
              keywordList.innerHTML = ''; // Clear the list
              keywords.forEach((keyword, idx) => {
                  addKeywordToList(keyword.data, idx); // Re-render list
              });
          });
      });
  }

  // Handle clearing NSFW history based on manually added keywords
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

                      // Delete history items only if they match the user-added keywords
                      if (matchedKeyword) {
                          chrome.history.deleteUrl({ url: item.url });
                      }
                  }
              });
          });
      });
  });
});
