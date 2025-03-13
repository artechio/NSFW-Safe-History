document.addEventListener('DOMContentLoaded', async () => {
    // Get DOM elements with error handling
    const elements = {
        cleanInterval: document.getElementById('clean-interval'),
        customDateContainer: document.getElementById('custom-date-container'),
        customDate: document.getElementById('custom-date'),
        autoClean: document.getElementById('auto-clean'),
        useDefaultKeywords: document.getElementById('useDefaultKeywords'),
        defaultKeywords: document.getElementById('defaultKeywords'),
        customKeywords: document.getElementById('customKeywords'),
        importKeywords: document.getElementById('importKeywords'),
        exportKeywords: document.getElementById('exportKeywords'),
        saveKeywords: document.getElementById('saveKeywords'),
        saveSettings: document.getElementById('saveSettings')
    };

    // Validate all elements exist
    for (const [key, element] of Object.entries(elements)) {
        if (!element) {
            console.error(`Element not found: ${key}`);
            return;
        }
    }

    // Load default keywords from file
    async function loadDefaultKeywordsFile() {
        try {
            const response = await fetch(chrome.runtime.getURL('assets/keyword.txt'));
            const text = await response.text();
            elements.defaultKeywords.value = text;
            return text.split('\n').filter(keyword => keyword.trim().length > 0);
        } catch (error) {
            console.error('Error loading default keywords:', error);
            elements.defaultKeywords.value = 'Error loading default keywords';
            return [];
        }
    }

    // Load saved settings
    async function loadSettings() {
        const settings = await chrome.storage.sync.get([
            'cleanInterval',
            'customDate',
            'autoClean',
            'defaultKeywordsEnabled',
            'keywords'
        ]);

        // Set clean interval
        elements.cleanInterval.value = settings.cleanInterval || '1';
        if (elements.cleanInterval.value === 'custom') {
            elements.customDateContainer.classList.remove('hidden');
            elements.customDate.value = settings.customDate || '';
        }

        // Set auto clean
        elements.autoClean.checked = settings.autoClean !== false;

        // Set default keywords toggle
        elements.useDefaultKeywords.checked = settings.defaultKeywordsEnabled !== false;

        // Load custom keywords
        if (settings.keywords) {
            elements.customKeywords.value = settings.keywords.map(k => k.data).join('\n');
        }

        // Load default keywords from file
        await loadDefaultKeywordsFile();
    }

    // Save all settings
    async function saveAllSettings() {
        const settings = {
            cleanInterval: elements.cleanInterval.value,
            customDate: elements.customDate.value,
            autoClean: elements.autoClean.checked,
            defaultKeywordsEnabled: elements.useDefaultKeywords.checked,
            keywords: elements.customKeywords.value
                .split('\n')
                .map(k => k.trim())
                .filter(k => k)
                .map(data => ({ data }))
        };

        try {
            await chrome.storage.sync.set(settings);
            showStatusMessage('Settings saved successfully');
        } catch (error) {
            console.error('Error saving settings:', error);
            showStatusMessage('Error saving settings', 'red');
        }
    }

    // Show status message
    function showStatusMessage(message, color = 'green') {
        const status = document.createElement('div');
        status.textContent = message;
        status.className = `status-message status-${color}`;
        document.body.appendChild(status);
        setTimeout(() => status.remove(), 3000);
    }

    // Event Listeners
    elements.cleanInterval.addEventListener('change', () => {
        elements.customDateContainer.classList.toggle('hidden', 
            elements.cleanInterval.value !== 'custom');
    });

    elements.importKeywords.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt';
        input.onchange = async (e) => {
            try {
                const file = e.target.files[0];
                if (file) {
                    const text = await file.text();
                    elements.customKeywords.value = text;
                    showStatusMessage('Keywords imported successfully');
                }
            } catch (error) {
                console.error('Error importing keywords:', error);
                showStatusMessage('Error importing keywords', 'red');
            }
        };
        input.click();
    });

    elements.exportKeywords.addEventListener('click', () => {
        try {
            const blob = new Blob([elements.customKeywords.value], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'custom_keywords.txt';
            a.click();
            URL.revokeObjectURL(url);
            showStatusMessage('Keywords exported successfully');
        } catch (error) {
            console.error('Error exporting keywords:', error);
            showStatusMessage('Error exporting keywords', 'red');
        }
    });

    elements.saveKeywords.addEventListener('click', saveAllSettings);
    elements.saveSettings.addEventListener('click', saveAllSettings);

    // Initialize
    await loadSettings();
});
