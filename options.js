// Load settings and keywords
chrome.storage.sync.get(["keywords", "autoDelete"], (data) => {
    let keywordList = data.keywords || [];
    let autoDelete = data.autoDelete || false;
  
    document.getElementById("autoDelete").checked = autoDelete;
    keywordList.forEach((keyword) => addKeywordToUI(keyword));
  });
  
  // Add a new keyword
  document.getElementById("addKeyword").addEventListener("click", () => {
    let newKeyword = document.getElementById("newKeyword").value;
    if (newKeyword) {
      chrome.storage.sync.get("keywords", (data) => {
        let keywordList = data.keywords || [];
        keywordList.push(newKeyword);
        chrome.storage.sync.set({ keywords: keywordList });
        addKeywordToUI(newKeyword);
      });
      document.getElementById("newKeyword").value = '';
    }
  });
  
  // Handle auto-delete toggle
  document.getElementById("autoDelete").addEventListener("change", (event) => {
    chrome.storage.sync.set({ autoDelete: event.target.checked });
  });
  
  // Helper function to add a keyword to the UI
  function addKeywordToUI(keyword) {
    let ul = document.getElementById("keywordList");
    let li = document.createElement("li");
    li.textContent = keyword;
    ul.appendChild(li);
  }
  