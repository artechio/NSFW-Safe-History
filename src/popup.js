document.addEventListener('DOMContentLoaded', () => {
    const excludeToggle = document.getElementById('excludeToggle');
    const excludeToggleLabel = document.getElementById('excludeToggleLabel');
    const blurToggle = document.getElementById('blurToggle');
    const clearHistory = document.getElementById('clearHistory');
    const openOptions = document.getElementById('openOptions');
    const versionBadge = document.getElementById('versionBadge');
    const rangeButtons = [...document.querySelectorAll('[data-range]')];
    let currentHost = '';
    let selectedRange = 'week';

    versionBadge.textContent = `v${chrome.runtime.getManifest().version}`;

    const rangeLabels = {
        today: 'Clear today',
        week: 'Clear this week',
        month: 'Clear this month',
        all: 'Clear all history'
    };

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
        setTimeout(() => status.remove(), 3500);
    }

    function setExcludeLabel(active) {
        excludeToggleLabel.textContent = active
            ? 'History cleaning and blur are on for this site'
            : 'This site is excluded';
    }

    function setSelectedRange(range) {
        selectedRange = range;
        rangeButtons.forEach(button => {
            button.classList.toggle('is-selected', button.dataset.range === range);
        });
        clearHistory.disabled = false;
        clearHistory.querySelector('span').textContent = rangeLabels[range] || 'Clear selected range';
    }

    function setBusy(busy) {
        clearHistory.disabled = busy;
        rangeButtons.forEach(button => {
            button.disabled = busy;
        });
    }

    sendMessage({ action: 'GET_SETTINGS' }).then(settings => {
        if (!settings || settings.error) throw new Error('settings');
        blurToggle.checked = Boolean(settings.blurEnabled);
        setSelectedRange(settings.lastCleanRange || 'week');
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

    rangeButtons.forEach(button => {
        button.addEventListener('click', () => setSelectedRange(button.dataset.range));
    });

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
        if (!selectedRange) return;
        if (selectedRange === 'all') {
            const ok = window.confirm('Clear all matching history? This cannot be undone.');
            if (!ok) return;
        }

        setBusy(true);
        clearHistory.querySelector('span').textContent = 'Clearing…';
        let finished = false;
        const showDeleted = deleted => {
            if (finished) return;
            finished = true;
            showStatus(
                deleted > 0
                    ? `Removed ${deleted} history entries`
                    : 'No matching history left in that range',
                'success'
            );
            setBusy(false);
            setSelectedRange(selectedRange);
        };

        const onSessionChange = (changes, area) => {
            if (area !== 'session' || !changes.lastClearDeleted) return;
            chrome.storage.onChanged.removeListener(onSessionChange);
            showDeleted(Number(changes.lastClearDeleted.newValue) || 0);
        };
        chrome.storage.onChanged.addListener(onSessionChange);

        sendMessage({ action: 'CLEAR_HISTORY', range: selectedRange }).then(response => {
            if (!response || !response.ok) {
                if (!finished) {
                    finished = true;
                    chrome.storage.onChanged.removeListener(onSessionChange);
                    showStatus('Could not clean history', 'error');
                    setBusy(false);
                    setSelectedRange(selectedRange);
                }
                return;
            }
            chrome.storage.onChanged.removeListener(onSessionChange);
            showDeleted(Number(response.deleted) || 0);
        }).catch(() => {
            // Result may still arrive via storage.session from the service worker.
            setTimeout(() => {
                if (finished) return;
                chrome.storage.session.get(['lastClearDeleted', 'lastClearAt']).then(data => {
                    if (data.lastClearAt && Date.now() - Number(data.lastClearAt) < 15000) {
                        chrome.storage.onChanged.removeListener(onSessionChange);
                        showDeleted(Number(data.lastClearDeleted) || 0);
                        return;
                    }
                    if (!finished) {
                        finished = true;
                        chrome.storage.onChanged.removeListener(onSessionChange);
                        showStatus('Could not clean history', 'error');
                        setBusy(false);
                        setSelectedRange(selectedRange);
                    }
                });
            }, 1500);
        });
    });

    openOptions.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });
});
