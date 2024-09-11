// Load settings and keywords from storage
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
  
  // Read keywords from the selected file
  document.getElementById("fileInput").addEventListener("change", (event) => {
    let file = event.target.files[0];
    if (file) {
      let reader = new FileReader();
      reader.onload = function(e) {
        let keywords = e.target.result.split('\n');
        keywords.forEach((keyword) => addKeywordToUI(keyword.trim()));
      };
      reader.readAsText(file);
    }
  });
  
  // Save keywords to the file
  function saveKeywordsToFile() {
    let keywords = [];
    document.querySelectorAll("#keywordList li").forEach((li) => {
      keywords.push(li.textContent);
    });
    let blob = new Blob([keywords.join('\n')], { type: 'text/plain' });
    let a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'keyword.txt';
    a.click();
  }
  