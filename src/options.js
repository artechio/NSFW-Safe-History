document.addEventListener('DOMContentLoaded', async () => {
    // Get DOM elements with error handling
    const elements = {
        historyRange: document.getElementById('historyRange'),
        customDateContainer: document.getElementById('customDateContainer'),
        customStartDate: document.getElementById('customStartDate'),
        autoDelete: document.getElementById('autoDelete'),
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
            'historyRange',
            'customStartDate',
            'autoDelete',
            'defaultKeywordsEnabled',
            'keywords'
        ]);

        // Set history range
        elements.historyRange.value = settings.historyRange || '1';
        if (elements.historyRange.value === 'custom') {
            elements.customDateContainer.classList.remove('hidden');
            elements.customStartDate.value = settings.customStartDate || '';
        }

        // Set auto delete
        elements.autoDelete.checked = settings.autoDelete !== false;

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
            historyRange: elements.historyRange.value,
            customStartDate: elements.customStartDate.value,
            autoDelete: elements.autoDelete.checked,
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
        status.className = `fixed top-4 right-4 px-4 py-2 rounded shadow text-white bg-${color}-500`;
        document.body.appendChild(status);
        setTimeout(() => status.remove(), 3000);
    }

    // Event Listeners
    elements.historyRange.addEventListener('change', () => {
        elements.customDateContainer.classList.toggle('hidden', 
            elements.historyRange.value !== 'custom');
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
