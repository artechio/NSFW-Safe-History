document.addEventListener('DOMContentLoaded', () => {
    const fields = {
        enabled: document.getElementById('enabled'),
        autoDeleteHistory: document.getElementById('autoDeleteHistory'),
        blurEnabled: document.getElementById('blurEnabled'),
        blurIntensity: document.getElementById('blurIntensity'),
        nsfwThreshold: document.getElementById('nsfwThreshold'),
        customDomains: document.getElementById('customDomains'),
        excludedSites: document.getElementById('excludedSites')
    };
    const status = document.getElementById('status');
    const blocklistMeta = document.getElementById('blocklistMeta');
    const saveButton = document.getElementById('save');
    const updateButton = document.getElementById('updateBlocklist');

    function sendMessage(message) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, response => {
                const err = chrome.runtime.lastError;
                if (err) reject(new Error(err.message));
                else resolve(response);
            });
        });
    }

    function showStatus(message, ok) {
        status.textContent = message;
        status.className = ok ? 'status status-success' : 'status status-error';
    }

    function fill(settings) {
        fields.enabled.checked = settings.enabled;
        fields.autoDeleteHistory.checked = settings.autoDeleteHistory;
        fields.blurEnabled.checked = settings.blurEnabled;
        fields.blurIntensity.value = settings.blurIntensity;
        fields.nsfwThreshold.value = settings.nsfwThreshold;
        fields.customDomains.value = (settings.customDomains || []).join('\n');
        fields.excludedSites.value = (settings.excludedSites || []).join('\n');
        if (settings.lastBlocklistUpdate) {
            blocklistMeta.textContent = `Domain list last updated ${new Date(settings.lastBlocklistUpdate).toLocaleString()}.`;
        }
    }

    function lines(value) {
        return value.split('\n').map(line => line.trim()).filter(Boolean);
    }

    sendMessage({ action: 'GET_SETTINGS' })
        .then(settings => {
            if (!settings || settings.error) throw new Error('settings');
            fill(settings);
        })
        .catch(() => showStatus('Could not load settings', false));

    saveButton.addEventListener('click', () => {
        sendMessage({
            action: 'UPDATE_SETTINGS',
            settings: {
                enabled: fields.enabled.checked,
                autoDeleteHistory: fields.autoDeleteHistory.checked,
                blurEnabled: fields.blurEnabled.checked,
                blurIntensity: Number(fields.blurIntensity.value),
                nsfwThreshold: Number(fields.nsfwThreshold.value),
                customDomains: lines(fields.customDomains.value),
                excludedSites: lines(fields.excludedSites.value)
            }
        }).then(settings => {
            fill(settings);
            showStatus('Settings saved', true);
        }).catch(() => showStatus('Could not save settings', false));
    });

    updateButton.addEventListener('click', () => {
        updateButton.disabled = true;
        sendMessage({ action: 'UPDATE_BLOCKLIST' }).then(response => {
            if (!response || !response.ok) {
                showStatus('Could not update the domain list', false);
                return;
            }
            showStatus(`Domain list updated (${response.count} domains)`, true);
            return sendMessage({ action: 'GET_SETTINGS' }).then(fill);
        }).catch(() => showStatus('Could not update the domain list', false))
            .finally(() => {
                updateButton.disabled = false;
            });
    });
});
