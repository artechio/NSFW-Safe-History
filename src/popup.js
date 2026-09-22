document.addEventListener('DOMContentLoaded', () => {
    const excludeToggle = document.getElementById('excludeToggle');
    const excludeToggleLabel = document.getElementById('excludeToggleLabel');
    const blurToggle = document.getElementById('blurToggle');
    const clearHistory = document.getElementById('clearHistory');
    const openOptions = document.getElementById('openOptions');
    const versionBadge = document.getElementById('versionBadge');
    let currentHost = '';

    versionBadge.textContent = `v${chrome.runtime.getManifest().version}`;

    function sendMessage(message) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, response => {
                const err = chrome.runtime.lastError;
                if (err) reject(new Error(err.message));
                else resolve(response);
            });
        });
    }

    function showStatus(message, type) {
        const status = document.createElement('div');
        status.textContent = message;
        status.className = `status-message status-${type}`;
        document.body.appendChild(status);
        setTimeout(() => status.remove(), 3000);
    }

    function setExcludeLabel(active) {
        excludeToggleLabel.textContent = active
            ? 'History cleaning and blur are on for this site'
            : 'This site is excluded';
    }

    sendMessage({ action: 'GET_SETTINGS' }).then(settings => {
        if (!settings || settings.error) throw new Error('settings');
        blurToggle.checked = Boolean(settings.blurEnabled);
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
            const tab = tabs && tabs[0];
            if (!tab || !tab.url) {
                excludeToggle.disabled = true;
                setExcludeLabel(false);
                return;
            }
            try {
                currentHost = new URL(tab.url).hostname;
            } catch (error) {
                excludeToggle.disabled = true;
                return;
            }
            const excluded = (settings.excludedSites || []).includes(currentHost);
            excludeToggle.checked = !excluded;
            setExcludeLabel(!excluded);
        });
    }).catch(() => showStatus('Could not load settings', 'error'));

    excludeToggle.addEventListener('change', () => {
        if (!currentHost) return;
        sendMessage({ action: 'GET_SETTINGS' }).then(settings => {
            const excluded = new Set(settings.excludedSites || []);
            if (excludeToggle.checked) excluded.delete(currentHost);
            else excluded.add(currentHost);
            return sendMessage({
                action: 'UPDATE_SETTINGS',
                settings: { excludedSites: [...excluded] }
            });
        }).then(() => {
            setExcludeLabel(excludeToggle.checked);
        }).catch(() => showStatus('Could not update this site', 'error'));
    });

    blurToggle.addEventListener('change', () => {
        sendMessage({
            action: 'UPDATE_SETTINGS',
            settings: { blurEnabled: blurToggle.checked }
        }).catch(() => showStatus('Could not update blur', 'error'));
    });

    clearHistory.addEventListener('click', () => {
        clearHistory.disabled = true;
        sendMessage({ action: 'CLEAR_HISTORY' }).then(response => {
            if (!response || !response.ok) {
                showStatus('Could not clean history', 'error');
                return;
            }
            showStatus(`Removed ${response.deleted} history entries`, 'success');
        }).catch(() => showStatus('Could not clean history', 'error'))
            .finally(() => {
                clearHistory.disabled = false;
            });
    });

    openOptions.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });
});
