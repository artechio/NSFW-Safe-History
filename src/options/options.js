// Load and save settings
document.addEventListener('DOMContentLoaded', async () => {
    // Get all setting elements
    const enableBlur = document.getElementById('enableImageBlur');
    const blurAmount = document.getElementById('blurAmount');
    const blurOnlyNSFW = document.getElementById('blurOnlyNSFW');
    const blurOptions = document.getElementById('blurOptions');

    // Load saved settings
    chrome.storage.sync.get({
        enableImageBlur: true,
        blurAmount: '10',
        blurOnlyNSFW: true
    }, (settings) => {
        // Apply saved settings to UI
        enableBlur.checked = settings.enableImageBlur;
        blurAmount.value = settings.blurAmount;
        blurOnlyNSFW.checked = settings.blurOnlyNSFW;
        
        // Show/hide sub-options based on main toggle
        blurOptions.style.display = settings.enableImageBlur ? 'block' : 'none';
    });

    // Save settings when changed
    function saveSettings() {
        const settings = {
            enableImageBlur: enableBlur.checked,
            blurAmount: blurAmount.value,
            blurOnlyNSFW: blurOnlyNSFW.checked
        };

        chrome.storage.sync.set(settings, () => {
            // Show save confirmation
            const status = document.createElement('div');
            status.textContent = 'Settings saved';
            status.className = 'save-status';
            document.body.appendChild(status);
            setTimeout(() => status.remove(), 2000);
        });

        // Show/hide sub-options
        blurOptions.style.display = enableBlur.checked ? 'block' : 'none';
    }

    // Add event listeners
    enableBlur.addEventListener('change', saveSettings);
    blurAmount.addEventListener('change', saveSettings);
    blurOnlyNSFW.addEventListener('change', saveSettings);
});